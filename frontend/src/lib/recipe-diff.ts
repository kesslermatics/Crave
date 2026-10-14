import { formatQuantity } from "@/lib/amount";

/** Shape of a recipe as held by the editor / returned by the AI draft endpoint. */
export type RecipeDraft = {
    title: string;
    description: string;
    recipe_type: string;
    image_data: string | null;
    servings: number;
    total_time_minutes: number;
    difficulty: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    ingredients: { name: string; amount: number; unit: string }[];
    instructions: string[];
    details: Record<string, unknown>;
    tags: string[];
    is_ai_generated: boolean;
    appliance?: string;
};

export type FieldChange = { label: string; before: string; after: string };
export type IngredientChange = {
    removed: string[];
    added: string[];
    changed: { name: string; before: string; after: string }[];
};
export type StepChange = { index: number; before: string | null; after: string | null };

export type RecipeDiff = {
    fields: FieldChange[];
    ingredients: IngredientChange;
    steps: StepChange[];
    isEmpty: boolean;
};

const ENUM_LABELS: Record<string, string> = {
    easy: "Einfach", medium: "Mittel", hard: "Schwer", low: "Gering", high: "Hoch",
    hot: "Heiß", warm: "Warm", cold: "Kalt", iced: "Eiskalt", chilled: "Gekühlt", room_temperature: "Zimmertemperatur",
    conventional: "Ober-/Unterhitze", fan: "Umluft", hot_air: "Heißluft",
    blended: "Püriert", shaken: "Geschüttelt", stirred: "Gerührt", brewed: "Gebrüht", steeped: "Ziehen lassen", built_in_glass: "Direkt im Glas",
    none: "Ohne", cubes: "Eiswürfel", crushed: "Crushed Ice", fridge: "Kühlschrank", pantry: "Vorratsschrank", freezer: "Tiefkühler",
};

const APPLIANCE_LABELS: Record<string, string> = {
    none: "Ohne Gerät", thermomix: "Thermomix", monsieur_cuisine: "Monsieur Cuisine",
};

const FIELD_LABELS: Record<string, string> = {
    title: "Titel", description: "Beschreibung", servings: "Portionen", total_time_minutes: "Gesamtzeit",
    difficulty: "Schwierigkeit", calories: "Kalorien", protein_g: "Protein", carbs_g: "Kohlenhydrate", fat_g: "Fett",
    appliance: "Küchengerät", tags: "Tags",
};

const DETAIL_LABELS: Record<string, string> = {
    cooking_method: "Kochmethode", required_equipment: "Geräte", prep_time_minutes: "Vorbereitung", cook_time_minutes: "Kochzeit",
    meal_prep_friendly: "Meal-Prep", fridge_life_days: "Haltbarkeit (Kühlschrank)", freezable: "Einfrierbar", spiciness_level: "Schärfe",
    volume_index: "Sättigung", served_temperature: "Serviertemperatur",
    oven_temperature_c: "Ofentemperatur", oven_mode: "Ofenmodus", preheat_required: "Vorheizen", pan_type: "Form", pan_size_cm: "Formgröße",
    resting_time_minutes: "Ruhezeit", cooling_time_minutes: "Abkühlzeit", dough_type: "Teig", special_techniques: "Techniken",
    prep_method: "Zubereitung", ice_type: "Eis", abv_percent: "Alkohol", caffeine_level: "Koffein", glass_type: "Glas", volume_ml: "Volumen",
    yield_amount: "Ertrag", yield_unit: "Ertragseinheit", serving_size_amount: "Portionsmenge", serving_size_unit: "Portionseinheit",
    storage_method: "Aufbewahrung", shelf_life_days: "Haltbarkeit", storage_tips: "Hinweise", component_type: "Komponente", pairs_well_with: "Passt zu",
    preservation_method: "Konservierung", processing_time_minutes: "Verarbeitungszeit",
};

const UNITS: Record<string, string> = {
    total_time_minutes: "Min", prep_time_minutes: "Min", cook_time_minutes: "Min", resting_time_minutes: "Min",
    cooling_time_minutes: "Min", processing_time_minutes: "Min", fridge_life_days: "Tage", shelf_life_days: "Tage",
    oven_temperature_c: "°C", pan_size_cm: "cm", volume_ml: "ml", abv_percent: "%",
    calories: "kcal", protein_g: "g", carbs_g: "g", fat_g: "g",
};

const formatNumber = (value: number) => (Number.isInteger(value) ? String(value) : value.toLocaleString("de-DE", { maximumFractionDigits: 2 }));

/** Human-readable German string for a single field value, resolving enums, booleans, arrays and units. */
function displayValue(key: string, value: unknown): string {
    if (value === null || value === undefined || value === "") return "–";
    if (typeof value === "boolean") return value ? "Ja" : "Nein";
    if (Array.isArray(value)) return value.length ? value.map(String).join(", ") : "–";
    if (key === "appliance" && typeof value === "string") return APPLIANCE_LABELS[value] ?? value;
    if (typeof value === "string" && ENUM_LABELS[value]) return ENUM_LABELS[value];
    if (typeof value === "number") return UNITS[key] ? `${formatNumber(value)} ${UNITS[key]}` : formatNumber(value);
    return String(value);
}

const ingredientLabel = (item: { name: string; amount: number; unit: string }) => {
    const quantity = formatQuantity(item.amount ?? null, item.unit ?? "");
    return quantity ? `${quantity} ${item.name}`.trim() : item.name;
};

const quantityLabel = (item: { amount: number; unit: string }) => formatQuantity(item.amount ?? null, item.unit ?? "") || "–";

function diffIngredients(before: RecipeDraft["ingredients"], after: RecipeDraft["ingredients"]): IngredientChange {
    const key = (name: string) => name.trim().toLowerCase();
    const beforeMap = new Map(before.map((item) => [key(item.name), item]));
    const afterMap = new Map(after.map((item) => [key(item.name), item]));
    const removed: string[] = [];
    const added: string[] = [];
    const changed: { name: string; before: string; after: string }[] = [];
    for (const item of before) {
        if (!afterMap.has(key(item.name))) removed.push(ingredientLabel(item));
    }
    for (const item of after) {
        const previous = beforeMap.get(key(item.name));
        if (!previous) {
            added.push(ingredientLabel(item));
        } else if (quantityLabel(previous) !== quantityLabel(item)) {
            changed.push({ name: item.name, before: quantityLabel(previous), after: quantityLabel(item) });
        }
    }
    return { removed, added, changed };
}

function diffSteps(before: string[], after: string[]): StepChange[] {
    const changes: StepChange[] = [];
    const max = Math.max(before.length, after.length);
    for (let index = 0; index < max; index += 1) {
        const prev = before[index] ?? null;
        const next = after[index] ?? null;
        if ((prev ?? "").trim() !== (next ?? "").trim()) changes.push({ index, before: prev, after: next });
    }
    return changes;
}

function diffFields(before: RecipeDraft, after: RecipeDraft): FieldChange[] {
    const changes: FieldChange[] = [];
    const scalarKeys: (keyof RecipeDraft)[] = ["title", "description", "servings", "total_time_minutes", "difficulty", "calories", "protein_g", "carbs_g", "fat_g", "appliance"];
    for (const field of scalarKeys) {
        const beforeValue = before[field];
        const afterValue = after[field];
        if (beforeValue === undefined && afterValue === undefined) continue;
        if (displayValue(field, beforeValue) !== displayValue(field, afterValue)) {
            changes.push({ label: FIELD_LABELS[field] ?? field, before: displayValue(field, beforeValue), after: displayValue(field, afterValue) });
        }
    }
    // Tags as a joined set comparison
    const beforeTags = [...(before.tags ?? [])].sort().join(", ");
    const afterTags = [...(after.tags ?? [])].sort().join(", ");
    if (beforeTags !== afterTags) {
        changes.push({ label: FIELD_LABELS.tags, before: beforeTags || "–", after: afterTags || "–" });
    }
    // Type-specific details
    const detailKeys = new Set([...Object.keys(before.details ?? {}), ...Object.keys(after.details ?? {})]);
    for (const key of detailKeys) {
        const beforeValue = displayValue(key, before.details?.[key]);
        const afterValue = displayValue(key, after.details?.[key]);
        if (beforeValue !== afterValue) {
            changes.push({ label: DETAIL_LABELS[key] ?? key, before: beforeValue, after: afterValue });
        }
    }
    return changes;
}

/** Compute a human-readable diff between the current recipe and a proposed revision. */
export function diffRecipes(before: RecipeDraft, after: RecipeDraft): RecipeDiff {
    const fields = diffFields(before, after);
    const ingredients = diffIngredients(before.ingredients ?? [], after.ingredients ?? []);
    const steps = diffSteps(before.instructions ?? [], after.instructions ?? []);
    const isEmpty = fields.length === 0 && steps.length === 0 && ingredients.removed.length === 0 && ingredients.added.length === 0 && ingredients.changed.length === 0;
    return { fields, ingredients, steps, isEmpty };
}
