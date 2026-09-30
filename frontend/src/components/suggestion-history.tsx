"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Clock3 } from "lucide-react";
import { useEffect, useState } from "react";

import { LoadingIndicator } from "@/components/loading-indicator";
import { apiUrl } from "@/lib/api";

type SearchHistory = { id: string; title: string; created_at: string; updated_at: string; iteration_count: number };

export function SuggestionHistory() {
    const [items, setItems] = useState<SearchHistory[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const controller = new AbortController();
        const token = sessionStorage.getItem("crave_access_token");
        fetch(`${apiUrl}/ai/suggestion-history`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
            .then(async (response) => { if (!response.ok) throw new Error("Suchverlauf konnte nicht geladen werden."); return response.json(); })
            .then((result: SearchHistory[]) => setItems(result))
            .catch((caught) => { if ((caught as Error).name !== "AbortError") setError(caught instanceof Error ? caught.message : "Suchverlauf konnte nicht geladen werden."); })
            .finally(() => { if (!controller.signal.aborted) setIsLoading(false); });
        return () => controller.abort();
    }, []);

    return <main className="flex-1 bg-linen px-5 py-8 pb-28 sm:px-8 sm:py-12"><div className="mx-auto max-w-5xl"><Link href="/" className="inline-flex items-center gap-1.5 text-sm font-bold text-caramel transition hover:text-espresso"><ArrowLeft size={16} strokeWidth={2.25} aria-hidden="true" />Zur Startseite</Link><header className="mt-5"><p className="text-[11px] font-bold tracking-[0.18em] text-caramel">DEINE SUCHEN</p><h1 className="mt-2 text-4xl font-semibold tracking-[-0.06em] text-espresso">Verlauf</h1><p className="mt-3 text-sm leading-6 text-bark">Öffne eine frühere Rezeptsuche und setze sie genau dort fort, wo du aufgehört hast.</p></header>{isLoading ? <div className="mt-10"><LoadingIndicator label="Verlauf wird geladen…" /></div> : error ? <p role="alert" className="mt-8 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{error}</p> : items.length === 0 ? <div className="mt-10 rounded-[2rem] border border-dashed border-espresso/20 bg-white p-10 text-center text-sm text-bark">Noch keine Rezeptsuche gespeichert.</div> : <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.map((item) => <Link key={item.id} href={`/?history=${item.id}`} className="rounded-[2rem] border border-espresso/10 bg-white p-5 shadow-[0_10px_28px_rgba(66,52,33,0.06)] transition hover:-translate-y-1 hover:border-caramel hover:shadow-[0_18px_36px_rgba(66,52,33,0.12)]"><h2 className="line-clamp-2 text-xl font-semibold tracking-[-0.045em] text-espresso">{item.title}</h2><p className="mt-3 inline-flex items-center gap-1.5 text-sm text-bark"><Clock3 size={14} strokeWidth={2} aria-hidden="true" />{new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.updated_at))}</p><p className="mt-5 inline-flex items-center gap-1 text-xs font-bold text-caramel">{item.iteration_count} {item.iteration_count === 1 ? "Runde" : "Runden"} öffnen <ArrowRight size={14} strokeWidth={2.5} aria-hidden="true" /></p></Link>)}</div>}</div></main>;
}
