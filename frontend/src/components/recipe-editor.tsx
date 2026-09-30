"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { CakeSlice, CookingPot, CupSoda, Soup } from "lucide-react";

import { apiUrl } from "@/lib/api";
import { LoadingIndicator } from "@/components/loading-indicator";

const categories = {
	meal: { label: "Mahlzeit", icon: <Soup size={14} strokeWidth={2.25} aria-hidden="true" /> },
	baking: { label: "Backen", icon: <CakeSlice size={14} strokeWidth={2.25} aria-hidden="true" /> },
	drink: { label: "Getränk", icon: <CupSoda size={14} strokeWidth={2.25} aria-hidden="true" /> },
	basic: { label: "Grundrezept", icon: <CookingPot size={14} strokeWidth={2.25} aria-hidden="true" /> },
} as const;

type RecipeType = keyof typeof categories;
type Ingredient = { name: string; amount: string; unit: string };

const inputClass = "mt-2 w-full rounded-2xl border border-espresso/12 bg-white/70 px-4 py-3 text-sm text-espresso outline-none transition placeholder:text-bark/55 focus:border-caramel focus:ring-4 focus:ring-caramel/10";
const split = (entry: FormDataEntryValue | null) => String(entry ?? "").split(",").map((item) => item.trim()).filter(Boolean);
const number = (form: FormData, name: string) => Number(form.get(name) || 0);
const value = (form: FormData, name: string) => String(form.get(name) ?? "").trim();

const enumLabels: Record<string, string> = {
	easy: "Einfach", medium: "Mittel", hard: "Schwer", low: "Gering", high: "Hoch",
	hot: "Heiß", warm: "Warm", cold: "Kalt", iced: "Eiskalt", chilled: "Gekühlt", room_temperature: "Zimmertemperatur",
	conventional: "Ober-/Unterhitze", fan: "Umluft", hot_air: "Heißluft",
	blended: "Püriert", shaken: "Geschüttelt", stirred: "Gerührt", brewed: "Gebrüht", steeped: "Ziehen lassen", built_in_glass: "Direkt im Glas",
	none: "Ohne", cubes: "Eiswürfel", crushed: "Crushed Ice", fridge: "Kühlschrank", pantry: "Vorratsschrank", freezer: "Tiefkühler",
};

function Field({ name, label, type = "text", required = false, defaultValue, step, placeholder }: { name: string; label: string; type?: string; required?: boolean; defaultValue?: string | number; step?: string; placeholder?: string }) {
	return <label className="block text-sm font-semibold text-espresso">{label}<input name={name} type={type} required={required} defaultValue={defaultValue} min={type === "number" ? 0 : undefined} step={step} placeholder={placeholder} className={inputClass} /></label>;
}

function Select({ name, label, values, defaultValue }: { name: string; label: string; values: string[]; defaultValue?: string }) {
	return <label className="block text-sm font-semibold text-espresso">{label}<select name={name} defaultValue={defaultValue} className={inputClass}>{values.map((item) => <option key={item} value={item}>{enumLabels[item] ?? item}</option>)}</select></label>;
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
	return <section className="rounded-[2rem] border border-espresso/10 bg-sand/25 p-5 sm:p-7"><div className="mb-5"><h2 className="text-xl font-semibold tracking-[-0.04em] text-espresso">{title}</h2>{hint && <p className="mt-1 text-sm text-bark">{hint}</p>}</div>{children}</section>;
}

export function RecipeEditor({ initialType = "meal" }: { initialType?: string }) {
	const type: RecipeType = initialType in categories ? initialType as RecipeType : "meal";
	const { label, icon } = categories[type];
	const router = useRouter();
	const searchParams = useSearchParams();
	const editId = searchParams.get("edit");
	const formRef = useRef<HTMLFormElement>(null);
	const [description, setDescription] = useState("");
	const [imageData, setImageData] = useState("");
	const [ingredients, setIngredients] = useState<Ingredient[]>([{ name: "", amount: "", unit: "g" }]);
	const [steps, setSteps] = useState([""]);
	const [isWriting, setIsWriting] = useState(false);
	const [isImaging, setIsImaging] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [error, setError] = useState("");

	useEffect(() => {
		if (editId) router.replace(`/recipes/${editId}/edit`);
	}, [editId, router]);

	function recipeIngredients() { return ingredients.filter((item) => item.name.trim()).map((item) => ({ name: item.name.trim(), amount: Number(item.amount || 0), unit: item.unit.trim() })); }
	function recipeSteps() { return steps.map((step) => step.trim()).filter(Boolean); }
	function updateIngredient(index: number, key: keyof Ingredient, itemValue: string) { setIngredients((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: itemValue } : item)); }
	function removeIngredient(index: number) { setIngredients((items) => items.length === 1 ? [{ name: "", amount: "", unit: "g" }] : items.filter((_, itemIndex) => itemIndex !== index)); }
	function updateStep(index: number, step: string) { setSteps((items) => items.map((item, itemIndex) => itemIndex === index ? step : item)); }
	function removeStep(index: number) { setSteps((items) => items.length === 1 ? [""] : items.filter((_, itemIndex) => itemIndex !== index)); }

	function details(form: FormData) {
		const check = (name: string) => form.get(name) === "on";
		if (type === "meal") return { cooking_method: value(form, "cooking_method"), required_equipment: split(form.get("required_equipment")), prep_time_minutes: number(form, "prep_time_minutes"), cook_time_minutes: number(form, "cook_time_minutes"), meal_prep_friendly: check("meal_prep_friendly"), fridge_life_days: number(form, "fridge_life_days"), freezable: check("freezable"), spiciness_level: number(form, "spiciness_level"), volume_index: value(form, "volume_index"), served_temperature: value(form, "served_temperature") };
		if (type === "baking") return { oven_temperature_c: number(form, "oven_temperature_c"), oven_mode: value(form, "oven_mode"), preheat_required: check("preheat_required"), pan_type: value(form, "pan_type"), pan_size_cm: number(form, "pan_size_cm"), resting_time_minutes: number(form, "resting_time_minutes"), cooling_time_minutes: number(form, "cooling_time_minutes"), dough_type: value(form, "dough_type"), special_techniques: split(form.get("special_techniques")) };
		if (type === "drink") return { prep_method: value(form, "prep_method"), required_equipment: split(form.get("required_equipment")), served_temperature: value(form, "served_temperature"), ice_type: value(form, "ice_type"), abv_percent: number(form, "abv_percent"), caffeine_level: value(form, "caffeine_level"), glass_type: value(form, "glass_type"), volume_ml: number(form, "volume_ml") };
		return { yield_amount: number(form, "yield_amount"), yield_unit: value(form, "yield_unit"), serving_size_amount: number(form, "serving_size_amount"), serving_size_unit: value(form, "serving_size_unit"), storage_method: value(form, "storage_method"), shelf_life_days: number(form, "shelf_life_days"), storage_tips: split(form.get("storage_tips")), component_type: value(form, "component_type"), pairs_well_with: split(form.get("pairs_well_with")), resting_time_minutes: number(form, "resting_time_minutes") };
	}

	function buildContext() {
		const form = new FormData(formRef.current!);
		return { title: value(form, "title"), recipe_type: type, ingredients: recipeIngredients(), instructions: recipeSteps(), total_time_minutes: number(form, "total_time_minutes"), calories: number(form, "calories"), protein_g: number(form, "protein_g"), carbs_g: number(form, "carbs_g"), fat_g: number(form, "fat_g"), details: details(form), tags: split(form.get("tags")) };
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
		if (!recipeIngredients().length || !recipeSteps().length) { setError("Bitte füge mindestens eine Zutat und einen Zubereitungsschritt hinzu."); return; }
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

	return <main className="flex-1 bg-linen px-5 py-8 pb-28 sm:px-8 sm:py-12"><form ref={formRef} onSubmit={submit} className="mx-auto max-w-5xl space-y-6"><Link href="/recipes" className="inline-flex text-sm font-bold text-caramel transition hover:text-espresso">← Zurück zu Rezepten</Link><header className="pb-2"><p className="text-[11px] font-bold tracking-[0.18em] text-caramel">NEUES REZEPT · {icon} {label.toUpperCase()}</p><h1 className="mt-3 text-4xl font-semibold tracking-[-0.065em] text-espresso">Rezept hinzufügen</h1></header>
		<Section title="Grundlagen"><div className="grid gap-5 sm:grid-cols-2"><div className="sm:col-span-2"><Field name="title" label="Rezeptname" required placeholder="z. B. Cremige Zitronenpasta" /></div><div className="sm:col-span-2"><div className="flex items-end gap-3"><label className="block flex-1 text-sm font-semibold text-espresso">Beschreibung<textarea value={description} onChange={(event) => setDescription(event.target.value)} required placeholder="Was macht dieses Rezept besonders?" className={`${inputClass} min-h-28 resize-y`} /></label><button type="button" onClick={() => generate("description")} disabled={isWriting} className="mb-0 grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-saffron text-xl transition hover:bg-caramel hover:text-white disabled:opacity-60" aria-label="Beschreibung mit KI erstellen">✦</button></div></div><Field name="tags" label="Tags" placeholder="z. B. schnell, vegetarisch" /><Select name="difficulty" label="Schwierigkeit" defaultValue="easy" values={["easy", "medium", "hard"]} /><Field name="servings" label="Portionen" type="number" required defaultValue={2} /><Field name="total_time_minutes" label="Gesamtzeit in Minuten" type="number" required defaultValue={20} /><Check name="is_ai_generated" label="KI-generiert" /></div></Section>
		<Section title="Zutaten" hint="Füge jede Zutat einzeln hinzu."><div className="space-y-3">{ingredients.map((ingredient, index) => <div key={index} className="grid gap-3 rounded-2xl border border-espresso/10 bg-white/45 p-3 sm:grid-cols-[minmax(0,1fr)_7rem_7rem_2.75rem]"><input value={ingredient.name} onChange={(event) => updateIngredient(index, "name", event.target.value)} required placeholder="Zutat" className="rounded-xl border border-espresso/10 bg-white/80 px-3 py-2.5 text-sm outline-none focus:border-caramel" /><input value={ingredient.amount} onChange={(event) => updateIngredient(index, "amount", event.target.value)} required type="number" min="0" step="0.1" placeholder="Menge" className="rounded-xl border border-espresso/10 bg-white/80 px-3 py-2.5 text-sm outline-none focus:border-caramel" /><input value={ingredient.unit} onChange={(event) => updateIngredient(index, "unit", event.target.value)} required placeholder="Einheit" className="rounded-xl border border-espresso/10 bg-white/80 px-3 py-2.5 text-sm outline-none focus:border-caramel" /><button type="button" onClick={() => removeIngredient(index)} className="grid h-10 w-10 place-items-center rounded-xl border border-espresso/10 text-lg text-bark transition hover:border-red-200 hover:bg-red-50 hover:text-red-700" aria-label={`Zutat ${index + 1} entfernen`}>−</button></div>)}</div><button type="button" onClick={() => setIngredients((items) => [...items, { name: "", amount: "", unit: "g" }])} className="mt-4 rounded-full border border-caramel px-4 py-2 text-sm font-bold text-caramel transition hover:bg-caramel hover:text-white">+ Zutat hinzufügen</button></Section>
		<Section title="Zubereitung" hint="Ein Schritt pro Eintrag – klar und gut lesbar."><div className="space-y-3">{steps.map((step, index) => <div key={index} className="flex gap-3 rounded-2xl border border-espresso/10 bg-white/45 p-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-saffron/35 text-sm font-bold text-espresso">{index + 1}</span><input value={step} onChange={(event) => updateStep(index, event.target.value)} required placeholder={`Schritt ${index + 1} beschreiben`} className="min-w-0 flex-1 rounded-xl border border-espresso/10 bg-white/80 px-3 py-2.5 text-sm outline-none focus:border-caramel" /><button type="button" onClick={() => removeStep(index)} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-espresso/10 text-lg text-bark transition hover:border-red-200 hover:bg-red-50 hover:text-red-700" aria-label={`Schritt ${index + 1} entfernen`}>−</button></div>)}</div><button type="button" onClick={() => setSteps((items) => [...items, ""])} className="mt-4 rounded-full border border-caramel px-4 py-2 text-sm font-bold text-caramel transition hover:bg-caramel hover:text-white">+ Schritt hinzufügen</button></Section>
		<Section title="Nährwerte" hint="Angaben pro Portion."><div className="grid gap-5 sm:grid-cols-4"><Field name="calories" label="Kalorien" type="number" required defaultValue={0} /><Field name="protein_g" label="Protein in g" type="number" step="0.1" required defaultValue={0} /><Field name="carbs_g" label="Kohlenhydrate in g" type="number" step="0.1" required defaultValue={0} /><Field name="fat_g" label="Fett in g" type="number" step="0.1" required defaultValue={0} /></div></Section>
		<DetailFields type={type} />
		<Section title="Bild"><div className="flex flex-wrap items-center gap-4"><button type="button" onClick={() => generate("image")} disabled={isImaging} className="flex min-w-44 justify-center rounded-full bg-espresso px-5 py-3 text-sm font-bold text-white transition hover:bg-caramel disabled:opacity-60">{isImaging ? <LoadingIndicator label="Bild wird erstellt…" light /> : "✦ Bild mit KI erstellen"}</button>{imageData && <Image src={imageData} alt="KI-Vorschau des Rezepts" width={96} height={96} unoptimized className="h-24 w-24 rounded-2xl object-cover" />}</div></Section>
		{error && <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{error}</p>}<button disabled={isSaving} className="w-full rounded-full bg-caramel px-6 py-4 text-sm font-bold text-white shadow-[0_12px_24px_rgba(153,97,48,0.2)] transition hover:bg-espresso disabled:opacity-60">{isSaving ? "Rezept wird gespeichert…" : "Rezept speichern"}</button></form></main>;
}

function DetailFields({ type }: { type: RecipeType }) {
	let fields: React.ReactNode;
	if (type === "meal") fields = <><Field name="cooking_method" label="Kochmethode" required /><Field name="required_equipment" label="Benötigte Geräte" placeholder="z. B. Pfanne, Topf" /><Field name="prep_time_minutes" label="Vorbereitung in Minuten" type="number" required defaultValue={0} /><Field name="cook_time_minutes" label="Kochzeit in Minuten" type="number" required defaultValue={0} /><Field name="fridge_life_days" label="Haltbarkeit im Kühlschrank" type="number" required defaultValue={0} /><Select name="spiciness_level" label="Schärfe" defaultValue="1" values={["1", "2", "3", "4", "5"]} /><Select name="volume_index" label="Sättigungsvolumen" defaultValue="medium" values={["low", "medium", "high"]} /><Select name="served_temperature" label="Serviertemperatur" defaultValue="hot" values={["hot", "warm", "cold"]} /><Check name="meal_prep_friendly" label="Für Meal Prep geeignet" /><Check name="freezable" label="Einfrierbar" /></>;
	else if (type === "baking") fields = <><Field name="oven_temperature_c" label="Ofentemperatur in °C" type="number" required /><Select name="oven_mode" label="Ofenmodus" defaultValue="conventional" values={["conventional", "fan", "hot_air"]} /><Field name="pan_type" label="Backform" required /><Field name="pan_size_cm" label="Formgröße in cm" type="number" step="0.1" required /><Field name="resting_time_minutes" label="Ruhezeit in Minuten" type="number" required defaultValue={0} /><Field name="cooling_time_minutes" label="Abkühlzeit in Minuten" type="number" required defaultValue={0} /><Field name="dough_type" label="Teigart" required /><Field name="special_techniques" label="Besondere Techniken" /><Check name="preheat_required" label="Vorheizen erforderlich" checked /></>;
	else if (type === "drink") fields = <><Select name="prep_method" label="Zubereitungsart" defaultValue="blended" values={["blended", "shaken", "stirred", "brewed", "steeped", "built_in_glass"]} /><Field name="required_equipment" label="Benötigte Geräte" /><Select name="served_temperature" label="Serviertemperatur" defaultValue="iced" values={["hot", "iced", "chilled", "room_temperature"]} /><Select name="ice_type" label="Eis" defaultValue="none" values={["none", "cubes", "crushed"]} /><Field name="abv_percent" label="Alkoholgehalt in %" type="number" step="0.1" required defaultValue={0} /><Select name="caffeine_level" label="Koffein" defaultValue="none" values={["none", "low", "high"]} /><Field name="glass_type" label="Glasart" required /><Field name="volume_ml" label="Volumen in ml" type="number" required /></>;
	else fields = <><Field name="yield_amount" label="Gesamtertrag" type="number" step="0.1" required /><Field name="yield_unit" label="Ertragseinheit" required /><Field name="serving_size_amount" label="Portionsmenge" type="number" step="0.1" required /><Field name="serving_size_unit" label="Portionseinheit" required /><Select name="storage_method" label="Aufbewahrung" defaultValue="fridge" values={["fridge", "pantry", "freezer"]} /><Field name="shelf_life_days" label="Haltbarkeit in Tagen" type="number" required /><Field name="component_type" label="Komponentenart" required /><Field name="resting_time_minutes" label="Ruhezeit in Minuten" type="number" required defaultValue={0} /><Field name="storage_tips" label="Aufbewahrungshinweise" /><Field name="pairs_well_with" label="Passt gut zu" /></>;
	return <Section title="Kategorie-Details"><div className="grid gap-5 sm:grid-cols-2">{fields}</div></Section>;
}

function Check({ name, label, checked = false }: { name: string; label: string; checked?: boolean }) { return <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-espresso/10 bg-white/45 px-4 text-sm font-semibold text-espresso"><input name={name} type="checkbox" defaultChecked={checked} className="h-4 w-4 accent-caramel" />{label}</label>; }
