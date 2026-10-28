"use client";

import Link from "next/link";
import { ArrowLeft, ArrowUpRight, History, Layers, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { apiUrl } from "@/lib/api";

type SearchHistory = { id: string; title: string; created_at: string; updated_at: string; iteration_count: number };
type Group = { label: string; items: SearchHistory[] };

const ghostPill = "inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold text-bark transition hover:bg-espresso/[0.05] hover:text-espresso focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-caramel/40";
const timeFormat = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" });
const weekdayFormat = new Intl.DateTimeFormat("de-DE", { weekday: "long" });
const dateFormat = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "long", year: "numeric" });
const relativeFormat = new Intl.RelativeTimeFormat("de-DE", { numeric: "auto" });

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
const dayDistance = (date: Date, now: Date) => Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);

/** Sortiert nach letzter Aktivität und fasst nach Tagen zusammen: Heute, Gestern, Diese Woche, Früher. */
function groupByDay(items: SearchHistory[], now: Date): Group[] {
    const groups: Group[] = [{ label: "Heute", items: [] }, { label: "Gestern", items: [] }, { label: "Diese Woche", items: [] }, { label: "Früher", items: [] }];
    const sorted = [...items].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    for (const item of sorted) {
        const days = dayDistance(new Date(item.updated_at), now);
        groups[days <= 0 ? 0 : days === 1 ? 1 : days < 7 ? 2 : 3].items.push(item);
    }
    return groups.filter((group) => group.items.length > 0);
}

function whenLabel(value: string, now: Date) {
    const date = new Date(value);
    const days = dayDistance(date, now);
    if (days <= 0) {
        const minutes = Math.round((now.getTime() - date.getTime()) / 60_000);
        if (minutes < 1) return "Gerade eben";
        if (minutes < 60) return relativeFormat.format(-minutes, "minute");
        return `Heute, ${timeFormat.format(date)}`;
    }
    if (days === 1) return `Gestern, ${timeFormat.format(date)}`;
    if (days < 7) return `${weekdayFormat.format(date)}, ${timeFormat.format(date)}`;
    return dateFormat.format(date);
}

function HistoryItem({ item, now }: { item: SearchHistory; now: Date }) {
    const rounds = `${item.iteration_count} ${item.iteration_count === 1 ? "Runde" : "Runden"}`;
    return <li>
        <Link href={`/?history=${item.id}`} aria-label={`${item.title}, ${rounds}, fortsetzen`}
            className="group flex items-center gap-4 rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(66,52,33,0.04)] ring-1 ring-espresso/[0.08] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_36px_-16px_rgba(66,52,33,0.3)] hover:ring-caramel/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-caramel/50 sm:p-5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-cream/80 text-caramel transition group-hover:bg-caramel group-hover:text-white" aria-hidden="true"><History size={19} strokeWidth={2} /></span>
            <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold tracking-[-0.02em] text-espresso">{item.title}</span>
                <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-bark">
                    <span>{whenLabel(item.updated_at, now)}</span>
                    <span className="text-bark/40" aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1"><Layers size={12} strokeWidth={2.25} className="text-caramel" aria-hidden="true" />{rounds}</span>
                </span>
            </span>
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-linen text-bark transition group-hover:bg-caramel group-hover:text-white" aria-hidden="true"><ArrowUpRight size={15} strokeWidth={2.25} /></span>
        </Link>
    </li>;
}

function ListSkeleton() {
    return <div className="mt-8 space-y-3" aria-busy="true" aria-label="Verlauf wird geladen">
        <div className="h-3 w-16 rounded-full bg-espresso/[0.06] motion-safe:animate-shimmer" />
        {[0, 1, 2, 3].map((item) => <div key={item} className="flex animate-fade-in items-center gap-4 rounded-2xl bg-white/70 p-4 ring-1 ring-espresso/[0.06] [animation-delay:150ms] sm:p-5">
            <div className="h-11 w-11 shrink-0 rounded-xl bg-espresso/[0.06] motion-safe:animate-shimmer" />
            <div className="flex-1">
                <div className="h-4 w-3/5 rounded-full bg-espresso/[0.07] motion-safe:animate-shimmer" />
                <div className="mt-2.5 h-3 w-2/5 rounded-full bg-espresso/[0.05] motion-safe:animate-shimmer" />
            </div>
        </div>)}
    </div>;
}

export function SuggestionHistory() {
    const [items, setItems] = useState<SearchHistory[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        const controller = new AbortController();
        const token = sessionStorage.getItem("crave_access_token");
        fetch(`${apiUrl}/ai/suggestion-history`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
            .then(async (response) => { if (!response.ok) throw new Error("Suchverlauf konnte nicht geladen werden."); return response.json(); })
            .then((result: SearchHistory[]) => { setItems(result); setNow(new Date()); })
            .catch((caught) => { if ((caught as Error).name !== "AbortError") setError(caught instanceof Error ? caught.message : "Suchverlauf konnte nicht geladen werden."); })
            .finally(() => { if (!controller.signal.aborted) setIsLoading(false); });
        return () => controller.abort();
    }, []);

    const groups = useMemo(() => groupByDay(items, now), [items, now]);

    return <main className="min-h-[calc(100vh-4rem)] flex-1 bg-linen pb-32">
        <div className="mx-auto max-w-3xl px-5 pt-5 motion-safe:animate-page-in sm:px-8 sm:pt-8">
            <Link href="/" className={`-ml-3.5 ${ghostPill}`}><ArrowLeft size={16} strokeWidth={2.25} aria-hidden="true" />Startseite</Link>

            <header className="mt-5">
                <p className="text-[11px] font-semibold tracking-[0.2em] text-caramel">DEINE SUCHEN</p>
                <h1 className="mt-2 text-[2.5rem] leading-none font-semibold tracking-[-0.05em] text-espresso sm:text-5xl">Verlauf</h1>
                <p className="mt-3 max-w-md text-sm leading-6 text-bark">Öffne eine frühere Suche und mach genau dort weiter, wo du aufgehört hast.</p>
            </header>

            {error && <p role="alert" className="mt-8 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{error}</p>}

            {isLoading ? <ListSkeleton /> : !error && items.length === 0 ? (
                <div className="mx-auto mt-20 max-w-sm text-center motion-safe:animate-page-in">
                    <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-cream text-caramel"><History size={26} strokeWidth={1.75} aria-hidden="true" /></span>
                    <h2 className="mt-5 text-xl font-semibold tracking-[-0.03em] text-espresso">Noch keine Suchen</h2>
                    <p className="mt-2 text-sm leading-6 text-bark">Sobald du Crave nach Ideen fragst, findest du deine Suchen hier wieder.</p>
                    <Link href="/" className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-caramel px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-espresso"><Plus size={16} strokeWidth={2.5} aria-hidden="true" />Neue Suche starten</Link>
                </div>
            ) : (
                <div className="mt-8 space-y-9">
                    {groups.map((group, index) => <section key={group.label} aria-labelledby={`history-group-${index}`}>
                        <h2 id={`history-group-${index}`} className="text-[11px] font-semibold tracking-[0.14em] text-bark/70">{group.label.toUpperCase()} · {group.items.length}</h2>
                        <ul className="mt-3 space-y-3">
                            {group.items.map((item) => <HistoryItem key={item.id} item={item} now={now} />)}
                        </ul>
                    </section>)}
                </div>
            )}
        </div>
    </main>;
}
