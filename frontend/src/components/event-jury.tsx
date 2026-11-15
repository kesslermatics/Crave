"use client";
/* eslint-disable @next/next/no-img-element -- photos are data URLs */
import { ChangeEvent, useState } from "react";
import { motion } from "framer-motion";
import { Camera, Check, ChefHat, Flag, RotateCcw } from "lucide-react";
import { compressImage } from "@/lib/image";
import { EventDetail, EventRecipe, eventApi } from "@/lib/events";
import { LoadingIndicator } from "@/components/loading-indicator";

const TASTE_LABELS = ["", "1 – ungenießbar", "2 – schlecht", "3 – mäßig", "4 – geht so", "5 – okay", "6 – ordentlich", "7 – gut", "8 – sehr gut", "9 – hervorragend", "10 – grandios"];

function Pips({ value }: { value: number }) {
    return <span className="flex gap-1" aria-label={`${value} von 3 Strafpunkten`}>{[0, 1, 2].map((i) => <span key={i} aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${i < value ? "bg-red-600" : "bg-espresso/10"}`} />)}</span>;
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
        <p className="mt-3 text-xs text-bark">{others.length} von {event.participant_count} abgegeben{others.length > 0 && `: ${others.map((s) => s.is_me ? "du" : s.email).join(", ")}`}</p>
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

        {event.phase === "judging" && <div className="mt-6 rounded-3xl bg-white p-6"><LoadingIndicator label="Die Jury probiert und schaut ganz genau hin…" /></div>}

        {event.verdict && (event.phase === "judged" || event.phase === "finished") && <div className="mt-6 space-y-6">
            <motion.blockquote initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl bg-espresso p-6 text-white">
                <p className="text-base leading-7">„{event.verdict.summary}“</p>
            </motion.blockquote>
            {event.verdict.recipes.map((judged, index) => {
                const photos = event.submissions.filter((s) => s.recipe_id === judged.recipe_id);
                return <motion.article key={judged.recipe_id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + index * 0.3 }} className="rounded-3xl bg-white p-5 shadow-[0_1px_2px_rgba(66,52,33,0.06)] sm:p-6">
                    <div className="flex items-start justify-between gap-3">
                        <h3 className="font-semibold text-espresso">{judged.title}</h3>
                        <span className="shrink-0 rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">{judged.penalty} / 10</span>
                    </div>
                    <ul className="mt-4 grid grid-cols-2 gap-3">{photos.map((photo) => <li key={photo.email}>
                        {photo.image_data && <img src={photo.image_data} alt={`Ergebnis von ${photo.is_me ? "dir" : photo.email}`} className="aspect-square w-full rounded-2xl object-cover" />}
                        <p className="mt-1.5 truncate text-xs text-bark">{photo.is_me ? "Du" : photo.email} · {photo.taste_rating}/10</p>
                    </li>)}</ul>
                    <ul className="mt-5 divide-y divide-espresso/5">{judged.categories.map((category) => <li key={category.name} className="py-3">
                        <div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold text-espresso">{category.name}</span><Pips value={category.penalty} /></div>
                        {category.comment && <p className="mt-1 text-sm text-bark">{category.comment}</p>}
                    </li>)}</ul>
                    {judged.verdict && <p className="mt-3 rounded-2xl bg-saffron/15 px-4 py-3 text-sm leading-6 text-espresso">{judged.verdict}</p>}
                </motion.article>;
            })}
            <div className="rounded-3xl bg-cream/60 p-5 text-sm text-espresso">
                <p className="flex justify-between"><span>Jury</span><span className="font-semibold">{event.verdict.penalty}</span></p>
                <p className="mt-1 flex justify-between"><span>Tipps</span><span className="font-semibold">{event.tip_count}</span></p>
                <p className="mt-2 flex justify-between border-t border-espresso/10 pt-2 text-base font-semibold"><span>Strafpunkte</span><span>{event.verdict.penalty + event.tip_count}</span></p>
                <p className="mt-2 text-xs text-bark">Die Punkte wandern beim Abschluss auf euer Konto und werden beim nächsten Event in Handicaps eingelöst.</p>
            </div>
            {event.phase === "judged" && event.is_creator && <button type="button" disabled={busy} onClick={() => action("finish", "Event abschließen? Danach sind keine Änderungen mehr möglich.")} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-caramel px-6 py-3 text-sm font-semibold text-white transition hover:bg-espresso disabled:opacity-50">
                {busy ? <LoadingIndicator light label="Wird abgeschlossen…" /> : <><Flag size={16} aria-hidden="true" /> Event abschließen</>}
            </button>}
            {event.phase === "judged" && !event.is_creator && <p className="text-sm text-bark">Wer das Event gestartet hat, schließt es ab.</p>}
            {event.phase === "finished" && <p className="flex items-center gap-2 text-sm font-semibold text-espresso"><Check size={16} className="text-caramel" aria-hidden="true" /> Abgeschlossen · {event.penalty_earned} Strafpunkte gebucht</p>}
        </div>}
    </section>;
}
