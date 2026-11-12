# Quartier Général — Brief

## 1. Le produit en une phrase

Une app web locale qui présente les 71 agents du plugin ECC (ecc@ecc, version 2.2.3) comme les employés d'un bureau isométrique en pixel art : chaque agent a un prénom, un poste de travail et une fiche (rôle, compétences, outils).

## 2. Décisions prises

| Sujet | Décision |
|---|---|
| Nature | V1 : vitrine animée, sans lien avec Claude Code. V2 : activité réelle en direct. |
| Effectif | Les 71 agents. 39 généralistes en bureaux individuels, 32 spécialistes en deux open-spaces. |
| Graphismes | Pixel art dessiné en code (aucun fichier d'asset externe). Personnage paramétrable : cheveux, teint, tenue, couleur du pôle. |
| Stack | Vite + TypeScript, rendu Canvas 2D, fiches en HTML/CSS par-dessus le canvas. Pas de framework, pas de moteur de jeu. |
| Interactions V1 | Clic sur un agent pour ouvrir sa fiche, déplacement et zoom, recherche et filtre par pôle, agents qui se déplacent. |
| Missions | Barre « Confier une mission au chef » en bas de page. En V1 c'est une simulation : le chef (`planner`) planifie, puis jusqu'à 3 agents choisis d'après les mots de la demande travaillent à tour de rôle. Aucun agent Claude Code n'est lancé. La fiche affiche la mission en cours. |
| Prénoms | Fournis par le propriétaire du projet (colonne à remplir en section 4). |
| Langue | Interface et fiches en français. L'identifiant technique de l'agent reste en anglais. |

Hors périmètre V1 : bouton « copier la commande d'appel », activité en direct, édition des fiches depuis l'interface, version mobile.

## 2 bis. L'immeuble (remplace le plateau unique)

Le bureau est un immeuble de six étages, décrit par la liste `etages` de `roster.json` (id, numéro, nom, sous-titre, pôles, pièces communes). Les sections 3, 7 et 9 ci-dessous décrivent l'ancien plateau unique et ne valent plus que pour le mobilier et les pôles.

| Étage | Nom | Pôles | Pièces communes |
|---|---|---|---|
| RDC | Accueil | Nouveaux arrivants éventuels | Accueil (banque et mur logo « QG »), cafétéria, coin détente, salle de réunion |
| 1er | Ingénierie | Build et Maintenance, Open-space Build, Réseau et Infra | Salle serveurs, salle de réunion, kitchenette |
| 2e | Qualité et Tests | Qualité, Tests, Open-space Revue | Salle de réunion, kitchenette |
| 3e | Documentation et Communication | Docs et Exploration, Open Source, Croissance | Archives et imprimantes, salle de réunion, kitchenette |
| 4e | R&D – Atelier Agents | Atelier Agents | Laboratoire, salle de réunion, kitchenette |
| 5e | Direction | Direction | Bureau d'angle du chef, salle du conseil, salon, kitchenette |

Un pôle qui ne figure dans aucun étage va au rez-de-chaussée.

Plan d'un étage, généré selon l'effectif :

- palier d'ascenseur à gauche, portes d'ascenseur sur le mur du fond, panneau de l'étage ;
- un couloir central, des pièces de chaque côté, réparties pour équilibrer les longueurs ;
- une pièce par pôle (deux rangées de postes), fermée par des cloisons vitrées, avec une porte sur le couloir ;
- murs du fond avec fenêtres, murs avant coupés (vue en coupe).

Déplacements :

- les trajets respectent murs et cloisons et ne passent que par les portes, qui s'ouvrent au passage ;
- pour changer d'étage, un agent rejoint l'ascenseur, disparaît 2,5 secondes, puis réapparaît à l'étage d'arrivée ;
- en pause, il reste en général à son étage et descend une fois sur quatre au rez-de-chaussée ;
- quand il reçoit une mission, il remonte à son poste par l'ascenseur ; à la fin, il va au café.

Interface :

- à gauche, le panneau « Immeuble » : les étages du 5e au RDC avec leurs pôles cliquables, le nombre d'agents présents et un voyant quand un agent de l'étage travaille en direct ; Page préc. et Page suiv. changent d'étage ;
- à droite, le panneau « Activité en direct » : missions en cours avec barre de progression et fil horodaté des événements ;
- la recherche liste les résultats avec l'étage où se trouve chaque agent ; Entrée y va et ouvre la fiche.

## 3. Les pôles

Onze pôles. Chaque pôle a une zone du bureau, une couleur et un mobilier distinctif.

| Pôle | Type de zone | Agents | Mobilier distinctif |
|---|---|---|---|
| Direction | bureaux individuels | 4 | grande table, tableau blanc |
| Qualité | bureaux individuels | 8 | loupes, écrans de revue |
| Build et Maintenance | bureaux individuels | 4 | établi, serveur |
| Tests | bureaux individuels | 3 | banc d'essai, voyants vert/rouge |
| Docs et Exploration | bureaux individuels | 4 | bibliothèque, classeurs |
| Atelier Agents | bureaux individuels | 7 | paillasse de labo, robots |
| Réseau et Infra | bureaux individuels | 4 | baie de brassage |
| Open Source | bureaux individuels | 3 | cartons d'expédition |
| Croissance | bureaux individuels | 2 | affiches, mégaphone |
| Open-space Revue | open-space | 21 | rangées de postes, drapeau du langage |
| Open-space Build | open-space | 11 | rangées de postes, drapeau du langage |

Espaces communs (sans agent attitré) : machine à café, salle de réunion, coin détente. Ils servent de destination aux déplacements.

## 4. L'effectif

La colonne « Prénom » est à remplir. Un prénom par agent, sans doublon.

### Direction (4)

| Agent | Rôle | Prénom |
|---|---|---|
| planner | Planifie les fonctionnalités complexes et les refontes | |
| architect | Conçoit l'architecture système et tranche les choix techniques | |
| code-architect | Dessine le plan d'implémentation d'une fonctionnalité dans le code existant | |
| chief-of-staff | Trie les messages (mail, Slack, etc.) et prépare les réponses | |

### Qualité (8)

| Agent | Rôle | Prénom |
|---|---|---|
| code-reviewer | Relit tout changement de code : qualité, sécurité, maintenabilité | |
| security-reviewer | Détecte les vulnérabilités (secrets, injections, OWASP Top 10) | |
| database-reviewer | Relit SQL, schémas et migrations PostgreSQL | |
| silent-failure-hunter | Traque les erreurs avalées et les replis silencieux | |
| type-design-analyzer | Évalue la conception des types et leurs invariants | |
| comment-analyzer | Vérifie l'exactitude et l'utilité des commentaires | |
| commit-reviewer | Relit le diff indexé et rédige le message de commit | |
| a11y-architect | Garantit l'accessibilité (WCAG 2.2) des interfaces | |

### Build et Maintenance (4)

| Agent | Rôle | Prénom |
|---|---|---|
| build-error-resolver | Répare les erreurs de build et de typage avec un diff minimal | |
| refactor-cleaner | Supprime le code mort et les doublons | |
| code-simplifier | Simplifie le code récent sans changer son comportement | |
| performance-optimizer | Trouve les goulets d'étranglement et optimise | |

### Tests (3)

| Agent | Rôle | Prénom |
|---|---|---|
| tdd-guide | Impose les tests d'abord et 80 % de couverture | |
| e2e-runner | Écrit et exécute les tests de bout en bout | |
| pr-test-analyzer | Évalue la couverture de tests d'une pull request | |

### Docs et Exploration (4)

| Agent | Rôle | Prénom |
|---|---|---|
| doc-updater | Met à jour la documentation et les cartes du code | |
| docs-lookup | Va chercher la documentation à jour d'une bibliothèque | |
| code-explorer | Retrace le fonctionnement d'une fonctionnalité existante | |
| spec-miner | Extrait des spécifications d'un code existant | |

### Atelier Agents (7)

| Agent | Rôle | Prénom |
|---|---|---|
| agent-evaluator | Note le travail d'un agent sur une grille à 5 axes | |
| harness-optimizer | Améliore la configuration du harnais d'agents | |
| loop-operator | Pilote les boucles autonomes et intervient si elles calent | |
| conversation-analyzer | Analyse les transcripts pour proposer des hooks | |
| gan-planner | Transforme une idée en spécification produit complète | |
| gan-generator | Implémente la spécification et itère sur les retours | |
| gan-evaluator | Teste l'application en marche et la note | |

### Réseau et Infra (4)

| Agent | Rôle | Prénom |
|---|---|---|
| network-architect | Conçoit des réseaux d'entreprise multi-sites | |
| network-config-reviewer | Relit les configurations de routeurs et de switchs | |
| network-troubleshooter | Diagnostique les pannes réseau couche par couche | |
| homelab-architect | Conçoit le réseau d'un labo domestique | |

### Open Source (3)

| Agent | Rôle | Prénom |
|---|---|---|
| opensource-forker | Copie un projet et retire secrets et références internes | |
| opensource-sanitizer | Vérifie qu'aucun secret ne subsiste avant publication | |
| opensource-packager | Produit README, licence et guides de contribution | |

### Croissance (2)

| Agent | Rôle | Prénom |
|---|---|---|
| marketing-agent | Stratégie de campagne et rédaction marketing | |
| seo-specialist | Audit SEO technique et optimisation des pages | |

### Open-space Revue (21)

Relecteurs spécialisés par langage, framework ou domaine.

| Agent | Spécialité | Prénom |
|---|---|---|
| typescript-reviewer | TypeScript / JavaScript | |
| python-reviewer | Python | |
| go-reviewer | Go | |
| rust-reviewer | Rust | |
| java-reviewer | Java (Spring Boot, Quarkus) | |
| kotlin-reviewer | Kotlin / Android | |
| swift-reviewer | Swift | |
| cpp-reviewer | C++ | |
| csharp-reviewer | C# / .NET | |
| fsharp-reviewer | F# | |
| php-reviewer | PHP | |
| ruby-reviewer | Ruby / Rails | |
| react-reviewer | React | |
| vue-reviewer | Vue | |
| flutter-reviewer | Flutter / Dart | |
| django-reviewer | Django | |
| fastapi-reviewer | FastAPI | |
| bengali-reviewer | Traitement du texte bengali | |
| healthcare-reviewer | Logiciels de santé | |
| mle-reviewer | Machine learning en production | |
| rag-pipeline-reviewer | Pipelines RAG | |

### Open-space Build (11)

Dépanneurs de build spécialisés.

| Agent | Spécialité | Prénom |
|---|---|---|
| react-build-resolver | React (Vite, webpack, Next.js) | |
| go-build-resolver | Go | |
| rust-build-resolver | Rust / Cargo | |
| java-build-resolver | Java (Maven, Gradle) | |
| kotlin-build-resolver | Kotlin / Gradle | |
| swift-build-resolver | Swift / Xcode | |
| cpp-build-resolver | C++ / CMake | |
| dart-build-resolver | Dart / Flutter | |
| django-build-resolver | Django | |
| pytorch-build-resolver | PyTorch / CUDA | |
| harmonyos-app-resolver | HarmonyOS (ArkTS) | |

## 5. La fiche d'un agent

Un panneau latéral ouvert au clic, fermé par Échap ou un clic à l'extérieur.

- Portrait pixel art agrandi, prénom, pôle (pastille de couleur)
- Identifiant technique (ex. `ecc:code-reviewer`)
- Rôle : une ou deux phrases en français
- Compétences : trois à cinq puces en français
- Outils : la liste déclarée par l'agent (Read, Grep, Bash, etc.), sous forme d'étiquettes
- Quand faire appel à lui : une phrase

## 6. Les données

Deux sources, fusionnées au démarrage :

1. `agents.generated.json` — produit par un script qui lit le frontmatter (nom, description, outils) des fichiers `~/.claude/plugins/cache/ecc/ecc/<version>/agents/*.md`. À relancer quand le plugin est mis à jour.
2. `roster.json` — écrit à la main : pour chaque identifiant, le prénom, le pôle, l'apparence du personnage et les textes français de la fiche.

Règle : un agent présent dans le plugin mais absent de `roster.json` apparaît quand même, dans une zone « Nouveaux arrivants », avec sa description d'origine. Un agent de `roster.json` disparu du plugin est signalé dans la console et n'est pas affiché.

## 7. Le bureau

- Grille isométrique en tuiles 2:1, un seul étage, plan fixe décrit dans un fichier de carte.
- Tri de profondeur par position pour que personnages et meubles se recouvrent correctement.
- Chaque pôle a une couleur de sol ou de moquette et un panneau à son nom.
- Bureau individuel : bureau, chaise, écran, un objet propre au pôle. Poste d'open-space : bureau simple et petit drapeau de la spécialité.
- Rendu net : mise à l'échelle par multiples entiers, sans lissage.

## 8. Comportement des personnages (V1)

- États : assis au travail (frappe au clavier), debout au repos, en marche (4 directions).
- De temps en temps, un agent se lève, rejoint un espace commun par le plus court chemin sur la grille, y reste un moment, puis revient à son poste.
- Une limite d'agents en déplacement simultané pour que le bureau reste lisible.
- Survol : le prénom s'affiche au-dessus du personnage. Clic : la fiche s'ouvre, y compris si l'agent est en déplacement.

## 9. Navigation

- Glisser pour déplacer la caméra, molette pour zoomer (paliers entiers).
- Champ de recherche : prénom, identifiant, rôle ou outil. Les résultats sont surlignés, les autres agents sont atténués.
- Boutons de pôle : centrent la caméra sur la zone et surlignent ses agents.

## 10. V2 — activité en direct (réalisée)

Quand Claude Code lance réellement un sous-agent ECC, son personnage regagne son bureau et sa bulle affiche ce qu'il fait ; quand il finit, il va au coin café. Mécanisme : des hooks HTTP Claude Code (`UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `SubagentStart`, `SubagentStop`, `Stop`) notifient un serveur Node local (`127.0.0.1:4747`), qui pousse les événements à la page en WebSocket. L'en-tête de la page indique l'état de la connexion et ce que fait la session principale. Détails dans le README.

## 11. Critères d'acceptation de la V1

1. `npm run dev` ouvre le bureau en local, sans connexion réseau requise.
2. Les 71 agents sont visibles, chacun à un poste dans la zone de son pôle.
3. Un clic sur n'importe quel agent ouvre une fiche complète (prénom, pôle, rôle, compétences, outils).
4. On peut se déplacer et zoomer ; le pixel art reste net à tous les paliers.
5. La recherche trouve un agent par prénom, identifiant, rôle ou outil.
6. Chaque bouton de pôle centre la caméra sur la bonne zone.
7. Des agents se déplacent vers les espaces communs et reviennent sans traverser murs ni meubles.
8. Le script de synchronisation régénère la liste depuis le plugin installé.
9. L'animation reste fluide avec les 71 agents affichés.

## 12. Points ouverts

- Les 71 prénoms (section 4).
- Regroupement à confirmer : `chief-of-staff` en Direction, `a11y-architect` en Qualité, les trois relecteurs de domaine (santé, ML, RAG) dans l'open-space Revue.
- Nom et couleur définitifs de chaque pôle.
