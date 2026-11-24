/**
 * cmd-tools-postgresql.sh's functions against scaffolded projects, with `ddev` and `docker` replaced by recorders: what
 * each flag runs on DDEV, on the runtime layer and on a compose file of the project's own, and the client's login in
 * the database's container, run in a real shell with a stand-in client.
 */
import test, { after } from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';

// Compiled, this test runs from dist/tests, so the package root is one folder further up.
const PKG = fs.existsSync(path.join(__dirname, '..', 'package.json')) ? path.join(__dirname, '..') : path.join(__dirname, '..', '..');
const FUN = path.join(PKG, 'scripts', 'functions', 'fun-postgresql.sh');
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'postgresql-tool-'));
after(() => fs.rmSync(ROOT, { recursive: true, force: true }));

function write(rel: string, body: string) {
  fs.mkdirSync(path.dirname(path.join(ROOT, rel)), { recursive: true });
  fs.writeFileSync(path.join(ROOT, rel), body);
}

write('dev/shop/.ddev/config.yaml', 'name: shop\ntype: php\ndocroot: web\ndatabase:\n    type: postgres\n    version: "16"\n');
write('dev/maria/.ddev/config.yaml', 'name: maria\ntype: php\n');
write('dev/my/.ddev/config.yaml', 'name: my\ndatabase:\n  type: mysql\n  version: "8.0"\n');
write('dev/static/.ddev/config.yaml', 'name: static\nomit_containers: [db, dba]\n');
write('dev/layered/compose.yaml', 'name: layered\nx-webship:\n  runtime: kubernetes\n  stack: php\n  database: "postgres:16"\n  port: 30080\n');
write('dev/docked/compose.yaml', 'name: docked\nx-webship:\n  runtime: docker\n  database: "10.11"\n');
write('dev/own/compose.yaml', 'services:\n  app:\n    image: node:22\n  pg:\n    image: "postgres:17.2-alpine"\n    environment:\n      POSTGRES_PASSWORD: x\n');
write('dev/gis/docker-compose.yml', 'services:\n  db:\n    image: postgis/postgis:16-3.4\n');
write('dev/vector/compose.yml', 'services:\n  db:\n    image: pgvector/pgvector:pg17\n');
write('dev/ownmy/docker-compose.yml', 'services:\n  db:\n    image: mysql:8.4\n');
write('dev/landoown/.lando.yml', 'name: landoown\nrecipe: lamp\n');
write('dev/nothing/README.md', '');

/**
 * A shell with the plugin's functions, the two layer functions they ask (as the core's runtime layer answers them),
 * and `ddev`, `docker` and `date` recorded into $LOG. An export's recorder writes a small gzip, so the dump has content.
 */
function run(script: string, env: Record<string, string> = {}, opts: { layer?: boolean; ddevVersion?: string } = {}): { code: number; out: string; log: string[] } {
  const log = path.join(ROOT, `log-${Math.random().toString(36).slice(2)}`);
  const layer = opts.layer === false ? '' : `
function rt_find_project() { local d="\${1:-\$PWD}" ; d="\$(cd "\$d" && pwd)" ;
  while [ "\$d" != / ] ; do
    for f in compose.yaml .lando.yml .docksal/docksal.yml ; do
      if [ -f "\$d/\$f" ] && grep -q '^x-webship:' "\$d/\$f" ; then echo "\$(sed -n '/^x-webship:/,/^[^ ]/s/^  runtime: *//p' "\$d/\$f" | head -1) \$d" ; return 0 ; fi
    done
    [ -f "\$d/.ddev/config.yaml" ] && { echo "ddev \$d" ; return 0 ; } ;
    [ -f "\$d/.lando.yml" ] && { echo "lando \$d" ; return 0 ; } ;
    d="\$(dirname "\$d")" ;
  done ; return 1 ; }
function rt_meta() { local f ; for f in compose.yaml .lando.yml .docksal/docksal.yml ; do [ -f "\$2/\$f" ] && grep -q '^x-webship:' "\$2/\$f" && { sed -n '/^x-webship:/,/^[^ x]/s/^  '"\$1"': *//p' "\$2/\$f" | head -1 | tr -d '"' ; return 0 ; } ; done ; }`;
  const src = `
LOG='${log}'
rec() { printf '%s\\n' "\$*" >> "\$LOG" ; }
function ddev() {
  rec ddev "\$@" ;
  case "\$1" in
    export-db) local f="\${2#--file=}" ; echo 'CREATE TABLE x (id int);' | gzip > "\$f" ;;
    --version) echo 'ddev version v${opts.ddevVersion || '1.24.7'}' ;;
    describe) echo '{"raw":{"dbinfo":{"published_port":32801},"services":{"adminer":{"https_url":"https://shop.ddev.site:9101","status":"running"}}}}' ;;
    exec) [ -n "\${DDEV_EXEC_OUT:-}" ] && printf '%b' "\$DDEV_EXEC_OUT" ;;
  esac
  return 0 ; }
function docker() { rec docker "\$@" ; [ -t 0 ] || cat > /dev/null ; [ -n "\${DOCKER_OUT:-}" ] && printf '%b' "\$DOCKER_OUT" ; return 0 ; }
${layer}
source '${FUN}'
WORKSPACE_ROOT='${ROOT}' ; doc_name=dev ; backups='${ROOT}/backups' ; current_path='${ROOT}'
${script}`;
  const r = spawnSync('bash', ['-c', src], { encoding: 'utf8', env: { PATH: process.env.PATH, HOME: ROOT, ...env } });
  const lines = fs.existsSync(log) ? fs.readFileSync(log, 'utf8').split('\n').filter(Boolean) : [];
  return { code: r.status === null ? -1 : r.status, out: `${r.stdout}${r.stderr}`, log: lines };
}

test('where a project\'s PostgreSQL runs: DDEV, the runtime layer once it builds PostgreSQL, a compose file of its own; another engine or none is said', () => {
  const at = (p: string, want = '') => run(`PROJECT_NAME=${p} ; postgresql_locate '${ROOT}/dev/${p}' '${want}'`);
  assert.strictEqual(at('shop').out.trim(), 'ddev|ddev|db|16|');
  assert.strictEqual(at('layered').out.trim(), 'layer|kubernetes|db|16|');
  assert.strictEqual(at('own').out.trim(), 'compose|docker|pg|17|compose.yaml');
  assert.strictEqual(at('gis').out.trim(), 'compose|docker|db|16|docker-compose.yml', 'PostGIS is PostgreSQL');
  assert.strictEqual(at('vector').out.trim(), 'compose|docker|db|17|compose.yml', 'pgvector is PostgreSQL');
  assert.match(at('maria').out, /The database of maria is MariaDB 10\.11 \(DDEV\), not PostgreSQL: its tool is cmd-tools-mariadb\.sh\./);
  assert.match(at('my').out, /The database of my is MySQL 8\.0 \(DDEV\), not PostgreSQL: its tool is cmd-tools-mysql\.sh\./);
  assert.match(at('docked').out, /The database of docked is MariaDB 10\.11 \(Docker Compose\), not PostgreSQL/);
  assert.match(at('static').out, /static has no database: its DDEV config omits the db container\./);
  assert.match(at('own', 'app').out, /The service app of compose\.yaml is not PostgreSQL \(node:22\)\./);
  assert.match(at('ownmy').out, /docker-compose\.yml of ownmy has no PostgreSQL service\./);
  assert.match(at('landoown').out, /runs on a Lando file of its own: the database it holds is not read yet\./);
  assert.match(at('nothing').out, /nothing has no PostgreSQL/);
  assert.strictEqual(run(`PROJECT_NAME=shop ; postgresql_locate '${ROOT}/dev/shop'`, {}, { layer: false }).out.trim(), 'ddev|ddev|db|16|');
});

test('the tables (every schema but the system\'s), the running statements and the slowest ones, the info and a query: psql in the database\'s container', () => {
  const tsv = run('PROJECT_NAME=shop ; TABLES=yes ; TSV=yes ; postgresql_tool');
  assert.strictEqual(tsv.code, 0, tsv.out);
  assert.strictEqual(tsv.log.length, 1);
  assert.match(tsv.log[0], /^ddev exec -s db -d \/ u="\$\{POSTGRES_USER:-\$\{POSTGRESQL_USERNAME:-\$\{PGUSER:-postgres\}\}\}"; .* exec psql "\$@" -X -q -v ON_ERROR_STOP=1 -P pager=off -A -t -F "\$\(printf "\\t"\)" -c 'SELECT CASE WHEN schemaname = /);
  assert.match(tsv.log[0], /n_live_tup, pg_total_relation_size\(relid\) FROM pg_stat_user_tables ORDER BY pg_total_relation_size\(relid\) DESC, 1'$/);
  const own = run('PROJECT_NAME=own ; RUNNING=yes ; DOCKER_OUT="0\\n" ; postgresql_tool');
  assert.strictEqual(own.code, 0, own.out);
  assert.match(own.log[0], /^docker compose -f compose\.yaml exec -T pg sh -c .*-c 'SELECT count\(\*\) FROM pg_stat_activity WHERE datname = current_database\(\)/);
  assert.match(own.out, /No statement runs now, besides this one\./);
  assert.match(own.log[1], /to_regclass\(.{1,6}pg_stat_statements/);
  assert.match(own.out, /pg_stat_statements is not loaded, so the server keeps no list of its slow statements/);
  const kept = run('PROJECT_NAME=shop ; RUNNING=yes ; DDEV_EXEC_OUT="t\\n" ; postgresql_tool');
  assert.match(kept.log.at(-1), /FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10'$/, 'the slowest, when the server keeps them');
  const info = run('PROJECT_NAME=shop ; INFO=yes ; postgresql_tool');
  assert.match(info.out, /Database:  PostgreSQL 16 on DDEV, service db/);
  assert.match(info.out, /A client on this machine: host 127\.0\.0\.1, port 32801, user db, password db, database db\./);
  assert.match(run('PROJECT_NAME=layered ; postgresql_tool').out, /In the project's network: host db, port 5432\. Kubernetes publishes no port/);
  const q = run(`PROJECT_NAME=shop ; QUERY="SELECT 'it''s'" ; postgresql_tool`);
  assert.match(q.log[0], /-P pager=off  -c 'SELECT '\\''it'\\'''\\''s'\\'''$/);
});

test('an export is pg_dump\'s plain format in the backups folder, with the engine in its name, and drops what it makes first', () => {
  const ddev = run('PROJECT_NAME=shop ; EXPORT=yes ; postgresql_tool');
  assert.strictEqual(ddev.code, 0, ddev.out);
  assert.match(ddev.log[0], new RegExp(`^ddev export-db --file=${ROOT}/backups/dev/shop--postgresql--\\d{4}-\\d\\d-\\d\\d-\\d\\d-\\d\\d-\\d\\d\\.sql\\.gz$`));
  ['2026-01-01-00-00-00', '2026-01-02-00-00-00', '2026-01-03-00-00-00'].forEach((s, i) => {
    write(`backups/dev/shop--postgresql--${s}.sql.gz`, 'x');
    const t = new Date(Date.UTC(2026, 0, 1 + i));
    fs.utimesSync(path.join(ROOT, 'backups', 'dev', `shop--postgresql--${s}.sql.gz`), t, t);
  });
  const kept = run('PROJECT_NAME=shop ; EXPORT=yes ; plugin_postgresql_keep=2 ; postgresql_tool');
  assert.strictEqual(fs.readdirSync(path.join(ROOT, 'backups', 'dev')).filter((f) => f.startsWith('shop--postgresql--')).length, 2);
  assert.match(kept.out, /Removed an older export \(keep: 2\): shop--postgresql--2026-01-01-00-00-00\.sql\.gz/);
  const own = run('PROJECT_NAME=own ; EXPORT=yes ; DOCKER_OUT="-- PostgreSQL database dump\\nCREATE TABLE t (id int);\\n" ; postgresql_tool');
  assert.strictEqual(own.code, 0, own.out);
  assert.match(own.log[0], /^docker compose -f compose\.yaml exec -T pg sh -c .*exec pg_dump "\$@" --clean --if-exists --no-owner --no-privileges$/);
  assert.match(run('PROJECT_NAME=own ; EXPORT=yes ; postgresql_tool').out, /The export is empty: is own running\?/);
  assert.match(run('PROJECT_NAME=shop ; EXPORT=yes ; FILE=/tmp/x.dump ; postgresql_tool').out, /An export is a \.sql\.gz file/);
});

test('an import exports the database as it is first, drops it and makes it again off DDEV, and takes only a plain dump', () => {
  fs.mkdirSync(path.join(ROOT, 'dumps'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'dumps', 'in.sql.gz'), zlib.gzipSync('CREATE TABLE t (id int);\n'));
  const ddev = run(`PROJECT_NAME=shop ; IMPORT='${ROOT}/dumps/in.sql.gz' ; postgresql_tool`);
  assert.strictEqual(ddev.code, 0, ddev.out);
  assert.match(ddev.log[0], /^ddev export-db --file=.*\/backups\/dev\/shop--postgresql--before-import--.*\.sql\.gz$/);
  assert.strictEqual(ddev.log[1], `ddev import-db --file=${ROOT}/dumps/in.sql.gz`);
  assert.strictEqual(ddev.log.length, 2, 'DDEV empties the database itself');
  const own = run(`PROJECT_NAME=own ; IMPORT='dumps/in.sql.gz' ; NO_SAFETY_EXPORT=yes ; postgresql_tool`);
  assert.strictEqual(own.code, 0, own.out);
  assert.match(own.log[0], /psql -U "\$u" -d postgres -X -q -v ON_ERROR_STOP=1 -c "SELECT pg_terminate_backend\(pid\) FROM pg_stat_activity WHERE datname = '\$d' AND pid <> pg_backend_pid\(\)" -c "DROP DATABASE IF EXISTS \\"\$d\\"" -c "CREATE DATABASE \\"\$d\\" OWNER \\"\$u\\"" > \/dev\/null$/);
  assert.match(own.log[1], /^docker compose -f compose\.yaml exec -T pg sh -c .*exec psql "\$@" -X -q -v ON_ERROR_STOP=1$/);
  const layer = run(`PROJECT_NAME=layered ; IMPORT='${ROOT}/dumps/in.sql.gz' ; NO_SAFETY_EXPORT=yes ; postgresql_tool`);
  assert.match(layer.log[0], /^ddev exec -s db -d \/ .*DROP DATABASE IF EXISTS/);
  assert.strictEqual(layer.log[1], `ddev import-db --file=${ROOT}/dumps/in.sql.gz`);
  assert.match(run(`PROJECT_NAME=shop ; IMPORT='${ROOT}/dev/shop/.ddev/config.yaml' ; postgresql_tool`).out, /A PostgreSQL dump is a \.sql or \.sql\.gz file \(pg_dump's plain format\)/);
  assert.match(run(`PROJECT_NAME=own ; IMPORT='${ROOT}/dumps/in.sql.gz' ; postgresql_tool`).out, /The export of the database as it is failed: nothing was imported\./);
});

test('the console: ddev psql on DDEV, psql in the service for a compose file of its own, and psql without a terminal on the runtime layer, said first', () => {
  assert.deepStrictEqual(run('PROJECT_NAME=shop ; CONSOLE=yes ; postgresql_tool').log, ['ddev psql']);
  assert.match(run('PROJECT_NAME=own ; CONSOLE=yes ; postgresql_tool').log[0], /^docker compose -f compose\.yaml exec -T pg sh -c .*exec psql "\$@" -X -P pager=off$/, 'no terminal here, so -T');
  const layer = run('PROJECT_NAME=layered ; CONSOLE=yes ; postgresql_tool');
  assert.match(layer.out, /The runtime gives psql no terminal of its own, so it shows no prompt/);
});

test('Adminer: the official add-on on DDEV, its last release for a DDEV older than 1.24.10, and a restart; refused elsewhere', () => {
  const old = run('PROJECT_NAME=shop ; ADMIN=adminer ; postgresql_tool');
  assert.strictEqual(old.code, 0, old.out);
  assert.deepStrictEqual(old.log.slice(0, 3), ['ddev --version', 'ddev add-on get ddev/ddev-adminer --version v1.1.4', 'ddev restart']);
  assert.match(old.out, /Adminer: https:\/\/shop\.ddev\.site:9101/);
  assert.strictEqual(fs.readFileSync(path.join(ROOT, 'dev', 'shop', '.ddev', '.env'), 'utf8'), 'ADMINER_DOCKER_IMAGE=adminer:4.8.1-standalone\n', 'that release logs in to Adminer 4');
  const fresh = run('PROJECT_NAME=shop ; ADMIN=adminer ; postgresql_tool', {}, { ddevVersion: '1.25.4' });
  assert.deepStrictEqual(fresh.log.slice(0, 3), ['ddev --version', 'ddev add-on get ddev/ddev-adminer', 'ddev restart']);
  write('dev/shop/.ddev/docker-compose.adminer.yaml', 'services: {}\n');
  assert.match(run('PROJECT_NAME=shop ; ADMIN=adminer ; postgresql_tool').out, /Adminer is already added to shop\./);
  assert.deepStrictEqual(run('PROJECT_NAME=shop ; ADMIN_REMOVE=adminer ; postgresql_tool').log, ['ddev add-on remove adminer', 'ddev restart']);
  assert.ok(!fs.existsSync(path.join(ROOT, 'dev', 'shop', '.ddev', '.env')), 'the line the tool wrote goes with the add-on');
  const own = run('PROJECT_NAME=own ; ADMIN=adminer ; postgresql_tool');
  assert.strictEqual(own.code, 1);
  assert.match(own.out, /on a compose file of the project's own the Workspace cannot add one yet/);
  assert.deepStrictEqual(own.log, []);
});

test('psql\'s login in the database\'s container: the official image\'s POSTGRES_*, Bitnami\'s POSTGRESQL_*, libpq\'s PG* (DDEV\'s), else postgres', () => {
  const bin = path.join(ROOT, 'bin');
  fs.mkdirSync(bin, { recursive: true });
  fs.writeFileSync(path.join(bin, 'psql'), '#!/bin/sh\necho "ARGS $* PGPASSWORD=${PGPASSWORD:-}"\n', { mode: 0o755 });
  const login = (env: Record<string, string>) => {
    const r = spawnSync('bash', ['-c', `source '${FUN}' ; sh -c "\${POSTGRESQL_DB_LOGIN} exec psql \\"\\$@\\" -c 'SELECT 1'"`], { encoding: 'utf8', env: { PATH: `${bin}:/usr/bin:/bin`, ...env } });
    return r.stdout.trim();
  };
  assert.strictEqual(login({ POSTGRES_USER: 'app', POSTGRES_PASSWORD: 'secret', POSTGRES_DB: 'shop' }), 'ARGS -U app -d shop -c SELECT 1 PGPASSWORD=secret');
  assert.strictEqual(login({ POSTGRES_PASSWORD: 'only' }), 'ARGS -U postgres -d postgres -c SELECT 1 PGPASSWORD=only', 'the official image\'s defaults: postgres, and a database of its name');
  assert.strictEqual(login({ POSTGRESQL_USERNAME: 'bn', POSTGRESQL_PASSWORD: 'bp', POSTGRESQL_DATABASE: 'bd' }), 'ARGS -U bn -d bd -c SELECT 1 PGPASSWORD=bp');
  assert.strictEqual(login({ PGUSER: 'db', PGPASSWORD: 'db', PGDATABASE: 'db' }), 'ARGS -U db -d db -c SELECT 1 PGPASSWORD=db', 'DDEV\'s database');
});
