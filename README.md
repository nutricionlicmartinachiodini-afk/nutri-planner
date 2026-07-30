# nutri-planner — Etapa 1 (primer avance)

Automatiza la creación de planes nutricionales a partir del Excel de Martina.
Este avance de la Etapa 1 incluye: **modelo de datos + importador del Excel
con motor de validaciones**, probado de punta a punta contra el archivo real
(`Sistema_Nutricional_CORREGIDO.xlsx`), y las pantallas de **Importar +
Revisión** en Next.js. Todavía no hay persistencia en base de datos ni el
resto de las pantallas (ficha del paciente, configuración de comidas, menú
semanal, vista previa, exportar PDF) — eso es el siguiente paso.

## Qué hay implementado

- `src/domain/types.ts` — el modelo de datos completo acordado (Food, Patient,
  MealOption, MealConfig, WeeklyMenu, Recipe/RecipeIngredient, PlanDocument,
  ImportWarning), con los 4 estados de alimento (`completo` / `a_verificar` /
  `incompleto` / `inactivo`) y el ID interno estable por alimento.
- `src/excel-adapter/` — un parser por hoja:
  - `baseDeDatosParser.ts` — catálogo de alimentos (27 filas reales), genera
    el `id` interno, mapea "Estado dato" a los 4 estados.
  - `anamnesisParser.ts` — datos del paciente, con las 5 validaciones
    bloqueantes de campos obligatorios.
  - `referenciaParser.ts` — niveles de actividad física.
  - `desayunoMeriendaParser.ts` — lee las 6 opciones de Desayuno y Merienda
    anclando por texto ("OPCIÓN N" / "Alimento" / "TOTAL:"), no por número de
    fila fijo. Compara Merienda contra su opción equivalente de Desayuno y
    avisa si difieren (nunca corrige solo).
  - `almuerzoCenaParser.ts` — lee Almuerzo/Cena agrupando por categoría
    (hidratos/proteínas/grasas/vegetales), incluyendo peso cocido y medida
    casera cuando el alimento los tiene cargados (nunca los inventa).
  - `importExcel.ts` — junta todo en un `PlanDraft` + lista de
    `ImportWarning` (bloqueante / advertencia / info).

## Cómo probarlo

### 1) Importador por linea de comandos (sin levantar el sitio)

```bash
npm install
npm run test:import "ruta/a/tu/Sistema_Nutricional_CORREGIDO.xlsx"
```

### 2) Sitio Next.js (pantallas Importar + Revision)

```bash
npm install
npm run dev
```

Abrir http://localhost:3000, ir a "Importar Excel", subir el .xlsx y ver la
pantalla de Revision: datos de paciente encontrados, catalogo, opciones de
comida, y las advertencias agrupadas por severidad (bloqueante / advertencia
/ info). El boton "Confirmar importacion" queda deshabilitado mientras haya
alguna advertencia bloqueante sin marcar como revisada — asi se cumple la
regla de "nunca completar silenciosamente".

Nota: en esta version el flujo de importar + revisar vive en una sola
pantalla y todo el estado es en memoria del navegador (no hay base de
datos todavia). Al conectar Postgres, "Confirmar importacion" va a persistir
el Patient + los MealOption reales en vez de solo mostrar un mensaje.


Esto corre el importador contra un Excel real y muestra en consola: los
datos de paciente encontrados, el catálogo de alimentos, las opciones de
comida importadas y **todas** las advertencias con su severidad — es
exactamente lo que va a alimentar la futura pantalla de Revisión.

## Resultado de la prueba contra el Excel real (con las 20 fórmulas ya corregidas)

- 27 alimentos importados desde "Base de datos", sin duplicados.
- 75 opciones de comida importadas (27 desayuno, 24 merienda, 12 almuerzo, 12 cena).
- **0 alimentos sin match** contra el catálogo — el emparejamiento por nombre
  funciona correctamente con los nombres reales de tu archivo.
- Detectó automáticamente, sin que se lo indicara, **el mismo bug de la fila
  "Claras" faltante en Merienda (opciones 1, 3 y 4)** que ya habías
  documentado vos misma en la hoja Notas — prueba de que el motor de
  comparación Desayuno/Merienda funciona como se pidió.
- Marcó como bloqueantes los campos obligatorios vacíos de la Anamnesis de
  prueba (nombre, fecha, sexo, talla, peso) y algunas cantidades vacías en
  opciones de Desayuno — correcto, porque ese Excel es la plantilla de
  prueba, no un paciente real cargado.
- Marcó 20 de los 27 alimentos con aviso informativo de "sin factor de
  cocción / sin medida casera" — coincide exactamente con lo detectado en el
  análisis original (7 de 27 sí lo tienen).

## Qué falta para cerrar la Etapa 1

1. Pantallas Next.js: ~~Importar + Revisión~~ **(hechas, ver abajo)**. Faltan:
   Pacientes (listado), Ficha del paciente editable, Configuración de
   comidas (unificar/separar + con/sin hidratos), Menú semanal manual, Vista
   previa, Exportar PDF.
2. Persistencia (Postgres) — hoy todo vive en memoria dentro de `PlanDraft`.
3. Exportador a PDF (Playwright) sobre la plantilla visual basada en el HTML
   de ejemplo.
4. Catálogo de alimentos editable (nombres alternativos, factor de cocción,
   medida casera, cambio de estado).

## Aislamiento respecto del formato del Excel

Todo lo que está en `src/domain/` y el motor de validaciones no sabe nada
del Excel. Lo único acoplado al formato actual vive en `src/excel-adapter/`,
un archivo por hoja — si el día de mañana convertís Almuerzo/Cena en una
Tabla de Excel con nombre, solo se reescribe `almuerzoCenaParser.ts`.
