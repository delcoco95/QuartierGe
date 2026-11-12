import { describe, expect, it } from 'vitest';
import { loadAgents } from './data';
import { buildMap, findPath, type Group } from './map';

const { agents, poles } = loadAgents();
const groups: Group[] = poles.map((p) => ({
  pole: p.id,
  prop: p.prop,
  agents: agents.filter((a) => a.pole === p.id).map((a) => a.id),
}));
const map = buildMap(groups);

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

describe('carte du bureau', () => {
  it('donne à chaque agent un siège dans la zone de son pôle', () => {
    for (const a of agents) {
      const seat = map.seats[a.id];
      expect(seat, a.id).toBeDefined();
      const zone = map.zones[map.zoneAt[seat.y * map.w + seat.x]];
      expect(zone?.pole, a.id).toBe(a.pole);
    }
  });

  it('ne superpose ni meubles bloquants, ni sièges, ni zones', () => {
    const used = new Set<string>();
    for (const f of map.furniture.filter((f) => f.blocking)) {
      const key = `${f.x},${f.y}`;
      expect(used.has(key), key).toBe(false);
      used.add(key);
    }
    for (const [id, s] of Object.entries(map.seats)) {
      expect(map.blocked[s.y * map.w + s.x], id).toBe(0);
    }
    let area = 0;
    for (const z of map.zones) area += z.w * z.h;
    expect(map.zoneAt.filter((z) => z >= 0).length).toBe(area);
  });

  it('garde les espaces communs libres et hors des zones', () => {
    for (const s of map.spots) {
      const i = s.y * map.w + s.x;
      expect(map.blocked[i], `${s.x},${s.y}`).toBe(0);
      expect(map.zoneAt[i], `${s.x},${s.y}`).toBe(-1);
    }
  });

  it('relie chaque siège à chaque espace commun sans traverser de meuble', () => {
    for (const a of agents) {
      for (const spot of map.spots) {
        const path = findPath(map, map.seats[a.id], spot, a.id);
        expect(path, `${a.id} -> ${spot.x},${spot.y}`).not.toBeNull();
        for (const t of path!) {
          const i = t.y * map.w + t.x;
          expect(map.blocked[i]).toBe(0);
          expect([null, a.id]).toContain(map.seatOwner[i]);
        }
      }
    }
  });
});
