"use client";

import { motion } from "framer-motion";
import { ChefHat } from "lucide-react";

import { EventSummary, formatDay } from "@/lib/events";

/** Wo ein Event gerade steht – daraus ergeben sich Aussehen, Texte und Reihenfolge (Übersicht und Detailseite). */
export type Stage =
    | { kind: "preparing" }
    | { kind: "failed" }
    | { kind: "upcoming"; daysToStart: number }
    | { kind: "running"; day: number; total: number; daysLeft: number }
    | { kind: "cookday" }
    | { kind: "jury"; judged: boolean }
    | { kind: "finished" };

export const ease = [0.22, 1, 0.36, 1] as const;
const DAY_MS = 86_400_000;
const dayNumber = (iso: string) => Math.round(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);

export const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
/** Datum, das nie mitten im Wort umbricht („So.,⏎6. Dez.“). */
export const day = (iso: string, options?: Intl.DateTimeFormatOptions) => formatDay(iso, options).replace(/ /g, " ");

/** Gleicher Kalendertag wie im Backend (Europe/Berlin) – unabhängig von der Zeitzone des Geräts. */
export function todayInBerlin() {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" })
        .formatToParts(new Date()).map((part) => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
}

export function stageOf(event: Pick<EventSummary, "status" | "phase" | "is_cook_day" | "start_date" | "cook_date">, today: string): Stage {
    if (event.status === "generating") return { kind: "preparing" };
    if (event.status === "failed") return { kind: "failed" };
    if (event.phase === "finished") return { kind: "finished" };
    if (event.phase === "judging" || event.phase === "judged") return { kind: "jury", judged: event.phase === "judged" };
    if (event.is_cook_day) return { kind: "cookday" };
    const now = dayNumber(today);
    const start = dayNumber(event.start_date);
    const cook = dayNumber(event.cook_date);
    if (now < start) return { kind: "upcoming", daysToStart: start - now };
    const total = Math.max(cook - start, 1);
    return { kind: "running", day: Math.min(now - start + 1, total), total, daysLeft: cook - now };
}

export function StageLabel({ stage, dark = false }: { stage: Stage; dark?: boolean }) {
    const live = stage.kind === "running" || stage.kind === "cookday" || stage.kind === "preparing" || (stage.kind === "jury" && !stage.judged);
    const text = stage.kind === "preparing" ? "Wird vorbereitet"
        : stage.kind === "failed" ? "Vorbereitung fehlgeschlagen"
            : stage.kind === "upcoming" ? (stage.daysToStart === 1 ? "Startet morgen" : `Startet in ${stage.daysToStart} Tagen`)
                : stage.kind === "running" ? `Tag ${stage.day} von ${stage.total}`
                    : stage.kind === "cookday" ? "Heute ist Kochtag"
                        : stage.kind === "jury" ? (stage.judged ? "Das Urteil ist da" : "Die Jury bewertet")
                            : "Vorbei";
    const tone = stage.kind === "failed" ? "text-red-700" : dark ? "text-saffron" : "text-caramel";
    return <p className={`flex items-center gap-2 text-[11px] font-semibold tracking-[0.16em] uppercase ${tone}`}>
        <span className="relative flex h-2 w-2" aria-hidden="true">
            {live && <span className="absolute inset-0 rounded-full bg-current opacity-50 motion-safe:animate-ping" />}
            <span className="relative h-2 w-2 rounded-full bg-current" />
        </span>
        {text}
    </p>;
}

/** Ein Segment pro Päckchen-Tag, am Ende die Kochmütze für den Kochtag. */
export function DayTrack({ day: current, total, delay = 0 }: { day: number; total: number; delay?: number }) {
    if (total > 31) {
        return <div className="mt-5 flex items-center gap-2" aria-hidden="true">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-espresso/[0.08]">
                <motion.div className="h-full origin-left rounded-full bg-caramel" style={{ width: `${(current / total) * 100}%` }} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay, duration: 0.6, ease }} />
            </div>
            <ChefHat size={17} strokeWidth={2} className="shrink-0 text-caramel" />
        </div>;
    }
    return <div className="mt-5 flex items-center gap-2" aria-hidden="true">
        <div className="flex flex-1 gap-[3px]">
            {Array.from({ length: total }, (_, index) => <motion.span key={index} initial={{ scaleY: 0, opacity: 0 }} animate={{ scaleY: 1, opacity: 1 }} transition={{ delay: delay + index * 0.025, duration: 0.3, ease }}
                className={`h-2 flex-1 rounded-full ${index < current - 1 ? "bg-caramel" : index === current - 1 ? "bg-caramel motion-safe:animate-shimmer" : "bg-espresso/[0.08]"}`} />)}
        </div>
        <ChefHat size={17} strokeWidth={2} className="shrink-0 text-caramel" />
    </div>;
}

/** Eingepacktes Päckchen mit Schleifenband – für Kalender und „Heute“-Karte.
 *  `className` muss die Positionierung mitbringen (`relative` + Größe oder `absolute inset-0`). */
export function GiftBox({ className }: { className: string }) {
    return <span className={`block overflow-hidden bg-caramel ${className}`} aria-hidden="true">
        <span className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.18),transparent_55%)]" />
        <span className="absolute inset-y-0 left-1/2 w-[16%] -translate-x-1/2 bg-saffron" />
        <span className="absolute inset-x-0 top-1/2 h-[16%] -translate-y-1/2 bg-saffron" />
        <span className="absolute top-1/2 left-1/2 h-[30%] w-[30%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-saffron shadow-[0_2px_6px_rgba(66,52,33,0.35)]" />
    </span>;
}
