"use client";
/* eslint-disable @next/next/no-img-element -- images are generated data URLs */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowUp, Gift, Lightbulb, Lock, Sparkles, Trash2, X } from "lucide-react";
import { DropItem, EventDetail as EventData, EventIngredient, eventApi, formatAmount, formatDay } from "@/lib/events";
import { EventJury } from "@/components/event-jury";
import { HandicapName, HandicapPicture } from "@/components/handicap-visual";
import { HandicapIcon } from "@/components/handicap-icons";
import { FormattedMessage } from "@/components/formatted-message";
import { LoadingIndicator } from "@/components/loading-indicator";

type Revealed = { day_index: number; items: DropItem[]; teaser: string | null };

const IngredientPicture = HandicapPicture;

/** All active handicaps at the top of the event: horizontally scrollable chips that link into the shop. */
function HandicapBar({ handicaps, spent }: { handicaps: EventData["handicaps"]; spent: number }) {
    // Several light handicaps of the same kind show up once with a counter.
    const grouped = [...handicaps.reduce((map, entry) => map.set(entry.handicap, { ...entry, count: (map.get(entry.handicap)?.count ?? 0) + 1 }), new Map<string, EventData["handicaps"][number] & { count: number }>()).values()];
    const order = { heavy: 0, medium: 1, light: 2 } as Record<string, number>;
    grouped.sort((a, b) => order[a.tier] - order[b.tier]);
    return <section className="mt-4" aria-labelledby="handicap-bar-title">
        <h2 id="handicap-bar-title" className="text-xs font-bold tracking-[0.16em] text-red-700 uppercase">Aktive Handicaps · {spent} Strafpunkte</h2>
        <ul className="-mx-5 mt-2 flex gap-2 overflow-x-auto px-5 pb-2 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">{grouped.map((entry) => <li key={entry.handicap} className="shrink-0">
            <Link href={`/handicaps#${entry.handicap}`} className="flex min-h-11 items-center gap-2 rounded-full border border-espresso/10 bg-white py-1 pr-3.5 pl-1 text-sm font-semibold text-espresso shadow-[0_1px_2px_rgba(66,52,33,0.06)] hover:border-caramel/40">
                <HandicapIcon id={entry.handicap} tier={entry.tier} title={entry.title} size={15} className="h-8 w-8 rounded-full" />
                {entry.title}{entry.count > 1 && <span className="text-caramel">×{entry.count}</span>}
            </Link>
        </li>)}</ul>
    </section>;
}

/** Cook-day ingredient rows, honouring the "geteiltes Bewusstsein" and memory masks. */
function CookIngredients({ items }: { items: EventIngredient[] }) {
    return <ul className="mt-5 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">{items.map((ingredient, i) => <li key={i} className={`flex items-center justify-between gap-3 border-b border-espresso/5 py-1.5 ${ingredient.mask === "memory" ? "blur-sm select-none" : ""}`}>
        {ingredient.mask === "name"
            ? <span className="flex min-w-0 items-center gap-3">{ingredient.image_data ? <img src={ingredient.image_data} alt="Unbekannte Zutat" className="h-12 w-12 rounded-xl object-cover" /> : <span className="grid h-12 w-12 place-items-center rounded-xl bg-saffron/25 text-caramel" aria-hidden="true"><Gift size={18} /></span>}<span className="sr-only">Zutat ohne Namen</span></span>
            : <span className="min-w-0 break-words text-espresso">{ingredient.name}</span>}
        {ingredient.mask !== "amount" && <span className="shrink-0 font-semibold text-caramel">{ingredient.mask === "memory" ? "▇▇" : formatAmount(ingredient.amount, ingredient.unit)}</span>}
    </li>)}</ul>;
}

function MemoryTimer({ startedAt, seconds, onExpire }: { startedAt: string; seconds: number; onExpire: () => void }) {
    const [left, setLeft] = useState(() => Math.max(0, seconds - (Date.now() - Date.parse(startedAt)) / 1000));
    useEffect(() => {
        const timer = window.setInterval(() => {
            const remaining = Math.max(0, seconds - (Date.now() - Date.parse(startedAt)) / 1000);
            setLeft(remaining);
            if (remaining <= 0) { window.clearInterval(timer); onExpire(); }
        }, 500);
        return () => window.clearInterval(timer);
    }, [startedAt, seconds, onExpire]);
    const whole = Math.ceil(left);
    return <p role="timer" aria-live="off" className="sticky top-20 z-10 mb-6 rounded-2xl bg-red-600 px-4 py-3 text-center text-lg font-bold text-white shadow-lg">⏱ {Math.floor(whole / 60)}:{String(whole % 60).padStart(2, "0")} – merkt euch alles!</p>;
}

function HandicapBadge({ item }: { item: DropItem }) {
    return item.handicap ? <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-red-50 py-0.5 pr-2.5 pl-0.5 text-[11px] font-bold text-red-700"><HandicapIcon id={item.handicap.id} title={item.handicap.title} tier={item.handicap.id === "schwarzes_loch" ? "medium" : "light"} size={11} className="h-5 w-5 rounded-full" />{item.handicap.title}</span> : null;
}

function RevealModal({ drop, onClose }: { drop: Revealed; onClose: () => void }) {
    // Several ingredients are unwrapped one after another; the last step shows the whole package.
    const [step, setStep] = useState(0);
    const count = drop.items.length;
    const isSummary = count > 1 && step >= count;
    const next = useCallback(() => (count > 1 && step < count ? setStep(step + 1) : onClose()), [count, step, onClose]);
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => event.key === "Escape" ? onClose() : (event.key === "Enter" || event.key === " ") && next();
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose, next]);
    const item = drop.items[Math.min(step, count - 1)];
    const buttonLabel = count > 1 && step < count - 1 ? `Nächste Zutat (${step + 2}/${count})` : count > 1 && step === count - 1 ? "Alles ansehen" : "Fertig";
    return <motion.div className="fixed inset-0 z-[60] flex items-end justify-center bg-espresso/70 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center sm:p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
        <motion.div role="dialog" aria-modal="true" aria-labelledby="reveal-title" onClick={(event) => event.stopPropagation()}
            initial={{ scale: 0.4, rotate: -8, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} transition={{ type: "spring", stiffness: 220, damping: 16 }}
            className="relative max-h-[88dvh] w-full max-w-sm overflow-x-hidden overflow-y-auto overscroll-contain rounded-[2rem] bg-linen p-6 text-center shadow-2xl sm:p-7">
            <motion.div aria-hidden="true" className="pointer-events-none absolute -inset-20 bg-[conic-gradient(from_0deg,transparent,rgba(240,180,41,0.35),transparent_40%)]" animate={{ rotate: 360 }} transition={{ duration: 6, repeat: Infinity, ease: "linear" }} />
            <button type="button" onClick={onClose} aria-label="Schließen" className="absolute top-3 right-3 z-10 grid h-11 w-11 place-items-center rounded-full text-bark hover:bg-espresso/5"><X size={18} /></button>
            <div className="relative">
                <p className="text-xs font-bold tracking-[0.2em] text-caramel uppercase">Tag {drop.day_index + 1}{count > 1 && !isSummary && ` · ${step + 1} von ${count}`}</p>
                <h2 id="reveal-title" className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-espresso">{count === 0 ? "Hinweis des Tages" : isSummary ? "Dein Paket" : "Deine Zutat"}</h2>
                {count === 0 && <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="mt-6 flex items-start gap-3 rounded-2xl bg-white p-4 text-left text-sm leading-6 text-espresso"><Sparkles size={18} className="mt-0.5 shrink-0 text-caramel" aria-hidden="true" />{drop.teaser}</motion.p>}
                {count > 0 && !isSummary && <div className="mt-6 grid min-h-64 place-items-center" aria-live="polite">
                    <AnimatePresence mode="wait">
                        <motion.div key={step} className="flex flex-col items-center" initial={{ y: 40, opacity: 0, scale: 0.6, rotate: -6 }} animate={{ y: 0, opacity: 1, scale: 1, rotate: 0 }} exit={{ y: -30, opacity: 0, scale: 0.8 }} transition={{ delay: step === 0 ? 0.35 : 0.05, type: "spring", stiffness: 200, damping: 15 }}>
                            <IngredientPicture item={item} size="h-44 w-44" />
                            <p className="mt-3 text-lg font-semibold text-espresso"><HandicapName item={item} /></p>
                            <HandicapBadge item={item} />
                            <p className="text-sm font-semibold text-caramel">{formatAmount(item.amount, item.unit)}</p>
                        </motion.div>
                    </AnimatePresence>
                </div>}
                {isSummary && <ul className="mt-6 space-y-2 text-left">{drop.items.map((entry, index) => <motion.li key={index} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.08 }} className="flex items-center gap-3 rounded-2xl bg-white p-2.5">
                    <IngredientPicture item={entry} size="h-12 w-12" />
                    <span className="min-w-0 flex-1 text-sm font-semibold break-words text-espresso"><HandicapName item={entry} /></span>
                    <span className="shrink-0 text-sm font-semibold text-caramel">{formatAmount(entry.amount, entry.unit)}</span>
                </motion.li>)}</ul>}
                <button type="button" onClick={next} autoFocus className="mt-6 min-h-12 w-full rounded-full bg-espresso px-6 py-3 text-sm font-semibold text-white transition hover:bg-caramel">{buttonLabel}</button>
                <p className="mt-4 text-xs text-bark">Psst – nur du siehst das.</p>
            </div>
        </motion.div>
    </motion.div>;
}

const TIP_NOTES: Record<string, string> = {
    telegramm: "Telegramm-Stil: höchstens 3 Wörter pro Antwort.",
    philosoph: "Küchen-Philosoph: Antworten kommen nur als Metapher oder Rätsel.",
    ein_schuss: "Ein-Schuss-Joker: Ihr habt genau eine Frage – danach ist der Chat zu.",
    good_cop_bad_cop: "Good Cop, Bad Cop: Jede Frage bekommt zwei Antworten – eine davon lügt.",
    stille_post: "Stille Post: Nur einer darf fragen, die Antworten sehen nur die anderen.",
};

function TipChat({ eventId, tips, tipCount, onTip, readOnly = false, effects = [], askerEmail = "" }: { eventId: string; tips: EventData["tips"]; tipCount: number; onTip: () => void; readOnly?: boolean; effects?: string[]; askerEmail?: string }) {
    const [question, setQuestion] = useState("");
    const [sending, setSending] = useState(false);
    const [error, setError] = useState("");
    async function submit(event: FormEvent) {
        event.preventDefault();
        const text = question.trim();
        if (!text || sending) return;
        setSending(true); setError("");
        try {
            const history = tips.slice(-3).flatMap((tip) => [{ role: "user", content: tip.question }, { role: "assistant", content: tip.answer }]);
            await eventApi(`/events/${eventId}/tips`, { method: "POST", body: { question: text, history } });
            setQuestion(""); onTip();
        } catch (caught) { setError((caught as Error).message); } finally { setSending(false); }
    }
    return <section className="mt-14 border-t border-espresso/10 pt-10" aria-labelledby="tips-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="tips-title" className="flex items-center gap-2 text-xl font-semibold text-espresso"><Lightbulb size={20} className="text-caramel" aria-hidden="true" /> {readOnly ? "Tipps" : "Tipp holen"}</h2>
            <span className="rounded-full bg-espresso px-3 py-1 text-xs font-bold text-white">{tipCount} {tipCount === 1 ? "Tipp" : "Tipps"} genutzt</span>
        </div>
        <p className="mt-1 text-sm text-bark">Jede Antwort zählt als Tipp für euer ganzes Event.</p>
        {effects.filter((effect) => TIP_NOTES[effect]).map((effect) => <p key={effect} className="mt-2 rounded-2xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700">{TIP_NOTES[effect]}{effect === "stille_post" && askerEmail && ` Fragen darf: ${askerEmail}.`}</p>)}
        <div className="mt-6 space-y-4" aria-live="polite">{tips.map((tip) => <div key={tip.created_at} className="space-y-2">
            <p className="ml-auto max-w-[85%] rounded-[1.25rem] rounded-br-md bg-espresso px-4 py-2.5 text-sm text-white sm:max-w-md"><span className="block text-[10px] font-bold opacity-70">{tip.email}</span>{tip.question}</p>
            <div className="max-w-[85%] rounded-[1.25rem] rounded-bl-md bg-white px-4 py-2.5 text-sm leading-6 text-espresso shadow-[0_1px_2px_rgba(66,52,33,0.06)] sm:max-w-md"><FormattedMessage text={tip.answer} />{tip.truth && <p className="mt-2 text-xs font-bold text-caramel">Wahr war Antwort {tip.truth}.</p>}</div>
        </div>)}
            {sending && <LoadingIndicator label="Crave überlegt einen Hinweis…" />}
        </div>
        {error && <p role="alert" className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{error}</p>}
        {!readOnly && <form onSubmit={submit} className="mt-6 flex items-center gap-2 rounded-full border border-espresso/10 bg-white py-1.5 pr-1.5 pl-5 focus-within:border-caramel/50 focus-within:ring-4 focus-within:ring-caramel/10">
            <input value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={800} placeholder="z. B. Wie heiß sollte der Ofen sein?" aria-label="Frage für einen Tipp" enterKeyHint="send" className="min-w-0 flex-1 bg-transparent py-2 text-espresso outline-none placeholder:text-bark/50 text-base sm:text-sm" />
            <button disabled={sending || !question.trim()} aria-label="Tipp anfragen" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-caramel text-white disabled:bg-espresso/15"><ArrowUp size={17} strokeWidth={2.5} aria-hidden="true" /></button>
        </form>}
    </section>;
}

export function EventDetail({ eventId }: { eventId: string }) {
    const [event, setEvent] = useState<EventData | null>(null);
    const [error, setError] = useState("");
    const [opening, setOpening] = useState<number | null>(null);
    const [revealed, setRevealed] = useState<Revealed | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [gameBusy, setGameBusy] = useState(false);

    async function gameAction(action: "memory-start" | "blind-reveal") {
        setGameBusy(true); setError("");
        try { await eventApi(`/events/${eventId}/game/${action}`, { method: "POST" }); await load(); }
        catch (caught) { setError((caught as Error).message); } finally { setGameBusy(false); }
    }
    const router = useRouter();

    async function removeEvent() {
        if (!window.confirm("Event für alle endgültig löschen? Pakete, Rezepte und Tipps gehen verloren.")) return;
        setDeleting(true); setError("");
        try {
            await eventApi(`/admin/events/${eventId}`, { method: "DELETE" });
            router.replace("/events");
        } catch (caught) { setError((caught as Error).message); setDeleting(false); }
    }

    const load = useCallback(() => eventApi<EventData>(`/events/${eventId}`).then(setEvent).catch((caught: Error) => setError(caught.message)), [eventId]);
    useEffect(() => { void load(); }, [load]);
    useEffect(() => {
        if (event?.status !== "generating" && !event?.images_pending && event?.phase !== "judging") return;
        const timer = window.setInterval(load, 4000);
        return () => window.clearInterval(timer);
    }, [event?.status, event?.images_pending, event?.phase, load]);

    async function reveal(dayIndex: number) {
        setOpening(dayIndex); setError("");
        try {
            setRevealed(await eventApi<Revealed>(`/events/${eventId}/drops/${dayIndex}/reveal`, { method: "POST" }));
            void load();
        } catch (caught) { setError((caught as Error).message); } finally { setOpening(null); }
    }

    if (!event) return <main className="mx-auto max-w-3xl px-5 pt-10 sm:px-8">{error ? <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p> : <LoadingIndicator label="Event wird geladen…" />}</main>;

    const myItems = event.drops.flatMap((drop) => drop.items ?? []);
    const embargo = event.effects.includes("bild_embargo") && event.phase !== "finished";
    const activeMedium = event.handicaps.filter((entry) => entry.tier !== "light");
    const daysLeft = Math.round((Date.parse(event.cook_date) - Date.parse(event.today)) / 86_400_000);

    return <main className="mx-auto max-w-3xl px-5 pt-4 pb-[calc(8rem+env(safe-area-inset-bottom))] sm:px-8 sm:pt-8">
        <Link href="/events" className="-ml-1 flex min-h-11 w-fit items-center gap-1 px-1 text-sm font-semibold text-caramel"><ArrowLeft size={15} aria-hidden="true" /> Alle Events</Link>
        <p className="mt-6 text-xs font-bold tracking-[0.2em] text-caramel uppercase">{event.categories.join(" · ")}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-[-0.04em] text-espresso sm:text-4xl">{event.title}</h1>
        <p className="mt-2 text-sm text-bark">Kochtag: {formatDay(event.cook_date, { weekday: "long", day: "numeric", month: "long" })}{!event.is_cook_day && daysLeft > 0 && ` · noch ${daysLeft} ${daysLeft === 1 ? "Tag" : "Tage"}`}</p>
        {event.handicaps.length > 0 && <HandicapBar handicaps={event.handicaps} spent={event.penalty_spent} />}
        {error && <p role="alert" className="mt-6 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{error}</p>}

        {event.status === "generating" && <div className="mt-10 rounded-3xl bg-white p-6"><LoadingIndicator label={event.progress || "Das Event wird vorbereitet…"} /></div>}
        {event.status === "failed" && <p className="mt-10 rounded-3xl bg-red-50 p-6 text-sm text-red-800">{event.progress}</p>}

        {event.status === "active" && event.is_cook_day && <section className="mt-10" aria-labelledby="reveal-heading">
            <h2 id="reveal-heading" className="sr-only">Die Gerichte</h2>
            {activeMedium.length > 0 && <section className="mb-8 rounded-3xl bg-red-50/60 p-5" aria-labelledby="active-handicaps">
                <h3 id="active-handicaps" className="text-sm font-semibold text-espresso">Heute im Spiel</h3>
                <ul className="mt-2 space-y-2 text-sm text-bark">{activeMedium.map((entry) => <li key={entry.handicap} className="flex items-start gap-3"><HandicapIcon id={entry.handicap} tier={entry.tier} title={entry.title} size={14} className="h-7 w-7 rounded-lg" /><span><span className="font-semibold text-red-700">{entry.title}</span>{entry.detail ? ` · ${entry.detail}` : ""}</span></li>)}</ul>
            </section>}
            {event.game.memory_phase === "waiting" && <div className="mb-8 rounded-3xl bg-espresso p-6 text-center text-white">
                <p className="text-sm">Memory-Modus: Nach dem Start habt ihr {event.game.memory_seconds / 60} Minuten, um euch alle Zutaten zu merken.</p>
                <button type="button" disabled={gameBusy} onClick={() => gameAction("memory-start")} className="mt-4 min-h-12 w-full rounded-full bg-saffron px-6 py-3 text-sm font-bold text-espresso disabled:opacity-60 sm:w-auto">Kochen starten</button>
            </div>}
            {event.game.memory_phase === "visible" && event.game.memory_started_at && <MemoryTimer startedAt={event.game.memory_started_at} seconds={event.game.memory_seconds} onExpire={load} />}
            {event.effects.includes("geteiltes_bewusstsein") && event.phase === "cooking" && <p className="mb-6 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">Geteiltes Bewusstsein: Du siehst {event.game.role === "A" ? "nur die Namen" : "nur Bilder und Mengen"}. Den Rest kennt dein Gegenüber.</p>}
            {event.mixed_ingredients && <section className="-mx-2 mb-8 rounded-[2rem] bg-white p-5 shadow-[0_12px_40px_rgba(66,52,33,0.12)] sm:mx-0 sm:p-8" aria-labelledby="mixed-title">
                <h3 id="mixed-title" className="font-semibold text-espresso">Alle Zutaten – bunt gemischt</h3>
                <p className="mt-1 text-xs text-bark">Kategorien-Salat: Welche Zutat gehört in welches Gericht?</p>
                <CookIngredients items={event.mixed_ingredients} />
            </section>}
            {event.recipes.map((recipe, index) => <motion.article key={recipe.title} initial={{ opacity: 0, y: 40, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 0.2 + index * 0.5, type: "spring", stiffness: 120 }} className="-mx-2 mb-8 overflow-hidden rounded-[2rem] bg-white sm:mx-0 shadow-[0_12px_40px_rgba(66,52,33,0.12)]">
                {recipe.image_data && <div className="overflow-hidden"><img src={recipe.image_data} alt={embargo ? "Verschwommenes Bild des Gerichts" : recipe.title} className={`aspect-square w-full object-cover sm:aspect-[16/10] ${embargo ? "scale-125 blur-[25px]" : ""}`} /></div>}
                <div className="p-5 sm:p-8">
                    <p className="text-xs font-bold tracking-[0.2em] text-caramel uppercase">{recipe.category}</p>
                    <h3 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-espresso sm:text-3xl">{recipe.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-bark">{recipe.description}</p>
                    <p className="mt-3 text-xs font-semibold text-bark">{recipe.servings} Portionen · ca. {recipe.total_time_minutes} Min.</p>
                    {recipe.ingredients.length > 0 && <CookIngredients items={recipe.ingredients} />}
                    {recipe.instructions.length > 0
                        ? <details className="mt-5 rounded-2xl bg-saffron/15 px-4 py-3 text-sm text-espresso"><summary className="min-h-8 cursor-pointer font-semibold">Originalzubereitung</summary><ol className="mt-2 list-decimal space-y-2 pl-5 leading-6">{recipe.instructions.map((step) => <li key={step}>{step}</li>)}</ol></details>
                        : <p className="mt-5 rounded-2xl bg-saffron/15 px-4 py-3 text-sm text-espresso">Keine Schritte, keine Reihenfolge – jetzt seid ihr dran.</p>}
                </div>
            </motion.article>)}
            {event.handicaps.some((entry) => entry.tier === "light" && entry.ingredient) && <section className="mb-8 rounded-3xl bg-red-50/60 p-5" aria-labelledby="handicaps-title">
                <h3 id="handicaps-title" className="text-sm font-semibold text-espresso">Aufgelöst: Zutaten-Handicaps</h3>
                <ul className="mt-2 space-y-1 text-sm text-bark">{event.handicaps.filter((entry) => entry.tier === "light").map((entry, index) => <li key={index} className="flex items-center gap-3"><HandicapIcon id={entry.handicap} tier="light" title={entry.title} size={14} className="h-7 w-7 rounded-lg" /><span><span className="font-semibold text-espresso">{entry.ingredient}</span> · {entry.title}</span></li>)}</ul>
            </section>}
            {(event.phase === "cooking" || event.tips.length > 0) && <TipChat eventId={event.id} tips={event.tips} tipCount={event.tip_count} onTip={load} readOnly={event.phase !== "cooking" || !event.game.can_ask || (event.effects.includes("ein_schuss") && event.tip_count >= 1)} effects={event.effects} askerEmail={event.game.asker_email} />}
            {!event.game.blind_revealed && event.phase === "cooking" ? <section className="mt-14 rounded-3xl bg-espresso p-6 text-center text-white" aria-label="Blindverkostung">
                <p className="text-sm">Blindverkostung: Erst wenn ihr fertig gekocht habt, wird aufgedeckt, was es sein sollte. Danach geht es zur Jury.</p>
                <button type="button" disabled={gameBusy} onClick={() => { if (window.confirm("Fertig gekocht? Dann jetzt aufdecken.")) void gameAction("blind-reveal"); }} className="mt-4 min-h-12 w-full rounded-full bg-saffron px-6 py-3 text-sm font-bold text-espresso disabled:opacity-60 sm:w-auto">Gericht aufdecken</button>
            </section> : <EventJury event={event} onChange={load} />}
        </section>}

        {event.status === "active" && <>
            {event.pantry.length > 0 && <section className="mt-10 rounded-3xl bg-cream/60 p-5" aria-labelledby="pantry-title">
                <h2 id="pantry-title" className="text-sm font-semibold text-espresso">Das solltet ihr zu Hause haben</h2>
                <p className="mt-1 text-sm text-bark">{event.pantry.join(", ")}</p>
            </section>}

            {!event.is_cook_day && <section className="mt-10" aria-labelledby="drops-title">
                <h2 id="drops-title" className="text-xl font-semibold text-espresso">Deine Pakete</h2>
                {event.images_pending && <p className="mt-2 rounded-2xl bg-saffron/15 px-4 py-3 text-sm text-espresso"><LoadingIndicator label="Die Bilder werden noch gemalt – gleich kannst du deine Pakete öffnen." /></p>}
                <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5">{event.drops.map((drop) => {
                    const isToday = drop.date === event.today;
                    return <li key={drop.day_index}>
                        {drop.state === "available" ? <motion.button type="button" onClick={() => reveal(drop.day_index)} disabled={opening !== null || event.images_pending} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                            animate={isToday && !event.images_pending ? { rotate: [0, -3, 3, 0] } : undefined} transition={isToday && !event.images_pending ? { duration: 0.6, repeat: Infinity, repeatDelay: 2 } : undefined}
                            className="flex aspect-square w-full touch-manipulation flex-col disabled:grayscale disabled:opacity-60 items-center justify-center rounded-3xl bg-gradient-to-br from-saffron to-caramel text-white shadow-[0_8px_20px_rgba(153,97,48,0.3)]">
                            {opening === drop.day_index ? <LoadingIndicator light label="" /> : <Gift size={24} aria-hidden="true" />}
                            <span className="mt-1 text-xs font-bold">{isToday ? "Heute" : formatDay(drop.date)}</span>
                            <span className="sr-only">Paket öffnen</span>
                        </motion.button>
                            : <div className={`flex aspect-square w-full flex-col items-center justify-center rounded-3xl p-2 text-center ${drop.state === "revealed" ? "bg-white shadow-[0_1px_2px_rgba(66,52,33,0.06)]" : "bg-espresso/5 text-bark/50"}`}>
                                {drop.state === "revealed"
                                    ? (drop.items?.[0] ? <IngredientPicture item={drop.items[0]} size="h-10 w-10" /> : <Sparkles size={20} className="text-caramel" aria-hidden="true" />)
                                    : <Lock size={18} aria-hidden="true" />}
                                <span className="mt-1 text-[11px] font-semibold text-bark">{formatDay(drop.date)}</span>
                                {drop.state === "revealed" && <span className="sr-only">geöffnet</span>}
                            </div>}
                    </li>;
                })}</ul>
            </section>}

            <section className="mt-10" aria-labelledby="mine-title">
                <h2 id="mine-title" className="text-xl font-semibold text-espresso">{event.is_cook_day ? "Was du mitbringen solltest" : "Deine Einkaufsliste"}</h2>
                {myItems.length === 0 ? <p className="mt-3 text-sm text-bark">Noch nichts aufgedeckt.</p>
                    : <ul className="mt-4 space-y-2">{myItems.map((item, index) => <li key={index} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-[0_1px_2px_rgba(66,52,33,0.06)]">
                        <IngredientPicture item={item} size="h-12 w-12" />
                        <span className="min-w-0 flex-1 text-sm font-semibold break-words text-espresso"><HandicapName item={item} />{item.handicap && <span className="block text-[11px] font-bold text-red-700">{item.handicap.title}</span>}</span>
                        <span className="shrink-0 text-sm font-semibold text-caramel">{formatAmount(item.amount, item.unit)}</span>
                    </li>)}</ul>}
                {event.drops.filter((drop) => drop.state === "revealed" && drop.teaser).length > 0 && <ul className="mt-4 space-y-2">{event.drops.filter((drop) => drop.state === "revealed" && drop.teaser).map((drop) => <li key={drop.day_index} className="flex gap-2 text-sm text-bark"><Sparkles size={14} className="mt-1 shrink-0 text-caramel" aria-hidden="true" />{drop.teaser}</li>)}</ul>}
            </section>

            <section className="mt-10" aria-labelledby="stats-title">
                <h2 id="stats-title" className="text-xl font-semibold text-espresso">Stand</h2>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">{event.stats.map((stat) => <li key={stat.email} className="rounded-3xl bg-white p-5 shadow-[0_1px_2px_rgba(66,52,33,0.06)]">
                    <p className="truncate text-sm font-semibold text-espresso">{stat.is_me ? "Du" : stat.email}</p>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-espresso/10" role="progressbar" aria-valuemin={0} aria-valuemax={event.days_total} aria-valuenow={stat.revealed} aria-label="Geöffnete Pakete">
                        <div className="h-full rounded-full bg-caramel transition-all" style={{ width: `${(stat.revealed / Math.max(1, event.days_total)) * 100}%` }} />
                    </div>
                    <p className="mt-2 text-xs text-bark">{stat.revealed} / {event.days_total} Pakete geöffnet{event.is_cook_day && ` · ${stat.tips} Tipps`}</p>
                </li>)}</ul>
            </section>
        </>}

        {event.is_creator && <button type="button" onClick={removeEvent} disabled={deleting} className="mt-14 flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-red-200 px-6 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50 sm:w-auto">
            <Trash2 size={16} aria-hidden="true" /> {deleting ? "Wird gelöscht…" : "Event löschen"}
        </button>}

        <AnimatePresence>{revealed && <RevealModal drop={revealed} onClose={() => setRevealed(null)} />}</AnimatePresence>
    </main>;
}
