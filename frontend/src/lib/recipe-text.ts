/** Plain-text versions of recipes for the clipboard: ingredient lists for trackers (e.g. Yazio) and full recipes for chats (e.g. WhatsApp). */

export type TextIngredient = { name: string; amount: number | null; unit: string };

const preciseUnits = new Set(["g", "kg", "ml", "l"]);

/** Plain decimal numbers only ("0,5" instead of "½"): trackers can't read fraction glyphs. */
function plainAmount(amount: number, unit: string): string {
    const format = (value: number, digits: number) => new Intl.NumberFormat("de-DE", { maximumFractionDigits: digits, useGrouping: false }).format(value);
    if (preciseUnits.has(unit.trim().toLowerCase())) return amount >= 10 ? format(Math.round(amount), 0) : format(amount, 1);
    return format(amount, 2);
}

/** "200 g Mehl", "2 Eier" – amounts scaled by `factor`; percentages are never scaled. */
export function ingredientLine(ingredient: TextIngredient, factor = 1): string {
    const unit = ingredient.unit.trim();
    const name = ingredient.name.trim();
    if (ingredient.amount === null || !(ingredient.amount > 0)) return unit ? `${unit} ${name}` : name;
    const amount = unit === "%" ? ingredient.amount : ingredient.amount * factor;
    return [plainAmount(amount, unit), unit, name].filter(Boolean).join(" ");
}

export function ingredientLines(ingredients: TextIngredient[], factor = 1): string {
    return ingredients.filter((ingredient) => ingredient.name.trim()).map((ingredient) => ingredientLine(ingredient, factor)).join("\n");
}

export function servingsLabel(servings: number) {
    const value = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(servings);
    return `${value} ${servings === 1 ? "Portion" : "Portionen"}`;
}

/** Full recipe for chats; *bold* is WhatsApp/Signal/Telegram syntax and harmless elsewhere. */
export function recipeShareText(recipe: { title: string; description?: string; total_time_minutes?: number; servings: number; ingredients: TextIngredient[]; instructions: string[] }, servings = recipe.servings): string {
    const factor = servings / Math.max(1, recipe.servings || 1);
    const facts = [recipe.total_time_minutes ? `⏱ ${recipe.total_time_minutes} Min.` : "", `👥 ${servingsLabel(servings)}`].filter(Boolean).join(" · ");
    const parts = [`*${recipe.title.trim()}*`];
    if (recipe.description?.trim()) parts.push(recipe.description.trim());
    parts.push(facts);
    parts.push(`*Zutaten*\n${recipe.ingredients.filter((i) => i.name.trim()).map((i) => `• ${ingredientLine(i, factor)}`).join("\n")}`);
    const steps = recipe.instructions.map((step) => step.trim()).filter(Boolean);
    if (steps.length) parts.push(`*Zubereitung*\n${steps.map((step, index) => `${index + 1}. ${step}`).join("\n\n")}`);
    return parts.join("\n\n");
}
