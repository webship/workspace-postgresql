/**
 * PostgreSQL, as a database engine: the facts the family's DATABASE menu draws from.
 *
 * A project's PostgreSQL is DDEV's `db` service (`ddev config --database=postgres:<version>`), a PostgreSQL service of a
 * compose file of the project's own (postgres, PostGIS, pgvector, TimescaleDB, Bitnami's), or the runtime layer's
 * `db` once the layer builds PostgreSQL (its block's `database: "postgres:16"`). Every entry of the menu runs
 * cmd-tools-postgresql.sh, which the plugin installs into the sites folders. Its web admin is Adminer, the official
 * DDEV add-on: pgAdmin has no official DDEV add-on yet.
 */

import { serverDetect } from '@webship.co/workspace-database';
import type { DatabaseEngine } from '@webship.co/workspace-database';

export const postgresqlEngine: DatabaseEngine = {
  id: 'postgresql',
  title: 'PostgreSQL',
  script: 'cmd-tools-postgresql.sh',
  client: 'psql',
  detect: serverDetect('postgresql'),
  admins: [
    { id: 'adminer', label: 'Adminer', ddevAddon: { repo: 'ddev/ddev-adminer', service: 'adminer' } },
  ],
  dumpExt: '.sql.gz',
  rowsAre: 'as PostgreSQL\'s statistics estimate them',
};
