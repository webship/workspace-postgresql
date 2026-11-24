/**
 * PostgreSQL for Webship Workspace.
 *
 * The DATABASE menu on every project whose database is PostgreSQL: psql in a screen, tables and sizes, an export into
 * the backups folder, an import of a dump that folder holds, the statements running now, the connection details, and
 * Adminer on DDEV. All of it is the database family's surface
 * (@webship.co/workspace-database); this package is PostgreSQL's engine, its tool (cmd-tools-postgresql.sh, placed into
 * the sites folders) and its AI items.
 */

import type { PluginApi } from '@webship.co/workspace-plugin-api';
import { registerDatabase } from '@webship.co/workspace-database';

import { postgresqlEngine } from './lib/engine';

export { postgresqlEngine };

/** The AI items the installer places: agents in ai-agents/, skills in ai-skills/, commands in ai-commands/, prompts in ai-prompts/. */
export const AGENTS: string[] = ['postgresql-helper'];
export const SKILLS: string[] = ['postgresql-database'];
export const AI_COMMANDS: string[] = ['postgresql-sizes'];
export const PROMPTS: string[] = ['postgresql-dump-and-check'];

export function register(api: PluginApi): void {
  registerDatabase(api, postgresqlEngine);
}
