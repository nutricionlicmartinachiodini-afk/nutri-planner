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

    CREATE TABLE IF NOT EXISTS meal_configs (
      patient_id TEXT PRIMARY KEY REFERENCES patients(id) ON DELETE CASCADE,
      unify_breakfast_snack_override BOOLEAN,
      unify_lunch_dinner_override BOOLEAN,
      lunch_has_carbs BOOLEAN,
      dinner_has_carbs BOOLEAN,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS weekly_menus (
      patient_id TEXT PRIMARY KEY REFERENCES patients(id) ON DELETE CASCADE,
      days_count INTEGER NOT NULL DEFAULT 5,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS weekly_menu_cells (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      day INTEGER NOT NULL,
      meal_type TEXT NOT NULL,
      free_text TEXT NOT NULL DEFAULT '',
      selected_option_number INTEGER,
      recipe_id TEXT,
      UNIQUE(patient_id, day, meal_type)
    );

    CREATE INDEX IF NOT EXISTS idx_weekly_menu_cells_patient ON weekly_menu_cells(patient_id);

    -- Nombre "lindo" de cada opcion de Desayuno/Merienda (ej. "Infusion con
    -- leche + tostada con queso y fruta") para reemplazar el generico
    -- "Opcion N" en el menu semanal. Si no hay fila para una opcion, se usa
    -- el nombre automatico armado con los alimentos (nunca queda sin nombre).
    CREATE TABLE IF NOT EXISTS meal_option_labels (
      patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      meal_type TEXT NOT NULL,
      option_number INTEGER NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      PRIMARY KEY (patient_id, meal_type, option_number)
    );
  `);

  // Migracion para bases ya existentes: weekly_menu_cells se creo en un
  // deploy anterior sin esta columna. "CREATE TABLE IF NOT EXISTS" no toca
  // tablas que ya existen, asi que las columnas nuevas necesitan su propio
  // ALTER TABLE ... ADD COLUMN IF NOT EXISTS (tambien idempotente).
  await pool.query(`
    ALTER TABLE weekly_menu_cells ADD COLUMN IF NOT EXISTS selected_option_number INTEGER;
  `);

  // Un ingrediente de receta puede ser "fijo" (food_id + cantidad tal cual
  // los escribio Martina) o "segun el plan" (meal_category_role: hidratos/
  // proteinas/grasas/vegetales) - en ese caso food_id/cantidad quedan null y
  // se resuelven en el momento contra el Almuerzo/Cena calculado de cada
  // paciente. Por eso estas columnas necesitan poder ser null.
  await pool.query(`
    ALTER TABLE recipe_ingredients ADD COLUMN IF NOT EXISTS meal_category_role TEXT;
    ALTER TABLE recipe_ingredients ALTER COLUMN food_id DROP NOT NULL;
    ALTER TABLE recipe_ingredients ALTER COLUMN food_name_snapshot DROP NOT NULL;
    ALTER TABLE recipe_ingredients ALTER COLUMN raw_quantity DROP NOT NULL;
    ALTER TABLE recipe_ingredients ALTER COLUMN unit DROP NOT NULL;
  `);

  // Biblioteca de recetas: independiente de cada paciente (se reutiliza entre
  // todos), a diferencia de las "Opciones" de Desayuno/Merienda que salen del
  // Excel de cada paciente. Las cantidades de los ingredientes son de
  // referencia/receta - las cantidades reales del plan de cada paciente
  // siguen saliendo del calculo de Almuerzo/Cena de su propio Excel.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS recipes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      servings INTEGER NOT NULL DEFAULT 1,
      prep_time_min INTEGER,
      instructions TEXT NOT NULL DEFAULT '',
      tags JSONB NOT NULL DEFAULT '[]',
      notes TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'activo',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_recipes_category ON recipes(category);

    CREATE TABLE IF NOT EXISTS recipe_ingredients (
      id TEXT PRIMARY KEY,
      recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      food_id TEXT NOT NULL,
      food_name_snapshot TEXT NOT NULL,
      raw_quantity DOUBLE PRECISION NOT NULL,
      cooked_quantity DOUBLE PRECISION,
      unit TEXT NOT NULL,
      notes TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id);
  `);

  schemaEnsured = true;
}
