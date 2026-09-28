/**
 * Aplica las migraciones de supabase/migrations/ en orden.
 *
 *   node scripts/db-apply.mjs              # aplica pendientes
 *   node scripts/db-apply.mjs --status     # solo muestra el estado
 *
 * Dos vias de autenticacion (usa la que tengas):
 *
 *   A) Management API (RECOMENDADA, no necesita contrasena de la BD)
 *      $env:SB_ACCESS_TOKEN = 'sbp_...'
 *
 *   B) Conexion directa a Postgres por el pooler (us-east-1, IPv4)
 *      $env:SB_DB_PASSWORD = '...'
 *
 * Nunca se escribe la credencial en disco: se lee siempre del entorno.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const REF = process.env.SB_PROJECT_REF || 'ulhrsfwvjmvlagtqglcx';
const ACCESS_TOKEN = process.env.SB_ACCESS_TOKEN;
const DB_PASSWORD = process.env.SB_DB_PASSWORD;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS = join(ROOT, 'supabase', 'migrations');

const REGIONS = [
  'us-east-1', 'us-west-2', 'us-west-1', 'ca-central-1', 'sa-east-1',
  'eu-central-1', 'eu-west-1', 'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1',
];

if (!ACCESS_TOKEN && !DB_PASSWORD) {
  console.error('Falta SB_ACCESS_TOKEN o SB_DB_PASSWORD en el entorno.');
  process.exit(1);
}

/**
 * Ejecuta SQL y devuelve un array de filas.
 * Toda la migracion va en un solo viaje: si algo falla, no queda a medias.
 */
async function makeRunner() {
  if (ACCESS_TOKEN) {
    const run = async (sql) => {
      const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: sql }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Management API ${res.status}: ${body.slice(0, 600)}`);
      }
      const json = await res.json();
      return Array.isArray(json) ? json : [];
    };
    await run('select 1');
    return { run, label: `Management API (project ${REF})` };
  }

  // Via B: pooler de Postgres
  const { Client } = await import('pg');
  let client = null;
  for (const region of REGIONS) {
    for (const port of [5432, 6543]) {
      const c = new Client({
        host: `aws-0-${region}.pooler.supabase.com`,
        port,
        database: 'postgres',
        user: port === 6543 ? `postgres.${REF}` : `postgres.${REF}`,
        password: DB_PASSWORD,
        connectionTimeoutMillis: 8000,
        ssl: { rejectUnauthorized: false },
      });
      try {
        await c.connect();
        client = c;
        return {
          label: `Postgres ${region}:${port}`,
          run: async (sql) => (await client.query(sql)).rows,
        };
      } catch {
        try { await c.end(); } catch { /* ya cerrada */ }
      }
    }
  }
  throw new Error('No se pudo conectar por el pooler. Revisa SB_DB_PASSWORD.');
}

const BOOTSTRAP = `
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text primary key,
  statements text[],
  name text
);
`;

function migrationFiles() {
  return readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();
}

const { run, label } = await makeRunner();
await run(BOOTSTRAP);

const files = migrationFiles();
const done = new Set(
  (await run('select version from supabase_migrations.schema_migrations'))
    .map((r) => r.version),
);
const pending = files.filter((f) => !done.has(f.split('_')[0]));

console.log(`\nProyecto: ${REF} | Conexion: ${label}`);
console.log(`Migraciones: ${files.length} | aplicadas: ${files.length - pending.length} | pendientes: ${pending.length}\n`);

if (process.argv.includes('--status')) {
  for (const f of files) {
    console.log(`  ${done.has(f.split('_')[0]) ? '[aplicada] ' : '[pendiente]'} ${f}`);
  }
  process.exit(0);
}

for (const file of pending) {
  const version = file.split('_')[0];
  const name = file.replace(/^\d+_/, '').replace(/\.sql$/, '');
  const sql = readFileSync(join(MIGRATIONS, file), 'utf8');
  console.log(`Aplicando ${file} ...`);
  try {
    // La migracion y su registro van juntos en el mismo viaje.
    await run(`${sql}\n\ninsert into supabase_migrations.schema_migrations (version, name) values ('${version}', '${name}') on conflict (version) do nothing;`);
    console.log('  OK\n');
  } catch (e) {
    console.error(`  FALLO en ${file}:\n${e.message}\n`);
    process.exit(1);
  }
}

console.log(pending.length ? `Aplicadas: ${pending.length}\n` : 'No hay migraciones pendientes.\n');
