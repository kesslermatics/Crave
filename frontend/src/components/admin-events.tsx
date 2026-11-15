"use client";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Gift, Sparkles, Trash2, Users } from "lucide-react";
import { EVENT_CATEGORIES, eventApi, formatDay } from "@/lib/events";
import { LoadingIndicator } from "@/components/loading-indicator";

type AdminUser = { id: string; email: string };
type AdminEvent = { id: string; title: string; status: string; progress: string; images_pending: boolean; start_date: string; cook_date: string; participants: string[] };

const todayIso = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
// Rough guess for the "too many empty days" warning: ~9 non-basic ingredients per dish.
const INGREDIENTS_PER_DISH = 9;

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

    const loadEvents = useCallback(() => eventApi<AdminEvent[]>("/admin/events").then(setEvents).catch(() => undefined), []);
    useEffect(() => {
        eventApi<AdminUser[]>("/admin/users").then(setUsers).catch((caught: Error) => setError(caught.message));
        void loadEvents();
    }, [loadEvents]);
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
            const result = await eventApi<{ ideas: string[] }>("/admin/events/ideas", { method: "POST", body: { theme, categories } });
            setIdeas(result.ideas); setStep("ideas");
        } catch (caught) { setError((caught as Error).message); } finally { setBusy(false); }
    }

    async function startEvent() {
        setBusy(true); setError("");
        try {
            await eventApi("/admin/events", { method: "POST", body: { title, theme, categories, start_date: startDate, cook_date: cookDate, participant_ids: selected, ideas } });
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
    const input = "w-full rounded-2xl border border-espresso/10 bg-white px-4 py-3 text-sm text-espresso outline-none focus:border-caramel/50 focus:ring-4 focus:ring-caramel/10";

    return <main className="mx-auto max-w-3xl px-5 pt-10 pb-32 sm:px-8">
        <p className="text-xs font-bold tracking-[0.2em] text-caramel uppercase">Admin</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-espresso sm:text-4xl">Koch-Events</h1>
        {error && <p role="alert" className="mt-6 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{error}</p>}

        {step === "users" && <section className="mt-8" aria-labelledby="pick-users">
            <h2 id="pick-users" className="flex items-center gap-2 text-lg font-semibold text-espresso"><Users size={18} aria-hidden="true" /> Mitspieler auswählen</h2>
            {users === null ? <div className="mt-4"><LoadingIndicator label="Nutzer werden geladen…" /></div> : users.length === 0
                ? <p className="mt-4 text-sm text-bark">Noch keine weiteren freigeschalteten Nutzer.</p>
                : <ul className="mt-4 grid gap-2 sm:grid-cols-2">{users.map((user) => {
                    const active = selected.includes(user.id);
                    return <li key={user.id}><button type="button" aria-pressed={active} onClick={() => setSelected(toggle(selected, user.id))} className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${active ? "border-caramel bg-saffron/20 text-espresso" : "border-espresso/10 bg-white text-bark hover:border-caramel/40"}`}>
                        {user.email}{active && <Check size={16} aria-hidden="true" />}
                    </button></li>;
                })}</ul>}
            <button type="button" disabled={selected.length === 0} onClick={() => setStep("form")} className="mt-6 rounded-full bg-espresso px-6 py-3 text-sm font-semibold text-white transition hover:bg-caramel disabled:bg-espresso/20">Weiter</button>
        </section>}

        {step === "form" && <form onSubmit={requestIdeas} className="mt-8 space-y-5">
            <button type="button" onClick={() => setStep("users")} className="flex items-center gap-1 text-sm font-semibold text-caramel"><ArrowLeft size={15} aria-hidden="true" /> Mitspieler</button>
            <label className="block text-sm font-semibold text-espresso">Titel<input required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z. B. Advents-Kochduell" className={`${input} mt-1.5`} /></label>
            <label className="block text-sm font-semibold text-espresso">Thema<textarea required minLength={3} maxLength={1500} rows={3} value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="z. B. Weihnachtsadvent, gemütlich, gerne etwas mit Zimt" className={`${input} mt-1.5`} /></label>
            <fieldset>
                <legend className="text-sm font-semibold text-espresso">Was wird gekocht?</legend>
                <div className="mt-2 flex flex-wrap gap-2">{EVENT_CATEGORIES.map((category) => {
                    const active = categories.includes(category.key);
                    return <button key={category.key} type="button" aria-pressed={active} disabled={!active && categories.length >= 4} onClick={() => setCategories(toggle(categories, category.key))} className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${active ? "border-caramel bg-saffron/30 text-espresso" : "border-espresso/10 bg-white text-bark"} disabled:opacity-40`}>{category.label}</button>;
                })}</div>
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-espresso">Start (erste Zutat)<input type="date" required min={todayIso()} value={startDate} onChange={(e) => setStartDate(e.target.value)} className={`${input} mt-1.5`} /></label>
                <label className="block text-sm font-semibold text-espresso">Kochtag (Reveal)<input type="date" required min={startDate} value={cookDate} onChange={(e) => setCookDate(e.target.value)} className={`${input} mt-1.5`} /></label>
            </div>
            {days > 0 && <p className="text-sm text-bark">{days} Aufdeck-Tage × {selected.length + 1} Personen = {slots} Pakete. {slots > estimated * 1.3 && <span className="font-semibold text-caramel">Bei ca. {estimated} Zutaten werden viele Tage nur Hinweise statt Zutaten enthalten.</span>}</p>}
            <button disabled={busy || categories.length === 0 || days < 1} className="flex items-center gap-2 rounded-full bg-espresso px-6 py-3 text-sm font-semibold text-white transition hover:bg-caramel disabled:bg-espresso/20">
                {busy ? <LoadingIndicator light label="Ideen werden gesammelt…" /> : <><Sparkles size={16} aria-hidden="true" /> Ideen anzeigen</>}
            </button>
        </form>}

        {step === "ideas" && <section className="mt-8" aria-labelledby="ideas-title">
            <h2 id="ideas-title" className="text-lg font-semibold text-espresso">Mögliche Richtung</h2>
            <p className="mt-1 text-sm text-bark">Nur Inspiration: Crave entscheidet am Ende geheim und kann auch etwas ganz anderes wählen.</p>
            <ul className="-mx-5 mt-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-3">
                {ideas.map((idea, index) => <motion.li key={idea} initial={{ opacity: 0, scale: 0.8, y: 12 }} animate={{ opacity: [0, 1, 0.7, 1], scale: 1, y: 0 }} transition={{ delay: index * 0.18, duration: 0.6 }}
                    className="grid h-36 w-56 shrink-0 snap-center place-items-center rounded-3xl bg-gradient-to-br from-saffron/40 to-cream p-5 text-center text-base font-semibold text-espresso shadow-[0_8px_24px_rgba(66,52,33,0.12)]">{idea}</motion.li>)}
            </ul>
            <div className="mt-6 flex flex-wrap gap-3">
                <button type="button" onClick={() => setStep("form")} className="rounded-full border border-espresso/15 px-5 py-3 text-sm font-semibold text-espresso">Thema ändern</button>
                <button type="button" disabled={busy} onClick={startEvent} className="flex items-center gap-2 rounded-full bg-caramel px-6 py-3 text-sm font-semibold text-white transition hover:bg-espresso disabled:opacity-50">
                    {busy ? <LoadingIndicator light label="Event wird gestartet…" /> : <><Gift size={16} aria-hidden="true" /> Event starten</>}
                </button>
            </div>
        </section>}

        <section className="mt-14" aria-labelledby="admin-events-title">
            <h2 id="admin-events-title" className="text-lg font-semibold text-espresso">Deine Events</h2>
            {events.length === 0 ? <p className="mt-3 text-sm text-bark">Noch keine Events.</p> : <ul className="mt-4 space-y-3">{events.map((event) => <li key={event.id} className="flex items-start justify-between gap-3 rounded-3xl bg-white p-5 shadow-[0_1px_2px_rgba(66,52,33,0.06)]">
                <div className="min-w-0">
                    <Link href={`/events/${event.id}`} className="font-semibold text-espresso hover:text-caramel">{event.title}</Link>
                    <p className="mt-0.5 text-xs text-bark">{formatDay(event.start_date)} → {formatDay(event.cook_date)} · {event.participants.join(", ")}</p>
                    <p className="mt-2 text-sm">{event.status === "generating" || event.images_pending ? <LoadingIndicator label={event.progress || "Läuft…"} /> : event.status === "failed" ? <span className="text-red-700">{event.progress}</span> : <span className="text-bark">Läuft – Rezepte bleiben geheim.</span>}</p>
                </div>
                <button type="button" onClick={() => removeEvent(event.id)} aria-label={`${event.title} löschen`} className="rounded-full p-2 text-bark hover:bg-red-50 hover:text-red-700"><Trash2 size={16} aria-hidden="true" /></button>
            </li>)}</ul>}
        </section>
    </main>;
}
