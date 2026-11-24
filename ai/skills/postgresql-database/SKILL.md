---
name: postgresql-database
description: The PostgreSQL database of a Webship Workspace project, as the PostgreSQL plugin (`@webship.co/workspace-postgresql`) gives it — which project's database is PostgreSQL and where it runs (DDEV, a compose file of the project's own), every entry of the DATABASE menu and the `cmd-tools-postgresql.sh` flag it runs, the exports and imports in the backups folder, Adminer on DDEV, and the plugin's settings. Use when a person asks about a project's PostgreSQL, psql, its size, its tables, slow statements, an export or an import, Adminer, or what the DATABASE menu does.
---

# PostgreSQL in a Webship Workspace

The Webship Workspace is container-based (DDEV by default). The PostgreSQL plugin (`@webship.co/workspace-postgresql`,
an engine of `@webship.co/workspace-database`) puts a **DATABASE** menu on every project row whose database is
PostgreSQL, and places its tool, `cmd-tools-postgresql.sh`, into every sites folder (dev, test, demos, sandboxes,
projects, …). Every entry of the menu runs that tool in a screen session, from the project's workspace folder.

## Which projects

| The project carries | Its PostgreSQL |
| --- | --- |
| `.ddev/config.yaml` | `database.type: postgres` (`ddev config --database=postgres:16`): the Workspace's Strapi and Payload builders make one |
| A compose file of its own | A service whose image is `postgres`, PostGIS, pgvector, TimescaleDB or Bitnami's PostgreSQL |
| An `x-webship:` block (a builder run with `--runtime`) | The block's `database` value naming PostgreSQL (`postgres:16`), once the runtime layer builds PostgreSQL: today it builds MariaDB only |

The row's caption says it: `PostgreSQL 16`. A project whose database is MariaDB or MySQL gets that plugin's section in
the same menu, with that plugin installed.

## The DATABASE menu

| Entry | The tool's flag | What it does |
| --- | --- | --- |
| Console (psql) | `--console` | psql on the database: `ddev psql` on DDEV; elsewhere psql in the database's container |
| Tables and sizes | `--tables` (the modal reads `--tables --tsv`) | The tables of every schema but the system's, largest first, with rows (an estimate) and size. Reads only |
| Export to the backups folder | `--export` | `<backups>/<folder>/<project>--postgresql--<when>.sql.gz`, pg_dump's plain format |
| Import a dump… | `--import <file>` | Lists the dumps of the backups folder; asks first; checks that the dump is whole, exports the database as it is, then drops it, makes it again and fills it |
| Running statements | `--running` | What runs now in the database, longest first; the slowest ten when `pg_stat_statements` is loaded. Reads only |
| Connection details | `--info` | Version, database, user, encoding, size, and how a client on this machine connects |
| Add Adminer | `--admin adminer` | DDEV only: the official add-on (ddev/ddev-adminer), and a restart |
| Open Adminer | | The address DDEV gives the add-on |
| Remove Adminer | `--admin-remove adminer` | Takes the add-on out and restarts the project; asks first |

The tool also takes `--query "<statement>"` (prints what it answers), `--file <path>` with `--export`,
`--no-safety-export` with `--import`, and `--service <name>` for a compose file of the project's own. Run
`bash cmd-tools-postgresql.sh <project> --help` for every flag.

```bash
cd ~/workspace/<folder>
bash cmd-tools-postgresql.sh <project>                    # --info
bash cmd-tools-postgresql.sh <project> --tables
bash cmd-tools-postgresql.sh <project> --export
bash cmd-tools-postgresql.sh <project> --import ~/workspace/backups/<folder>/<project>--postgresql--<when>.sql.gz
```

## Runtimes

| | DDEV | A compose file of the project's own | Docker Compose, Podman, Kubernetes, Lando, Docksal built by the Workspace |
| --- | --- | --- | --- |
| Reached through | DDEV's verbs | `docker compose exec` on the service | Not yet: the runtime layer builds MariaDB only |
| The console | `ddev psql`, with a prompt | psql, with a prompt | |
| A web admin | Adminer (the add-on) | Not yet: the Workspace cannot add a service to a project there | |

pgAdmin has no official DDEV add-on yet, so the menu offers Adminer only. An import empties the database first
everywhere (DDEV's import-db does it on DDEV), so a table the dump does not have does not stay.

## The settings

`core/config/plugin.postgresql.settings.yml`, also on the plugin's page in Settings:

| Key | What it is |
| --- | --- |
| `admin:` | The web admin the menu offers: `adminer` (the default) or `none` |
| `keep:` | How many exports of one project the backups folder keeps; the oldest go when a new one is made, never the dump an import is reading. `0` keeps every one |

## Good to know

- The exports carry the engine in their name, so the Import list of a MariaDB project never offers a PostgreSQL dump.
- A project that is stopped has no database to ask: the tool says so. Start it first.
- The tool never prints a password other than the project's own `db` one, and never copies a dump out of the workspace.
