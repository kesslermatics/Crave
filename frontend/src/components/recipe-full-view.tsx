"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, BookmarkPlus, Clock3, Flame, Gauge, Minus, Pencil, Plus, RotateCcw, Share2, ShoppingBasket, Trash2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";

import { ApplianceBadge } from "@/components/appliance-badge";
import { LoadingIndicator } from "@/components/loading-indicator";
import { RecipeChat } from "@/components/recipe-chat";
import { Toast, toastActionClass, useToast } from "@/components/toast";
import { formatQuantity } from "@/lib/amount";
import { apiUrl } from "@/lib/api";
import { addShoppingItems, guessSection, parseShoppingInput, shareText, shoppingListText, syncShoppingList, type ShoppingDraft } from "@/lib/shopping-list";
import { formatDuration } from "@/lib/duration";
import { recipeListHref } from "@/lib/recipe-filter";

type Ingredient = { name: string; amount: number; unit: string };
type Recipe = {
    id?: string; title: string; description: string; image_data: string | null;
    servings: number; total_time_minutes: number; difficulty: string;
    calories: number; protein_g: number; carbs_g: number; fat_g: number;
    ingredients: Ingredient[]; instructions: string[]; details: Record<string, unknown>;
    tags: string[]; recipe_type: string; is_ai_generated: boolean; appliance?: string;
};

const labels: Record<string, string> = {
    easy: "Einfach", medium: "Mittel", hard: "Anspruchsvoll",
    cooking_method: "Zubereitungsart", prep_time_minutes: "Vorbereitung", cook_time_minutes: "Kochzeit",
    meal_prep_friendly: "Meal Prep", fridge_life_days: "Haltbarkeit", freezable: "Einfrierbar",
    spiciness_level: "Schärfe", volume_index: "Sättigung", served_temperature: "Serviert",
    oven_temperature_c: "Ofentemperatur", oven_mode: "Ofenmodus", storage_method: "Aufbewahrung",
};

const pillGhost = "inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold text-bark transition hover:bg-espresso/[0.05] hover:text-espresso focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-caramel/40";
const pillPrimary = "inline-flex items-center justify-center gap-2 rounded-full bg-caramel px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(153,97,48,0.6)] transition hover:bg-espresso focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-caramel/40 focus-visible:ring-offset-2 focus-visible:ring-offset-linen disabled:opacity-60";

function displayValue(key: string, value: unknown) {
    if (typeof value === "boolean") return value ? "Ja" : "Nein";
    if (Array.isArray(value)) return value.join(", ");
    if (key.endsWith("_minutes")) return formatDuration(Number(value));
    if (key.endsWith("_days")) return `${value} Tage`;
    return labels[String(value)] ?? String(value);
}

function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
    return <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-xl font-semibold tracking-[-0.03em] text-espresso sm:text-2xl">{children}</h2>
        {aside && <span className="text-xs font-medium text-bark/80">{aside}</span>}
    </div>;
}

function RecipeHero({ recipe, proposal, servings }: { recipe: Recipe; proposal: boolean; servings: number }) {
    const meta = [
        { icon: Clock3, label: "Zeit", value: formatDuration(recipe.total_time_minutes) },
        { icon: Users, label: "Portionen", value: String(servings) },
        { icon: Gauge, label: "Niveau", value: labels[recipe.difficulty] ?? recipe.difficulty },
        { icon: Flame, label: "Pro Portion", value: `${recipe.calories} kcal` },
    ];
    return <header className="mt-8 sm:mt-12">
        <div className="flex flex-wrap items-center gap-3">
            <p className="text-[11px] font-semibold tracking-[0.2em] text-caramel">{proposal ? "DEIN VORSCHLAG" : "DEIN REZEPT"}</p>
            <ApplianceBadge appliance={recipe.appliance} />
        </div>
        <h1 className="mt-3 max-w-3xl text-[2.5rem] leading-[1.05] font-semibold tracking-[-0.05em] text-balance text-espresso sm:text-6xl">{recipe.title}</h1>
        {recipe.description && <p className="mt-5 max-w-2xl text-base leading-7 text-pretty text-bark sm:text-lg sm:leading-8">{recipe.description}</p>}

        <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-espresso/10 pt-6 sm:flex sm:flex-wrap sm:gap-x-12">
            {meta.map(({ icon: Icon, label, value }) => <div key={label} className="flex items-center gap-3">
                <Icon size={18} strokeWidth={2} className="shrink-0 text-caramel" aria-hidden="true" />
                <div>
                    <dt className="text-[11px] font-medium tracking-wide text-bark/75">{label}</dt>
                    <dd className="text-sm font-semibold text-espresso">{value}</dd>
                </div>
            </div>)}
        </dl>

        {recipe.tags.length > 0 && <ul className="mt-6 flex flex-wrap gap-2" aria-label="Tags">
            {recipe.tags.map((tag) => <li key={tag} className="rounded-full bg-cream/80 px-3 py-1 text-xs font-medium text-bark">#{tag}</li>)}
        </ul>}

        {recipe.image_data && <div className="relative mt-10 aspect-[4/3] overflow-hidden rounded-3xl bg-cream sm:aspect-[16/9]">
            <Image src={recipe.image_data} alt={recipe.title} fill unoptimized loading="eager" fetchPriority="high" className="animate-fade-in object-cover" />
        </div>}
    </header>;
}

const MAX_SERVINGS = 100;
const stepButton = "grid h-8 w-8 place-items-center rounded-full text-espresso transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-caramel/40 disabled:opacity-35 disabled:hover:bg-transparent";

/** + / – Schalter für die Portionenzahl. */
function ServingStepper({ servings, original, onChange }: { servings: number; original: number; onChange: (value: number) => void }) {
    return <div className="mt-4 flex items-center justify-between gap-3">
        <div className="inline-flex items-center rounded-full bg-cream/70 p-1" role="group" aria-label="Portionen anpassen">
            <button type="button" onClick={() => onChange(servings - 1)} disabled={servings <= 1} className={stepButton} aria-label="Eine Portion weniger"><Minus size={15} strokeWidth={2.5} aria-hidden="true" /></button>
            <output className="min-w-24 text-center text-sm font-semibold text-espresso tabular-nums" aria-live="polite">{servings} {servings === 1 ? "Portion" : "Portionen"}</output>
            <button type="button" onClick={() => onChange(servings + 1)} disabled={servings >= MAX_SERVINGS} className={stepButton} aria-label="Eine Portion mehr"><Plus size={15} strokeWidth={2.5} aria-hidden="true" /></button>
        </div>
        {servings !== original && <button type="button" onClick={() => onChange(original)} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-medium text-bark transition hover:bg-espresso/[0.05] hover:text-espresso">
            <RotateCcw size={12} strokeWidth={2.25} aria-hidden="true" />Original ({original})
        </button>}
    </div>;
}

function RecipeBody({ recipe, servings, onServingsChange, ingredients, shoppingActions }: { recipe: Recipe; servings: number; onServingsChange: (value: number) => void; ingredients: Ingredient[]; shoppingActions: ReactNode }) {
    const [nutritionMode, setNutritionMode] = useState<"total" | "portion">("total");
    const details = Object.entries(recipe.details)
        .filter(([key]) => key !== "required_equipment")
        .map(([key, value]) => [key, displayValue(key, value)] as const)
        .filter(([, value]) => value !== "");
    // Nährwerte sind pro Portion gespeichert; „Gesamt“ rechnet sie auf die gewählte Portionenzahl hoch.
    const multiplier = nutritionMode === "total" ? servings : 1;
    const nutrition = [
        { label: "Kalorien", value: Math.round(recipe.calories * multiplier), unit: "kcal" },
        { label: "Protein", value: Math.round(recipe.protein_g * multiplier), unit: "g" },
        { label: "Kohlenhydrate", value: Math.round(recipe.carbs_g * multiplier), unit: "g" },
        { label: "Fett", value: Math.round(recipe.fat_g * multiplier), unit: "g" },
    ];
    const modeButton = (mode: "total" | "portion", label: string) => <button type="button" onClick={() => setNutritionMode(mode)} aria-pressed={nutritionMode === mode} className={`rounded-full px-3 py-1 text-xs font-medium transition ${nutritionMode === mode ? "bg-white text-espresso shadow-sm" : "text-bark hover:text-espresso"}`}>{label}</button>;

    return <div className="mt-12 grid gap-14 sm:mt-16 lg:grid-cols-[19rem_minmax(0,1fr)] lg:gap-16">
        <aside className="space-y-12 lg:sticky lg:top-24 lg:self-start">
            <section>
                <SectionTitle>Zutaten</SectionTitle>
                <ServingStepper servings={servings} original={recipe.servings} onChange={onServingsChange} />
                <ul className="mt-4">
                    {ingredients.map((ingredient, index) => <li key={`${ingredient.name}-${index}`} className="flex items-baseline justify-between gap-4 border-b border-espresso/[0.07] py-3 text-[15px] last:border-0">
                        <span className="text-espresso">{ingredient.name}</span>
                        <span className="shrink-0 text-sm font-medium text-bark tabular-nums">{formatQuantity(ingredient.amount, ingredient.unit)}</span>
                    </li>)}
                </ul>
                {shoppingActions}
            </section>

            <section>
                <div className="flex items-center justify-between gap-4">
                    <h2 className="text-xl font-semibold tracking-[-0.03em] text-espresso sm:text-2xl">Nährwerte</h2>
                    <div className="inline-flex rounded-full bg-cream/70 p-0.5" role="group" aria-label="Nährwerte anzeigen">{modeButton("total", `Gesamt (${servings})`)}{modeButton("portion", "Pro Portion")}</div>
                </div>
                <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5">
                    {nutrition.map((item) => <div key={item.label}>
                        <dt className="text-xs text-bark/80">{item.label}</dt>
                        <dd className="mt-0.5 text-lg font-semibold tracking-[-0.02em] text-espresso tabular-nums">{new Intl.NumberFormat("de-DE").format(item.value)}<span className="ml-1 text-sm font-medium text-bark">{item.unit}</span></dd>
                    </div>)}
                </dl>
            </section>
        </aside>

        <div className="space-y-14">
            <section>
                <SectionTitle aside={`${recipe.instructions.length} Schritte`}>Zubereitung</SectionTitle>
                <ol className="mt-5">
                    {recipe.instructions.map((instruction, index) => <li key={`${instruction}-${index}`} className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-3 border-t border-espresso/[0.07] py-5 first:border-0 first:pt-2">
                        <span className="pt-0.5 text-sm font-semibold text-caramel tabular-nums" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                        <p className="text-[15px] leading-7 text-espresso/90">{instruction}</p>
                    </li>)}
                </ol>
            </section>

            {details.length > 0 && <section>
                <SectionTitle>Eigenschaften</SectionTitle>
                <dl className="mt-5 grid gap-x-10 sm:grid-cols-2">
                    {details.map(([key, value]) => <div key={key} className="flex items-baseline justify-between gap-4 border-b border-espresso/[0.07] py-3 text-sm">
                        <dt className="text-bark">{labels[key] ?? key.replaceAll("_", " ")}</dt>
                        <dd className="text-right font-medium text-espresso">{value}</dd>
                    </div>)}
                </dl>
            </section>}
        </div>
    </div>;
}

function FullView({ recipe, proposal, children }: { recipe: Recipe; proposal: boolean; children?: ReactNode }) {
    const router = useRouter();
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState("");
    async function save() { setIsSaving(true); setError(""); try { const token = sessionStorage.getItem("crave_access_token"); const response = await fetch(`${apiUrl}/recipes`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(recipe) }); const result: { id?: string; detail?: string } = await response.json().catch(() => ({})); if (!response.ok || !result.id) throw new Error(result.detail ?? "Das Rezept konnte nicht gespeichert werden."); sessionStorage.removeItem("crave_selected_suggestion"); router.replace(`/recipes/${result.id}`); } catch (caught) { setError(caught instanceof Error ? caught.message : "Das Rezept konnte nicht gespeichert werden."); } finally { setIsSaving(false); } }

    const saveButton = (className = "") => <button onClick={save} disabled={isSaving} className={`${pillPrimary} ${className}`}>
        {isSaving ? <LoadingIndicator label="Wird gespeichert…" light /> : <><BookmarkPlus size={16} strokeWidth={2.25} aria-hidden="true" />In meine Rezepte</>}
    </button>;

    // Portionen skalieren: alle Mengen rechnen sich relativ zur Originalportionenzahl um.
    const originalServings = Math.max(1, recipe.servings || 1);
    const [servings, setServings] = useState(originalServings);
    const factor = servings / originalServings;
    const scaledIngredients = recipe.ingredients.map((ingredient) => ({ ...ingredient, amount: ingredient.amount * factor }));
    const changeServings = (value: number) => setServings(Math.min(MAX_SERVINGS, Math.max(1, value)));

    const { toast, show: showToast } = useToast();
    const [isAddingToList, setIsAddingToList] = useState(false);
    const listSource = servings === originalServings ? recipe.title : `${recipe.title} (${servings} P.)`;

    async function addToShoppingList() {
        setIsAddingToList(true);
        const ingredients = scaledIngredients.map((item) => ({ name: item.name, amount: item.amount > 0 ? Math.round(item.amount * 100) / 100 : null, unit: item.unit }));
        let offline = false;
        let drafts: ShoppingDraft[];
        try {
            // KI vereinheitlicht Namen („Zwiebel, gewürfelt“ → „Zwiebeln“) und ordnet Abteilungen zu.
            // Parallel den aktuellen Listenstand holen, damit gleiche Zutaten mit bestehenden Einträgen zusammengefasst werden.
            [drafts] = await Promise.all([parseShoppingInput({ ingredients }), syncShoppingList().catch(() => undefined)]);
        } catch {
            offline = true;
            drafts = ingredients;
        }
        const { added, merged } = addShoppingItems(drafts, listSource);
        setIsAddingToList(false);
        const count = added + merged;
        showToast(`${count} ${count === 1 ? "Zutat" : "Zutaten"} auf der Liste${merged ? ` · ${merged} zusammengefasst` : ""}${offline ? " (ohne KI sortiert)" : ""}`, <Link href="/einkaufsliste" className={toastActionClass}>Ansehen</Link>);
    }

    async function exportIngredients() {
        const items = scaledIngredients.map((item) => ({ name: item.name, amount: item.amount > 0 ? item.amount : null, unit: item.unit, section: guessSection(item.name) }));
        try {
            const result = await shareText(shoppingListText(items, `Einkaufsliste: ${recipe.title} (${servings} ${servings === 1 ? "Portion" : "Portionen"})`), recipe.title);
            if (result === "copied") showToast("Zutatenliste in die Zwischenablage kopiert");
        } catch {
            showToast("Exportieren hat nicht geklappt");
        }
    }

    const shoppingActions = <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" onClick={addToShoppingList} disabled={isAddingToList} className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-full bg-espresso px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-caramel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-caramel/40 disabled:opacity-80">
            {isAddingToList ? <LoadingIndicator label="Wird hinzugefügt…" light /> : <><ShoppingBasket size={16} strokeWidth={2.25} aria-hidden="true" />Zur Einkaufsliste</>}
        </button>
        <button type="button" onClick={exportIngredients} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-bark ring-1 ring-espresso/10 transition hover:bg-white hover:text-espresso focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-caramel/40" aria-label="Zutatenliste exportieren oder teilen">
            <Share2 size={16} strokeWidth={2.25} aria-hidden="true" />Exportieren
        </button>
    </div>;

    return <main className="flex-1 bg-linen pb-32">
        <article className="mx-auto max-w-5xl px-5 pt-5 motion-safe:animate-page-in sm:px-8 sm:pt-8">
            <div className="-mx-3.5 flex items-center justify-between gap-3">
                <Link href={proposal ? "/" : recipeListHref()} className={pillGhost}><ArrowLeft size={16} strokeWidth={2.25} aria-hidden="true" />{proposal ? "Vorschläge" : "Rezepte"}</Link>
                {proposal ? saveButton("hidden sm:inline-flex") : <Link href={`/recipes/${recipe.id}/edit`} className={pillGhost}><Pencil size={15} strokeWidth={2.25} aria-hidden="true" />Bearbeiten</Link>}
            </div>

            <RecipeHero recipe={recipe} proposal={proposal} servings={servings} />
            <RecipeBody recipe={recipe} servings={servings} onServingsChange={changeServings} ingredients={scaledIngredients} shoppingActions={shoppingActions} />

            {error && <p role="alert" className="mt-10 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{error}</p>}
            {proposal && <div className="mt-14 flex justify-center">{saveButton("w-full py-3.5 sm:w-auto sm:px-8")}</div>}

            {children}
        </article>
        <Toast toast={toast} />
    </main>;
}

function RecipeSkeleton() {
    const bar = "rounded-full bg-espresso/[0.06] motion-safe:animate-shimmer";
    return <main className="flex-1 bg-linen pb-32" aria-busy="true" aria-label="Rezept wird geladen">
        <div className="mx-auto max-w-5xl animate-fade-in px-5 pt-8 [animation-delay:150ms] sm:px-8 sm:pt-11">
            <div className={`${bar} h-4 w-24`} />
            <div className={`${bar} mt-12 h-3 w-28`} />
            <div className={`${bar} mt-5 h-10 w-4/5 sm:h-14`} />
            <div className={`${bar} mt-6 h-4 w-3/5`} />
            <div className="mt-10 flex gap-10 border-t border-espresso/10 pt-6">{[0, 1, 2, 3].map((item) => <div key={item} className={`${bar} h-8 w-20`} />)}</div>
            <div className="mt-10 aspect-[16/9] rounded-3xl bg-espresso/[0.05] motion-safe:animate-shimmer" />
        </div>
    </main>;
}

function Notice({ children, action }: { children: ReactNode; action?: ReactNode }) {
    return <main className="grid flex-1 place-items-center bg-linen px-5 pb-32 text-center">
        <div className="motion-safe:animate-page-in"><p className="text-sm text-bark">{children}</p>{action}</div>
    </main>;
}

export function SuggestionDetail() {
    const [recipe, setRecipe] = useState<Recipe | null>(null);
    const [isRestoring, setIsRestoring] = useState(true);
    useEffect(() => { const restore = window.setTimeout(() => { const stored = sessionStorage.getItem("crave_selected_suggestion"); if (stored) setRecipe(JSON.parse(stored)); setIsRestoring(false); }, 0); return () => window.clearTimeout(restore); }, []);
    if (isRestoring) return <RecipeSkeleton />;
    if (!recipe) return <Notice action={<Link href="/" className="mt-4 inline-block text-sm font-semibold text-caramel hover:text-espresso">Neue Ideen finden</Link>}>Dieser Vorschlag ist nicht mehr verfügbar.</Notice>;
    return <FullView recipe={recipe} proposal><RecipeChat recipe={recipe} /></FullView>;
}

function DeleteRecipeButton({ recipeId }: { recipeId: string }) {
    const router = useRouter();
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState("");
    async function remove() { if (!window.confirm("Dieses Rezept wirklich dauerhaft löschen?")) return; setError(""); setIsDeleting(true); try { const token = sessionStorage.getItem("crave_access_token"); const response = await fetch(`${apiUrl}/recipes/${recipeId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }); if (!response.ok) { const result: { detail?: string } = await response.json().catch(() => ({})); throw new Error(result.detail ?? "Das Rezept konnte nicht gelöscht werden."); } router.replace(recipeListHref()); } catch (caught) { setError(caught instanceof Error ? caught.message : "Das Rezept konnte nicht gelöscht werden."); } finally { setIsDeleting(false); } }
    return <div className="mt-16 flex flex-col items-center gap-2">
        <button onClick={remove} disabled={isDeleting} className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-bark/70 transition hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:opacity-60">
            <Trash2 size={15} strokeWidth={2} aria-hidden="true" />{isDeleting ? "Wird gelöscht…" : "Rezept löschen"}
        </button>
        {error && <p role="alert" className="text-sm font-medium text-red-700">{error}</p>}
    </div>;
}

export function StoredRecipeDetail({ recipeId }: { recipeId: string }) {
    const [recipe, setRecipe] = useState<Recipe | null>(null);
    const [error, setError] = useState("");
    useEffect(() => { const token = sessionStorage.getItem("crave_access_token"); fetch(`${apiUrl}/recipes/${recipeId}`, { headers: { Authorization: `Bearer ${token}` } }).then(async (response) => { if (!response.ok) throw new Error("Das Rezept konnte nicht geladen werden."); return response.json(); }).then(setRecipe).catch((caught) => setError(caught instanceof Error ? caught.message : "Das Rezept konnte nicht geladen werden.")); }, [recipeId]);
    if (error) return <Notice action={<Link href="/recipes" className="mt-4 inline-block text-sm font-semibold text-caramel hover:text-espresso">Zu deinen Rezepten</Link>}><span className="text-red-800">{error}</span></Notice>;
    if (!recipe) return <RecipeSkeleton />;
    return <FullView recipe={recipe} proposal={false}><RecipeChat recipe={recipe} /><DeleteRecipeButton recipeId={recipeId} /></FullView>;
}
