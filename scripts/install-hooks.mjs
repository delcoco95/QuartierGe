// Ajoute (ou retire avec --remove) les hooks Quartier General dans ~/.claude/settings.json.
// Les hooks deja presents ne sont jamais modifies : on ajoute un groupe a la fin de chaque evenement.
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const URL_HOOK = 'http://127.0.0.1:4747/event';
const EVENTS = ['UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'SubagentStart', 'SubagentStop', 'Stop'];
const file = process.env.QG_SETTINGS ?? join(homedir(), '.claude', 'settings.json');
const remove = process.argv.includes('--remove');

const ours = (group) => (group.hooks ?? []).some((h) => h.type === 'http' && h.url === URL_HOOK);

const settings = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
settings.hooks ??= {};
const changed = [];

for (const event of EVENTS) {
  const groups = settings.hooks[event] ?? [];
  const present = groups.some(ours);
  if (remove && present) {
    const kept = groups.filter((g) => !ours(g));
    if (kept.length) settings.hooks[event] = kept;
    else delete settings.hooks[event];
    changed.push(event);
  } else if (!remove && !present) {
    // Delai court : si le serveur est eteint, Claude Code continue sans attendre.
    settings.hooks[event] = [...groups, { matcher: '', hooks: [{ type: 'http', url: URL_HOOK, timeout: 2 }] }];
    changed.push(event);
  }
}

// La commande /qg : copiee a chaque lancement pour suivre les mises a jour du depot.
const commandSource = join(dirname(fileURLToPath(import.meta.url)), '..', 'claude', 'commands', 'qg.md');
const commandTarget = join(dirname(file), 'commands', 'qg.md');
if (remove) {
  if (existsSync(commandTarget)) {
    rmSync(commandTarget);
    console.log(`Commande /qg retirée : ${commandTarget}`);
  }
} else {
  mkdirSync(dirname(commandTarget), { recursive: true });
  copyFileSync(commandSource, commandTarget);
  console.log(`Commande /qg installée : ${commandTarget}`);
}

if (changed.length === 0) {
  console.log(remove ? 'Aucun hook Quartier Général à retirer.' : 'Hooks Quartier Général déjà installés.');
} else {
  if (existsSync(file)) {
    const backup = `${file}.avant-quartier-general`;
    if (!existsSync(backup)) copyFileSync(file, backup);
  }
  writeFileSync(file, JSON.stringify(settings, null, 2) + '\n');
  console.log(`${remove ? 'Retirés' : 'Ajoutés'} dans ${file} : ${changed.join(', ')}`);
}
