"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { MotionConfig, motion } from "framer-motion";
import { ArrowRight, Check, ChefHat, ChevronRight, Gift, Settings, Skull } from "lucide-react";

import { apiUrl } from "@/lib/api";
import { EventSummary, eventApi, formatDay } from "@/lib/events";

/** Wo ein Event gerade steht – daraus ergeben sich Aussehen, Texte und Reihenfolge der Karten. */
type Stage =
    | { kind: "preparing" }
    | { kind: "failed" }
    | { kind: "upcoming"; daysToStart: number }
    | { kind: "running"; day: number; total: number; daysLeft: number }
    | { kind: "cookday" }
    | { kind: "jury"; judged: boolean }
    | { kind: "finished" };

/** Wichtigstes zuerst: Kochtag und Jury vor laufenden, dann kommenden Events. */
const stageRank: Record<Stage["kind"], number> = { cookday: 0, jury: 1, running: 2, upcoming: 3, preparing: 4, failed: 5, finished: 6 };

const DAY_MS = 86_400_000;
const ease = [0.22, 1, 0.36, 1] as const;
const dayNumber = (iso: string) => Math.round(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
/** Datum, das nie mitten im Wort umbricht („So.,⏎6. Dez.“). */
const day = (iso: string, options?: Intl.DateTimeFormatOptions) => formatDay(iso, options).replace(/ /g, " ");

/** Gleicher Kalendertag wie im Backend (Europe/Berlin) – unabhängig von der Zeitzone des Geräts. */
function todayInBerlin() {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" })
        .formatToParts(new Date()).map((part) => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
}

function stageOf(event: EventSummary, today: string): Stage {
    if (event.status === "generating") return { kind: "preparing" };
    if (event.status === "failed") return { kind: "failed" };
    if (event.phase === "finished") return { kind: "finished" };
    if (event.phase === "judging" || event.phase === "judged") return { kind: "jury", judged: event.phase === "judged" };
    if (event.is_cook_day) return { kind: "cookday" };
    const now = dayNumber(today);
    const start = dayNumber(event.start_date);
    const cook = dayNumber(event.cook_date);
    if (now < start) return { kind: "upcoming", daysToStart: start - now };
    const total = Math.max(cook - start, 1);
    return { kind: "running", day: Math.min(now - start + 1, total), total, daysLeft: cook - now };
}

const headerAction = "flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-bark transition hover:bg-espresso/[0.05] hover:text-espresso active:scale-95 active:bg-espresso/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-caramel/40";

type Loaded = { events: EventSummary[]; today: string };

export function EventList() {
    const [data, setData] = useState<Loaded | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [error, setError] = useState("");

    const load = useCallback(() => {
        eventApi<EventSummary[]>("/events")
            .then((events) => { setData({ events, today: todayInBerlin() }); setError(""); })
            .catch((caught: Error) => setError(caught.message));
    }, []);

    useEffect(() => {
        load();
        fetch(`${apiUrl}/auth/me`, { headers: { Authorization: `Bearer ${sessionStorage.getItem("crave_access_token")}` } })
            .then((response) => response.json()).then((me) => setIsAdmin(Boolean(me.is_admin))).catch(() => undefined);
        // Jeden Tag gibt es neue Päckchen: beim Zurückkehren in die App frisch laden.
        const onVisible = () => { if (document.visibilityState === "visible") load(); };
        document.addEventListener("visibilitychange", onVisible);
        return () => document.removeEventListener("visibilitychange", onVisible);
    }, [load]);

    const staged = data?.events.map((event) => ({ event, stage: stageOf(event, data.today) })) ?? [];
    const active = staged.filter(({ stage }) => stage.kind !== "finished")
        .sort((a, b) => stageRank[a.stage.kind] - stageRank[b.stage.kind] || a.event.cook_date.localeCompare(b.event.cook_date));
    const past = staged.filter(({ stage }) => stage.kind === "finished");
    const openDrops = active.reduce((sum, { event }) => sum + event.open_drops, 0);
    const summary = !data ? "" : active.length === 0
        ? (past.length ? "Gerade läuft kein Event" : "Noch keine Events")
        : [active.length === 1 ? "1 aktives Event" : `${active.length} aktive Events`, openDrops > 0 && plural(openDrops, "Päckchen wartet", "Päckchen warten")].filter(Boolean).join(" · ");

    return <MotionConfig reducedMotion="user">
        <main className="flex-1 bg-linen">
            <div className="mx-auto w-full max-w-2xl px-5 pt-6 pb-[calc(8rem+env(safe-area-inset-bottom))] motion-safe:animate-page-in sm:px-8 sm:pt-12">
                <header>
                    <div className="flex h-10 items-center justify-between">
                        <p className="text-[11px] font-semibold tracking-[0.2em] text-caramel">GEMEINSAM KOCHEN</p>
                        <div className="-mr-2 flex items-center gap-0.5">
                            <Link href="/handicaps" className={headerAction}><Skull size={16} strokeWidth={2} aria-hidden="true" />Handicaps</Link>
                            {isAdmin && <Link href="/admin" className={`${headerAction} w-10 justify-center px-0`} aria-label="Events verwalten" title="Events verwalten"><Settings size={18} strokeWidth={2} aria-hidden="true" /></Link>}
                        </div>
                    </div>
                    <h1 className="mt-1 text-[2.5rem] leading-none font-semibold tracking-[-0.05em] text-espresso sm:text-5xl">Koch-Events</h1>
                    <p className="mt-3 h-5 text-sm text-bark" aria-live="polite">{summary}</p>
                </header>

                {error && !data ? <ErrorState message={error} onRetry={() => { setError(""); load(); }} />
                    : !data ? <CardSkeleton />
                        : data.events.length === 0 ? <EmptyState />
                            : <>
                                {active.length > 0
                                    ? <ul className="mt-7 space-y-4">{active.map(({ event, stage }, index) => <EventCard key={event.id} event={event} stage={stage} index={index} />)}</ul>
                                    : <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-7 rounded-[1.75rem] border border-dashed border-espresso/15 px-6 py-7 text-center text-sm leading-6 text-bark">
                                        Das nächste Event taucht hier auf,<br />sobald du eingeladen wirst.
                                    </motion.p>}
                                {past.length > 0 && <PastEvents events={past.map(({ event }) => event)} delay={0.1 + active.length * 0.07} />}
                            </>}
            </div>
        </main>
    </MotionConfig>;
}

function EventCard({ event, stage, index }: { event: EventSummary; stage: Stage; index: number }) {
    // Kochtag und Jury sind die Höhepunkte – die Karte wird dunkel, damit sie sich klar abhebt.
    const dark = stage.kind === "cookday" || stage.kind === "jury";
    return <motion.li initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease, delay: 0.05 + index * 0.07 }}>
        <Link href={`/events/${event.id}`}
            className={`group block rounded-[1.75rem] p-5 transition-transform duration-200 select-none [-webkit-touch-callout:none] active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-caramel/50 sm:p-6 ${dark
                ? "bg-espresso text-white shadow-[0_24px_48px_-24px_rgba(66,52,33,0.85)]"
                : "bg-white shadow-[0_1px_2px_rgba(66,52,33,0.05),0_14px_36px_-24px_rgba(66,52,33,0.4)] ring-1 ring-espresso/[0.06]"}`}>
            <StageLabel stage={stage} dark={dark} />
            <h2 className={`mt-2.5 text-[1.65rem] leading-[1.1] font-semibold tracking-[-0.045em] text-balance ${dark ? "text-white" : "text-espresso"}`}>{event.title}</h2>
            <p className={`mt-1.5 text-sm leading-6 ${dark ? "text-white/70" : "text-bark"}`}>{subline(event, stage)}</p>
            {stage.kind === "running" && <DayTrack day={stage.day} total={stage.total} delay={0.2 + index * 0.07} />}
            <CardAction event={event} stage={stage} />
        </Link>
    </motion.li>;
}

function StageLabel({ stage, dark }: { stage: Stage; dark: boolean }) {
    const live = stage.kind === "running" || stage.kind === "cookday" || stage.kind === "preparing" || (stage.kind === "jury" && !stage.judged);
    const text = stage.kind === "preparing" ? "Wird vorbereitet"
        : stage.kind === "failed" ? "Vorbereitung fehlgeschlagen"
            : stage.kind === "upcoming" ? (stage.daysToStart === 1 ? "Startet morgen" : `Startet in ${stage.daysToStart} Tagen`)
                : stage.kind === "running" ? `Tag ${stage.day} von ${stage.total}`
                    : stage.kind === "cookday" ? "Heute ist Kochtag"
                        : stage.kind === "jury" ? (stage.judged ? "Das Urteil ist da" : "Die Jury bewertet")
                            : "Vorbei";
    const tone = stage.kind === "failed" ? "text-red-700" : dark ? "text-saffron" : "text-caramel";
    return <p className={`flex items-center gap-2 text-[11px] font-semibold tracking-[0.16em] uppercase ${tone}`}>
        <span className="relative flex h-2 w-2" aria-hidden="true">
            {live && <span className="absolute inset-0 rounded-full bg-current opacity-50 motion-safe:animate-ping" />}
            <span className="relative h-2 w-2 rounded-full bg-current" />
        </span>
        {text}
    </p>;
}

function subline(event: EventSummary, stage: Stage) {
    switch (stage.kind) {
        case "preparing": return "Crave stellt gerade die Zutaten zusammen.";
        case "failed": return "Beim Vorbereiten ist etwas schiefgelaufen.";
        case "upcoming": return `Erstes Päckchen ${day(event.start_date)} · Kochtag ${day(event.cook_date)}`;
        case "running": return stage.daysLeft === 1 ? `Morgen ist Kochtag · ${day(event.cook_date)}` : `Kochtag ${day(event.cook_date)} · noch ${stage.daysLeft} Tage`;
        case "cookday": return "Heute wird gekocht – viel Erfolg!";
        case "jury": return stage.judged ? "Schau dir an, wie ihr abgeschnitten habt." : "Eure Gerichte werden gerade bewertet.";
        default: return "";
    }
}

/** Ein Segment pro Päckchen-Tag, am Ende die Kochmütze für den Kochtag. */
function DayTrack({ day, total, delay }: { day: number; total: number; delay: number }) {
    if (total > 31) {
        return <div className="mt-5 flex items-center gap-2" aria-hidden="true">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-espresso/[0.08]">
                <motion.div className="h-full origin-left rounded-full bg-caramel" style={{ width: `${(day / total) * 100}%` }} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay, duration: 0.6, ease }} />
            </div>
            <ChefHat size={17} strokeWidth={2} className="shrink-0 text-caramel" />
        </div>;
    }
    return <div className="mt-5 flex items-center gap-2" aria-hidden="true">
        <div className="flex flex-1 gap-[3px]">
            {Array.from({ length: total }, (_, index) => <motion.span key={index} initial={{ scaleY: 0, opacity: 0 }} animate={{ scaleY: 1, opacity: 1 }} transition={{ delay: delay + index * 0.025, duration: 0.3, ease }}
                className={`h-2 flex-1 rounded-full ${index < day - 1 ? "bg-caramel" : index === day - 1 ? "bg-caramel motion-safe:animate-shimmer" : "bg-espresso/[0.08]"}`} />)}
        </div>
        <ChefHat size={17} strokeWidth={2} className="shrink-0 text-caramel" />
    </div>;
}

function CardAction({ event, stage }: { event: EventSummary; stage: Stage }) {
    if (stage.kind === "running") {
        if (event.open_drops > 0) {
            return <div className="mt-5 flex items-center gap-3 rounded-2xl bg-saffron/20 py-2.5 pr-2.5 pl-3.5">
                <motion.span className="grid shrink-0 text-caramel" animate={{ rotate: [0, -14, 11, -6, 0] }} transition={{ duration: 0.7, repeat: Infinity, repeatDelay: 2.8, ease: "easeInOut" }} aria-hidden="true">
                    <Gift size={20} strokeWidth={2} />
                </motion.span>
                <span className="min-w-0 flex-1 text-sm font-semibold text-espresso">{plural(event.open_drops, "Päckchen wartet", "Päckchen warten")}</span>
                <span className="flex items-center gap-1 rounded-full bg-espresso px-3.5 py-2 text-xs font-semibold text-white">Öffnen<ArrowRight size={13} strokeWidth={2.5} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" /></span>
            </div>;
        }
        return <p className="mt-5 flex items-center gap-2 text-sm text-bark/80">
            <Check size={15} strokeWidth={2.5} className="shrink-0 text-caramel" aria-hidden="true" />
            {stage.daysLeft === 1 ? "Alles geöffnet – morgen wird gekocht" : "Alles geöffnet – das nächste Päckchen kommt morgen"}
        </p>;
    }
    if (stage.kind === "cookday" || stage.kind === "jury") {
        const label = stage.kind === "cookday" ? "Los geht’s" : stage.judged ? "Zum Urteil" : "Zur Jury";
        return <div className="mt-6 flex items-center justify-between gap-3">
            <span className="text-xs text-white/55">{formatDay(event.cook_date, { weekday: "long", day: "numeric", month: "long" })}</span>
            <span className="flex items-center gap-1.5 rounded-full bg-saffron px-4 py-2.5 text-sm font-semibold text-espresso">{label}<ArrowRight size={15} strokeWidth={2.5} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" /></span>
        </div>;
    }
    if (stage.kind === "preparing") {
        return <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-espresso/[0.07]" aria-hidden="true">
            <motion.div className="h-full w-1/3 rounded-full bg-caramel/60" animate={{ x: ["-100%", "300%"] }} transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }} />
        </div>;
    }
    return null;
}

function PastEvents({ events, delay }: { events: EventSummary[]; delay: number }) {
    return <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease, delay }} className="mt-10" aria-labelledby="past-events">
        <h2 id="past-events" className="px-1 text-[11px] font-semibold tracking-[0.14em] text-bark/75">VERGANGENE EVENTS</h2>
        <ul className="mt-2.5 overflow-hidden rounded-2xl bg-white ring-1 ring-espresso/[0.07]">
            {events.map((event) => <li key={event.id} className="group/row relative">
                <span aria-hidden="true" className="pointer-events-none absolute top-0 right-0 left-4 h-px bg-espresso/[0.07] group-first/row:hidden" />
                <Link href={`/events/${event.id}`} className="flex items-center gap-3 px-4 py-3.5 transition-colors duration-500 select-none hover:bg-linen/60 focus-visible:bg-linen focus-visible:outline-none active:bg-espresso/[0.04] active:duration-0">
                    <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-medium text-espresso">{event.title}</span>
                        <span className="mt-0.5 block text-xs text-bark/75">Gekocht am {formatDay(event.cook_date, { day: "numeric", month: "long", year: "numeric" })}</span>
                    </span>
                    <ChevronRight size={18} strokeWidth={2} className="shrink-0 text-bark/40" aria-hidden="true" />
                </Link>
            </li>)}
        </ul>
    </motion.section>;
}

function CardSkeleton() {
    return <div className="mt-7 rounded-[1.75rem] bg-white p-5 ring-1 ring-espresso/[0.06]" role="status" aria-label="Events werden geladen…">
        <div className="motion-safe:animate-shimmer" aria-hidden="true">
            <div className="h-2.5 w-24 rounded-full bg-espresso/[0.08]" />
            <div className="mt-4 h-6 w-3/4 rounded-full bg-espresso/[0.08]" />
            <div className="mt-3 h-3 w-1/2 rounded-full bg-espresso/[0.06]" />
            <div className="mt-6 h-2 w-full rounded-full bg-espresso/[0.06]" />
        </div>
    </div>;
}

function EmptyState() {
    return <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease }} className="mt-20 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-cream text-caramel"><Gift size={26} strokeWidth={1.75} aria-hidden="true" /></span>
        <h2 className="mt-5 text-xl font-semibold tracking-[-0.03em] text-espresso">Noch kein Event</h2>
        <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-bark">Sobald du zu einem Koch-Event eingeladen wirst, landet hier jeden Tag ein neues Zutaten-Päckchen.</p>
        <Link href="/handicaps" className="mt-5 inline-flex rounded-full px-4 py-2 text-sm font-semibold text-caramel transition hover:bg-caramel/10 active:scale-95 active:bg-caramel/15">Handicap-Shop ansehen</Link>
    </motion.div>;
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
    return <div role="alert" className="mt-7 rounded-[1.75rem] bg-red-50 px-5 py-5 text-sm text-red-800">
        <p className="font-medium">{message}</p>
        <button type="button" onClick={onRetry} className="mt-3 rounded-full bg-white px-4 py-2 text-sm font-semibold text-red-800 ring-1 ring-red-200 transition active:scale-95">Erneut versuchen</button>
    </div>;
}
