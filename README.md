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

## Brancher une activité réelle (V2)

La page expose `window.quartierGeneral.setMission(id, texte)` : l'agent retourne à son poste et affiche une bulle. Passer `null` pour terminer la mission.
