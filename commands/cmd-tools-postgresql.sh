#!/usr/bin/env bash

# Installed by the PostgreSQL plugin (plugins.sh --install postgresql); __WORKSPACE__ is the workspace it was installed into.
#
# The PostgreSQL database of a project of this folder, on the runtime the project is on: DDEV by default, a compose
# file of the project's own, and the Workspace's runtime layer once it builds PostgreSQL. psql on it, its tables and
# sizes, the statements running now, an export into the backups folder (pg_dump), an import of a dump (the database
# as it is exported first), and Adminer on DDEV (the official add-on).
#
#   bash cmd-tools-postgresql.sh <project>                  # what the database is, and how a client connects
#   bash cmd-tools-postgresql.sh <project> --tables         # the tables, largest first
#   bash cmd-tools-postgresql.sh <project> --console        # psql
#   bash cmd-tools-postgresql.sh <project> --export         # a dump into the backups folder
#   bash cmd-tools-postgresql.sh <project> --import <file>  # replaces the database
#   bash cmd-tools-postgresql.sh <project> --help           # every flag

# Bootstrap.
# Find the workspace tooling from this script, so a fresh clone needs no setup.
WORKSPACE_SCRIPTS="${WORKSPACE_SCRIPTS:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../core/scripts" && pwd)}";
source ${WORKSPACE_SCRIPTS}/bootstrap.sh || exit 1 ;

# Load workspace settings and extra lists.
eval $(parse_yaml ${WORKSPACE_CONFIG}/workspace.__WORKSPACE__.settings.yml);

ARGPARSE_DESCRIPTION="The PostgreSQL database of a __WORKSPACE__ project: psql, tables and sizes, running statements, an export, an import, and Adminer on DDEV"
# The args file comes with the plugin: core/scripts/plugins/postgresql/ is where plugins.sh --install puts it.
source ${WORKSPACE_SCRIPTS}/plugins/postgresql/args/arg-postgresql.sh || exit 1 ;

shift $#;

postgresql_tool ;
