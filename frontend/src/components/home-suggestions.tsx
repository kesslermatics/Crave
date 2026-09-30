"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { apiUrl } from "@/lib/api";
import { LoadingIndicator } from "@/components/loading-indicator";

type Suggestion = {
    title: string; description: string; recipe_type: string; total_time_minutes: number; calories: number; protein_g: number; carbs_g: number; fat_g: number; tags: string[]; servings: number; difficulty: string; ingredients: { name: string; amount: number; unit: string }[]; instructions: string[]; details: Record<string, unknown>; is_ai_generated: boolean; image_data: string | null;
};
type Iteration = { prompt: string; recipes: Suggestion[]; createdAt: string };

const historyKey = "crave_suggestion_history";

export function HomeSuggestions() {
    const router = useRouter();
    const [prompt, setPrompt] = useState("");
    const [history, setHistory] = useState<Iteration[]>([]);
    const [activeIteration, setActiveIteration] = useState(-1);
    const [isRestoring, setIsRestoring] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const active = activeIteration >= 0 ? history[activeIteration] : undefined;

    useEffect(() => {
        const restore = window.setTimeout(() => {
            try {
                const saved = localStorage.getItem(historyKey);
                if (saved) {
                    const parsed = JSON.parse(saved) as Iteration[];
                    setHistory(parsed);
                    setActiveIteration(parsed.length - 1);
                }
            } catch { localStorage.removeItem(historyKey); }
            setIsRestoring(false);
        }, 0);
        return () => window.clearTimeout(restore);
    }, []);

    async function submit(loadMore = false) {
        const request = loadMore ? active?.prompt ?? "" : prompt.trim();
        if (request.length < 8) { setError("Beschreibe kurz, worauf du gerade Lust hast."); return; }
        setError(""); setIsLoading(true);
        try {
            const token = sessionStorage.getItem("crave_access_token");
            const response = await fetch(`${apiUrl}/ai/recipe-suggestions`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ prompt: request, history: history.map((entry) => entry.prompt), exclude_titles: loadMore ? active?.recipes.map((recipe) => recipe.title) : [] }),
            });
            const result: { recipes?: Suggestion[]; detail?: string } = await response.json().catch(() => ({}));
            if (!response.ok || !result.recipes || result.recipes.length !== 3) throw new Error(result.detail ?? "Die Rezeptideen konnten nicht erstellt werden.");
            const next = loadMore && active ? history.map((entry, index) => index === activeIteration ? { ...entry, recipes: [...entry.recipes, ...result.recipes!] } : entry) : [...history.slice(-19), { prompt: request, recipes: result.recipes, createdAt: new Date().toISOString() }];
            setHistory(next); if (!loadMore) setActiveIteration(next.length - 1); setPrompt("");
            localStorage.setItem(historyKey, JSON.stringify(next));
        } catch (caught) { setError(caught instanceof Error ? caught.message : "Die Rezeptideen konnten nicht erstellt werden."); }
        finally { setIsLoading(false); }
    }

    function openSuggestion(index: number) {
        if (!active) return;
        sessionStorage.setItem("crave_selected_suggestion", JSON.stringify(active.recipes[index]));
        router.push("/suggestions/auswahl");
    }

    return <main className="min-h-[calc(100vh-4rem)] bg-linen px-5 py-10 pb-28 sm:px-8 sm:py-16"><div className="mx-auto max-w-5xl">
        <section className="mx-auto max-w-3xl text-center">
            <h1 className="mt-4 text-4xl font-semibold tracking-[-0.07em] text-espresso sm:text-6xl">Sag Crave, wie sich dein Essen anfühlen soll.</h1>
            <div className="mt-8 text-left"><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Beschreibe deinen Wunsch…" className="min-h-32 w-full resize-y rounded-[2rem] border border-espresso/10 bg-white/85 px-5 py-4 text-sm leading-6 text-espresso outline-none transition placeholder:text-bark/45 focus:border-caramel focus:ring-4 focus:ring-saffron/25" aria-label="Deinen Essenswunsch beschreiben" /><button type="button" onClick={() => submit()} disabled={isLoading || isRestoring} className="mt-4 flex w-full justify-center rounded-full bg-caramel px-6 py-4 text-sm font-bold text-white shadow-[0_12px_24px_rgba(153,97,48,0.18)] transition hover:bg-espresso disabled:opacity-60">{isLoading ? <LoadingIndicator label="Crave stellt 3 Ideen zusammen…" light /> : "3 Rezeptideen finden"}</button></div>
            {error && <p role="alert" className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-left text-sm font-medium text-red-800">{error}</p>}
        </section>
        {history.length > 0 && <section className="mt-12">
            <div className="sticky top-16 z-30 -mx-5 border-y border-espresso/10 bg-linen/95 px-5 py-3 backdrop-blur sm:-mx-8 sm:px-8"><div className="mx-auto max-w-5xl overflow-x-auto"><div className="flex min-w-max gap-2">{history.map((entry, index) => <button key={`${entry.createdAt}-${index}`} onClick={() => setActiveIteration(index)} className={`rounded-full px-4 py-2 text-sm font-bold transition ${index === activeIteration ? "bg-espresso text-white" : "border border-espresso/10 bg-white text-bark hover:border-caramel"}`}>Runde {index + 1}</button>)}</div></div></div>
            {active && <><div className="mt-7 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-[11px] font-bold tracking-[0.18em] text-caramel">RUNDE {activeIteration + 1} · {active.recipes.length} VORSCHLÄGE</p><h2 className="mt-2 text-3xl font-semibold tracking-[-0.06em] text-espresso">„{active.prompt}“</h2></div><span className="text-sm text-bark">Wähle ein Rezept für die vollständige Ansicht.</span></div>
                <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{active.recipes.map((recipe, index) => <button key={`${recipe.title}-${index}`} onClick={() => openSuggestion(index)} className="group rounded-[2rem] border border-espresso/10 bg-white p-6 text-left shadow-[0_10px_28px_rgba(66,52,33,0.07)] transition hover:-translate-y-1 hover:border-caramel/40 hover:shadow-[0_18px_36px_rgba(66,52,33,0.14)]"><h3 className="text-2xl font-semibold leading-tight tracking-[-0.055em] text-espresso transition group-hover:text-caramel">{recipe.title}</h3><p className="mt-3 line-clamp-3 text-sm leading-6 text-bark">{recipe.description}</p><div className="mt-6 grid grid-cols-2 gap-3 border-t border-espresso/10 pt-4 text-xs"><span className="font-bold text-espresso">{recipe.total_time_minutes} Min.<small className="ml-1 font-medium text-bark">Zeit</small></span><span className="font-bold text-espresso">{recipe.servings}<small className="ml-1 font-medium text-bark">Portionen</small></span><span className="font-bold text-espresso">{recipe.calories}<small className="ml-1 font-medium text-bark">kcal</small></span><span className="font-bold text-caramel">{recipe.protein_g} g<small className="ml-1 font-medium text-bark">Protein</small></span></div>{recipe.tags.length > 0 && <div className="mt-5 flex flex-wrap gap-2">{recipe.tags.slice(0, 3).map((tag) => <span key={tag} className="rounded-full bg-sand px-2.5 py-1 text-[10px] font-bold text-bark">#{tag}</span>)}</div>}</button>)}</div>
                <div className="mt-8 text-center"><button type="button" onClick={() => submit(true)} disabled={isLoading} className="rounded-full border border-caramel bg-white px-5 py-3 text-sm font-bold text-caramel transition hover:bg-caramel hover:text-white disabled:opacity-60">{isLoading ? <LoadingIndicator label="Weitere Ideen entstehen…" /> : "+ Weitere 3 Vorschläge"}</button></div><div className="mt-10 rounded-[2rem] border border-espresso/10 bg-sand/30 p-5 sm:p-7"><p className="text-[11px] font-bold tracking-[0.18em] text-caramel">NÄCHSTE RUNDE</p><h2 className="mt-2 text-xl font-semibold text-espresso">Was soll Crave noch berücksichtigen?</h2><p className="mt-1 text-sm text-bark">Deine Ergänzung wird mit allen bisherigen Wünschen weitergeführt.</p><div className="mt-4 flex flex-col gap-3 sm:flex-row"><input value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="z. B. aber bitte High Protein" className="min-w-0 flex-1 rounded-2xl border border-espresso/10 bg-white px-4 py-3 text-sm outline-none focus:border-caramel focus:ring-4 focus:ring-caramel/10" /><button type="button" onClick={() => submit()} disabled={isLoading} className="flex justify-center rounded-2xl bg-espresso px-5 py-3 text-sm font-bold text-white transition hover:bg-caramel disabled:opacity-60">{isLoading ? <LoadingIndicator label="Neue Ideen entstehen…" light /> : "Neue 3 Ideen"}</button></div></div></>}
        </section>}
    </div></main>;
}
