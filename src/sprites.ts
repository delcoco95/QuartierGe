// Tout le pixel art est dessine ici, pixel par pixel, puis mis en cache dans des canvas hors ecran.
type Ctx = CanvasRenderingContext2D;

export interface Sprite {
  img: HTMLCanvasElement;
  ax: number;
  ay: number;
}

export interface Look {
  skin: string;
  hair: string;
  style: number;
  shirt: string;
  pants: string;
  shoes: string;
  glasses: boolean;
}

export type Pose = 'sit0' | 'sit1' | 'stand' | 'walk0' | 'walk1';
export type Material = 'moquette' | 'parquet' | 'carrelage' | 'beton' | 'trottoir' | 'herbe';
export type Phase = 'matin' | 'jour' | 'soir' | 'nuit';

const cache = new Map<string, Sprite>();

function make(key: string, w: number, h: number, ax: number, ay: number, draw: (c: Ctx) => void): Sprite {
  let sprite = cache.get(key);
  if (!sprite) {
    const img = document.createElement('canvas');
    img.width = w;
    img.height = h;
    draw(img.getContext('2d')!);
    sprite = { img, ax, ay };
    cache.set(key, sprite);
  }
  return sprite;
}

function channels(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}

export function mix(a: string, b: string, t: number): string {
  const ca = channels(a);
  const cb = channels(b);
  const out = ca.map((v, i) => Math.round(v + (cb[i] - v) * t));
  return '#' + out.map((v) => v.toString(16).padStart(2, '0')).join('');
}

const dark = (hex: string, t: number) => mix(hex, '#000000', t);
const light = (hex: string, t: number) => mix(hex, '#ffffff', t);
const noise = (x: number, y: number) => (Math.imul(x + 31, 73856093) ^ Math.imul(y + 17, 19349663)) >>> 0;

function px(c: Ctx, x: number, y: number, w: number, h: number, color: string): void {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
}

/** Pave isometrique : losange de demi-largeur hw centre en (cx, cy), eleve de hgt pixels. */
function block(c: Ctx, cx: number, cy: number, hw: number, hgt: number, top: string, left = dark(top, 0.22), right = dark(top, 0.42)): void {
  for (let x = -hw; x < hw; x++) {
    const e = (hw - Math.abs(x + 0.5)) / 2;
    const yTop = Math.round(cy - hgt - e);
    const yMid = Math.round(cy - hgt + e);
    const yBot = Math.round(cy + e);
    px(c, cx + x, yTop, 1, Math.max(1, yMid - yTop), top);
    if (yBot > yMid) px(c, cx + x, yMid, 1, yBot - yMid, x < 0 ? left : right);
  }
}

/** Trait qui suit la pente d'une face du pave. from/to = distance en pixels depuis le bord exterieur. */
function faceLine(c: Ctx, cx: number, cy: number, hw: number, hgt: number, side: -1 | 1, off: number, from: number, to: number, color: string): void {
  for (let k = from; k <= to; k++) {
    const x = side < 0 ? -hw + k : hw - 1 - k;
    const e = (hw - Math.abs(x + 0.5)) / 2;
    px(c, cx + x, Math.round(cy - hgt + e) + off, 1, 1, color);
  }
}

/** Panneau vertical mince (ecran, dossier) pose en (cx, cy), le long de l'axe x du plateau. */
function plane(c: Ctx, cx: number, cy: number, len: number, h: number, color: string): void {
  for (let i = -len; i < len; i++) px(c, cx + i, cy + Math.round(i / 2) - h, 1, h, color);
}

function shadow(c: Ctx, cx: number, cy: number, hw: number): void {
  c.globalAlpha = 0.16;
  block(c, cx + 3, cy + 2, hw, 0, '#000000');
  c.globalAlpha = 1;
}

// ---------- Sols ----------

function floorColor(material: Material, color: string, parity: number, x: number, y: number): string {
  // a et b : coordonnees dans la tuile, de -8 a 8, le long des deux axes du plateau.
  const xr = x + 0.5 - 16;
  const yr = y + 0.5 - 8;
  const a = xr / 2 + yr;
  const b = yr - xr / 2;
  const n = noise(x, y);
  switch (material) {
    case 'parquet': {
      const plank = Math.floor((a + 8) / 4);
      const tone = [0, 0.1, 0.04, 0.14][(plank + parity * 2) % 4];
      const seam = (a + 8) % 4 < 1 || (b + 8 + plank * 5) % 16 < 1;
      return dark(color, seam ? tone + 0.2 : tone);
    }
    case 'carrelage':
    case 'trottoir': {
      const base = parity ? color : light(color, 0.07);
      return a > 7 || b > 7 ? dark(base, 0.2) : n % 23 === 0 ? light(base, 0.08) : base;
    }
    case 'beton':
      return n % 13 === 0 ? dark(color, 0.07) : n % 29 === 0 ? light(color, 0.05) : parity ? color : dark(color, 0.02);
    case 'herbe':
      return n % 5 === 0 ? dark(color, 0.14) : n % 7 === 0 ? light(color, 0.12) : color;
    default: {
      const base = parity ? color : dark(color, 0.07);
      return n % 7 === 0 ? dark(base, 0.1) : n % 11 === 0 ? light(base, 0.06) : base;
    }
  }
}

export function floorSprite(material: Material, color: string, parity: number): Sprite {
  return make(`floor:${material}:${color}:${parity}`, 32, 16, 16, 8, (c) => {
    for (let x = 0; x < 32; x++) {
      const e = (16 - Math.abs(x + 0.5 - 16)) / 2;
      for (let y = Math.round(8 - e); y < Math.round(8 + e); y++) px(c, x, y, 1, 1, floorColor(material, color, parity, x, y));
    }
  });
}

export function ringSprite(color: string): Sprite {
  return make(`ring:${color}`, 32, 16, 16, 8, (c) => {
    for (let x = -12; x < 12; x++) {
      const e = (12 - Math.abs(x + 0.5)) / 2;
      px(c, 16 + x, Math.round(8 - e), 1, 1, color);
      px(c, 16 + x, Math.round(8 + e) - 1, 1, 1, color);
    }
  });
}

// ---------- Ciel ----------

export function skyPhase(hour: number): Phase {
  if (hour >= 6 && hour < 10) return 'matin';
  if (hour >= 10 && hour < 17) return 'jour';
  if (hour >= 17 && hour < 20) return 'soir';
  return 'nuit';
}

/** Couleurs du ciel vu par les fenetres, du haut vers le bas. */
export const SKY: Record<Phase, [string, string]> = {
  matin: ['#9ec9e8', '#ffd6a5'],
  jour: ['#6fb7e0', '#cdeaf7'],
  soir: ['#6d5a9c', '#f4845f'],
  nuit: ['#0d1230', '#1f2a5c'],
};

// ---------- Mobilier et murs ----------

const WALL = 40;
const BOOKS = ['#e5484d', '#3b82c4', '#f2c14e', '#43a047'];
const NO_SHADOW = new Set(['mur', 'fenetre', 'logo', 'ascenseur', 'ascenseur-ouvert', 'cloison', 'porte', 'porte-ouverte', 'table', 'banque', 'paillasse', 'comptoir', 'arbre']);
const SMALL = new Set(['chaise', 'plante', 'plante-p', 'mangedebout', 'fontaine', 'robot', 'drapeau']);

function drawServer(c: Ctx, cx: number, cy: number, body: string, led: string, shift: number): void {
  block(c, cx, cy, 9, 24, body);
  for (let off = 3; off < 22; off += 4) {
    faceLine(c, cx, cy, 9, 24, -1, off, 1, 7, dark(body, 0.5));
    const k = 1 + ((off + shift * 3) % 5);
    faceLine(c, cx, cy, 9, 24, -1, off, k, k + 1, led);
    faceLine(c, cx, cy, 9, 24, -1, off, 7 - ((off / 4 + shift) % 2), 7, '#f2a541');
  }
}

function drawDesk(c: Ctx, cx: number, cy: number, tint: string, live: boolean): void {
  block(c, cx, cy, 11, 7, '#aab1bc', '#8c94a1', '#727a87');
  block(c, cx, cy - 7, 13, 2, '#fbfcfd', '#dfe4ea', '#c5ccd5');
  block(c, 21, 33, 4, 1, '#c9ced6');
  const glow = '#6fe8ff';
  if (live) {
    c.globalAlpha = 0.5;
    block(c, 17, 34, 8, 0, glow);
    c.globalAlpha = 1;
  }
  // Deux ecrans vus de dos, du cote du spectateur.
  for (const [mx, my] of [[8, 36], [14, 39]]) {
    if (live) plane(c, mx, my - 1, 4, 9, glow);
    px(c, mx, my - 2, 1, 2, '#555b68');
    plane(c, mx, my - 2, 3, 6, '#2a2e38');
    plane(c, mx, my - 7, 3, 1, '#454b59');
  }
  if (tint) {
    px(c, 25, 24, 1, 9, '#d9dde3');
    px(c, 26, 24, 4, 3, tint);
  }
}

function drawFurniture(c: Ctx, kind: string, tint: string): void {
  const cx = 16;
  const cy = 44;
  if (!NO_SHADOW.has(kind)) shadow(c, cx, cy, SMALL.has(kind) ? 7 : 13);
  switch (kind) {
    case 'bureau':
    case 'bureau-live':
      drawDesk(c, cx, cy, tint, kind === 'bureau-live');
      break;
    case 'chaise':
      px(c, 15, 41, 3, 3, '#22252d');
      block(c, cx, cy - 2, 5, 3, '#4a5061');
      plane(c, 21, 36, 4, 8, '#343a48');
      plane(c, 21, 28, 4, 1, '#4a5061');
      break;
    case 'tableau':
      block(c, cx, cy, 11, 2, '#8a8f98');
      block(c, cx, 42, 10, 20, '#f4f6f8', '#e9edf1', '#cdd5dd');
      faceLine(c, cx, 42, 10, 20, -1, 4, 2, 7, '#e5484d');
      faceLine(c, cx, 42, 10, 20, -1, 8, 2, 5, '#3b82c4');
      faceLine(c, cx, 42, 10, 20, -1, 12, 3, 8, '#43a047');
      break;
    case 'ecranmural':
      block(c, cx, cy, 4, 2, '#555b68');
      px(c, 16, 30, 1, 12, '#555b68');
      plane(c, 16, 34, 13, 17, '#1d2330');
      plane(c, 16, 33, 12, 15, '#2f6f8f');
      plane(c, 12, 26, 5, 2, '#ffd84a');
      plane(c, 19, 31, 6, 4, '#5fe08a');
      plane(c, 11, 31, 3, 3, '#e8ebf2');
      break;
    case 'ecran':
      block(c, cx, cy, 9, 4, '#4a4f5c');
      block(c, cx, 40, 8, 16, '#1d2330', '#12303a', '#0f1a26');
      faceLine(c, cx, 40, 8, 16, -1, 3, 1, 6, '#5fe08a');
      faceLine(c, cx, 40, 8, 16, -1, 6, 1, 4, '#5fe08a');
      faceLine(c, cx, 40, 8, 16, -1, 9, 1, 5, '#f2c14e');
      break;
    case 'serveur':
      drawServer(c, cx, cy, '#3a3f4b', '#5fe08a', 0);
      break;
    case 'serveur-b':
      drawServer(c, cx, cy, '#3a3f4b', '#5fe08a', 1);
      break;
    case 'baie':
      drawServer(c, cx, cy, '#39465a', '#5cc8ff', 0);
      break;
    case 'baie-b':
      drawServer(c, cx, cy, '#39465a', '#5cc8ff', 1);
      break;
    case 'banc':
      block(c, cx, cy, 11, 9, '#9aa3ad');
      block(c, 11, 35, 3, 4, '#3ddc6a');
      block(c, 21, 35, 3, 4, '#e5484d');
      break;
    case 'biblio':
      block(c, cx, cy, 10, 24, '#7a5535');
      for (let off = 3; off < 22; off += 6) {
        for (let k = 1; k <= 8; k++) {
          const color = BOOKS[(Math.floor((k - 1) / 2) + off) % BOOKS.length];
          for (let d = 0; d < 4; d++) {
            faceLine(c, cx, cy, 10, 24, -1, off + d, k, k, color);
            faceLine(c, cx, cy, 10, 24, 1, off + d, k, k, dark(color, 0.3));
          }
        }
      }
      break;
    case 'armoire':
      block(c, cx, cy, 8, 19, '#b4bcc7');
      for (let off = 6; off < 19; off += 6) {
        faceLine(c, cx, cy, 8, 19, -1, off, 0, 7, '#7f8794');
        faceLine(c, cx, cy, 8, 19, -1, off - 3, 3, 4, '#555b68');
      }
      faceLine(c, cx, cy, 8, 19, -1, 16, 3, 4, '#555b68');
      break;
    case 'robot':
      block(c, cx, cy, 6, 9, '#aab2bd');
      block(c, cx, 35, 5, 6, '#d5dbe3');
      faceLine(c, cx, 35, 5, 6, -1, 2, 1, 1, '#12a3a3');
      faceLine(c, cx, 35, 5, 6, -1, 2, 3, 3, '#12a3a3');
      px(c, 16, 23, 1, 4, '#8a8f98');
      px(c, 15, 21, 3, 2, '#e5484d');
      break;
    case 'cartons':
      block(c, cx, cy, 9, 8, '#c49a6c');
      block(c, 14, 36, 6, 6, '#d4ab7d');
      faceLine(c, cx, cy, 9, 8, -1, 3, 0, 8, '#e9d3b0');
      faceLine(c, 14, 36, 6, 6, 1, 2, 0, 5, '#e9d3b0');
      break;
    case 'affiche':
      block(c, cx, cy, 4, 2, '#555b68');
      block(c, cx, 42, 9, 22, light(tint, 0.6), tint, dark(tint, 0.25));
      faceLine(c, cx, 42, 9, 22, -1, 5, 2, 6, '#ffffff');
      faceLine(c, cx, 42, 9, 22, -1, 9, 2, 5, '#ffffff');
      faceLine(c, cx, 42, 9, 22, -1, 13, 2, 6, '#ffffff');
      break;
    case 'drapeau':
      block(c, cx, cy, 3, 2, '#666c78');
      px(c, 16, 14, 1, 29, '#d9dde3');
      px(c, 17, 14, 9, 6, tint);
      px(c, 17, 20, 9, 1, dark(tint, 0.3));
      break;
    case 'plante':
      block(c, cx, cy, 4, 5, '#b5623c');
      px(c, 11, 31, 10, 5, '#2f8f4e');
      px(c, 13, 27, 6, 4, '#2f8f4e');
      px(c, 9, 33, 14, 3, '#3aa85d');
      px(c, 14, 28, 2, 2, '#58c47a');
      px(c, 18, 32, 2, 2, '#58c47a');
      px(c, 11, 34, 2, 1, '#58c47a');
      break;
    case 'plante-p':
      block(c, cx, cy, 3, 4, '#d9d2c5');
      px(c, 13, 35, 6, 4, '#3aa85d');
      px(c, 14, 33, 4, 2, '#2f8f4e');
      px(c, 15, 34, 1, 1, '#58c47a');
      break;
    case 'plante-g':
      block(c, cx, cy, 5, 6, '#8a6a45');
      px(c, 15, 22, 2, 16, '#6b4a2b');
      px(c, 9, 12, 14, 12, '#2f8f4e');
      px(c, 7, 16, 18, 6, '#3aa85d');
      px(c, 11, 9, 10, 4, '#3aa85d');
      px(c, 12, 13, 3, 2, '#58c47a');
      px(c, 19, 17, 3, 2, '#58c47a');
      px(c, 9, 20, 2, 2, '#236b3a');
      px(c, 20, 23, 3, 2, '#236b3a');
      break;
    case 'arbre':
      c.globalAlpha = 0.2;
      block(c, cx + 3, cy + 2, 14, 0, '#000000');
      c.globalAlpha = 1;
      px(c, 14, 26, 4, 18, '#5d4126');
      px(c, 17, 26, 1, 18, '#44301c');
      px(c, 5, 6, 22, 18, '#2b7a43');
      px(c, 2, 11, 28, 9, '#2b7a43');
      px(c, 8, 2, 16, 5, '#36934f');
      px(c, 4, 9, 18, 8, '#36934f');
      px(c, 9, 5, 6, 3, '#55b56b');
      px(c, 6, 11, 4, 3, '#55b56b');
      px(c, 18, 9, 5, 2, '#55b56b');
      px(c, 20, 18, 7, 5, '#1f5c33');
      px(c, 9, 21, 8, 3, '#1f5c33');
      break;
    case 'cafe':
      block(c, cx, cy, 8, 17, '#7b2d2d');
      faceLine(c, cx, cy, 8, 17, -1, 4, 1, 5, '#ffd27a');
      faceLine(c, cx, cy, 8, 17, -1, 5, 1, 5, '#ffd27a');
      faceLine(c, cx, cy, 8, 17, -1, 10, 2, 4, '#1b1e27');
      break;
    case 'comptoir':
      block(c, cx, cy, 13, 9, '#d9d2c5');
      block(c, 13, 35, 2, 2, '#ffffff');
      block(c, 19, 34, 2, 2, '#ffffff');
      break;
    case 'table':
      block(c, cx, cy, 16, 5, '#7d5a36', '#6b4c2d', '#573d24');
      block(c, cx, cy - 5, 16, 2, '#c39a62', '#a47c4f', '#86663b');
      break;
    case 'canape':
      block(c, cx, cy, 14, 5, '#6b5fa8');
      block(c, 20, 37, 10, 5, '#584d92');
      break;
    case 'fontaine':
      block(c, cx, cy, 5, 12, '#e8edf2');
      block(c, cx, 32, 4, 7, '#7cc4ee');
      px(c, 15, 26, 2, 1, '#bfe6fb');
      break;
    case 'mur':
    case 'fenetre':
    case 'logo': {
      block(c, cx, cy, 16, WALL, '#efe9dc', '#d9d2c2', '#c4bcab');
      if (kind === 'logo') {
        for (let off = 8; off < 27; off++) {
          faceLine(c, cx, cy, 16, WALL, -1, off, 3, 12, '#ffd84a');
          faceLine(c, cx, cy, 16, WALL, 1, off, 3, 12, '#d9b02e');
        }
      } else if (kind === 'fenetre') {
        const phase = (tint || 'jour') as Phase;
        const [top, bottom] = SKY[phase];
        for (let off = 7; off < 28; off++) {
          const frame = off === 7 || off === 27 || off === 17;
          const sky = mix(top, bottom, (off - 8) / 19);
          for (let k = 2; k <= 13; k++) {
            const edge = frame || k === 2 || k === 13;
            const star = phase === 'nuit' && !edge && noise(k, off) % 19 === 0;
            const city = phase === 'nuit' && !edge && off > 23 && noise(k, off) % 3 === 0;
            const color = edge ? '#f7f3ea' : star ? '#ffffff' : city ? '#ffd27a' : sky;
            faceLine(c, cx, cy, 16, WALL, -1, off, k, k, color);
            faceLine(c, cx, cy, 16, WALL, 1, off, k, k, edge ? '#d9d2c2' : dark(color, 0.15));
          }
        }
      }
      break;
    }
    case 'ascenseur':
    case 'ascenseur-ouvert': {
      block(c, cx, cy, 16, WALL, '#efe9dc', '#d9d2c2', '#c4bcab');
      const open = kind === 'ascenseur-ouvert';
      for (let off = 9; off < WALL; off++) {
        faceLine(c, cx, cy, 16, WALL, -1, off, 1, 14, off === 9 ? '#555b68' : open ? '#1b1e27' : '#aab2bd');
        if (!open && off > 9) faceLine(c, cx, cy, 16, WALL, -1, off, 7, 7, '#6d7684');
      }
      faceLine(c, cx, cy, 16, WALL, -1, 5, 6, 9, open ? '#5fe08a' : '#ffd84a');
      break;
    }
    case 'cloison':
      c.globalAlpha = 0.34;
      block(c, cx, cy, 16, 13, '#d7eef7', '#9fd3e8', '#86c2da');
      c.globalAlpha = 1;
      break;
    case 'porte':
      c.globalAlpha = 0.92;
      block(c, cx, cy, 16, 13, '#a47c4f', '#8a6a45', '#6f5436');
      c.globalAlpha = 1;
      faceLine(c, cx, cy, 16, 13, -1, 7, 11, 12, '#ffd84a');
      break;
    case 'porte-ouverte':
      px(c, 0, cy - 13, 2, 14, '#8a6a45');
      px(c, 30, cy - 13, 2, 14, '#6f5436');
      break;
    case 'evier':
      block(c, cx, cy, 13, 9, '#d9d2c5');
      block(c, cx, 35, 6, 1, '#8fa3b5');
      px(c, 16, 29, 1, 4, '#aab2bd');
      break;
    case 'frigo':
      block(c, cx, cy, 9, 23, '#e8edf2');
      faceLine(c, cx, cy, 9, 23, -1, 9, 0, 8, '#b8c0ca');
      for (let off = 3; off < 7; off++) faceLine(c, cx, cy, 9, 23, -1, off, 6, 6, '#8a8f98');
      for (let off = 12; off < 18; off++) faceLine(c, cx, cy, 9, 23, -1, off, 6, 6, '#8a8f98');
      break;
    case 'mangedebout':
      block(c, cx, cy, 3, 13, '#555b68');
      block(c, cx, cy - 13, 9, 2, '#b08a5a');
      block(c, 14, 28, 2, 2, '#ffffff');
      break;
    case 'imprimante':
      block(c, cx, cy, 9, 8, '#cfd5dd');
      block(c, cx, 36, 6, 3, '#f4f6f8');
      faceLine(c, cx, cy, 9, 8, -1, 2, 1, 2, '#5fe08a');
      faceLine(c, cx, cy, 9, 8, -1, 5, 1, 7, '#8a8f98');
      break;
    case 'paillasse':
      block(c, cx, cy, 16, 9, '#cfd8dc');
      block(c, 11, 35, 2, 4, '#5fe08a');
      block(c, 20, 34, 2, 6, '#7cc4ee');
      block(c, 16, 37, 2, 3, '#f2a541');
      break;
    case 'banque':
      block(c, cx, cy, 16, 11, '#c9a66f', '#a8824e', '#86663b');
      faceLine(c, cx, cy, 16, 11, -1, 4, 0, 15, '#ffd84a');
      faceLine(c, cx, cy, 16, 11, -1, 5, 0, 15, '#ffd84a');
      break;
    default:
      block(c, cx, cy, 8, 8, '#8a8f98');
  }
}

export function furnitureSprite(kind: string, tint = ''): Sprite {
  // 24 pixels de marge en haut pour les murs, plus hauts que le mobilier.
  return make(`f:${kind}:${tint}`, 32, 80, 16, 68, (c) => {
    c.translate(0, 24);
    drawFurniture(c, kind, tint);
  });
}

// ---------- Personnages ----------

export function characterSprite(look: Look, pose: Pose, back: boolean): Sprite {
  const key = `c:${look.skin}${look.hair}${look.style}${look.shirt}${look.pants}${look.shoes}${look.glasses}:${pose}:${back}`;
  return make(key, 16, 24, 8, 22, (c) => {
    const sitting = pose === 'sit0' || pose === 'sit1';
    const sleeve = dark(look.shirt, 0.2);
    if (sitting) {
      px(c, 5, 16, 6, 3, look.pants);
    } else {
      const l = pose === 'walk0' ? 1 : 0;
      const r = pose === 'walk1' ? 1 : 0;
      px(c, 5, 16, 3, 6 - l, look.pants);
      px(c, 8, 16, 3, 6 - r, dark(look.pants, 0.12));
      px(c, 5, 21 - l, 3, 1, look.shoes);
      px(c, 8, 21 - r, 3, 1, look.shoes);
    }
    px(c, 5, 10, 6, 6, look.shirt);
    px(c, 5, 15, 6, 1, dark(look.shirt, 0.12));
    px(c, 4, 10, 1, 5, sleeve);
    px(c, 11, 10, 1, 5, sleeve);
    px(c, 4, pose === 'sit1' ? 14 : 15, 1, 1, look.skin);
    px(c, 11, pose === 'sit0' ? 14 : 15, 1, 1, look.skin);
    px(c, 5, 4, 6, 6, look.skin);

    const cropped = look.style === 4;
    if (back) {
      px(c, 5, 3, 6, cropped ? 4 : 6, look.hair);
    } else {
      px(c, 5, 3, 6, cropped ? 1 : 2, look.hair);
      px(c, 6, 7, 1, 1, '#1b1e27');
      px(c, 9, 7, 1, 1, '#1b1e27');
      if (look.glasses) {
        px(c, 5, 6, 6, 1, '#2a2e38');
        px(c, 7, 7, 2, 1, '#2a2e38');
      }
    }
    if (!cropped) {
      px(c, 4, 4, 1, 3, look.hair);
      px(c, 11, 4, 1, 3, look.hair);
    }
    if (look.style === 1) {
      px(c, 4, 4, 1, 7, look.hair);
      px(c, 11, 4, 1, 7, look.hair);
    } else if (look.style === 2) {
      px(c, 5, 2, 6, 1, look.hair);
    } else if (look.style === 3) {
      px(c, 7, 1, 2, 2, look.hair);
    } else if (look.style === 5) {
      px(c, 12, 5, 1, 5, look.hair);
    }

    // Contour sombre pour detacher le personnage du decor.
    const data = c.getImageData(0, 0, 16, 24).data;
    const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < 16 && y < 24 && data[(y * 16 + x) * 4 + 3] > 0;
    c.fillStyle = 'rgba(17, 19, 26, 0.7)';
    for (let y = 0; y < 24; y++) {
      for (let x = 0; x < 16; x++) {
        if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) c.fillRect(x, y, 1, 1);
      }
    }
    if (!sitting) {
      c.globalCompositeOperation = 'destination-over';
      c.globalAlpha = 0.14;
      px(c, 2, 21, 12, 2, '#000000');
      px(c, 3, 20, 10, 4, '#000000');
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
    }
  });
}

const SKINS = ['#f6d3b3', '#eebf98', '#d49a6a', '#a8703f', '#6f4a2c'];
const HAIRS = ['#22201f', '#4a2f1b', '#8a5a2b', '#d9b25a', '#b5482f', '#c9ccd1', '#2e2a4f'];
const PANTS = ['#2f3542', '#3d4a66', '#5a4636'];
const SHOES = ['#22252d', '#5a3a22', '#e8ebf2', '#7a2f2f'];

export function lookFor(id: string, poleColor: string): Look {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619) >>> 0;
  const pick = <T>(list: T[], shift: number) => list[(h >>> shift) % list.length];
  const tone = ((h >>> 20) % 3) - 1;
  return {
    skin: pick(SKINS, 0),
    hair: pick(HAIRS, 4),
    style: (h >>> 9) % 6,
    shirt: tone < 0 ? dark(poleColor, 0.15) : tone > 0 ? light(poleColor, 0.18) : poleColor,
    pants: pick(PANTS, 14),
    shoes: pick(SHOES, 17),
    glasses: (h >>> 23) % 4 === 0,
  };
}
