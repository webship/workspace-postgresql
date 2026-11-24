/**
 * The AI items this plugin carries (ai/ in the package, the manifest's `ai` block), each placed by the installer in
 * the workspace folder of its kind.
 *
 * What is checked is what a person relies on once they are installed: each item has the shape its folder lists, its
 * body is plain Markdown any AI command-line assistant can follow, and it names nothing that does not exist — every
 * flag of the tool, every settings key and every menu entry it names is the plugin's own.
 */
import test, { after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import os from 'os';
import path from 'path';

import * as plugin from '../src/index';

// Compiled, these tests run from dist/tests, so the package root is one folder further up.
const PKG = fs.existsSync(path.join(__dirname, '..', 'package.json')) ? path.join(__dirname, '..') : path.join(__dirname, '..', '..');
const read = (f: string) => fs.readFileSync(path.join(PKG, f), 'utf8');
const pkg = JSON.parse(read('package.json'));
const manifest = pkg.workspacePlugin;
const P: string = manifest.name;
const KINDS: Record<string, string> = { agents: 'ai-agents', skills: 'ai-skills', commands: 'ai-commands', prompts: 'ai-prompts' };
const kindList = (kind: string): string[] => manifest.ai[kind] || [];
const MAIN_FILES: string[] = [...kindList('agents'), ...kindList('commands'), ...kindList('prompts'), ...kindList('skills').map((s) => `${s}/SKILL.md`)];
const frontmatter = (src: string) => (src.startsWith('---\n') ? src.split('\n---\n')[0] : '');
const bodyOf = (src: string) => (src.startsWith('---\n') ? src.split('\n---\n').slice(1).join('\n---\n') : src);
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'postgresql-items-'));
after(() => fs.rmSync(ROOT, { recursive: true, force: true }));

test('the manifest carries a list per kind, each item under ai/<kind>/ named after the plugin, and needs the folder each kind lands in', () => {
  assert.deepStrictEqual(Object.keys(manifest.ai).sort(), Object.keys(KINDS).sort());
  for (const kind of Object.keys(KINDS)) {
    for (const f of kindList(kind)) {
      assert.strictEqual(path.dirname(f), `ai/${kind}`);
      assert.ok(fs.existsSync(path.join(PKG, f)), `${f} is in the package`);
      assert.match(path.basename(f), new RegExp(`^${P}-[a-z0-9-]+(\\.md)?$`), `${f} carries the plugin's name`);
    }
    assert.ok(manifest.needs.plugins.includes(KINDS[kind]), `it ships ${kind}, so it needs ${KINDS[kind]}`);
  }
  const names = (kind: string, ext = '.md') => kindList(kind).map((f: string) => path.basename(f, ext));
  assert.deepStrictEqual(names('agents'), plugin.AGENTS);
  assert.deepStrictEqual(names('skills', ''), plugin.SKILLS);
  assert.deepStrictEqual(names('commands'), plugin.AI_COMMANDS);
  assert.deepStrictEqual(names('prompts'), plugin.PROMPTS);
  assert.strictEqual(new Set([...plugin.AI_COMMANDS, ...plugin.PROMPTS]).size, plugin.AI_COMMANDS.length + plugin.PROMPTS.length, 'no command and prompt share a name');
});

test('an agent says when to use it and names its model and tools; a skill says when; a command reads its arguments; a prompt is its launch command', () => {
  for (const f of kindList('agents')) {
    const head = frontmatter(read(f));
    assert.match(head, new RegExp(`^name: ${path.basename(f, '.md')}$`, 'm'));
    assert.match(head, /^description: Use this agent .{80,}$/m);
    assert.match(head, /^model: fable$/m);
    assert.match(head, /^tools:\n( {2}- \S+\n?)+/m);
  }
  for (const f of kindList('skills')) {
    const head = frontmatter(read(`${f}/SKILL.md`));
    assert.match(head, new RegExp(`^name: ${path.basename(f)}$`, 'm'));
    assert.match(head, /^description: .{80,}$/m);
    assert.match(head, /Use when/);
  }
  for (const f of kindList('commands')) {
    const src = read(f);
    const head = frontmatter(src);
    assert.match(head, /^description: .{40,}$/m);
    assert.match(head, /^argument-hint: .+$/m);
    assert.doesNotMatch(head, /^name:/m);
    assert.ok(src.includes('$ARGUMENTS'));
    assert.match(bodyOf(src), /The (first word|argument) is /);
  }
  for (const f of kindList('prompts')) {
    const src = read(f);
    assert.doesNotMatch(src, /^---\n/);
    assert.match(src.split('\n')[0], /^[A-Z].{20,}\.$/);
    const flags = src.match(/^\s*claude\s+([^\n]*?)\s*"""\s*$/m);
    const text = src.match(/claude[^\n]*"""\n([\s\S]*?)\n"""/);
    assert.ok(flags && flags[1].trim() === '--permission-mode bypassPermissions', `${f} carries the default launch command`);
    assert.ok(text && text[1].trim().length > 100);
    assert.match(text![1], /<[a-z|]+>/, 'placeholders to fill in');
    assert.match(text![1], /^# .*container-based \(DDEV by default\)/m, 'it says where it runs');
    assert.match(src, /^The text between the triple quotes is plain: it can be given to another AI command-line assistant as it is\.$/m);
  }
});

test('the body of every item is plain Markdown for any AI command-line assistant, and nothing in it is a person\'s', () => {
  for (const f of MAIN_FILES) {
    const body = bodyOf(read(f)).replace(/^\s*claude --permission-mode bypassPermissions """\s*$/m, '');
    for (const m of body.matchAll(/\b(Bash|Read|Write|Edit|Grep|Glob|Task|Agent|Skill|TodoWrite|WebFetch) tool\b|\bsubagents?\b|bypassPermissions|\bClaude\b|\bclaude -p\b|\.claude\/|\bMCP\b|mcp__/g)) {
      assert.fail(`${f}: "${m[0]}" belongs to one AI assistant; the body is for any of them`);
    }
    assert.doesNotMatch(read(f), /\/home\/[a-z]|@gmail|token: [A-Za-z0-9]{8}|DDEV-only|only DDEV/i, `${f} names nothing personal, and the workspace is not DDEV-only`);
  }
});

test('every flag of cmd-tools-postgresql.sh an item names is one the tool takes, and every settings key one the template has', () => {
  const args = read('scripts/args/arg-postgresql.sh');
  const flags = new Set([...args.matchAll(/'(--[a-z-]+)'/g)].map((m) => m[1]));
  const keys = new Set([...read(manifest.settingsTemplate).matchAll(/^([a-z_]+):/gm)].map((m) => m[1]));
  for (const f of MAIN_FILES) {
    const src = read(f);
    for (const line of src.split('\n').filter((l) => l.includes('cmd-tools-postgresql.sh'))) {
      for (const m of line.matchAll(/(?:^|[\s`(])(--[a-z][a-z-]*[a-z])(?=$|[\s`),.;:])/g)) assert.ok(flags.has(m[1]) || m[1] === '--help', `${f}: ${m[1]} is not a flag of cmd-tools-postgresql.sh`);
    }
    for (const m of src.matchAll(/`([a-z_]+):`/g)) assert.ok(keys.has(m[1]), `${f}: ${m[1]}: is not a setting of the plugin`);
  }
  // The skill describes every setting.
  const skill = read(`${kindList('skills')[0]}/SKILL.md`);
  for (const k of keys) assert.ok(skill.includes(`\`${k}:\``), `the skill describes ${k}:`);
});

test('every entry of the DATABASE menu the skill\'s table names is one the menu draws for a PostgreSQL project on DDEV', async () => {
  fs.mkdirSync(path.join(ROOT, 'dev', 'shop', '.ddev'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'dev', 'cmd-tools-postgresql.sh'), '');
  fs.writeFileSync(path.join(ROOT, 'dev', 'shop', '.ddev', 'config.yaml'), 'name: shop\ndatabase:\n  type: postgres\n  version: "16"\n');
  fs.writeFileSync(path.join(ROOT, 'dev', 'shop', '.ddev', 'docker-compose.adminer.yaml'), '');
  fs.mkdirSync(path.join(ROOT, 'dev', 'plain', '.ddev'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'dev', 'plain', '.ddev', 'config.yaml'), 'name: plain\ndatabase:\n  type: postgres\n  version: "17"\n');
  let fragment: any = null;
  const lib: any = {
    esc: (s: unknown) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'), iconHtml: () => '', NAME_RE: /^[a-z0-9_-]+$/i,
    workspaceDir: (k: string) => path.join(ROOT, k), isValidWorkspace: (k: string) => k === 'dev', typeAllows: () => true, listProjects: () => ['shop', 'plain'],
  };
  plugin.register({
    name: 'postgresql', config: {}, lib, capabilities: new Set(['row-menu-body']),
    settings: { file: 'plugin.postgresql.settings.yml', read: () => ({ admin: 'adminer' }), set() {}, setList() {} }, appliesTo: () => true,
    addRowMenu() {}, addAction() {}, addFragment: (fn: any) => { fragment = fn; }, addPage() {}, addCss() {}, addTypeAction() {}, addAssistantContext() {},
  } as any);
  // One project with Adminer added (Open, Remove) and one without (Add): every entry is drawn by one of them.
  let html = '';
  await fragment({ send: (h: string) => { html += h; }, rest: 'menu/dev/shop' });
  await fragment({ send: (h: string) => { html += h; }, rest: 'menu/dev/plain' });
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const skill = read(`${kindList('skills')[0]}/SKILL.md`);
  const table = skill.slice(skill.indexOf('## The DATABASE menu'), skill.indexOf('The tool also takes'));
  const entries = [...table.matchAll(/^\| ([^|]+?) \|/gm)].map((m) => m[1]).filter((e) => !/^(Entry|---)/.test(e));
  assert.ok(entries.length >= 8);
  for (const entry of entries) {
    for (const words of entry.split(', ')) assert.ok(text.includes(words.replace(/…$/, '')), `the menu draws "${words}"`);
  }
});
