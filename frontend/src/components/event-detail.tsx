"use client";
/* eslint-disable @next/next/no-img-element -- images are generated data URLs */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, ReactNode, useCallback, useEffect, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { ArrowUp, BookmarkPlus, Check, ChevronDown, ChevronLeft, Gift, Lightbulb, ShoppingBasket, Sparkles, Trash2, X } from "lucide-react";
import { Drop, DropItem, EventDetail as EventData, EventIngredient, eventApi, formatAmount, formatDay } from "@/lib/events";
import { EventGuess } from "@/components/event-guess";
import { DishJuryPanel, EventJury } from "@/components/event-jury";
import { HandicapName, HandicapPicture } from "@/components/handicap-visual";
import { HandicapIcon } from "@/components/handicap-icons";
import { FormattedMessage } from "@/components/formatted-message";
import { LoadingIndicator } from "@/components/loading-indicator";
import { Toast, toastActionClass, useToast } from "@/components/toast";
import { addShoppingItems } from "@/lib/shopping-list";
import { CopyIngredients } from "@/components/copy-ingredients";
import { EventDebrief } from "@/components/event-debrief";
import { DayTrack, GiftBox, Stage, StageLabel, day, ease, plural, stageOf } from "@/components/event-stage";

type Revealed = { day_index: number; items: DropItem[]; teaser: string | null };

const IngredientPicture = HandicapPicture;

const grow = { initial: { height: 0, opacity: 0 }, animate: { height: "auto", opacity: 1 }, exit: { height: 0, opacity: 0 }, transition: { duration: 0.3, ease } };
const weekday = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("de-DE", { weekday: "short" }).replace(".", "");
const dayOfMonth = (iso: string) => Number(iso.slice(8, 10));

/** Kleine Abschnitts-Überschrift im Stil der Einkaufsliste, rechts optional Info oder Aktion. */
function SectionHeading({ id, children, aside }: { id: string; children: ReactNode; aside?: ReactNode }) {
    return <div className="flex min-h-8 items-center justify-between gap-3 px-1">
        <h2 id={id} className="text-[11px] font-semibold tracking-[0.14em] text-bark/75 uppercase">{children}</h2>
        {aside}
    </div>;
}

/** Alle aktiven Handicaps: eingeklappt nur Icons und Summe, aufgeklappt die Details mit Link in den Shop. */
function HandicapBar({ handicaps, spent }: { handicaps: EventData["handicaps"]; spent: number }) {
    const [open, setOpen] = useState(false);
    // Several light handicaps of the same kind show up once with a counter.
    const grouped = [...handicaps.reduce((map, entry) => map.set(entry.handicap, { ...entry, count: (map.get(entry.handicap)?.count ?? 0) + 1 }), new Map<string, EventData["handicaps"][number] & { count: number }>()).values()];
    const order = { heavy: 0, medium: 1, light: 2 } as Record<string, number>;
    grouped.sort((a, b) => order[a.tier] - order[b.tier]);
    return <div className="mt-6 overflow-hidden rounded-2xl bg-white ring-1 ring-red-200/70">
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="handicap-list" className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors active:bg-red-50/60">
            <span className="flex shrink-0 -space-x-2" aria-hidden="true">{grouped.slice(0, 4).map((entry) => <HandicapIcon key={entry.handicap} id={entry.handicap} tier={entry.tier} title={entry.title} size={12} className="h-8 w-8 rounded-full ring-2 ring-white" />)}</span>
            <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-espresso">{plural(handicaps.length, "Handicap", "Handicaps")} aktiv</span>
                <span className="block text-xs text-red-700">{plural(spent, "Strafpunkt", "Strafpunkte")} eingelöst</span>
            </span>
            <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.25, ease }} className="grid shrink-0 text-bark/60" aria-hidden="true"><ChevronDown size={18} /></motion.span>
        </button>
        <AnimatePresence initial={false}>
            {open && <motion.div id="handicap-list" {...grow} className="overflow-hidden">
                <ul className="px-4 pb-2">{grouped.map((entry) => <li key={entry.handicap} className="flex gap-3 border-t border-espresso/[0.06] py-3">
                    <HandicapIcon id={entry.handicap} tier={entry.tier} title={entry.title} size={16} className="h-11 w-11" />
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-espresso">{entry.title}{entry.count > 1 && <span className="ml-1 text-caramel">×{entry.count}</span>}</p>
                        {entry.description && <p className="mt-0.5 text-sm leading-6 text-bark">{entry.description}</p>}
                        <Link href={`/handicaps#${entry.handicap}`} className="mt-1 inline-flex min-h-8 items-center text-xs font-semibold text-caramel">Im Shop ansehen</Link>
                    </div>
                </li>)}</ul>
            </motion.div>}
        </AnimatePresence>
    </div>;
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

function RevealModal({ drop, onClose, startAtSummary = false }: { drop: Revealed; onClose: () => void; startAtSummary?: boolean }) {
    // Several ingredients are unwrapped one after another; the last step shows the whole package.
    const count = drop.items.length;
    // Schon ausgepackt und nochmal angetippt: direkt die Übersicht zeigen, nicht alles neu auspacken.
    const [step, setStep] = useState(startAtSummary && count > 1 ? count : 0);
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
            className="relative max-h-[88dvh] w-full max-w-sm overflow-x-hidden overflow-y-auto overscroll-contain rounded-[2rem] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden bg-linen p-6 text-center shadow-2xl sm:p-7">
            {/* The rotating glow is clipped by its own box, so it never changes the dialog's scroll size (no jumping scrollbar). */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-[2rem]">
                <motion.div className="absolute -inset-20 bg-[conic-gradient(from_0deg,transparent,rgba(240,180,41,0.35),transparent_40%)]" animate={{ rotate: 360 }} transition={{ duration: 6, repeat: Infinity, ease: "linear" }} />
            </div>
            <button type="button" onClick={onClose} aria-label="Schließen" className="absolute top-3 right-3 z-10 grid h-11 w-11 place-items-center rounded-full text-bark hover:bg-espresso/5"><X size={18} /></button>
            <div className="relative">
                <p className="text-xs font-bold tracking-[0.2em] text-caramel uppercase">Tag {drop.day_index + 1}{count > 1 && !isSummary && ` · ${step + 1} von ${count}`}</p>
                <h2 id="reveal-title" className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-espresso">{count === 0 ? "Hinweis des Tages" : isSummary ? "Dein Päckchen" : "Deine Zutat"}</h2>
                {count === 0 && <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="mt-6 flex items-start gap-3 rounded-2xl bg-white p-4 text-left text-sm leading-6 text-espresso"><Sparkles size={18} className="mt-0.5 shrink-0 text-caramel" aria-hidden="true" />{drop.teaser}</motion.p>}
                {count > 0 && !isSummary && <div className="mt-6 grid min-h-64 place-items-center overflow-hidden" aria-live="polite">
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

/** After the event: copy a dish into the player's own recipes (with steps), then link to it. */
function SaveRecipeButton({ eventId, recipeId }: { eventId: string; recipeId: string }) {
    const [state, setState] = useState<{ busy: boolean; id: string | null; already: boolean; error: string }>({ busy: false, id: null, already: false, error: "" });
    async function save() {
        setState({ ...state, busy: true, error: "" });
        try {
            const result = await eventApi<{ id: string; already_saved: boolean }>(`/events/${eventId}/recipes/${recipeId}/save`, { method: "POST" });
            setState({ busy: false, id: result.id, already: result.already_saved, error: "" });
        } catch (caught) { setState({ ...state, busy: false, error: (caught as Error).message }); }
    }
    if (state.id) return <p className="mt-5 flex flex-wrap items-center gap-2 text-sm font-semibold text-espresso"><Check size={16} className="text-caramel" aria-hidden="true" />{state.already ? "Schon in deinen Rezepten" : "In deinen Rezepten gespeichert"}<Link href={`/recipes/${state.id}`} className="text-caramel underline">Ansehen</Link></p>;
    return <div className="mt-5">
        <button type="button" onClick={save} disabled={state.busy} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-espresso px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-caramel disabled:opacity-70">
            {state.busy ? <LoadingIndicator light label="Wird gespeichert…" /> : <><BookmarkPlus size={16} aria-hidden="true" />Als Rezept speichern</>}
        </button>
        {state.error && <p role="alert" className="mt-2 text-sm text-red-700">{state.error}</p>}
    </div>;
}

function headline(event: EventData, stage: Stage) {
    switch (stage.kind) {
        case "upcoming": return `Erstes Päckchen ${day(event.start_date)} · Kochtag ${day(event.cook_date)}`;
        case "running": return stage.daysLeft === 1 ? `Morgen ist Kochtag · ${day(event.cook_date)}` : `Kochtag ${day(event.cook_date)} · noch ${stage.daysLeft} Tage`;
        case "finished": return `Gekocht am ${day(event.cook_date, { day: "numeric", month: "long", year: "numeric" })}`;
        default: return `Kochtag ${day(event.cook_date, { weekday: "long", day: "numeric", month: "long" })}`;
    }
}

/** Seitenrahmen: Hintergrund, Breite, Zurück-Link. */
function Frame({ children }: { children: ReactNode }) {
    return <MotionConfig reducedMotion="user">
        <main className="flex-1 bg-linen">
            <div className="mx-auto w-full max-w-2xl px-5 pt-3 pb-[calc(8rem+env(safe-area-inset-bottom))] sm:px-8 sm:pt-8">
                <Link href="/events" className="-ml-2 flex h-10 w-fit items-center gap-0.5 rounded-full pr-3 pl-1 text-sm font-semibold text-caramel transition active:bg-caramel/10"><ChevronLeft size={20} strokeWidth={2.25} aria-hidden="true" />Events</Link>
                {children}
            </div>
        </main>
    </MotionConfig>;
}

/** Die wichtigste Aktion der Päckchen-Phase, groß und daumenfreundlich. */
function TodayCard({ drops, today, imagesPending, opening, onOpen }: { drops: Drop[]; today: string; imagesPending: boolean; opening: boolean; onOpen: (dayIndex: number) => void }) {
    const first = drops[0];
    const disabled = imagesPending || opening;
    const eyebrow = imagesPending ? "Gleich bereit" : drops.length > 1 ? `${drops.length} Päckchen offen` : first.date === today ? "Heute" : day(first.date);
    const title = imagesPending ? "Die Bilder werden noch gemalt…" : drops.length > 1 ? "Deine Päckchen warten" : "Dein Päckchen wartet";
    return <motion.button type="button" onClick={() => onOpen(first.day_index)} disabled={disabled}
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease, delay: 0.08 }}
        className="mt-6 flex w-full items-center gap-4 rounded-[1.75rem] bg-white p-4 text-left shadow-[0_1px_2px_rgba(66,52,33,0.05),0_14px_36px_-24px_rgba(66,52,33,0.4)] ring-1 ring-espresso/[0.06] transition-transform select-none active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-caramel/50">
        <motion.span className={`grid shrink-0 ${imagesPending ? "opacity-60 grayscale" : ""}`} animate={disabled ? { rotate: 0 } : { rotate: [0, -7, 6, -3, 0] }} transition={disabled ? undefined : { duration: 0.7, repeat: Infinity, repeatDelay: 2.4 }}>
            <GiftBox className="relative h-16 w-16 rounded-2xl shadow-[0_10px_20px_-10px_rgba(153,97,48,0.8)]" />
        </motion.span>
        <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-semibold tracking-[0.16em] text-caramel uppercase">{eyebrow}</span>
            <span className="mt-0.5 block text-lg leading-snug font-semibold tracking-[-0.02em] text-espresso">{title}</span>
        </span>
        {imagesPending || opening
            ? <span className="shrink-0 px-2"><LoadingIndicator label="" /></span>
            : <span className="shrink-0 rounded-full bg-espresso px-4 py-2.5 text-sm font-semibold text-white">Öffnen</span>}
    </motion.button>;
}

/** Der Kalender: verschlossen, bereit zum Auspacken (Päckchen mit Schleife) oder ausgepackt (Bild der Zutat). */
function DropCalendar({ drops, today, opening, disabled, onOpen, onView }: { drops: Drop[]; today: string; opening: number | null; disabled: boolean; onOpen: (dayIndex: number) => void; onView: (drop: Drop) => void }) {
    const opened = drops.filter((drop) => drop.state === "revealed").length;
    return <section className="mt-9" aria-labelledby="drops-title">
        <SectionHeading id="drops-title" aside={<span className="text-xs text-bark/60 tabular-nums">{opened} von {drops.length} geöffnet</span>}>Deine Päckchen</SectionHeading>
        <ul className="mt-2.5 grid grid-cols-4 gap-2 sm:grid-cols-6 sm:gap-2.5">
            {drops.map((drop, index) => <motion.li key={drop.day_index} initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 + index * 0.03, type: "spring", stiffness: 420, damping: 28 }}>
                <DropTile drop={drop} isToday={drop.date === today} opening={opening === drop.day_index} disabled={disabled} onOpen={onOpen} onView={onView} />
            </motion.li>)}
        </ul>
    </section>;
}

function DropTile({ drop, isToday, opening, disabled, onOpen, onView }: { drop: Drop; isToday: boolean; opening: boolean; disabled: boolean; onOpen: (dayIndex: number) => void; onView: (drop: Drop) => void }) {
    const base = "relative block aspect-square w-full overflow-hidden rounded-2xl select-none [-webkit-touch-callout:none]";
    const when = formatDay(drop.date, { weekday: "long", day: "numeric", month: "long" });
    if (drop.state === "available") {
        return <motion.button type="button" onClick={() => onOpen(drop.day_index)} disabled={disabled} aria-label={`Päckchen vom ${when} öffnen`}
            whileTap={{ scale: 0.9 }} animate={isToday && !disabled ? { rotate: [0, -5, 5, -2, 0] } : { rotate: 0 }} transition={isToday && !disabled ? { duration: 0.7, repeat: Infinity, repeatDelay: 2.2 } : undefined}
            className={`${base} shadow-[0_10px_20px_-12px_rgba(153,97,48,0.9)] disabled:opacity-60 disabled:grayscale ${isToday ? "ring-2 ring-saffron ring-offset-2 ring-offset-linen" : ""}`}>
            <GiftBox className="absolute inset-0" />
            <span className="absolute top-1.5 left-2 text-[13px] font-bold text-white" aria-hidden="true">{dayOfMonth(drop.date)}</span>
            {opening && <span className="absolute inset-0 grid place-items-center bg-espresso/45"><LoadingIndicator light label="" /></span>}
        </motion.button>;
    }
    if (drop.state === "revealed") {
        const items = drop.items ?? [];
        return <button type="button" onClick={() => onView(drop)} aria-label={`Päckchen vom ${when} ansehen`} className={`${base} bg-white ring-1 ring-espresso/[0.07] transition-transform active:scale-95`}>
            {items[0] ? <span className="absolute inset-0"><IngredientPicture item={items[0]} size="h-full w-full" /></span>
                : <span className="absolute inset-0 grid place-items-center text-caramel"><Sparkles size={20} aria-hidden="true" /></span>}
            <span className="absolute top-1.5 left-1.5 rounded-full bg-white/90 px-1.5 py-0.5 text-[11px] leading-none font-bold text-espresso" aria-hidden="true">{dayOfMonth(drop.date)}</span>
            {items.length > 1 && <span className="absolute right-1.5 bottom-1.5 rounded-full bg-espresso/80 px-1.5 py-0.5 text-[10px] leading-none font-semibold text-white" aria-hidden="true">+{items.length - 1}</span>}
        </button>;
    }
    return <div className={`${base} grid place-items-center bg-espresso/[0.045] text-bark/45`}>
        <span className="text-center leading-none" aria-hidden="true">
            <span className="block text-[10px] font-semibold tracking-wide uppercase">{weekday(drop.date)}</span>
            <span className="mt-1 block text-lg font-semibold tracking-[-0.03em]">{dayOfMonth(drop.date)}</span>
        </span>
        <span className="sr-only">{when}, noch verschlossen</span>
    </div>;
}

function MyIngredients({ title, items, carted, onCart }: { title: string; items: DropItem[]; carted: Set<number>; onCart: (indices: number[]) => void }) {
    return <section className="mt-9" aria-labelledby="mine-title">
        <SectionHeading id="mine-title" aside={items.length > 0 && <button type="button" onClick={() => onCart(items.map((_, index) => index))}
            className="-mr-2 flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold text-caramel transition hover:bg-caramel/10 active:scale-95 active:bg-caramel/15">
            <ShoppingBasket size={14} strokeWidth={2.25} aria-hidden="true" />Alle auf die Liste
        </button>}>{title}</SectionHeading>
        {items.length === 0
            ? <p className="mt-2.5 rounded-2xl border border-dashed border-espresso/15 px-4 py-5 text-center text-sm text-bark">Noch nichts ausgepackt – deine Zutaten landen hier.</p>
            : <ul className="mt-2.5 overflow-hidden rounded-2xl bg-white ring-1 ring-espresso/[0.07]">{items.map((item, index) => <li key={index} className="group/row relative flex items-center gap-3 py-2.5 pr-2 pl-3">
                <span aria-hidden="true" className="pointer-events-none absolute top-0 right-0 left-[4.25rem] h-px bg-espresso/[0.07] group-first/row:hidden" />
                <IngredientPicture item={item} size="h-11 w-11" />
                <span className="min-w-0 flex-1">
                    <span className="block text-[15px] leading-snug font-medium break-words text-espresso"><HandicapName item={item} /></span>
                    {item.handicap && <span className="mt-0.5 block text-[11px] font-semibold text-red-700">{item.handicap.title}</span>}
                </span>
                <span className="shrink-0 text-sm font-medium text-bark tabular-nums">{formatAmount(item.amount, item.unit)}</span>
                <button type="button" onClick={() => onCart([index])} aria-label={carted.has(index) ? `${item.name} ist auf der Einkaufsliste` : `${item.name} zur Einkaufsliste`}
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-full transition active:scale-90 ${carted.has(index) ? "bg-saffron/30 text-espresso" : "text-bark hover:bg-linen hover:text-espresso"}`}>
                    <motion.span key={String(carted.has(index))} initial={carted.has(index) ? { scale: 0.4 } : false} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 600, damping: 22 }} className="grid">
                        {carted.has(index) ? <Check size={17} strokeWidth={2.5} aria-hidden="true" /> : <ShoppingBasket size={17} aria-hidden="true" />}
                    </motion.span>
                </button>
            </li>)}</ul>}
    </section>;
}

function Standings({ stats, total, showTips }: { stats: EventData["stats"]; total: number; showTips: boolean }) {
    const sorted = [...stats].sort((a, b) => Number(b.is_me) - Number(a.is_me));
    return <section className="mt-9" aria-labelledby="stats-title">
        <SectionHeading id="stats-title">Stand</SectionHeading>
        <ul className="mt-2.5 overflow-hidden rounded-2xl bg-white ring-1 ring-espresso/[0.07]">{sorted.map((stat, index) => {
            const handle = stat.email.split("@")[0];
            const name = stat.is_me ? "Du" : handle.charAt(0).toUpperCase() + handle.slice(1);
            return <li key={stat.email} className="group/row relative flex items-center gap-3 px-4 py-3.5">
                <span aria-hidden="true" className="pointer-events-none absolute top-0 right-0 left-[3.75rem] h-px bg-espresso/[0.07] group-first/row:hidden" />
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-semibold uppercase ${stat.is_me ? "bg-caramel text-white" : "bg-cream text-caramel"}`} aria-hidden="true">{name.charAt(0)}</span>
                <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-[15px] font-medium text-espresso" title={stat.email}>{name}</span>
                        <span className="shrink-0 text-xs text-bark tabular-nums">{stat.revealed}/{total}{showTips && ` · ${plural(stat.tips, "Tipp", "Tipps")}`}</span>
                    </span>
                    <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-espresso/[0.07]" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={stat.revealed} aria-label={`${name}: geöffnete Päckchen`}>
                        <motion.span className="block h-full rounded-full bg-caramel" initial={{ width: 0 }} animate={{ width: `${(stat.revealed / Math.max(1, total)) * 100}%` }} transition={{ duration: 0.6, ease, delay: 0.15 + index * 0.06 }} />
                    </span>
                </span>
            </li>;
        })}</ul>
    </section>;
}

/** Löschen in zwei Schritten mit klarer Erklärung – statt Browser-Dialog. */
function DeleteEvent({ busy, onConfirm }: { busy: boolean; onConfirm: () => void }) {
    const [confirming, setConfirming] = useState(false);
    return <div className="mt-14">
        <AnimatePresence mode="wait" initial={false}>
            {confirming
                ? <motion.div key="confirm" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={{ duration: 0.25, ease }} className="rounded-[1.75rem] bg-red-50 p-5" role="alertdialog" aria-labelledby="delete-title" aria-describedby="delete-text">
                    <p id="delete-title" className="font-semibold text-red-900">Event für alle löschen?</p>
                    <p id="delete-text" className="mt-1 text-sm leading-6 text-red-800">Päckchen, Rezepte und Tipps gehen für alle Teilnehmenden verloren. Das lässt sich nicht rückgängig machen.</p>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                        <button type="button" onClick={() => setConfirming(false)} disabled={busy} autoFocus className="min-h-11 rounded-full bg-white text-sm font-semibold text-espresso ring-1 ring-espresso/10 transition active:scale-95">Abbrechen</button>
                        <button type="button" onClick={onConfirm} disabled={busy} className="min-h-11 rounded-full bg-red-600 text-sm font-semibold text-white transition active:scale-95 disabled:opacity-60">{busy ? "Wird gelöscht…" : "Endgültig löschen"}</button>
                    </div>
                </motion.div>
                : <motion.div key="button" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} className="flex justify-center">
                    <button type="button" onClick={() => setConfirming(true)} className="flex h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold text-red-700 transition hover:bg-red-50 active:scale-95 active:bg-red-50"><Trash2 size={16} aria-hidden="true" />Event löschen</button>
                </motion.div>}
        </AnimatePresence>
    </div>;
}

function DetailSkeleton() {
    return <div className="mt-3 motion-safe:animate-shimmer" role="status" aria-label="Event wird geladen…">
        <div aria-hidden="true">
            <div className="h-2.5 w-24 rounded-full bg-espresso/[0.08]" />
            <div className="mt-4 h-8 w-4/5 rounded-full bg-espresso/[0.08]" />
            <div className="mt-3 h-3 w-1/2 rounded-full bg-espresso/[0.06]" />
            <div className="mt-6 h-2 w-full rounded-full bg-espresso/[0.06]" />
            <div className="mt-9 grid grid-cols-4 gap-2">{Array.from({ length: 8 }, (_, index) => <div key={index} className="aspect-square rounded-2xl bg-espresso/[0.05]" />)}</div>
        </div>
    </div>;
}

export function EventDetail({ eventId }: { eventId: string }) {
    const [event, setEvent] = useState<EventData | null>(null);
    const [error, setError] = useState("");
    const [opening, setOpening] = useState<number | null>(null);
    const [revealed, setRevealed] = useState<(Revealed & { again?: boolean }) | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [gameBusy, setGameBusy] = useState(false);
    // Indices of "my" ingredients already put on the shopping list in this visit (for the check mark).
    const [carted, setCarted] = useState<Set<number>>(new Set());
    const { toast, show: showToast, hide: hideToast } = useToast();

    async function gameAction(action: "memory-start" | "blind-reveal") {
        setGameBusy(true); setError("");
        try { await eventApi(`/events/${eventId}/game/${action}`, { method: "POST" }); await load(); }
        catch (caught) { setError((caught as Error).message); } finally { setGameBusy(false); }
    }
    const router = useRouter();

    async function removeEvent() {
        setDeleting(true); setError("");
        try {
            await eventApi(`/admin/events/${eventId}`, { method: "DELETE" });
            router.replace("/events");
        } catch (caught) { setError((caught as Error).message); setDeleting(false); }
    }

    const load = useCallback(() => eventApi<EventData>(`/events/${eventId}`)
        // Measure the clock offset here (outside render) so synced animations use server time.
        .then((data) => setEvent({ ...data, clock_offset: Date.parse(data.server_now) - Date.now() }))
        .catch((caught: Error) => setError(caught.message)), [eventId]);
    useEffect(() => { void load(); }, [load]);
    // Live updates: poll a tiny signature and only reload the full event when something changed
    // (partner revealed or handed in, tip asked, jury started/finished, images ready …).
    const live = event !== null && event.phase !== "finished" && event.status !== "failed";
    useEffect(() => {
        if (!live) return;
        let last = "";
        const timer = window.setInterval(() => {
            void eventApi<{ signature: string }>(`/events/${eventId}/pulse`).then(({ signature }) => {
                if (last && signature !== last) void load();
                last = signature;
            }).catch(() => undefined);
        }, 4000);
        return () => window.clearInterval(timer);
    }, [live, eventId, load]);

    async function reveal(dayIndex: number) {
        setOpening(dayIndex); setError("");
        try {
            setRevealed(await eventApi<Revealed>(`/events/${eventId}/drops/${dayIndex}/reveal`, { method: "POST" }));
            void load();
        } catch (caught) { setError((caught as Error).message); } finally { setOpening(null); }
    }

    if (!event) return <Frame>
        {error
            ? <div role="alert" className="mt-6 rounded-[1.75rem] bg-red-50 px-5 py-5 text-sm text-red-800">
                <p className="font-medium">{error}</p>
                <button type="button" onClick={() => { setError(""); void load(); }} className="mt-3 rounded-full bg-white px-4 py-2 text-sm font-semibold text-red-800 ring-1 ring-red-200 transition active:scale-95">Erneut versuchen</button>
            </div>
            : <DetailSkeleton />}
    </Frame>;

    const myItems = event.drops.flatMap((drop) => drop.items ?? []);

    function addToCart(indices: number[]) {
        const items = indices.map((index) => myItems[index]).filter(Boolean);
        if (!items.length) return;
        const { added, merged } = addShoppingItems(items.map((item) => ({ name: item.name, amount: item.amount, unit: item.unit })), `Event: ${event!.title}`);
        setCarted((current) => new Set([...current, ...indices]));
        const count = added + merged;
        showToast(`${count} ${count === 1 ? "Zutat" : "Zutaten"} auf der Einkaufsliste${merged ? ` · ${merged} zusammengefasst` : ""}`, <Link href="/einkaufsliste" className={toastActionClass}>Ansehen</Link>);
    }
    const embargo = event.effects.includes("bild_embargo") && event.phase !== "finished";
    const activeMedium = event.handicaps.filter((entry) => entry.tier !== "light");
    const stage = stageOf(event, event.today);
    const available = event.drops.filter((drop) => drop.state === "available");
    const teasers = event.drops.filter((drop) => drop.state === "revealed" && drop.teaser);

    return <Frame>
        <motion.header initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease }} className="mt-4">
            <StageLabel stage={stage} />
            <h1 className="mt-2.5 text-[2.25rem] leading-[1.05] font-semibold tracking-[-0.05em] text-balance text-espresso sm:text-5xl">{event.title}</h1>
            <p className="mt-2 text-sm leading-6 text-bark">{headline(event, stage)}</p>
            {event.categories.length > 0 && <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Gerichte">{event.categories.map((category) => <li key={category} className="rounded-full bg-cream px-2.5 py-1 text-xs font-medium text-bark">{category}</li>)}</ul>}
            {stage.kind === "running" && <DayTrack day={stage.day} total={stage.total} delay={0.15} />}
        </motion.header>
        {/* Die tägliche Hauptaktion steht ganz oben – noch vor den Handicaps. */}
        {event.status === "active" && !event.is_cook_day && available.length > 0 && <TodayCard drops={available} today={event.today} imagesPending={event.images_pending} opening={opening !== null} onOpen={reveal} />}
        {event.handicaps.length > 0 && <HandicapBar handicaps={event.handicaps} spent={event.penalty_spent} />}
        {error && <p role="alert" className="mt-6 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{error}</p>}

        {event.status === "generating" && <div className="mt-8 rounded-[1.75rem] bg-white p-5 ring-1 ring-espresso/[0.06]">
            <p className="text-sm font-medium text-espresso">{event.progress || "Das Event wird vorbereitet…"}</p>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-espresso/[0.07]" aria-hidden="true">
                <motion.div className="h-full w-1/3 rounded-full bg-caramel/60" animate={{ x: ["-100%", "300%"] }} transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }} />
            </div>
        </div>}
        {event.status === "failed" && <p className="mt-8 rounded-[1.75rem] bg-red-50 p-5 text-sm leading-6 text-red-800">{event.progress || "Beim Vorbereiten ist etwas schiefgelaufen."}</p>}

        {event.status === "active" && event.is_cook_day && <section className="mt-10" aria-labelledby="reveal-heading">
            <h2 id="reveal-heading" className="sr-only">Die Gerichte</h2>
            {activeMedium.length > 0 && <section className="mb-8 rounded-3xl bg-red-50/60 p-5" aria-labelledby="active-handicaps">
                <h3 id="active-handicaps" className="text-sm font-semibold text-espresso">Heute im Spiel</h3>
                <ul className="mt-2 space-y-2 text-sm text-bark">{activeMedium.map((entry) => <li key={entry.handicap} className="flex items-start gap-3"><HandicapIcon id={entry.handicap} tier={entry.tier} title={entry.title} size={14} className="h-7 w-7 rounded-lg" /><span><span className="font-semibold text-red-700">{entry.title}</span>{entry.detail ? ` · ${entry.detail}` : ""}</span></li>)}</ul>
            </section>}
            {event.guessing && <EventGuess event={event} onChange={load} />}
            {!(event.guessing && !event.guessing.done) && <>
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
                        {/* Not while "Memory" runs: copying the list would undo the handicap. */}
                        {recipe.ingredients.some((item) => item.name && item.mask !== "memory") && !(event.effects.includes("memory") && event.phase !== "finished") && <CopyIngredients className="mt-5"
                            ingredients={recipe.ingredients.filter((item) => item.name && item.mask !== "memory").map((item) => ({ name: item.name, amount: item.amount, unit: item.unit }))} baseServings={recipe.servings} />}
                        {recipe.instructions.length > 0
                            ? <details className="mt-5 rounded-2xl bg-saffron/15 px-4 py-3 text-sm text-espresso"><summary className="min-h-8 cursor-pointer font-semibold">Originalzubereitung</summary><ol className="mt-2 list-decimal space-y-2 pl-5 leading-6">{recipe.instructions.map((step) => <li key={step}>{step}</li>)}</ol></details>
                            : <p className="mt-5 rounded-2xl bg-saffron/15 px-4 py-3 text-sm text-espresso">Keine Schritte, keine Reihenfolge – jetzt seid ihr dran.</p>}
                        {event.phase === "finished" && <SaveRecipeButton eventId={event.id} recipeId={recipe.id} />}
                        {event.game.blind_revealed && <DishJuryPanel event={event} recipe={recipe} onChange={load} />}
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
                {(event.phase === "judged" || event.phase === "finished") && <EventDebrief eventId={event.id} />}
            </>}
        </section>}

        {event.status === "active" && <>
            {!event.is_cook_day && <DropCalendar drops={event.drops} today={event.today} opening={opening} disabled={opening !== null || event.images_pending} onOpen={reveal}
                onView={(drop) => setRevealed({ day_index: drop.day_index, items: drop.items ?? [], teaser: drop.teaser ?? null, again: true })} />}
            <MyIngredients title={event.is_cook_day ? "Was du mitbringen solltest" : "Deine Zutaten"} items={myItems} carted={carted} onCart={addToCart} />
            {teasers.length > 0 && <section className="mt-9" aria-labelledby="hints-title">
                <SectionHeading id="hints-title">Hinweise</SectionHeading>
                <ul className="mt-2.5 space-y-2">{teasers.map((drop) => <li key={drop.day_index} className="flex gap-3 rounded-2xl bg-saffron/15 px-4 py-3 text-sm leading-6 text-espresso"><Sparkles size={16} className="mt-1 shrink-0 text-caramel" aria-hidden="true" />{drop.teaser}</li>)}</ul>
            </section>}
            {event.pantry.length > 0 && <section className="mt-9" aria-labelledby="pantry-title">
                <SectionHeading id="pantry-title">Solltet ihr zu Hause haben</SectionHeading>
                <ul className="mt-2.5 flex flex-wrap gap-1.5">{event.pantry.map((entry) => <li key={entry} className="rounded-full bg-white px-3 py-1.5 text-sm text-espresso ring-1 ring-espresso/[0.07]">{entry}</li>)}</ul>
            </section>}
            <Standings stats={event.stats} total={event.days_total} showTips={event.is_cook_day} />
        </>}

        {event.is_creator && <DeleteEvent busy={deleting} onConfirm={removeEvent} />}

        <AnimatePresence>{revealed && <RevealModal drop={revealed} startAtSummary={revealed.again} onClose={() => setRevealed(null)} />}</AnimatePresence>
        <Toast toast={toast} onDismiss={hideToast} />
    </Frame>;
}
