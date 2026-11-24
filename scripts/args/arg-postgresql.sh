#!/usr/bin/env bash

argparse "$@" <<ARGEOF || exit 1
parser.add_argument('PROJECT_NAME',
                    help="The project's folder in this workspace folder.")
what = parser.add_mutually_exclusive_group()
what.add_argument('--console',
                  action='store_true',
                  default=False,
                  help="Open psql on the project's database: ddev psql on DDEV, psql in the database's container elsewhere. Type a statement ending with ; and Enter; Ctrl-D leaves.")
what.add_argument('--tables',
                  action='store_true',
                  default=False,
                  help="List the tables of every schema but the system's, largest first, with their rows (PostgreSQL's statistics' estimate) and their sizes (with their indexes and TOAST). Reads only.")
what.add_argument('--running',
                  action='store_true',
                  default=False,
                  help="The statements running now in the database, longest first, and the slowest ten by their mean time when pg_stat_statements is loaded. Reads only.")
what.add_argument('--info',
                  action='store_true',
                  default=False,
                  help="The engine and version, the runtime and service, the database and user, and how a client on this machine connects. What the tool does with no flag.")
what.add_argument('--export',
                  action='store_true',
                  default=False,
                  help="Write a dump of the database into the backups folder of this workspace folder: <project>--postgresql--<when>.sql.gz. Past the keep: setting, the oldest go.")
what.add_argument('--import',
                  dest='IMPORT',
                  default="_none_",
                  help="Replace the database with a dump (a .sql or .sql.gz file, pg_dump's plain format). The database as it is is exported into the backups folder first, and nothing is imported when that export fails.")
what.add_argument('--query',
                  dest='QUERY',
                  default="_none_",
                  help="Run one statement and print what it answers. A SELECT reads; anything else changes the database.")
what.add_argument('--admin',
                  dest='ADMIN',
                  default="_none_",
                  choices=['_none_', 'adminer'],
                  help="Add Adminer to a DDEV project (the official add-on ddev/ddev-adminer), restart the project, and print its address. DDEV only.")
what.add_argument('--admin-remove',
                  dest='ADMIN_REMOVE',
                  default="_none_",
                  choices=['_none_', 'adminer'],
                  help="Remove that add-on from the DDEV project, and restart it.")
parser.add_argument('--tsv',
                    action='store_true',
                    default=False,
                    help="With --tables: one line per table, its name, rows and size in bytes, separated by tabs (what the dashboard reads).")
parser.add_argument('--file',
                    dest='FILE',
                    default="_none_",
                    help="With --export: write the dump to this file (ending with .sql.gz) instead of the backups folder.")
parser.add_argument('--no-safety-export',
                    action='store_true',
                    default=False,
                    help="With --import: skip the export of the database made first. The export is there because an import that replaced an afternoon of work is a bad import: skipping it is a choice, not a default.")
parser.add_argument('--service',
                    dest='SERVICE',
                    default="_none_",
                    help="For a compose file of the project's own: the database's service (the first PostgreSQL service when it is not given).")
ARGEOF
