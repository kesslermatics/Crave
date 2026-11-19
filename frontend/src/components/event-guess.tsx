"use client";
import { FormEvent, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, HelpCircle, RotateCcw, X } from "lucide-react";
import { EventDetail, eventApi } from "@/lib/events";
import { LoadingIndicator } from "@/components/loading-indicator";

/** Cook-day guessing round: every player guesses each dish before anything is revealed. */
export function EventGuess({ event, onChange }: { event: EventDetail; onChange: () => void }) {
    const guessing = event.guessing!;
    const [drafts, setDrafts] = useState<Record<string, string>>(guessing.mine);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const reduceMotion = useReducedMotion();
    const offset = event.clock_offset ?? 0;
    const revealAt = guessing.reveal_at ? Date.parse(guessing.reveal_at) : 0;
    const [now, setNow] = useState<number | null>(null);
    const ticking = (guessing.done && revealAt > 0) || guessing.judging;
    useEffect(() => {
        if (!ticking) return;
        const timer = window.setInterval(() => setNow(Date.now() + offset), 250);
        return () => window.clearInterval(timer);
    }, [ticking, offset]);
    const countdown = now === null ? 0 : Math.ceil((revealAt - now) / 1000);

    const allMine = event.recipes.every((recipe) => (guessing.mine[recipe.id] ?? "").length > 0);
    const judgingStuck = guessing.judging && guessing.judging_since !== null && now !== null && now - Date.parse(guessing.judging_since) > 120_000;

    async function submit(formEvent: FormEvent) {
        formEvent.preventDefault();
        setBusy(true); setError("");
        try {
            for (const recipe of event.recipes) {
                const guess = (drafts[recipe.id] ?? "").trim();
                if (guess && guess !== guessing.mine[recipe.id]) await eventApi(`/events/${event.id}/guesses`, { method: "POST", body: { recipe_id: recipe.id, guess } });
            }
            onChange();
        } catch (caught) { setError((caught as Error).message); } finally { setBusy(false); }
    }
    async function retry() {
        setBusy(true); setError("");
        try { await eventApi(`/events/${event.id}/guesses/judge`, { method: "POST" }); onChange(); }
        catch (caught) { setError((caught as Error).message); } finally { setBusy(false); }
    }

    const input = "mt-1.5 min-h-12 w-full rounded-2xl border border-espresso/10 bg-white px-4 text-base text-espresso outline-none focus:border-caramel/50 focus:ring-4 focus:ring-caramel/10 sm:text-sm";

    return <section className="mb-8 rounded-[2rem] bg-white p-5 shadow-[0_12px_40px_rgba(66,52,33,0.12)] sm:p-8" aria-labelledby="guess-title">
        <h2 id="guess-title" className="flex items-center gap-2 text-xl font-semibold text-espresso"><HelpCircle size={20} className="shrink-0 text-caramel" aria-hidden="true" /> Was kocht ihr heute?</h2>
        {error && <p role="alert" className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}

        {guessing.open && !guessing.judging && <>
            <p className="mt-1 text-sm leading-6 text-bark">Bevor aufgedeckt wird, tippt jeder auf das Gericht. Jeder richtige Tipp zieht {3} Strafpunkte ab, ein falscher kostet nichts.</p>
            <form onSubmit={submit} className="mt-5 space-y-4">
                {event.recipes.map((recipe, index) => <label key={recipe.id} className="block text-sm font-semibold text-espresso">
                    {recipe.category} · Gericht {index + 1}
                    <input value={drafts[recipe.id] ?? ""} onChange={(e) => setDrafts({ ...drafts, [recipe.id]: e.target.value })} maxLength={200} minLength={2} required enterKeyHint="done" placeholder="z. B. Zimtschnecken" className={input} />
                </label>)}
                <button disabled={busy} className="flex min-h-12 w-full items-center justify-center rounded-full bg-espresso px-6 py-3 text-sm font-semibold text-white transition hover:bg-caramel disabled:opacity-50">
                    {busy ? <LoadingIndicator light label="Wird gespeichert…" /> : allMine ? "Tipp ändern" : "Tipp abgeben"}
                </button>
            </form>
            <ul className="mt-4 space-y-1 text-xs" aria-label="Wer hat getippt">{event.stats.map((player) => {
                const ready = guessing.complete.includes(player.email);
                return <li key={player.email} className={`flex items-center gap-1.5 ${ready ? "font-semibold text-espresso" : "text-bark"}`}>
                    <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-full ${ready ? "bg-caramel text-white" : "border border-espresso/20"}`} aria-hidden="true">{ready && <Check size={10} strokeWidth={3} />}</span>
                    <span className="min-w-0 truncate">{player.is_me ? "Du" : player.email}{ready ? " hat getippt" : " überlegt noch…"}</span>
                </li>;
            })}</ul>
        </>}

        {guessing.judging && <div className="mt-5 text-center">
            <LoadingIndicator label="Alle haben getippt – die KI vergleicht mit den echten Gerichten…" />
            {judgingStuck && <button type="button" onClick={retry} disabled={busy} className="mx-auto mt-3 flex min-h-11 items-center gap-1.5 text-sm font-semibold text-caramel"><RotateCcw size={14} aria-hidden="true" /> Erneut auswerten</button>}
        </div>}
        {guessing.error && !guessing.judging && <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">{guessing.error}
            <button type="button" onClick={retry} disabled={busy} className="mt-2 flex min-h-11 items-center gap-1.5 font-semibold underline"><RotateCcw size={14} aria-hidden="true" /> Erneut auswerten</button>
        </div>}

        {guessing.done && (!reduceMotion && countdown > 0
            // Full-screen so nothing below (the now revealed dishes) spoils the countdown.
            ? <div className="fixed inset-0 z-[60] grid place-items-center overflow-hidden bg-espresso p-6 text-center text-white" role="status">
                <div>
                    <p className="text-xs font-bold tracking-[0.2em] text-saffron uppercase">Die Auflösung kommt</p>
                    <AnimatePresence mode="popLayout"><motion.p key={countdown} initial={{ scale: 2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} className="mt-2 text-6xl font-bold">{countdown}</motion.p></AnimatePresence>
                </div>
            </div>
            : <ul className="mt-5 space-y-3">{guessing.results.map((result, index) => <motion.li key={`${result.recipe_id}-${result.email}`} initial={reduceMotion ? false : { opacity: 0, y: 16, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: index * 0.25 }}
                className={`flex gap-3 rounded-2xl p-4 ${result.correct ? "bg-green-50" : "bg-linen"}`}>
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${result.correct ? "bg-green-600 text-white" : "bg-espresso/10 text-bark"}`} aria-hidden="true">{result.correct ? <Check size={16} strokeWidth={3} /> : <X size={16} strokeWidth={3} />}</span>
                <div className="min-w-0 flex-1 break-words">
                    <p className="text-sm font-semibold text-espresso">{result.is_me ? "Du" : result.email}: „{result.guess}“ <span className={result.correct ? "text-green-700" : "text-bark"}>{result.correct ? `· richtig, −3` : "· leider nicht"}</span></p>
                    {result.reason && <p className="mt-1 text-sm leading-6 text-bark">{result.reason}</p>}
                </div>
            </motion.li>)}
                {guessing.bonus > 0 && <li className="rounded-2xl bg-green-600 px-4 py-3 text-center text-sm font-bold text-white">−{guessing.bonus} Strafpunkte für richtige Tipps</li>}
            </ul>)}
    </section>;
}
