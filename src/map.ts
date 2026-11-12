import type { Etage } from './data';

export interface Tile {
  x: number;
  y: number;
}

export interface Room extends Tile {
  id: string;
  kind: string;
  nom: string;
  w: number;
  h: number;
  door: Tile;
  pole?: string;
  couleur?: string;
}

export interface Furniture extends Tile {
  kind: string;
  blocking: boolean;
  agent?: string;
}

export interface Spot extends Tile {
  cafe: boolean;
}

export interface Floor {
  index: number;
  etage: Etage;
  w: number;
  h: number;
  rooms: Room[];
  furniture: Furniture[];
  doors: Tile[];
  /** Cases ou l'on attend l'ascenseur, devant ses portes. */
  elevator: Tile[];
  spots: Spot[];
  blocked: Uint8Array;
  seatOwner: (string | null)[];
  roomAt: Int16Array;
}

export interface Seat extends Tile {
  floor: number;
}

export interface Building {
  floors: Floor[];
  seats: Record<string, Seat>;
}

export interface Group {
  pole: string;
  nom: string;
  prop: string;
  agents: string[];
}

// Coupe d'un etage, du fond vers l'avant : mur, pieces nord, cloison, couloir, cloison, pieces sud.
const DEPTH = 7;
const NORTH_Y = 1;
const NORTH_WALL = NORTH_Y + DEPTH;
const SOUTH_WALL = NORTH_WALL + 3;
const SOUTH_Y = SOUTH_WALL + 1;
const HEIGHT = SOUTH_Y + DEPTH;
// Le palier d'ascenseur occupe x 1..3 ; la premiere cloison est en x 4.
const FIRST_X = 5;
const MIN_WIDTH = 14;

type Item = [kind: string, dx: number, dy: number];
type SpotDef = [dx: number, dy: number, cafe?: boolean];

interface Template {
  nom: string;
  w: number;
  couleur: string;
  items: Item[];
  spots: SpotDef[];
}

const grid = (kind: string, xs: number[], ys: number[]): Item[] => xs.flatMap((x) => ys.map((y): Item => [kind, x, y]));

// Pieces communes. La derniere colonne reste libre : c'est celle de la porte.
const TEMPLATES: Record<string, Template> = {
  kitchenette: {
    nom: 'Kitchenette', w: 5, couleur: '#a8763e',
    items: [['cafe', 0, 0], ['evier', 1, 0], ['frigo', 2, 0], ['mangedebout', 1, 3]],
    spots: [[0, 1, true], [1, 1, true], [0, 3], [2, 3], [1, 4]],
  },
  reunion: {
    nom: 'Salle de réunion', w: 7, couleur: '#5f7a94',
    items: [...grid('table', [1, 2, 3, 4], [2, 3]), ['tableau', 2, 0]],
    spots: [[0, 2], [0, 3], [5, 2], [5, 3], [1, 1], [2, 1], [3, 1], [4, 1], [1, 4], [2, 4], [3, 4], [4, 4]],
  },
  conseil: {
    nom: 'Salle du conseil', w: 9, couleur: '#7a5c8a',
    items: [...grid('table', [1, 2, 3, 4, 5, 6], [2, 3]), ['tableau', 3, 0], ['plante', 0, 0]],
    spots: [[0, 2], [0, 3], [7, 2], [7, 3], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4]],
  },
  serveurs: {
    nom: 'Salle serveurs', w: 5, couleur: '#39465a',
    items: [...grid('serveur', [0, 1, 2], [0]), ...grid('baie', [0, 1, 2], [3])],
    spots: [[1, 1], [1, 4], [3, 2]],
  },
  archives: {
    nom: 'Archives et imprimantes', w: 5, couleur: '#8a7a5a',
    items: [...grid('biblio', [0, 1, 2], [0]), ['imprimante', 0, 3], ['imprimante', 1, 3]],
    spots: [[1, 1], [0, 4], [2, 3]],
  },
  labo: {
    nom: 'Laboratoire', w: 7, couleur: '#2a8a7a',
    items: [['robot', 0, 0], ['ecran', 2, 0], ['robot', 4, 0], ...grid('paillasse', [1, 2, 3], [3])],
    spots: [[1, 4], [2, 4], [3, 4], [1, 1], [3, 1]],
  },
  salon: {
    nom: 'Salon', w: 5, couleur: '#6b5fa8',
    items: [...grid('canape', [0, 1, 2], [0]), ['plante', 3, 0], ['canape', 0, 3]],
    spots: [[0, 1], [1, 1], [2, 1], [1, 3]],
  },
  accueil: {
    nom: 'Accueil', w: 7, couleur: '#c9a227',
    items: [...grid('banque', [1, 2, 3], [3]), ['plante', 0, 0], ['plante', 5, 0]],
    spots: [[1, 5], [2, 5], [3, 5], [4, 4]],
  },
  cafeteria: {
    nom: 'Cafétéria', w: 9, couleur: '#a8763e',
    items: [['cafe', 0, 0], ['comptoir', 1, 0], ['comptoir', 2, 0], ['evier', 3, 0], ['frigo', 4, 0], ['mangedebout', 1, 3], ['mangedebout', 4, 3], ['mangedebout', 6, 4]],
    spots: [[0, 1, true], [1, 1, true], [2, 1, true], [0, 3], [2, 3], [3, 3], [5, 3], [1, 4], [4, 4], [6, 5], [7, 4]],
  },
  detente: {
    nom: 'Coin détente', w: 7, couleur: '#4f8a5f',
    items: [...grid('canape', [0, 1, 2], [0]), ['plante', 3, 0], ['fontaine', 5, 0], ['canape', 0, 3], ['canape', 1, 3]],
    spots: [[0, 1], [1, 1], [2, 1], [5, 1], [0, 4], [1, 4]],
  },
};

interface Plan {
  kind: string;
  nom: string;
  w: number;
  pole?: string;
  prop?: string;
  agents?: string[];
  template?: Template;
}

const poleWidth = (n: number) => 2 * Math.max(2, Math.ceil(n / 2)) + 1;

function buildFloor(etage: Etage, index: number, groups: Group[], chef: string, seats: Record<string, Seat>): Floor {
  const plans: Plan[] = [];
  for (const g of groups) {
    const team = g.agents.filter((id) => id !== chef);
    if (team.length < g.agents.length) plans.push({ kind: 'chef', nom: 'Bureau du chef', w: 5, pole: g.pole, prop: g.prop, agents: [chef] });
    if (team.length > 0) plans.push({ kind: 'pole', nom: g.nom, w: poleWidth(team.length), pole: g.pole, prop: g.prop, agents: team });
  }
  const commons = [...etage.pieces];
  if (!commons.includes('conseil')) commons.push('reunion');
  if (!commons.includes('cafeteria')) commons.push('kitchenette');
  for (const kind of commons) {
    const template = TEMPLATES[kind];
    if (template) plans.push({ kind, nom: template.nom, w: template.w, template });
  }

  // Repartition des pieces de part et d'autre du couloir, en equilibrant les longueurs.
  const cursor = { n: FIRST_X, s: FIRST_X };
  const rooms: Room[] = [];
  const furniture: Furniture[] = [];
  const spots: Spot[] = [];
  const doors: Tile[] = [];
  const glass = new Set<string>();
  const sides = new Set<'n' | 's'>();

  // L'accueil passe en premier : il se retrouve au fond, contre le palier, sous le mur logo.
  const first = (p: Plan) => (p.kind === 'accueil' ? 0 : 1);
  for (const plan of [...plans].sort((a, b) => first(a) - first(b) || b.w - a.w)) {
    const side = cursor.n <= cursor.s ? 'n' : 's';
    sides.add(side);
    const x0 = cursor[side];
    const y0 = side === 'n' ? NORTH_Y : SOUTH_Y;
    const wallY = side === 'n' ? NORTH_WALL : SOUTH_WALL;
    cursor[side] += plan.w + 1;

    const cols = (plan.w - 1) / 2;
    const doorCol = plan.kind === 'pole' ? 2 * Math.floor(cols / 2) : plan.w - 1;
    const door = { x: x0 + doorCol, y: wallY };
    doors.push(door);
    rooms.push({
      id: `${etage.id}:${plan.kind}${plan.pole ? ':' + plan.pole : ''}`,
      kind: plan.kind, nom: plan.nom, x: x0, y: y0, w: plan.w, h: DEPTH, door,
      pole: plan.pole, couleur: plan.template?.couleur,
    });

    for (let y = y0; y < y0 + DEPTH; y++) glass.add(`${x0 + plan.w},${y}`);
    for (let x = x0 - 1; x <= x0 + plan.w; x++) glass.add(`${x},${wallY}`);

    if (plan.template) {
      for (const [kind, dx, dy] of plan.template.items) furniture.push({ kind, x: x0 + dx, y: y0 + dy, blocking: true });
      for (const [dx, dy, cafe] of plan.template.spots) spots.push({ x: x0 + dx, y: y0 + dy, cafe: Boolean(cafe) });
      continue;
    }

    // Un poste = siege, puis bureau devant lui (cote spectateur), puis une rangee libre.
    const perRow = plan.kind === 'chef' ? 1 : cols;
    plan.agents!.forEach((id, i) => {
      const x = x0 + 1 + 2 * (i % perRow);
      const y = y0 + 1 + 3 * Math.floor(i / perRow);
      seats[id] = { floor: index, x, y };
      furniture.push({ kind: 'chaise', x, y, blocking: false });
      furniture.push({ kind: 'bureau', x, y: y + 1, blocking: true, agent: id });
    });
    if (plan.kind === 'chef') {
      furniture.push({ kind: 'tableau', x: x0 + 3, y: y0, blocking: true });
      furniture.push({ kind: 'plante', x: x0, y: y0 + 5, blocking: true });
      furniture.push({ kind: 'canape', x: x0 + 2, y: y0 + 5, blocking: true });
    } else {
      furniture.push({ kind: plan.prop ?? 'plante', x: x0 + plan.w - 1, y: y0, blocking: true });
    }
  }

  const w = Math.max(MIN_WIDTH, cursor.n, cursor.s);
  if (sides.has('n')) for (let y = NORTH_Y; y < NORTH_WALL; y++) glass.add(`${FIRST_X - 1},${y}`);
  if (sides.has('s')) for (let y = SOUTH_Y; y < HEIGHT; y++) glass.add(`${FIRST_X - 1},${y}`);
  for (const d of doors) {
    glass.delete(`${d.x},${d.y}`);
    furniture.push({ kind: 'porte', x: d.x, y: d.y, blocking: false });
  }
  for (const key of glass) {
    const [x, y] = key.split(',').map(Number);
    furniture.push({ kind: 'cloison', x, y, blocking: true });
  }

  // Murs du fond : ascenseur sur le palier, logo derriere l'accueil, une fenetre sur deux ailleurs.
  const accueil = rooms.find((r) => r.kind === 'accueil');
  for (let x = 0; x < w; x++) {
    const lift = x === 1 || x === 2;
    const logo = accueil && accueil.y === NORTH_Y && (x === accueil.x + 2 || x === accueil.x + 3);
    const kind = lift ? 'ascenseur' : logo ? 'logo' : x > 3 && x % 2 === 1 ? 'fenetre' : 'mur';
    furniture.push({ kind, x, y: 0, blocking: true });
  }
  for (let y = 1; y < HEIGHT; y++) furniture.push({ kind: y % 2 === 0 ? 'fenetre' : 'mur', x: 0, y, blocking: true });
  furniture.push({ kind: 'plante', x: 1, y: HEIGHT - 1, blocking: true });

  const blocked = new Uint8Array(w * HEIGHT);
  const seatOwner: (string | null)[] = new Array(w * HEIGHT).fill(null);
  const roomAt = new Int16Array(w * HEIGHT).fill(-1);
  rooms.forEach((r, ri) => {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) roomAt[y * w + x] = ri;
  });
  for (const f of furniture) if (f.blocking) blocked[f.y * w + f.x] = 1;
  for (const [id, s] of Object.entries(seats)) if (s.floor === index) seatOwner[s.y * w + s.x] = id;

  return {
    index, etage, w, h: HEIGHT, rooms, furniture, doors, spots, blocked, seatOwner, roomAt,
    elevator: [{ x: 1, y: 1 }, { x: 2, y: 1 }],
  };
}

/** Un etage par entree de `etages` (triee par numero). Un pole absent de tous les etages va au rez-de-chaussee. */
export function buildBuilding(etages: Etage[], groups: Group[], chef: string): Building {
  const sorted = [...etages].sort((a, b) => a.numero - b.numero);
  const floorOf = (pole: string) => Math.max(0, sorted.findIndex((e) => e.poles.includes(pole)));
  const seats: Record<string, Seat> = {};
  const floors = sorted.map((etage, index) => {
    const own = groups.filter((g) => g.agents.length > 0 && floorOf(g.pole) === index);
    return buildFloor(etage, index, own, chef, seats);
  });
  return { floors, seats };
}

const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/** Plus court chemin sur un etage (sans la case de depart). Murs, cloisons, meubles et sieges des autres sont infranchissables. */
export function findPath(floor: Floor, from: Tile, to: Tile, self: string): Tile[] | null {
  const { w, h } = floor;
  const start = from.y * w + from.x;
  const goal = to.y * w + to.x;
  if (start === goal) return [];
  const prev = new Int32Array(w * h).fill(-1);
  const queue = [start];
  prev[start] = start;
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    if (cur === goal) break;
    const cx = cur % w;
    const cy = (cur - cx) / w;
    for (const [dx, dy] of STEPS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const n = ny * w + nx;
      if (prev[n] !== -1 || floor.blocked[n]) continue;
      const owner = floor.seatOwner[n];
      if (owner !== null && owner !== self) continue;
      prev[n] = cur;
      queue.push(n);
    }
  }
  if (prev[goal] === -1) return null;
  const path: Tile[] = [];
  for (let cur = goal; cur !== start; cur = prev[cur]) path.push({ x: cur % w, y: Math.floor(cur / w) });
  return path.reverse();
}
