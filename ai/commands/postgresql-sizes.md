---
description: The PostgreSQL database of a Webship Workspace project — its size and its largest tables, with cmd-tools-postgresql.sh. Reads only.
argument-hint: <folder> <project>
---

# /postgresql-sizes

How big is the PostgreSQL database of a project of a Webship Workspace (container-based, DDEV by default), and which
of its tables take the room. The PostgreSQL plugin (`@webship.co/workspace-postgresql`) placed the tool used here in
the project's workspace folder; it reads the database on whatever runtime the project is on.

The first word is the workspace folder (`dev`, `test`, `sandboxes`, …), the second the project: $ARGUMENTS

```bash
cd ~/workspace/<folder>
bash cmd-tools-postgresql.sh <project> --info       # the version, runtime, size and number of tables
bash cmd-tools-postgresql.sh <project> --tables     # the tables, largest first
```

Then say, in a few lines:

- the PostgreSQL version and where it runs (the runtime, the service);
- the whole size of the database and the number of tables;
- the five largest tables, with their size (indexes and TOAST in it) and rows (an estimate), and which of them hold
  caches, logs or sessions that can be emptied by the site itself;
- when the tool answers that the project is stopped, has another engine or has no database: that, and nothing more.

Change nothing: no export, no import, no `--query` that writes.
