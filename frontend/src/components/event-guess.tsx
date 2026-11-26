"use client";
import { FormEvent, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronDown, HelpCircle, RotateCcw, X } from "lucide-react";
import { EventDetail, eventApi } from "@/lib/events";
import { LoadingIndicator } from "@/components/loading-indicator";
import { PlayerChip } from "@/components/event-jury";
import { ease, playerName } from "@/components/event-stage";

/** So lange nach der Auflösung stehen die Ergebnisse offen da; danach nur noch als zusammengeklappte Zeile. */
const FRESH_RESULTS_MS = 10 * 60_000;

/** Cook-day guessing round: every player guesses each dish before anything is revealed. */
export function EventGuess({ event, onChange }: { event: EventDetail; onChange: () => void }) {
    const guessing = event.guessing!;
    const [drafts, setDrafts] = useState<Record<string, string>>(guessing.mine);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    // null = automatisch (frisch aufgelöst → offen), sonst die Wahl der Person.
    const [expanded, setExpanded] = useState<boolean | null>(null);
    const reduceMotion = useReducedMotion();
    const offset = event.clock_offset ?? 0;
    const revealAt = guessing.reveal_at ? Date.parse(guessing.reveal_at) : 0;
    const ticking = (guessing.done && revealAt > 0) || guessing.judging;
    // Wer später lädt, hat sofort die richtige Zeit – sonst blitzt vor dem ersten Tick das Ergebnis auf.
    const [now, setNow] = useState<number | null>(() => ticking ? Date.now() + offset : null);
    useEffect(() => {
        if (!ticking) return;
        const tick = () => setNow(Date.now() + offset);
        const first = window.setTimeout(tick, 0);
        const timer = window.setInterval(tick, 250);
        return () => { window.clearTimeout(first); window.clearInterval(timer); };
    }, [ticking, offset]);
    // Gerade live aufgelöst, Uhr tickt aber noch nicht: als laufender Countdown behandeln (kein Spoiler).
    const countdown = now === null ? (guessing.done && revealAt > 0 ? 1 : 0) : Math.ceil((revealAt - now) / 1000);

    const allMine = event.recipes.every((recipe) => (guessing.mine[recipe.id] ?? "").length > 0);
    const judgingStuck = guessing.judging && guessing.judging_since !== null && now !== null && now - Date.parse(guessing.judging_since) > 120_000;
    const fresh = now !== null && revealAt > 0 && now - revealAt < FRESH_RESULTS_MS;
    const showResults = expanded ?? fresh;
    const correct = guessing.results.filter((result) => result.correct).length;

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

    const input = "mt-1.5 min-h-12 w-full rounded-2xl border border-espresso/10 bg-linen/60 px-4 text-base text-espresso outline-none transition placeholder:text-bark/40 focus:border-caramel/50 focus:bg-white focus:ring-4 focus:ring-caramel/10";

    // Nach der Auflösung: kompakte, aufklappbare Ergebniszeile statt dauerhaft großer Karte.
    if (guessing.done && (reduceMotion || countdown <= 0)) {
        return <section className="mb-6 overflow-hidden rounded-2xl bg-white ring-1 ring-espresso/[0.07]" aria-labelledby="guess-title">
            <button type="button" onClick={() => setExpanded(!showResults)} aria-expanded={showResults} className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors active:bg-linen">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-saffron/25 text-caramel" aria-hidden="true"><HelpCircle size={18} /></span>
                <span className="min-w-0 flex-1">
                    <span id="guess-title" className="block text-sm font-semibold text-espresso">Raten aufgelöst</span>
                    <span className="block text-xs text-bark">{correct} von {guessing.results.length} richtig geraten</span>
                </span>
                {guessing.bonus > 0 && <span className="shrink-0 rounded-full bg-green-50 px-2.5 py-1 text-xs font-bold text-green-700 tabular-nums">−{guessing.bonus}</span>}
                <motion.span animate={{ rotate: showResults ? 180 : 0 }} transition={{ duration: 0.25, ease }} className="grid shrink-0 text-bark/60" aria-hidden="true"><ChevronDown size={18} /></motion.span>
            </button>
            <AnimatePresence initial={false}>
                {showResults && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease }} className="overflow-hidden">
                    <ul className="space-y-2 px-3 pb-3">{guessing.results.map((result, index) => <motion.li key={`${result.recipe_id}-${result.email}`} initial={reduceMotion || !fresh ? false : { opacity: 0, y: 16, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: index * 0.25 }}
                        className={`flex gap-3 rounded-2xl p-3.5 ${result.correct ? "bg-green-50" : "bg-linen"}`}>
                        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${result.correct ? "bg-green-600 text-white" : "bg-espresso/10 text-bark"}`} aria-hidden="true">{result.correct ? <Check size={15} strokeWidth={3} /> : <X size={15} strokeWidth={3} />}</span>
                        <div className="min-w-0 flex-1 break-words">
                            <p className="text-sm font-semibold text-espresso">{playerName(result.email, result.is_me)}: „{result.guess}“ <span className={result.correct ? "text-green-700" : "font-medium text-bark"}>{result.correct ? "· richtig, −3" : "· leider nicht"}</span></p>
                            {result.reason && <p className="mt-1 text-sm leading-6 text-bark">{result.reason}</p>}
                        </div>
                    </motion.li>)}</ul>
                </motion.div>}
            </AnimatePresence>
        </section>;
    }

    return <section className="mb-8 rounded-[1.75rem] bg-white p-5 shadow-[0_1px_2px_rgba(66,52,33,0.05),0_14px_36px_-24px_rgba(66,52,33,0.4)] ring-1 ring-espresso/[0.06] sm:p-7" aria-labelledby="guess-title">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-caramel uppercase">Vor dem Reveal</p>
        <h2 id="guess-title" className="mt-1.5 text-2xl font-semibold tracking-[-0.03em] text-espresso">Was kocht ihr heute?</h2>
        {error && <p role="alert" className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}

        {guessing.open && !guessing.judging && <>
            <p className="mt-2 text-sm leading-6 text-bark">Bevor aufgedeckt wird, tippt jeder auf das Gericht. Jeder richtige Tipp zieht {3} Strafpunkte ab, ein falscher kostet nichts.</p>
            <form onSubmit={submit} className="mt-5 space-y-4">
                {event.recipes.map((recipe, index) => <label key={recipe.id} className="block text-sm font-semibold text-espresso">
                    Gericht {index + 1} <span className="font-medium text-bark">· {recipe.category}</span>
                    <input value={drafts[recipe.id] ?? ""} onChange={(e) => setDrafts({ ...drafts, [recipe.id]: e.target.value })} maxLength={200} minLength={2} required enterKeyHint="done" placeholder="z. B. Zimtschnecken" className={input} />
                </label>)}
                <button disabled={busy} className="flex min-h-12 w-full items-center justify-center rounded-full bg-espresso px-6 py-3 text-sm font-semibold text-white transition hover:bg-caramel active:scale-[0.98] disabled:opacity-50">
                    {busy ? <LoadingIndicator light label="Wird gespeichert…" /> : allMine ? "Tipp ändern" : "Tipp abgeben"}
                </button>
            </form>
            <ul className="mt-4 flex flex-wrap gap-2" aria-label="Wer hat getippt">{event.stats.map((player) => <PlayerChip key={player.email} name={playerName(player.email, player.is_me)}
                done={guessing.complete.includes(player.email)} doneLabel={player.is_me ? "hast getippt" : "hat getippt"} waitingLabel={player.is_me ? "überlegst noch" : "überlegt noch…"} />)}</ul>
        </>}

        {guessing.judging && <div className="mt-5 rounded-2xl bg-linen px-4 py-6 text-center text-sm">
            <LoadingIndicator label="Alle haben getippt – die KI vergleicht mit den echten Gerichten…" />
            {judgingStuck && <button type="button" onClick={retry} disabled={busy} className="mx-auto mt-3 flex min-h-11 items-center gap-1.5 text-sm font-semibold text-caramel"><RotateCcw size={14} aria-hidden="true" /> Erneut auswerten</button>}
        </div>}
        {guessing.error && !guessing.judging && <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">{guessing.error}
            <button type="button" onClick={retry} disabled={busy} className="mt-2 flex min-h-11 items-center gap-1.5 font-semibold underline"><RotateCcw size={14} aria-hidden="true" /> Erneut auswerten</button>
        </div>}

        {/* Full-screen so nothing below (the now revealed dishes) spoils the countdown. */}
        {guessing.done && <div className="fixed inset-0 z-[60] grid place-items-center overflow-hidden bg-espresso p-6 text-center text-white" role="status">
            <div>
                <p className="text-[11px] font-semibold tracking-[0.2em] text-saffron uppercase">Die Auflösung kommt</p>
                <AnimatePresence mode="popLayout"><motion.p key={countdown} initial={{ scale: 2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} className="mt-2 text-6xl font-bold tabular-nums">{countdown}</motion.p></AnimatePresence>
            </div>
        </div>}
    </section>;
}
