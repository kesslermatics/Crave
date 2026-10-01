"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowUp, Beef, Check, Croissant, CupSoda, LucideIcon, Milk, Package, Carrot, Share2, ShoppingBasket, Snowflake, Sparkles, Trash2, Wheat, WifiOff } from "lucide-react";

import { LoadingIndicator } from "@/components/loading-indicator";
import { Toast, toastActionClass, useToast } from "@/components/toast";
import {
    addShoppingItems, displayQuantity, parseShoppingInput, parseShoppingTextLocally, removeShoppingItem, replaceShoppingList, restoreShoppingItem,
    sectionLabels, sectionOrder, shareText, shoppingListText, useShoppingList, type ShoppingDraft, type ShoppingItem, type ShoppingSection,
} from "@/lib/shopping-list";

const sectionIcons: Record<ShoppingSection, LucideIcon> = {
    produce: Carrot, chilled: Milk, meat_fish: Beef, bakery: Croissant, pantry: Wheat, frozen: Snowflake, drinks: CupSoda, other: Package,
};
const iconButton = "grid h-10 w-10 place-items-center rounded-full text-bark transition hover:bg-espresso/[0.05] hover:text-espresso focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-caramel/40";
const LEAVE_MS = 320;

function subscribeOnline(onChange: () => void) {
    window.addEventListener("online", onChange);
    window.addEventListener("offline", onChange);
    return () => { window.removeEventListener("online", onChange); window.removeEventListener("offline", onChange); };
}
const useIsOnline = () => useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);

export function ShoppingList() {
    const items = useShoppingList();
    const isOnline = useIsOnline();
    const [text, setText] = useState("");
    const [isParsing, setIsParsing] = useState(false);
    const [leaving, setLeaving] = useState<Set<string>>(new Set());
    const [fresh, setFresh] = useState<Set<string>>(new Set());
    const timers = useRef<number[]>([]);
    const pendingRemovals = useRef(new Map<string, symbol>());
    const { toast, show: showToast, hide: hideToast } = useToast(5000);

    useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), []);
    const later = (callback: () => void, ms: number) => { timers.current.push(window.setTimeout(callback, ms)); };

    const openCount = items.filter((item) => !leaving.has(item.id)).length;
    const sections = sectionOrder
        .map((section) => ({ section, entries: items.filter((item) => item.section === section).sort((a, b) => a.name.localeCompare(b.name, "de")) }))
        .filter(({ entries }) => entries.length > 0);

    function highlight(ids: string[]) {
        setFresh(new Set(ids));
        later(() => setFresh(new Set()), 1600);
    }

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const input = text.trim();
        if (!input || isParsing) return;
        setIsParsing(true);
        let drafts: ShoppingDraft[];
        let usedAi = true;
        try {
            drafts = await parseShoppingInput({ text: input });
        } catch {
            // Offline oder KI nicht erreichbar: einfach selbst zerlegen.
            usedAi = false;
            drafts = parseShoppingTextLocally(input);
        }
        const { added, merged, ids } = addShoppingItems(drafts);
        setIsParsing(false);
        setText("");
        highlight(ids);
        const count = added + merged;
        showToast(count ? `${count} ${count === 1 ? "Eintrag" : "Einträge"} hinzugefügt${usedAi ? "" : " (ohne KI)"}` : "Nichts erkannt – versuch es etwas genauer");
    }

    const stopLeaving = (id: string) => setLeaving((current) => { const next = new Set(current); next.delete(id); return next; });

    function check(item: ShoppingItem) {
        if (leaving.has(item.id)) return;
        const token = Symbol(item.id);
        pendingRemovals.current.set(item.id, token);
        setLeaving((current) => new Set(current).add(item.id));
        // Erst ausblenden, dann entfernen – außer der Nutzer hat inzwischen „Rückgängig“ gedrückt.
        later(() => {
            if (pendingRemovals.current.get(item.id) !== token) return;
            pendingRemovals.current.delete(item.id);
            removeShoppingItem(item.id);
            stopLeaving(item.id);
        }, LEAVE_MS);
        showToast(`„${item.name}“ abgehakt`, <button type="button" onClick={() => undo(item)} className={toastActionClass}>Rückgängig</button>);
    }

    function undo(item: ShoppingItem) {
        if (pendingRemovals.current.has(item.id)) {
            pendingRemovals.current.delete(item.id);
            stopLeaving(item.id);
        } else {
            restoreShoppingItem(item);
        }
        hideToast();
    }

    function clearAll() {
        if (!items.length || !window.confirm("Die ganze Einkaufsliste leeren?")) return;
        const snapshot = items;
        replaceShoppingList([]);
        showToast("Liste geleert", <button type="button" onClick={() => { replaceShoppingList(snapshot); hideToast(); }} className={toastActionClass}>Rückgängig</button>);
    }

    async function share() {
        try {
            const result = await shareText(shoppingListText(items), "Einkaufsliste");
            if (result === "copied") showToast("Liste in die Zwischenablage kopiert");
        } catch {
            showToast("Teilen hat nicht geklappt");
        }
    }

    return <main className="flex-1 bg-linen pb-36">
        <div className="mx-auto max-w-2xl px-5 pt-8 motion-safe:animate-page-in sm:px-8 sm:pt-12">
            <header className="flex items-end justify-between gap-4">
                <div>
                    <p className="text-[11px] font-semibold tracking-[0.2em] text-caramel">EINKAUFEN</p>
                    <h1 className="mt-2 text-[2.5rem] leading-none font-semibold tracking-[-0.05em] text-espresso sm:text-5xl">Einkaufsliste</h1>
                    <p className="mt-3 text-sm text-bark" aria-live="polite">{openCount ? `${openCount} ${openCount === 1 ? "Eintrag" : "Einträge"} offen` : "Alles erledigt"}</p>
                </div>
                {items.length > 0 && <div className="-mr-2 flex gap-1">
                    <button type="button" onClick={share} className={iconButton} aria-label="Liste teilen oder exportieren" title="Teilen"><Share2 size={18} strokeWidth={2} aria-hidden="true" /></button>
                    <button type="button" onClick={clearAll} className={`${iconButton} hover:bg-red-50 hover:text-red-700`} aria-label="Liste leeren" title="Liste leeren"><Trash2 size={18} strokeWidth={2} aria-hidden="true" /></button>
                </div>}
            </header>

            {!isOnline && <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-cream/80 px-3.5 py-1.5 text-xs font-medium text-bark"><WifiOff size={14} strokeWidth={2.25} aria-hidden="true" />Offline – Abhaken funktioniert trotzdem.</p>}

            <form onSubmit={submit} className="mt-7 flex items-center gap-2 rounded-full bg-white py-1.5 pr-1.5 pl-4 shadow-[0_1px_2px_rgba(66,52,33,0.05),0_16px_36px_-22px_rgba(66,52,33,0.35)] ring-1 ring-espresso/[0.08] transition focus-within:ring-2 focus-within:ring-caramel/40">
                <Sparkles size={17} strokeWidth={2} className="shrink-0 text-caramel" aria-hidden="true" />
                <input value={text} onChange={(event) => setText(event.target.value)} placeholder="z. B. 2 Eier, Mehl und 1 l Milch" aria-label="Einträge hinzufügen – Crave sortiert sie automatisch" maxLength={2000}
                    className="h-10 min-w-0 flex-1 bg-transparent text-[15px] text-espresso outline-none placeholder:text-bark/45" />
                <button type="submit" disabled={!text.trim() || isParsing} aria-label="Hinzufügen" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-caramel text-white transition hover:bg-espresso focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-caramel/40 disabled:bg-espresso/15 disabled:text-espresso/40">
                    {isParsing ? <LoadingIndicator label="" light /> : <ArrowUp size={18} strokeWidth={2.5} aria-hidden="true" />}
                </button>
            </form>
            <p className="mt-2.5 px-4 text-xs text-bark/75">Schreib einfach drauflos – Crave erkennt Mengen und sortiert alles in die passende Abteilung.</p>

            {sections.length === 0 ? <div className="mt-20 text-center motion-safe:animate-page-in">
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-cream text-caramel"><ShoppingBasket size={26} strokeWidth={1.75} aria-hidden="true" /></span>
                <h2 className="mt-5 text-xl font-semibold tracking-[-0.03em] text-espresso">Deine Liste ist leer</h2>
                <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-bark">Füge Zutaten direkt aus einem Rezept hinzu oder schreib oben, was du brauchst.</p>
                <Link href="/recipes" className="mt-5 inline-flex rounded-full px-4 py-2 text-sm font-semibold text-caramel transition hover:bg-caramel/10">Zu deinen Rezepten</Link>
            </div> : <div className="mt-10 space-y-8">
                {sections.map(({ section, entries }) => {
                    const Icon = sectionIcons[section];
                    return <section key={section} aria-labelledby={`section-${section}`}>
                        <h2 id={`section-${section}`} className="flex items-center gap-2 px-1 text-[11px] font-semibold tracking-[0.14em] text-bark/75">
                            <Icon size={14} strokeWidth={2.25} className="text-caramel" aria-hidden="true" />{sectionLabels[section].toUpperCase()}
                            <span className="font-medium tracking-normal text-bark/50">{entries.length}</span>
                        </h2>
                        <ul className="mt-2.5 overflow-hidden rounded-2xl bg-white ring-1 ring-espresso/[0.07]">
                            {entries.map((item) => {
                                const isLeaving = leaving.has(item.id);
                                return <li key={item.id} className={`grid border-b border-espresso/[0.06] transition-all duration-300 ease-out last:border-0 ${isLeaving ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"}`}>
                                    <div className="overflow-hidden">
                                        <button type="button" role="checkbox" aria-checked={isLeaving} onClick={() => check(item)}
                                            className={`group flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors duration-700 hover:bg-linen/60 focus-visible:bg-linen focus-visible:outline-none ${fresh.has(item.id) ? "bg-saffron/20" : ""}`}>
                                            <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ring-2 transition ${isLeaving ? "bg-caramel text-white ring-caramel" : "text-transparent ring-espresso/20 group-hover:ring-caramel/60"}`} aria-hidden="true"><Check size={14} strokeWidth={3} /></span>
                                            <span className="min-w-0 flex-1">
                                                <span className={`block text-[15px] font-medium text-espresso transition ${isLeaving ? "text-bark/60 line-through" : ""}`}>{item.name}</span>
                                                {item.sources.length > 0 && <span className="block truncate text-xs text-bark/70">für {item.sources.join(", ")}</span>}
                                            </span>
                                            <span className="shrink-0 text-sm font-medium text-bark tabular-nums">{displayQuantity(item)}</span>
                                            <span className="sr-only">abhaken</span>
                                        </button>
                                    </div>
                                </li>;
                            })}
                        </ul>
                    </section>;
                })}
            </div>}
        </div>
        <Toast toast={toast} />
    </main>;
}
