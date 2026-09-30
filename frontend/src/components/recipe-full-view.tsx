"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Clock3 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { RecipeChat } from "@/components/recipe-chat";
import { apiUrl } from "@/lib/api";
import { formatDuration } from "@/lib/duration";

type Ingredient = { name: string; amount: number; unit: string };
type Recipe = {
    id?: string; title: string; description: string; image_data: string | null;
    servings: number; total_time_minutes: number; difficulty: string;
    calories: number; protein_g: number; carbs_g: number; fat_g: number;
    ingredients: Ingredient[]; instructions: string[]; details: Record<string, unknown>;
    tags: string[]; recipe_type: string; is_ai_generated: boolean;
};

const labels: Record<string, string> = {
    easy: "Einfach", medium: "Mittel", hard: "Anspruchsvoll",
    cooking_method: "Zubereitungsart", prep_time_minutes: "Vorbereitung", cook_time_minutes: "Kochzeit",
    meal_prep_friendly: "Meal Prep", fridge_life_days: "Haltbarkeit", freezable: "Einfrierbar",
    spiciness_level: "Schärfe", volume_index: "Sättigung", served_temperature: "Serviert",
    oven_temperature_c: "Ofentemperatur", oven_mode: "Ofenmodus", storage_method: "Aufbewahrung",
};

function displayValue(key: string, value: unknown) {
    if (typeof value === "boolean") return value ? "Ja" : "Nein";
    if (Array.isArray(value)) return value.join(", ");
    if (key.endsWith("_minutes")) return formatDuration(Number(value));
    if (key.endsWith("_days")) return `${value} Tage`;
    return labels[String(value)] ?? String(value);
}

function RecipeHero({ recipe, proposal }: { recipe: Recipe; proposal: boolean }) {
    const eyebrow = proposal ? "DEIN VORSCHLAG" : "DEIN REZEPT";
    if (!recipe.image_data) return <header className="py-6 sm:py-10"><p className="text-[11px] font-bold tracking-[0.18em] text-caramel">{eyebrow}</p><h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-[-0.065em] text-espresso sm:text-6xl">{recipe.title}</h1><p className="mt-5 max-w-2xl text-sm leading-7 text-bark sm:text-base">{recipe.description}</p><div className="mt-7 h-1 w-16 rounded-full bg-caramel" /></header>;
    return <header className="relative min-h-[25rem] overflow-hidden rounded-[2rem] bg-espresso sm:min-h-[33rem]"><Image src={recipe.image_data} alt={recipe.title} fill unoptimized className="object-cover" priority /><div className="absolute inset-0 bg-gradient-to-t from-espresso via-espresso/40 to-transparent" /><div className="absolute inset-x-0 bottom-0 p-6 text-white sm:p-10"><p className="text-[11px] font-bold tracking-[0.18em] text-saffron">{eyebrow}</p><h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-[-0.065em] sm:text-6xl">{recipe.title}</h1><p className="mt-4 max-w-2xl text-sm leading-6 text-white/85 sm:text-base">{recipe.description}</p></div></header>;
}

function RecipeBody({ recipe }: { recipe: Recipe }) {
    const details = Object.entries(recipe.details).filter(([key]) => key !== "required_equipment");
    return <div className="py-8 sm:py-10"><div className="flex flex-wrap gap-3 border-b border-espresso/10 pb-7"><span className="inline-flex items-center gap-1.5 rounded-full bg-saffron/30 px-4 py-2 text-sm font-bold text-espresso"><Clock3 size={16} strokeWidth={2.25} aria-hidden="true" />{formatDuration(recipe.total_time_minutes)}</span><span className="rounded-full bg-sand px-4 py-2 text-sm font-bold text-espresso">{recipe.servings} Portionen</span><span className="rounded-full bg-sand px-4 py-2 text-sm font-bold text-espresso">{labels[recipe.difficulty] ?? recipe.difficulty}</span>{recipe.tags.map((tag) => <span key={tag} className="rounded-full border border-espresso/10 px-3 py-2 text-xs font-bold text-bark">#{tag}</span>)}</div><div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem]"><div className="space-y-10"><section><h2 className="text-2xl font-semibold tracking-[-0.04em] text-espresso">Zutaten</h2><ul className="mt-4 divide-y divide-espresso/10 border-y border-espresso/10">{recipe.ingredients.map((ingredient, index) => <li key={`${ingredient.name}-${index}`} className="flex items-center justify-between gap-4 px-2 py-3 text-sm"><span className="font-semibold text-espresso">{ingredient.name}</span><span className="text-bark">{ingredient.amount} {ingredient.unit}</span></li>)}</ul></section><section><h2 className="text-2xl font-semibold tracking-[-0.04em] text-espresso">Zubereitung</h2><ol className="mt-4 space-y-3">{recipe.instructions.map((instruction, index) => <li key={`${instruction}-${index}`} className="flex gap-4 py-2 text-sm leading-6 text-bark"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-caramel text-xs font-bold text-white">{index + 1}</span><span>{instruction}</span></li>)}</ol></section></div><aside className="space-y-8"><section><h2 className="text-lg font-semibold text-espresso">Nährwerte</h2><dl className="mt-4 space-y-3 border-y border-espresso/10 py-4 text-sm"><Metric label="Kalorien" value={`${recipe.calories} kcal`} /><Metric label="Protein" value={`${recipe.protein_g} g`} /><Metric label="Kohlenhydrate" value={`${recipe.carbs_g} g`} /><Metric label="Fett" value={`${recipe.fat_g} g`} /></dl></section><section><h2 className="text-lg font-semibold text-espresso">Eigenschaften</h2><dl className="mt-4 space-y-3 border-y border-espresso/10 py-4 text-sm">{details.map(([key, value]) => <div key={key}><dt className="text-xs font-bold text-bark">{labels[key] ?? key.replaceAll("_", " ")}</dt><dd className="mt-1 font-semibold text-espresso">{displayValue(key, value)}</dd></div>)}</dl></section></aside></div></div>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="flex justify-between"><dt className="text-bark">{label}</dt><dd className="font-bold text-espresso">{value}</dd></div>; }

function FullView({ recipe, proposal }: { recipe: Recipe; proposal: boolean }) {
    const router = useRouter();
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState("");
    async function save() { setIsSaving(true); setError(""); try { const token = sessionStorage.getItem("crave_access_token"); const response = await fetch(`${apiUrl}/recipes`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(recipe) }); const result: { id?: string; detail?: string } = await response.json().catch(() => ({})); if (!response.ok || !result.id) throw new Error(result.detail ?? "Das Rezept konnte nicht gespeichert werden."); sessionStorage.removeItem("crave_selected_suggestion"); router.replace(`/recipes/${result.id}`); } catch (caught) { setError(caught instanceof Error ? caught.message : "Das Rezept konnte nicht gespeichert werden."); } finally { setIsSaving(false); } }
    return <main className="flex-1 bg-linen pb-28"><div className="mx-auto max-w-5xl px-5 py-6 sm:px-8 sm:py-10"><Link href={proposal ? "/" : "/recipes"} className="inline-flex items-center gap-1.5 text-sm font-bold text-caramel transition hover:text-espresso"><ArrowLeft size={16} strokeWidth={2.25} aria-hidden="true" />{proposal ? "Zu den Vorschlägen" : "Zu Rezepten"}</Link><article className="mt-5"><RecipeHero recipe={recipe} proposal={proposal} /><RecipeBody recipe={recipe} />{error && <p role="alert" className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{error}</p>}<div className="pb-6 sm:pb-10">{proposal ? <button onClick={save} disabled={isSaving} className="w-full rounded-full bg-caramel px-6 py-4 text-sm font-bold text-white transition hover:bg-espresso disabled:opacity-60">{isSaving ? "Rezept wird gespeichert…" : "In meine Rezepte speichern"}</button> : <Link href={`/recipes/new?type=${recipe.recipe_type}&edit=${recipe.id}`} className="block w-full rounded-full border border-caramel px-6 py-4 text-center text-sm font-bold text-caramel transition hover:bg-caramel hover:text-white">Rezept bearbeiten</Link>}</div></article></div></main>;
}

export function SuggestionDetail() { const [recipe, setRecipe] = useState<Recipe | null>(null); const [isRestoring, setIsRestoring] = useState(true); useEffect(() => { const restore = window.setTimeout(() => { const stored = sessionStorage.getItem("crave_selected_suggestion"); if (stored) setRecipe(JSON.parse(stored)); setIsRestoring(false); }, 0); return () => window.clearTimeout(restore); }, []); if (isRestoring) return <main className="flex-1 bg-linen p-8 text-center text-bark">Vorschlag wird geladen…</main>; if (!recipe) return <main className="flex-1 bg-linen p-8 text-center"><p className="text-bark">Dieser Vorschlag ist nicht mehr verfügbar.</p><Link href="/" className="mt-4 inline-block font-bold text-caramel">Neue Ideen finden</Link></main>; return <><FullView recipe={recipe} proposal /><div className="mx-auto max-w-5xl px-5 pb-28 sm:px-8"><RecipeChat recipe={recipe} /></div></>; }

export function StoredRecipeDetail({ recipeId }: { recipeId: string }) { const [recipe, setRecipe] = useState<Recipe | null>(null); const [error, setError] = useState(""); useEffect(() => { const token = sessionStorage.getItem("crave_access_token"); fetch(`${apiUrl}/recipes/${recipeId}`, { headers: { Authorization: `Bearer ${token}` } }).then(async (response) => { if (!response.ok) throw new Error("Das Rezept konnte nicht geladen werden."); return response.json(); }).then(setRecipe).catch((caught) => setError(caught instanceof Error ? caught.message : "Das Rezept konnte nicht geladen werden.")); }, [recipeId]); if (error) return <main className="flex-1 bg-linen p-8 text-center text-red-800">{error}</main>; if (!recipe) return <main className="flex-1 bg-linen p-8 text-center text-bark">Rezept wird geladen…</main>; return <><FullView recipe={recipe} proposal={false} /><div className="mx-auto max-w-5xl px-5 pb-28 sm:px-8"><RecipeChat recipe={recipe} /></div></>; }
