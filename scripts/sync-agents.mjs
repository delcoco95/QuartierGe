// Lit le frontmatter des agents du plugin ECC installe et ecrit src/data/agents.generated.json.
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(homedir(), '.claude', 'plugins', 'cache', 'ecc', 'ecc');
if (!existsSync(root)) {
  console.error(`Plugin ECC introuvable : ${root}`);
  process.exit(1);
}

const byVersion = (a, b) => a.localeCompare(b, undefined, { numeric: true });
const version = readdirSync(root).sort(byVersion).pop();
const dir = join(root, version, 'agents');

const unquote = (s) => s.trim().replace(/^["']|["']$/g, '');

function parse(file) {
  const text = readFileSync(join(dir, file), 'utf8');
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_-]+):\s*(.*)$/);
    if (kv) fields[kv[1]] = kv[2];
  }
  if (!fields.name) return null;
  const tools = unquote((fields.tools ?? '').replace(/^\[|\]$/g, ''))
    .split(',')
    .map(unquote)
    .filter(Boolean);
  return { id: unquote(fields.name), description: unquote(fields.description ?? ''), tools };
}

const agents = readdirSync(dir)
  .filter((f) => f.endsWith('.md'))
  .map(parse)
  .filter(Boolean)
  .sort((a, b) => a.id.localeCompare(b.id));

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'agents.generated.json');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ version, agents }, null, 2) + '\n');
console.log(`${agents.length} agents (ECC ${version}) -> src/data/agents.generated.json`);
