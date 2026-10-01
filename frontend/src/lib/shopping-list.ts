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

// ---- Speicher: lokal zuerst, im Hintergrund mit der Datenbank abgeglichen ----
//
// Jede Änderung landet sofort in localStorage (kein Warten aufs Netz, offline nutzbar)
// und zusätzlich in einer „Outbox“. Die Outbox wird gebündelt an /shopping-list/sync
// geschickt; die Antwort des Servers ist danach der Stand für alles, was nicht mehr
// auf dem Weg ist. Pro Nutzer getrennt, damit sich Konten auf einem Gerät nicht mischen.

type OutboxEntry = { op: "upsert" | "delete"; v: number };
type Outbox = Record<string, OutboxEntry>;
type ServerItem = { id: string; name: string; amount: number | null; unit: string; section: string; sources: string[]; added_at: string };
export type SyncStatus = "idle" | "syncing" | "offline" | "error";

const lastUserKey = "crave_shopping_user";
const flushDelayMs = 600;

/** Nutzer-ID aus dem Token (nur zur Trennung der lokalen Daten, keine Sicherheitsprüfung). */
function currentUserId(): string {
    const token = window.sessionStorage.getItem("crave_access_token");
    if (token) {
        try {
            const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))) as { sub?: unknown };
            if (typeof payload.sub === "string") {
                if (window.localStorage.getItem(lastUserKey) !== payload.sub) window.localStorage.setItem(lastUserKey, payload.sub);
                return payload.sub;
            }
        } catch { /* ungültiges Token: auf letzten Nutzer zurückfallen */ }
    }
    return window.localStorage.getItem(lastUserKey) ?? "anonymous";
}
const itemsKey = (user: string) => `${storageKey}:${user}`;
const outboxKey = (user: string) => `crave_shopping_outbox:${user}`;

function readJson<T>(key: string, fallback: T): T {
    try {
        const raw = window.localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
        return fallback;
    }
}

/** Übernimmt eine Liste aus der Zeit vor der Datenbank-Speicherung einmalig für den aktuellen Nutzer. */
function migrateLegacyList(user: string) {
    const legacy = window.localStorage.getItem(storageKey);
    if (legacy === null || user === "anonymous") return;
    window.localStorage.removeItem(storageKey);
    if (window.localStorage.getItem(itemsKey(user)) !== null) return;
    let parsed: ShoppingItem[] = [];
    try {
        const value: unknown = JSON.parse(legacy);
        if (Array.isArray(value)) parsed = value.filter((item): item is ShoppingItem => typeof item?.id === "string" && typeof item?.name === "string");
    } catch { /* kaputte Altdaten ignorieren */ }
    window.localStorage.setItem(itemsKey(user), JSON.stringify(parsed));
    enqueue(user, parsed.map((item) => [item.id, "upsert"] as const));
}

let cachedKey = "";
let cachedRaw: string | null = null;
let cachedItems: ShoppingItem[] = emptyList;

function read(): ShoppingItem[] {
    const user = currentUserId();
    migrateLegacyList(user);
    const key = itemsKey(user);
    const raw = window.localStorage.getItem(key);
    if (key === cachedKey && raw === cachedRaw) return cachedItems;
    cachedKey = key;
    cachedRaw = raw;
    try {
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        cachedItems = Array.isArray(parsed) ? parsed.filter((item): item is ShoppingItem => typeof item?.id === "string" && typeof item?.name === "string") : emptyList;
    } catch {
        cachedItems = emptyList;
    }
    return cachedItems;
}

function writeLocal(items: ShoppingItem[]) {
    window.localStorage.setItem(itemsKey(currentUserId()), JSON.stringify(items));
    window.dispatchEvent(new Event(changeEvent));
}

let outboxVersion = Date.now();
function enqueue(user: string, changes: (readonly [string, OutboxEntry["op"]])[]) {
    if (!changes.length) return;
    const outbox = readJson<Outbox>(outboxKey(user), {});
    for (const [id, op] of changes) outbox[id] = { op, v: ++outboxVersion };
    window.localStorage.setItem(outboxKey(user), JSON.stringify(outbox));
}

/** Lokal speichern (sofort) und die Unterschiede für den Server vormerken. */
function write(items: ShoppingItem[]) {
    const user = currentUserId();
    const before = new Map(read().map((item) => [item.id, item]));
    const after = new Set(items.map((item) => item.id));
    const changes: (readonly [string, OutboxEntry["op"]])[] = [
        ...items.filter((item) => before.get(item.id) !== item).map((item) => [item.id, "upsert"] as const),
        ...[...before.keys()].filter((id) => !after.has(id)).map((id) => [id, "delete"] as const),
    ];
    writeLocal(items);
    enqueue(user, changes);
    scheduleSync();
}

// ---- Sync-Status (für die kleine Anzeige „Gespeichert“ / „Offline“) ---------

let syncStatus: SyncStatus = "idle";
const statusListeners = new Set<() => void>();
function setStatus(next: SyncStatus) {
    if (next === syncStatus) return;
    syncStatus = next;
    statusListeners.forEach((listener) => listener());
}
export function useShoppingSyncStatus() {
    return useSyncExternalStore((listener) => { statusListeners.add(listener); return () => statusListeners.delete(listener); }, () => syncStatus, () => "idle" as SyncStatus);
}

// ---- Abgleich mit dem Server -------------------------------------------------

let syncTimer: number | null = null;
let syncInFlight = false;
let syncAgain = false;

function scheduleSync(delay = flushDelayMs) {
    if (syncTimer !== null) window.clearTimeout(syncTimer);
    syncTimer = window.setTimeout(() => { syncTimer = null; void syncShoppingList(); }, delay);
}

const fromServer = (item: ServerItem): ShoppingItem => ({
    id: item.id, name: item.name, amount: item.amount, unit: item.unit,
    section: isSection(item.section) ? item.section : "other", sources: item.sources ?? [], addedAt: Date.parse(item.added_at) || Date.now(),
});
const toServer = (item: ShoppingItem) => ({
    id: item.id, name: item.name.slice(0, 120), amount: item.amount, unit: item.unit.slice(0, 32),
    section: item.section, sources: item.sources.slice(0, 20), added_at: new Date(item.addedAt).toISOString(),
});

/**
 * Schickt alle vorgemerkten Änderungen und holt den aktuellen Stand.
 * Exportiert für Tests; `fetcher` ist austauschbar.
 */
export async function syncShoppingList(fetcher: typeof fetch = fetch): Promise<void> {
    if (syncInFlight) { syncAgain = true; return; }
    const token = window.sessionStorage.getItem("crave_access_token");
    if (!token || navigator.onLine === false) { setStatus("offline"); return; }

    const user = currentUserId();
    const local = new Map(read().map((item) => [item.id, item])); // zuerst lesen: migriert ggf. Altdaten in die Outbox
    const sent = readJson<Outbox>(outboxKey(user), {});
    const upserts = Object.entries(sent).filter(([id, entry]) => entry.op === "upsert" && local.has(id)).map(([id]) => toServer(local.get(id)!));
    const deletes = Object.entries(sent).filter(([id, entry]) => entry.op === "delete" || !local.has(id)).map(([id]) => id);

    syncInFlight = true;
    setStatus("syncing");
    try {
        // Große Listen in Häppchen, passend zu den Server-Limits.
        let serverItems: ServerItem[] = [];
        const chunks = Math.max(1, Math.ceil(upserts.length / 200), Math.ceil(deletes.length / 500));
        for (let index = 0; index < chunks; index += 1) {
            const response = await fetcher(`${apiUrl}/shopping-list/sync`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ upserts: upserts.slice(index * 200, (index + 1) * 200), deletes: deletes.slice(index * 500, (index + 1) * 500) }),
            });
            if (!response.ok) throw new Error(String(response.status));
            serverItems = await response.json();
        }
        if (currentUserId() !== user) return; // Nutzer gewechselt, Ergebnis verwerfen

        // Bestätigte Einträge aus der Outbox nehmen – außer sie wurden inzwischen erneut geändert.
        const outbox = readJson<Outbox>(outboxKey(user), {});
        for (const [id, entry] of Object.entries(sent)) if (outbox[id]?.v === entry.v) delete outbox[id];
        window.localStorage.setItem(outboxKey(user), JSON.stringify(outbox));

        // Server-Stand übernehmen, noch ausstehende lokale Änderungen behalten.
        const current = new Map(read().map((item) => [item.id, item]));
        const merged = serverItems.map(fromServer).filter((item) => outbox[item.id]?.op !== "delete").map((item) => (outbox[item.id]?.op === "upsert" && current.get(item.id)) || item);
        const mergedIds = new Set(merged.map((item) => item.id));
        for (const [id, entry] of Object.entries(outbox)) if (entry.op === "upsert" && !mergedIds.has(id) && current.has(id)) merged.push(current.get(id)!);
        writeLocal(merged);
        setStatus("idle");
    } catch (error) {
        // fetch wirft bei fehlendem Netz einen TypeError; HTTP-Fehler landen als normaler Error hier.
        setStatus(error instanceof TypeError ? "offline" : "error");
    } finally {
        syncInFlight = false;
        if (syncAgain) { syncAgain = false; scheduleSync(0); }
    }
}

function subscribe(onChange: () => void) {
    const onStorage = (event: StorageEvent) => { if (event.key?.startsWith(storageKey)) onChange(); };
    window.addEventListener(changeEvent, onChange);
    window.addEventListener("storage", onStorage); // Änderungen aus anderen Tabs
    return () => { window.removeEventListener(changeEvent, onChange); window.removeEventListener("storage", onStorage); };
}

export function useShoppingList() {
    return useSyncExternalStore(subscribe, read, () => emptyList);
}

/** Holt beim Öffnen, bei Rückkehr in den Tab und wenn das Netz zurückkommt den aktuellen Stand. */
export function startShoppingSync() {
    const refresh = () => { if (document.visibilityState === "visible") scheduleSync(0); };
    scheduleSync(0);
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
        window.removeEventListener("online", refresh);
        window.removeEventListener("focus", refresh);
        document.removeEventListener("visibilitychange", refresh);
    };
}

/** UUID v4 – auch auf älteren Browsern ohne crypto.randomUUID (der Server erwartet UUIDs). */
function newId(): string {
    if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

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
