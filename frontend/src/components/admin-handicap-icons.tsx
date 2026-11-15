"use client";
/* eslint-disable @next/next/no-img-element -- icons are generated data URLs */
import { useCallback, useEffect, useState } from "react";
import { Check, RefreshCw, Wand2 } from "lucide-react";
import { eventApi } from "@/lib/events";
import { loadHandicapIcons } from "@/components/handicap-icons";
import { LoadingIndicator } from "@/components/loading-indicator";

type Preview = { handicap_id: string; title: string; image_data: string; style_hint: string };
type Status = { icons: Record<string, string>; total: number; done: number; approved: boolean; generating: boolean; preview: Preview | null };

/** Admin: generate a style sample for one handicap, iterate on it, then approve to generate all icons. */
export function AdminHandicapIcons() {
    const [state, setState] = useState<Status | null>(null);
    const [styleHint, setStyleHint] = useState("");
    const [busy, setBusy] = useState<"" | "preview" | "approve">("");
    const [error, setError] = useState("");

    const load = useCallback(() => eventApi<Status>("/handicaps/icons").then((result) => { setState(result); return result; }), []);
    useEffect(() => { load().then((result) => setStyleHint(result.preview?.style_hint ?? "")).catch((caught: Error) => setError(caught.message)); }, [load]);
    useEffect(() => {
        if (!state?.generating && !(state?.approved && state.done < state.total)) return;
        const timer = window.setInterval(() => { void load().then(() => loadHandicapIcons(true)); }, 5000);
        return () => window.clearInterval(timer);
    }, [state, load]);

    async function preview() {
        setBusy("preview"); setError("");
        try {
            const result = await eventApi<Preview>("/admin/handicap-icons/preview", { method: "POST", body: { handicap_id: state?.preview?.handicap_id ?? null, style_hint: styleHint } });
            setState((current) => current && { ...current, preview: result });
        } catch (caught) { setError((caught as Error).message); } finally { setBusy(""); }
    }
    async function approve() {
        const restyle = state?.approved ? " Alle bisherigen Icons in einem anderen Stil werden ersetzt." : "";
        if (!window.confirm(`Diesen Stil für alle ${state?.total ?? ""} Handicaps verwenden?${restyle}`)) return;
        setBusy("approve"); setError("");
        try { await eventApi("/admin/handicap-icons/approve", { method: "POST" }); await load(); }
        catch (caught) { setError((caught as Error).message); } finally { setBusy(""); }
    }

    return <section className="mt-14" aria-labelledby="icons-title">
        <h2 id="icons-title" className="text-lg font-semibold text-espresso">Handicap-Icons</h2>
        <p className="mt-1 text-sm text-bark">Erst eine Stil-Probe für ein Handicap, dann alle im gleichen Stil. Fehlende Icons werden bei jedem Server-Start nachgeneriert.</p>
        {error && <p role="alert" className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
        {!state ? <div className="mt-4"><LoadingIndicator label="Icons werden geladen…" /></div> : <>
            <p className="mt-3 text-sm font-semibold text-espresso">{state.done} / {state.total} Icons{state.generating && " · wird generiert…"}</p>
            {state.done > 0 && <ul className="mt-3 flex flex-wrap gap-2">{Object.entries(state.icons).map(([id, src]) => <li key={id}><img src={src} alt={id} className="h-12 w-12 rounded-xl object-cover" /></li>)}</ul>}

            <div className="mt-5 rounded-3xl bg-white p-5 shadow-[0_1px_2px_rgba(66,52,33,0.06)]">
                <label className="block text-sm font-semibold text-espresso">Stilhinweis (optional)
                    <textarea value={styleHint} onChange={(e) => setStyleHint(e.target.value)} maxLength={400} rows={2} placeholder="z. B. flacher, mehr Comic, dunklerer Hintergrund" className="mt-1.5 w-full rounded-2xl border border-espresso/10 bg-white px-4 py-3 text-base text-espresso outline-none focus:border-caramel/50 focus:ring-4 focus:ring-caramel/10 sm:text-sm" />
                </label>
                {state.preview && <div className="mt-4 flex items-center gap-4">
                    <img src={state.preview.image_data} alt={`Stil-Probe: ${state.preview.title}`} className="h-32 w-32 rounded-3xl object-cover shadow-[0_8px_24px_rgba(66,52,33,0.15)]" />
                    <div className="min-w-0 text-sm"><p className="text-xs font-bold tracking-[0.16em] text-caramel uppercase">Stil-Probe</p><p className="mt-1 font-semibold text-espresso">{state.preview.title}</p></div>
                </div>}
                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <button type="button" onClick={preview} disabled={busy !== ""} className="flex min-h-12 items-center justify-center gap-2 rounded-full border border-espresso/15 px-5 py-3 text-sm font-semibold text-espresso disabled:opacity-50">
                        {busy === "preview" ? <LoadingIndicator label="Probe wird gemalt…" /> : state.preview ? <><RefreshCw size={16} aria-hidden="true" /> Neue Probe</> : <><Wand2 size={16} aria-hidden="true" /> Stil-Probe generieren</>}
                    </button>
                    {state.preview && <button type="button" onClick={approve} disabled={busy !== ""} className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-caramel px-6 py-3 text-sm font-semibold text-white disabled:opacity-50">
                        {busy === "approve" ? <LoadingIndicator light label="Wird gestartet…" /> : <><Check size={16} aria-hidden="true" /> Passt – alle generieren</>}
                    </button>}
                </div>
                {styleHint.trim() !== (state.preview?.style_hint ?? "") && state.preview && <p className="mt-3 text-xs text-bark">Der geänderte Stilhinweis gilt erst nach „Neue Probe“.</p>}
            </div>
        </>}
    </section>;
}
