Export the PostgreSQL database of a Webship Workspace project into the backups folder, and check that the dump is whole.

```
claude --permission-mode bypassPermissions """
# A Webship Workspace, container-based (DDEV by default), at ~/workspace/<folder>: the project <project>.
# The PostgreSQL plugin placed cmd-tools-postgresql.sh in that folder: every step below is that tool or a read of its dump.

1. Run `bash cmd-tools-postgresql.sh <project> --info` and say the PostgreSQL version, the runtime and the size.
   Stop there if it answers that the project is stopped, has another engine or has no database.
2. Run `bash cmd-tools-postgresql.sh <project> --tables` and keep the number of tables.
3. Run `bash cmd-tools-postgresql.sh <project> --export`, and take the path of the dump from what it prints.
4. Check the dump: `gunzip -t <file>`, then count `^CREATE TABLE` in `gunzip -c <file>` (the same number as step 2),
   and find the line "PostgreSQL database dump" at its start.
5. Say where the dump is, its size, and whether each check passed. Import nothing, change nothing else.
"""
```

The text between the triple quotes is plain: it can be given to another AI command-line assistant as it is.
