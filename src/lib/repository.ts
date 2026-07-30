import { v4 as uuidv4 } from "uuid";
import { getPool, ensureSchema } from "./db";
import { Food, ImportWarning, MealOption, Patient, PlanDraft } from "@/domain/types";

/**
 * Capa de acceso a datos. Traduce entre el modelo de dominio (src/domain/types.ts)
 * y las tablas de Postgres. Nada de logica de negocio aca: eso vive en el
 * dominio y en el excel-adapter.
 */

export interface PatientSummary {
  id: string;
  firstName: string;
  lastName: string;
  consultDate: string;
  createdAt: string;
}

export interface PatientFull {
  patient: Patient;
  mealOptions: MealOption[];
  warnings: ImportWarning[];
}

/** Inserta o actualiza el catalogo de alimentos. Se llama en cada importacion
 * confirmada: el catalogo de "Base de datos" es compartido entre pacientes,
 * asi que la version mas reciente pisa a la anterior fila por fila (por id
 * estable), sin borrar alimentos que no vinieron en este Excel. */
export async function upsertFoods(foods: Food[]): Promise<void> {
  await ensureSchema();
  if (foods.length === 0) return;
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const f of foods) {
      await client.query(
        `INSERT INTO foods (
          id, name, alternative_names, category, base_quantity, base_unit,
          kcal_per_unit, carbs_per_unit, protein_per_unit, fat_per_unit,
          cooking_factor, homemade_measure_unit, homemade_measure_grams,
          homemade_measure_base, size_small_g, size_medium_g, size_large_g,
          data_status, source_row_ref, brand, link, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21, now())
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          alternative_names = EXCLUDED.alternative_names,
          category = EXCLUDED.category,
          base_quantity = EXCLUDED.base_quantity,
          base_unit = EXCLUDED.base_unit,
          kcal_per_unit = EXCLUDED.kcal_per_unit,
          carbs_per_unit = EXCLUDED.carbs_per_unit,
          protein_per_unit = EXCLUDED.protein_per_unit,
          fat_per_unit = EXCLUDED.fat_per_unit,
          cooking_factor = EXCLUDED.cooking_factor,
          homemade_measure_unit = EXCLUDED.homemade_measure_unit,
          homemade_measure_grams = EXCLUDED.homemade_measure_grams,
          homemade_measure_base = EXCLUDED.homemade_measure_base,
          size_small_g = EXCLUDED.size_small_g,
          size_medium_g = EXCLUDED.size_medium_g,
          size_large_g = EXCLUDED.size_large_g,
          data_status = EXCLUDED.data_status,
          source_row_ref = EXCLUDED.source_row_ref,
          brand = EXCLUDED.brand,
          link = EXCLUDED.link,
          updated_at = now()
        `,
        [
          f.id, f.name, JSON.stringify(f.alternativeNames), f.category, f.baseQuantity, f.baseUnit,
          f.kcalPerUnit, f.carbsPerUnit, f.proteinPerUnit, f.fatPerUnit,
          f.cookingFactor, f.homemadeMeasureUnit, f.homemadeMeasureGrams,
          f.homemadeMeasureBase, f.sizeSmallG, f.sizeMediumG, f.sizeLargeG,
          f.dataStatus, f.sourceRowRef, f.brand ?? null, f.link ?? null,
        ]
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** Persiste una importacion confirmada: paciente + sus opciones de comida +
 * las advertencias que quedaron (para poder auditarlas despues). Devuelve el
 * id definitivo del paciente creado. */
export async function confirmImport(
  draft: PlanDraft,
  resolvedWarningIds: string[]
): Promise<string> {
  await ensureSchema();
  await upsertFoods(draft.foods);

  const p = draft.patient;
  if (
    !p.firstName || !p.lastName || !p.sex || !p.consultDate ||
    p.height == null || p.weight == null || !p.activityLevel ||
    p.activityFactor == null || !p.goal
  ) {
    throw new Error(
      "Faltan datos obligatorios del paciente (nombre, apellido, sexo, fecha de consulta, talla, peso, nivel de actividad u objetivo). No se puede confirmar la importacion."
    );
  }

  const patientId = uuidv4();
  const foodNameById = new Map(draft.foods.map((f) => [f.id, f.name]));
  const resolvedSet = new Set(resolvedWarningIds);

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO patients (
        id, import_id, first_name, last_name, dni, birth_date, sex, consult_date,
        height, weight, activity_level, activity_factor, goal, objectives_text, indications_text
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        patientId, draft.importId, p.firstName, p.lastName, p.dni ?? null, p.birthDate ?? null,
        p.sex, p.consultDate, p.height, p.weight, p.activityLevel, p.activityFactor, p.goal,
        p.objectivesText ?? "", p.indicationsText ?? "",
      ]
    );

    for (const o of draft.mealOptions) {
      await client.query(
        `INSERT INTO meal_options (
          id, patient_id, meal_type, option_number, category, food_id, food_name_snapshot,
          quantity, unit, cooked_quantity, homemade_measure_text,
          computed_kcal, computed_carbs, computed_protein, computed_fat
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [
          uuidv4(), patientId, o.mealType, o.optionNumber, o.category, o.foodId,
          foodNameById.get(o.foodId) ?? o.foodId,
          o.quantity, o.unit, o.cookedQuantity, o.homemadeMeasureText,
          o.computedKcal, o.computedCarbs, o.computedProtein, o.computedFat,
        ]
      );
    }

    for (const w of draft.warnings) {
      await client.query(
        `INSERT INTO import_warnings (id, patient_id, import_id, severity, sheet, cell_ref, message, resolved)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [uuidv4(), patientId, draft.importId, w.severity, w.sheet, w.cellRef ?? null, w.message, resolvedSet.has(w.id)]
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return patientId;
}

export async function listPatients(): Promise<PatientSummary[]> {
  await ensureSchema();
  const rows = await getPool().query<{
    id: string; first_name: string; last_name: string; consult_date: string; created_at: string;
  }>(`SELECT id, first_name, last_name, consult_date, created_at FROM patients ORDER BY created_at DESC`);
  return rows.rows.map((r) => ({
    id: r.id,
    firstName: r.first_name,
    lastName: r.last_name,
    consultDate: r.consult_date,
    createdAt: r.created_at,
  }));
}

export async function getPatientFull(id: string): Promise<PatientFull | null> {
  await ensureSchema();
  const pool = getPool();

  const patientRes = await pool.query(`SELECT * FROM patients WHERE id = $1`, [id]);
  const row = patientRes.rows[0];
  if (!row) return null;

  const patient: Patient = {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    dni: row.dni ?? undefined,
    birthDate: row.birth_date ?? undefined,
    sex: row.sex,
    consultDate: row.consult_date,
    height: row.height,
    weight: row.weight,
    activityLevel: row.activity_level,
    activityFactor: row.activity_factor,
    goal: row.goal,
    objectivesText: row.objectives_text,
    indicationsText: row.indications_text,
  };

  const mealRes = await pool.query(`SELECT * FROM meal_options WHERE patient_id = $1`, [id]);
  const mealOptions: MealOption[] = mealRes.rows.map((m) => ({
    id: m.id,
    patientId: id,
    mealType: m.meal_type,
    optionNumber: m.option_number,
    category: m.category,
    foodId: m.food_id,
    quantity: m.quantity,
    unit: m.unit,
    cookedQuantity: m.cooked_quantity,
    homemadeMeasureText: m.homemade_measure_text,
    computedKcal: m.computed_kcal,
    computedCarbs: m.computed_carbs,
    computedProtein: m.computed_protein,
    computedFat: m.computed_fat,
  }));

  const warnRes = await pool.query(`SELECT * FROM import_warnings WHERE patient_id = $1`, [id]);
  const warnings: ImportWarning[] = warnRes.rows.map((w) => ({
    id: w.id,
    importId: w.import_id,
    severity: w.severity,
    sheet: w.sheet,
    cellRef: w.cell_ref ?? undefined,
    message: w.message,
    resolved: w.resolved,
  }));

  return { patient, mealOptions, warnings };
}

export type PatientEditableFields = Pick<
  Patient,
  | "firstName" | "lastName" | "dni" | "birthDate" | "sex" | "consultDate"
  | "height" | "weight" | "activityLevel" | "activityFactor" | "goal"
  | "objectivesText" | "indicationsText"
>;

export async function updatePatient(id: string, fields: PatientEditableFields): Promise<void> {
  await ensureSchema();
  await getPool().query(
    `UPDATE patients SET
      first_name = $2, last_name = $3, dni = $4, birth_date = $5, sex = $6,
      consult_date = $7, height = $8, weight = $9, activity_level = $10,
      activity_factor = $11, goal = $12, objectives_text = $13, indications_text = $14,
      updated_at = now()
     WHERE id = $1`,
    [
      id, fields.firstName, fields.lastName, fields.dni ?? null, fields.birthDate ?? null, fields.sex,
      fields.consultDate, fields.height, fields.weight, fields.activityLevel,
      fields.activityFactor, fields.goal, fields.objectivesText, fields.indicationsText,
    ]
  );
}
