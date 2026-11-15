"use client";
/* eslint-disable @next/next/no-img-element -- images are generated data URLs */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowUp, Gift, Lightbulb, Lock, Sparkles, Trash2, X } from "lucide-react";
import { DropItem, EventDetail as EventData, eventApi, formatAmount, formatDay } from "@/lib/events";
import { EventJury } from "@/components/event-jury";
import { FormattedMessage } from "@/components/formatted-message";
import { LoadingIndicator } from "@/components/loading-indicator";

type Revealed = { day_index: number; items: DropItem[]; teaser: string | null };

function IngredientPicture({ item, size = "h-16 w-16" }: { item: DropItem; size?: string }) {
    return item.image_data
        ? <img src={item.image_data} alt="" className={`${size} shrink-0 rounded-2xl object-cover`} />
        : <span className={`${size} grid shrink-0 place-items-center rounded-2xl bg-saffron/25 text-caramel`} aria-hidden="true"><Gift size={20} /></span>;
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
                            <p className="mt-3 text-lg font-semibold text-espresso">{item.name}</p>
                            <p className="text-sm font-semibold text-caramel">{formatAmount(item.amount, item.unit)}</p>
                        </motion.div>
                    </AnimatePresence>
                </div>}
                {isSummary && <ul className="mt-6 space-y-2 text-left">{drop.items.map((entry, index) => <motion.li key={entry.name} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.08 }} className="flex items-center gap-3 rounded-2xl bg-white p-2.5">
                    <IngredientPicture item={entry} size="h-12 w-12" />
                    <span className="min-w-0 flex-1 text-sm font-semibold break-words text-espresso">{entry.name}</span>
                    <span className="shrink-0 text-sm font-semibold text-caramel">{formatAmount(entry.amount, entry.unit)}</span>
                </motion.li>)}</ul>}
                <button type="button" onClick={next} autoFocus className="mt-6 min-h-12 w-full rounded-full bg-espresso px-6 py-3 text-sm font-semibold text-white transition hover:bg-caramel">{buttonLabel}</button>
                <p className="mt-4 text-xs text-bark">Psst – nur du siehst das.</p>
            </div>
        </motion.div>
    </motion.div>;
}

function TipChat({ eventId, tips, tipCount, onTip, readOnly = false }: { eventId: string; tips: EventData["tips"]; tipCount: number; onTip: () => void; readOnly?: boolean }) {
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
        <p className="mt-1 text-sm text-bark">Jede Antwort ist genau ein Hinweis und zählt für euer ganzes Event.</p>
        <div className="mt-6 space-y-4" aria-live="polite">{tips.map((tip) => <div key={tip.created_at} className="space-y-2">
            <p className="ml-auto max-w-[85%] rounded-[1.25rem] rounded-br-md bg-espresso px-4 py-2.5 text-sm text-white sm:max-w-md"><span className="block text-[10px] font-bold opacity-70">{tip.email}</span>{tip.question}</p>
            <div className="max-w-[85%] rounded-[1.25rem] rounded-bl-md bg-white px-4 py-2.5 text-sm leading-6 text-espresso shadow-[0_1px_2px_rgba(66,52,33,0.06)] sm:max-w-md"><FormattedMessage text={tip.answer} /></div>
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
    const daysLeft = Math.round((Date.parse(event.cook_date) - Date.parse(event.today)) / 86_400_000);

    return <main className="mx-auto max-w-3xl px-5 pt-4 pb-[calc(8rem+env(safe-area-inset-bottom))] sm:px-8 sm:pt-8">
        <Link href="/events" className="-ml-1 flex min-h-11 w-fit items-center gap-1 px-1 text-sm font-semibold text-caramel"><ArrowLeft size={15} aria-hidden="true" /> Alle Events</Link>
        <p className="mt-6 text-xs font-bold tracking-[0.2em] text-caramel uppercase">{event.categories.join(" · ")}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-[-0.04em] text-espresso sm:text-4xl">{event.title}</h1>
        <p className="mt-2 text-sm text-bark">Kochtag: {formatDay(event.cook_date, { weekday: "long", day: "numeric", month: "long" })}{!event.is_cook_day && daysLeft > 0 && ` · noch ${daysLeft} ${daysLeft === 1 ? "Tag" : "Tage"}`}</p>
        {error && <p role="alert" className="mt-6 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{error}</p>}

        {event.status === "generating" && <div className="mt-10 rounded-3xl bg-white p-6"><LoadingIndicator label={event.progress || "Das Event wird vorbereitet…"} /></div>}
        {event.status === "failed" && <p className="mt-10 rounded-3xl bg-red-50 p-6 text-sm text-red-800">{event.progress}</p>}

        {event.status === "active" && event.is_cook_day && <section className="mt-10" aria-labelledby="reveal-heading">
            <h2 id="reveal-heading" className="sr-only">Die Gerichte</h2>
            {event.recipes.map((recipe, index) => <motion.article key={recipe.title} initial={{ opacity: 0, y: 40, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 0.2 + index * 0.5, type: "spring", stiffness: 120 }} className="-mx-2 mb-8 overflow-hidden rounded-[2rem] bg-white sm:mx-0 shadow-[0_12px_40px_rgba(66,52,33,0.12)]">
                {recipe.image_data && <img src={recipe.image_data} alt={recipe.title} className="aspect-square w-full object-cover sm:aspect-[16/10]" />}
                <div className="p-5 sm:p-8">
                    <p className="text-xs font-bold tracking-[0.2em] text-caramel uppercase">{recipe.category}</p>
                    <h3 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-espresso sm:text-3xl">{recipe.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-bark">{recipe.description}</p>
                    <p className="mt-3 text-xs font-semibold text-bark">{recipe.servings} Portionen · ca. {recipe.total_time_minutes} Min.</p>
                    <ul className="mt-5 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">{recipe.ingredients.map((ingredient) => <li key={ingredient.name} className="flex justify-between gap-3 border-b border-espresso/5 py-1.5"><span className="min-w-0 break-words text-espresso">{ingredient.name}</span><span className="shrink-0 font-semibold text-caramel">{formatAmount(ingredient.amount, ingredient.unit)}</span></li>)}</ul>
                    {recipe.instructions.length > 0
                        ? <details className="mt-5 rounded-2xl bg-saffron/15 px-4 py-3 text-sm text-espresso"><summary className="min-h-8 cursor-pointer font-semibold">Originalzubereitung</summary><ol className="mt-2 list-decimal space-y-2 pl-5 leading-6">{recipe.instructions.map((step) => <li key={step}>{step}</li>)}</ol></details>
                        : <p className="mt-5 rounded-2xl bg-saffron/15 px-4 py-3 text-sm text-espresso">Keine Schritte, keine Reihenfolge – jetzt seid ihr dran.</p>}
                </div>
            </motion.article>)}
            {(event.phase === "cooking" || event.tips.length > 0) && <TipChat eventId={event.id} tips={event.tips} tipCount={event.tip_count} onTip={load} readOnly={event.phase !== "cooking"} />}
            <EventJury event={event} onChange={load} />
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
                    : <ul className="mt-4 space-y-2">{myItems.map((item) => <li key={item.name} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-[0_1px_2px_rgba(66,52,33,0.06)]">
                        <IngredientPicture item={item} size="h-12 w-12" />
                        <span className="min-w-0 flex-1 text-sm font-semibold break-words text-espresso">{item.name}</span>
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
