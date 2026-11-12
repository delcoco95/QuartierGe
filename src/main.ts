import { loadAgents, type Agent } from './data';
import { floorShort, Game } from './game';
import { connectLive } from './live';
import { buildBuilding } from './map';
import { fold, planMission, type Step } from './missions';
import { characterSprite, lookFor } from './sprites';

const { agents, poles, version, chef, etages } = loadAgents();
const poleById = new Map(poles.map((p) => [p.id, p]));
const agentById = new Map(agents.map((a) => [a.id, a]));
const building = buildBuilding(
  etages,
  poles.map((p) => ({ pole: p.id, nom: p.nom, prop: p.prop, agents: agents.filter((a) => a.pole === p.id).map((a) => a.id) })),
  chef,
);
const floors = building.floors;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>('office');
const search = $<HTMLInputElement>('q');
const results = $('results');
const count = $('count');
const etagesList = $('etages');
const fiche = $('fiche');

let activePole: string | null = null;
let selected: string | null = null;

const game = new Game(canvas, agents, poleById, building, select);

const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
const short = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const floorName = (index: number) => `${floorShort(floors[index].etage.numero)} ${floors[index].etage.nom}`;
const homeFloor = (id: string) => building.seats[id]?.floor ?? 0;

const haystack = new Map(
  agents.map((a) => [a.id, fold([a.prenom, a.id, a.role, a.quand, a.description, ...a.competences, ...a.outils, poleById.get(a.pole)?.nom ?? ''].join(' '))]),
);

function matches(): Agent[] {
  const words = fold(search.value).split(/\s+/).filter(Boolean);
  return agents.filter((a) => (!activePole || a.pole === activePole) && words.every((w) => haystack.get(a.id)!.includes(w)));
}

// ---------- Immeuble (panneau de gauche) ----------

function showFloor(index: number): void {
  if (!floors[index]) return;
  game.setFloor(index);
  refreshBuilding();
}

function goToAgent(id: string): void {
  game.focusAgent(id);
  refreshBuilding();
  select(id);
}

for (let i = floors.length - 1; i >= 0; i--) {
  const { etage, rooms } = floors[i];
  const li = document.createElement('li');
  li.dataset.floor = String(i);
  const chips = [...new Set(rooms.map((r) => r.pole).filter((p): p is string => Boolean(p)))]
    .map((p) => `<button type="button" class="chip" data-pole="${esc(p)}"><i style="background:${esc(poleById.get(p)?.couleur ?? '#8a8f98')}"></i>${esc(poleById.get(p)?.nom ?? p)}</button>`)
    .join('');
  li.innerHTML = `
    <button type="button" class="etage" title="${esc(etage.sousTitre)}">
      <b>${esc(floorShort(etage.numero))}</b>
      <span class="nom">${esc(etage.nom)}</span>
      <span class="meta"><i class="voyant" title="Un agent de cet étage travaille en direct"></i><span class="presents"></span></span>
    </button>
    <div class="chips">${chips}</div>`;
  li.querySelector('.etage')!.addEventListener('click', () => {
    activePole = null;
    showFloor(i);
    applyFilter();
  });
  for (const chip of li.querySelectorAll<HTMLButtonElement>('.chip')) {
    chip.addEventListener('click', () => {
      activePole = activePole === chip.dataset.pole ? null : chip.dataset.pole!;
      if (activePole) game.focusPole(activePole);
      else game.setFloor(i);
      refreshBuilding();
      applyFilter();
    });
  }
  etagesList.append(li);
}

function refreshBuilding(): void {
  const presence = game.presence();
  const liveFloors = new Set([...liveLabels.keys()].map(homeFloor));
  for (const li of etagesList.querySelectorAll<HTMLLIElement>('li')) {
    const i = Number(li.dataset.floor);
    li.classList.toggle('current', i === game.floorIndex);
    li.classList.toggle('live', liveFloors.has(i));
    const n = presence[i];
    li.querySelector('.presents')!.textContent = `${n} présent${n > 1 ? 's' : ''}`;
    for (const chip of li.querySelectorAll<HTMLButtonElement>('.chip')) chip.setAttribute('aria-pressed', String(chip.dataset.pole === activePole));
  }
}

// ---------- Recherche ----------

function applyFilter(): void {
  const query = search.value.trim() !== '';
  const active = activePole !== null || query;
  const found = matches();
  game.setHighlight(active ? new Set(found.map((a) => a.id)) : null);
  const n = active ? found.length : agents.length;
  count.textContent = `${n} agent${n > 1 ? 's' : ''}`;

  results.hidden = !query;
  results.innerHTML = query
    ? found.slice(0, 8).map((a) => `<li><button type="button" data-id="${esc(a.id)}"><b>${esc(a.prenom)}</b> <span>${esc(a.id)}</span><small>${esc(floorName(game.agentFloor(a.id)))}</small></button></li>`).join('')
      || '<li class="none">Aucun agent trouvé</li>'
    : '';
}

results.addEventListener('click', (e) => {
  const button = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-id]');
  if (!button) return;
  results.hidden = true;
  goToAgent(button.dataset.id!);
});

// ---------- Fiche ----------

function select(id: string | null): void {
  selected = id;
  game.setSelected(id);
  const agent = id ? agentById.get(id) : undefined;
  fiche.hidden = !agent;
  if (!agent) return;

  const pole = poleById.get(agent.pole)!;
  const list = (items: string[]) => items.map((i) => `<li>${esc(i)}</li>`).join('');
  fiche.innerHTML = `
    <button class="close" type="button" aria-label="Fermer la fiche">x</button>
    <div class="head">
      <canvas class="portrait" width="16" height="24"></canvas>
      <div>
        <h2>${esc(agent.prenom)}</h2>
        <p class="pole"><i style="background:${esc(pole.couleur)}"></i>${esc(pole.nom)}</p>
        <p class="pole">Bureau : ${esc(floorName(homeFloor(agent.id)))}</p>
        <code>ecc:${esc(agent.id)}</code>
      </div>
    </div>
    <h3>Mission en cours</h3>
    <p class="mission">${esc(missionOf(agent.id))}</p>
    <h3>Rôle</h3>
    <p>${esc(agent.role)}</p>
    ${agent.competences.length ? `<h3>Compétences</h3><ul>${list(agent.competences)}</ul>` : ''}
    <h3>Outils</h3>
    <div class="tags">${agent.outils.map((t) => `<span>${esc(t)}</span>`).join('')}</div>
    ${agent.quand ? `<h3>Quand faire appel</h3><p>${esc(agent.quand)}</p>` : ''}
  `;
  const portrait = fiche.querySelector<HTMLCanvasElement>('.portrait')!;
  portrait.getContext('2d')!.drawImage(characterSprite(lookFor(agent.id, pole.couleur), 'stand', false).img, 0, 0);
  fiche.querySelector('.close')!.addEventListener('click', () => select(null));
}

// ---------- Activite (panneau de droite) ----------

const FEED_MAX = 60;
const feed = $('fil');
const missionsList = $('missions');
let lastFeed = '';

const who = (a: Agent) => `${a.prenom}, ${poleById.get(a.pole)?.nom ?? a.pole}, ${floorShort(floors[homeFloor(a.id)].etage.numero)}`;

function addFeed(text: string): void {
  if (text === lastFeed) return;
  lastFeed = text;
  const time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const li = document.createElement('li');
  li.innerHTML = `<time>${esc(time)}</time> · ${esc(text)}`;
  feed.prepend(li);
  while (feed.children.length > FEED_MAX) feed.lastElementChild!.remove();
}

// Missions simulees : le chef planifie, puis chaque agent de l'equipe travaille a son tour.
type RunStep = Step & { state: 'attente' | 'cours' | 'fini' };
const CHEF_SECONDS = 4;
const STEP_SECONDS = 6;
const pending: string[] = [];
let run: { text: string; steps: RunStep[] } | null = null;
let lastDone = '';
const missionStatus = $('mission-status');

// Activite reelle recue des hooks Claude Code (prioritaire sur la simulation).
const liveLabels = new Map<string, string>();

function missionOf(id: string): string {
  const live = liveLabels.get(id);
  if (live) return `En direct : ${live}`;
  const step = run?.steps.find((s) => s.id === id);
  if (!step) return 'Aucune mission en cours.';
  if (step.state === 'cours') return step.label;
  return step.state === 'attente' ? `En attente : ${step.label}` : `Terminé : ${step.label}`;
}

function refreshMission(): void {
  const waiting = pending.length ? ` (${pending.length} en attente)` : '';
  const items: string[] = [];
  if (run) {
    const i = run.steps.findIndex((s) => s.state === 'cours');
    const done = run.steps.filter((s) => s.state === 'fini').length;
    const whoNow = agentById.get(run.steps[i]?.id ?? '')?.prenom ?? '';
    missionStatus.textContent = `Étape ${i + 1}/${run.steps.length} : ${whoNow} travaille sur « ${run.text} »${waiting}`;
    const percent = Math.round(((done + 0.5) / run.steps.length) * 100);
    items.push(`<li><span>« ${esc(run.text)} »</span><small>Étape ${i + 1}/${run.steps.length} · ${esc(whoNow)}</small><div class="bar"><i style="width:${percent}%"></i></div></li>`);
  } else {
    missionStatus.textContent = lastDone ? `Mission terminée : « ${lastDone} »` : 'Aucune mission en cours.';
  }
  for (const text of pending) items.push(`<li><span>« ${esc(text)} »</span><small>En attente</small><div class="bar"><i style="width:0"></i></div></li>`);
  for (const [id, label] of liveLabels) {
    const a = agentById.get(id)!;
    items.push(`<li><span>${esc(who(a))}</span><small>En direct · ${esc(label)}</small><div class="bar live"><i></i></div></li>`);
  }
  missionsList.innerHTML = items.join('') || '<li class="none">Aucune mission en cours.</li>';

  const line = fiche.querySelector('.mission');
  if (line && selected) line.textContent = missionOf(selected);
  refreshBuilding();
}

function advance(i: number): void {
  if (!run) return;
  const previous = run.steps[i - 1];
  if (previous) {
    previous.state = 'fini';
    if (!liveLabels.has(previous.id)) game.finishMission(previous.id);
  }
  const step = run.steps[i];
  if (!step) {
    addFeed(`Mission terminée : « ${run.text} »`);
    lastDone = run.text;
    run = null;
    startNext();
    return;
  }
  step.state = 'cours';
  if (!liveLabels.has(step.id)) game.setMission(step.id, short(step.label, 36));
  const a = agentById.get(step.id);
  if (a) addFeed(`${who(a)} : ${step.label}`);
  refreshMission();
  setTimeout(() => advance(i + 1), (i === 0 ? CHEF_SECONDS : STEP_SECONDS) * 1000);
}

function startNext(): void {
  const text = pending.shift();
  if (text) {
    run = { text, steps: planMission(text, agents, chef).map((s) => ({ ...s, state: 'attente' })) };
    advance(0);
  } else {
    refreshMission();
  }
}

$<HTMLFormElement>('mission').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $<HTMLInputElement>('mission-text');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  pending.push(text);
  if (run) refreshMission();
  else startNext();
});

// ---------- Clavier et zoom ----------

search.addEventListener('input', applyFilter);
search.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const first = matches()[0];
  if (first) {
    results.hidden = true;
    goToAgent(first.id);
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'PageUp' || e.key === 'PageDown') {
    e.preventDefault();
    showFloor(game.floorIndex + (e.key === 'PageUp' ? 1 : -1));
    return;
  }
  if (e.key !== 'Escape') return;
  if (selected) select(null);
  else if (search.value) {
    search.value = '';
    applyFilter();
  }
});
$('zoom-in').addEventListener('click', () => game.zoomBy(1));
$('zoom-out').addEventListener('click', () => game.zoomBy(-1));

// ---------- Direct ----------

const liveStatus = $('live');

function endLive(id: string): void {
  if (!liveLabels.delete(id)) return;
  game.finishMission(id);
  const a = agentById.get(id);
  if (a) addFeed(`${who(a)} : a terminé`);
}

connectLive({
  agent(id, active, label) {
    const a = agentById.get(id);
    if (!a) return;
    if (active) {
      const text = label ?? 'travaille';
      liveLabels.set(id, text);
      game.setMission(id, short(text, 36), true);
      // "réfléchit" revient après chaque outil : inutile de le répéter dans le fil.
      if (text !== 'réfléchit') addFeed(`${who(a)} : ${text}`);
    } else {
      endLive(id);
    }
    refreshMission();
  },
  session(active, label) {
    liveStatus.textContent = active ? `Claude Code : ${label}` : 'Direct : connecté';
    liveStatus.dataset.state = active ? 'busy' : 'on';
    addFeed(active ? `Claude Code : ${label}` : 'Claude Code : session terminée');
  },
  status(connected) {
    liveStatus.textContent = connected ? 'Direct : connecté' : 'Direct : hors ligne';
    liveStatus.dataset.state = connected ? 'on' : 'off';
    if (!connected) {
      for (const id of [...liveLabels.keys()]) endLive(id);
      refreshMission();
    }
  },
});

(window as unknown as Record<string, unknown>).quartierGeneral = { version };

// ?heure=22 force l'heure du ciel, pour voir le rendu de nuit en plein jour.
const forcedHour = new URLSearchParams(location.search).get('heure');
if (forcedHour !== null && forcedHour !== '') game.setHour(Number(forcedHour) % 24);

applyFilter();
refreshMission();
setInterval(refreshBuilding, 500);
game.start();
