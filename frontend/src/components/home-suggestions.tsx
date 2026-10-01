"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, CakeSlice, Camera, ChevronDown, Clock3, CookingPot, CupSoda, Flame, History, LucideIcon, Plus, RotateCcw, Soup, X } from "lucide-react";

import { ApplianceBadge } from "@/components/appliance-badge";
import { LoadingIndicator } from "@/components/loading-indicator";
import { SuggestionComposer } from "@/components/suggestion-composer";
import { apiUrl } from "@/lib/api";
import { formatDuration } from "@/lib/duration";

type Suggestion = { title: string; description: string; recipe_type: string; total_time_minutes: number; calories: number; protein_g: number; carbs_g: number; fat_g: number; tags: string[]; servings: number; difficulty: string; ingredients: { name: string; amount: number; unit: string }[]; instructions: string[]; details: Record<string, unknown>; is_ai_generated: boolean; image_data: string | null; appliance?: string };
type Iteration = { prompt: string; recipes: Suggestion[]; detected_ingredients?: string[]; photo_count?: number };
type SearchHistory = { id: string; title: string; created_at: string; updated_at: string; iteration_count: number };
type SearchHistoryDetail = SearchHistory & { iterations: Iteration[] };
type StoredSuggestionSession = { history: Iteration[]; activeIteration: number; currentSessionId: string | null };
type RequestKind = "new" | "refine" | "more";

const suggestionSessionKey = "crave_suggestion_session";
const recipeTypes: Record<string, { label: string; icon: LucideIcon }> = {
    meal: { label: "Mahlzeit", icon: Soup },
    baking: { label: "Backen & Dessert", icon: CakeSlice },
    drink: { label: "Getränk", icon: CupSoda },
    basic: { label: "Grundrezept", icon: CookingPot },
};
const difficultyLabels: Record<string, string> = { easy: "Einfach", medium: "Mittel", hard: "Anspruchsvoll" };
const examplePrompts = ["Schnell & proteinreich", "Etwas Cremiges mit Pasta", "Gemütliches Sonntagsessen", "Leichtes Abendessen unter 30 Minuten"];
const ghostPill = "inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold text-bark transition hover:bg-espresso/[0.05] hover:text-espresso focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-caramel/40";

function roundTitle(iteration: Iteration) {
    return iteration.prompt || (iteration.photo_count ? "Aus deinen Fotos" : "Ohne Beschreibung");
}

function SuggestionCard({ recipe, onOpen }: { recipe: Suggestion; onOpen: () => void }) {
    const type = recipeTypes[recipe.recipe_type] ?? recipeTypes.meal;
    const Icon = type.icon;
    return <button type="button" onClick={onOpen} className="group flex h-full animate-page-in flex-col rounded-2xl bg-white p-5 text-left shadow-[0_1px_2px_rgba(66,52,33,0.04)] ring-1 ring-espresso/[0.08] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_36px_-16px_rgba(66,52,33,0.3)] hover:ring-caramel/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-caramel/50">
        <div className="flex items-center justify-between gap-3">
            <span className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-caramel"><Icon size={13} strokeWidth={2.25} aria-hidden="true" />{type.label}</span>
                <ApplianceBadge appliance={recipe.appliance} size="sm" />
            </span>
            <span className="grid h-8 w-8 place-items-center rounded-full bg-linen text-bark transition group-hover:bg-caramel group-hover:text-white" aria-hidden="true"><ArrowUpRight size={15} strokeWidth={2.25} /></span>
        </div>
        <h3 className="mt-3 text-lg leading-snug font-semibold tracking-[-0.03em] text-balance text-espresso">{recipe.title}</h3>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-bark">{recipe.description}</p>
        <div className="mt-auto pt-5">
            <dl className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-espresso/[0.07] pt-4 text-xs text-bark">
                <div className="inline-flex items-center gap-1"><dt className="sr-only">Zeit</dt><Clock3 size={13} strokeWidth={2.25} className="text-caramel" aria-hidden="true" /><dd className="font-medium text-espresso">{formatDuration(recipe.total_time_minutes)}</dd></div>
                <div className="inline-flex items-center gap-1"><dt className="sr-only">Kalorien</dt><Flame size={13} strokeWidth={2.25} className="text-caramel" aria-hidden="true" /><dd className="font-medium text-espresso">{recipe.calories} kcal</dd></div>
                <div><dt className="sr-only">Protein</dt><dd><span className="font-medium text-espresso">{recipe.protein_g} g</span> Protein</dd></div>
                <div><dt className="sr-only">Schwierigkeit</dt><dd>{difficultyLabels[recipe.difficulty] ?? recipe.difficulty}</dd></div>
            </dl>
        </div>
    </button>;
}

function CardSkeletons() {
    return <>{[0, 1, 2].map((item) => <div key={item} className="flex min-h-56 animate-fade-in flex-col rounded-2xl bg-white/70 p-5 ring-1 ring-espresso/[0.06]" aria-hidden="true">
        <div className="h-3 w-20 rounded-full bg-espresso/[0.07] motion-safe:animate-shimmer" />
        <div className="mt-4 h-5 w-4/5 rounded-full bg-espresso/[0.07] motion-safe:animate-shimmer" />
        <div className="mt-3 h-3 w-full rounded-full bg-espresso/[0.05] motion-safe:animate-shimmer" />
        <div className="mt-2 h-3 w-2/3 rounded-full bg-espresso/[0.05] motion-safe:animate-shimmer" />
        <div className="mt-auto h-3 w-1/2 rounded-full bg-espresso/[0.05] motion-safe:animate-shimmer" />
    </div>)}</>;
}

function DetectedIngredients({ items }: { items: string[] }) {
    if (!items.length) return null;
    return <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 inline-flex items-center gap-1 text-xs font-medium text-bark"><Camera size={13} strokeWidth={2.25} aria-hidden="true" />Erkannt:</span>
        {items.map((item) => <span key={item} className="rounded-full bg-cream/80 px-2.5 py-0.5 text-xs text-espresso">{item}</span>)}
    </div>;
}

export function HomeSuggestions() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [prompt, setPrompt] = useState("");
    const [images, setImages] = useState<string[]>([]);
    const [history, setHistory] = useState<Iteration[]>([]);
    const [activeIteration, setActiveIteration] = useState(-1);
    const [sessions, setSessions] = useState<SearchHistory[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);
    const [pending, setPending] = useState<RequestKind | null>(null);
    const [hasRestoredSession, setHasRestoredSession] = useState(false);
    const [error, setError] = useState("");
    const scrollTargetRef = useRef<number | null>(null);
    const isLoading = pending !== null;
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

    // Nach einer neuen Runde sanft zu ihr scrollen.
    useEffect(() => {
        if (scrollTargetRef.current === null || scrollTargetRef.current !== activeIteration) return;
        scrollTargetRef.current = null;
        document.getElementById(`round-${activeIteration}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, [activeIteration, history.length]);

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
            if (!response.ok || !("iterations" in result)) throw new Error(("detail" in result && typeof result.detail === "string" && result.detail) || "Suchverlauf konnte nicht geladen werden.");
            setHistory(result.iterations); setActiveIteration(result.iterations.length - 1); setCurrentSessionId(result.id); setPrompt(""); router.replace("/");
        } catch (caught) { setError(caught instanceof Error ? caught.message : "Suchverlauf konnte nicht geladen werden."); }
        finally { setIsHistoryLoading(false); }
    }

    async function submit(kind: RequestKind) {
        const lastRound = history[history.length - 1];
        const text = kind === "more" ? lastRound?.prompt ?? "" : prompt.trim();
        const photos = kind === "more" ? [] : images;
        if (kind !== "more" && text.length < 8 && photos.length === 0) { setError("Beschreibe kurz, worauf du Lust hast, oder füge ein Foto deiner Zutaten hinzu."); return; }
        setError(""); setPending(kind);
        try {
            const token = sessionStorage.getItem("crave_access_token");
            const response = await fetch(`${apiUrl}/ai/recipe-suggestions`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ prompt: text, history_id: kind === "new" ? null : currentSessionId, load_more: kind === "more", exclude_titles: kind === "more" ? lastRound?.recipes.map((recipe) => recipe.title) ?? [] : [], images: photos }),
            });
            const result: { history_id?: string; recipes?: Suggestion[]; detected_ingredients?: string[]; detail?: unknown } = await response.json().catch(() => ({}));
            if (!response.ok || !result.history_id || !result.recipes || result.recipes.length !== 3) throw new Error(typeof result.detail === "string" ? result.detail : "Die Rezeptideen konnten nicht erstellt werden.");
            const round: Iteration = { prompt: text, recipes: result.recipes, detected_ingredients: result.detected_ingredients ?? [], photo_count: photos.length };
            // „Weitere Ideen“ ergänzt im Backend immer die letzte Runde.
            const nextIterations = kind === "more" ? history.map((entry, index) => index === history.length - 1 ? { ...entry, recipes: [...entry.recipes, ...result.recipes!] } : entry) : kind === "new" ? [round] : [...history, round];
            setHistory(nextIterations);
            if (kind !== "more") { scrollTargetRef.current = nextIterations.length - 1; setActiveIteration(nextIterations.length - 1); setPrompt(""); setImages([]); }
            setCurrentSessionId(result.history_id);
        } catch (caught) { setError(caught instanceof Error ? caught.message : "Die Rezeptideen konnten nicht erstellt werden."); }
        finally { setPending(null); }
    }

    function startOver() { setHistory([]); setActiveIteration(-1); setCurrentSessionId(null); setPrompt(""); setImages([]); setError(""); window.scrollTo({ top: 0, behavior: "smooth" }); }

    function openSuggestion(iteration: Iteration, index: number) { sessionStorage.setItem("crave_selected_suggestion", JSON.stringify(iteration.recipes[index])); router.push("/suggestions/auswahl"); }

    const errorBox = error && <p role="alert" className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-left text-sm font-medium text-red-800">{error}</p>;

    return <main className="min-h-[calc(100vh-4rem)] bg-linen px-5 pt-6 pb-32 sm:px-8 sm:pt-8"><div className="mx-auto max-w-5xl">
        <div className="-mx-3.5 flex justify-end gap-1">
            {history.length > 0 && <button type="button" onClick={startOver} className={ghostPill}><RotateCcw size={15} strokeWidth={2.25} aria-hidden="true" />Neue Suche</button>}
            <Link href="/history" className={ghostPill}><History size={15} strokeWidth={2.25} aria-hidden="true" />Verlauf</Link>
        </div>

        {isHistoryOpen && <section className="mt-4 rounded-3xl bg-white p-5 ring-1 ring-espresso/[0.08] motion-safe:animate-page-in sm:p-7">
            <div className="flex items-start justify-between gap-4">
                <h2 className="text-xl font-semibold tracking-[-0.03em] text-espresso">Frühere Suchen</h2>
                <button onClick={() => router.replace("/")} className="grid h-9 w-9 place-items-center rounded-full text-bark transition hover:bg-linen hover:text-espresso" aria-label="Verlauf schließen"><X size={17} strokeWidth={2.25} aria-hidden="true" /></button>
            </div>
            {isHistoryLoading ? <p className="mt-6"><LoadingIndicator label="Verlauf wird geladen…" /></p> : sessions.length === 0 ? <p className="mt-6 text-sm text-bark">Noch keine Rezeptsuche gespeichert.</p> : <ul className="mt-4 divide-y divide-espresso/[0.07]">
                {sessions.map((session) => <li key={session.id}><button onClick={() => loadSession(session)} className="flex w-full items-center justify-between gap-4 py-3.5 text-left transition hover:text-caramel">
                    <span className="min-w-0"><span className="block truncate font-medium text-espresso">{session.title}</span><span className="text-xs text-bark">{new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(session.created_at))} · {session.iteration_count} {session.iteration_count === 1 ? "Runde" : "Runden"}</span></span>
                    <ArrowUpRight size={16} strokeWidth={2.25} className="shrink-0 text-caramel" aria-hidden="true" />
                </button></li>)}
            </ul>}
        </section>}

        {history.length === 0 ? <section className="mx-auto max-w-2xl pt-10 text-center motion-safe:animate-page-in sm:pt-16">
            <p className="text-[11px] font-semibold tracking-[0.2em] text-caramel">WORAUF HAST DU LUST?</p>
            <h1 className="mt-4 text-[2.5rem] leading-[1.05] font-semibold tracking-[-0.055em] text-balance text-espresso sm:text-6xl">Sag Crave, wie sich dein Essen anfühlen soll.</h1>
            <p className="mx-auto mt-4 max-w-md text-base leading-7 text-bark">Beschreibe deinen Wunsch oder fotografiere, was du im Kühlschrank hast.</p>
            <div className="mt-9">
                <SuggestionComposer value={prompt} onChange={setPrompt} images={images} onImagesChange={setImages} onSubmit={() => submit("new")} onError={setError} isLoading={pending === "new"}
                    placeholder="z. B. etwas Warmes, Cremiges mit viel Gemüse…" submitLabel="3 Ideen finden" loadingLabel="Ideen entstehen…" label="Deinen Essenswunsch beschreiben" />
                {errorBox}
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                    {examplePrompts.map((example) => <button key={example} type="button" onClick={() => setPrompt(example)} className="rounded-full bg-white/60 px-3.5 py-1.5 text-xs font-medium text-bark ring-1 ring-espresso/[0.08] transition hover:bg-white hover:text-espresso">{example}</button>)}
                </div>
            </div>
            {pending === "new" && <div className="mt-12 grid gap-4 text-left sm:grid-cols-2 lg:grid-cols-3"><CardSkeletons /></div>}
        </section> : <section className="pt-6 motion-safe:animate-page-in">
            <p className="text-[11px] font-semibold tracking-[0.2em] text-caramel">DEINE SUCHE</p>
            <h1 className="mt-2 max-w-3xl text-3xl leading-tight font-semibold tracking-[-0.045em] text-balance text-espresso sm:text-4xl">{roundTitle(history[0])}</h1>

            <ol className="mt-10">
                {history.map((iteration, index) => {
                    const isActive = index === activeIteration;
                    const isLast = index === history.length - 1;
                    return <li key={index} id={`round-${index}`} className="relative scroll-mt-24 pb-10 pl-9">
                        {/* Zeitleiste */}
                        <span className="absolute top-7 bottom-0 left-[11px] w-px bg-espresso/10" aria-hidden="true" />
                        <span className={`absolute top-1 left-0 grid h-6 w-6 place-items-center rounded-full text-[11px] font-semibold tabular-nums transition ${isActive ? "bg-caramel text-white" : "bg-white text-bark ring-1 ring-espresso/15"}`} aria-hidden="true">{index + 1}</span>

                        <button type="button" onClick={() => setActiveIteration(isActive ? -1 : index)} aria-expanded={isActive} aria-controls={`round-panel-${index}`} className="group flex w-full items-start justify-between gap-4 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-caramel/40">
                            <span className="min-w-0">
                                <span className="block text-[11px] font-semibold tracking-[0.14em] text-bark/70">RUNDE {index + 1} · {iteration.recipes.length} IDEEN</span>
                                <span className={`mt-1 flex items-center gap-2 text-lg font-semibold tracking-[-0.02em] transition ${isActive ? "text-espresso" : "text-bark group-hover:text-espresso"}`}>
                                    {iteration.photo_count ? <Camera size={17} strokeWidth={2} className="shrink-0 text-caramel" aria-label="Mit Fotos" /> : null}
                                    <span className="truncate">{iteration.prompt ? `„${iteration.prompt}“` : roundTitle(iteration)}</span>
                                </span>
                            </span>
                            <ChevronDown size={18} strokeWidth={2.25} className={`mt-5 shrink-0 text-bark/60 transition-transform duration-200 ${isActive ? "rotate-180" : ""}`} aria-hidden="true" />
                        </button>

                        {isActive && <div id={`round-panel-${index}`} className="motion-safe:animate-page-in">
                            <DetectedIngredients items={iteration.detected_ingredients ?? []} />
                            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {iteration.recipes.map((recipe, recipeIndex) => <SuggestionCard key={`${recipe.title}-${recipeIndex}`} recipe={recipe} onOpen={() => openSuggestion(iteration, recipeIndex)} />)}
                                {isLast && pending === "more" && <CardSkeletons />}
                            </div>
                            {isLast && <button type="button" onClick={() => submit("more")} disabled={isLoading} className="mt-5 -ml-3 inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-caramel transition hover:bg-caramel/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-caramel/40 disabled:opacity-50">
                                {pending === "more" ? <LoadingIndicator label="Weitere Ideen entstehen…" /> : <><Plus size={16} strokeWidth={2.5} aria-hidden="true" />3 weitere Ideen</>}
                            </button>}
                        </div>}
                    </li>;
                })}

                {pending === "refine" && <li className="relative pb-10 pl-9" aria-live="polite">
                    <span className="absolute top-1 left-0 grid h-6 w-6 place-items-center rounded-full bg-caramel/15 text-[11px] font-semibold text-caramel" aria-hidden="true">{history.length + 1}</span>
                    <p className="text-[11px] font-semibold tracking-[0.14em] text-bark/70">RUNDE {history.length + 1}</p>
                    <p className="mt-1"><LoadingIndicator label="Crave denkt nach…" /></p>
                    <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><CardSkeletons /></div>
                </li>}

                <li className="relative pl-9">
                    <span className="absolute top-1 left-0 grid h-6 w-6 place-items-center rounded-full bg-white text-caramel ring-1 ring-caramel/40" aria-hidden="true"><Plus size={13} strokeWidth={2.5} /></span>
                    <p className="text-[11px] font-semibold tracking-[0.14em] text-bark/70">NÄCHSTE RUNDE</p>
                    <p className="mt-1 text-sm text-bark">Verfeinere die Suche – Crave berücksichtigt alle bisherigen Wünsche.</p>
                    <div className="mt-4">
                        <SuggestionComposer size="compact" value={prompt} onChange={setPrompt} images={images} onImagesChange={setImages} onSubmit={() => submit("refine")} onError={setError} isLoading={pending === "refine"}
                            placeholder="z. B. aber bitte High Protein" submitLabel="Neue Runde" loadingLabel="Entsteht…" label="Wunsch für die nächste Runde" />
                        {errorBox}
                    </div>
                </li>
            </ol>
        </section>}
    </div></main>;
}
