import type { Agent, Pole } from './data';
import { findPath, type Building, type Floor, type Seat, type Tile } from './map';
import { characterSprite, floorSprite, furnitureSprite, lookFor, mix, ringSprite, SKY, skyPhase, type Look, type Material, type Phase, type Pose, type Sprite } from './sprites';

const HALF_W = 16;
const HALF_H = 8;
const SPEED = 3;
const MAX_AWAY = 10;
const MIN_ZOOM = 1;
const MAX_ZOOM = 6;
const LIFT_SECONDS = 2.5;
const DOOR_RANGE = 1.3;
const DOWNSTAIRS_CHANCE = 0.25;
// Hauteur d'un etage de facade et marge de terrain dessinee autour de l'immeuble, en tuiles.
const STORY = 36;
const MARGIN = 6;
const PARQUET = new Set(['chef', 'conseil', 'salon']);
const TILED = new Set(['kitchenette', 'cafeteria', 'accueil']);
const BLINKING = new Set(['serveur', 'baie']);

type State = 'sit' | 'move' | 'idle';
type Leg = { walk: Tile } | { lift: number };

interface Actor {
  agent: Agent;
  look: Look;
  home: Seat;
  floor: number;
  x: number;
  y: number;
  state: State;
  path: Tile[];
  legs: Leg[];
  goal: 'sit' | 'idle';
  /** Secondes restantes dans l'ascenseur ; l'agent est invisible tant que c'est positif. */
  lift: number;
  liftTo: number;
  timer: number;
  spot: string | null;
  back: boolean;
  phase: number;
  mission: string | null;
  /** La mission vient d'une vraie session Claude Code : l'ecran du bureau s'allume. */
  live: boolean;
  /** En pause sur une chaise (salle de reunion). */
  seated: boolean;
  wantCafe: boolean;
}

interface Drawable {
  depth: number;
  sprite: Sprite;
  sx: number;
  sy: number;
  actor?: Actor;
  /** Porte ou ascenseur : sprite ouvert et case qui declenche l'ouverture. */
  open?: Sprite;
  door?: Tile;
  /** Fenetre : le sprite depend de l'heure. */
  window?: boolean;
  /** Seconde image des LED qui clignotent. */
  alt?: Sprite;
  /** Bureau : sprite a ecran allume et agent a qui il appartient. */
  lit?: Sprite;
  owner?: Actor;
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pickOne = <T>(list: T[]) => list[Math.floor(Math.random() * list.length)];
const screenX = (x: number, y: number) => Math.round((x - y) * HALF_W);
const screenY = (x: number, y: number) => Math.round((x + y) * HALF_H);

export const floorShort = (numero: number) => (numero === 0 ? 'RDC' : numero === 1 ? '1er' : `${numero}e`);

export class Game {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly actors: Actor[] = [];
  private readonly byId = new Map<string, Actor>();
  private readonly statics: Drawable[][];
  private readonly grounds: (HTMLCanvasElement | undefined)[] = [];
  private readonly takenSpots = new Set<string>();
  private readonly liftOpen: number[];
  private phase: Phase = skyPhase(new Date().getHours());
  private hourOverride: number | null = null;
  private view = 0;
  private zoom = 2;
  private camX = 0;
  private camY = 0;
  private sized = false;
  private clock = 0;
  private highlight: Set<string> | null = null;
  private hover: string | null = null;
  private selected: string | null = null;
  private drag: { x: number; y: number; camX: number; camY: number; moved: boolean } | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    agents: Agent[],
    private readonly poles: Map<string, Pole>,
    private readonly building: Building,
    private readonly onSelect: (id: string | null) => void,
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.liftOpen = building.floors.map(() => 0);

    for (const agent of agents) {
      const home = building.seats[agent.id];
      if (!home) continue;
      const color = poles.get(agent.pole)?.couleur ?? '#8a8f98';
      const actor: Actor = {
        agent, home, look: lookFor(agent.id, color), floor: home.floor,
        x: home.x, y: home.y, state: 'sit', path: [], legs: [], goal: 'sit', lift: 0, liftTo: home.floor,
        timer: rand(2, 60), spot: null, back: false, phase: Math.random() * 10, mission: null, live: false, seated: false, wantCafe: false,
      };
      this.actors.push(actor);
      this.byId.set(agent.id, actor);
    }

    this.statics = building.floors.map((floor) => {
      const list = floor.furniture.map((f): Drawable => {
        const owner = f.agent ? this.byId.get(f.agent) : undefined;
        const pole = poles.get(owner?.agent.pole ?? floor.rooms[floor.roomAt[f.y * floor.w + f.x]]?.pole ?? '');
        const base = { depth: f.x + f.y - (f.kind === 'chaise' ? 0.2 : 0), sx: screenX(f.x, f.y), sy: screenY(f.x, f.y) };
        if (f.kind === 'porte' || f.kind === 'ascenseur') {
          return { ...base, sprite: furnitureSprite(f.kind), open: furnitureSprite(`${f.kind}${f.kind === 'porte' ? '-ouverte' : '-ouvert'}`), door: { x: f.x, y: f.y } };
        }
        if (f.kind === 'bureau') {
          const flag = pole?.openSpace && owner ? owner.look.shirt : '';
          return { ...base, sprite: furnitureSprite('bureau', flag), lit: furnitureSprite('bureau-live', flag), owner };
        }
        if (f.kind === 'fenetre') return { ...base, sprite: furnitureSprite('fenetre', this.phase), window: true };
        if (BLINKING.has(f.kind)) return { ...base, sprite: furnitureSprite(f.kind), alt: furnitureSprite(`${f.kind}-b`) };
        return { ...base, sprite: furnitureSprite(f.kind, pole?.couleur ?? '') };
      });
      // Arbres devant l'immeuble, au niveau de la rue : plus bas a l'ecran quand on est en etage.
      const drop = floor.index * STORY;
      const tree = (x: number, y: number) => list.push({
        depth: x + y + (drop ? 1000 : 0), sprite: furnitureSprite('arbre'), sx: screenX(x, y), sy: screenY(x, y) + drop,
      });
      for (let y = 1; y < floor.h + 3; y += 4) tree(floor.w + 3, y);
      for (let x = 1; x < floor.w; x += 4) tree(x, floor.h + 3);
      return list;
    });

    this.bind();
  }

  start(): void {
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      this.update(dt);
      this.render();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  get floorIndex(): number {
    return this.view;
  }

  setFloor(index: number): void {
    if (index === this.view || !this.building.floors[index]) return;
    this.view = index;
    this.hover = null;
    const f = this.building.floors[index];
    this.centerOn(f.w / 2, f.h / 2);
  }

  setHighlight(ids: Set<string> | null): void {
    this.highlight = ids;
  }

  setSelected(id: string | null): void {
    this.selected = id;
  }

  /** Etage ou se trouve l'agent en ce moment (celui d'arrivee s'il est dans l'ascenseur). */
  agentFloor(id: string): number {
    const a = this.byId.get(id);
    return a ? this.whereIs(a) : 0;
  }

  /** Nombre d'agents presents a chaque etage. */
  presence(): number[] {
    const counts = this.building.floors.map(() => 0);
    for (const a of this.actors) counts[this.whereIs(a)]++;
    return counts;
  }

  focusPole(poleId: string): void {
    const index = this.building.floors.findIndex((f) => f.rooms.some((r) => r.pole === poleId && r.kind === 'pole'));
    if (index < 0) return;
    this.setFloor(index);
    const room = this.building.floors[index].rooms.find((r) => r.pole === poleId && r.kind === 'pole')!;
    this.centerOn(room.x + room.w / 2, room.y + room.h / 2);
  }

  /** Affiche l'etage de l'agent, centre la camera sur lui et renvoie cet etage. */
  focusAgent(id: string): number {
    const a = this.byId.get(id);
    if (!a) return this.view;
    this.setFloor(this.whereIs(a));
    this.centerOn(a.x, a.y);
    return this.view;
  }

  zoomBy(delta: number): void {
    this.zoomAt(this.canvas.width / 2, this.canvas.height / 2, delta);
  }

  /** Donne une mission a un agent : il regagne son bureau (par l'ascenseur au besoin) et sa bulle affiche le libelle. */
  setMission(id: string, label: string, live = false): void {
    const a = this.byId.get(id);
    if (!a) return;
    a.mission = label;
    a.live = live;
    a.wantCafe = false;
    const headingHome = a.state === 'move' && a.goal === 'sit';
    if (a.state !== 'sit' && !headingHome) this.goTo(a, a.home.floor, a.home, 'sit', null);
  }

  /** Fin de mission : l'agent part au cafe des qu'il est a son poste. */
  finishMission(id: string): void {
    const a = this.byId.get(id);
    if (!a || !a.mission) return;
    a.mission = null;
    a.live = false;
    a.wantCafe = true;
  }

  /** Force l'heure du ciel (0-23) pour tester le rendu ; null revient a l'heure reelle. */
  setHour(hour: number | null): void {
    this.hourOverride = hour;
  }

  private whereIs(a: Actor): number {
    return a.lift > 0 ? a.liftTo : a.floor;
  }

  private liftTile(a: Actor, floor: number): Tile {
    const tiles = this.building.floors[floor].elevator;
    return tiles[Math.floor(a.phase) % tiles.length];
  }

  private goTo(a: Actor, floor: number, tile: Tile, goal: 'sit' | 'idle', spot: string | null): void {
    if (a.spot) this.takenSpots.delete(a.spot);
    a.spot = spot;
    if (spot) this.takenSpots.add(spot);
    a.goal = goal;
    a.state = 'move';
    a.seated = false;
    const inLift = a.lift > 0;
    const from = this.whereIs(a);
    if (from === floor) a.legs = [{ walk: tile }];
    else a.legs = [...(inLift ? [] : [{ walk: this.liftTile(a, from) }]), { lift: floor }, { walk: tile }];
    // On termine le pas en cours avant de changer de trajet.
    a.path = inLift ? [] : a.path.slice(0, 1);
  }

  private startBreak(a: Actor, cafe: boolean): boolean {
    const down = a.home.floor !== 0 && Math.random() < DOWNSTAIRS_CHANCE;
    const index = down ? 0 : a.home.floor;
    const floor = this.building.floors[index];
    const free = floor.spots.map((s, i) => ({ s, key: `${index}:${i}` })).filter((c) => !this.takenSpots.has(c.key));
    const wanted = cafe ? free.filter((c) => c.s.cafe) : free;
    const pool = wanted.length > 0 ? wanted : free;
    if (pool.length === 0) return false;
    const choice = pickOne(pool);
    this.goTo(a, index, choice.s, 'idle', choice.key);
    return true;
  }

  private nextLeg(a: Actor): void {
    const leg = a.legs.shift();
    if (!leg) {
      a.back = false;
      a.state = a.goal === 'idle' ? 'idle' : 'sit';
      a.timer = a.goal === 'idle' ? rand(5, 11) : rand(25, 90);
      if (a.state === 'idle' && a.spot) {
        const [floor, index] = a.spot.split(':').map(Number);
        a.seated = this.building.floors[floor].spots[index].seat;
      }
      return;
    }
    if ('lift' in leg) {
      a.lift = LIFT_SECONDS;
      a.liftTo = leg.lift;
      this.liftOpen[a.floor] = this.clock + 1;
      return;
    }
    const here = { x: Math.round(a.x), y: Math.round(a.y) };
    const path = findPath(this.building.floors[a.floor], here, leg.walk, a.agent.id);
    if (path) a.path = path;
    else {
      a.x = leg.walk.x;
      a.y = leg.walk.y;
    }
  }

  private update(dt: number): void {
    this.clock += dt;
    const phase = skyPhase(this.hourOverride ?? new Date().getHours());
    if (phase !== this.phase) {
      this.phase = phase;
      // Les fenetres de la facade dependent de l'heure : on repeint les sols.
      this.grounds.length = 0;
    }
    let away = 0;
    for (const a of this.actors) if (a.state !== 'sit') away++;

    for (const a of this.actors) {
      if (a.state === 'sit') {
        if (a.mission) continue;
        if (a.wantCafe) {
          a.wantCafe = false;
          if (this.startBreak(a, true)) away++;
          continue;
        }
        a.timer -= dt;
        if (a.timer > 0) continue;
        a.timer = rand(25, 90);
        if (away < MAX_AWAY && this.startBreak(a, false)) away++;
        continue;
      }

      if (a.state === 'idle') {
        a.timer -= dt;
        if (a.timer <= 0) this.goTo(a, a.home.floor, a.home, 'sit', null);
        continue;
      }

      if (a.lift > 0) {
        a.lift -= dt;
        if (a.lift <= 0) {
          a.floor = a.liftTo;
          const t = this.liftTile(a, a.floor);
          a.x = t.x;
          a.y = t.y;
          this.liftOpen[a.floor] = this.clock + 1.2;
        }
        continue;
      }

      let step = SPEED * dt;
      while (step > 0 && a.path.length > 0) {
        const t = a.path[0];
        const dx = t.x - a.x;
        const dy = t.y - a.y;
        const dist = Math.abs(dx) + Math.abs(dy);
        if (dist > 0) a.back = dx < 0 || dy < 0;
        if (dist <= step) {
          a.x = t.x;
          a.y = t.y;
          a.path.shift();
          step -= dist;
        } else {
          a.x += Math.sign(dx) * step;
          a.y += Math.sign(dy) * step;
          step = 0;
        }
      }
      if (a.path.length === 0) this.nextLeg(a);
    }
  }

  private scale(): number {
    return Math.max(1, Math.round(this.zoom * devicePixelRatio));
  }

  private centerOn(tx: number, ty: number): void {
    const s = this.scale();
    this.camX = Math.round(this.canvas.width / 2 - (tx - ty) * HALF_W * s);
    this.camY = Math.round(this.canvas.height / 2 - (tx + ty) * HALF_H * s);
  }

  private zoomAt(px: number, py: number, delta: number): void {
    const before = this.scale();
    const wx = (px - this.camX) / before;
    const wy = (py - this.camY) / before;
    this.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this.zoom + delta));
    const after = this.scale();
    this.camX = Math.round(px - wx * after);
    this.camY = Math.round(py - wy * after);
  }

  private ground(floor: Floor): HTMLCanvasElement {
    const cached = this.grounds[floor.index];
    if (cached) return cached;
    const { w, h } = floor;
    const drop = floor.index * STORY;
    const canvas = document.createElement('canvas');
    canvas.width = (w + h + 2 * MARGIN) * HALF_W;
    canvas.height = (w + h + 2 * MARGIN) * HALF_H + HALF_H + drop;
    const c = canvas.getContext('2d')!;
    const [originX, originY] = this.groundOrigin(floor);
    const tile = (material: Material, color: string, x: number, y: number, dy = 0) => {
      const sprite = floorSprite(material, color, (x + y) & 1);
      c.drawImage(sprite.img, originX + (x - y) * HALF_W - sprite.ax, originY + (x + y) * HALF_H - sprite.ay + dy);
    };

    // 1. La rue : trottoir autour de l'immeuble puis herbe, au niveau du sol (donc plus bas en etage).
    for (let y = -MARGIN; y < h + MARGIN; y++) {
      for (let x = -MARGIN; x < w + MARGIN; x++) {
        const out = Math.max(-x, x - (w - 1), -y, y - (h - 1));
        if (out > 0) tile(out <= 2 ? 'trottoir' : 'herbe', out <= 2 ? '#9aa0aa' : '#4f9a52', x, y, drop);
      }
    }

    // 2. Les deux facades visibles, qui descendent du plancher jusqu'a la rue.
    const [skyTop, skyBottom] = SKY[this.phase];
    const glass = mix(skyTop, skyBottom, 0.5);
    const face = (length: number, at: (i: number) => [number, number], wall: string) => {
      for (let i = 0; i < length * HALF_W; i++) {
        const [sx, sy] = at(i);
        const col = Math.floor(i / HALF_W);
        const inWindow = i % HALF_W >= 4 && i % HALF_W <= 11;
        for (let d = 0; d < Math.max(drop, 4); d++) {
          const level = Math.floor(d / STORY);
          const within = d % STORY;
          let color = within < 4 ? mix(wall, '#ffffff', 0.25) : wall;
          if (inWindow && within >= 11 && within <= 25) {
            const lit = this.phase === 'nuit' && (col * 7 + level * 13 + floor.index) % 3 !== 0;
            color = lit ? '#ffd27a' : this.phase === 'nuit' ? '#1a2140' : mix(glass, wall, 0.15);
          }
          c.fillStyle = color;
          c.fillRect(originX + sx, originY + sy + d, 1, 1);
        }
      }
    };
    face(w, (i) => [-h * HALF_W + i, (h - 1) * HALF_H + Math.floor(i / 2)], '#cfc8b8');
    face(h, (i) => [(w - h) * HALF_W + i, (w + h - 1) * HALF_H - Math.floor(i / 2) - 1], '#aaa291');

    // 3. Le plancher de l'etage.
    const hall = floor.index === 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const room = floor.rooms[floor.roomAt[y * w + x]];
        if (!room) {
          tile(hall ? 'carrelage' : 'beton', hall ? '#c9c2b4' : x <= 3 ? '#7a808c' : '#6c727e', x, y);
          continue;
        }
        const pole = this.poles.get(room.pole ?? '');
        if (PARQUET.has(room.kind) || room.pole === 'direction') tile('parquet', '#a9773f', x, y);
        else if (TILED.has(room.kind)) tile('carrelage', '#d6cfc0', x, y);
        else tile('moquette', mix(pole?.couleur ?? room.couleur ?? '#8a8f98', '#2b2f3a', 0.55), x, y);
      }
    }
    this.grounds[floor.index] = canvas;
    return canvas;
  }

  private groundOrigin(floor: Floor): [number, number] {
    return [(floor.h + MARGIN) * HALF_W, 2 * MARGIN * HALF_H + HALF_H];
  }

  private bind(): void {
    const c = this.canvas;
    const pos = (e: PointerEvent | WheelEvent) => [e.offsetX * devicePixelRatio, e.offsetY * devicePixelRatio] as const;

    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      this.drag = { x: e.clientX, y: e.clientY, camX: this.camX, camY: this.camY, moved: false };
    });
    c.addEventListener('pointermove', (e) => {
      const d = this.drag;
      if (d) {
        const dx = e.clientX - d.x;
        const dy = e.clientY - d.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
        if (d.moved) {
          this.camX = Math.round(d.camX + dx * devicePixelRatio);
          this.camY = Math.round(d.camY + dy * devicePixelRatio);
        }
      } else {
        this.hover = this.pick(...pos(e));
      }
      c.style.cursor = d?.moved ? 'grabbing' : this.hover ? 'pointer' : 'grab';
    });
    c.addEventListener('pointerup', (e) => {
      const d = this.drag;
      this.drag = null;
      if (d && !d.moved) this.onSelect(this.pick(...pos(e)));
    });
    c.addEventListener('pointercancel', () => (this.drag = null));
    c.addEventListener('pointerleave', () => (this.hover = null));
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoomAt(...pos(e), e.deltaY < 0 ? 1 : -1);
    }, { passive: false });
  }

  private visible(a: Actor): boolean {
    return a.floor === this.view && a.lift <= 0;
  }

  private pick(px: number, py: number): string | null {
    const s = this.scale();
    const wx = (px - this.camX) / s;
    const wy = (py - this.camY) / s;
    let best: Actor | null = null;
    for (const a of this.actors) {
      if (!this.visible(a)) continue;
      const sx = screenX(a.x, a.y);
      const sy = screenY(a.x, a.y);
      if (wx < sx - 7 || wx > sx + 7 || wy < sy - 21 || wy > sy + 1) continue;
      if (!best || a.x + a.y > best.x + best.y) best = a;
    }
    return best?.agent.id ?? null;
  }

  private pose(a: Actor): Pose {
    if (a.state === 'sit') return Math.floor(this.clock * 5 + a.phase) % 2 ? 'sit1' : 'sit0';
    if (a.state === 'idle') return a.seated ? 'sit0' : 'stand';
    return Math.floor(this.clock * 8 + a.phase) % 2 ? 'walk1' : 'walk0';
  }

  private render(): void {
    const { canvas, ctx } = this;
    const floor = this.building.floors[this.view];
    const width = Math.round(canvas.clientWidth * devicePixelRatio);
    const height = Math.round(canvas.clientHeight * devicePixelRatio);
    if (width === 0 || height === 0) return;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      if (!this.sized) {
        this.sized = true;
        this.centerOn(floor.w / 2, floor.h / 2);
      }
    }

    const s = this.scale();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#1b1e27';
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(s, 0, 0, s, this.camX, this.camY);
    const [originX, originY] = this.groundOrigin(floor);
    ctx.drawImage(this.ground(floor), -originX, -originY);
    const blink = Math.floor(this.clock * 2) % 2 === 1;

    const here = this.actors.filter((a) => this.visible(a));
    const items: Drawable[] = this.statics[this.view].slice();
    for (const a of here) {
      items.push({
        depth: a.x + a.y + 0.05,
        sprite: characterSprite(a.look, this.pose(a), a.back),
        sx: screenX(a.x, a.y),
        sy: screenY(a.x, a.y),
        actor: a,
      });
    }
    items.sort((p, q) => p.depth - q.depth);

    const liftOpen = this.liftOpen[this.view] > this.clock;
    const bob = Math.floor(this.clock * 3) % 2;
    for (const it of items) {
      const a = it.actor;
      if (!a) {
        let sprite = it.sprite;
        if (it.window) sprite = furnitureSprite('fenetre', this.phase);
        else if (it.alt && blink) sprite = it.alt;
        else if (it.lit && it.owner?.live && it.owner.state === 'sit') sprite = it.lit;
        if (it.door && it.open) {
          const d = it.door;
          const near = here.some((p) => Math.abs(p.x - d.x) + Math.abs(p.y - d.y) < DOOR_RANGE);
          if (near || (d.y === 0 && liftOpen)) sprite = it.open;
        }
        ctx.drawImage(sprite.img, it.sx - sprite.ax, it.sy - sprite.ay);
        continue;
      }
      const id = a.agent.id;
      const lit = this.highlight?.has(id) ?? false;
      if (id === this.selected || lit) {
        const ring = ringSprite(id === this.selected ? '#ffffff' : '#ffd84a');
        ctx.drawImage(ring.img, it.sx - ring.ax, it.sy - ring.ay);
      }
      if (this.highlight && !lit && id !== this.selected) ctx.globalAlpha = 0.22;
      ctx.drawImage(it.sprite.img, it.sx - it.sprite.ax, it.sy - it.sprite.ay);
      ctx.globalAlpha = 1;
      if (lit) {
        ctx.fillStyle = '#ffd84a';
        ctx.fillRect(it.sx - 2, it.sy - 27 + bob, 5, 2);
        ctx.fillRect(it.sx - 1, it.sy - 25 + bob, 3, 1);
        ctx.fillRect(it.sx, it.sy - 24 + bob, 1, 1);
      }
    }

    this.renderLabels(s, floor, here);
  }

  private renderLabels(s: number, floor: Floor, here: Actor[]): void {
    const { ctx } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const dpr = devicePixelRatio;
    const size = Math.round(Math.min(15 * dpr, Math.max(10 * dpr, 4.5 * s)));
    ctx.font = `600 ${size}px ui-monospace, "Cascadia Mono", Consolas, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const label = (text: string, wx: number, wy: number, bg: string, fg: string) => {
      const x = Math.round(this.camX + wx * s);
      const y = Math.round(this.camY + wy * s);
      const w = Math.ceil(ctx.measureText(text).width) + size;
      const h = Math.round(size * 1.6);
      ctx.fillStyle = bg;
      ctx.fillRect(x - w / 2, y - h, w, h);
      ctx.fillStyle = fg;
      ctx.fillText(text, x, y - h / 2 + 1);
    };

    label(`${floorShort(floor.etage.numero)} · ${floor.etage.nom}`, screenX(2, 0), screenY(2, 0) - 54, '#ffd84a', '#11131a');
    for (const r of floor.rooms) {
      const color = this.poles.get(r.pole ?? '')?.couleur ?? '#e8ebf2';
      label(r.nom, screenX(r.x + r.w / 2, r.y), screenY(r.x + r.w / 2, r.y) - HALF_H - 3, color, '#11131a');
      if (r.kind === 'accueil') label('QG', screenX(r.x + 3, 0), screenY(r.x + 3, 0) - 22, '#11131a', '#ffd84a');
    }

    const named = this.highlight && this.highlight.size <= 30 ? this.highlight : null;
    for (const a of here) {
      const id = a.agent.id;
      const show = id === this.hover || id === this.selected || a.mission || named?.has(id);
      if (!show) continue;
      const text = a.mission ? `${a.agent.prenom} : ${a.mission}` : a.agent.prenom;
      label(text, screenX(a.x, a.y), screenY(a.x, a.y) - 30, a.mission ? '#ffd84a' : '#11131aee', a.mission ? '#11131a' : '#ffffff');
    }
  }
}
