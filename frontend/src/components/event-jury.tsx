"use client";
/* eslint-disable @next/next/no-img-element -- photos are data URLs */
import { ChangeEvent, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Camera, Check, ChefHat, Flag, Play, RotateCcw, SkipForward, Star } from "lucide-react";
import { compressImage } from "@/lib/image";
import { EventDetail, EventRecipe, JudgedDish, eventApi } from "@/lib/events";
import { LoadingIndicator } from "@/components/loading-indicator";

const TASTE_LABELS = ["", "1 – ungenießbar", "2 – schlecht", "3 – mäßig", "4 – geht so", "5 – okay", "6 – ordentlich", "7 – gut", "8 – sehr gut", "9 – hervorragend", "10 – grandios"];

function Pips({ value, animate = false }: { value: number; animate?: boolean }) {
    // −1 = perfect: the jury pays a point back.
    if (value < 0) return <motion.span initial={animate ? { scale: 0 } : false} animate={{ scale: 1 }} transition={{ delay: animate ? 0.25 : 0, type: "spring", stiffness: 400, damping: 12 }}
        className="flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-bold text-green-700" aria-label={`Perfekt: ${value} Strafpunkt`}><Star size={12} fill="currentColor" aria-hidden="true" />Perfekt {"\u2212"}{Math.abs(value)}</motion.span>;
    return <span className="flex gap-1" aria-label={`${value} von 3 Strafpunkten`}>{[0, 1, 2].map((i) => <motion.span key={i} aria-hidden="true"
        initial={animate ? { scale: 0.3, backgroundColor: "rgba(66,52,33,0.1)" } : false}
        animate={{ scale: 1, backgroundColor: i < value ? "rgb(220,38,38)" : "rgba(66,52,33,0.1)" }}
        transition={{ delay: animate ? 0.25 + i * 0.22 : 0, type: "spring", stiffness: 400, damping: 14 }}
        className="h-2.5 w-2.5 rounded-full" />)}</span>;
}

const STEP_MS = 1400;
// Results opened long after the reveal (or re-opened later) are shown directly instead of replaying the show.
const LATE_JOIN_MS = 90_000;

/** The jury show for one dish. Starts at the server's reveal time on every device; reduced motion or late joiners get the result at once. */
function DishReveal({ event, judged }: { event: EventDetail; judged: JudgedDish }) {
    const reduceMotion = useReducedMotion();
    // Steps: 0 = photos, 1..n = categories, n + 1 = verdict.
    const stepCount = judged.categories.length + 2;
    // Server clock offset (measured when the event was loaded), so "reveal_at" means the same moment on both phones.
    const offset = event.clock_offset ?? 0;
    const revealAt = judged.reveal_at ? Date.parse(judged.reveal_at) : 0;
    // Server-adjusted "now"; null until the first tick so the render itself stays pure.
    const [now, setNow] = useState<number | null>(null);
    const [replayFrom, setReplayFrom] = useState<number | null>(null);
    const [skipped, setSkipped] = useState(false);

    const start = replayFrom ?? revealAt;
    const lateJoin = replayFrom === null && (!revealAt || (now !== null && now - revealAt > LATE_JOIN_MS + stepCount * STEP_MS));
    const done = reduceMotion || skipped || lateJoin;
    const countdown = now === null ? 0 : Math.ceil((start - now) / 1000);
    const visible = done ? stepCount : now === null ? 0 : Math.max(0, Math.floor((now - start) / STEP_MS) + 1);
    const finished = visible >= stepCount;

    useEffect(() => {
        if (done || finished) return;
        const timer = window.setInterval(() => setNow(Date.now() + offset), 200);
        return () => window.clearInterval(timer);
    }, [done, finished, offset]);

    if (!done && now === null) return <div className="mt-4 min-h-48 rounded-3xl bg-espresso" aria-hidden="true" />;

    if (!done && countdown > 0) {
        return <div className="mt-4 grid min-h-48 place-items-center overflow-hidden rounded-3xl bg-espresso p-8 text-center text-white" role="status" aria-live="polite">
            <div>
                <p className="text-sm font-semibold tracking-[0.2em] text-saffron uppercase">Die Jury hat entschieden</p>
                <AnimatePresence mode="popLayout">
                    <motion.p key={countdown} initial={{ scale: 2.2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} transition={{ type: "spring", stiffness: 260, damping: 18 }} className="mt-4 text-7xl font-bold">{countdown}</motion.p>
                </AnimatePresence>
                <p className="mt-4 text-sm text-white/70">Alle Handys zeigen das Urteil gleichzeitig.</p>
            </div>
        </div>;
    }

    const animate = !done;
    const photos = event.submissions.filter((s) => s.recipe_id === judged.recipe_id);
    const verdictShown = visible >= stepCount;
    return <div className="mt-4" aria-live={animate ? "polite" : undefined}>
        <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-bold tracking-[0.2em] text-caramel uppercase">Urteil der Jury</p>
            {verdictShown && <motion.span initial={animate ? { scale: 0 } : false} animate={{ scale: 1 }} className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${judged.penalty < 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{judged.penalty < 0 ? `\u2212${Math.abs(judged.penalty)}` : judged.penalty} / 10 Strafpunkte</motion.span>}
        </div>
        {visible >= 1 && <ul className="mt-4 space-y-4">{photos.map((photo, index) => <motion.li key={photo.email} className="min-w-0" initial={animate ? { opacity: 0, rotate: index % 2 ? 6 : -6, scale: 0.8 } : false} animate={{ opacity: 1, rotate: 0, scale: 1 }} transition={{ delay: animate ? 0.2 + index * 0.15 : 0 }}>
            {photo.image_data && <img src={photo.image_data} alt={`Ergebnis von ${photo.is_me ? "dir" : photo.email}`} className="block aspect-square w-full max-w-full rounded-2xl object-cover sm:aspect-[4/3]" />}
            <p className="mt-1.5 truncate text-xs text-bark">{photo.is_me ? "Du" : photo.email} · {photo.taste_rating}/10</p>
        </motion.li>)}</ul>}
        <ul className="mt-5 divide-y divide-espresso/5">{judged.categories.map((category, index) => {
            if (visible < index + 2) return null;
            return <motion.li key={category.name} initial={animate ? { opacity: 0, x: -16 } : false} animate={{ opacity: 1, x: 0 }} className="py-3">
                <div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold text-espresso">{category.name}</span><Pips value={category.penalty} animate={animate} /></div>
                {category.comment && <p className="mt-1 text-sm text-bark">{category.comment}</p>}
            </motion.li>;
        })}</ul>
        {verdictShown && judged.verdict && <motion.p initial={animate ? { opacity: 0, y: 8 } : false} animate={{ opacity: 1, y: 0 }} className="mt-3 rounded-2xl bg-saffron/15 px-4 py-3 text-sm leading-6 text-espresso">{judged.verdict}</motion.p>}
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

    return <div className="mt-4">
        <p className="text-sm text-bark">Fertig gekocht? Jeder lädt ein Foto hoch und bewertet den Geschmack. Sobald alle dieses Gericht abgegeben haben, urteilt die Jury.</p>
        {/* Ohne capture-Attribut bieten Android und iOS Kamera, Galerie und Dateien zur Auswahl an. */}
        <label className="relative mt-4 flex aspect-[4/3] w-full cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-espresso/15 bg-linen text-sm font-semibold text-bark focus-within:ring-4 focus-within:ring-caramel/20">
            {image ? <img src={image} alt="Dein Ergebnis" className="absolute inset-0 h-full w-full object-cover" /> : <span className="flex flex-col items-center gap-2"><Camera size={26} className="text-caramel" aria-hidden="true" />Foto aufnehmen oder auswählen</span>}
            <input type="file" accept="image/*" onChange={pick} className="sr-only" aria-label={`Foto von ${recipe.title}`} />
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

/** Jury block under one dish: hand in, wait for the jury, then the dish's own verdict and penalty points. */
export function DishJuryPanel({ event, recipe, onChange }: { event: EventDetail; recipe: EventRecipe; onChange: () => void }) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const jury = recipe.jury;
    const handedIn = event.submissions.filter((s) => s.recipe_id === recipe.id).length;

    async function restart() {
        setBusy(true); setError("");
        try { await eventApi(`/events/${event.id}/recipes/${recipe.id}/judge`, { method: "POST" }); onChange(); }
        catch (caught) { setError((caught as Error).message); } finally { setBusy(false); }
    }

    return <section className="mt-6 border-t border-espresso/10 pt-5" aria-label={`Jury: ${recipe.title}`}>
        <h4 className="flex items-center gap-2 font-semibold text-espresso"><ChefHat size={18} className="text-caramel" aria-hidden="true" /> Jury</h4>
        {error && <p role="alert" className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
        {jury.phase === "cooking" && jury.error && <div className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">{jury.error}
            {handedIn >= event.participant_count && <button type="button" onClick={restart} disabled={busy} className="mt-2 flex min-h-11 items-center gap-1.5 font-semibold underline"><RotateCcw size={14} aria-hidden="true" /> Jury erneut starten</button>}
        </div>}
        {jury.phase === "cooking" && event.phase === "cooking" && <SubmissionForm event={event} recipe={recipe} onDone={onChange} />}
        {jury.phase === "judging" && <div className="mt-4 rounded-3xl bg-linen p-6 text-center">
            <motion.div aria-hidden="true" animate={{ rotate: [0, -8, 8, 0] }} transition={{ duration: 1.2, repeat: Infinity }} className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-saffron/30 text-espresso"><ChefHat size={26} /></motion.div>
            <div className="mt-3"><LoadingIndicator label="Alle haben abgegeben – die Jury probiert und schaut ganz genau hin…" /></div>
        </div>}
        {jury.phase === "judged" && jury.verdict && <DishReveal event={event} judged={jury.verdict} />}
    </section>;
}

/** Totals over all dishes; the event can be closed once every dish has its verdict. */
export function EventJury({ event, onChange }: { event: EventDetail; onChange: () => void }) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const judged = event.recipes.filter((recipe) => recipe.jury.phase === "judged" && recipe.jury.verdict);
    const juryTotal = judged.reduce((sum, recipe) => sum + (recipe.jury.verdict?.penalty ?? 0), 0);
    const guessBonus = event.guessing?.bonus ?? 0;
    const total = juryTotal + event.tip_count - guessBonus;
    const allJudged = event.phase === "judged" || event.phase === "finished";

    async function finish() {
        if (!window.confirm("Event abschließen? Danach sind keine Änderungen mehr möglich.")) return;
        setBusy(true); setError("");
        try { await eventApi(`/events/${event.id}/finish`, { method: "POST" }); onChange(); }
        catch (caught) { setError((caught as Error).message); } finally { setBusy(false); }
    }

    return <section className="mt-14 border-t border-espresso/10 pt-10" aria-labelledby="jury-title">
        <h2 id="jury-title" className="flex items-center gap-2 text-xl font-semibold text-espresso"><ChefHat size={20} className="text-caramel" aria-hidden="true" /> Die Abrechnung</h2>
        {error && <p role="alert" className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
        {!allJudged && <p className="mt-1 text-sm text-bark">{judged.length} von {event.recipes.length} Gerichten bewertet. Jedes Gericht hat seine eigene Jury – die Abgabe findet ihr direkt unter dem Gericht.</p>}
        <div className="mt-6 rounded-3xl bg-cream/60 p-5 text-sm text-espresso">
            {judged.map((recipe) => <p key={recipe.id} className="mt-1 flex justify-between gap-3 first:mt-0"><span className="min-w-0 break-words">{recipe.category} · {recipe.title}</span><span className={`shrink-0 font-semibold ${(recipe.jury.verdict?.penalty ?? 0) < 0 ? "text-green-700" : ""}`}>{(recipe.jury.verdict?.penalty ?? 0) < 0 ? `\u2212${Math.abs(recipe.jury.verdict?.penalty ?? 0)}` : recipe.jury.verdict?.penalty}</span></p>)}
            <p className={`flex justify-between ${judged.length ? "mt-1" : ""}`}><span>Tipps</span><span className="font-semibold">{event.tip_count}</span></p>
            {guessBonus > 0 && <p className="mt-1 flex justify-between text-green-700"><span>Richtig geraten</span><span className="font-semibold">−{guessBonus}</span></p>}
            <p className="mt-2 flex justify-between border-t border-espresso/10 pt-2 text-base font-semibold"><span>{allJudged ? "Strafpunkte" : "Strafpunkte bisher"}</span><span>{total < 0 && "−"}{Math.abs(total)}</span></p>
            <p className="mt-2 text-xs text-bark">Die Punkte wandern beim Abschluss auf euer Teamkonto und werden beim nächsten gemeinsamen Event in Handicaps eingelöst.</p>
        </div>
        {event.phase === "judged" && event.is_creator && <button type="button" disabled={busy} onClick={finish} className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-caramel px-6 py-3 text-sm font-semibold text-white transition hover:bg-espresso disabled:opacity-50">
            {busy ? <LoadingIndicator light label="Wird abgeschlossen…" /> : <><Flag size={16} aria-hidden="true" /> Event abschließen</>}
        </button>}
        {event.phase === "judged" && !event.is_creator && <p className="mt-4 text-sm text-bark">Wer das Event gestartet hat, schließt es ab.</p>}
        {event.phase === "finished" && <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-espresso"><Check size={16} className="text-caramel" aria-hidden="true" /> Abgeschlossen · {event.penalty_earned} Strafpunkte gebucht</p>}
    </section>;
}
