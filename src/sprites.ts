// Tout le pixel art est dessine ici, colonne par colonne, puis mis en cache dans des canvas hors ecran.
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
}

export type Pose = 'sit0' | 'sit1' | 'stand' | 'walk0' | 'walk1';

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

export function floorSprite(color: string): Sprite {
  return make(`floor:${color}`, 32, 16, 16, 8, (c) => {
    block(c, 16, 8, 16, 0, color);
    const edge = dark(color, 0.14);
    for (let x = -16; x < 16; x++) {
      const e = (16 - Math.abs(x + 0.5)) / 2;
      px(c, 16 + x, Math.round(8 + e) - 1, 1, 1, edge);
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

const BOOKS = ['#e5484d', '#3b82c4', '#f2c14e', '#43a047'];

function drawFurniture(c: Ctx, kind: string, tint: string): void {
  const cx = 16;
  const cy = 44;
  switch (kind) {
    case 'bureau':
      block(c, cx, cy, 13, 9, '#b08a5a');
      block(c, 11, 37, 4, 6, '#2a2e38');
      block(c, 20, 34, 4, 1, '#d0d4dc');
      if (tint) {
        px(c, 25, 26, 1, 9, '#d9dde3');
        px(c, 26, 26, 4, 3, tint);
      }
      break;
    case 'chaise':
      block(c, cx, cy, 6, 5, '#3d4250');
      break;
    case 'tableau':
      block(c, cx, cy, 11, 2, '#8a8f98');
      block(c, cx, 42, 10, 20, '#f4f6f8', '#e9edf1', '#cdd5dd');
      faceLine(c, cx, 42, 10, 20, -1, 4, 2, 7, '#e5484d');
      faceLine(c, cx, 42, 10, 20, -1, 8, 2, 5, '#3b82c4');
      faceLine(c, cx, 42, 10, 20, -1, 12, 3, 8, '#43a047');
      break;
    case 'ecran':
      block(c, cx, cy, 9, 4, '#4a4f5c');
      block(c, cx, 40, 8, 16, '#1d2330', '#12303a', '#0f1a26');
      faceLine(c, cx, 40, 8, 16, -1, 3, 1, 6, '#5fe08a');
      faceLine(c, cx, 40, 8, 16, -1, 6, 1, 4, '#5fe08a');
      faceLine(c, cx, 40, 8, 16, -1, 9, 1, 5, '#f2c14e');
      break;
    case 'serveur':
    case 'baie': {
      const body = kind === 'baie' ? '#39465a' : '#3a3f4b';
      const led = kind === 'baie' ? '#5cc8ff' : '#5fe08a';
      block(c, cx, cy, 9, 24, body);
      for (let off = 3; off < 22; off += 4) {
        faceLine(c, cx, cy, 9, 24, -1, off, 1, 7, dark(body, 0.5));
        faceLine(c, cx, cy, 9, 24, -1, off, 2, 3, led);
        faceLine(c, cx, cy, 9, 24, -1, off, 6, 6, '#f2a541');
      }
      break;
    }
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
      block(c, cx, cy, 16, 7, '#9c7448');
      break;
    case 'canape':
      block(c, cx, cy, 14, 5, '#6b5fa8');
      block(c, 20, 37, 10, 5, '#584d92');
      break;
    case 'fontaine':
      block(c, cx, cy, 5, 12, '#e8edf2');
      block(c, cx, 32, 4, 7, '#7cc4ee');
      break;
    default:
      block(c, cx, cy, 8, 8, '#8a8f98');
  }
}

export function furnitureSprite(kind: string, tint = ''): Sprite {
  return make(`f:${kind}:${tint}`, 32, 56, 16, 44, (c) => drawFurniture(c, kind, tint));
}

export function characterSprite(look: Look, pose: Pose, back: boolean): Sprite {
  const key = `c:${look.skin}${look.hair}${look.style}${look.shirt}${look.pants}:${pose}:${back}`;
  return make(key, 16, 24, 8, 22, (c) => {
    const sitting = pose === 'sit0' || pose === 'sit1';
    const sleeve = dark(look.shirt, 0.2);
    if (sitting) {
      px(c, 5, 16, 6, 3, look.pants);
    } else {
      c.globalAlpha = 0.25;
      px(c, 4, 21, 8, 2, '#000000');
      c.globalAlpha = 1;
      const l = pose === 'walk0' ? 1 : 0;
      const r = pose === 'walk1' ? 1 : 0;
      px(c, 5, 16, 3, 6 - l, look.pants);
      px(c, 8, 16, 3, 6 - r, dark(look.pants, 0.12));
      px(c, 5, 21 - l, 3, 1, '#22252d');
      px(c, 8, 21 - r, 3, 1, '#22252d');
    }
    px(c, 5, 10, 6, 6, look.shirt);
    px(c, 4, 10, 1, 5, sleeve);
    px(c, 11, 10, 1, 5, sleeve);
    px(c, 4, pose === 'sit1' ? 14 : 15, 1, 1, look.skin);
    px(c, 11, pose === 'sit0' ? 14 : 15, 1, 1, look.skin);
    px(c, 5, 4, 6, 6, look.skin);
    if (back) {
      px(c, 5, 3, 6, 6, look.hair);
    } else {
      px(c, 5, 3, 6, 2, look.hair);
      px(c, 6, 7, 1, 1, '#1b1e27');
      px(c, 9, 7, 1, 1, '#1b1e27');
    }
    px(c, 4, 4, 1, 3, look.hair);
    px(c, 11, 4, 1, 3, look.hair);
    if (look.style === 1) {
      px(c, 4, 4, 1, 7, look.hair);
      px(c, 11, 4, 1, 7, look.hair);
    } else if (look.style === 2) {
      px(c, 5, 2, 6, 1, look.hair);
    } else if (look.style === 3) {
      px(c, 7, 1, 2, 2, look.hair);
    }
  });
}

const SKINS = ['#f6d3b3', '#eebf98', '#d49a6a', '#a8703f', '#6f4a2c'];
const HAIRS = ['#22201f', '#4a2f1b', '#8a5a2b', '#d9b25a', '#b5482f', '#c9ccd1', '#2e2a4f'];
const PANTS = ['#2f3542', '#3d4a66', '#5a4636'];

export function lookFor(id: string, poleColor: string): Look {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619) >>> 0;
  const pick = <T>(list: T[], shift: number) => list[(h >>> shift) % list.length];
  const tone = ((h >>> 20) % 3) - 1;
  return {
    skin: pick(SKINS, 0),
    hair: pick(HAIRS, 4),
    style: (h >>> 9) % 4,
    shirt: tone < 0 ? dark(poleColor, 0.15) : tone > 0 ? light(poleColor, 0.18) : poleColor,
    pants: pick(PANTS, 14),
  };
}
