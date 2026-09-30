"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useRef, useState } from "react";

import { apiUrl } from "@/lib/api";

const categories = {
    meal: { label: "Mahlzeit", icon: "🍲" },
    baking: { label: "Backen", icon: "🧁" },
    drink: { label: "Getränk", icon: "🥤" },
    basic: { label: "Basis", icon: "🫙" },
} as const;

type RecipeType = keyof typeof categories;
const inputClass = "mt-2 w-full border-b border-espresso/20 bg-transparent px-0 py-3 text-sm outline-none transition focus:border-caramel";
const split = (value: FormDataEntryValue | null) => String(value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
const number = (form: FormData, name: string) => Number(form.get(name) || 0);
const value = (form: FormData, name: string) => String(form.get(name) ?? "").trim();

function Field({ name, label, type = "text", required = false, defaultValue, step }: { name: string; label: string; type?: string; required?: boolean; defaultValue?: string | number; step?: string }) {
    return <label className="block text-sm font-semibold text-espresso">{label}<input name={name} type={type} required={required} defaultValue={defaultValue} min={type === "number" ? 0 : undefined} step={step} className={inputClass} /></label>;
}

function Select({ name, label, values, defaultValue }: { name: string; label: string; values: string[]; defaultValue?: string }) {
    return <label className="block text-sm font-semibold text-espresso">{label}<select name={name} defaultValue={defaultValue} className={inputClass}>{values.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select></label>;
}

export function RecipeEditor({ initialType = "meal" }: { initialType?: string }) {
    const type: RecipeType = initialType in categories ? initialType as RecipeType : "meal";
    const { label, icon } = categories[type];
    const router = useRouter();
    const formRef = useRef<HTMLFormElement>(null);
    const [description, setDescription] = useState("");
    const [imageData, setImageData] = useState("");
    const [isWriting, setIsWriting] = useState(false);
    const [isImaging, setIsImaging] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState("");

    function ingredients(form: FormData) {
        return String(form.get("ingredients") ?? "").split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
            const [name = "", amount = "0", unit = "g"] = line.split("|").map((part) => part.trim());
            return { name, amount: Number(amount), unit };
        });
    }

    function details(form: FormData) {
        const check = (name: string) => form.get(name) === "on";
        if (type === "meal") return { cooking_method: value(form, "cooking_method"), required_equipment: split(form.get("required_equipment")), prep_time_minutes: number(form, "prep_time_minutes"), cook_time_minutes: number(form, "cook_time_minutes"), meal_prep_friendly: check("meal_prep_friendly"), fridge_life_days: number(form, "fridge_life_days"), freezable: check("freezable"), spiciness_level: number(form, "spiciness_level"), volume_index: value(form, "volume_index"), served_temperature: value(form, "served_temperature") };
        if (type === "baking") return { oven_temperature_c: number(form, "oven_temperature_c"), oven_mode: value(form, "oven_mode"), preheat_required: check("preheat_required"), pan_type: value(form, "pan_type"), pan_size_cm: number(form, "pan_size_cm"), resting_time_minutes: number(form, "resting_time_minutes"), cooling_time_minutes: number(form, "cooling_time_minutes"), dough_type: value(form, "dough_type"), special_techniques: split(form.get("special_techniques")) };
        if (type === "drink") return { prep_method: value(form, "prep_method"), required_equipment: split(form.get("required_equipment")), served_temperature: value(form, "served_temperature"), ice_type: value(form, "ice_type"), abv_percent: number(form, "abv_percent"), caffeine_level: value(form, "caffeine_level"), glass_type: value(form, "glass_type"), volume_ml: number(form, "volume_ml") };
        return { yield_amount: number(form, "yield_amount"), yield_unit: value(form, "yield_unit"), serving_size_amount: number(form, "serving_size_amount"), serving_size_unit: value(form, "serving_size_unit"), storage_method: value(form, "storage_method"), shelf_life_days: number(form, "shelf_life_days"), storage_tips: split(form.get("storage_tips")), component_type: value(form, "component_type"), pairs_well_with: split(form.get("pairs_well_with")), resting_time_minutes: number(form, "resting_time_minutes") };
    }

    function buildContext() {
        const form = new FormData(formRef.current!);
        return { title: value(form, "title"), recipe_type: type, ingredients: ingredients(form), instructions: String(form.get("instructions") ?? "").split("\n").map((step) => step.trim()).filter(Boolean), total_time_minutes: number(form, "total_time_minutes"), calories: number(form, "calories"), protein_g: number(form, "protein_g"), carbs_g: number(form, "carbs_g"), fat_g: number(form, "fat_g"), details: details(form), tags: split(form.get("tags")) };
    }

    async function generate(kind: "description" | "image") {
        const context = buildContext();
        if (!context.title) { setError("Bitte gib zuerst einen Rezeptnamen ein."); return; }
        setError("");
        if (kind === "description") setIsWriting(true); else setIsImaging(true);
        try {
            const token = sessionStorage.getItem("crave_access_token");
            const response = await fetch(`${apiUrl}/ai/recipe-${kind}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(context) });
            const result: { detail?: string; description?: string; image_data?: string } = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.detail ?? "Die KI ist gerade nicht verfügbar.");
            if (kind === "description" && result.description) setDescription(result.description);
            if (kind === "image" && result.image_data) setImageData(result.image_data);
        } catch (caught) { setError(caught instanceof Error ? caught.message : "Die KI ist gerade nicht verfügbar."); }
        finally { if (kind === "description") setIsWriting(false); else setIsImaging(false); }
    }

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!description.trim()) { setError("Bitte erstelle oder schreibe eine Beschreibung."); return; }
        setError(""); setIsSaving(true);
        const form = new FormData(event.currentTarget);
        const payload = { ...buildContext(), description, image_data: imageData || null, servings: number(form, "servings"), difficulty: value(form, "difficulty"), is_ai_generated: form.get("is_ai_generated") === "on" };
        try {
            const token = sessionStorage.getItem("crave_access_token");
            const response = await fetch(`${apiUrl}/recipes`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
            const result: { detail?: string } = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.detail ?? "Das Rezept konnte nicht gespeichert werden.");
            router.push("/recipes");
        } catch (caught) { setError(caught instanceof Error ? caught.message : "Das Rezept konnte nicht gespeichert werden."); }
        finally { setIsSaving(false); }
    }

    return <main className="min-h-screen bg-linen px-5 py-8 sm:px-8 sm:py-12"><form ref={formRef} onSubmit={submit} className="mx-auto max-w-3xl space-y-9 pb-14"><Link href="/recipes" className="text-sm font-bold text-caramel">← Zurück zu Rezepten</Link><header><p className="text-[11px] font-bold tracking-[0.18em] text-caramel">NEUES REZEPT · {icon} {label.toUpperCase()}</p><h1 className="mt-3 text-4xl font-semibold tracking-[-0.065em] text-espresso">Rezept hinzufügen</h1></header>
        <section className="grid gap-6 border-t border-espresso/15 pt-7 sm:grid-cols-2"><div className="sm:col-span-2"><Field name="title" label="Rezeptname" required /></div><div className="sm:col-span-2"><div className="flex items-end gap-3"><label className="block flex-1 text-sm font-semibold text-espresso">Beschreibung<textarea value={description} onChange={(event) => setDescription(event.target.value)} required className="mt-2 min-h-28 w-full border-b border-espresso/20 bg-transparent px-0 py-3 text-sm outline-none focus:border-caramel" /></label><button type="button" onClick={() => generate("description")} disabled={isWriting} className="mb-3 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-saffron text-lg hover:bg-caramel hover:text-white disabled:opacity-60" aria-label="Beschreibung mit KI erstellen">✦</button></div><p className="mt-2 text-xs text-bark">Der Stern erstellt einen einheitlichen, professionellen Text im Crave-Stil.</p></div><Field name="tags" label="Tags, durch Komma getrennt" /><Select name="difficulty" label="Schwierigkeit" defaultValue="easy" values={["easy", "medium", "hard"]} /><Field name="servings" label="Portionen" type="number" required defaultValue={2} /><Field name="total_time_minutes" label="Gesamtzeit in Minuten" type="number" required defaultValue={20} /><label className="flex items-center gap-3 text-sm font-semibold text-espresso"><input name="is_ai_generated" type="checkbox" className="h-4 w-4 accent-caramel" />KI-generiert</label></section>
        <section className="border-t border-espresso/15 pt-7"><h2 className="text-lg font-semibold text-espresso">Bild</h2><p className="mt-1 text-sm text-bark">image-1 fotografiert dein Rezept einheitlich im Crave-Stil.</p><div className="mt-4 flex items-center gap-4"><button type="button" onClick={() => generate("image")} disabled={isImaging} className="rounded-full bg-espresso px-5 py-3 text-sm font-bold text-white hover:bg-caramel disabled:opacity-60">{isImaging ? "Bild wird erstellt…" : "✦ Bild mit KI erstellen"}</button>{imageData && <img src={imageData} alt="KI-Vorschau des Rezepts" className="h-24 w-24 rounded-2xl object-cover" />}</div></section>
        <section className="border-t border-espresso/15 pt-7"><h2 className="text-lg font-semibold text-espresso">Nährwerte pro Portion</h2><div className="mt-5 grid gap-5 sm:grid-cols-4"><Field name="calories" label="Kalorien" type="number" required defaultValue={0} /><Field name="protein_g" label="Protein g" type="number" step="0.1" required defaultValue={0} /><Field name="carbs_g" label="Kohlenhydrate g" type="number" step="0.1" required defaultValue={0} /><Field name="fat_g" label="Fett g" type="number" step="0.1" required defaultValue={0} /></div></section>
        <section className="border-t border-espresso/15 pt-7"><h2 className="text-lg font-semibold text-espresso">Zutaten</h2><label className="mt-4 block text-sm font-semibold text-espresso">Je Zeile: Zutat | Menge | Einheit<textarea name="ingredients" required placeholder="Hähnchenbrust | 300 | g" className="mt-2 min-h-28 w-full border-b border-espresso/20 bg-transparent px-0 py-3 text-sm outline-none focus:border-caramel" /></label></section><section className="border-t border-espresso/15 pt-7"><h2 className="text-lg font-semibold text-espresso">Zubereitung</h2><label className="mt-4 block text-sm font-semibold text-espresso">Ein Schritt pro Zeile<textarea name="instructions" required className="mt-2 min-h-28 w-full border-b border-espresso/20 bg-transparent px-0 py-3 text-sm outline-none focus:border-caramel" /></label></section>
        <DetailFields type={type} />{error && <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{error}</p>}<button disabled={isSaving} className="w-full rounded-full bg-caramel px-6 py-4 text-sm font-bold text-white shadow-[0_12px_24px_rgba(153,97,48,0.2)] hover:bg-espresso disabled:opacity-60">{isSaving ? "Rezept wird gespeichert…" : "Rezept speichern"}</button></form></main>;
}

function DetailFields({ type }: { type: RecipeType }) {
    if (type === "meal") return <DetailSection><Field name="cooking_method" label="Kochmethode" required /><Field name="required_equipment" label="Geräte, durch Komma getrennt" /><Field name="prep_time_minutes" label="Vorbereitung in Minuten" type="number" required defaultValue={0} /><Field name="cook_time_minutes" label="Kochzeit in Minuten" type="number" required defaultValue={0} /><Field name="fridge_life_days" label="Haltbarkeit im Kühlschrank, Tage" type="number" required defaultValue={0} /><Select name="spiciness_level" label="Schärfe" defaultValue="1" values={["1", "2", "3", "4", "5"]} /><Select name="volume_index" label="Sättigungsvolumen" defaultValue="medium" values={["low", "medium", "high"]} /><Select name="served_temperature" label="Serviertemperatur" defaultValue="hot" values={["hot", "warm", "cold"]} /><Check name="meal_prep_friendly" label="Für Meal Prep geeignet" /><Check name="freezable" label="Einfrierbar" /></DetailSection>;
    if (type === "baking") return <DetailSection><Field name="oven_temperature_c" label="Ofentemperatur °C" type="number" required /><Select name="oven_mode" label="Ofenmodus" defaultValue="conventional" values={["conventional", "fan", "hot_air"]} /><Field name="pan_type" label="Backform" required /><Field name="pan_size_cm" label="Formgröße cm" type="number" step="0.1" required /><Field name="resting_time_minutes" label="Ruhezeit in Minuten" type="number" required defaultValue={0} /><Field name="cooling_time_minutes" label="Abkühlzeit in Minuten" type="number" required defaultValue={0} /><Field name="dough_type" label="Teigart" required /><Field name="special_techniques" label="Besondere Techniken, durch Komma getrennt" /><Check name="preheat_required" label="Vorheizen erforderlich" checked /></DetailSection>;
    if (type === "drink") return <DetailSection><Select name="prep_method" label="Zubereitung" defaultValue="blended" values={["blended", "shaken", "stirred", "brewed", "steeped", "built_in_glass"]} /><Field name="required_equipment" label="Geräte, durch Komma getrennt" /><Select name="served_temperature" label="Serviertemperatur" defaultValue="iced" values={["hot", "iced", "chilled", "room_temperature"]} /><Select name="ice_type" label="Eis" defaultValue="none" values={["none", "cubes", "crushed"]} /><Field name="abv_percent" label="Alkoholgehalt %" type="number" step="0.1" required defaultValue={0} /><Select name="caffeine_level" label="Koffein" defaultValue="none" values={["none", "low", "high"]} /><Field name="glass_type" label="Glasart" required /><Field name="volume_ml" label="Volumen ml" type="number" required /></DetailSection>;
    return <DetailSection><Field name="yield_amount" label="Gesamtertrag" type="number" step="0.1" required /><Field name="yield_unit" label="Ertragseinheit" required /><Field name="serving_size_amount" label="Portionsmenge" type="number" step="0.1" required /><Field name="serving_size_unit" label="Portionseinheit" required /><Select name="storage_method" label="Lagerung" defaultValue="fridge" values={["fridge", "pantry", "freezer"]} /><Field name="shelf_life_days" label="Haltbarkeit in Tagen" type="number" required /><Field name="component_type" label="Komponentenart" required /><Field name="resting_time_minutes" label="Ruhezeit in Minuten" type="number" required defaultValue={0} /><Field name="storage_tips" label="Lagerhinweise, durch Komma getrennt" /><Field name="pairs_well_with" label="Passt gut zu, durch Komma getrennt" /></DetailSection>;
}

function DetailSection({ children }: { children: React.ReactNode }) { return <section className="grid gap-5 border-t border-espresso/15 pt-7 sm:grid-cols-2"><h2 className="sm:col-span-2 text-lg font-semibold text-espresso">Kategorie-Details</h2>{children}</section>; }
function Check({ name, label, checked = false }: { name: string; label: string; checked?: boolean }) { return <label className="flex items-center gap-3 text-sm font-semibold text-espresso"><input name={name} type="checkbox" defaultChecked={checked} className="h-4 w-4 accent-caramel" />{label}</label>; }
