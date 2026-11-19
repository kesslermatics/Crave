"use client";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Check, Gift, Sparkles, Trash2, Users } from "lucide-react";
import { EVENT_CATEGORIES, eventApi, formatDay } from "@/lib/events";
import { LoadingIndicator } from "@/components/loading-indicator";
import { AdminHandicapIcons } from "@/components/admin-handicap-icons";

type AdminUser = { id: string; email: string };
type AdminEvent = { id: string; title: string; status: string; progress: string; images_pending: boolean; start_date: string; cook_date: string; participants: string[] };

const todayIso = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
// Rough guess for the "too many empty days" warning: ~9 non-basic ingredients per dish.
const INGREDIENTS_PER_DISH = 9;

const ROW = 64; // px per carousel row
const VISIBLE = [-2, -1, 0, 1, 2];

/** Vertical "slot machine": the centred idea is sharp, neighbours fade out, rows drift upwards endlessly. */
function IdeaCarousel({ ideas }: { ideas: string[] }) {
    const reduceMotion = useReducedMotion();
    const [tick, setTick] = useState(0);
    const [paused, setPaused] = useState(false);
    useEffect(() => {
        if (reduceMotion || paused || ideas.length < 2) return;
        const timer = window.setInterval(() => setTick((value) => value + 1), 1800);
        return () => window.clearInterval(timer);
    }, [reduceMotion, paused, ideas.length]);
    if (reduceMotion) return <ul className="mt-5 space-y-2">{ideas.map((idea) => <li key={idea} className="rounded-2xl bg-white px-4 py-3 text-center font-semibold text-espresso">{idea}</li>)}</ul>;
    const at = (position: number) => ideas[((position % ideas.length) + ideas.length) % ideas.length];
    return <div className="relative mt-5 overflow-hidden rounded-[2rem] bg-white shadow-[0_8px_24px_rgba(66,52,33,0.08)]" style={{ height: ROW * 5 }}
        onPointerDown={() => setPaused(true)} onPointerUp={() => setPaused(false)} onPointerLeave={() => setPaused(false)}
        aria-live="off" aria-label={`Ideen: ${ideas.join(", ")}`} role="img">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-4 top-1/2 z-0 -translate-y-1/2 rounded-2xl bg-saffron/25" style={{ height: ROW - 8 }} />
        <ul aria-hidden="true" className="absolute inset-0 [mask-image:linear-gradient(to_bottom,transparent,black_35%,black_65%,transparent)]">
            <AnimatePresence initial={false}>
                {VISIBLE.map((offset) => {
                    const position = tick + offset;
                    const distance = Math.abs(offset);
                    return <motion.li key={position} className="absolute inset-x-0 flex items-center justify-center px-6 text-center text-espresso" style={{ height: ROW, top: ROW * 2 }}
                        initial={{ y: ROW * 3, opacity: 0 }} exit={{ y: ROW * -3, opacity: 0 }}
                        animate={{ y: offset * ROW, opacity: distance === 0 ? 1 : distance === 1 ? 0.45 : 0.15, scale: distance === 0 ? 1 : 0.86 }}
                        transition={{ type: "spring", stiffness: 140, damping: 22 }}>
                        <span className={`line-clamp-2 leading-tight ${distance === 0 ? "text-lg font-semibold sm:text-xl" : "text-base font-medium"}`}>{at(position)}</span>
                    </motion.li>;
                })}
            </AnimatePresence>
        </ul>
    </div>;
}

export function AdminEvents() {
    const [users, setUsers] = useState<AdminUser[] | null>(null);
    const [events, setEvents] = useState<AdminEvent[]>([]);
    const [selected, setSelected] = useState<string[]>([]);
    const [step, setStep] = useState<"users" | "form" | "ideas">("users");
    const [title, setTitle] = useState("");
    const [theme, setTheme] = useState("");
    const [categories, setCategories] = useState<string[]>(["mittagessen"]);
    const [startDate, setStartDate] = useState(todayIso);
    const [cookDate, setCookDate] = useState("");
    const [ideas, setIdeas] = useState<string[]>([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [penaltyBalance, setPenaltyBalance] = useState<number | null>(null);
    // Per team: loaded with the balance when the players are picked, saved again when the event starts.
    const [exclusions, setExclusions] = useState("");

    const loadEvents = useCallback(() => eventApi<AdminEvent[]>("/admin/events").then(setEvents).catch(() => undefined), []);
    useEffect(() => {
        eventApi<AdminUser[]>("/admin/users").then(setUsers).catch((caught: Error) => setError(caught.message));
        void loadEvents();
    }, [loadEvents]);
    // Every group of players has its own account, so the balance follows the current selection.
    useEffect(() => {
        if (selected.length === 0) return;
        let current = true;
        eventApi<{ balance: number; exclusions: string }>(`/admin/penalty-balance?participant_ids=${encodeURIComponent(selected.join(","))}`)
            .then((result) => { if (current) { setPenaltyBalance(result.balance); setExclusions(result.exclusions); } }).catch(() => undefined);
        return () => { current = false; };
    }, [selected]);
    // Poll while something is still being generated.
    useEffect(() => {
        if (!events.some((event) => event.status === "generating" || event.images_pending)) return;
        const timer = window.setInterval(loadEvents, 4000);
        return () => window.clearInterval(timer);
    }, [events, loadEvents]);

    const days = cookDate ? Math.round((Date.parse(cookDate) - Date.parse(startDate)) / 86_400_000) : 0;
    const slots = days * (selected.length + 1);
    const estimated = categories.length * INGREDIENTS_PER_DISH;

    async function requestIdeas(event: FormEvent) {
        event.preventDefault();
        setBusy(true); setError("");
        try {
            const result = await eventApi<{ ideas: string[] }>("/admin/events/ideas", { method: "POST", body: { theme, categories, exclusions } });
            setIdeas(result.ideas); setStep("ideas");
        } catch (caught) { setError((caught as Error).message); } finally { setBusy(false); }
    }

    async function startEvent() {
        setBusy(true); setError("");
        try {
            await eventApi("/admin/events", { method: "POST", body: { title, theme, categories, start_date: startDate, cook_date: cookDate, participant_ids: selected, ideas, exclusions } });
            setStep("users"); setSelected([]); setTitle(""); setTheme(""); setIdeas([]); setCookDate("");
            await loadEvents();
        } catch (caught) { setError((caught as Error).message); } finally { setBusy(false); }
    }

    async function removeEvent(id: string) {
        if (!window.confirm("Event endgültig löschen? Alle Pakete und Tipps gehen verloren.")) return;
        await eventApi(`/admin/events/${id}`, { method: "DELETE" }).catch((caught: Error) => setError(caught.message));
        await loadEvents();
    }

    const toggle = (list: string[], value: string) => list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
    const input = "w-full rounded-2xl border border-espresso/10 bg-white px-4 py-3 text-base text-espresso outline-none sm:text-sm focus:border-caramel/50 focus:ring-4 focus:ring-caramel/10";

    return <main className="mx-auto max-w-3xl px-5 pt-8 pb-[calc(8rem+env(safe-area-inset-bottom))] sm:px-8 sm:pt-10">
        <p className="text-xs font-bold tracking-[0.2em] text-caramel uppercase">Admin</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-espresso sm:text-4xl">Koch-Events</h1>
        {error && <p role="alert" className="mt-6 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{error}</p>}

        {step === "users" && <section className="mt-8" aria-labelledby="pick-users">
            <h2 id="pick-users" className="flex items-center gap-2 text-lg font-semibold text-espresso"><Users size={18} aria-hidden="true" /> Mitspieler auswählen</h2>
            {users === null ? <div className="mt-4"><LoadingIndicator label="Nutzer werden geladen…" /></div> : users.length === 0
                ? <p className="mt-4 text-sm text-bark">Noch keine weiteren freigeschalteten Nutzer.</p>
                : <ul className="mt-4 grid gap-2 sm:grid-cols-2">{users.map((user) => {
                    const active = selected.includes(user.id);
                    return <li key={user.id}><button type="button" aria-pressed={active} onClick={() => setSelected(toggle(selected, user.id))} className={`flex w-full items-center justify-between min-h-12 rounded-2xl border px-4 py-3 text-left text-sm font-semibold break-all transition ${active ? "border-caramel bg-saffron/20 text-espresso" : "border-espresso/10 bg-white text-bark hover:border-caramel/40"}`}>
                        {user.email}{active && <Check size={16} aria-hidden="true" />}
                    </button></li>;
                })}</ul>}
            <button type="button" disabled={selected.length === 0} onClick={() => setStep("form")} className="mt-6 w-full rounded-full bg-espresso px-6 py-3.5 sm:w-auto text-sm font-semibold text-white transition hover:bg-caramel disabled:bg-espresso/20">Weiter</button>
        </section>}

        {step === "form" && <form onSubmit={requestIdeas} className="mt-8 space-y-5">
            <button type="button" onClick={() => setStep("users")} className="-ml-1 flex min-h-11 items-center gap-1 px-1 text-sm font-semibold text-caramel"><ArrowLeft size={15} aria-hidden="true" /> Mitspieler</button>
            <label className="block text-sm font-semibold text-espresso">Titel<input required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z. B. Advents-Kochduell" className={`${input} mt-1.5`} /></label>
            <label className="block text-sm font-semibold text-espresso">Thema<textarea required minLength={3} maxLength={1500} rows={3} value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="z. B. Weihnachtsadvent, gemütlich, gerne etwas mit Zimt" className={`${input} mt-1.5`} /></label>
            <label className="block text-sm font-semibold text-espresso">Darf nicht rein (Allergien, Unverträglichkeiten)
                <textarea maxLength={600} rows={2} value={exclusions} onChange={(e) => setExclusions(e.target.value)} placeholder="z. B. Haselnüsse, Sellerie, Koriander" className={`${input} mt-1.5`} />
                <span className="mt-1 block text-xs font-normal text-bark">Wird für dieses Team gespeichert und gilt für Rezepte, Ideen und Fallen-Zutaten.</span>
            </label>
            <fieldset>
                <legend className="text-sm font-semibold text-espresso">Was wird gekocht?</legend>
                <div className="mt-2 flex flex-wrap gap-2">{EVENT_CATEGORIES.map((category) => {
                    const active = categories.includes(category.key);
                    return <button key={category.key} type="button" aria-pressed={active} disabled={!active && categories.length >= 4} onClick={() => setCategories(toggle(categories, category.key))} className={`min-h-11 rounded-full border px-4 py-2 text-sm font-semibold transition ${active ? "border-caramel bg-saffron/30 text-espresso" : "border-espresso/10 bg-white text-bark"} disabled:opacity-40`}>{category.label}</button>;
                })}</div>
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-espresso">Start (erste Zutat)<input type="date" required min={todayIso()} value={startDate} onChange={(e) => setStartDate(e.target.value)} className={`${input} mt-1.5`} /></label>
                <label className="block text-sm font-semibold text-espresso">Kochtag (Reveal)<input type="date" required min={startDate} value={cookDate} onChange={(e) => setCookDate(e.target.value)} className={`${input} mt-1.5`} /></label>
            </div>
            {penaltyBalance !== null && <p className="rounded-2xl bg-cream/60 px-4 py-3 text-sm text-espresso">Strafpunktekonto dieses Teams: <span className="font-semibold">{penaltyBalance}</span>{penaltyBalance > 0 ? " · wird beim Start komplett in Handicaps eingelöst." : " · keine Handicaps für dieses Event."} <Link href="/handicaps" className="font-semibold text-caramel underline">Zum Shop</Link></p>}
            {days > 0 && <p className="text-sm text-bark">{days} Aufdeck-Tage × {selected.length + 1} Personen = {slots} Pakete. {slots > estimated * 1.3 && <span className="font-semibold text-caramel">Bei ca. {estimated} Zutaten werden viele Tage nur Hinweise statt Zutaten enthalten.</span>}</p>}
            <button disabled={busy || categories.length === 0 || days < 1} className="flex w-full items-center justify-center gap-2 rounded-full bg-espresso px-6 py-3.5 sm:w-auto text-sm font-semibold text-white transition hover:bg-caramel disabled:bg-espresso/20">
                {busy ? <LoadingIndicator light label="Ideen werden gesammelt…" /> : <><Sparkles size={16} aria-hidden="true" /> Ideen anzeigen</>}
            </button>
        </form>}

        {step === "ideas" && <section className="mt-8" aria-labelledby="ideas-title">
            <h2 id="ideas-title" className="text-lg font-semibold text-espresso">Mögliche Richtung</h2>
            <p className="mt-1 text-sm text-bark">Nur Inspiration: Crave entscheidet am Ende geheim und kann auch etwas ganz anderes wählen.</p>
            <IdeaCarousel ideas={ideas} />
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
                <button type="button" onClick={() => setStep("form")} className="rounded-full border border-espresso/15 px-5 py-3.5 text-sm font-semibold text-espresso">Thema ändern</button>
                <button type="button" disabled={busy} onClick={startEvent} className="flex items-center justify-center gap-2 rounded-full bg-caramel px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-espresso disabled:opacity-50">
                    {busy ? <LoadingIndicator light label="Event wird gestartet…" /> : <><Gift size={16} aria-hidden="true" /> Event starten</>}
                </button>
            </div>
        </section>}

        <section className="mt-14" aria-labelledby="admin-events-title">
            <h2 id="admin-events-title" className="text-lg font-semibold text-espresso">Deine Events</h2>
            {events.length === 0 ? <p className="mt-3 text-sm text-bark">Noch keine Events.</p> : <ul className="mt-4 space-y-3">{events.map((event) => <li key={event.id} className="flex items-start justify-between gap-3 rounded-3xl bg-white p-5 shadow-[0_1px_2px_rgba(66,52,33,0.06)]">
                <div className="min-w-0">
                    <Link href={`/events/${event.id}`} className="font-semibold text-espresso hover:text-caramel">{event.title}</Link>
                    <p className="mt-0.5 break-words text-xs text-bark">{formatDay(event.start_date)} → {formatDay(event.cook_date)} · {event.participants.join(", ")}</p>
                    <p className="mt-2 text-sm">{event.status === "generating" || event.images_pending ? <LoadingIndicator label={event.progress || "Läuft…"} /> : event.status === "failed" ? <span className="text-red-700">{event.progress}</span> : <span className="text-bark">Läuft – Rezepte bleiben geheim.</span>}</p>
                </div>
                <button type="button" onClick={() => removeEvent(event.id)} aria-label={`${event.title} löschen`} className="-mr-2 -mt-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-bark hover:bg-red-50 hover:text-red-700"><Trash2 size={16} aria-hidden="true" /></button>
            </li>)}</ul>}
        </section>
        <AdminHandicapIcons />
    </main>;
}
