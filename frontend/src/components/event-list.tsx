"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Gift, Settings } from "lucide-react";
import { apiUrl } from "@/lib/api";
import { EventSummary, eventApi, formatDay } from "@/lib/events";
import { LoadingIndicator } from "@/components/loading-indicator";

export function EventList() {
    const [events, setEvents] = useState<EventSummary[] | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [error, setError] = useState("");
    useEffect(() => {
        eventApi<EventSummary[]>("/events").then(setEvents).catch((caught: Error) => setError(caught.message));
        fetch(`${apiUrl}/auth/me`, { headers: { Authorization: `Bearer ${sessionStorage.getItem("crave_access_token")}` } })
            .then((response) => response.json()).then((me) => setIsAdmin(Boolean(me.is_admin))).catch(() => undefined);
    }, []);
    return <main className="mx-auto max-w-3xl px-5 pt-8 pb-[calc(8rem+env(safe-area-inset-bottom))] sm:px-8 sm:pt-10">
        <div className="flex items-end justify-between gap-4">
            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-espresso sm:text-4xl">Koch-Events</h1>
            {isAdmin && <Link href="/admin" className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-espresso/10 bg-white px-4 py-2 text-sm font-semibold text-espresso hover:border-caramel/40"><Settings size={15} aria-hidden="true" /> Admin</Link>}
        </div>
        {error && <p role="alert" className="mt-6 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{error}</p>}
        {events === null && !error ? <div className="mt-8"><LoadingIndicator label="Events werden geladen…" /></div>
            : events?.length === 0 ? <p className="mt-6 text-sm text-bark">Du bist noch bei keinem Event dabei.</p>
            : <>{[{ title: "", items: events?.filter((e) => e.phase !== "finished") ?? [] }, { title: "Vergangene Events", items: events?.filter((e) => e.phase === "finished") ?? [] }].map((group) => group.items.length > 0 && <section key={group.title} className="mt-8" aria-label={group.title || "Aktuelle Events"}>
                {group.title && <h2 className="mb-3 text-lg font-semibold text-espresso">{group.title}</h2>}
                <ul className="space-y-3">{group.items.map((event) => <li key={event.id}>
                <Link href={`/events/${event.id}`} className="flex items-center gap-4 rounded-3xl bg-white p-5 shadow-[0_1px_2px_rgba(66,52,33,0.06)] transition hover:shadow-[0_8px_24px_rgba(66,52,33,0.1)]">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-saffron/30 text-espresso" aria-hidden="true"><Gift size={20} /></span>
                    <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-espresso">{event.title}</span>
                        <span className="block text-xs text-bark">Kochtag {formatDay(event.cook_date, { weekday: "long", day: "numeric", month: "long" })}</span>
                    </span>
                    {event.phase === "finished" ? <span className="rounded-full bg-espresso/10 px-3 py-1 text-xs font-bold text-espresso">Fertig</span>
                        : event.is_cook_day ? <span className="rounded-full bg-caramel px-3 py-1 text-xs font-bold text-white">{event.phase === "cooking" ? "Reveal!" : "Jury"}</span>
                        : event.open_drops > 0 && <span className="rounded-full bg-saffron px-3 py-1 text-xs font-bold text-espresso">{event.open_drops} offen</span>}
                </Link>
            </li>)}</ul></section>)}</>}
    </main>;
}
