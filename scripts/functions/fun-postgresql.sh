#!/usr/bin/env bash

# PostgreSQL, for the Webship Workspace (@webship.co/workspace-postgresql, an engine of @webship.co/workspace-database):
# the database of a project whose database is PostgreSQL, on the runtime the project is on.
#
# A project's database is reached the ways the dashboard's DATABASE menu reads it:
#   - DDEV: the project's `db` service, through `ddev psql`, `ddev export-db`, `ddev import-db` and `ddev exec -s db`;
#   - a compose file of the project's own, which the runtime layer does not run: the database's service, through
#     `docker compose`, the way the Docker Compose plugin runs that file's own verbs;
#   - a project the Workspace built on another runtime (an x-webship block naming PostgreSQL): the same DDEV verbs,
#     which the runtime layer (core/scripts/functions/fun-runtime.sh) gives their meaning, once it builds PostgreSQL
#     (it builds MariaDB only so far).
# Nothing here is a person's: the client logs in with what the database's container was made with.

# How psql logs in, read in the database's container: the official image's POSTGRES_USER, POSTGRES_PASSWORD and
# POSTGRES_DB, Bitnami's POSTGRESQL_*, else libpq's own PG* (DDEV's database sets PGUSER, PGPASSWORD, PGDATABASE and
# PGHOST: db/db/db), else postgres. The password goes in PGPASSWORD, where libpq takes it. Sets $u (the user), $d (the
# database) and the client's login as "$@" (-U and -d). It is expanded in the container, so it stays in single quotes.
POSTGRESQL_DB_LOGIN='u="${POSTGRES_USER:-${POSTGRESQL_USERNAME:-${PGUSER:-postgres}}}"; w="${POSTGRES_PASSWORD:-${POSTGRESQL_PASSWORD:-${PGPASSWORD:-}}}"; d="${POSTGRES_DB:-${POSTGRESQL_DATABASE:-${PGDATABASE:-$u}}}"; [ -n "$w" ] && export PGPASSWORD="$w"; set -- -U "$u" -d "$d";'

# The engines a project's database can be, as people write them.
function postgresql_engine_title() {
  case "$1" in
    mariadb) echo 'MariaDB' ;; mysql) echo 'MySQL' ;; postgresql|postgres) echo 'PostgreSQL' ;; sqlite) echo 'SQLite' ;; *) echo "$1" ;;
  esac
}

# The runtimes, as people write them.
function postgresql_runtime_title() {
  case "$1" in
    ddev) echo 'DDEV' ;; docker) echo 'Docker Compose' ;; podman) echo 'Podman' ;; kubernetes) echo 'Kubernetes' ;;
    lando) echo 'Lando' ;; docksal) echo 'Docksal' ;; *) echo "$1" ;;
  esac
}

# A value for a line of shell, in single quotes.
function postgresql_q() {
  printf "'%s'" "$(printf '%s' "$1" | sed "s/'/'\\\\''/g")" ;
}

# The database of a DDEV project, as `<type> <version>` (DDEV's default: mariadb 10.11), or `omitted` when its
# config omits the db container. config.yaml first, then the config.*.yaml DDEV merges over it, in its order.
function postgresql_ddev_database() {
  local dir="$1/.ddev" f t v type="" version="" omitted="" ;
  for f in "${dir}/config.yaml" $(ls "${dir}"/config.*.yaml 2> /dev/null | sort) ; do
    [ -f "${f}" ] || continue ;
    t="$(sed -n '/^database:/,/^[^[:space:]#]/s/^[[:space:]]\{1,\}type:[[:space:]]*["'"'"']\{0,1\}\([A-Za-z0-9_.-]*\).*/\1/p' "${f}" | head -1)" ;
    v="$(sed -n '/^database:/,/^[^[:space:]#]/s/^[[:space:]]\{1,\}version:[[:space:]]*["'"'"']\{0,1\}\([A-Za-z0-9_.-]*\).*/\1/p' "${f}" | head -1)" ;
    [ -n "${t}" ] && type="${t}" ;
    [ -n "${v}" ] && version="${v}" ;
    if sed -n '/^omit_containers:/,/^[^[:space:]#-]/p' "${f}" | grep -qE '(^|[^A-Za-z0-9_-])db([^A-Za-z0-9_-]|$)' ; then omitted=yes ; fi
  done
  [ -n "${omitted}" ] && { echo 'omitted' ; return 0 ; } ;
  [ -z "${type}" ] && [ -z "${version}" ] && { echo 'mariadb 10.11' ; return 0 ; } ;
  [ "${type}" = postgres ] && type=postgresql ;
  echo "${type:-mariadb} ${version}" ;
}

# The engine and version a runtime layer's block names: the version of its MariaDB ("10.11"), or another engine before
# a colon ("postgres:16"), as `<engine> <version>`.
function postgresql_layer_database() {
  local value="$1" ;
  [ -z "${value}" ] && { echo 'mariadb 10.11' ; return 0 ; } ;
  case "${value}" in
    *:*) local e="${value%%:*}" ; [ "${e}" = postgres ] && e=postgresql ; echo "${e} ${value#*:}" ;;
    *) echo "mariadb ${value}" ;;
  esac
}

# Each service of a compose file and its image, as `<service> <image>`, read without a YAML parser: the keys one level
# under `services:` and an `image:` one level further in. The dashboard names the service it means (--service).
function postgresql_compose_services() {
  awk '
    /^services:[[:space:]]*$/ { inside = 1 ; svc = "" ; level = -1 ; next }
    inside && /^[^[:space:]#]/ { inside = 0 }
    !inside || /^[[:space:]]*(#|$)/ { next }
    {
      match($0, /^[[:space:]]*/) ; ind = RLENGTH ;
      if (level < 0) level = ind ;
      if (ind == level && $0 ~ /^[[:space:]]*[A-Za-z0-9._-]+:[[:space:]]*$/) { svc = $1 ; sub(/:$/, "", svc) ; next }
      if (ind > level && svc != "" && $1 == "image:") { img = $2 ; gsub(/["\047]/, "", img) ; print svc, img }
    }' "$1" ;
}

# Is an image PostgreSQL's (the official one, its Bitnami build, and those with an extension in: PostGIS, pgvector,
# TimescaleDB)? Its name, without a registry or a tag.
function postgresql_is_my_image() {
  local ref="${1%%@*}" ; ref="${ref##*/}" ;
  case "${ref%%:*}" in postgres|postgresql|postgis|pgvector|timescaledb|timescaledb-ha) return 0 ;; esac
  return 1 ;
}

# The major version an image's tag says: postgres:16.4-alpine is 16, pgvector/pgvector:pg17 is 17, postgres:9.6 is
# 9.6, no tag says none.
function postgresql_image_version() {
  local ref="${1%%@*}" tag="" ; ref="${ref##*/}" ;
  case "${ref}" in *:*) tag="${ref#*:}" ;; esac
  tag="${tag#pg}" ;
  [[ "${tag}" =~ ^([0-9]+)(\.([0-9]+))? ]] || return 0 ;
  if [ "${BASH_REMATCH[1]}" -ge 10 ] ; then echo "${BASH_REMATCH[1]}" ; else echo "${BASH_REMATCH[1]}${BASH_REMATCH[3]:+.${BASH_REMATCH[3]}}" ; fi
}

# Where the project's PostgreSQL runs, as `<via>|<runtime>|<service>|<version>|<compose file>` (via: ddev, layer or
# compose), or why it does not, on stderr: another engine, no database, a runtime file whose engine is not read yet.
function postgresql_locate() {
  local dir="$1" want="${2:-}" found="" rt="" engine="" version="" ;
  [ "${want}" = '_none_' ] && want="" ;
  if declare -f rt_find_project > /dev/null ; then found="$(rt_find_project "${dir}" 2> /dev/null)" || found="" ; fi
  # A project above this folder is not this one.
  [ -n "${found}" ] && [ "${found#* }" != "${dir}" ] && found="" ;
  # A workspace whose core has no runtime layer yet: DDEV.
  [ -z "${found}" ] && [ -f "${dir}/.ddev/config.yaml" ] && found="ddev ${dir}" ;
  if [ -n "${found}" ] ; then
    rt="${found%% *}" ;
    if [ "${rt}" = ddev ] ; then
      read -r engine version <<< "$(postgresql_ddev_database "${dir}")" ;
      [ "${engine}" = omitted ] && { echo "${PROJECT_NAME} has no database: its DDEV config omits the db container." >&2 ; return 1 ; } ;
    else
      if [ -z "$(rt_meta runtime "${dir}")" ] ; then
        echo "${PROJECT_NAME} runs on a $(postgresql_runtime_title "${rt}") file of its own: the database it holds is not read yet." >&2 ;
        return 1 ;
      fi
      read -r engine version <<< "$(postgresql_layer_database "$(rt_meta database "${dir}")")" ;
    fi
    if [ "${engine}" != postgresql ] ; then
      echo "The database of ${PROJECT_NAME} is $(postgresql_engine_title "${engine}")${version:+ ${version}} ($(postgresql_runtime_title "${rt}")), not PostgreSQL: its tool is cmd-tools-${engine}.sh." >&2 ;
      return 1 ;
    fi
    echo "$( [ "${rt}" = ddev ] && echo ddev || echo layer )|${rt}|db|${version}|" ;
    return 0 ;
  fi
  # A compose file of the project's own: the service asked for, else the first PostgreSQL one.
  local f svc img ;
  for f in compose.yaml compose.yml docker-compose.yml docker-compose.yaml ; do
    [ -f "${dir}/${f}" ] || continue ;
    while read -r svc img ; do
      [ -n "${want}" ] && [ "${svc}" != "${want}" ] && continue ;
      if postgresql_is_my_image "${img}" ; then echo "compose|docker|${svc}|$(postgresql_image_version "${img}")|${f}" ; return 0 ; fi
      [ -n "${want}" ] && { echo "The service ${want} of ${f} is not PostgreSQL (${img})." >&2 ; return 1 ; } ;
    done < <(postgresql_compose_services "${dir}/${f}") ;
    echo "${f} of ${PROJECT_NAME} has no PostgreSQL service${want:+ named ${want}}." >&2 ;
    return 1 ;
  done
  echo "${PROJECT_NAME} has no PostgreSQL: no DDEV config, no file of the Workspace's runtime layer, no compose file with a PostgreSQL service." >&2 ;
  return 1 ;
}

# A line of shell in the database's container: through `ddev exec` on DDEV and on the runtime layer (in /, which every
# image has), through `docker compose exec` for a compose file of the project's own.
function postgresql_in_db() {
  if [ "${POSTGRESQL_DB_VIA}" = compose ] ; then
    docker compose -f "${POSTGRESQL_DB_COMPOSE}" exec -T "${POSTGRESQL_DB_SERVICE}" sh -c "$1" ;
  else
    ddev exec -s "${POSTGRESQL_DB_SERVICE}" -d / "$1" ;
  fi
}

# SQL through psql in the database's container: no pager, no psqlrc, and the first error stops it. $1: psql's own
# flags (-A -t and a tab between columns for lines a program reads), $2: the SQL.
function postgresql_sql() {
  postgresql_in_db "${POSTGRESQL_DB_LOGIN} exec psql \"\$@\" -X -q -v ON_ERROR_STOP=1 -P pager=off $1 -c $(postgresql_q "$2")" ;
}

# Tab-separated lines with no header: what a program (the dashboard, a test) reads.
POSTGRESQL_DB_TSV='-A -t -F "$(printf "\t")"'

# Where this machine's clients reach the database.
function postgresql_connect_line() {
  local port="" ;
  case "${POSTGRESQL_DB_VIA}" in
    ddev)
      port="$(ddev describe -j 2> /dev/null | python3 -c 'import json,sys
try: print((json.load(sys.stdin)["raw"].get("dbinfo") or {}).get("published_port") or "")
except Exception: pass' 2> /dev/null)" ;
      if [ -n "${port}" ] ; then echo "A client on this machine: host 127.0.0.1, port ${port}, user db, password db, database db. The port changes when the project restarts." ;
      else echo "A client on this machine: start the project, and DDEV publishes the database on a port (ddev describe)." ; fi ;;
    compose)
      port="$(docker compose -f "${POSTGRESQL_DB_COMPOSE}" port "${POSTGRESQL_DB_SERVICE}" 5432 2> /dev/null | tail -1)" ;
      # An unpublished port is answered as ":0".
      if [[ "${port}" =~ :[1-9][0-9]*$ ]] ; then echo "A client on this machine: ${port}, with the user and password ${POSTGRESQL_DB_COMPOSE} gives the service ${POSTGRESQL_DB_SERVICE}." ;
      else echo "${POSTGRESQL_DB_COMPOSE} publishes no port of ${POSTGRESQL_DB_SERVICE}: in the project's network it is ${POSTGRESQL_DB_SERVICE}:5432." ; fi ;;
    *) echo "In the project's network: host db, port 5432. $(postgresql_runtime_title "${POSTGRESQL_DB_RUNTIME}") publishes no port of the database to this machine." ;;
  esac
}

# --info: what the database is and where it runs.
function postgresql_info() {
  echo "Project:   ${doc_name}/${PROJECT_NAME}" ;
  echo "Database:  PostgreSQL${POSTGRESQL_DB_VERSION:+ ${POSTGRESQL_DB_VERSION}} on $(postgresql_runtime_title "${POSTGRESQL_DB_RUNTIME}"), service ${POSTGRESQL_DB_SERVICE}${POSTGRESQL_DB_COMPOSE:+ of ${POSTGRESQL_DB_COMPOSE}}" ;
  postgresql_sql '' "SELECT current_setting('server_version') AS \"Server\", current_database() AS \"Database\", current_user AS \"User\", pg_encoding_to_char(encoding) AS \"Encoding\", datcollate AS \"Collation\", (SELECT count(*) FROM pg_stat_user_tables) AS \"Tables\", pg_size_pretty(pg_database_size(current_database())) AS \"Size\" FROM pg_database WHERE datname = current_database()" || return 1 ;
  postgresql_connect_line ;
  if [ "${POSTGRESQL_DB_VIA}" = ddev ] && [ -f .ddev/docker-compose.adminer.yaml ] ; then
    echo "Web admin: adminer is added ($(postgresql_admin_url adminer))." ;
  fi
  return 0 ;
}

# The tables, as PostgreSQL's statistics count them (an estimate), with their size: every schema but the system's,
# a table of another schema than public named with it.
POSTGRESQL_DB_TABLES="FROM pg_stat_user_tables ORDER BY pg_total_relation_size(relid) DESC, 1"
POSTGRESQL_DB_NAME="CASE WHEN schemaname = 'public' THEN relname ELSE schemaname || '.' || relname END"

# --tables: the tables, largest first. With --tsv: name, rows and bytes, separated by tabs.
function postgresql_tables() {
  if [ "${TSV}" = yes ] ; then
    postgresql_sql "${POSTGRESQL_DB_TSV}" "SELECT ${POSTGRESQL_DB_NAME}, n_live_tup, pg_total_relation_size(relid) ${POSTGRESQL_DB_TABLES}" ;
    return $? ;
  fi
  postgresql_sql '' "SELECT ${POSTGRESQL_DB_NAME} AS \"Table\", n_live_tup AS \"Rows (estimate)\", pg_size_pretty(pg_total_relation_size(relid)) AS \"Size\" ${POSTGRESQL_DB_TABLES}" || return 1 ;
  postgresql_sql '' "SELECT count(*) AS \"Tables\", pg_size_pretty(COALESCE(sum(pg_total_relation_size(relid)), 0)) AS \"In all\", pg_size_pretty(pg_database_size(current_database())) AS \"The database\" FROM pg_stat_user_tables" ;
}

# --running: what runs now in this database, longest first; the slowest statements when pg_stat_statements is loaded.
function postgresql_running() {
  local now has ;
  now="$(postgresql_sql "${POSTGRESQL_DB_TSV}" "SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND state IS DISTINCT FROM 'idle' AND backend_type = 'client backend' AND pid <> pg_backend_pid()")" || return 1 ;
  if [ "$(printf '%s' "${now}" | tr -dc '0-9')" = 0 ] ; then
    echo "No statement runs now, besides this one." ;
  else
    postgresql_sql '' "SELECT pid AS \"Pid\", usename AS \"User\", state AS \"State\", date_trunc('second', now() - query_start) AS \"Running for\", wait_event_type AS \"Waits on\", left(regexp_replace(query, '\\s+', ' ', 'g'), 160) AS \"Statement\" FROM pg_stat_activity WHERE datname = current_database() AND state IS DISTINCT FROM 'idle' AND backend_type = 'client backend' AND pid <> pg_backend_pid() ORDER BY query_start" || return 1 ;
  fi
  has="$(postgresql_sql "${POSTGRESQL_DB_TSV}" "SELECT to_regclass('pg_stat_statements') IS NOT NULL")" ;
  if [ "$(printf '%s' "${has}" | tr -dc 'tf')" = t ] ; then
    postgresql_sql '' "SELECT calls AS \"Calls\", round(mean_exec_time::numeric, 1) AS \"Mean ms\", round(total_exec_time::numeric) AS \"Total ms\", left(regexp_replace(query, '\\s+', ' ', 'g'), 120) AS \"Statement\" FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10" ;
  else
    echo "pg_stat_statements is not loaded, so the server keeps no list of its slow statements. Slow statements are logged after:" ;
    postgresql_sql '' "SELECT current_setting('log_min_duration_statement') AS \"log_min_duration_statement (-1: never)\"" ;
  fi
}

# This project's exports past the keep: setting go, the oldest first.
function postgresql_keep() {
  local keep="${plugin_postgresql_keep:-0}" dir="${backups}/${doc_name}" old ;
  [[ "${keep}" =~ ^[0-9]+$ ]] && [ "${keep}" -gt 0 ] || return 0 ;
  ls -1t "${dir}/${PROJECT_NAME}--postgresql--"*.sql.gz 2> /dev/null | tail -n +$(( keep + 1 )) | while read -r old ; do
    rm -f "${old:?}" && echo "Removed an older export (keep: ${keep}): $(basename "${old}")" ;
  done
}

# --export: a dump into the backups folder (or --file). $1: the file ('' for the backups folder), $2: what it is for.
function postgresql_export() {
  local file="$1" what="${2:-}" ;
  if [ -z "${file}" ] ; then
    mkdir -p "${backups}/${doc_name}" || return 1 ;
    file="${backups}/${doc_name}/${PROJECT_NAME}--postgresql--${what:+${what}--}$(date -u +%Y-%m-%d-%H-%M-%S).sql.gz" ;
  fi
  case "${file}" in *.sql.gz) ;; *) echo "An export is a .sql.gz file: ${file}" ; return 1 ;; esac
  echo "Exporting the PostgreSQL database of ${PROJECT_NAME} ($(postgresql_runtime_title "${POSTGRESQL_DB_RUNTIME}")) to ${file}" ;
  if [ "${POSTGRESQL_DB_VIA}" = compose ] ; then
    # Plain SQL that drops what it creates first, with no owner or grants of this server's roles in it.
    postgresql_in_db "${POSTGRESQL_DB_LOGIN} exec pg_dump \"\$@\" --clean --if-exists --no-owner --no-privileges" | gzip > "${file}" ;
    [ "${PIPESTATUS[0]}" -eq 0 ] || { rm -f "${file:?}" ; echo "The export failed." ; return 1 ; } ;
  else
    ddev export-db --file="${file}" || { rm -f "${file:?}" ; echo "The export failed." ; return 1 ; } ;
  fi
  # A dump with nothing in it is no export: a database that does not answer still leaves a few bytes of gzip.
  if [ -z "$(gunzip -c "${file}" 2> /dev/null | head -c 64 | tr -d '\0')" ] ; then
    rm -f "${file:?}" ;
    echo "The export is empty: is ${PROJECT_NAME} running?" ;
    return 1 ;
  fi
  echo "Exported: ${file} ($(du -h "${file}" | cut -f1))" ;
  postgresql_keep ;
}

# --import <file>: the database as it is, exported first; then emptied (dropped and made again, as DDEV's import-db
# does) and filled from the dump.
function postgresql_import() {
  local file="$1" ;
  case "${file}" in /*) ;; *) file="${current_path:-$PWD}/${file}" ;; esac
  [ -f "${file}" ] || { echo "No such file: ${file}" ; return 1 ; } ;
  case "${file}" in *.sql|*.sql.gz) ;; *) echo "A PostgreSQL dump is a .sql or .sql.gz file (pg_dump's plain format): ${file}" ; return 1 ;; esac
  if [ "${NO_SAFETY_EXPORT}" != yes ] ; then
    postgresql_export '' before-import || { echo "The export of the database as it is failed: nothing was imported." ; return 1 ; } ;
  fi
  echo "Importing $(basename "${file}") into the PostgreSQL database of ${PROJECT_NAME} ($(postgresql_runtime_title "${POSTGRESQL_DB_RUNTIME}"))" ;
  if [ "${POSTGRESQL_DB_VIA}" = ddev ] ; then
    ddev import-db --file="${file}" || return 1 ;
  else
    # From the server's own database: the connections to this one closed, the database dropped and made again, owned
    # by the user it was made for.
    postgresql_in_db "${POSTGRESQL_DB_LOGIN}"' psql -U "$u" -d postgres -X -q -v ON_ERROR_STOP=1 -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '"'"'$d'"'"' AND pid <> pg_backend_pid()" -c "DROP DATABASE IF EXISTS \"$d\"" -c "CREATE DATABASE \"$d\" OWNER \"$u\"" > /dev/null' || { echo "The database could not be emptied: nothing was imported." ; return 1 ; } ;
    if [ "${POSTGRESQL_DB_VIA}" = compose ] ; then
      case "${file}" in *.gz) gunzip -c "${file}" ;; *) cat "${file}" ;; esac | postgresql_in_db "${POSTGRESQL_DB_LOGIN} exec psql \"\$@\" -X -q -v ON_ERROR_STOP=1" > /dev/null || return 1 ;
    else
      ddev import-db --file="${file}" || return 1 ;
    fi
  fi
  echo "Imported $(basename "${file}")." ;
  [ "${NO_SAFETY_EXPORT}" != yes ] && echo "The database as it was is the before-import export above, in ${backups}/${doc_name}." ;
  return 0 ;
}

# A command with a terminal of its own, when its input is a terminal and its output is not: a screen session of the
# dashboard logs what a command prints through a pipe, and a client with no terminal shows no prompt. util-linux's
# script gives it one; anywhere else the command runs as it is.
function postgresql_with_terminal() {
  if [ -t 0 ] && [ ! -t 1 ] && script --version 2> /dev/null | grep -q util-linux ; then
    script -qefc "$(printf '%q ' "$@")" /dev/null ;
  else
    "$@" ;
  fi
}

# --console: psql on the database, in this terminal.
function postgresql_console() {
  case "${POSTGRESQL_DB_VIA}" in
    ddev) postgresql_with_terminal ddev psql ;;
    compose)
      if [ -t 0 ] ; then postgresql_with_terminal docker compose -f "${POSTGRESQL_DB_COMPOSE}" exec "${POSTGRESQL_DB_SERVICE}" sh -c "${POSTGRESQL_DB_LOGIN} exec psql \"\$@\"" ;
      else postgresql_in_db "${POSTGRESQL_DB_LOGIN} exec psql \"\$@\" -X -P pager=off" ; fi ;;
    *)
      echo "PostgreSQL${POSTGRESQL_DB_VERSION:+ ${POSTGRESQL_DB_VERSION}} of ${PROJECT_NAME} on $(postgresql_runtime_title "${POSTGRESQL_DB_RUNTIME}"). The runtime gives psql no terminal of its own, so it shows no prompt: type a statement ending with ; and Enter, and Ctrl-D leaves." ;
      postgresql_in_db "${POSTGRESQL_DB_LOGIN} exec psql \"\$@\" -X -P pager=off" ;;
  esac
}

# The address of a web admin DDEV added to the project, from DDEV itself.
function postgresql_admin_url() {
  ddev describe -j 2> /dev/null | python3 -c 'import json,sys
try:
  s = json.load(sys.stdin)["raw"]["services"].get(sys.argv[1]) or {}
  print(s.get("https_url") or s.get("http_url") or "no address: start the project")
except Exception: print("no address: start the project")' "$1" ;
}

# The Adminer image the add-on's last release for an older DDEV logs in with. That release fills Adminer 4's login
# itself, and its image tag (standalone) is Adminer 6 now, which shows the login form instead: the project's
# .ddev/.env names Adminer 4 (the add-on reads ADMINER_DOCKER_IMAGE), as long as the add-on is there. Adminer 4's
# PostgreSQL driver reads PostgreSQL 16 and 17 (it asks pg_class and information_schema, nothing they dropped).
POSTGRESQL_DB_ADMINER_PIN='ADMINER_DOCKER_IMAGE=adminer:4.8.1-standalone'

# --admin adminer: the official add-on in the project, the project restarted, and the address. For a DDEV older than
# 1.24.10 (what the add-on's newest releases ask for), its last release for it.
function postgresql_admin_add() {
  local tool="$1" repo='ddev/ddev-adminer' pin='v1.1.4' v ;
  if [ "${POSTGRESQL_DB_VIA}" != ddev ] ; then
    echo "A web admin is a service of its own beside the project: on $( [ "${POSTGRESQL_DB_VIA}" = compose ] && echo "a compose file of the project's own" || postgresql_runtime_title "${POSTGRESQL_DB_RUNTIME}") the Workspace cannot add one yet (on DDEV it is the official add-on ${repo})." ;
    return 1 ;
  fi
  if [ -f ".ddev/docker-compose.${tool}.yaml" ] ; then
    echo "Adminer is already added to ${PROJECT_NAME}." ;
  else
    v="$(ddev --version 2> /dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)" ;
    if [ -n "${v}" ] && [ "$(printf '%s\n' "${v}" 1.24.10 | sort -V | head -1)" != 1.24.10 ] ; then
      echo "DDEV ${v}: ${repo} ${pin}, its last release for a DDEV older than 1.24.10." ;
      ddev add-on get "${repo}" --version "${pin}" || return 1 ;
      if ! grep -q '^ADMINER_DOCKER_IMAGE=' .ddev/.env 2> /dev/null ; then
        echo "${POSTGRESQL_DB_ADMINER_PIN}" >> .ddev/.env && echo "Adminer 4 in .ddev/.env (${POSTGRESQL_DB_ADMINER_PIN}): the login that release fills in is Adminer 4's." ;
      fi
    else
      ddev add-on get "${repo}" || return 1 ;
    fi
    echo "Restarting ${PROJECT_NAME}, so Adminer runs beside it." ;
    ddev restart || return 1 ;
  fi
  echo "Adminer: $(postgresql_admin_url "${tool}")" ;
}

# --admin-remove adminer: the add-on out of the project, and the project restarted.
function postgresql_admin_remove() {
  local tool="$1" ;
  [ "${POSTGRESQL_DB_VIA}" = ddev ] || { echo "Only a DDEV project carries a web admin add-on." ; return 1 ; } ;
  [ -f ".ddev/docker-compose.${tool}.yaml" ] || { echo "Adminer is not added to ${PROJECT_NAME}." ; return 0 ; } ;
  ddev add-on remove "${tool}" || return 1 ;
  if [ -f .ddev/.env ] ; then
    sed -i "/^${POSTGRESQL_DB_ADMINER_PIN//./\\.}\$/d" .ddev/.env ;
    [ -s .ddev/.env ] || rm -f .ddev/.env ;
  fi
  echo "Restarting ${PROJECT_NAME} without Adminer." ;
  ddev restart ;
}

# The tool: one action on the PostgreSQL database of a project of this workspace folder.
function postgresql_tool() {
  declare -f trim_project_name > /dev/null && trim_project_name ;
  local dir="${WORKSPACE_ROOT}/${doc_name}/${PROJECT_NAME}" where ;
  [ -d "${dir}" ] || { echo "No such project: ${doc_name}/${PROJECT_NAME}" ; return 1 ; } ;
  dir="$(cd "${dir}" && pwd)" ;
  where="$(postgresql_locate "${dir}" "${SERVICE:-}")" || return 1 ;
  IFS='|' read -r POSTGRESQL_DB_VIA POSTGRESQL_DB_RUNTIME POSTGRESQL_DB_SERVICE POSTGRESQL_DB_VERSION POSTGRESQL_DB_COMPOSE <<< "${where}" ;
  cd "${dir}" || return 1 ;
  # A local kind cluster's CLI is often in ~/.local/bin, which a session started by the dashboard may not have.
  case ":${PATH}:" in *":${HOME}/.local/bin:"*) ;; *) [ -d "${HOME}/.local/bin" ] && PATH="${PATH}:${HOME}/.local/bin" ;; esac
  if [ "${CONSOLE}" = yes ] ; then postgresql_console ;
  elif [ "${TABLES}" = yes ] ; then postgresql_tables ;
  elif [ "${RUNNING}" = yes ] ; then postgresql_running ;
  elif [ "${EXPORT}" = yes ] ; then postgresql_export "$( [ "${FILE:-_none_}" = '_none_' ] || echo "${FILE}" )" ;
  elif [ "${IMPORT:-_none_}" != '_none_' ] ; then postgresql_import "${IMPORT}" ;
  elif [ "${QUERY:-_none_}" != '_none_' ] ; then postgresql_sql '' "${QUERY}" ;
  elif [ "${ADMIN:-_none_}" != '_none_' ] ; then postgresql_admin_add "${ADMIN}" ;
  elif [ "${ADMIN_REMOVE:-_none_}" != '_none_' ] ; then postgresql_admin_remove "${ADMIN_REMOVE}" ;
  else postgresql_info ; fi
}
