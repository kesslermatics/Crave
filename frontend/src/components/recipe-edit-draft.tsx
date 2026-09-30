"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { apiUrl } from "@/lib/api";
import { RecipeChat } from "@/components/recipe-chat";

type Ingredient = { name: string; amount: number; unit: string };
type Recipe = {
    id?: string; title: string; description: string; image_data: string | null; servings: number; total_time_minutes: number; difficulty: string; calories: number; protein_g: number; carbs_g: number; fat_g: number; ingredients: Ingredient[]; instructions: string[]; details: Record<string, unknown>; tags: string[]; recipe_type: string; is_ai_generated: boolean;
};

const inputClass = "w-full rounded-xl border border-espresso/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-caramel focus:ring-4 focus:ring-caramel/10";

export function RecipeEditDraft({ recipeId }: { recipeId: string }) {
    const router = useRouter();
    const [draft, setDraft] = useState<Recipe | null>(null);
    const [error, setError] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const token = sessionStorage.getItem("crave_access_token");
        fetch(`${apiUrl}/recipes/${recipeId}`, { headers: { Authorization: `Bearer ${token}` } })
            .then(async (response) => { if (!response.ok) throw new Error("Das Rezept konnte nicht geladen werden."); return response.json(); })
            .then((recipe: Recipe) => setDraft(recipe))
            .catch((caught) => setError(caught instanceof Error ? caught.message : "Das Rezept konnte nicht geladen werden."));
    }, [recipeId]);

    function update<K extends keyof Recipe>(key: K, value: Recipe[K]) { setDraft((current) => current ? { ...current, [key]: value } : current); }
    function updateIngredient(index: number, key: keyof Ingredient, value: string) { setDraft((current) => current ? { ...current, ingredients: current.ingredients.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: key === "amount" ? Number(value) : value } : item) } : current); }
    function updateStep(index: number, value: string) { setDraft((current) => current ? { ...current, instructions: current.instructions.map((item, itemIndex) => itemIndex === index ? value : item) } : current); }

    async function save(asNew: boolean) {
        if (!draft) return;
        setError(""); setIsSaving(true);
        try {
            const token = sessionStorage.getItem("crave_access_token");
            const response = await fetch(asNew ? `${apiUrl}/recipes` : `${apiUrl}/recipes/${recipeId}`, { method: asNew ? "POST" : "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(draft) });
            const result: { id?: string; detail?: string } = await response.json().catch(() => ({}));
            if (!response.ok || !result.id) throw new Error(result.detail ?? "Der Entwurf konnte nicht gespeichert werden.");
            router.replace(`/recipes/${result.id}`);
        } catch (caught) { setError(caught instanceof Error ? caught.message : "Der Entwurf konnte nicht gespeichert werden."); }
        finally { setIsSaving(false); }
    }

    if (error && !draft) return <main className="flex-1 bg-linen p-8 text-center text-red-800">{error}</main>;
    if (!draft) return <main className="flex-1 bg-linen p-8 text-center text-bark">Rezeptentwurf wird geladen…</main>;
    return <main className="flex-1 bg-linen px-5 py-8 pb-28 sm:px-8 sm:py-12"><div className="mx-auto max-w-5xl"><Link href={`/recipes/${recipeId}`} className="text-sm font-bold text-caramel">← Zurück zum Rezept</Link><header className="mt-5"><p className="text-[11px] font-bold tracking-[0.18em] text-caramel">ENTWURF BEARBEITEN</p><h1 className="mt-2 text-4xl font-semibold tracking-[-0.06em] text-espresso">{draft.title}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-bark">Ändere Felder direkt oder beschreibe Crave unten eine Änderung. Die KI passt den Entwurf als Ganzes an.</p></header><div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]"><div className="space-y-6"><section className="rounded-[2rem] border border-espresso/10 bg-sand/25 p-5 sm:p-7"><h2 className="text-xl font-semibold text-espresso">Grundlagen</h2><div className="mt-5 grid gap-4"><label className="text-sm font-semibold text-espresso">Rezeptname<input value={draft.title} onChange={(event) => update("title", event.target.value)} className={`mt-2 ${inputClass}`} /></label><label className="text-sm font-semibold text-espresso">Beschreibung<textarea value={draft.description} onChange={(event) => update("description", event.target.value)} className={`mt-2 min-h-28 ${inputClass}`} /></label><div className="grid grid-cols-2 gap-4"><label className="text-sm font-semibold text-espresso">Portionen<input type="number" value={draft.servings} onChange={(event) => update("servings", Number(event.target.value))} className={`mt-2 ${inputClass}`} /></label><label className="text-sm font-semibold text-espresso">Gesamtzeit in Minuten<input type="number" value={draft.total_time_minutes} onChange={(event) => update("total_time_minutes", Number(event.target.value))} className={`mt-2 ${inputClass}`} /></label></div></div></section><section className="rounded-[2rem] border border-espresso/10 bg-sand/25 p-5 sm:p-7"><h2 className="text-xl font-semibold text-espresso">Zutaten</h2><div className="mt-4 space-y-3">{draft.ingredients.map((ingredient, index) => <div key={index} className="grid grid-cols-[minmax(0,1fr)_5rem_5rem] gap-2"><input value={ingredient.name} onChange={(event) => updateIngredient(index, "name", event.target.value)} className={inputClass} /><input type="number" value={ingredient.amount} onChange={(event) => updateIngredient(index, "amount", event.target.value)} className={inputClass} /><input value={ingredient.unit} onChange={(event) => updateIngredient(index, "unit", event.target.value)} className={inputClass} /></div>)}</div></section><section className="rounded-[2rem] border border-espresso/10 bg-sand/25 p-5 sm:p-7"><h2 className="text-xl font-semibold text-espresso">Zubereitung</h2><div className="mt-4 space-y-3">{draft.instructions.map((step, index) => <label key={index} className="flex gap-3"><span className="mt-2 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-caramel text-xs font-bold text-white">{index + 1}</span><input value={step} onChange={(event) => updateStep(index, event.target.value)} className={inputClass} /></label>)}</div></section></div><aside className="space-y-5"><section className="rounded-[2rem] border border-espresso/10 bg-white p-5"><h2 className="text-lg font-semibold text-espresso">Entwurf speichern</h2><p className="mt-2 text-sm leading-6 text-bark">Du entscheidest, ob das bestehende Rezept ersetzt oder eine neue Variante angelegt wird.</p><button onClick={() => save(false)} disabled={isSaving} className="mt-5 w-full rounded-full bg-caramel px-4 py-3 text-sm font-bold text-white disabled:opacity-60">Bestehendes Rezept aktualisieren</button><button onClick={() => save(true)} disabled={isSaving} className="mt-3 w-full rounded-full border border-caramel px-4 py-3 text-sm font-bold text-caramel disabled:opacity-60">Als neues Rezept speichern</button>{error && <p role="alert" className="mt-4 text-sm text-red-800">{error}</p>}</section><section className="rounded-2xl bg-white p-5"><h2 className="text-lg font-semibold text-espresso">Nährwerte pro Portion</h2><p className="mt-3 text-sm text-bark">{draft.calories} kcal · {draft.protein_g} g Protein · {draft.carbs_g} g Kohlenhydrate · {draft.fat_g} g Fett</p></section></aside></div><RecipeChat recipe={draft} editable onDraft={(next) => setDraft(next as Recipe)} /></div></main>;
}
