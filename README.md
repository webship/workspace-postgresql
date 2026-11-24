# @webship.co/workspace-postgresql

PostgreSQL for the [Webship Workspace](https://github.com/webship/workspace), the container-based development
workspace (DDEV by default): the **DATABASE** menu on every project row whose database is PostgreSQL, and its tool,
`cmd-tools-postgresql.sh`, on DDEV and on a compose file of the project's own. An engine of
[`@webship.co/workspace-database`](https://github.com/webship/workspace-database), which draws the menu.

A project's database is PostgreSQL when its DDEV config says so (`ddev config --database=postgres:16`: the
Workspace's Strapi and Payload builders make one), or when a compose file it carries runs PostgreSQL (`postgres`,
PostGIS, pgvector, TimescaleDB, Bitnami's PostgreSQL).

## Use it

```bash
cd ~/workspace
bash core/scripts/plugins.sh --require github:webship/workspace-postgresql
bash core/scripts/plugins.sh --activate postgresql --with-needs
bash core/scripts/plugins.sh --install postgresql
```

The install places `cmd-tools-postgresql.sh` into every sites folder (dev, test, demos, sandboxes, projects, …), its
bash functions and arguments under `core/scripts/plugins/postgresql/`, its settings file, its AI items and its
webship-js feature. Restart the dashboard to load it.

## The DATABASE menu

On a row whose database is PostgreSQL, the caption says `PostgreSQL <version>`, and the menu holds:

| Entry | The tool's flag | What it does |
| --- | --- | --- |
| Console (psql) | `--console` | psql on the database, in a screen: `ddev psql` on DDEV, psql in the database's container elsewhere |
| Tables and sizes | `--tables` | The tables of every schema but the system's, largest first, with rows (an estimate) and size (indexes and TOAST in it), in the modal |
| Export to the backups folder | `--export` | `<backups>/<folder>/<project>--postgresql--<when>.sql.gz`, pg_dump's plain format |
| Import a dump… | `--import <file>` | The dumps of the backups folder, this project's first; asks first; exports the database as it is, then drops it, makes it again and imports |
| Running statements | `--running` | What runs now in the database, longest first; the slowest ten by their mean time when `pg_stat_statements` is loaded |
| Connection details | `--info` | Version, database, user, encoding, size, and how a client on this machine connects |
| Add Adminer | `--admin adminer` | DDEV: the official add-on (`ddev/ddev-adminer`), and a restart |
| Open Adminer | | The address DDEV gives the add-on |
| Remove Adminer | `--admin-remove adminer` | The add-on out, and a restart; asks first |

Each entry runs the tool in a screen session from the project's workspace folder: read it on the Screens page.

**Adding or removing a web admin restarts the project.** DDEV starts the add-on's service beside the project, and on
that restart it also recreates its shared router, so every DDEV site of the machine is unreachable for a few seconds.
Add Adminer when you need it, and leave it there rather than adding and removing it often.

pgAdmin has no official DDEV add-on yet, so the menu offers Adminer only.

## The tool

```bash
cd ~/workspace/dev
bash cmd-tools-postgresql.sh mysite                     # --info: what the database is, and how a client connects
bash cmd-tools-postgresql.sh mysite --tables            # the tables, largest first (--tsv: name, rows, bytes)
bash cmd-tools-postgresql.sh mysite --running           # what runs now, and the slowest statements
bash cmd-tools-postgresql.sh mysite --console
bash cmd-tools-postgresql.sh mysite --query "SELECT count(*) FROM users"
bash cmd-tools-postgresql.sh mysite --export            # into the backups folder; --file <path.sql.gz> elsewhere
bash cmd-tools-postgresql.sh mysite --import <file>     # .sql or .sql.gz; --no-safety-export skips the export first
bash cmd-tools-postgresql.sh mysite --admin adminer     # DDEV: the add-on, a restart, the address
bash cmd-tools-postgresql.sh mysite --admin-remove adminer
```

For a compose file of the project's own, `--service <name>` names the database's service (the first PostgreSQL one
when it is not given). psql logs in with what the database's container was made with: the official image's
`POSTGRES_USER`, `POSTGRES_PASSWORD` and `POSTGRES_DB`, Bitnami's `POSTGRESQL_*`, or libpq's own `PG*` (DDEV's
database sets them: `db`/`db`/`db`); the password goes in `PGPASSWORD`. A dump of a compose file's database drops what
it makes first and carries no owner or grants (`pg_dump --clean --if-exists --no-owner --no-privileges`), so it goes
into a database of another user as well.

## Settings

`core/config/plugin.postgresql.settings.yml`, also on the plugin's page in Settings:

| Key | Default | What it is |
| --- | --- | --- |
| `admin` | `adminer` | The web admin the menu offers: `adminer` or `none` |
| `keep` | `0` | How many exports of one project the backups folder keeps; the oldest go when a new one is made. `0` keeps every one |

## Runtimes

| | DDEV | A compose file of its own | Docker Compose, Kubernetes, Podman, Lando, Docksal (built by the Workspace) |
| --- | --- | --- | --- |
| The menu on the row, its caption | Yes | Yes | Not yet: the runtime layer builds MariaDB only |
| Console | Yes, with a prompt | Yes, with a prompt | Not yet |
| Tables and sizes, running statements, connection details | Yes | Yes | Not yet |
| Export, then import (the database dropped and made again first) | Yes | Yes | Not yet |
| Adminer | Yes | No: not yet | No: not yet |

"Yes" means it was run on a real project of that runtime: a PostgreSQL 16 project on DDEV and a compose file of its
own with a `postgres:17` service, each with a shop's tables and a view, from the terminal and from the dashboard.

How each is reached:

| Runtime | The database | The console |
| --- | --- | --- |
| DDEV | The project's `db` service: `ddev psql`, `ddev exec -s db`, `ddev export-db`, `ddev import-db` | `ddev psql`, with a prompt (in a screen session too: `script` gives it a terminal of its own) |
| A compose file of the project's own | Its PostgreSQL service, with `docker compose exec` | psql, with a prompt (the same way) |
| A project the Workspace built on another runtime | The runtime layer's `db`, once the layer builds PostgreSQL (its block would say `database: "postgres:16"`) | |

## What does not fit yet

- **PostgreSQL on Docker Compose, Podman, Kubernetes, Lando and Docksal, built by the Workspace.** The runtime layer's
  `php` stack has one database, MariaDB. The tool already reads a block that names PostgreSQL
  (`database: "postgres:16"`), for the day the layer builds one.
- **pgAdmin.** It has no official DDEV add-on yet; Adminer opens a PostgreSQL database on DDEV.
- **A web admin for a compose file of the project's own.** Adminer is a service of its own beside the project, which
  the Workspace cannot declare for a project there yet, so the menu says so in its place.
- **Adminer on a DDEV older than 1.24.10.** The add-on's newest releases ask for 1.24.10; on an older DDEV the tool
  takes its last release for it (`ddev/ddev-adminer` v1.1.4), and names Adminer 4 in the project's `.ddev/.env`
  (`ADMINER_DOCKER_IMAGE`), the Adminer that release logs in to by itself. Adminer 4 reads PostgreSQL 16 and 17.
  Removing Adminer takes that line out again.
- **The slowest statements need `pg_stat_statements`,** which a server loads only when it is configured to
  (`shared_preload_libraries`); without it the menu shows what runs now and what the server logs.

## What it needs

On the machine: what the core needs (DDEV, and the runtime CLIs of the projects you have). `docker` is suggested
(`suggests.commands`): the tool calls it for a compose file of the project's own. The workspace reports it and never
installs it:

```bash
bash core/scripts/plugins.sh --check postgresql
webship-workspace doctor
```

In the workspace (`needs`): a sites folder for the tool (`dev`, `test`, `demos`, `sandboxes` or `projects`; the
first is added when none is there), and the AI folders its items are placed in: `ai-agents`, `ai-skills`,
`ai-commands` and `ai-prompts`. `--with-needs` adds what is missing first.

## The items it carries

Each lands in the folder of its kind, when that folder is an active workspace folder, and is installed into an AI CLI
from there (Claude Code by default):

| What | Lands in | What it is for |
| --- | --- | --- |
| The agent `postgresql-helper` | `ai-agents/` | Says what a project's PostgreSQL is, lists its tables and sizes, finds what runs slowly, exports it and checks the dump, and imports only when asked |
| The skill `postgresql-database` | `ai-skills/` | Which projects are PostgreSQL's, every entry of the DATABASE menu and its flag, the runtimes, the settings |
| The command `/postgresql-sizes` | `ai-commands/` | `/postgresql-sizes <folder> <project>`: the size and the largest tables. Reads only |
| The prompt `postgresql-dump-and-check` | `ai-prompts/` | The launch command of a session that exports a database and checks the dump |

The item bodies are plain Markdown any AI command-line assistant can follow. How they are laid out and checked:
[docs/plugin-items-pattern.md](docs/plugin-items-pattern.md).

## What the package holds

| Path | What it is |
| --- | --- |
| `src/` | `register(api)`: PostgreSQL's engine for `registerDatabase` (`src/lib/engine.ts`) |
| `commands/cmd-tools-postgresql.sh` | The tool, placed into the sites folders (`__WORKSPACE__` filled in) |
| `scripts/functions/fun-postgresql.sh`, `scripts/args/arg-postgresql.sh` | Its functions and its arguments, placed under `core/scripts/plugins/postgresql/` |
| `config/plugin.postgresql.settings.yml`, `config/settings.labels.yml` | The settings template and its labels |
| `ai/` | The agent, the skill, the command and the prompt |
| `features/postgresql.feature` | The webship-js scenarios, run by the dashboard's suite and in CI |
| `tests/` | The manifest, the engine, the menu, the tool against scaffolded projects, the items |

## What comes later

- PostgreSQL built by the runtime layer, on Docker Compose, Podman, Kubernetes, Lando and Docksal.
- pgAdmin, once DDEV has an official add-on for it.
- The version new builds get, and a move of a project's database to another PostgreSQL version.
- A web admin for a compose file of the project's own, once the core can declare a service for a project.
- Dumps in pg_dump's custom format, and an import of one with `pg_restore`.

## Develop it

```bash
npm install     # builds dist/ (TypeScript)
npm run lint
npm test        # the manifest, the engine, the menu, the tool's functions against scaffolded projects, the items
```
