import generated from './data/agents.generated.json';
import rosterJson from './data/roster.json';

export interface Pole {
  id: string;
  nom: string;
  couleur: string;
  prop: string;
  openSpace?: boolean;
}

export interface Etage {
  id: string;
  numero: number;
  nom: string;
  sousTitre: string;
  poles: string[];
  pieces: string[];
}

export interface Agent {
  id: string;
  prenom: string;
  pole: string;
  role: string;
  competences: string[];
  quand: string;
  outils: string[];
  description: string;
}

interface RosterEntry {
  prenom: string;
  pole: string;
  role?: string;
  competences?: string[];
  quand?: string;
  specialite?: string;
  focus?: string[];
}

interface GeneratedAgent {
  id: string;
  description: string;
  tools: string[];
}

const NEWCOMERS: Pole = { id: 'nouveaux', nom: 'Nouveaux arrivants', couleur: '#8a8f98', prop: 'plante' };

const roster = rosterJson as unknown as { chef?: string; etages: Etage[]; poles: Pole[]; agents: Record<string, RosterEntry> };

function texts(entry: RosterEntry): Pick<Agent, 'role' | 'competences' | 'quand'> {
  if (entry.role) {
    return { role: entry.role, competences: entry.competences ?? [], quand: entry.quand ?? '' };
  }
  const sp = entry.specialite ?? '';
  const focus = entry.focus ?? [];
  if (entry.pole === 'build-os') {
    return {
      role: `Répare les builds ${sp} qui échouent, avec des changements minimaux.`,
      competences: [...focus, "Correctifs ciblés, sans refonte d'architecture"],
      quand: `Quand un build ${sp} échoue.`,
    };
  }
  return {
    role: `Relit le code ${sp} et signale les problèmes avant la fusion.`,
    competences: [...focus, 'Remarques classées par gravité'],
    quand: `Après toute modification de code ${sp}.`,
  };
}

export function loadAgents(): { agents: Agent[]; poles: Pole[]; version: string; chef: string; etages: Etage[] } {
  const source = (generated as { version: string; agents: GeneratedAgent[] });
  const known = new Set(source.agents.map((a) => a.id));
  for (const id of Object.keys(roster.agents)) {
    if (!known.has(id)) console.warn(`[roster] ${id} n'existe plus dans le plugin ECC : non affiché.`);
  }

  const poleIds = new Set(roster.poles.map((p) => p.id));
  let newcomers = false;
  const agents = source.agents.map((g): Agent => {
    const entry = roster.agents[g.id];
    if (!entry || !poleIds.has(entry.pole)) {
      newcomers = true;
      return {
        id: g.id,
        prenom: entry?.prenom ?? g.id,
        pole: NEWCOMERS.id,
        role: g.description,
        competences: [],
        quand: '',
        outils: g.tools,
        description: g.description,
      };
    }
    return { id: g.id, prenom: entry.prenom, pole: entry.pole, ...texts(entry), outils: g.tools, description: g.description };
  });

  return { agents, poles: newcomers ? [...roster.poles, NEWCOMERS] : roster.poles, version: source.version, chef: roster.chef ?? 'planner', etages: [...roster.etages].sort((a, b) => a.numero - b.numero) };
}
