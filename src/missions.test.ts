import { describe, expect, it } from 'vitest';
import { loadAgents } from './data';
import { planMission } from './missions';

const { agents, chef } = loadAgents();
const ids = (text: string) => planMission(text, agents, chef).map((s) => s.id);

describe('planMission', () => {
  it('fait passer la mission par le chef en premier', () => {
    expect(agents.some((a) => a.id === chef)).toBe(true);
    expect(ids('corriger le build Rust')[0]).toBe(chef);
  });

  it('choisit les agents dont la fiche correspond à la demande', () => {
    expect(ids('corriger le build Rust')).toContain('rust-build-resolver');
    expect(ids('audit de sécurité des vulnérabilités')).toContain('security-reviewer');
  });

  it("retombe sur l'équipe par défaut quand rien ne correspond", () => {
    expect(ids('zzz qqq')).toEqual([chef, 'architect', 'tdd-guide', 'code-reviewer']);
  });

  it("ne confie jamais deux étapes au même agent et limite l'équipe à 3", () => {
    const team = ids('relire le code python django fastapi react vue rust go');
    expect(new Set(team).size).toBe(team.length);
    expect(team.length).toBeLessThanOrEqual(4);
  });
});
