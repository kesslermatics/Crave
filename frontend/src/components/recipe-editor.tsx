"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { ArrowLeft, CakeSlice, ChevronDown, CookingPot, Copy, CupSoda, ImagePlus, Plus, Soup, Sparkles, X } from "lucide-react";

import { apiUrl } from "@/lib/api";
import { LoadingIndicator } from "@/components/loading-indicator";

const categories = {
	meal: { label: "Mahlzeit", icon: <Soup size={13} strokeWidth={2.25} aria-hidden="true" /> },
	baking: { label: "Backen & Desserts", icon: <CakeSlice size={13} strokeWidth={2.25} aria-hidden="true" /> },
	drink: { label: "Getränk", icon: <CupSoda size={13} strokeWidth={2.25} aria-hidden="true" /> },
	basic: { label: "Grundrezept", icon: <CookingPot size={13} strokeWidth={2.25} aria-hidden="true" /> },
} as const;

type RecipeType = keyof typeof categories;
type Ingredient = { name: string; amount: string; unit: string };

// Einheitliche, ruhige Eingabefelder
const fieldBase = "w-full rounded-xl border border-espresso/10 bg-white px-3.5 py-2.5 text-sm text-espresso outline-none transition placeholder:text-bark/45 hover:border-espresso/20 focus:border-caramel/60 focus:ring-4 focus:ring-caramel/10";
const inputClass = `mt-1.5 ${fieldBase}`;
const labelClass = "block text-[13px] font-medium text-bark";
const ghostAdd = "mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-caramel transition hover:bg-caramel/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-caramel/40";
const removeButton = "grid h-[2.625rem] w-9 shrink-0 place-items-center rounded-xl text-bark/45 transition hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300";
const darkButton = "inline-flex items-center justify-center gap-2 rounded-full bg-espresso px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-caramel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-caramel/40 disabled:opacity-60";

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

function Field({ name, label, type = "text", required = false, defaultValue, step, placeholder, suffix }: { name: string; label: string; type?: string; required?: boolean; defaultValue?: string | number; step?: string; placeholder?: string; suffix?: string }) {
	const input = <input name={name} type={type} required={required} defaultValue={defaultValue} min={type === "number" ? 0 : undefined} step={step} placeholder={placeholder} inputMode={type === "number" ? "decimal" : undefined} className={suffix ? `${fieldBase} pr-14 tabular-nums` : inputClass} />;
	return <label className={labelClass}>{label}{suffix ? <span className="relative mt-1.5 block">{input}<span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-sm text-bark/55">{suffix}</span></span> : input}</label>;
}

function Select({ name, label, values, defaultValue }: { name: string; label: string; values: string[]; defaultValue?: string }) {
	return <label className={labelClass}>{label}<span className="relative mt-1.5 block"><select name={name} defaultValue={defaultValue} className={`${fieldBase} cursor-pointer appearance-none pr-10`}>{values.map((item) => <option key={item} value={item}>{enumLabels[item] ?? item}</option>)}</select><ChevronDown size={16} strokeWidth={2} className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-bark/60" aria-hidden="true" /></span></label>;
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
	return <section className="grid gap-5 border-t border-espresso/10 py-10 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-12">
		<div><h2 className="text-lg font-semibold tracking-[-0.03em] text-espresso">{title}</h2>{hint && <p className="mt-1 text-sm leading-6 text-bark/85">{hint}</p>}</div>
		<div className="min-w-0">{children}</div>
	</section>;
}

function Check({ name, label, checked = false }: { name: string; label: string; checked?: boolean }) {
	return <label className="flex cursor-pointer items-center justify-between gap-4 self-end rounded-xl py-2.5 text-sm font-medium text-espresso">
		<span>{label}</span>
		<input name={name} type="checkbox" defaultChecked={checked} className="peer sr-only" />
		<span aria-hidden="true" className="relative h-6 w-10 shrink-0 rounded-full bg-espresso/15 transition peer-checked:bg-caramel peer-focus-visible:ring-4 peer-focus-visible:ring-caramel/20 after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:after:translate-x-4" />
	</label>;
}

function EditorSkeleton() {
	const bar = "rounded-full bg-espresso/[0.06] motion-safe:animate-shimmer";
	return <main className="flex-1 bg-linen pb-28" aria-busy="true" aria-label="Rezept wird geladen">
		<div className="mx-auto max-w-4xl animate-fade-in px-5 pt-8 [animation-delay:150ms] sm:px-8 sm:pt-11">
			<div className={`${bar} h-4 w-28`} />
			<div className={`${bar} mt-12 h-3 w-36`} />
			<div className={`${bar} mt-5 h-10 w-2/3`} />
			<div className="mt-14 space-y-4 border-t border-espresso/10 pt-10">{[0, 1, 2].map((item) => <div key={item} className="h-11 rounded-xl bg-espresso/[0.05] motion-safe:animate-shimmer" />)}</div>
		</div>
	</main>;
}

const isRecipeType = (candidate: unknown): candidate is RecipeType => typeof candidate === "string" && candidate in categories;

export function RecipeEditor({ initialType, recipeId }: { initialType?: string; recipeId?: string }) {
	const [type, setType] = useState<RecipeType>(isRecipeType(initialType) ? initialType : "meal");
	const { label, icon } = categories[type];
	const router = useRouter();
	const searchParams = useSearchParams();
	const editId = recipeId ?? searchParams.get("edit");
	const formRef = useRef<HTMLFormElement>(null);
	const [description, setDescription] = useState("");
	const [imageData, setImageData] = useState("");
	const [ingredients, setIngredients] = useState<Ingredient[]>([{ name: "", amount: "", unit: "g" }]);
	const [steps, setSteps] = useState([""]);
	const [isWriting, setIsWriting] = useState(false);
	const [isImaging, setIsImaging] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [isLoadingRecipe, setIsLoadingRecipe] = useState(Boolean(editId));
	const [importText, setImportText] = useState("");
	const [isImporting, setIsImporting] = useState(false);
	const [prefillValues, setPrefillValues] = useState<Record<string, unknown> | null>(null);
	// True when the user deliberately picked a category (via "+" in a category or the selector below).
	// The import then keeps this category instead of letting the AI guess.
	const [isTypeChosen, setIsTypeChosen] = useState(isRecipeType(initialType));
	const saveAsDuplicateRef = useRef(false);
	const [error, setError] = useState("");

	function applyRecipe(recipe: Record<string, unknown>) {
		setType(isRecipeType(recipe.recipe_type) ? recipe.recipe_type : "meal");
		setDescription(String(recipe.description ?? "")); setImageData(String(recipe.image_data ?? ""));
		setIngredients(Array.isArray(recipe.ingredients) && recipe.ingredients.length ? recipe.ingredients.map((ingredient) => { const item = ingredient as { name?: string; amount?: number; unit?: string }; return { name: item.name ?? "", amount: String(item.amount ?? ""), unit: item.unit ?? "g" }; }) : [{ name: "", amount: "", unit: "g" }]);
		setSteps(Array.isArray(recipe.instructions) && recipe.instructions.length ? recipe.instructions.map(String) : [""]);
		setPrefillValues({ ...recipe, ...(recipe.details as Record<string, unknown> ?? {}), tags: Array.isArray(recipe.tags) ? recipe.tags.join(", ") : "" });
	}

	useEffect(() => {
		if (!editId) return;
		const controller = new AbortController();
		const token = sessionStorage.getItem("crave_access_token");
		fetch(`${apiUrl}/recipes/${editId}`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
			.then(async (response) => { if (!response.ok) throw new Error("Das Rezept konnte nicht geladen werden."); return response.json(); })
			.then((recipe) => applyRecipe(recipe))
			.catch((caught) => { if ((caught as Error).name !== "AbortError") setError(caught instanceof Error ? caught.message : "Das Rezept konnte nicht geladen werden."); })
			.finally(() => { if (!controller.signal.aborted) setIsLoadingRecipe(false); });
		return () => controller.abort();
	}, [editId]);

	useEffect(() => {
		if (!prefillValues || isLoadingRecipe) return;
		const applyPrefill = window.setTimeout(() => {
			Object.entries(prefillValues).forEach(([name, fieldValue]) => {
				const field = formRef.current?.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null;
				if (!field) return;
				if (field instanceof HTMLInputElement && field.type === "checkbox") field.checked = Boolean(fieldValue);
				else field.value = Array.isArray(fieldValue) ? fieldValue.join(", ") : String(fieldValue ?? "");
			});
		}, 0);
		return () => window.clearTimeout(applyPrefill);
	}, [isLoadingRecipe, prefillValues, type]);

	function recipeIngredients() { return ingredients.filter((item) => item.name.trim()).map((item) => ({ name: item.name.trim(), amount: Number(item.amount || 0), unit: item.unit.trim() })); }
	async function importRecipe() {
		if (importText.trim().length < 20) { setError("Füge bitte einen vollständigen Rezepttext ein."); return; }
		setError(""); setIsImporting(true);
		try {
			const token = sessionStorage.getItem("crave_access_token");
			const response = await fetch(`${apiUrl}/ai/recipe-import`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ source_text: importText, recipe_type: isTypeChosen ? type : null }) });
			const result: { recipe?: Record<string, unknown>; detail?: string } = await response.json().catch(() => ({}));
			if (!response.ok || !result.recipe) throw new Error(result.detail ?? "Der Rezepttext konnte nicht übernommen werden.");
			applyRecipe(result.recipe); setImportText("");
		} catch (caught) { setError(caught instanceof Error ? caught.message : "Der Rezepttext konnte nicht übernommen werden."); }
		finally { setIsImporting(false); }
	}
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
			const shouldOverwrite = Boolean(editId) && !saveAsDuplicateRef.current;
			const response = await fetch(shouldOverwrite ? `${apiUrl}/recipes/${editId}` : `${apiUrl}/recipes`, { method: shouldOverwrite ? "PUT" : "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
			const result: { id?: string; detail?: string } = await response.json().catch(() => ({}));
			if (!response.ok) throw new Error(result.detail ?? "Das Rezept konnte nicht gespeichert werden.");
			router.push(result.id ? `/recipes/${result.id}` : `/recipes?type=${type}`);
		} catch (caught) { setError(caught instanceof Error ? caught.message : "Das Rezept konnte nicht gespeichert werden."); }
		finally { saveAsDuplicateRef.current = false; setIsSaving(false); }
	}

	if (isLoadingRecipe) return <EditorSkeleton />;
	return <main className="flex-1 bg-linen pb-28">
		<form ref={formRef} onSubmit={submit} className="mx-auto max-w-4xl px-5 pt-5 motion-safe:animate-page-in sm:px-8 sm:pt-8">
			<Link href={editId ? `/recipes/${editId}` : `/recipes?type=${type}`} className="-ml-3.5 inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold text-bark transition hover:bg-espresso/[0.05] hover:text-espresso focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-caramel/40"><ArrowLeft size={16} strokeWidth={2.25} aria-hidden="true" />{editId ? "Zum Rezept" : categories[type].label}</Link>

			<header className="mt-8 pb-10 sm:mt-12">
				<p className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.2em] text-caramel">{editId ? "BEARBEITEN" : "NEUES REZEPT"}<span className="h-1 w-1 rounded-full bg-caramel/40" aria-hidden="true" /><span className="inline-flex items-center gap-1">{icon}{label.toUpperCase()}</span></p>
				<h1 className="mt-3 text-[2.5rem] leading-[1.05] font-semibold tracking-[-0.05em] text-espresso sm:text-5xl">{editId ? "Rezept bearbeiten" : "Rezept hinzufügen"}</h1>
				<p className="mt-3 max-w-xl text-sm leading-6 text-bark">{editId ? "Passe Angaben an und speichere sie, oder lege eine Kopie als neue Variante an." : "Fülle die Felder aus oder lass Crave einen vorhandenen Rezepttext übernehmen."}</p>
			</header>

			<Section title="Kategorie" hint="Bestimmt, wo das Rezept in deinem Kochbuch landet.">
				<fieldset>
					<legend className="sr-only">Kategorie wählen</legend>
					<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
						{(Object.keys(categories) as RecipeType[]).map((item) => <label key={item} className="cursor-pointer">
							<input type="radio" name="category_choice" value={item} checked={type === item} onChange={() => { setType(item); setIsTypeChosen(true); }} className="peer sr-only" />
							<span className="flex h-full items-center gap-2 rounded-xl border border-espresso/10 bg-white px-3.5 py-3 text-sm font-medium text-bark transition hover:border-espresso/20 peer-checked:border-caramel peer-checked:bg-caramel/[0.06] peer-checked:text-espresso peer-focus-visible:ring-4 peer-focus-visible:ring-caramel/20">
								<span className="text-caramel">{categories[item].icon}</span>{categories[item].label}
							</span>
						</label>)}
					</div>
				</fieldset>
			</Section>

			{!editId && <Section title="Text übernehmen" hint="Rezept von einer Webseite, Notiz oder aus einem Buch einfügen. Crave füllt das Formular aus.">
				<textarea value={importText} onChange={(event) => setImportText(event.target.value)} placeholder="Titel, Zutaten, Mengen, Zubereitung…" className={`${fieldBase} min-h-36 resize-none leading-6`} aria-label="Rezepttext einfügen" />
				<button type="button" onClick={importRecipe} disabled={isImporting} className={`${darkButton} mt-3 min-w-52`}>{isImporting ? <LoadingIndicator label="Wird übernommen…" light /> : <><Sparkles size={15} strokeWidth={2.25} aria-hidden="true" />Mit KI übernehmen</>}</button>
			</Section>}

			<Section title="Grundlagen">
				<div className="grid gap-5 sm:grid-cols-2">
					<div className="sm:col-span-2"><Field name="title" label="Rezeptname" required placeholder="z. B. Cremige Zitronenpasta" /></div>
					<div className="sm:col-span-2">
						<label htmlFor="recipe-description" className={labelClass}>Beschreibung</label>
						<div className="relative mt-1.5">
							<textarea id="recipe-description" value={description} onChange={(event) => setDescription(event.target.value)} required placeholder="Was macht dieses Rezept besonders?" className={`${fieldBase} min-h-32 resize-none pb-12 leading-6`} />
							<button type="button" onClick={() => generate("description")} disabled={isWriting} className="absolute right-2 bottom-2 inline-flex items-center gap-1.5 rounded-full bg-saffron/35 px-3 py-1.5 text-xs font-semibold text-espresso transition hover:bg-saffron/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-caramel/40 disabled:opacity-60">{isWriting ? <LoadingIndicator label="Schreibt…" /> : <><Sparkles size={13} strokeWidth={2.25} aria-hidden="true" />Mit KI schreiben</>}</button>
						</div>
					</div>
					<Field name="tags" label="Tags" placeholder="z. B. schnell, vegetarisch" />
					<Select name="difficulty" label="Schwierigkeit" defaultValue="easy" values={["easy", "medium", "hard"]} />
					<Field name="servings" label="Portionen" type="number" required defaultValue={2} />
					<Field name="total_time_minutes" label="Gesamtzeit" type="number" required defaultValue={20} suffix="Min" />
					<Check name="is_ai_generated" label="KI-generiert" />
				</div>
			</Section>

			<Section title="Zutaten" hint="Eine Zutat pro Zeile.">
				<div className="mb-1.5 hidden grid-cols-[minmax(0,1fr)_6rem_6rem_2.25rem] gap-2 px-1 text-xs font-medium text-bark/70 sm:grid" aria-hidden="true"><span>Zutat</span><span>Menge</span><span>Einheit</span></div>
				<ul className="space-y-2">{ingredients.map((ingredient, index) => <li key={index} className="grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem_2.25rem] items-start gap-2 sm:grid-cols-[minmax(0,1fr)_6rem_6rem_2.25rem]">
					<textarea value={ingredient.name} onChange={(event) => updateIngredient(index, "name", event.target.value)} required placeholder="Zutat" rows={1} aria-label={`Zutat ${index + 1}`} className={`${fieldBase} min-h-[2.625rem] resize-none`} />
					<input value={ingredient.amount} onChange={(event) => updateIngredient(index, "amount", event.target.value)} required type="number" min="0" step="0.1" inputMode="decimal" placeholder="Menge" aria-label={`Menge für Zutat ${index + 1}`} className={`${fieldBase} px-3 tabular-nums`} />
					<input value={ingredient.unit} onChange={(event) => updateIngredient(index, "unit", event.target.value)} required placeholder="Einheit" aria-label={`Einheit für Zutat ${index + 1}`} className={`${fieldBase} px-3`} />
					<button type="button" onClick={() => removeIngredient(index)} className={removeButton} aria-label={`Zutat ${index + 1} entfernen`}><X size={16} strokeWidth={2.25} aria-hidden="true" /></button>
				</li>)}</ul>
				<button type="button" onClick={() => setIngredients((items) => [...items, { name: "", amount: "", unit: "g" }])} className={`${ghostAdd} -ml-3`}><Plus size={16} strokeWidth={2.5} aria-hidden="true" />Zutat hinzufügen</button>
			</Section>

			<Section title="Zubereitung" hint="Ein Schritt pro Eintrag, kurz und klar.">
				<ol className="space-y-2">{steps.map((step, index) => <li key={index} className="grid grid-cols-[2rem_minmax(0,1fr)_2.25rem] items-start gap-2">
					<span className="pt-3 text-sm font-semibold text-caramel tabular-nums" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
					<textarea value={step} onChange={(event) => updateStep(index, event.target.value)} required placeholder={`Schritt ${index + 1} beschreiben`} rows={1} aria-label={`Schritt ${index + 1}`} className={`${fieldBase} min-h-[2.625rem] resize-none leading-6`} />
					<button type="button" onClick={() => removeStep(index)} className={removeButton} aria-label={`Schritt ${index + 1} entfernen`}><X size={16} strokeWidth={2.25} aria-hidden="true" /></button>
				</li>)}</ol>
				<button type="button" onClick={() => setSteps((items) => [...items, ""])} className={`${ghostAdd} ml-7`}><Plus size={16} strokeWidth={2.5} aria-hidden="true" />Schritt hinzufügen</button>
			</Section>

			<Section title="Nährwerte" hint="Angaben pro Portion.">
				<div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
					<Field name="calories" label="Kalorien" type="number" required defaultValue={0} suffix="kcal" />
					<Field name="protein_g" label="Protein" type="number" step="0.1" required defaultValue={0} suffix="g" />
					<Field name="carbs_g" label="Kohlenhydrate" type="number" step="0.1" required defaultValue={0} suffix="g" />
					<Field name="fat_g" label="Fett" type="number" step="0.1" required defaultValue={0} suffix="g" />
				</div>
			</Section>

			<DetailFields type={type} />

			<Section title="Bild" hint="Crave erstellt ein passendes Foto aus deinen Angaben.">
				<div className="relative aspect-[16/9] overflow-hidden rounded-2xl bg-cream/70">
					{imageData ? <Image src={imageData} alt="KI-Vorschau des Rezepts" fill unoptimized className="animate-fade-in object-cover" /> : <div className="grid h-full place-items-center text-bark/50"><ImagePlus size={28} strokeWidth={1.75} aria-hidden="true" /></div>}
					<button type="button" onClick={() => generate("image")} disabled={isImaging} className={`${darkButton} absolute right-3 bottom-3 min-w-44 shadow-lg`}>{isImaging ? <LoadingIndicator label="Bild entsteht…" light /> : <><Sparkles size={15} strokeWidth={2.25} aria-hidden="true" />{imageData ? "Neu erstellen" : "Bild erstellen"}</>}</button>
				</div>
			</Section>

			{error && <p role="alert" className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{error}</p>}

			{/* Schwebende Aktionsleiste – bleibt beim Scrollen erreichbar */}
			<div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 mt-2 md:bottom-6">
				<div className="flex items-center justify-end gap-2 rounded-full border border-espresso/10 bg-white/85 p-1.5 shadow-[0_16px_40px_-16px_rgba(66,52,33,0.4)] backdrop-blur-md">
					<p className="mr-auto hidden pl-4 text-xs text-bark sm:block">{editId ? "Änderungen werden erst beim Speichern übernommen." : "Alles bereit? Dann speichern."}</p>
					{editId && <button type="submit" onClick={() => { saveAsDuplicateRef.current = true; }} disabled={isSaving} className="inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold text-bark transition hover:bg-espresso/[0.05] hover:text-espresso focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-caramel/40 disabled:opacity-60"><Copy size={15} strokeWidth={2.25} aria-hidden="true" />Als Kopie</button>}
					<button type="submit" onClick={() => { saveAsDuplicateRef.current = false; }} disabled={isSaving} className="inline-flex flex-1 items-center justify-center rounded-full bg-caramel px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-espresso focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-caramel/40 disabled:opacity-60 sm:flex-none">{isSaving ? <LoadingIndicator label="Wird gespeichert…" light /> : editId ? "Änderungen speichern" : "Rezept speichern"}</button>
				</div>
			</div>
		</form>
	</main>;
}

function DetailFields({ type }: { type: RecipeType }) {
	let fields: React.ReactNode;
	if (type === "meal") fields = <><Field name="cooking_method" label="Kochmethode" required /><Field name="required_equipment" label="Benötigte Geräte" placeholder="z. B. Pfanne, Topf" /><Field name="prep_time_minutes" label="Vorbereitung" type="number" required defaultValue={0} suffix="Min" /><Field name="cook_time_minutes" label="Kochzeit" type="number" required defaultValue={0} suffix="Min" /><Field name="fridge_life_days" label="Haltbarkeit im Kühlschrank" type="number" required defaultValue={0} suffix="Tage" /><Select name="spiciness_level" label="Schärfe" defaultValue="1" values={["1", "2", "3", "4", "5"]} /><Select name="volume_index" label="Sättigungsvolumen" defaultValue="medium" values={["low", "medium", "high"]} /><Select name="served_temperature" label="Serviertemperatur" defaultValue="hot" values={["hot", "warm", "cold"]} /><Check name="meal_prep_friendly" label="Für Meal Prep geeignet" /><Check name="freezable" label="Einfrierbar" /></>;
	else if (type === "baking") fields = <><Field name="oven_temperature_c" label="Ofentemperatur (0 = ohne Ofen)" type="number" required defaultValue={180} suffix="°C" /><Select name="oven_mode" label="Ofenmodus" defaultValue="conventional" values={["conventional", "fan", "hot_air"]} /><Field name="pan_type" label="Form" required placeholder="z. B. Springform, Auflaufform" /><Field name="pan_size_cm" label="Formgröße" type="number" step="0.1" required suffix="cm" /><Field name="resting_time_minutes" label="Ruhezeit" type="number" required defaultValue={0} suffix="Min" /><Field name="cooling_time_minutes" label="Abkühlzeit" type="number" required defaultValue={0} suffix="Min" /><Field name="dough_type" label="Teig / Basis" required placeholder="z. B. Rührteig, Löffelbiskuit" /><Field name="special_techniques" label="Besondere Techniken" /><Check name="preheat_required" label="Vorheizen erforderlich" checked /></>;
	else if (type === "drink") fields = <><Select name="prep_method" label="Zubereitungsart" defaultValue="blended" values={["blended", "shaken", "stirred", "brewed", "steeped", "built_in_glass"]} /><Field name="required_equipment" label="Benötigte Geräte" /><Select name="served_temperature" label="Serviertemperatur" defaultValue="iced" values={["hot", "iced", "chilled", "room_temperature"]} /><Select name="ice_type" label="Eis" defaultValue="none" values={["none", "cubes", "crushed"]} /><Field name="abv_percent" label="Alkoholgehalt" type="number" step="0.1" required defaultValue={0} suffix="%" /><Select name="caffeine_level" label="Koffein" defaultValue="none" values={["none", "low", "high"]} /><Field name="glass_type" label="Glasart" required /><Field name="volume_ml" label="Volumen" type="number" required suffix="ml" /></>;
	else fields = <><Field name="yield_amount" label="Gesamtertrag" type="number" step="0.1" required /><Field name="yield_unit" label="Ertragseinheit" required /><Field name="serving_size_amount" label="Portionsmenge" type="number" step="0.1" required /><Field name="serving_size_unit" label="Portionseinheit" required /><Select name="storage_method" label="Aufbewahrung" defaultValue="fridge" values={["fridge", "pantry", "freezer"]} /><Field name="shelf_life_days" label="Haltbarkeit" type="number" required suffix="Tage" /><Field name="component_type" label="Komponentenart" required /><Field name="resting_time_minutes" label="Ruhezeit" type="number" required defaultValue={0} suffix="Min" /><Field name="storage_tips" label="Aufbewahrungshinweise" /><Field name="pairs_well_with" label="Passt gut zu" /></>;
	const hints: Record<RecipeType, string> = { meal: "Mahlzeiten", baking: "Backrezepte und Desserts", drink: "Getränke", basic: "Grundrezepte" };
	return <Section title="Details" hint={`Spezifische Angaben für ${hints[type]}.`}><div className="grid gap-5 sm:grid-cols-2">{fields}</div></Section>;
}
