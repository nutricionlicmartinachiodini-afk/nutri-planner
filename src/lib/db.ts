import { Pool, type QueryResultRow } from "pg";

/**
 * Conexion a la base de datos (Postgres serverless via Neon, integrado a
 * traves de Vercel). Se usa la variable pooled (POSTGRES_URL) porque las
 * funciones de Next.js corren en entorno serverless: cada invocacion puede
 * abrir su propia conexion y el pooler de Neon (PgBouncer) absorbe eso mejor
 * que una conexion directa.
 *
 * `globalThis` se usa para reutilizar el pool entre invocaciones "calientes"
 * de la misma instancia de funcion, evitando abrir un pool nuevo en cada
 * request.
 */

declare global {
  // eslint-disable-next-line no-var
  var __nutriPlannerPool: Pool | undefined;
}

function createPool(): Pool {
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error(
      "Falta la variable de entorno POSTGRES_URL. Verifica que la base de datos este conectada al proyecto en Vercel (Storage)."
    );
  }
  return new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 5,
  });
}

export function getPool(): Pool {
  if (!global.__nutriPlannerPool) {
    global.__nutriPlannerPool = createPool();
  }
  return global.__nutriPlannerPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const pool = getPool();
  const res = await pool.query<T>(text, params);
  return res.rows;
}

let schemaEnsured = false;

/**
 * Crea las tablas si todavia no existen. Se llama al principio de cada
 * endpoint que toca la base de datos: es idempotente (CREATE TABLE IF NOT
 * EXISTS) y de bajo costo, asi que no hace falta un paso de migracion
 * separado que Martina tendria que ejecutar a mano.
 */
export async function ensureSchema(): Promise<void> {
  if (schemaEnsured) return;
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS foods (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      alternative_names JSONB NOT NULL DEFAULT '[]',
      category TEXT NOT NULL,
      base_quantity DOUBLE PRECISION NOT NULL,
      base_unit TEXT NOT NULL,
      kcal_per_unit DOUBLE PRECISION NOT NULL,
      carbs_per_unit DOUBLE PRECISION NOT NULL,
      protein_per_unit DOUBLE PRECISION NOT NULL,
      fat_per_unit DOUBLE PRECISION NOT NULL,
      cooking_factor DOUBLE PRECISION,
      homemade_measure_unit TEXT,
      homemade_measure_grams DOUBLE PRECISION,
      homemade_measure_base TEXT,
      size_small_g DOUBLE PRECISION,
      size_medium_g DOUBLE PRECISION,
      size_large_g DOUBLE PRECISION,
      data_status TEXT NOT NULL,
      source_row_ref TEXT NOT NULL,
      brand TEXT,
      link TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS patients (
      id TEXT PRIMARY KEY,
      import_id TEXT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      dni TEXT,
      birth_date TEXT,
      sex TEXT NOT NULL,
      consult_date TEXT NOT NULL,
      height DOUBLE PRECISION NOT NULL,
      weight DOUBLE PRECISION NOT NULL,
      activity_level TEXT NOT NULL,
      activity_factor DOUBLE PRECISION NOT NULL,
      goal TEXT NOT NULL,
      objectives_text TEXT NOT NULL DEFAULT '',
      indications_text TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS meal_options (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      meal_type TEXT NOT NULL,
      option_number INTEGER,
      category TEXT,
      food_id TEXT NOT NULL,
      food_name_snapshot TEXT NOT NULL,
      quantity DOUBLE PRECISION NOT NULL,
      unit TEXT NOT NULL,
      cooked_quantity DOUBLE PRECISION,
      homemade_measure_text TEXT,
      computed_kcal DOUBLE PRECISION NOT NULL,
      computed_carbs DOUBLE PRECISION NOT NULL,
      computed_protein DOUBLE PRECISION NOT NULL,
      computed_fat DOUBLE PRECISION NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_meal_options_patient ON meal_options(patient_id);

    CREATE TABLE IF NOT EXISTS import_warnings (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      import_id TEXT NOT NULL,
      severity TEXT NOT NULL,
      sheet TEXT NOT NULL,
      cell_ref TEXT,
      message TEXT NOT NULL,
      resolved BOOLEAN NOT NULL DEFAULT false
    );

    CREATE INDEX IF NOT EXISTS idx_warnings_patient ON import_warnings(patient_id);
  `);
  schemaEnsured = true;
}
