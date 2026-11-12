import { describe as suite, expect, it } from 'vitest';
import { agentKey, createOffice, describe } from './office.mjs';

const sub = (name, extra = {}) => ({ hook_event_name: name, session_id: 's1', agent_id: 'a1', agent_type: 'ecc:code-reviewer', ...extra });

suite('describe', () => {
  it('décrit les outils en une phrase courte', () => {
    expect(describe('Read', { file_path: 'C:\\repo\\src\\auth.ts' })).toBe('lit auth.ts');
    expect(describe('Edit', { file_path: '/repo/src/app.ts' })).toBe('modifie app.ts');
    expect(describe('Bash', { command: 'npm test -- --watch=false' })).toBe('lance les tests');
    expect(describe('Bash', { command: 'npx vitest run' })).toBe('lance les tests');
    expect(describe('Bash', { command: 'npm run build' })).toBe('lance le build');
    expect(describe('Bash', { command: 'git status --short' })).toBe('git status');
    expect(describe('Grep', { pattern: 'TODO' })).toBe('cherche « TODO »');
    expect(describe('WebFetch', { url: 'https://example.com/a/b' })).toBe('consulte example.com');
    expect(describe('mcp__context7__query-docs', {})).toBe('utilise context7');
  });

  it('tronque les libellés trop longs et tolère une entrée vide', () => {
    expect(describe('Grep', { pattern: 'x'.repeat(200) }).length).toBeLessThanOrEqual(44);
    expect(describe('Read')).toBe('lit un fichier');
  });
});

suite('createOffice', () => {
  it("retire le préfixe du plugin de l'identifiant", () => {
    expect(agentKey('ecc:code-reviewer')).toBe('code-reviewer');
    expect(agentKey('Explore')).toBe('Explore');
    expect(agentKey(undefined)).toBeNull();
  });

  it("suit un sous-agent du démarrage à l'arrêt", () => {
    const office = createOffice();
    expect(office.handle(sub('SubagentStart'))).toEqual([{ type: 'agent', id: 'code-reviewer', active: true, label: 'démarre' }]);
    expect(office.handle(sub('PreToolUse', { tool_name: 'Read', tool_input: { file_path: 'src/auth.ts' } }))).toEqual([
      { type: 'agent', id: 'code-reviewer', active: true, label: 'lit auth.ts' },
    ]);
    expect(office.handle(sub('PostToolUse', { tool_name: 'Read' }))[0].label).toBe('réfléchit');
    expect(office.handle(sub('SubagentStop'))).toEqual([{ type: 'agent', id: 'code-reviewer', active: false, label: null }]);
  });

  it('garde un agent actif tant qu\'une de ses instances tourne', () => {
    const office = createOffice();
    office.handle(sub('SubagentStart'));
    office.handle(sub('SubagentStart', { agent_id: 'a2' }));
    expect(office.handle(sub('SubagentStop'))[0].active).toBe(true);
    expect(office.handle(sub('SubagentStop', { agent_id: 'a2' }))[0].active).toBe(false);
  });

  it('rattache les outils de la session principale à la session, pas à un agent', () => {
    const office = createOffice();
    const main = { session_id: 's1' };
    expect(office.handle({ ...main, hook_event_name: 'UserPromptSubmit', prompt: 'corrige   le bug' })).toEqual([
      { type: 'session', active: true, label: 'corrige le bug' },
    ]);
    expect(office.handle({ ...main, hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'npm test' } })).toEqual([
      { type: 'session', active: true, label: 'lance les tests' },
    ]);
  });

  it("libère à l'arrêt de la session les agents dont l'arrêt a été manqué", () => {
    const office = createOffice();
    office.handle(sub('SubagentStart'));
    office.handle(sub('SubagentStart', { agent_id: 'b1', session_id: 's2', agent_type: 'ecc:planner' }));
    expect(office.handle({ hook_event_name: 'Stop', session_id: 's1' })).toEqual([
      { type: 'agent', id: 'code-reviewer', active: false, label: null },
      { type: 'session', active: false, label: '' },
    ]);
    expect(office.snapshot()).toContainEqual({ type: 'agent', id: 'planner', active: true, label: 'démarre' });
  });

  it('ignore les événements inconnus ou mal formés', () => {
    const office = createOffice();
    expect(office.handle(null)).toEqual([]);
    expect(office.handle({ hook_event_name: 'Notification' })).toEqual([]);
    expect(office.handle({ hook_event_name: 'SubagentStart' })).toEqual([]);
  });
});
