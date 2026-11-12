import { describe, expect, it } from 'vitest';
import { loadAgents } from './data';
import { buildBuilding, findPath, type Floor, type Group } from './map';

const { agents, poles, etages, chef } = loadAgents();
const groups: Group[] = poles.map((p) => ({
  pole: p.id,
  nom: p.nom,
  prop: p.prop,
  agents: agents.filter((a) => a.pole === p.id).map((a) => a.id),
}));
const building = buildBuilding(etages, groups, chef);
const roomOf = (floor: Floor, x: number, y: number) => floor.rooms[floor.roomAt[y * floor.w + x]];

describe('effectif', () => {
  it('donne un prénom unique à chaque agent du plugin', () => {
    expect(agents.length).toBeGreaterThan(0);
    expect(new Set(agents.map((a) => a.prenom)).size).toBe(agents.length);
  });

  it('ne laisse aucun agent dans les nouveaux arrivants', () => {
    expect(agents.filter((a) => a.pole === 'nouveaux').map((a) => a.id)).toEqual([]);
  });

  it('remplit rôle, compétences et outils de chaque fiche', () => {
    for (const a of agents) {
      expect(a.role, a.id).not.toBe('');
      expect(a.competences.length, a.id).toBeGreaterThanOrEqual(3);
      expect(a.outils.length, a.id).toBeGreaterThan(0);
    }
  });
});

describe('immeuble', () => {
  it('crée un étage par entrée du roster, du rez-de-chaussée au dernier', () => {
    expect(building.floors.map((f) => f.etage.numero)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("donne à chaque agent un siège dans la pièce de son pôle, à l'étage de ce pôle", () => {
    for (const a of agents) {
      const seat = building.seats[a.id];
      expect(seat, a.id).toBeDefined();
      const floor = building.floors[seat.floor];
      expect(floor.etage.poles, a.id).toContain(a.pole);
      expect(roomOf(floor, seat.x, seat.y)?.pole, a.id).toBe(a.pole);
    }
  });

  it("installe le chef dans son bureau d'angle", () => {
    const seat = building.seats[chef];
    expect(roomOf(building.floors[seat.floor], seat.x, seat.y).kind).toBe('chef');
  });

  it('envoie un pôle inconnu au rez-de-chaussée', () => {
    const extra = buildBuilding(etages, [...groups, { pole: 'mystere', nom: 'Mystère', prop: 'plante', agents: ['zz'] }], chef);
    expect(extra.seats.zz.floor).toBe(0);
  });

  it('équipe chaque étage : ascenseur, salle de réunion ou du conseil, coin café', () => {
    for (const f of building.floors) {
      const kinds = f.rooms.map((r) => r.kind);
      expect(f.elevator.length, f.etage.id).toBeGreaterThan(0);
      expect(kinds.includes('reunion') || kinds.includes('conseil'), f.etage.id).toBe(true);
      expect(kinds.includes('kitchenette') || kinds.includes('cafeteria'), f.etage.id).toBe(true);
      expect(f.spots.some((s) => s.cafe), f.etage.id).toBe(true);
    }
  });

  it('place les pièces communes demandées par chaque étage', () => {
    for (const f of building.floors) {
      for (const piece of f.etage.pieces) expect(f.rooms.map((r) => r.kind), f.etage.id).toContain(piece);
    }
  });

  it('ne superpose ni meubles bloquants, ni sièges, ni pièces', () => {
    for (const f of building.floors) {
      const used = new Set<string>();
      for (const item of f.furniture.filter((i) => i.blocking)) {
        const key = `${item.x},${item.y}`;
        expect(used.has(key), `${f.etage.id} ${item.kind} ${key}`).toBe(false);
        used.add(key);
      }
      let area = 0;
      for (const r of f.rooms) area += r.w * r.h;
      expect(f.roomAt.filter((r) => r >= 0).length, f.etage.id).toBe(area);
      for (const s of [...f.spots, ...f.elevator, ...f.doors]) expect(f.blocked[s.y * f.w + s.x], `${f.etage.id} ${s.x},${s.y}`).toBe(0);
    }
    for (const [id, s] of Object.entries(building.seats)) {
      const f = building.floors[s.floor];
      expect(f.blocked[s.y * f.w + s.x], id).toBe(0);
    }
  });

  it("relie chaque siège à l'ascenseur et aux espaces communs de son étage", () => {
    for (const a of agents) {
      const seat = building.seats[a.id];
      const floor = building.floors[seat.floor];
      for (const target of [...floor.elevator, ...floor.spots]) {
        const path = findPath(floor, seat, target, a.id);
        expect(path, `${a.id} -> ${target.x},${target.y}`).not.toBeNull();
        for (const t of path!) {
          const i = t.y * floor.w + t.x;
          expect(floor.blocked[i]).toBe(0);
          expect([null, a.id]).toContain(floor.seatOwner[i]);
        }
      }
    }
  });

  it("relie l'ascenseur de chaque étage à tous ses espaces communs", () => {
    for (const f of building.floors) {
      for (const spot of f.spots) expect(findPath(f, f.elevator[0], spot, ''), `${f.etage.id} ${spot.x},${spot.y}`).not.toBeNull();
    }
  });

  it('ne laisse sortir de chaque pièce que par sa porte', () => {
    for (const f of building.floors) {
      for (const room of f.rooms) {
        const sealed: Floor = { ...f, blocked: f.blocked.slice() };
        sealed.blocked[room.door.y * f.w + room.door.x] = 1;
        let inside = null;
        for (let y = room.y; y < room.y + room.h && !inside; y++) {
          for (let x = room.x; x < room.x + room.w && !inside; x++) {
            const i = y * f.w + x;
            if (!f.blocked[i] && f.seatOwner[i] === null) inside = { x, y };
          }
        }
        expect(inside, room.id).not.toBeNull();
        expect(findPath(f, inside!, f.elevator[0], ''), `${room.id} ouvert`).not.toBeNull();
        expect(findPath(sealed, inside!, f.elevator[0], ''), `${room.id} porte fermée`).toBeNull();
      }
    }
  });
});
