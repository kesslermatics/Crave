import { useSyncExternalStore } from "react";

import { apiUrl } from "@/lib/api";
import { formatQuantity } from "@/lib/amount";

export const sectionOrder = ["produce", "chilled", "meat_fish", "bakery", "pantry", "frozen", "drinks", "other"] as const;
export type ShoppingSection = (typeof sectionOrder)[number];
export const sectionLabels: Record<ShoppingSection, string> = {
    produce: "Obst & Gemüse",
    chilled: "Kühlregal",
    meat_fish: "Fleisch & Fisch",
    bakery: "Brot & Backwaren",
    pantry: "Vorrat",
    frozen: "Tiefkühl",
    drinks: "Getränke",
    other: "Sonstiges",
};

export type ShoppingItem = {
    id: string;
    name: string;
    amount: number | null;
    unit: string;
    section: ShoppingSection;
    /** Rezepte, aus denen der Eintrag stammt (für die Anzeige „für Tiramisu“). */
    sources: string[];
    addedAt: number;
};
export type ShoppingDraft = { name: string; amount: number | null; unit: string; section?: string };

const storageKey = "crave_shopping_list";
const changeEvent = "crave-shopping-list-change";
const emptyList: ShoppingItem[] = [];

// ---- Einheiten & Zusammenführen -------------------------------------------

const unitAliases: Record<string, string> = {
    g: "g", gr: "g", gramm: "g", kg: "kg", kilo: "kg", kilogramm: "kg",
    ml: "ml", milliliter: "ml", l: "l", liter: "l", cl: "cl", dl: "dl",
    el: "EL", esslöffel: "EL", tl: "TL", teelöffel: "TL",
    stück: "Stück", stk: "Stück", "stk.": "Stück", st: "Stück", stueck: "Stück",
    bund: "Bund", dose: "Dose", dosen: "Dose", packung: "Packung", pck: "Packung", "pck.": "Packung", päckchen: "Packung",
    becher: "Becher", prise: "Prise", prisen: "Prise", zehe: "Zehe", zehen: "Zehe",
};

/** Bringt Mengen auf eine Basiseinheit, damit 1 kg + 200 g zusammengezählt werden können. */
function toBase(amount: number | null, rawUnit: string): { amount: number | null; unit: string } {
    const unit = unitAliases[rawUnit.trim().toLowerCase()] ?? rawUnit.trim();
    if (amount === null) return { amount, unit };
    if (unit === "kg") return { amount: amount * 1000, unit: "g" };
    if (unit === "l") return { amount: amount * 1000, unit: "ml" };
    if (unit === "cl") return { amount: amount * 10, unit: "ml" };
    if (unit === "dl") return { amount: amount * 100, unit: "ml" };
    return { amount, unit };
}

/** Für die Anzeige: 1500 g → 1,5 kg. */
export function displayQuantity(item: Pick<ShoppingItem, "amount" | "unit">) {
    if (item.amount !== null && item.unit === "g" && item.amount >= 1000) return formatQuantity(item.amount / 1000, "kg");
    if (item.amount !== null && item.unit === "ml" && item.amount >= 1000) return formatQuantity(item.amount / 1000, "l");
    return formatQuantity(item.amount, item.unit);
}

const normaliseName = (name: string) => name.trim().replace(/\s+/g, " ").toLocaleLowerCase("de");
const keyOf = (item: Pick<ShoppingItem, "name" | "unit">) => `${normaliseName(item.name)}|${item.unit}`;
const isSection = (value: unknown): value is ShoppingSection => typeof value === "string" && (sectionOrder as readonly string[]).includes(value);

// Offline-Fallback, falls die KI nicht erreichbar ist.
// Reihenfolge zählt: spezifischere Abteilungen zuerst (z. B. „Paprikapulver“ vor „Paprika“).
const sectionKeywords: [ShoppingSection, RegExp][] = [
    ["frozen", /tiefkühl|tk-|gefror|eiswürfel/],
    ["meat_fish", /hähnchen|huhn|pute|rind|schwein|hack|speck|schinken|wurst|salami|lachs|thunfisch|fisch|garnele|shrimp|steak|filet/],
    ["pantry", /mehl|zucker|salz|pfeffer|pulver|öl\b|essig|nudel|pasta|spaghetti|reis\b|linsen|kichererbsen|brühe|gewürz|zimt|vanille|backpulver|hefe|honig|senf|ketchup|sauce|soße|nüsse|mandel|haferflocken|kakao|schokolade|tomatenmark|konserve/],
    ["chilled", /milch|sahne|joghurt|quark|käse|mozzarella|parmesan|feta|butter|(^|\s)eier?($|\s)|schmand|crème|creme fraiche|mascarpone|ricotta|tofu|skyr/],
    ["produce", /apfel|äpfel|banane|zitrone|limette|orange|beere|tomate|gurke|paprika|zwiebel|knoblauch|karotte|möhre|kartoffel|salat|spinat|brokkoli|zucchini|aubergine|pilz|champignon|lauch|sellerie|ingwer|avocado|petersilie|basilikum|koriander|schnittlauch|minze|kräuter|kohl|kürbis|mango|birne|traube/],
    ["bakery", /brot|brötchen|toast|baguette|croissant|wrap|tortilla/],
    ["drinks", /wasser|saft|bier|wein|cola|limo|kaffee|tee$|sprudel/],
];
export function guessSection(name: string): ShoppingSection {
    const lower = name.toLocaleLowerCase("de");
    return sectionKeywords.find(([, pattern]) => pattern.test(lower))?.[0] ?? "other";
}

// ---- Speicher (localStorage, offline verfügbar) ----------------------------

let cachedRaw: string | null = null;
let cachedItems: ShoppingItem[] = emptyList;

function read(): ShoppingItem[] {
    const raw = window.localStorage.getItem(storageKey);
    if (raw === cachedRaw) return cachedItems;
    cachedRaw = raw;
    try {
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        cachedItems = Array.isArray(parsed) ? parsed.filter((item): item is ShoppingItem => typeof item?.id === "string" && typeof item?.name === "string") : emptyList;
    } catch {
        cachedItems = emptyList;
    }
    return cachedItems;
}

function write(items: ShoppingItem[]) {
    window.localStorage.setItem(storageKey, JSON.stringify(items));
    window.dispatchEvent(new Event(changeEvent));
}

function subscribe(onChange: () => void) {
    const onStorage = (event: StorageEvent) => { if (event.key === storageKey) onChange(); };
    window.addEventListener(changeEvent, onChange);
    window.addEventListener("storage", onStorage); // Änderungen aus anderen Tabs
    return () => { window.removeEventListener(changeEvent, onChange); window.removeEventListener("storage", onStorage); };
}

export function useShoppingList() {
    return useSyncExternalStore(subscribe, read, () => emptyList);
}

const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

/** Fügt Einträge hinzu und fasst gleiche Produkte mit gleicher (Basis-)Einheit zusammen. */
export function addShoppingItems(drafts: ShoppingDraft[], source?: string): { added: number; merged: number; ids: string[] } {
    const items = [...read()];
    const index = new Map(items.map((item, position) => [keyOf(item), position]));
    let added = 0;
    let merged = 0;
    const ids: string[] = [];
    for (const draft of drafts) {
        const name = draft.name.trim();
        if (!name) continue;
        const { amount, unit } = toBase(draft.amount !== null && Number.isFinite(draft.amount) && draft.amount > 0 ? draft.amount : null, draft.unit ?? "");
        const key = keyOf({ name, unit });
        const existingPosition = index.get(key);
        if (existingPosition !== undefined) {
            const existing = items[existingPosition];
            items[existingPosition] = {
                ...existing,
                amount: existing.amount === null && amount === null ? null : (existing.amount ?? 0) + (amount ?? 0),
                sources: source && !existing.sources.includes(source) ? [...existing.sources, source] : existing.sources,
            };
            ids.push(existing.id);
            merged += 1;
        } else {
            const item: ShoppingItem = { id: newId(), name, amount, unit, section: isSection(draft.section) ? draft.section : guessSection(name), sources: source ? [source] : [], addedAt: Date.now() };
            index.set(key, items.length);
            items.push(item);
            ids.push(item.id);
            added += 1;
        }
    }
    write(items);
    return { added, merged, ids };
}

export function removeShoppingItem(id: string) { write(read().filter((item) => item.id !== id)); }
export function restoreShoppingItem(item: ShoppingItem) { if (!read().some((entry) => entry.id === item.id)) write([...read(), item]); }
export function clearShoppingList() { write([]); }
export function replaceShoppingList(items: ShoppingItem[]) { write(items); }

/** Lässt die KI Freitext oder Rezeptzutaten in saubere Einträge mit Abteilung umwandeln. */
export async function parseShoppingInput(input: { text: string } | { ingredients: { name: string; amount: number | null; unit: string }[] }): Promise<ShoppingDraft[]> {
    const token = sessionStorage.getItem("crave_access_token");
    const response = await fetch(`${apiUrl}/ai/shopping-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(input),
    });
    const result: { items?: ShoppingDraft[]; detail?: unknown } = await response.json().catch(() => ({}));
    if (!response.ok || !Array.isArray(result.items)) throw new Error(typeof result.detail === "string" ? result.detail : "Die Einträge konnten nicht erkannt werden.");
    return result.items;
}

/** Einfache Zerlegung ohne KI: „2 Eier, Mehl und 200 g Butter“. */
export function parseShoppingTextLocally(text: string): ShoppingDraft[] {
    return text.split(/,|;|\n|\bund\b|\s&\s/i).map((part) => part.trim()).filter(Boolean).map((part) => {
        const match = part.match(/^(\d+(?:[.,]\d+)?)\s*([a-zA-ZäöüÄÖÜß.]+)?\s+(.+)$/);
        if (!match) return { name: part.charAt(0).toUpperCase() + part.slice(1), amount: null, unit: "" };
        const [, amount, maybeUnit, rest] = match;
        const isUnit = maybeUnit !== undefined && maybeUnit.toLowerCase() in unitAliases;
        const name = isUnit ? rest : `${maybeUnit ?? ""} ${rest}`.trim();
        return { name: name.charAt(0).toUpperCase() + name.slice(1), amount: Number(amount.replace(",", ".")), unit: isUnit ? maybeUnit! : "Stück" };
    });
}

/** Text zum Teilen/Exportieren, gruppiert nach Abteilungen. */
export function shoppingListText(items: Pick<ShoppingItem, "name" | "amount" | "unit" | "section">[], title = "Einkaufsliste") {
    const lines = [title];
    for (const section of sectionOrder) {
        const entries = items.filter((item) => item.section === section);
        if (!entries.length) continue;
        lines.push("", sectionLabels[section]);
        for (const entry of entries) {
            const quantity = displayQuantity(entry);
            lines.push(`☐ ${quantity ? `${quantity} ` : ""}${entry.name}`);
        }
    }
    return lines.join("\n");
}

/** Teilt per Share-Sheet (Handy) oder kopiert in die Zwischenablage. Gibt zurück, was passiert ist. */
export async function shareText(text: string, title: string): Promise<"shared" | "copied" | "cancelled"> {
    if (typeof navigator.share === "function") {
        try { await navigator.share({ title, text }); return "shared"; }
        catch (error) { if ((error as Error).name === "AbortError") return "cancelled"; }
    }
    await navigator.clipboard.writeText(text);
    return "copied";
}
