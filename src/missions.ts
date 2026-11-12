import type { Agent } from './data';

export interface Step {
  id: string;
  label: string;
}

export const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const tokens = (s: string) => fold(s).split(/[^a-z0-9+#]+/).filter((w) => w.length >= 3);

const STOP = new Set(['les', 'des', 'une', 'pour', 'avec', 'dans', 'que', 'qui', 'sur', 'par', 'the', 'and', 'for', 'est', 'ses', 'son', 'aux', 'code']);
const DEFAULT_TEAM = ['architect', 'tdd-guide', 'code-reviewer'];
const TEAM_SIZE = 3;
const STEM = 5;

// Les fiches melangent francais et anglais : on compare les mots par leur debut ("securite" ~ "security").
const alike = (w: string, t: string) =>
  w === t || (w.length >= 4 && t.startsWith(w)) || (w.length >= STEM && t.length >= STEM && w.slice(0, STEM) === t.slice(0, STEM));

/**
 * Simulation de la V1 : le chef prend la mission, puis la confie aux agents dont la fiche
 * correspond le mieux aux mots de la demande. Aucun agent Claude Code n'est reellement lance.
 */
export function planMission(text: string, agents: Agent[], chefId: string): Step[] {
  const words = [...new Set(tokens(text))].filter((w) => !STOP.has(w));
  const scored = agents
    .filter((a) => a.id !== chefId)
    .map((a, order) => {
      const name = tokens(a.id);
      const hay = [...new Set(tokens([a.role, a.description, ...a.competences].join(' ')))];
      // Un mot qui tombe dans l'identifiant de l'agent compte double.
      const score = words.reduce((sum, w) => sum + (name.some((t) => alike(w, t)) ? 2 : hay.some((t) => alike(w, t)) ? 1 : 0), 0);
      return { id: a.id, score, order };
    })
    .filter((s) => s.score > 0)
    .sort((p, q) => q.score - p.score || p.order - q.order)
    .slice(0, TEAM_SIZE)
    .map((s) => s.id);

  const known = new Set(agents.map((a) => a.id));
  const team = scored.length > 0 ? scored : DEFAULT_TEAM.filter((id) => known.has(id) && id !== chefId);
  const steps: Step[] = team.map((id) => ({ id, label: text }));
  return known.has(chefId) ? [{ id: chefId, label: `Planifie : ${text}` }, ...steps] : steps;
}
