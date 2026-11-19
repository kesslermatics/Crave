"use client";
/* eslint-disable @next/next/no-img-element -- photos are data URLs */
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Camera, Check, ChefHat, Flag, Play, RotateCcw, SkipForward } from "lucide-react";
import { compressImage } from "@/lib/image";
import { EventDetail, EventRecipe, JuryVerdict, eventApi } from "@/lib/events";
import { LoadingIndicator } from "@/components/loading-indicator";

const TASTE_LABELS = ["", "1 – ungenießbar", "2 – schlecht", "3 – mäßig", "4 – geht so", "5 – okay", "6 – ordentlich", "7 – gut", "8 – sehr gut", "9 – hervorragend", "10 – grandios"];

function Pips({ value, animate = false }: { value: number; animate?: boolean }) {
    return <span className="flex gap-1" aria-label={`${value} von 3 Strafpunkten`}>{[0, 1, 2].map((i) => <motion.span key={i} aria-hidden="true"
        initial={animate ? { scale: 0.3, backgroundColor: "rgba(66,52,33,0.1)" } : false}
        animate={{ scale: 1, backgroundColor: i < value ? "rgb(220,38,38)" : "rgba(66,52,33,0.1)" }}
        transition={{ delay: animate ? 0.25 + i * 0.22 : 0, type: "spring", stiffness: 400, damping: 14 }}
        className="h-2.5 w-2.5 rounded-full" />)}</span>;
}

/** Counts up to `value` so penalty totals tick like a scoreboard. */
function Counter({ value, animate }: { value: number; animate: boolean }) {
    const [shown, setShown] = useState(animate ? 0 : value);
    useEffect(() => {
        if (!animate) return;
        const timer = window.setInterval(() => setShown((current) => (current >= value ? current : current + 1)), 120);
        return () => window.clearInterval(timer);
    }, [value, animate]);
    return <>{animate ? shown : value}</>;
}

const STEP_MS = 1400;
// Results opened long after the reveal (or re-opened later) are shown directly instead of replaying the show.
const LATE_JOIN_MS = 90_000;

type Step = { kind: "dish"; dish: number } | { kind: "category"; dish: number; category: number } | { kind: "verdict"; dish: number } | { kind: "summary" };

function revealSteps(verdict: JuryVerdict): Step[] {
    const steps: Step[] = [];
    verdict.recipes.forEach((recipe, dish) => {
        steps.push({ kind: "dish", dish });
        recipe.categories.forEach((_, category) => steps.push({ kind: "category", dish, category }));
        steps.push({ kind: "verdict", dish });
    });
    steps.push({ kind: "summary" });
    return steps;
}

/** The jury show. Starts at the server's reveal time on every device; reduced motion or late joiners get the result at once. */
function JuryReveal({ event }: { event: EventDetail }) {
    const verdict = event.verdict!;
    const reduceMotion = useReducedMotion();
    const steps = useMemo(() => revealSteps(verdict), [verdict]);
    // Server clock offset (measured when the event was loaded), so "reveal_at" means the same moment on both phones.
    const offset = event.clock_offset ?? 0;
    const revealAt = verdict.reveal_at ? Date.parse(verdict.reveal_at) : 0;
    // Server-adjusted "now"; null until the first tick so the render itself stays pure.
    const [now, setNow] = useState<number | null>(null);
    const [replayFrom, setReplayFrom] = useState<number | null>(null);
    const [skipped, setSkipped] = useState(false);

    const start = replayFrom ?? revealAt;
    const lateJoin = replayFrom === null && (!revealAt || (now !== null && now - revealAt > LATE_JOIN_MS + steps.length * STEP_MS));
    const done = reduceMotion || skipped || lateJoin;
    const countdown = now === null ? 0 : Math.ceil((start - now) / 1000);
    const visible = done ? steps.length : now === null ? 0 : Math.max(0, Math.floor((now - start) / STEP_MS) + 1);
    const finished = visible >= steps.length;

    useEffect(() => {
        if (done || finished) return;
        const timer = window.setInterval(() => setNow(Date.now() + offset), 200);
        return () => window.clearInterval(timer);
    }, [done, finished, offset]);

    if (!done && now === null) return <div className="mt-6 min-h-72 rounded-3xl bg-espresso" aria-hidden="true" />;

    const shown = steps.slice(0, visible);
    const isShown = (match: (step: Step) => boolean) => shown.some(match);
    const animate = !done;

    if (!done && countdown > 0) {
        return <div className="mt-6 grid min-h-72 place-items-center overflow-hidden rounded-3xl bg-espresso p-8 text-center text-white" role="status" aria-live="polite">
            <div>
                <p className="text-sm font-semibold tracking-[0.2em] text-saffron uppercase">Die Jury hat entschieden</p>
                <AnimatePresence mode="popLayout">
                    <motion.p key={countdown} initial={{ scale: 2.2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} transition={{ type: "spring", stiffness: 260, damping: 18 }} className="mt-4 text-7xl font-bold">{countdown}</motion.p>
                </AnimatePresence>
                <p className="mt-4 text-sm text-white/70">Alle Handys zeigen das Urteil gleichzeitig.</p>
            </div>
        </div>;
    }

    const juryTotal = verdict.penalty;
    const guessBonus = event.guessing?.bonus ?? 0;
    return <div className="mt-6 space-y-6" aria-live={animate ? "polite" : undefined}>
        {verdict.recipes.map((judged, dish) => {
            if (!isShown((step) => step.kind === "dish" && step.dish === dish)) return null;
            const photos = event.submissions.filter((s) => s.recipe_id === judged.recipe_id);
            const verdictShown = isShown((step) => step.kind === "verdict" && step.dish === dish);
            return <motion.article key={judged.recipe_id} initial={animate ? { opacity: 0, y: 40, scale: 0.94 } : false} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 140, damping: 18 }} className="rounded-3xl bg-white p-5 shadow-[0_8px_30px_rgba(66,52,33,0.1)] sm:p-6">
                <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold text-espresso">{judged.title}</h3>
                    {verdictShown && <motion.span initial={animate ? { scale: 0 } : false} animate={{ scale: 1 }} className="shrink-0 rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">{judged.penalty} / 10</motion.span>}
                </div>
                <ul className="mt-4 grid grid-cols-2 gap-3">{photos.map((photo, index) => <motion.li key={photo.email} initial={animate ? { opacity: 0, rotate: index % 2 ? 6 : -6, scale: 0.8 } : false} animate={{ opacity: 1, rotate: 0, scale: 1 }} transition={{ delay: animate ? 0.2 + index * 0.15 : 0 }}>
                    {photo.image_data && <img src={photo.image_data} alt={`Ergebnis von ${photo.is_me ? "dir" : photo.email}`} className="aspect-square w-full rounded-2xl object-cover" />}
                    <p className="mt-1.5 truncate text-xs text-bark">{photo.is_me ? "Du" : photo.email} · {photo.taste_rating}/10</p>
                </motion.li>)}</ul>
                <ul className="mt-5 divide-y divide-espresso/5">{judged.categories.map((category, index) => {
                    if (!isShown((step) => step.kind === "category" && step.dish === dish && step.category === index)) return null;
                    return <motion.li key={category.name} initial={animate ? { opacity: 0, x: -16 } : false} animate={{ opacity: 1, x: 0 }} className="py-3">
                        <div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold text-espresso">{category.name}</span><Pips value={category.penalty} animate={animate} /></div>
                        {category.comment && <p className="mt-1 text-sm text-bark">{category.comment}</p>}
                    </motion.li>;
                })}</ul>
                {verdictShown && judged.verdict && <motion.p initial={animate ? { opacity: 0, y: 8 } : false} animate={{ opacity: 1, y: 0 }} className="mt-3 rounded-2xl bg-saffron/15 px-4 py-3 text-sm leading-6 text-espresso">{judged.verdict}</motion.p>}
            </motion.article>;
        })}

        {finished && <>
            <motion.blockquote initial={animate ? { opacity: 0, scale: 0.9 } : false} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 120 }} className="rounded-3xl bg-espresso p-6 text-white">
                <p className="text-xs font-bold tracking-[0.2em] text-saffron uppercase">Das Urteil</p>
                <p className="mt-2 text-base leading-7">„{verdict.summary}“</p>
            </motion.blockquote>
            <motion.div initial={animate ? { opacity: 0, y: 12 } : false} animate={{ opacity: 1, y: 0 }} transition={{ delay: animate ? 0.4 : 0 }} className="rounded-3xl bg-cream/60 p-5 text-sm text-espresso">
                <p className="flex justify-between"><span>Jury</span><span className="font-semibold"><Counter value={juryTotal} animate={animate} /></span></p>
                <p className="mt-1 flex justify-between"><span>Tipps</span><span className="font-semibold">{event.tip_count}</span></p>
                {guessBonus > 0 && <p className="mt-1 flex justify-between text-green-700"><span>Richtig geraten</span><span className="font-semibold">−{guessBonus}</span></p>}
                <p className="mt-2 flex justify-between border-t border-espresso/10 pt-2 text-base font-semibold"><span>Strafpunkte</span><span>{juryTotal + event.tip_count - guessBonus < 0 && "−"}<Counter value={Math.abs(juryTotal + event.tip_count - guessBonus)} animate={animate} /></span></p>
                <p className="mt-2 text-xs text-bark">Die Punkte wandern beim Abschluss auf euer Teamkonto und werden beim nächsten gemeinsamen Event in Handicaps eingelöst.</p>
            </motion.div>
        </>}

        <div className="flex justify-end">
            {!finished && !done
                ? <button type="button" onClick={() => setSkipped(true)} className="flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-bark hover:text-espresso"><SkipForward size={15} aria-hidden="true" /> Überspringen</button>
                : !reduceMotion && <button type="button" onClick={() => { setSkipped(false); setNow(Date.now() + offset); setReplayFrom(Date.now() + offset + 3000); }} className="flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-caramel hover:text-espresso"><Play size={15} aria-hidden="true" /> Nochmal abspielen</button>}
        </div>
    </div>;
}

function SubmissionForm({ event, recipe, onDone }: { event: EventDetail; recipe: EventRecipe; onDone: () => void }) {
    const mine = event.submissions.find((s) => s.is_me && s.recipe_id === recipe.id);
    const [image, setImage] = useState<string | null>(mine?.image_data ?? null);
    const [rating, setRating] = useState<number>(mine?.taste_rating ?? 0);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const others = event.submissions.filter((s) => s.recipe_id === recipe.id);

    async function pick(changeEvent: ChangeEvent<HTMLInputElement>) {
        const file = changeEvent.target.files?.[0];
        changeEvent.target.value = "";
        if (!file) return;
        try { setImage(await compressImage(file, 1280)); setError(""); } catch (caught) { setError((caught as Error).message); }
    }
    async function submit() {
        if (!image || !rating) return;
        setBusy(true); setError("");
        try { await eventApi(`/events/${event.id}/submissions`, { method: "POST", body: { recipe_id: recipe.id, image, taste_rating: rating } }); onDone(); }
        catch (caught) { setError((caught as Error).message); } finally { setBusy(false); }
    }

    return <div className="rounded-3xl bg-white p-5 shadow-[0_1px_2px_rgba(66,52,33,0.06)]">
        <p className="text-xs font-bold tracking-[0.2em] text-caramel uppercase">{recipe.category}</p>
        <h3 className="mt-1 font-semibold text-espresso">{recipe.title}</h3>
        <label className="mt-4 grid aspect-[4/3] w-full cursor-pointer place-items-center overflow-hidden rounded-2xl border-2 border-dashed border-espresso/15 bg-linen text-sm font-semibold text-bark focus-within:ring-4 focus-within:ring-caramel/20">
            {image ? <img src={image} alt="Dein Ergebnis" className="h-full w-full object-cover" /> : <span className="flex flex-col items-center gap-2"><Camera size={26} className="text-caramel" aria-hidden="true" />Foto aufnehmen</span>}
            <input type="file" accept="image/*" capture="environment" onChange={pick} className="sr-only" aria-label={`Foto von ${recipe.title}`} />
        </label>
        <label className="mt-4 block text-sm font-semibold text-espresso">Wie hat es dir geschmeckt?
            <select value={rating} onChange={(e) => setRating(Number(e.target.value))} className="mt-1.5 min-h-12 w-full rounded-2xl border border-espresso/10 bg-white px-4 text-base text-espresso outline-none focus:border-caramel/50 focus:ring-4 focus:ring-caramel/10 sm:text-sm">
                <option value={0} disabled>Bitte wählen</option>
                {TASTE_LABELS.slice(1).map((label, index) => <option key={label} value={index + 1}>{label}</option>)}
            </select>
        </label>
        {error && <p role="alert" className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
        <button type="button" onClick={submit} disabled={busy || !image || !rating} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-espresso px-6 py-3 text-sm font-semibold text-white transition hover:bg-caramel disabled:bg-espresso/20">
            {busy ? <LoadingIndicator light label="Wird hochgeladen…" /> : mine ? "Abgabe aktualisieren" : "Abgeben"}
        </button>
        <ul className="mt-3 space-y-1 text-xs" aria-label="Abgaben">{event.stats.map((player) => {
            const handedIn = others.some((s) => s.email === player.email);
            return <li key={player.email} className={`flex items-center gap-1.5 ${handedIn ? "font-semibold text-espresso" : "text-bark"}`}>
                <motion.span key={String(handedIn)} initial={handedIn ? { scale: 0 } : false} animate={{ scale: 1 }} className={`grid h-4 w-4 place-items-center rounded-full ${handedIn ? "bg-caramel text-white" : "border border-espresso/20"}`} aria-hidden="true">{handedIn && <Check size={10} strokeWidth={3} />}</motion.span>
                {player.is_me ? "Du" : player.email}{handedIn ? " hat abgegeben" : " kocht noch…"}
            </li>;
        })}</ul>
    </div>;
}

export function EventJury({ event, onChange }: { event: EventDetail; onChange: () => void }) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const totalNeeded = event.recipes.length * event.participant_count;

    async function action(path: string, confirmText?: string) {
        if (confirmText && !window.confirm(confirmText)) return;
        setBusy(true); setError("");
        try { await eventApi(`/events/${event.id}/${path}`, { method: "POST" }); onChange(); }
        catch (caught) { setError((caught as Error).message); } finally { setBusy(false); }
    }

    return <section className="mt-14 border-t border-espresso/10 pt-10" aria-labelledby="jury-title">
        <h2 id="jury-title" className="flex items-center gap-2 text-xl font-semibold text-espresso"><ChefHat size={20} className="text-caramel" aria-hidden="true" /> Die Jury</h2>
        {error && <p role="alert" className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}

        {event.phase === "cooking" && <>
            <p className="mt-1 text-sm text-bark">Fertig gekocht? Jeder lädt ein Foto hoch und bewertet den Geschmack. Sobald alle abgegeben haben, urteilt die Jury.</p>
            {event.jury_error && <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">{event.jury_error}
                {event.submissions.length >= totalNeeded && <button type="button" onClick={() => action("judge")} disabled={busy} className="mt-2 flex min-h-11 items-center gap-1.5 font-semibold underline"><RotateCcw size={14} aria-hidden="true" /> Jury erneut starten</button>}
            </div>}
            <div className="mt-6 grid gap-4 sm:grid-cols-2">{event.recipes.map((recipe) => <SubmissionForm key={recipe.id} event={event} recipe={recipe} onDone={onChange} />)}</div>
        </>}

        {event.phase === "judging" && <div className="mt-6 rounded-3xl bg-white p-6 text-center">
            <motion.div aria-hidden="true" animate={{ rotate: [0, -8, 8, 0] }} transition={{ duration: 1.2, repeat: Infinity }} className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-saffron/30 text-espresso"><ChefHat size={26} /></motion.div>
            <div className="mt-3"><LoadingIndicator label="Alle haben abgegeben – die Jury probiert und schaut ganz genau hin…" /></div>
        </div>}

        {event.verdict && (event.phase === "judged" || event.phase === "finished") && <div className="space-y-6">
            <JuryReveal event={event} />
            {event.phase === "judged" && event.is_creator && <button type="button" disabled={busy} onClick={() => action("finish", "Event abschließen? Danach sind keine Änderungen mehr möglich.")} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-caramel px-6 py-3 text-sm font-semibold text-white transition hover:bg-espresso disabled:opacity-50">
                {busy ? <LoadingIndicator light label="Wird abgeschlossen…" /> : <><Flag size={16} aria-hidden="true" /> Event abschließen</>}
            </button>}
            {event.phase === "judged" && !event.is_creator && <p className="text-sm text-bark">Wer das Event gestartet hat, schließt es ab.</p>}
            {event.phase === "finished" && <p className="flex items-center gap-2 text-sm font-semibold text-espresso"><Check size={16} className="text-caramel" aria-hidden="true" /> Abgeschlossen · {event.penalty_earned} Strafpunkte gebucht</p>}
        </div>}
    </section>;
}
