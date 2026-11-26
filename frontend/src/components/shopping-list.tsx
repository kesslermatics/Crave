"use client";

import Link from "next/link";
import { AnimatePresence, MotionConfig, motion, type Transition } from "framer-motion";
import { FormEvent, ReactNode, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowUp, Beef, Carrot, Cloud, CloudOff, Croissant, CupSoda, LucideIcon, Milk, Package, RefreshCw, Share2, ShoppingBasket, Snowflake, Sparkles, Trash2, Wheat, WifiOff } from "lucide-react";

import { Toast, toastActionClass, useToast } from "@/components/toast";
import { tick } from "@/lib/haptics";
import {
    addShoppingItems, displayQuantity, parseShoppingInput, parseShoppingTextLocally, removeShoppingItems, replaceShoppingList, restoreShoppingItem,
    sectionLabels, sectionOrder, shareText, shoppingListText, startShoppingSync, useShoppingList, useShoppingListLoaded, useShoppingSyncStatus,
    type ShoppingDraft, type ShoppingItem, type ShoppingSection,
} from "@/lib/shopping-list";

const sectionIcons: Record<ShoppingSection, LucideIcon> = {
    produce: Carrot, chilled: Milk, meat_fish: Beef, bakery: Croissant, pantry: Wheat, frozen: Snowflake, drinks: CupSoda, other: Package,
};

/** So lange bleiben abgehakte Einträge sichtbar. Jedes weitere Abhaken verlängert die Frist, damit beim
 *  schnellen Abhaken im Laden nichts unter dem Finger wegrutscht – danach verschwinden alle gemeinsam. */
const CHECK_MS = 550;
const TOAST_MS = 5000;
const SAVING_HINT_DELAY_MS = 450;
const CONFIRM_MS = 3000;

const ease = [0.22, 1, 0.36, 1] as const;
const collapse: Transition = { duration: 0.3, ease };
const spring: Transition = { type: "spring", stiffness: 520, damping: 36 };
const grow = { initial: { height: 0, opacity: 0 }, animate: { height: "auto", opacity: 1 }, exit: { height: 0, opacity: 0 }, transition: collapse };

const iconButton = "grid h-10 w-10 place-items-center rounded-full text-bark transition hover:bg-espresso/[0.05] hover:text-espresso active:scale-90 active:bg-espresso/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-caramel/40";

function subscribeOnline(onChange: () => void) {
    window.addEventListener("online", onChange);
    window.addEventListener("offline", onChange);
    return () => { window.removeEventListener("online", onChange); window.removeEventListener("offline", onChange); };
}
const useIsOnline = () => useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);

const without = (set: Set<string>, ids: Iterable<string>) => { const next = new Set(set); for (const id of ids) next.delete(id); return next; };

type PendingInput = { id: number; text: string };

export function ShoppingList() {
    const items = useShoppingList();
    const isOnline = useIsOnline();
    const syncStatus = useShoppingSyncStatus();
    const loaded = useShoppingListLoaded();
    const { toast, show: showToast, hide: hideToast } = useToast(TOAST_MS);

    const [text, setText] = useState("");
    const [pending, setPending] = useState<PendingInput[]>([]);
    const [checked, setChecked] = useState<Set<string>>(new Set());
    const [fresh, setFresh] = useState<Set<string>>(new Set());
    const [confirmClear, setConfirmClear] = useState(false);
    const [checkedAny, setCheckedAny] = useState(false);
    const [slowSync, setSlowSync] = useState(false);

    const timers = useRef<number[]>([]);
    const toRemove = useRef(new Set<string>());
    const flushTimer = useRef<number | null>(null);
    const recent = useRef<ShoppingItem[]>([]);
    const recentTimer = useRef<number | null>(null);
    const confirmTimer = useRef<number | null>(null);
    const nextJob = useRef(0);

    // Abgleich mit der Datenbank: beim Öffnen, bei Fokus und wenn das Netz zurückkommt.
    useEffect(() => startShoppingSync(), []);

    useEffect(() => {
        const pendingTimers = timers.current;
        const removals = toRemove.current;
        return () => {
            pendingTimers.forEach((timer) => window.clearTimeout(timer));
            if (flushTimer.current) window.clearTimeout(flushTimer.current);
            if (recentTimer.current) window.clearTimeout(recentTimer.current);
            // Wer abhakt und sofort die Seite wechselt, soll die Einträge trotzdem los sein.
            removeShoppingItems(removals);
        };
    }, []);

    // „Speichert…“ nur zeigen, wenn es wirklich dauert – sonst flackert die Anzeige bei jedem Abhaken.
    useEffect(() => {
        if (syncStatus !== "syncing") return;
        const timer = window.setTimeout(() => setSlowSync(true), SAVING_HINT_DELAY_MS);
        return () => { window.clearTimeout(timer); setSlowSync(false); };
    }, [syncStatus]);

    const later = (callback: () => void, ms: number) => { const timer = window.setTimeout(callback, ms); timers.current.push(timer); return timer; };

    const openCount = items.filter((item) => !checked.has(item.id)).length;
    const sections = sectionOrder
        .map((section) => ({ section, entries: items.filter((item) => item.section === section).sort((a, b) => a.name.localeCompare(b.name, "de")) }))
        .filter(({ entries }) => entries.length > 0);
    const view = items.length ? "list" : loaded ? "empty" : "loading";
    const syncLabel = syncStatus === "syncing" && slowSync ? "saving" : syncStatus === "idle" || syncStatus === "syncing" ? "saved" : null;
    const banner = !isOnline || syncStatus === "offline" ? "offline" : syncStatus === "error" ? "error" : null;

    /** Toasts, die nichts mit Abhaken zu tun haben, beenden die „Rückgängig“-Sammlung. */
    function notify(message: string, action?: ReactNode) {
        recent.current = [];
        showToast(message, action);
    }

    function highlight(ids: string[]) {
        setFresh((current) => new Set([...current, ...ids]));
        later(() => setFresh((current) => without(current, ids)), 1400);
    }

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const input = text.trim();
        if (!input) return;
        // Feld sofort wieder frei: Man kann weitertippen, während Crave im Hintergrund sortiert.
        const job = { id: ++nextJob.current, text: input };
        setPending((current) => [...current, job]);
        setText("");

        let drafts: ShoppingDraft[];
        let usedAi = navigator.onLine;
        try {
            if (!usedAi) throw new Error("offline");
            drafts = await parseShoppingInput({ text: input });
        } catch {
            // Offline oder KI nicht erreichbar: einfach selbst zerlegen.
            usedAi = false;
            drafts = parseShoppingTextLocally(input);
        }
        const { added, merged, ids } = addShoppingItems(drafts);
        setPending((current) => current.filter((entry) => entry.id !== job.id));
        highlight(ids);
        const count = added + merged;
        if (count) {
            notify(`${count} ${count === 1 ? "Eintrag" : "Einträge"} hinzugefügt${usedAi ? "" : " (ohne KI)"}`);
        } else {
            notify("Nichts erkannt – versuch es etwas genauer");
            setText((current) => current || input);
        }
    }

    function flushChecked() {
        flushTimer.current = null;
        removeShoppingItems(toRemove.current);
        toRemove.current.clear();
        setChecked(new Set());
    }

    function showCheckedToast() {
        const list = recent.current;
        if (recentTimer.current) window.clearTimeout(recentTimer.current);
        recentTimer.current = window.setTimeout(() => { recent.current = []; }, TOAST_MS);
        showToast(list.length === 1 ? `„${list[0].name}“ abgehakt` : `${list.length} Einträge abgehakt`,
            <button type="button" onClick={undoChecked} className={toastActionClass}>Rückgängig</button>);
    }

    function toggle(item: ShoppingItem) {
        if (toRemove.current.has(item.id)) {
            // Nochmal antippen = doch nicht abgehakt.
            toRemove.current.delete(item.id);
            setChecked((current) => without(current, [item.id]));
            const wasRecent = recent.current.some((entry) => entry.id === item.id);
            recent.current = recent.current.filter((entry) => entry.id !== item.id);
            if (wasRecent) { if (recent.current.length) showCheckedToast(); else hideToast(); }
            return;
        }
        tick();
        toRemove.current.add(item.id);
        setChecked((current) => new Set(current).add(item.id));
        setCheckedAny(true);
        if (flushTimer.current) window.clearTimeout(flushTimer.current);
        flushTimer.current = window.setTimeout(flushChecked, CHECK_MS);
        recent.current = [...recent.current.filter((entry) => entry.id !== item.id), item];
        showCheckedToast();
    }

    /** Macht alles rückgängig, was in den letzten Sekunden abgehakt wurde – nicht nur den letzten Eintrag. */
    function undoChecked() {
        const list = recent.current;
        recent.current = [];
        for (const item of list) {
            if (toRemove.current.has(item.id)) toRemove.current.delete(item.id);
            else restoreShoppingItem(item);
        }
        setChecked((current) => without(current, list.map((item) => item.id)));
        hideToast();
    }

    function requestClear() {
        if (!items.length) return;
        if (confirmTimer.current) window.clearTimeout(confirmTimer.current);
        if (!confirmClear) {
            // Erst ein zweites Antippen leert die Liste – ohne nervigen Browser-Dialog.
            tick();
            setConfirmClear(true);
            confirmTimer.current = later(() => setConfirmClear(false), CONFIRM_MS);
            return;
        }
        setConfirmClear(false);
        if (flushTimer.current) window.clearTimeout(flushTimer.current);
        toRemove.current.clear();
        setChecked(new Set());
        setCheckedAny(false);
        const snapshot = items;
        replaceShoppingList([]);
        notify("Liste geleert", <button type="button" onClick={() => { replaceShoppingList(snapshot); hideToast(); }} className={toastActionClass}>Rückgängig</button>);
    }

    async function share() {
        try {
            const result = await shareText(shoppingListText(items), "Einkaufsliste");
            if (result === "copied") notify("Liste in die Zwischenablage kopiert");
        } catch {
            notify("Teilen hat nicht geklappt");
        }
    }

    const hasText = text.trim().length > 0;

    return <MotionConfig reducedMotion="user">
        <main className="flex-1 bg-linen pb-36">
            <div className="mx-auto max-w-2xl px-5 pt-6 motion-safe:animate-page-in sm:px-8 sm:pt-12">
                <header>
                    <div className="flex h-10 items-center justify-between">
                        <p className="text-[11px] font-semibold tracking-[0.2em] text-caramel">EINKAUFEN</p>
                        <AnimatePresence initial={false}>
                            {items.length > 0 && <motion.div key="actions" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.18 }} className="-mr-2 flex items-center gap-1">
                                <button type="button" onClick={share} className={iconButton} aria-label="Liste teilen oder exportieren" title="Teilen"><Share2 size={18} strokeWidth={2} aria-hidden="true" /></button>
                                <button type="button" onClick={requestClear} title="Liste leeren"
                                    aria-label={confirmClear ? "Zum Bestätigen erneut tippen: ganze Liste leeren" : "Liste leeren"}
                                    className={`flex h-10 min-w-10 items-center justify-center rounded-full px-[11px] transition-colors duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 ${confirmClear ? "bg-red-600 text-white" : "text-bark hover:bg-red-50 hover:text-red-700"}`}>
                                    <Trash2 size={18} strokeWidth={2} aria-hidden="true" />
                                    <AnimatePresence initial={false}>
                                        {confirmClear && <motion.span key="label" initial={{ width: 0, opacity: 0 }} animate={{ width: "auto", opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={collapse} className="overflow-hidden text-sm font-semibold whitespace-nowrap">
                                            <span className="block pr-1 pl-2">Liste leeren?</span>
                                        </motion.span>}
                                    </AnimatePresence>
                                </button>
                            </motion.div>}
                        </AnimatePresence>
                    </div>
                    <h1 className="mt-1 text-[2.5rem] leading-none font-semibold tracking-[-0.05em] text-espresso sm:text-5xl">Einkaufsliste</h1>
                    <div className="mt-3 flex h-5 items-center gap-2 text-sm text-bark">
                        <span aria-hidden="true">{openCount ? <><Roll value={openCount} from="above" /> {openCount === 1 ? "Eintrag" : "Einträge"} offen</> : "Alles erledigt"}</span>
                        <span className="sr-only" aria-live="polite">{openCount ? `${openCount} ${openCount === 1 ? "Eintrag" : "Einträge"} offen` : "Alles erledigt"}</span>
                        {/* Dezenter Speicherstatus; die Liste selbst reagiert immer sofort. */}
                        <AnimatePresence mode="wait" initial={false}>
                            {syncLabel && <motion.span key={syncLabel} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="inline-flex items-center gap-1 text-xs text-bark/60">
                                {syncLabel === "saving" ? <><RefreshCw size={12} strokeWidth={2.25} className="motion-safe:animate-spin" aria-hidden="true" />Speichert…</> : <><Cloud size={12} strokeWidth={2.25} aria-hidden="true" />Gespeichert</>}
                            </motion.span>}
                        </AnimatePresence>
                    </div>
                </header>

                <AnimatePresence initial={false}>
                    {banner && <motion.div key={banner} {...grow} className="overflow-hidden">
                        {banner === "offline"
                            ? <p className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-cream/80 px-3.5 py-2 text-xs font-medium text-bark"><WifiOff size={14} strokeWidth={2.25} className="shrink-0" aria-hidden="true" />Offline – Änderungen werden gespeichert, sobald du wieder online bist.</p>
                            : <p className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-red-50 px-3.5 py-2 text-xs font-medium text-red-800"><CloudOff size={14} strokeWidth={2.25} className="shrink-0" aria-hidden="true" />Synchronisieren gerade nicht möglich – deine Liste bleibt auf diesem Gerät erhalten.</p>}
                    </motion.div>}
                </AnimatePresence>

                <form onSubmit={submit} className="mt-6 flex items-center gap-2 rounded-full bg-white py-1.5 pr-1.5 pl-4 shadow-[0_1px_2px_rgba(66,52,33,0.05),0_16px_36px_-22px_rgba(66,52,33,0.35)] ring-1 ring-espresso/[0.08] transition-shadow duration-200 focus-within:shadow-[0_1px_2px_rgba(66,52,33,0.05),0_18px_40px_-20px_rgba(153,97,48,0.45)] focus-within:ring-2 focus-within:ring-caramel/40">
                    <Sparkles size={17} strokeWidth={2} className={`shrink-0 text-caramel ${pending.length ? "motion-safe:animate-shimmer" : ""}`} aria-hidden="true" />
                    <input value={text} onChange={(event) => setText(event.target.value)} placeholder="z. B. 2 Eier, Mehl und Milch" aria-label="Einträge hinzufügen – Crave sortiert sie automatisch" maxLength={2000}
                        enterKeyHint="send" autoComplete="off"
                        className="h-10 min-w-0 flex-1 bg-transparent text-base text-espresso outline-none placeholder:text-bark/45" />
                    {/* pointerdown abfangen: Das Feld behält den Fokus, die Tastatur bleibt für den nächsten Eintrag offen. */}
                    <motion.button type="submit" disabled={!hasText} aria-label="Hinzufügen" onPointerDown={(event) => event.preventDefault()} whileTap={{ scale: 0.86 }}
                        className={`grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-caramel/40 ${hasText ? "bg-caramel text-white hover:bg-espresso" : "bg-espresso/[0.07] text-espresso/35"}`}>
                        <ArrowUp size={18} strokeWidth={2.5} aria-hidden="true" />
                    </motion.button>
                </form>

                <AnimatePresence initial={false}>
                    {pending.map((job) => <motion.div key={job.id} {...grow} className="overflow-hidden">
                        <p className="flex items-center gap-2 px-4 pt-3 text-xs text-bark/75" role="status">
                            <Sparkles size={13} strokeWidth={2.25} className="shrink-0 text-caramel motion-safe:animate-shimmer" aria-hidden="true" />
                            <span className="min-w-0 truncate">Sortiere „{job.text}“…</span>
                        </p>
                    </motion.div>)}
                </AnimatePresence>

                <AnimatePresence mode="wait" initial={false}>
                    {view === "loading" ? <ListSkeleton key="loading" />
                        : view === "empty" ? <EmptyState key="empty" done={checkedAny} />
                            : <motion.div key="list" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.15 } }} transition={collapse} className="mt-8">
                                <AnimatePresence initial={false}>
                                    {sections.map(({ section, entries }) => {
                                        const Icon = sectionIcons[section];
                                        return <motion.section key={section} {...grow} aria-labelledby={`section-${section}`} className="-mx-1.5 overflow-hidden px-1.5">
                                            <div className="pb-7">
                                                <h2 id={`section-${section}`} className="flex items-center gap-2 px-1 text-[11px] font-semibold tracking-[0.14em] text-bark/75">
                                                    <Icon size={14} strokeWidth={2.25} className="text-caramel" aria-hidden="true" />{sectionLabels[section].toUpperCase()}
                                                    <span className="font-medium tracking-normal text-bark/50">{entries.length}</span>
                                                </h2>
                                                <ul className="mt-2.5 overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(66,52,33,0.04)] ring-1 ring-espresso/[0.07]">
                                                    <AnimatePresence initial={false}>
                                                        {entries.map((item) => <ItemRow key={item.id} item={item} checked={checked.has(item.id)} fresh={fresh.has(item.id)} onToggle={() => toggle(item)} />)}
                                                    </AnimatePresence>
                                                </ul>
                                            </div>
                                        </motion.section>;
                                    })}
                                </AnimatePresence>
                            </motion.div>}
                </AnimatePresence>
            </div>
            <Toast toast={toast} onDismiss={hideToast} />
        </main>
    </MotionConfig>;
}

function ItemRow({ item, checked, fresh, onToggle }: { item: ShoppingItem; checked: boolean; fresh: boolean; onToggle: () => void }) {
    const quantity = displayQuantity(item);
    return <motion.li {...grow} className="group/row relative overflow-hidden">
        {/* Eingerückte Trennlinie wie bei iOS-Listen: beginnt erst nach dem Kreis. */}
        <span aria-hidden="true" className="pointer-events-none absolute top-0 right-0 left-[3.375rem] h-px bg-espresso/[0.07] group-first/row:hidden" />
        <button type="button" role="checkbox" aria-checked={checked} onClick={onToggle}
            className={`group flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors duration-700 select-none [-webkit-touch-callout:none] hover:bg-linen/60 focus-visible:bg-linen focus-visible:outline-none active:bg-espresso/[0.04] active:duration-0 ${fresh ? "bg-saffron/20" : ""}`}>
            <CheckCircle checked={checked} />
            <span className="min-w-0 flex-1">
                <span className="block text-[15px] leading-snug font-medium">
                    <span className={`strike ${checked ? "text-bark/50" : "text-espresso"}`} data-checked={checked}>{item.name}</span>
                </span>
                {item.sources.length > 0 && <span className={`mt-0.5 block truncate text-xs transition-colors duration-200 ${checked ? "text-bark/40" : "text-bark/70"}`}>für {item.sources.join(", ")}</span>}
            </span>
            {quantity && <span className={`shrink-0 text-sm font-medium transition-colors duration-200 ${checked ? "text-bark/40" : "text-bark"}`}><Roll value={quantity} from="below" /></span>}
            <span className="sr-only">abhaken</span>
        </button>
    </motion.li>;
}

function CheckCircle({ checked }: { checked: boolean }) {
    return <motion.span aria-hidden="true" initial={false} animate={{ scale: checked ? [1, 0.82, 1.08, 1] : 1 }} transition={{ duration: 0.38, ease: "easeOut" }}
        className={`relative grid h-6 w-6 shrink-0 place-items-center rounded-full ring-2 transition-colors duration-200 ring-inset ${checked ? "ring-caramel" : "ring-espresso/20 group-hover:ring-caramel/60"}`}>
        <motion.span className="absolute inset-0 rounded-full bg-caramel" initial={false} animate={{ scale: checked ? 1 : 0.3, opacity: checked ? 1 : 0 }} transition={{ type: "spring", stiffness: 600, damping: 30 }} />
        <CheckMark checked={checked} className="relative h-3.5 w-3.5" />
    </motion.span>;
}

/** Haken, der sich zeichnet. `drawOnMount`: auch beim ersten Erscheinen zeichnen. */
function CheckMark({ checked, className, delay = 0.06, drawOnMount = false }: { checked: boolean; className: string; delay?: number; drawOnMount?: boolean }) {
    return <svg viewBox="0 0 24 24" className={className} fill="none" stroke="white" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <motion.path d="M4.5 12.5l5 5L19.5 7" initial={drawOnMount ? { pathLength: 0, opacity: 0 } : false} animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }} transition={{ duration: 0.24, delay: checked ? delay : 0, ease: "easeOut" }} />
    </svg>;
}

/** Wert rollt beim Ändern heraus/herein (Zähler, Mengen). */
function Roll({ value, from }: { value: string | number; from: "above" | "below" }) {
    const offset = from === "above" ? "-70%" : "70%";
    return <span className="relative inline-flex overflow-hidden align-bottom tabular-nums">
        <AnimatePresence mode="popLayout" initial={false}>
            <motion.span key={value} initial={{ y: offset, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: from === "above" ? "70%" : "-70%", opacity: 0 }} transition={spring}>{value}</motion.span>
        </AnimatePresence>
    </span>;
}

function EmptyState({ done }: { done: boolean }) {
    return <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.15 } }} transition={collapse} className="mt-20 text-center">
        {done
            ? <motion.span initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 380, damping: 16, delay: 0.05 }} className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-caramel shadow-[0_14px_30px_-14px_rgba(153,97,48,0.7)]">
                <CheckMark checked drawOnMount className="h-8 w-8" delay={0.2} />
            </motion.span>
            : <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-cream text-caramel"><ShoppingBasket size={26} strokeWidth={1.75} aria-hidden="true" /></span>}
        <h2 className="mt-5 text-xl font-semibold tracking-[-0.03em] text-espresso">{done ? "Alles eingekauft" : "Deine Liste ist leer"}</h2>
        <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-bark">{done
            ? "Gut gemacht – auf deiner Liste steht nichts mehr."
            : "Schreib oben einfach drauflos – Crave erkennt Mengen und sortiert alles nach Abteilung. Oder übernimm Zutaten direkt aus einem Rezept."}</p>
        <Link href="/recipes" className="mt-5 inline-flex rounded-full px-4 py-2 text-sm font-semibold text-caramel transition hover:bg-caramel/10 active:scale-95 active:bg-caramel/15">Zu deinen Rezepten</Link>
    </motion.div>;
}

function ListSkeleton() {
    return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.15 } }} transition={{ duration: 0.3, delay: 0.15 }} className="mt-8" role="status" aria-label="Liste wird geladen…">
        <div className="motion-safe:animate-shimmer" aria-hidden="true">
            <div className="ml-1 h-2.5 w-28 rounded-full bg-espresso/[0.07]" />
            <div className="mt-3 overflow-hidden rounded-2xl bg-white ring-1 ring-espresso/[0.07]">
                {[62, 44, 54].map((width) => <div key={width} className="flex items-center gap-3.5 px-4 py-4">
                    <span className="h-6 w-6 shrink-0 rounded-full bg-espresso/[0.06]" />
                    <span className="h-3 rounded-full bg-espresso/[0.07]" style={{ width: `${width}%` }} />
                </div>)}
            </div>
        </div>
    </motion.div>;
}
