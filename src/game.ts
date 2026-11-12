import type { Agent, Pole } from './data';
import { findPath, type OfficeMap, type Tile } from './map';
import { characterSprite, floorSprite, furnitureSprite, lookFor, mix, ringSprite, type Look, type Pose, type Sprite } from './sprites';

const HALF_W = 16;
const HALF_H = 8;
const SPEED = 3;
const MAX_AWAY = 6;
const MIN_ZOOM = 1;
const MAX_ZOOM = 6;

type State = 'sit' | 'go' | 'idle' | 'back';

interface Actor {
  agent: Agent;
  look: Look;
  home: Tile;
  x: number;
  y: number;
  state: State;
  path: Tile[];
  timer: number;
  spot: number;
  back: boolean;
  phase: number;
  mission: string | null;
  wantCafe: boolean;
}

interface Drawable {
  depth: number;
  sprite: Sprite;
  sx: number;
  sy: number;
  actor?: Actor;
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const screenX = (x: number, y: number) => Math.round((x - y) * HALF_W);
const screenY = (x: number, y: number) => Math.round((x + y) * HALF_H);

export class Game {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly actors: Actor[] = [];
  private readonly byId = new Map<string, Actor>();
  private readonly statics: Drawable[] = [];
  private readonly floor: HTMLCanvasElement;
  private readonly floorOX: number;
  private readonly takenSpots = new Set<number>();
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
    private readonly map: OfficeMap,
    private readonly onSelect: (id: string | null) => void,
  ) {
    this.ctx = canvas.getContext('2d')!;

    for (const agent of agents) {
      const home = map.seats[agent.id];
      const color = poles.get(agent.pole)?.couleur ?? '#8a8f98';
      const actor: Actor = {
        agent, home, look: lookFor(agent.id, color),
        x: home.x, y: home.y, state: 'sit', path: [], timer: rand(2, 60), spot: -1,
        back: false, phase: Math.random() * 10, mission: null, wantCafe: false,
      };
      this.actors.push(actor);
      this.byId.set(agent.id, actor);
    }

    for (const f of map.furniture) {
      const pole = f.agent ? poles.get(this.byId.get(f.agent)!.agent.pole) : poles.get(map.zones[map.zoneAt[f.y * map.w + f.x]]?.pole ?? '');
      const tint = f.kind === 'bureau' ? (pole?.openSpace ? this.byId.get(f.agent!)!.look.shirt : '') : pole?.couleur ?? '';
      this.statics.push({
        depth: f.x + f.y - (f.kind === 'chaise' ? 0.2 : 0),
        sprite: furnitureSprite(f.kind, tint),
        sx: screenX(f.x, f.y),
        sy: screenY(f.x, f.y),
      });
    }

    this.floorOX = map.h * HALF_W;
    this.floor = this.paintFloor();
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

  setHighlight(ids: Set<string> | null): void {
    this.highlight = ids;
  }

  setSelected(id: string | null): void {
    this.selected = id;
  }

  focusZone(poleId: string): void {
    const z = this.map.zones.find((zone) => zone.pole === poleId);
    if (z) this.centerOn(z.x + z.w / 2, z.y + z.h / 2);
  }

  focusAgent(id: string): void {
    const a = this.byId.get(id);
    if (a) this.centerOn(a.x, a.y);
  }

  zoomBy(delta: number): void {
    this.zoomAt(this.canvas.width / 2, this.canvas.height / 2, delta);
  }

  /** Donne une mission a un agent : il regagne son bureau et sa bulle affiche le libelle. */
  setMission(id: string, label: string): void {
    const a = this.byId.get(id);
    if (!a) return;
    a.mission = label;
    a.wantCafe = false;
    if (a.state === 'go' || a.state === 'idle') this.sendHome(a);
  }

  /** Fin de mission : l'agent part au cafe des qu'il est a son poste. */
  finishMission(id: string): void {
    const a = this.byId.get(id);
    if (!a || !a.mission) return;
    a.mission = null;
    a.wantCafe = true;
  }

  private startTrip(a: Actor, preferred: number[]): boolean {
    const isFree = (i: number) => !this.takenSpots.has(i);
    let pool = preferred.filter(isFree);
    if (pool.length === 0) pool = this.map.spots.map((_, i) => i).filter(isFree);
    if (pool.length === 0) return false;
    const spot = pool[Math.floor(Math.random() * pool.length)];
    const path = findPath(this.map, a.home, this.map.spots[spot], a.agent.id);
    if (!path) return false;
    a.path = path;
    a.spot = spot;
    a.state = 'go';
    this.takenSpots.add(spot);
    return true;
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

  private paintFloor(): HTMLCanvasElement {
    const { w, h, zones, zoneAt } = this.map;
    const canvas = document.createElement('canvas');
    canvas.width = (w + h) * HALF_W;
    canvas.height = (w + h) * HALF_H + HALF_H;
    const c = canvas.getContext('2d')!;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const zone = zones[zoneAt[y * w + x]];
        const base = zone ? mix(this.poles.get(zone.pole)?.couleur ?? '#8a8f98', '#2b2f3a', 0.6) : '#4b5160';
        const sprite = floorSprite((x + y) % 2 ? base : mix(base, '#000000', 0.07));
        c.drawImage(sprite.img, this.floorOX + (x - y) * HALF_W - sprite.ax, (x + y) * HALF_H + HALF_H - sprite.ay);
      }
    }
    return canvas;
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

  private pick(px: number, py: number): string | null {
    const s = this.scale();
    const wx = (px - this.camX) / s;
    const wy = (py - this.camY) / s;
    let best: Actor | null = null;
    for (const a of this.actors) {
      const sx = screenX(a.x, a.y);
      const sy = screenY(a.x, a.y);
      if (wx < sx - 7 || wx > sx + 7 || wy < sy - 21 || wy > sy + 1) continue;
      if (!best || a.x + a.y > best.x + best.y) best = a;
    }
    return best?.agent.id ?? null;
  }

  private sendHome(a: Actor): void {
    const from = a.path[0] ?? { x: Math.round(a.x), y: Math.round(a.y) };
    const way = findPath(this.map, from, a.home, a.agent.id) ?? [];
    a.path = a.path[0] ? [from, ...way] : way;
    a.state = 'back';
    this.takenSpots.delete(a.spot);
    a.spot = -1;
  }

  private update(dt: number): void {
    this.clock += dt;
    let away = 0;
    for (const a of this.actors) if (a.state !== 'sit') away++;

    for (const a of this.actors) {
      if (a.state === 'sit') {
        if (a.mission) continue;
        if (a.wantCafe) {
          a.wantCafe = false;
          if (this.startTrip(a, this.map.cafeSpots)) away++;
          continue;
        }
        a.timer -= dt;
        if (a.timer > 0) continue;
        a.timer = rand(25, 90);
        if (away < MAX_AWAY && this.startTrip(a, [])) away++;
        continue;
      }

      if (a.state === 'idle') {
        a.timer -= dt;
        if (a.timer <= 0) this.sendHome(a);
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
      if (a.path.length === 0) {
        a.back = false;
        if (a.state === 'go') {
          a.state = 'idle';
          a.timer = rand(4, 10);
        } else {
          a.state = 'sit';
          a.timer = rand(25, 90);
        }
      }
    }
  }

  private pose(a: Actor): Pose {
    if (a.state === 'sit') return Math.floor(this.clock * 5 + a.phase) % 2 ? 'sit1' : 'sit0';
    if (a.state === 'idle') return 'stand';
    return Math.floor(this.clock * 8 + a.phase) % 2 ? 'walk1' : 'walk0';
  }

  private render(): void {
    const { canvas, ctx } = this;
    const width = Math.round(canvas.clientWidth * devicePixelRatio);
    const height = Math.round(canvas.clientHeight * devicePixelRatio);
    if (width === 0 || height === 0) return;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      if (!this.sized) {
        this.sized = true;
        this.centerOn(this.map.w / 2, 18);
      }
    }

    const s = this.scale();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#1b1e27';
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(s, 0, 0, s, this.camX, this.camY);
    ctx.drawImage(this.floor, -this.floorOX, -HALF_H);

    const items: Drawable[] = this.statics.slice();
    for (const a of this.actors) {
      items.push({
        depth: a.x + a.y + 0.05,
        sprite: characterSprite(a.look, this.pose(a), a.back),
        sx: screenX(a.x, a.y),
        sy: screenY(a.x, a.y),
        actor: a,
      });
    }
    items.sort((p, q) => p.depth - q.depth);

    const bob = Math.floor(this.clock * 3) % 2;
    for (const it of items) {
      const a = it.actor;
      if (a) {
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
      } else {
        ctx.drawImage(it.sprite.img, it.sx - it.sprite.ax, it.sy - it.sprite.ay);
      }
    }

    this.renderLabels(s);
  }

  private renderLabels(s: number): void {
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

    for (const z of this.map.zones) {
      const pole = this.poles.get(z.pole);
      if (pole) label(pole.nom, screenX(z.x, z.y), screenY(z.x, z.y) - HALF_H - 3, pole.couleur, '#11131a');
    }

    for (const l of this.map.labels) {
      label(l.text, screenX(l.x, l.y), screenY(l.x, l.y) - 30, '#e8ebf2', '#11131a');
    }

    const named = this.highlight && this.highlight.size <= 30 ? this.highlight : null;
    for (const a of this.actors) {
      const id = a.agent.id;
      const show = id === this.hover || id === this.selected || a.mission || named?.has(id);
      if (!show) continue;
      const text = a.mission ? `${a.agent.prenom} : ${a.mission}` : a.agent.prenom;
      label(text, screenX(a.x, a.y), screenY(a.x, a.y) - 30, a.mission ? '#ffd84a' : '#11131aee', a.mission ? '#11131a' : '#ffffff');
    }
  }
}
