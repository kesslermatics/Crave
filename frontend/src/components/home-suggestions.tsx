"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { LoadingIndicator } from "@/components/loading-indicator";
import { apiUrl } from "@/lib/api";

type Suggestion = { title: string; description: string; recipe_type: string; total_time_minutes: number; calories: number; protein_g: number; carbs_g: number; fat_g: number; tags: string[]; servings: number; difficulty: string; ingredients: { name: string; amount: number; unit: string }[]; instructions: string[]; details: Record<string, unknown>; is_ai_generated: boolean; image_data: string | null };
type Iteration = { prompt: string; recipes: Suggestion[] };
type SearchHistory = { id: string; title: string; created_at: string; updated_at: string; iteration_count: number };
type SearchHistoryDetail = SearchHistory & { iterations: Iteration[] };
type StoredSuggestionSession = { history: Iteration[]; activeIteration: number; currentSessionId: string | null };

const suggestionSessionKey = "crave_suggestion_session";

export function HomeSuggestions() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [prompt, setPrompt] = useState("");
    const [history, setHistory] = useState<Iteration[]>([]);
    const [activeIteration, setActiveIteration] = useState(-1);
    const [sessions, setSessions] = useState<SearchHistory[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [hasRestoredSession, setHasRestoredSession] = useState(false);
    const [error, setError] = useState("");
    const active = activeIteration >= 0 ? history[activeIteration] : undefined;
    const isHistoryOpen = searchParams.get("show-history") === "1";
    const historyToLoad = searchParams.get("history");

    useEffect(() => {
        let saved: StoredSuggestionSession | null = null;
        try {
            const savedSession = sessionStorage.getItem(suggestionSessionKey);
            if (savedSession) {
                saved = JSON.parse(savedSession) as StoredSuggestionSession;
            }
        } catch {
            sessionStorage.removeItem(suggestionSessionKey);
        }
        const restoreTimer = window.setTimeout(() => {
            if (saved && Array.isArray(saved.history) && saved.history.length > 0) {
                setHistory(saved.history);
                setActiveIteration(Math.min(Math.max(saved.activeIteration, 0), saved.history.length - 1));
                setCurrentSessionId(saved.currentSessionId);
            }
            setHasRestoredSession(true);
        }, 0);
        return () => window.clearTimeout(restoreTimer);
    }, []);

    useEffect(() => {
        if (!hasRestoredSession) return;
        if (history.length === 0) {
            sessionStorage.removeItem(suggestionSessionKey);
            return;
        }
        sessionStorage.setItem(suggestionSessionKey, JSON.stringify({ history, activeIteration, currentSessionId } satisfies StoredSuggestionSession));
    }, [activeIteration, currentSessionId, hasRestoredSession, history]);

    useEffect(() => {
        if (!isHistoryOpen) return;
        const controller = new AbortController();
        const token = sessionStorage.getItem("crave_access_token");
        const loadingTimer = window.setTimeout(() => setIsHistoryLoading(true), 0);
        fetch(`${apiUrl}/ai/suggestion-history`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
            .then(async (response) => { if (!response.ok) throw new Error("Suchverlauf konnte nicht geladen werden."); return response.json(); })
            .then((items: SearchHistory[]) => setSessions(items))
            .catch((caught) => { if ((caught as Error).name !== "AbortError") setError(caught instanceof Error ? caught.message : "Suchverlauf konnte nicht geladen werden."); })
            .finally(() => { window.clearTimeout(loadingTimer); if (!controller.signal.aborted) setIsHistoryLoading(false); });
        return () => { window.clearTimeout(loadingTimer); controller.abort(); };
    }, [isHistoryOpen]);

    useEffect(() => {
        if (!historyToLoad) return;
        const controller = new AbortController();
        const token = sessionStorage.getItem("crave_access_token");
        fetch(`${apiUrl}/ai/suggestion-history/${historyToLoad}`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
            .then(async (response) => { if (!response.ok) throw new Error("Suchverlauf konnte nicht geladen werden."); return response.json(); })
            .then((result: SearchHistoryDetail) => { setHistory(result.iterations); setActiveIteration(result.iterations.length - 1); setCurrentSessionId(result.id); setError(""); router.replace("/"); })
            .catch((caught) => { if ((caught as Error).name !== "AbortError") setError(caught instanceof Error ? caught.message : "Suchverlauf konnte nicht geladen werden."); });
        return () => controller.abort();
    }, [historyToLoad, router]);

    async function loadSession(summary: SearchHistory) {
        setError(""); setIsHistoryLoading(true);
        try {
            const token = sessionStorage.getItem("crave_access_token");
            const response = await fetch(`${apiUrl}/ai/suggestion-history/${summary.id}`, { headers: { Authorization: `Bearer ${token}` } });
            const result: SearchHistoryDetail | { detail?: string } = await response.json().catch(() => ({}));
            if (!response.ok || !("iterations" in result)) throw new Error(("detail" in result && result.detail) || "Suchverlauf konnte nicht geladen werden.");
            setHistory(result.iterations); setActiveIteration(result.iterations.length - 1); setCurrentSessionId(result.id); setPrompt(""); router.replace("/");
        } catch (caught) { setError(caught instanceof Error ? caught.message : "Suchverlauf konnte nicht geladen werden."); }
        finally { setIsHistoryLoading(false); }
    }

    async function submit(loadMore = false) {
        const request = loadMore ? active?.prompt ?? "" : prompt.trim();
        if (request.length < 8) { setError("Beschreibe kurz, worauf du gerade Lust hast."); return; }
        setError(""); setIsLoading(true);
        try {
            const token = sessionStorage.getItem("crave_access_token");
            const response = await fetch(`${apiUrl}/ai/recipe-suggestions`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ prompt: request, history_id: currentSessionId, load_more: loadMore, exclude_titles: loadMore ? active?.recipes.map((recipe) => recipe.title) : [] }) });
            const result: { history_id?: string; recipes?: Suggestion[]; detail?: string } = await response.json().catch(() => ({}));
            if (!response.ok || !result.history_id || !result.recipes || result.recipes.length !== 3) throw new Error(result.detail ?? "Die Rezeptideen konnten nicht erstellt werden.");
            const nextIterations = loadMore && active ? history.map((entry, index) => index === activeIteration ? { ...entry, recipes: [...entry.recipes, ...result.recipes!] } : entry) : [...history, { prompt: request, recipes: result.recipes }];
            setHistory(nextIterations); if (!loadMore) setActiveIteration(nextIterations.length - 1); setCurrentSessionId(result.history_id); setPrompt("");
        } catch (caught) { setError(caught instanceof Error ? caught.message : "Die Rezeptideen konnten nicht erstellt werden."); }
        finally { setIsLoading(false); }
    }

    function openSuggestion(index: number) { if (!active) return; sessionStorage.setItem("crave_selected_suggestion", JSON.stringify(active.recipes[index])); router.push("/suggestions/auswahl"); }

    return <main className="min-h-[calc(100vh-4rem)] bg-linen px-5 py-10 pb-28 sm:px-8 sm:py-16"><div className="mx-auto max-w-5xl">
        {isHistoryOpen && <section className="mb-8 rounded-[2rem] border border-espresso/10 bg-white p-5 shadow-[0_12px_30px_rgba(66,52,33,0.08)] sm:p-7"><div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-bold tracking-[0.18em] text-caramel">DEINE SUCHVERLÄUFE</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-espresso">Frühere Rezeptsuchen</h2></div><button onClick={() => router.replace("/")} className="grid h-9 w-9 place-items-center rounded-full border border-espresso/10 text-bark hover:border-caramel hover:text-caramel" aria-label="Verlauf schließen">×</button></div>{isHistoryLoading ? <p className="mt-6"><LoadingIndicator label="Verlauf wird geladen…" /></p> : sessions.length === 0 ? <p className="mt-6 text-sm text-bark">Noch keine Rezeptsuche gespeichert.</p> : <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{sessions.map((session) => <button key={session.id} onClick={() => loadSession(session)} className="rounded-2xl border border-espresso/10 bg-linen p-4 text-left transition hover:border-caramel hover:bg-cream"><p className="line-clamp-1 text-lg font-semibold tracking-[-0.04em] text-espresso">{session.title}</p><p className="mt-2 text-xs text-bark">{new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(session.created_at))}</p><p className="mt-3 text-xs font-bold text-caramel">{session.iteration_count} {session.iteration_count === 1 ? "Runde" : "Runden"} übernehmen →</p></button>)}</div>}</section>}
        <section className="mx-auto max-w-3xl text-center"><h1 className="mt-4 text-4xl font-semibold tracking-[-0.07em] text-espresso sm:text-6xl">Sag Crave, wie sich dein Essen anfühlen soll.</h1><div className="mt-8 text-left"><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Beschreibe deinen Wunsch…" className="min-h-32 w-full resize-y rounded-[2rem] border border-espresso/10 bg-white/85 px-5 py-4 text-sm leading-6 text-espresso outline-none transition placeholder:text-bark/45 focus:border-caramel focus:ring-4 focus:ring-saffron/25" aria-label="Deinen Essenswunsch beschreiben" /><button type="button" onClick={() => submit()} disabled={isLoading} className="mt-4 flex w-full justify-center rounded-full bg-caramel px-6 py-4 text-sm font-bold text-white shadow-[0_12px_24px_rgba(153,97,48,0.18)] transition hover:bg-espresso disabled:opacity-60">{isLoading ? <LoadingIndicator label="Crave stellt 3 Ideen zusammen…" light /> : "3 Rezeptideen finden"}</button></div>{error && <p role="alert" className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-left text-sm font-medium text-red-800">{error}</p>}</section>
        {history.length > 0 && <section className="mt-12">{active && <><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-[11px] font-bold tracking-[0.18em] text-caramel">RUNDE {activeIteration + 1} · {active.recipes.length} VORSCHLÄGE</p><h2 className="mt-2 text-3xl font-semibold tracking-[-0.06em] text-espresso">„{active.prompt}“</h2></div><span className="text-sm text-bark">Wähle ein Rezept für die vollständige Ansicht.</span></div><div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{active.recipes.map((recipe, index) => <button key={`${recipe.title}-${index}`} onClick={() => openSuggestion(index)} className="group rounded-[2rem] border border-espresso/10 bg-white p-6 text-left shadow-[0_10px_28px_rgba(66,52,33,0.07)] transition hover:-translate-y-1 hover:border-caramel/40 hover:shadow-[0_18px_36px_rgba(66,52,33,0.14)]"><h3 className="text-2xl font-semibold leading-tight tracking-[-0.055em] text-espresso transition group-hover:text-caramel">{recipe.title}</h3><p className="mt-3 line-clamp-3 text-sm leading-6 text-bark">{recipe.description}</p><div className="mt-6 grid grid-cols-2 gap-3 border-t border-espresso/10 pt-4 text-xs"><span className="font-bold text-espresso">{recipe.total_time_minutes} Min.<small className="ml-1 font-medium text-bark">Zeit</small></span><span className="font-bold text-espresso">{recipe.servings}<small className="ml-1 font-medium text-bark">Portionen</small></span><span className="font-bold text-espresso">{recipe.calories}<small className="ml-1 font-medium text-bark">kcal</small></span><span className="font-bold text-caramel">{recipe.protein_g} g<small className="ml-1 font-medium text-bark">Protein</small></span></div>{recipe.tags.length > 0 && <div className="mt-5 flex flex-wrap gap-2">{recipe.tags.slice(0, 3).map((tag) => <span key={tag} className="rounded-full bg-sand px-2.5 py-1 text-[10px] font-bold text-bark">#{tag}</span>)}</div>}</button>)}</div><div className="mt-8 text-center"><button type="button" onClick={() => submit(true)} disabled={isLoading} className="rounded-full border border-caramel bg-white px-5 py-3 text-sm font-bold text-caramel transition hover:bg-caramel hover:text-white disabled:opacity-60">{isLoading ? <LoadingIndicator label="Weitere Ideen entstehen…" /> : "+ Weitere 3 Vorschläge"}</button></div><div className="mt-10 rounded-[2rem] border border-espresso/10 bg-sand/30 p-5 sm:p-7"><p className="text-[11px] font-bold tracking-[0.18em] text-caramel">NÄCHSTE RUNDE</p><h2 className="mt-2 text-xl font-semibold text-espresso">Was soll Crave noch berücksichtigen?</h2><p className="mt-1 text-sm text-bark">Deine Ergänzung wird mit allen bisherigen Wünschen weitergeführt.</p><div className="mt-4 flex flex-col gap-3 sm:flex-row"><input value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="z. B. aber bitte High Protein" className="min-w-0 flex-1 rounded-2xl border border-espresso/10 bg-white px-4 py-3 text-sm outline-none focus:border-caramel focus:ring-4 focus:ring-caramel/10" /><button type="button" onClick={() => submit()} disabled={isLoading} className="flex justify-center rounded-2xl bg-espresso px-5 py-3 text-sm font-bold text-white transition hover:bg-caramel disabled:opacity-60">{isLoading ? <LoadingIndicator label="Neue Ideen entstehen…" light /> : "Neue 3 Ideen"}</button></div></div></>}</section>}
    </div></main>;
}
