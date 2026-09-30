"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { apiUrl } from "@/lib/api";

const types = [
    { value: "meal", label: "Meals", icon: "🍲" },
    { value: "baking", label: "Baking", icon: "🧁" },
    { value: "drink", label: "Drinks", icon: "🥤" },
    { value: "basic", label: "Basics", icon: "🫙" },
] as const;

type RecipeType = (typeof types)[number]["value"];
type IngredientRow = { name: string; amount: string; unit: string };

function splitList(value: FormDataEntryValue | null) {
    return String(value ?? "").split(",").map((entry) => entry.trim()).filter(Boolean);
}

function Input({ name, label, type = "text", required = false, defaultValue, min, step }: { name: string; label: string; type?: string; required?: boolean; defaultValue?: string | number; min?: number; step?: string }) {
    return <label className="block text-sm font-bold text-espresso">{label}<input name={name} type={type} required={required} min={min} step={step} defaultValue={defaultValue} className="mt-2 block w-full rounded-xl border border-espresso/15 bg-white px-3.5 py-3 text-sm font-medium outline-none transition focus:border-caramel focus:ring-4 focus:ring-saffron/30" /></label>;
}

function Select({ name, label, children, defaultValue }: { name: string; label: string; children: React.ReactNode; defaultValue?: string }) {
    return <label className="block text-sm font-bold text-espresso">{label}<select name={name} defaultValue={defaultValue} className="mt-2 block w-full rounded-xl border border-espresso/15 bg-white px-3.5 py-3 text-sm font-medium outline-none transition focus:border-caramel focus:ring-4 focus:ring-saffron/30">{children}</select></label>;
}

export function RecipeEditor({ initialType = "meal" }: { initialType?: string }) {
    const router = useRouter();
    const defaultType = types.some((item) => item.value === initialType) ? initialType as RecipeType : "meal";
    const [recipeType, setRecipeType] = useState<RecipeType>(defaultType);
    const [ingredients, setIngredients] = useState<IngredientRow[]>([{ name: "", amount: "", unit: "g" }]);
    const [instructions, setInstructions] = useState([""]);
    const [error, setError] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    function updateIngredient(index: number, key: keyof IngredientRow, value: string) {
        setIngredients((current) => current.map((ingredient, itemIndex) => itemIndex === index ? { ...ingredient, [key]: value } : ingredient));
    }

    function detailsFromForm(form: FormData) {
        const number = (name: string) => Number(form.get(name));
        const text = (name: string) => String(form.get(name) ?? "");
        const checked = (name: string) => form.get(name) === "on";
        if (recipeType === "meal") return { cooking_method: text("cooking_method"), required_equipment: splitList(form.get("required_equipment")), prep_time_minutes: number("prep_time_minutes"), cook_time_minutes: number("cook_time_minutes"), meal_prep_friendly: checked("meal_prep_friendly"), fridge_life_days: number("fridge_life_days"), freezable: checked("freezable"), spiciness_level: number("spiciness_level"), volume_index: text("volume_index"), served_temperature: text("served_temperature") };
        if (recipeType === "baking") return { oven_temperature_c: number("oven_temperature_c"), oven_mode: text("oven_mode"), preheat_required: checked("preheat_required"), pan_type: text("pan_type"), pan_size_cm: number("pan_size_cm"), resting_time_minutes: number("resting_time_minutes"), cooling_time_minutes: number("cooling_time_minutes"), dough_type: text("dough_type"), special_techniques: splitList(form.get("special_techniques")) };
        if (recipeType === "drink") return { prep_method: text("prep_method"), required_equipment: splitList(form.get("required_equipment")), served_temperature: text("served_temperature"), ice_type: text("ice_type"), abv_percent: number("abv_percent"), caffeine_level: text("caffeine_level"), glass_type: text("glass_type"), volume_ml: number("volume_ml") };
        return { yield_amount: number("yield_amount"), yield_unit: text("yield_unit"), serving_size_amount: number("serving_size_amount"), serving_size_unit: text("serving_size_unit"), storage_method: text("storage_method"), shelf_life_days: number("shelf_life_days"), storage_tips: splitList(form.get("storage_tips")), component_type: text("component_type"), pairs_well_with: splitList(form.get("pairs_well_with")), resting_time_minutes: number("resting_time_minutes") };
    }

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        const form = new FormData(event.currentTarget);
        const token = sessionStorage.getItem("crave_access_token");
        if (!token) { setError("Please log in again before creating a recipe."); return; }
        setIsSaving(true);
        const number = (name: string) => Number(form.get(name));
        const imageUrl = String(form.get("image_url") ?? "").trim();
        const payload = {
            title: String(form.get("title") ?? ""), description: String(form.get("description") ?? ""), recipe_type: recipeType,
            image_url: imageUrl || null, servings: number("servings"), total_time_minutes: number("total_time_minutes"), difficulty: String(form.get("difficulty")), calories: number("calories"), protein_g: number("protein_g"), carbs_g: number("carbs_g"), fat_g: number("fat_g"),
            ingredients: ingredients.map((ingredient) => ({ name: ingredient.name, amount: Number(ingredient.amount), unit: ingredient.unit })),
            instructions, details: detailsFromForm(form), is_ai_generated: form.get("is_ai_generated") === "on", tags: splitList(form.get("tags")),
        };
        try {
            const response = await fetch(`${apiUrl}/recipes`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
            const result: { detail?: string } = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(typeof result.detail === "string" ? result.detail : "Recipe could not be saved.");
            router.push("/recipes");
        } catch (caughtError) {
            setError(caughtError instanceof Error ? caughtError.message : "Recipe could not be saved.");
        } finally { setIsSaving(false); }
    }

    return <main className="min-h-screen bg-linen px-5 py-8 sm:px-8 sm:py-12"><div className="mx-auto max-w-3xl pb-12"><Link href="/recipes" className="text-sm font-bold text-caramel hover:text-espresso">← Recipes</Link><p className="mt-8 text-[11px] font-bold tracking-[0.18em] text-caramel">NEW RECIPE</p><h1 className="mt-3 text-4xl font-semibold tracking-[-0.065em] text-espresso">Add to your cookbook</h1><p className="mt-3 text-sm leading-6 text-bark">Every field feeds better recommendations and smarter recipe adaptations.</p>
        <form onSubmit={submit} className="mt-8 space-y-8"><section className="rounded-3xl bg-white p-5 shadow-[0_10px_25px_rgba(66,52,33,0.06)] sm:p-7"><h2 className="text-lg font-semibold text-espresso">Recipe type</h2><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{types.map((item) => <button type="button" key={item.value} onClick={() => setRecipeType(item.value)} className={`rounded-2xl px-3 py-3 text-sm font-bold transition ${recipeType === item.value ? "bg-caramel text-white" : "bg-linen text-bark hover:bg-cream"}`}><span className="mr-1.5">{item.icon}</span>{item.label}</button>)}</div></section>
            <section className="rounded-3xl bg-white p-5 shadow-[0_10px_25px_rgba(66,52,33,0.06)] sm:p-7"><h2 className="text-lg font-semibold text-espresso">The essentials</h2><div className="mt-5 grid gap-5 sm:grid-cols-2"><div className="sm:col-span-2"><Input name="title" label="Title" required /></div><label className="sm:col-span-2 block text-sm font-bold text-espresso">Description<textarea name="description" required maxLength={2000} className="mt-2 block min-h-28 w-full rounded-xl border border-espresso/15 bg-white px-3.5 py-3 text-sm font-medium outline-none transition focus:border-caramel focus:ring-4 focus:ring-saffron/30" /></label><Input name="image_url" label="Image URL (optional)" type="url" /><Input name="tags" label="Tags (comma-separated)" /><Input name="servings" label="Servings" type="number" min={1} defaultValue={2} required /><Input name="total_time_minutes" label="Total time (minutes)" type="number" min={0} defaultValue={20} required /><Select name="difficulty" label="Difficulty" defaultValue="easy"><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></Select><label className="flex items-end gap-3 pb-3 text-sm font-bold text-espresso"><input name="is_ai_generated" type="checkbox" className="h-4 w-4 accent-caramel" />AI generated</label></div></section>
            <section className="rounded-3xl bg-white p-5 shadow-[0_10px_25px_rgba(66,52,33,0.06)] sm:p-7"><h2 className="text-lg font-semibold text-espresso">Nutrition per serving</h2><div className="mt-5 grid gap-5 sm:grid-cols-4"><Input name="calories" label="Calories" type="number" min={0} defaultValue={0} required /><Input name="protein_g" label="Protein (g)" type="number" min={0} step="0.1" defaultValue={0} required /><Input name="carbs_g" label="Carbs (g)" type="number" min={0} step="0.1" defaultValue={0} required /><Input name="fat_g" label="Fat (g)" type="number" min={0} step="0.1" defaultValue={0} required /></div></section>
            <section className="rounded-3xl bg-white p-5 shadow-[0_10px_25px_rgba(66,52,33,0.06)] sm:p-7"><div className="flex items-center justify-between gap-4"><h2 className="text-lg font-semibold text-espresso">Ingredients</h2><button type="button" onClick={() => setIngredients((current) => [...current, { name: "", amount: "", unit: "g" }])} className="text-sm font-bold text-caramel">+ Add</button></div><div className="mt-5 space-y-3">{ingredients.map((ingredient, index) => <div key={index} className="grid grid-cols-[1fr_5rem_4.5rem_auto] gap-2"><input value={ingredient.name} onChange={(event) => updateIngredient(index, "name", event.target.value)} required placeholder="Ingredient" className="rounded-xl border border-espresso/15 px-3 py-3 text-sm outline-none focus:border-caramel" /><input value={ingredient.amount} onChange={(event) => updateIngredient(index, "amount", event.target.value)} required type="number" min="0" step="0.1" placeholder="Amt" className="rounded-xl border border-espresso/15 px-2 py-3 text-sm outline-none focus:border-caramel" /><input value={ingredient.unit} onChange={(event) => updateIngredient(index, "unit", event.target.value)} required placeholder="g" className="rounded-xl border border-espresso/15 px-2 py-3 text-sm outline-none focus:border-caramel" />{ingredients.length > 1 && <button type="button" onClick={() => setIngredients((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="px-1 text-caramel" aria-label="Remove ingredient">×</button>}</div>)}</div></section>
            <section className="rounded-3xl bg-white p-5 shadow-[0_10px_25px_rgba(66,52,33,0.06)] sm:p-7"><div className="flex items-center justify-between gap-4"><h2 className="text-lg font-semibold text-espresso">Instructions</h2><button type="button" onClick={() => setInstructions((current) => [...current, ""])} className="text-sm font-bold text-caramel">+ Add</button></div><div className="mt-5 space-y-3">{instructions.map((instruction, index) => <div key={index} className="flex gap-2"><span className="mt-3 text-xs font-bold text-caramel">{index + 1}</span><input value={instruction} onChange={(event) => setInstructions((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} required placeholder="Describe this step" className="min-w-0 flex-1 rounded-xl border border-espresso/15 px-3 py-3 text-sm outline-none focus:border-caramel" />{instructions.length > 1 && <button type="button" onClick={() => setInstructions((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="text-caramel" aria-label="Remove instruction">×</button>}</div>)}</div></section>
            <DetailFields recipeType={recipeType} />
            {error && <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{error}</p>}<button disabled={isSaving} className="w-full rounded-full bg-caramel px-6 py-4 text-sm font-bold text-white shadow-[0_12px_24px_rgba(153,97,48,0.2)] transition hover:bg-espresso disabled:opacity-60">{isSaving ? "Saving recipe…" : "Save recipe"}</button>
        </form></div></main>;
}

function DetailFields({ recipeType }: { recipeType: RecipeType }) {
    const title = types.find((item) => item.value === recipeType)?.label;
    const option = (value: string) => <option value={value} key={value}>{value.replaceAll("_", " ")}</option>;
    return <section className="rounded-3xl bg-white p-5 shadow-[0_10px_25px_rgba(66,52,33,0.06)] sm:p-7"><h2 className="text-lg font-semibold text-espresso">{title} details</h2><div className="mt-5 grid gap-5 sm:grid-cols-2">
        {recipeType === "meal" && <><Input name="cooking_method" label="Cooking method" required /><Input name="required_equipment" label="Equipment (comma-separated)" /><Input name="prep_time_minutes" label="Prep time (minutes)" type="number" min={0} defaultValue={0} required /><Input name="cook_time_minutes" label="Cook time (minutes)" type="number" min={0} defaultValue={0} required /><Input name="fridge_life_days" label="Fridge life (days)" type="number" min={0} defaultValue={0} required /><Select name="spiciness_level" label="Spiciness" defaultValue="1">{[1, 2, 3, 4, 5].map((value) => option(String(value)))}</Select><Select name="volume_index" label="Volume" defaultValue="medium">{["low", "medium", "high"].map(option)}</Select><Select name="served_temperature" label="Served temperature" defaultValue="hot">{["hot", "warm", "cold"].map(option)}</Select><label className="flex items-center gap-3 text-sm font-bold text-espresso"><input name="meal_prep_friendly" type="checkbox" className="h-4 w-4 accent-caramel" />Meal-prep friendly</label><label className="flex items-center gap-3 text-sm font-bold text-espresso"><input name="freezable" type="checkbox" className="h-4 w-4 accent-caramel" />Freezable</label></>}
        {recipeType === "baking" && <><Input name="oven_temperature_c" label="Oven temperature (°C)" type="number" min={0} required /><Select name="oven_mode" label="Oven mode" defaultValue="conventional">{["conventional", "fan", "hot_air"].map(option)}</Select><Input name="pan_type" label="Pan type" required /><Input name="pan_size_cm" label="Pan size (cm)" type="number" min={0} step="0.1" required /><Input name="resting_time_minutes" label="Resting time (minutes)" type="number" min={0} defaultValue={0} required /><Input name="cooling_time_minutes" label="Cooling time (minutes)" type="number" min={0} defaultValue={0} required /><Input name="dough_type" label="Dough type" required /><Input name="special_techniques" label="Special techniques (comma-separated)" /><label className="flex items-center gap-3 text-sm font-bold text-espresso"><input name="preheat_required" type="checkbox" defaultChecked className="h-4 w-4 accent-caramel" />Preheat required</label></>}
        {recipeType === "drink" && <><Select name="prep_method" label="Preparation" defaultValue="blended">{["blended", "shaken", "stirred", "brewed", "steeped", "built_in_glass"].map(option)}</Select><Input name="required_equipment" label="Equipment (comma-separated)" /><Select name="served_temperature" label="Served temperature" defaultValue="iced">{["hot", "iced", "chilled", "room_temperature"].map(option)}</Select><Select name="ice_type" label="Ice" defaultValue="none">{["none", "cubes", "crushed"].map(option)}</Select><Input name="abv_percent" label="ABV (%)" type="number" min={0} step="0.1" defaultValue={0} required /><Select name="caffeine_level" label="Caffeine" defaultValue="none">{["none", "low", "high"].map(option)}</Select><Input name="glass_type" label="Glass type" required /><Input name="volume_ml" label="Volume (ml)" type="number" min={1} required /></>}
        {recipeType === "basic" && <><Input name="yield_amount" label="Yield amount" type="number" min={0} step="0.1" required /><Input name="yield_unit" label="Yield unit" required /><Input name="serving_size_amount" label="Serving size amount" type="number" min={0} step="0.1" required /><Input name="serving_size_unit" label="Serving size unit" required /><Select name="storage_method" label="Storage" defaultValue="fridge">{["fridge", "pantry", "freezer"].map(option)}</Select><Input name="shelf_life_days" label="Shelf life (days)" type="number" min={0} required /><Input name="component_type" label="Component type" required /><Input name="resting_time_minutes" label="Resting time (minutes)" type="number" min={0} defaultValue={0} required /><div className="sm:col-span-2"><Input name="storage_tips" label="Storage tips (comma-separated)" /></div><div className="sm:col-span-2"><Input name="pairs_well_with" label="Pairs well with (comma-separated)" /></div></>}
    </div></section>;
}
