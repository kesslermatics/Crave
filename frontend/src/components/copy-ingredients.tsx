"use client";

import { useState } from "react";
import { Check, ClipboardCopy, Minus, Plus, X } from "lucide-react";
import { ingredientLines, servingsLabel, type TextIngredient } from "@/lib/recipe-text";

const STEP = 0.5;
const MAX_SERVINGS = 50;

/**
 * "Zutaten kopieren": pick the portions (halves allowed), see the scaled list live and copy it as plain lines,
 * one ingredient per line – ready to paste into a tracker like Yazio.
 */
export function CopyIngredients({ ingredients, baseServings, initialServings = baseServings, className = "" }: { ingredients: TextIngredient[]; baseServings: number; initialServings?: number; className?: string }) {
    const base = Math.max(1, baseServings || 1);
    const [open, setOpen] = useState(false);
    const [servings, setServings] = useState(initialServings);
    const [state, setState] = useState<"idle" | "copied" | "error">("idle");
    const text = ingredientLines(ingredients, servings / base);
    const change = (value: number) => { setServings(Math.min(MAX_SERVINGS, Math.max(STEP, Math.round(value / STEP) * STEP))); setState("idle"); };

    async function copy() {
        try { await navigator.clipboard.writeText(text); setState("copied"); }
        catch { setState("error"); }
    }

    if (!open) return <button type="button" onClick={() => { setServings(initialServings); setState("idle"); setOpen(true); }} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-bark ring-1 ring-espresso/10 transition hover:bg-white hover:text-espresso focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-caramel/40 ${className}`}>
        <ClipboardCopy size={16} strokeWidth={2.25} aria-hidden="true" />Zutaten kopieren
    </button>;

    const stepButton = "grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-espresso ring-1 ring-espresso/10 transition hover:bg-cream disabled:opacity-40";
    return <div className={`w-full min-w-0 rounded-3xl bg-cream/60 p-4 ${className}`}>
        <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-espresso">Zutaten kopieren</p>
            <button type="button" onClick={() => setOpen(false)} aria-label="Schließen" className="grid h-9 w-9 place-items-center rounded-full text-bark hover:bg-white hover:text-espresso"><X size={16} aria-hidden="true" /></button>
        </div>
        <div className="mt-3 flex items-center gap-3">
            <button type="button" onClick={() => change(servings - STEP)} disabled={servings <= STEP} aria-label="Halbe Portion weniger" className={stepButton}><Minus size={16} aria-hidden="true" /></button>
            <p className="min-w-0 flex-1 text-center text-sm font-semibold text-espresso tabular-nums" aria-live="polite">{servingsLabel(servings)}<span className="block text-xs font-normal text-bark">Rezept ist für {servingsLabel(base)}</span></p>
            <button type="button" onClick={() => change(servings + STEP)} disabled={servings >= MAX_SERVINGS} aria-label="Halbe Portion mehr" className={stepButton}><Plus size={16} aria-hidden="true" /></button>
        </div>
        <div className="mt-2 flex flex-wrap justify-center gap-1.5">{[1, base / 2, base].filter((value, index, all) => value >= STEP && all.indexOf(value) === index).map((value) => <button key={value} type="button" onClick={() => change(value)} aria-pressed={servings === value} className={`rounded-full px-3 py-1 text-xs font-semibold transition ${servings === value ? "bg-espresso text-white" : "bg-white text-bark hover:text-espresso"}`}>{value === base ? "Ganzes Rezept" : value === base / 2 ? "Hälfte" : "1 Portion"}</button>)}</div>
        <pre className="mt-3 max-h-56 overflow-auto rounded-2xl bg-white px-4 py-3 font-sans text-sm leading-6 whitespace-pre-wrap break-words text-espresso">{text || "Keine Zutaten sichtbar."}</pre>
        <button type="button" onClick={copy} disabled={!text} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-espresso px-4 text-sm font-semibold text-white transition hover:bg-caramel disabled:bg-espresso/20">
            {state === "copied" ? <><Check size={16} aria-hidden="true" />Kopiert</> : <><ClipboardCopy size={16} aria-hidden="true" />Kopieren</>}
        </button>
        {state === "error" && <p role="alert" className="mt-2 text-xs text-red-700">Kopieren hat nicht geklappt – markiere den Text oben und kopiere ihn von Hand.</p>}
    </div>;
}
