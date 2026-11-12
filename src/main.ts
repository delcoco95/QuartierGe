import { loadAgents, type Agent } from './data';
import { Game } from './game';
import { buildMap } from './map';
import { characterSprite, lookFor } from './sprites';

const { agents, poles, version } = loadAgents();
const poleById = new Map(poles.map((p) => [p.id, p]));
const agentById = new Map(agents.map((a) => [a.id, a]));
const map = buildMap(poles.map((p) => ({ pole: p.id, prop: p.prop, agents: agents.filter((a) => a.pole === p.id).map((a) => a.id) })));

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>('office');
const search = $<HTMLInputElement>('q');
const count = $('count');
const nav = $('poles');
const fiche = $('fiche');

let activePole: string | null = null;
let selected: string | null = null;

const game = new Game(canvas, agents, poleById, map, select);

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

const haystack = new Map(
  agents.map((a) => [a.id, fold([a.prenom, a.id, a.role, a.quand, a.description, ...a.competences, ...a.outils, poleById.get(a.pole)?.nom ?? ''].join(' '))]),
);

function matches(): Agent[] {
  const words = fold(search.value).split(/\s+/).filter(Boolean);
  return agents.filter((a) => (!activePole || a.pole === activePole) && words.every((w) => haystack.get(a.id)!.includes(w)));
}

function applyFilter(): void {
  const active = activePole !== null || search.value.trim() !== '';
  const found = matches();
  game.setHighlight(active ? new Set(found.map((a) => a.id)) : null);
  const n = active ? found.length : agents.length;
  count.textContent = `${n} agent${n > 1 ? 's' : ''}`;
  for (const b of nav.querySelectorAll('button')) b.setAttribute('aria-pressed', String((b.dataset.pole ?? null) === activePole));
}

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
        <code>ecc:${esc(agent.id)}</code>
      </div>
    </div>
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

function poleButton(label: string, poleId: string | null, color: string, n: number): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  if (poleId) b.dataset.pole = poleId;
  b.innerHTML = `<i style="background:${esc(color)}"></i>${esc(label)} <small>${n}</small>`;
  b.addEventListener('click', () => {
    activePole = activePole === poleId ? null : poleId;
    if (activePole) game.focusZone(activePole);
    applyFilter();
  });
  return b;
}

nav.append(poleButton('Tous', null, '#ffffff', agents.length));
for (const p of poles) nav.append(poleButton(p.nom, p.id, p.couleur, agents.filter((a) => a.pole === p.id).length));

search.addEventListener('input', applyFilter);
search.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const first = matches()[0];
  if (first) {
    game.focusAgent(first.id);
    select(first.id);
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (selected) select(null);
  else if (search.value) {
    search.value = '';
    applyFilter();
  }
});
$('zoom-in').addEventListener('click', () => game.zoomBy(1));
$('zoom-out').addEventListener('click', () => game.zoomBy(-1));

(window as unknown as Record<string, unknown>).quartierGeneral = {
  version,
  setMission: (id: string, label: string | null) => game.setMission(id.replace(/^ecc:/, ''), label),
};

applyFilter();
game.start();
