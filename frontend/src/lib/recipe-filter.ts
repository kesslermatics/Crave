// Merkt sich den zuletzt gewählten Kategorie-Filter der Rezeptübersicht,
// damit „Zurück“-Links aus Rezept und Editor wieder dort landen.
const filterKey = "crave_recipe_filter";

export function rememberRecipeFilter(type: string | null) {
    if (type) sessionStorage.setItem(filterKey, type);
    else sessionStorage.removeItem(filterKey);
}

export function recipeListHref() {
    if (typeof window === "undefined") return "/recipes";
    const type = sessionStorage.getItem(filterKey);
    return type ? `/recipes?type=${encodeURIComponent(type)}` : "/recipes";
}
