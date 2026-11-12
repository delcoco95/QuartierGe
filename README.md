# Quartier Général

Les agents du plugin ECC de Claude Code, présentés comme les employés d'un bureau isométrique en pixel art. Le cahier des charges est dans [BRIEF.md](BRIEF.md).

## Lancer

```bash
npm install
npm run sync
npm run dev
```

- `npm run sync` relit les agents du plugin ECC installé (`~/.claude/plugins/cache/ecc/ecc/<version>/agents`) et régénère `src/data/agents.generated.json`. À relancer après une mise à jour du plugin.
- `npm test` vérifie la carte du bureau (chaque agent a un poste, chaque espace commun est accessible).

## Modifier l'effectif

Prénoms, pôles et textes des fiches sont dans `src/data/roster.json`. Un agent du plugin absent de ce fichier apparaît dans la zone « Nouveaux arrivants ».

## Activité en direct

Sous Windows, un seul script lance tout (dépendances, liste des agents, hooks, serveur, bureau) :

```powershell
powershell -ExecutionPolicy Bypass -File start.ps1
```

Fonctionnement :

1. `scripts/install-hooks.mjs` ajoute dans `~/.claude/settings.json` un hook HTTP sur `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `SubagentStart`, `SubagentStop` et `Stop`. Les hooks déjà présents ne sont pas modifiés ; une sauvegarde `settings.json.avant-quartier-general` est créée la première fois. `npm run hooks:remove` les retire.
2. `server/server.mjs` écoute sur `127.0.0.1:4747`, reçoit les événements (`POST /event`) et les pousse au navigateur (`ws://127.0.0.1:4747/ws`). Il n'accepte que les pages servies depuis cette machine. `GET /health` donne le nombre d'événements reçus.
3. Quand un sous-agent ECC démarre, son personnage regagne son bureau et sa bulle affiche ce qu'il fait (« lit auth.ts », « lance les tests »). Quand il finit, il va au coin café.

Si le serveur est éteint, les hooks échouent sans bloquer Claude Code. Les sessions Claude Code déjà ouvertes peuvent devoir être redémarrées pour prendre les nouveaux hooks en compte.
