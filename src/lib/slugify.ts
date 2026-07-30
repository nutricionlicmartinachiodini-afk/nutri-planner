export function normalizeText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // saca tildes
    .toLowerCase()
    .replace(/[~]/g, "") // el propio Excel documenta que "~" rompe el MATCH; lo ignoramos al comparar
    .trim()
    .replace(/\s+/g, " ");
}

export function slugify(s: string): string {
  return (
    "food_" +
    normalizeText(s)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
  );
}
