/**
 * The plugin as the dashboard loads it: its manifest, the files the installer places, its settings and their labels,
 * and register(api), which joins the database family's DATABASE menu with PostgreSQL.
 */
import test, { after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

import * as plugin from '../src/index';
import { postgresqlEngine } from '../src/lib/engine';

// Compiled, this test runs from dist/tests, so the package root is one folder further up.
const PKG = fs.existsSync(path.join(__dirname, '..', 'package.json')) ? path.join(__dirname, '..') : path.join(__dirname, '..', '..');
const pkg = JSON.parse(fs.readFileSync(path.join(PKG, 'package.json'), 'utf8'));
const manifest = pkg.workspacePlugin;
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'postgresql-plugin-'));
after(() => fs.rmSync(ROOT, { recursive: true, force: true }));

test('the manifest names the plugin, its family, its settings, its tool and every file it ships, and the package carries them', () => {
  assert.strictEqual(manifest.name, 'postgresql');
  assert.strictEqual(manifest.label, 'PostgreSQL');
  assert.strictEqual(manifest.family, 'databases');
  assert.ok(manifest.summary.length <= 160);
  assert.deepStrictEqual(manifest.typeActions, { database: ['sites'] });
  assert.deepStrictEqual(manifest.commands, { types: ['sites'], files: ['commands/cmd-tools-postgresql.sh'] });
  assert.strictEqual(path.basename(manifest.commands.files[0]), postgresqlEngine.script, 'the tool the menu runs is the one the installer places');
  const files = [manifest.settingsTemplate, manifest.labels, ...manifest.commands.files, ...manifest.scripts.functions, ...manifest.scripts.args, ...manifest.features,
    ...Object.values(manifest.ai).flat() as string[]];
  for (const f of files) {
    assert.ok(fs.existsSync(path.join(PKG, f)), `${f} is in the repository`);
    assert.ok(pkg.files.includes(String(f).split('/')[0]), `${f} is published with the package`);
  }
  assert.strictEqual(manifest.settingsFile, 'plugin.postgresql.settings.yml');
  // A sibling is a version range, never a git URL (webship/workspace, core/docs/releases.md).
  assert.match(pkg.dependencies['@webship.co/workspace-database'], /^\^1\.\d+\.\d+$/);
  assert.strictEqual(pkg.engines.node, '>=24');
  assert.strictEqual(pkg.devDependencies['@types/node'], '^24.0.0');
});

test('the settings template holds every key the labels name, and no value a person must change first', () => {
  const template = fs.readFileSync(path.join(PKG, manifest.settingsTemplate), 'utf8');
  const keys = [...template.matchAll(/^([a-z_]+):/gm)].map((m) => m[1]);
  assert.deepStrictEqual(keys, ['admin', 'keep']);
  assert.ok(!template.includes('CHANGE_ME'), 'the plugin is ready once installed');
  const labels = fs.readFileSync(path.join(PKG, manifest.labels), 'utf8');
  assert.deepStrictEqual([...labels.matchAll(/^([a-z_]+):/gm)].map((m) => m[1]), keys);
  // Every option of admin: is the web admin the engine has, or none: pgAdmin has no official DDEV add-on yet.
  const block = labels.slice(labels.indexOf('  options:'), labels.indexOf('\nkeep:'));
  const options = [...block.matchAll(/^ {4}([a-z]+):/gm)].map((m) => m[1]);
  assert.deepStrictEqual(options, ['adminer', 'none']);
  assert.deepStrictEqual(postgresqlEngine.admins.map((t) => t.id), ['adminer']);
  assert.match(template, /^admin: adminer$/m);
  assert.match(template, /^keep: 0$/m);
});

test('the engine: PostgreSQL\'s databases of a project, its client, its web admins, its dumps', () => {
  assert.strictEqual(postgresqlEngine.id, manifest.name);
  assert.strictEqual(postgresqlEngine.client, 'psql');
  assert.strictEqual(postgresqlEngine.dumpExt, '.sql.gz');
  assert.deepStrictEqual(postgresqlEngine.admins.map((t) => t.ddevAddon), [{ repo: 'ddev/ddev-adminer', service: 'adminer' }]);
  const dir = (rel: string, files: Record<string, string>) => {
    for (const [f, body] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(ROOT, rel, f)), { recursive: true }); fs.writeFileSync(path.join(ROOT, rel, f), body); }
    return path.join(ROOT, rel);
  };
  assert.deepStrictEqual(postgresqlEngine.detect(dir('a', { '.ddev/config.yaml': 'name: a\ndatabase:\n  type: postgres\n  version: "16"\n' })).map((d) => [d.engine, d.version, d.via]), [['postgresql', '16', 'ddev']]);
  assert.deepStrictEqual(postgresqlEngine.detect(dir('a2', { '.ddev/config.yaml': 'name: a2\n' })), [], 'DDEV\'s default is MariaDB');
  assert.deepStrictEqual(postgresqlEngine.detect(dir('b', { '.ddev/config.yaml': 'name: b\ndatabase:\n  type: mysql\n  version: "8.0"\n' })), []);
  assert.deepStrictEqual(postgresqlEngine.detect(dir('c', { 'compose.yaml': 'x-webship:\n  runtime: kubernetes\n  database: "postgres:16"\n' })).map((d) => [d.runtime, d.via]), [['kubernetes', 'layer']]);
  assert.deepStrictEqual(postgresqlEngine.detect(dir('c2', { 'compose.yaml': 'x-webship:\n  runtime: docker\n  database: "10.11"\n' })), [], 'the layer\'s MariaDB');
  assert.deepStrictEqual(postgresqlEngine.detect(dir('d', { 'docker-compose.yml': 'services:\n  mdb:\n    image: postgres:17\n' })).map((d) => [d.service, d.version, d.via]), [['mdb', '17', 'compose']]);
});

test('register(api) joins the DATABASE menu: one slot, PostgreSQL\'s actions under its own name, and its web admin page', () => {
  const calls: any = { rowMenus: {}, actions: [], pages: [], fragments: 0 };
  const lib: any = { esc: (s: unknown) => String(s), iconHtml: () => '', NAME_RE: /^[a-z0-9_-]+$/i, workspaceDir: () => ROOT, isValidWorkspace: () => true, listProjects: () => [] };
  plugin.register({
    name: 'postgresql', config: {}, lib, capabilities: new Set(['row-menu-body']),
    settings: { file: 'plugin.postgresql.settings.yml', read: () => ({}), set() {}, setList() {} }, appliesTo: () => true,
    addRowMenu: (slot: string, spec: any) => { calls.rowMenus[slot] = spec; },
    addAction: (name: string) => calls.actions.push(name), addFragment: () => { calls.fragments += 1; },
    addPage: (re: RegExp) => calls.pages.push(re), addCss() {}, addTypeAction() {}, addAssistantContext() {},
  } as any);
  assert.deepStrictEqual(calls.rowMenus, { database: { label: 'DATABASE', row: 0 } });
  assert.deepStrictEqual(calls.actions.sort(), ['admin', 'admin-remove', 'console', 'export', 'import', 'import-form', 'info', 'running', 'tables', 'tables-form']);
  assert.strictEqual(calls.fragments, 1);
  assert.ok(calls.pages[0].test('/postgresql-admin/adminer/dev/shop') && !calls.pages[0].test('/postgresql-admin/phpmyadmin/dev/shop'));
  assert.deepStrictEqual([plugin.AGENTS, plugin.SKILLS, plugin.AI_COMMANDS, plugin.PROMPTS], [['postgresql-helper'], ['postgresql-database'], ['postgresql-sizes'], ['postgresql-dump-and-check']]);
});

test('the tool, its functions and its arguments are bash that parses, and the tool names its folder for the installer to fill in', () => {
  const tool = fs.readFileSync(path.join(PKG, 'commands', 'cmd-tools-postgresql.sh'), 'utf8');
  assert.match(tool, /workspace\.__WORKSPACE__\.settings\.yml/);
  assert.match(tool, /\$\{WORKSPACE_SCRIPTS\}\/plugins\/postgresql\/args\/arg-postgresql\.sh/);
  assert.match(tool, /^postgresql_tool ;$/m);
  const args = fs.readFileSync(path.join(PKG, 'scripts', 'args', 'arg-postgresql.sh'), 'utf8');
  for (const flag of ['--console', '--tables', '--tsv', '--running', '--info', '--export', '--file', '--import', '--no-safety-export', '--query', '--admin', '--admin-remove', '--service']) {
    assert.ok(args.includes(`'${flag}'`), `${flag} is an argument`);
  }
  // The heredoc the arguments are read from is not quoted: no dollar sign or backtick may be in it.
  assert.ok(!/[$`]/.test(args.replace('argparse "$@" <<ARGEOF || exit 1', '')), 'no $ or ` in the parser');
  for (const f of ['commands/cmd-tools-postgresql.sh', 'scripts/functions/fun-postgresql.sh', 'scripts/args/arg-postgresql.sh']) {
    assert.strictEqual(spawnSync('bash', ['-n', path.join(PKG, f)]).status, 0, `${f} parses`);
  }
  // Sourced by bootstrap for every cmd-*.sh: only functions and one variable, every name the plugin's own.
  const fun = fs.readFileSync(path.join(PKG, 'scripts', 'functions', 'fun-postgresql.sh'), 'utf8');
  for (const m of fun.matchAll(/^function ([a-z_]+)\(\)/gm)) assert.match(m[1], /^postgresql_/, `${m[1]} carries the plugin's name`);
  assert.deepStrictEqual([...fun.matchAll(/^([A-Z_]+)=/gm)].map((m) => m[1]), ['POSTGRESQL_DB_LOGIN', 'POSTGRESQL_DB_TSV', 'POSTGRESQL_DB_TABLES', 'POSTGRESQL_DB_NAME', 'POSTGRESQL_DB_ADMINER_PIN']);
});
