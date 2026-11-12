export interface Tile {
  x: number;
  y: number;
}

export interface Zone extends Tile {
  pole: string;
  w: number;
  h: number;
}

export interface Furniture extends Tile {
  kind: string;
  blocking: boolean;
  agent?: string;
}

export interface OfficeMap {
  w: number;
  h: number;
  zones: Zone[];
  furniture: Furniture[];
  seats: Record<string, Tile>;
  spots: Tile[];
  labels: (Tile & { text: string })[];
  blocked: Uint8Array;
  seatOwner: (string | null)[];
  zoneAt: Int16Array;
}

export interface Group {
  pole: string;
  prop: string;
  agents: string[];
}

// Position et nombre de colonnes de postes de chaque pole. La bande y 8..14 reste libre pour les espaces communs.
const PLACES: Record<string, { x: number; y: number; cols: number }> = {
  direction: { x: 1, y: 1, cols: 2 },
  qualite: { x: 8, y: 1, cols: 4 },
  atelier: { x: 19, y: 1, cols: 4 },
  build: { x: 30, y: 1, cols: 2 },
  docs: { x: 1, y: 15, cols: 2 },
  reseau: { x: 8, y: 15, cols: 2 },
  tests: { x: 15, y: 15, cols: 3 },
  oss: { x: 15, y: 20, cols: 3 },
  croissance: { x: 24, y: 15, cols: 2 },
  revue: { x: 1, y: 25, cols: 7 },
  'build-os': { x: 18, y: 25, cols: 6 },
};

const COMMON: Furniture[] = [
  { kind: 'cafe', x: 3, y: 9, blocking: true },
  { kind: 'comptoir', x: 4, y: 9, blocking: true },
  ...[15, 16, 17, 18].flatMap((x) => [10, 11].map((y) => ({ kind: 'table', x, y, blocking: true }))),
  { kind: 'plante', x: 26, y: 9, blocking: true },
  { kind: 'canape', x: 27, y: 9, blocking: true },
  { kind: 'canape', x: 28, y: 9, blocking: true },
  { kind: 'canape', x: 29, y: 9, blocking: true },
  { kind: 'plante', x: 30, y: 9, blocking: true },
  { kind: 'fontaine', x: 33, y: 10, blocking: true },
  { kind: 'plante', x: 0, y: 8, blocking: true },
  { kind: 'plante', x: 12, y: 12, blocking: true },
  { kind: 'plante', x: 22, y: 9, blocking: true },
  { kind: 'plante', x: 34, y: 13, blocking: true },
];

const SPOTS: Tile[] = [
  { x: 3, y: 10 }, { x: 4, y: 10 }, { x: 5, y: 9 },
  { x: 14, y: 10 }, { x: 14, y: 11 }, { x: 19, y: 10 }, { x: 19, y: 11 },
  { x: 15, y: 12 }, { x: 16, y: 12 }, { x: 17, y: 12 }, { x: 18, y: 12 },
  { x: 15, y: 9 }, { x: 16, y: 9 }, { x: 17, y: 9 }, { x: 18, y: 9 },
  { x: 27, y: 10 }, { x: 28, y: 10 }, { x: 29, y: 10 },
  { x: 33, y: 11 }, { x: 32, y: 10 },
];

const LABELS = [
  { text: 'Coin café', x: 3, y: 9 },
  { text: 'Salle de réunion', x: 15, y: 10 },
  { text: 'Détente', x: 27, y: 9 },
];

export function buildMap(groups: Group[]): OfficeMap {
  const zones: Zone[] = [];
  const furniture: Furniture[] = [...COMMON];
  const seats: Record<string, Tile> = {};
  let overflowY = 36;

  for (const g of groups) {
    if (g.agents.length === 0) continue;
    let place = PLACES[g.pole];
    if (!place) {
      place = { x: 1, y: overflowY + 1, cols: Math.min(g.agents.length, 10) };
    }
    const rows = Math.ceil(g.agents.length / place.cols);
    const zone: Zone = { pole: g.pole, x: place.x, y: place.y, w: 2 * place.cols + 1, h: 3 * rows + 1 };
    if (!PLACES[g.pole]) overflowY = zone.y + zone.h;
    zones.push(zone);

    // Un poste = siege, puis bureau devant lui (cote spectateur), puis une rangee libre.
    g.agents.forEach((id, i) => {
      const x = zone.x + 1 + 2 * (i % place.cols);
      const y = zone.y + 1 + 3 * Math.floor(i / place.cols);
      seats[id] = { x, y };
      furniture.push({ kind: 'chaise', x, y, blocking: false });
      furniture.push({ kind: 'bureau', x, y: y + 1, blocking: true, agent: id });
    });
    furniture.push({ kind: g.prop, x: zone.x + zone.w - 1, y: zone.y, blocking: true });
  }

  const w = Math.max(36, ...zones.map((z) => z.x + z.w + 1));
  const h = Math.max(36, ...zones.map((z) => z.y + z.h + 1));
  const blocked = new Uint8Array(w * h);
  const seatOwner: (string | null)[] = new Array(w * h).fill(null);
  const zoneAt = new Int16Array(w * h).fill(-1);

  zones.forEach((z, zi) => {
    for (let y = z.y; y < z.y + z.h; y++) for (let x = z.x; x < z.x + z.w; x++) zoneAt[y * w + x] = zi;
  });
  for (const f of furniture) if (f.blocking) blocked[f.y * w + f.x] = 1;
  for (const [id, s] of Object.entries(seats)) seatOwner[s.y * w + s.x] = id;

  return { w, h, zones, furniture, seats, spots: SPOTS, labels: LABELS, blocked, seatOwner, zoneAt };
}

const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/** Plus court chemin sur la grille (sans la case de depart). Les sieges des autres agents sont infranchissables. */
export function findPath(map: OfficeMap, from: Tile, to: Tile, self: string): Tile[] | null {
  const { w, h } = map;
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
      if (prev[n] !== -1 || map.blocked[n]) continue;
      const owner = map.seatOwner[n];
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
