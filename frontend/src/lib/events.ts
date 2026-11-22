import { apiUrl } from "@/lib/api";

export type DropItem = { name: string; amount: number | null; unit: string; image_data: string | null; handicap: { id: string; title: string } | null };
export type Drop = { day_index: number; date: string; state: "locked" | "available" | "revealed"; items?: DropItem[]; teaser?: string | null };
export type EventIngredient = { name: string; amount: number | null; unit: string; mask?: "amount" | "name" | "memory"; image_data?: string | null };
export type JudgedDish = { recipe_id: string; title: string; verdict: string; penalty: number; categories: { name: string; penalty: number; comment: string }[]; reveal_at?: string };
/** Every dish has its own jury: hand in, get judged, get its own penalty points. */
export type DishJury = { phase: "cooking" | "judging" | "judged"; error: string | null; verdict: JudgedDish | null };
export type EventRecipe = { id: string; instructions: string[]; category: string; title: string; description: string; image_data: string | null; servings: number; total_time_minutes: number; difficulty: string; ingredients: EventIngredient[]; jury: DishJury };
export type JuryVerdict = { recipes: JudgedDish[]; summary: string; penalty: number; reveal_at?: string };
export type EventSubmission = { email: string; is_me: boolean; recipe_id: string; taste_rating: number | null; image_data: string | null };
export type EventGuessing = {
    open: boolean; done: boolean; judging: boolean; judging_since: string | null; error: string | null; reveal_at: string | null;
    mine: Record<string, string>; submitted: string[]; complete: string[]; bonus: number;
    results: { recipe_id: string; email: string; is_me: boolean; guess: string; correct: boolean | null; reason: string | null }[];
};
export type EventPhase = "cooking" | "judging" | "judged" | "finished";
export type EventTip = { email: string; question: string; answer: string; truth: number | null; created_at: string };
export type EventDetail = {
    id: string; title: string; theme: string; status: "generating" | "active" | "failed"; progress: string; images_pending: boolean; is_creator: boolean; server_now: string;
    guessing: EventGuessing | null;
    /** Client-side only: server clock minus device clock, set when the event is loaded. */
    clock_offset?: number;
    handicap_count: number; penalty_spent: number; handicaps: { handicap: string; title: string; tier: "light" | "medium" | "heavy"; ingredient?: string; detail?: string; description?: string }[]; effects: string[]; mixed_ingredients: EventIngredient[] | null;
    game: { blind_revealed: boolean; memory_phase: "waiting" | "visible" | "expired" | null; memory_started_at: string | null; memory_seconds: number; role: "A" | "B"; can_ask: boolean; asker_email: string };
    phase: EventPhase; verdict: JuryVerdict | null; jury_error: string | null; submissions: EventSubmission[]; penalty_earned: number; participant_count: number; categories: string[];
    start_date: string; cook_date: string; today: string; days_total: number; is_cook_day: boolean; pantry: string[];
    drops: Drop[]; stats: { email: string; is_me: boolean; revealed: number; tips: number }[]; tip_count: number; recipes: EventRecipe[]; tips: EventTip[];
};
export type EventSummary = { id: string; title: string; status: string; start_date: string; cook_date: string; is_cook_day: boolean; open_drops: number; phase: EventPhase };

export const EVENT_CATEGORIES = [
    { key: "fruehstueck", label: "Frühstück" },
    { key: "vorspeise", label: "Vorspeise" },
    { key: "mittagessen", label: "Mittagessen" },
    { key: "abendessen", label: "Abendessen" },
    { key: "kuchen", label: "Kuchen" },
    { key: "dessert", label: "Dessert" },
    { key: "gebaeck", label: "Plätzchen & Gebäck" },
    { key: "getraenk", label: "Getränk" },
];

/** Authenticated JSON request; throws the backend's German error message. */
export async function eventApi<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
    const response = await fetch(`${apiUrl}${path}`, {
        method: init?.method ?? "GET",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionStorage.getItem("crave_access_token")}` },
        body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    });
    if (response.status === 204) return undefined as T;
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const detail = Array.isArray(data.detail) ? data.detail[0]?.msg?.replace(/^Value error, /, "") : data.detail;
        throw new Error(detail || "Das hat nicht geklappt. Bitte versuche es erneut.");
    }
    return data as T;
}

export function formatDay(iso: string, options: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) {
    return new Date(`${iso}T12:00:00`).toLocaleDateString("de-DE", options);
}

export function formatAmount(amount: number | null, unit: string) {
    if (amount === null) return `? ${unit}`; // "Das schwarze Loch": amount deliberately hidden
    if (!amount) return unit;
    return `${amount.toLocaleString("de-DE", { maximumFractionDigits: 4 })} ${unit}`;
}
