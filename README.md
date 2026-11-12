# Quartier Général

Les agents du plugin ECC de Claude Code, présentés comme les employés d'un bureau isométrique en pixel art. Le cahier des charges est dans [BRIEF.md](BRIEF.md).

## Lancer

```bash
npm install
npm run sync
npm run dev
```

- `npm run sync` relit les agents du plugin ECC installé (`~/.claude/plugins/cache/ecc/ecc/<version>/agents`) et régénère `src/data/agents.generated.json`. À relancer après une mise à jour du plugin.
- `npm test` vérifie l'immeuble : chaque agent a un siège dans la pièce de son pôle, chaque siège rejoint l'ascenseur et les espaces communs sans traverser de cloison, et on ne sort d'une pièce que par sa porte.

## L'immeuble

Six étages, du rez-de-chaussée (accueil, cafétéria, détente) au 5e (direction). Le panneau « Immeuble » à gauche change d'étage, comme Page préc. et Page suiv. Les agents prennent l'ascenseur pour changer d'étage. Le panneau « Activité en direct » à droite montre les missions en cours et le fil des événements.

La répartition des pôles par étage et les pièces communes de chaque étage sont dans la liste `etages` de `src/data/roster.json` ; le plan de chaque étage est généré par `src/map.ts` selon l'effectif.

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

## La commande /qg

`scripts/install-hooks.mjs` installe aussi la commande `/qg` dans `~/.claude/commands/qg.md` (source : `claude/commands/qg.md`). Dans n'importe quelle session Claude Code :

```
/qg ajoute une page de connexion et teste-la
```

La Direction (`planner`) découpe la demande, la répartit aux agents ECC adaptés, puis fait rejouer tests et relecture : au moins deux passes complètes, la dernière entièrement verte, au plus trois tours de correction. Chaque agent lancé apparaît dans le bureau ; ceux qui travaillent en même temps se retrouvent en salle de réunion. `npm run hooks:remove` retire la commande.

Si le serveur est éteint, les hooks échouent sans bloquer Claude Code. Les sessions Claude Code déjà ouvertes peuvent devoir être redémarrées pour prendre les nouveaux hooks en compte.
