"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { apiUrl } from "@/lib/api";

type Suggestion = {
    title: string;
    description: string;
    recipe_type: string;
    total_time_minutes: number;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    tags: string[];
    servings: number;
    difficulty: string;
    ingredients: { name: string; amount: number; unit: string }[];
    instructions: string[];
    details: Record<string, unknown>;
    is_ai_generated: boolean;
    image_data: string | null;
};

const example = "Es regnet, ich bin gestresst und brauche in 20 Minuten etwas Tröstliches mit Käse.";

export function HomeSuggestions() {
    const router = useRouter();
    const [prompt, setPrompt] = useState(example);
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    async function submit() {
        if (prompt.trim().length < 8) { setError("Beschreibe kurz, worauf du gerade Lust hast."); return; }
        setError(""); setIsLoading(true);
        try {
            const token = sessionStorage.getItem("crave_access_token");
            const response = await fetch(`${apiUrl}/ai/recipe-suggestions`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ prompt }) });
            const result: { recipes?: Suggestion[]; detail?: string } = await response.json().catch(() => ({}));
            if (!response.ok || !result.recipes) throw new Error(result.detail ?? "Die Vorschläge konnten nicht erstellt werden.");
            setSuggestions(result.recipes);
            sessionStorage.setItem("crave_recipe_suggestions", JSON.stringify(result.recipes));
        } catch (caught) { setError(caught instanceof Error ? caught.message : "Die Vorschläge konnten nicht erstellt werden."); }
        finally { setIsLoading(false); }
    }

    function openSuggestion(index: number) {
        sessionStorage.setItem("crave_selected_suggestion", JSON.stringify(suggestions[index]));
        router.push("/suggestions/auswahl");
    }

    return <main className="min-h-[calc(100vh-4rem)] bg-linen px-5 py-10 pb-28 sm:px-8 sm:py-16"><div className="mx-auto max-w-5xl"><section className="mx-auto max-w-3xl text-center"><p className="text-[11px] font-bold tracking-[0.2em] text-caramel">WORAUF HAST DU LUST?</p><h1 className="mt-4 text-4xl font-semibold tracking-[-0.07em] text-espresso sm:text-6xl">Sag Crave, wie sich dein Essen anfühlen soll.</h1><p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-bark sm:text-base">Beschreibe Stimmung, Zeit, Zutaten oder dein Ziel – Crave findet passende Ideen für genau diesen Moment.</p><div className="mt-8 text-left"><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} className="min-h-32 w-full resize-y rounded-[2rem] border border-espresso/10 bg-white/85 px-5 py-4 text-sm leading-6 text-espresso outline-none transition placeholder:text-bark/45 focus:border-caramel focus:ring-4 focus:ring-saffron/25" aria-label="Deinen Essenswunsch beschreiben" /><button type="button" onClick={submit} disabled={isLoading} className="mt-4 w-full rounded-full bg-caramel px-6 py-4 text-sm font-bold text-white shadow-[0_12px_24px_rgba(153,97,48,0.18)] transition hover:bg-espresso disabled:opacity-60">{isLoading ? "Crave sucht passende Ideen…" : "5 Rezeptideen finden"}</button></div>{error && <p role="alert" className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-left text-sm font-medium text-red-800">{error}</p>}</section>
        {suggestions.length > 0 && <section className="mt-14"><div className="flex items-end justify-between gap-4"><div><p className="text-[11px] font-bold tracking-[0.18em] text-caramel">FÜR DICH AUSGEWÄHLT</p><h2 className="mt-2 text-3xl font-semibold tracking-[-0.06em] text-espresso">Fünf Ideen für deinen Moment</h2></div><span className="hidden text-sm text-bark sm:block">Wähle eine Idee für die vollständige Ansicht.</span></div><div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{suggestions.map((recipe, index) => <button key={`${recipe.title}-${index}`} onClick={() => openSuggestion(index)} className="group overflow-hidden rounded-[2rem] border border-espresso/10 bg-white text-left shadow-[0_10px_28px_rgba(66,52,33,0.07)] transition hover:-translate-y-1 hover:shadow-[0_18px_36px_rgba(66,52,33,0.14)]"><div className="h-28 bg-gradient-to-br from-saffron via-caramel to-espresso p-5"><span className="rounded-full bg-white/20 px-3 py-1 text-[10px] font-bold tracking-[0.12em] text-white">IDEEN {index + 1}</span></div><div className="p-5"><h3 className="text-xl font-semibold tracking-[-0.045em] text-espresso">{recipe.title}</h3><p className="mt-2 line-clamp-2 text-sm leading-6 text-bark">{recipe.description}</p><p className="mt-5 text-xs font-bold text-caramel">{recipe.total_time_minutes} Min. · {recipe.calories} kcal · {recipe.protein_g} g Protein</p></div></button>)}</div></section>}</div></main>;
}
