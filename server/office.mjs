// Traduit les evenements des hooks Claude Code en etat du bureau. Aucune entree/sortie ici : facile a tester.

const short = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const fileName = (p) => String(p ?? '').split(/[\\/]/).pop() || 'un fichier';

/** "ecc:code-reviewer" -> "code-reviewer" (identifiant de l'agent dans le bureau). */
export const agentKey = (type) => (type ? String(type).replace(/^ecc:/, '') : null);

function describeBash(command) {
  const cmd = String(command ?? '').trim();
  if (/\b(vitest|jest|pytest|playwright|(cargo|go|dotnet|mvn|gradle|npm|pnpm|yarn|bun)( run)? test)\b/.test(cmd)) return 'lance les tests';
  if (/\b(npm|pnpm|yarn|bun|pip|cargo|poetry) (install|add|i|ci)\b/.test(cmd)) return 'installe des dépendances';
  if (/\b(eslint|prettier|ruff|clippy|lint)\b/.test(cmd)) return 'vérifie le style du code';
  if (/\b(build|tsc|compile|make)\b/.test(cmd)) return 'lance le build';
  const git = cmd.match(/^git\s+([a-z-]+)/);
  if (git) return `git ${git[1]}`;
  return `exécute ${cmd.split(/\s+/)[0] || 'une commande'}`;
}

/** Phrase courte pour la bulle : "lit auth.ts", "lance les tests". */
export function describe(tool, input = {}) {
  const name = String(tool ?? '');
  let text;
  if (name === 'Read') text = `lit ${fileName(input.file_path)}`;
  else if (name === 'Edit' || name === 'MultiEdit' || name === 'NotebookEdit') text = `modifie ${fileName(input.file_path ?? input.notebook_path)}`;
  else if (name === 'Write') text = `écrit ${fileName(input.file_path)}`;
  else if (name === 'Bash' || name === 'PowerShell') text = describeBash(input.command);
  else if (name === 'Grep') text = `cherche « ${input.pattern ?? ''} »`;
  else if (name === 'Glob') text = `cherche des fichiers ${input.pattern ?? ''}`.trim();
  else if (name === 'WebSearch') text = 'cherche sur le web';
  else if (name === 'WebFetch') {
    let host = 'une page web';
    try { host = new URL(input.url).hostname; } catch { /* URL absente ou invalide */ }
    text = `consulte ${host}`;
  } else if (name === 'Agent' || name === 'Task') text = `délègue à ${agentKey(input.subagent_type) ?? 'un agent'}`;
  else if (name.startsWith('mcp__')) text = `utilise ${name.split('__')[1].replace(/^plugin_/, '')}`;
  else text = `utilise ${name || 'un outil'}`;
  return short(text, 44);
}

export function createOffice() {
  // Une instance par sous-agent en cours ; plusieurs instances peuvent partager le meme agent.
  const instances = new Map();
  let session = { active: false, label: '' };
  let tick = 0;

  const agentState = (key) => {
    let latest = null;
    for (const inst of instances.values()) if (inst.key === key && (!latest || inst.tick > latest.tick)) latest = inst;
    return { type: 'agent', id: key, active: latest !== null, label: latest?.label ?? null };
  };
  const sessionState = () => ({ type: 'session', ...session });

  const touch = (event, label) => {
    const key = agentKey(event.agent_type);
    if (!event.agent_id || !key) return [];
    instances.set(event.agent_id, { key, label, session: event.session_id, tick: ++tick });
    return [agentState(key)];
  };

  function handle(event) {
    if (!event || typeof event !== 'object') return [];
    const inSubagent = Boolean(event.agent_id);
    switch (event.hook_event_name) {
      case 'SubagentStart':
        return touch(event, 'démarre');
      case 'PreToolUse':
        if (inSubagent) return touch(event, describe(event.tool_name, event.tool_input));
        session = { active: true, label: describe(event.tool_name, event.tool_input) };
        return [sessionState()];
      case 'PostToolUse':
        return inSubagent ? touch(event, 'réfléchit') : [];
      case 'SubagentStop': {
        const inst = instances.get(event.agent_id);
        const key = inst?.key ?? agentKey(event.agent_type);
        instances.delete(event.agent_id);
        return key ? [agentState(key)] : [];
      }
      case 'UserPromptSubmit':
        session = { active: true, label: short(String(event.prompt ?? '').replace(/\s+/g, ' ').trim(), 70) };
        // prompt: true = une nouvelle demande arrive (a distinguer d'un simple appel d'outil).
        return [{ ...sessionState(), prompt: true }];
      case 'Stop': {
        // Filet : un SubagentStop manque ne doit pas laisser un agent bloque en mission.
        const keys = new Set();
        for (const [id, inst] of instances) {
          if (inst.session === event.session_id) {
            keys.add(inst.key);
            instances.delete(id);
          }
        }
        session = { active: false, label: '' };
        return [...[...keys].map(agentState), sessionState()];
      }
      default:
        return [];
    }
  }

  function snapshot() {
    const keys = new Set([...instances.values()].map((i) => i.key));
    return [...[...keys].map(agentState), sessionState()];
  }

  return { handle, snapshot, activeCount: () => instances.size };
}
