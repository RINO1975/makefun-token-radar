import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const TEXT_MAX_BYTES = 65536;
const IMAGE_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

function arg(name: string, fallback: string): string {
  const key = `--${name}`;
  const i = process.argv.indexOf(key);
  if (i >= 0 && i + 1 < process.argv.length) return process.argv[i + 1]!;
  const eq = process.argv.find((v) => v.startsWith(`${key}=`));
  return eq ? eq.slice(key.length + 1) : fallback;
}

const inputArg = arg('input', '/input');
const inputFile = existsSync(inputArg) && statSync(inputArg).isFile() ? inputArg : join(inputArg, 'snapshot.json');
if (!existsSync(inputFile)) {
  process.stderr.write(`token radar: no snapshot at ${inputFile}: pass --input <snapshot.json|directory> or mount the sealed /input\n`);
  process.exit(2);
}
const out = arg('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

let snapshot;
try { snapshot = parseSnapshot(readFileSync(inputFile, 'utf8')); }
catch (e) { process.stderr.write(`token radar: cannot parse snapshot: ${e instanceof Error ? e.message : String(e)}\n`); process.exit(2); }
const { board, radar } = buildRadar(snapshot);
const issue = boardIssue(board, snapshot);
if (issue) { process.stderr.write(`token radar: the model wrote a board the gate refuses: ${issue}\n`); process.exit(1); }

mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
writeFileSync(join(out, 'data.js'), dataScript(radar));

function copyFiles(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const names: string[] = [];
  for (const name of readdirSync(from).sort()) {
    if (name.startsWith('.')) continue;
    const p = join(from, name);
    if (statSync(p).isDirectory()) { names.push(...copyFiles(p, join(to, name)).map(child => `${name}/${child}`)); }
    else if (statSync(p).isFile()) { copyFileSync(p, join(to, name)); names.push(name); }
  }
  return names;
}
copyFiles(join(here, 'dashboard'), join(out, 'dashboard'));
const copiedShots = copyFiles(join(here, 'screenshots'), join(out, 'screenshots'));
const shots = copiedShots.filter(name => /\.(png|jpe?g)$/i.test(name));
if (shots.length < 3) { process.stderr.write(`token radar: screenshots/ holds ${shots.length} images; at least 3 required\n`); process.exit(1); }
for (const name of shots) if (!IMAGE_NAME.test(name)) { process.stderr.write(`token radar: invalid screenshot name ${name}\n`); process.exit(1); }

const dossier = buildDossier(out, { text_max_bytes: TEXT_MAX_BYTES, screenshots: { max: 4, max_bytes: 524288 }, dashboard: { max_files: 400, max_bytes: 4194304 } });
writeFileSync(join(out, 'dossier.json'), dossier);
process.stdout.write(`token radar: wrote board.json (${board.length} rows), data.js (${radar.live_size} live), dashboard/, screenshots/ (${shots.length} images), and dossier.json to ${out}\n`);
