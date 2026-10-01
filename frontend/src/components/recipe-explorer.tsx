"use client";

import Image from "next/image";
import Link from "next/link";
import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { CakeSlice, Check, ChevronDown, Clock3, CookingPot, CupSoda, LayoutGrid, LucideIcon, Plus, Search, Soup, X } from "lucide-react";

import { ApplianceBadge } from "@/components/appliance-badge";
import { apiUrl } from "@/lib/api";
import { formatDuration } from "@/lib/duration";
import { rememberRecipeFilter } from "@/lib/recipe-filter";

type FilterOption = { type: string; label: string; single: string; icon: LucideIcon };

const allOption: FilterOption = { type: "all", label: "Alle Rezepte", single: "Rezept", icon: LayoutGrid };
const categories: FilterOption[] = [
    { type: "meal", label: "Mahlzeiten", single: "Mahlzeit", icon: Soup },
    { type: "baking", label: "Backen & Desserts", single: "Backen & Dessert", icon: CakeSlice },
    { type: "drink", label: "Getränke", single: "Getränk", icon: CupSoda },
    { type: "basic", label: "Grundrezepte", single: "Grundrezept", icon: CookingPot },
];
const options = [allOption, ...categories];

type Recipe = {
    id: string;
    title: string;
    description: string;
    recipe_type: string;
    difficulty: string;
    total_time_minutes: number;
    calories: number;
    protein_g: number;
    tags: string[];
    image_data: string | null;
    appliance?: string;
};

const difficultyLabels: Record<string, string> = { easy: "Einfach", medium: "Mittel", hard: "Anspruchsvoll", einfach: "Einfach", mittel: "Mittel", schwer: "Anspruchsvoll" };
const gradients = ["from-saffron via-caramel to-espresso", "from-cream via-saffron to-caramel", "from-caramel via-bark to-espresso", "from-cream via-saffron to-bark"];
// Deutsche Sortierung: Umlaute korrekt, Groß-/Kleinschreibung egal, Zahlen natürlich.
const collator = new Intl.Collator("de", { sensitivity: "base", numeric: true });
const categoryFor = (type: string) => categories.find((item) => item.type === type) ?? allOption;

function RecipeCard({ recipe, index, showCategory }: { recipe: Recipe; index: number; showCategory: boolean }) {
    const category = categoryFor(recipe.recipe_type);
    const Icon = category.icon;
    return <Link href={`/recipes/${recipe.id}`} className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-caramel/50 focus-visible:ring-offset-4 focus-visible:ring-offset-linen">
        <div className={`relative aspect-[4/5] overflow-hidden rounded-2xl bg-gradient-to-br ${gradients[index % gradients.length]}`}>
            {recipe.image_data
                ? <Image src={recipe.image_data} alt="" fill unoptimized sizes="(min-width: 1024px) 33vw, 50vw" className="object-cover transition duration-700 ease-out group-hover:scale-[1.04]" />
                : <div className="grid h-full place-items-center text-white/70"><Icon size={36} strokeWidth={1.5} aria-hidden="true" /></div>}
            <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-espresso shadow-sm backdrop-blur">
                <Clock3 size={12} strokeWidth={2.5} aria-hidden="true" />{formatDuration(recipe.total_time_minutes)}
            </span>
            <ApplianceBadge appliance={recipe.appliance} size="sm" className="absolute bottom-2.5 left-2.5" />
        </div>
        {showCategory && <p className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-caramel"><Icon size={12} strokeWidth={2.25} aria-hidden="true" />{category.single}</p>}
        <h2 className={`${showCategory ? "mt-1" : "mt-3"} line-clamp-2 text-[15px] leading-snug font-semibold tracking-[-0.02em] text-espresso transition group-hover:text-caramel`}>{recipe.title}</h2>
        <p className="mt-1 text-xs text-bark">{difficultyLabels[recipe.difficulty] ?? recipe.difficulty} · {recipe.calories} kcal</p>
    </Link>;
}

function CategoryFilter({ value, counts, onChange }: { value: FilterOption; counts: Record<string, number>; onChange: (option: FilterOption) => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
    const isFiltered = value.type !== allOption.type;
    const TriggerIcon = value.icon;

    function close(returnFocus = true) {
        setIsOpen(false);
        if (returnFocus) triggerRef.current?.focus();
    }

    // Beim Öffnen die aktive Option fokussieren; Klick außerhalb schließt das Menü.
    useEffect(() => {
        if (!isOpen) return;
        optionRefs.current[options.findIndex((option) => option.type === value.type)]?.focus();
        const onPointerDown = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false); };
        document.addEventListener("pointerdown", onPointerDown);
        return () => document.removeEventListener("pointerdown", onPointerDown);
    }, [isOpen, value.type]);

    function onListKeyDown(event: KeyboardEvent<HTMLDivElement>) {
        const current = optionRefs.current.findIndex((element) => element === document.activeElement);
        const focusAt = (index: number) => optionRefs.current[(index + options.length) % options.length]?.focus();
        if (event.key === "ArrowDown") { event.preventDefault(); focusAt(current + 1); }
        else if (event.key === "ArrowUp") { event.preventDefault(); focusAt(current - 1); }
        else if (event.key === "Home") { event.preventDefault(); focusAt(0); }
        else if (event.key === "End") { event.preventDefault(); focusAt(options.length - 1); }
        else if (event.key === "Escape") { event.preventDefault(); close(); }
        else if (event.key === "Tab") setIsOpen(false);
    }

    return <div ref={rootRef} className="relative shrink-0">
        <button ref={triggerRef} type="button" onClick={() => setIsOpen((open) => !open)} onKeyDown={(event) => { if (event.key === "ArrowDown") { event.preventDefault(); setIsOpen(true); } }}
            aria-haspopup="listbox" aria-expanded={isOpen} aria-label={`Kategorie filtern, aktuell: ${value.label}`}
            className={`inline-flex h-12 items-center gap-2 rounded-full border px-4 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-caramel/15 ${isFiltered ? "border-caramel/40 bg-caramel/[0.08] text-espresso" : "border-espresso/10 bg-white text-bark hover:border-espresso/20 hover:text-espresso"}`}>
            <TriggerIcon size={17} strokeWidth={2} className={isFiltered ? "text-caramel" : ""} aria-hidden="true" />
            <span className="hidden max-w-40 truncate sm:inline">{isFiltered ? value.label : "Alle"}</span>
            <ChevronDown size={16} strokeWidth={2.25} className={`text-bark/60 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>

        {isOpen && <div role="listbox" aria-label="Kategorie" onKeyDown={onListKeyDown}
            className="absolute top-full right-0 z-40 mt-2 w-[min(18rem,calc(100vw-2.5rem))] origin-top-right animate-menu-in rounded-2xl bg-white p-1.5 shadow-[0_20px_50px_-12px_rgba(66,52,33,0.3)] ring-1 ring-espresso/[0.08]">
            <p className="px-3 pt-2 pb-1.5 text-[11px] font-semibold tracking-[0.14em] text-bark/60">KATEGORIE</p>
            {options.map((option, index) => {
                const isActive = option.type === value.type;
                const Icon = option.icon;
                return <div key={option.type}>
                    {index === 1 && <div className="mx-3 my-1 h-px bg-espresso/[0.07]" aria-hidden="true" />}
                    <button ref={(element) => { optionRefs.current[index] = element; }} type="button" role="option" aria-selected={isActive}
                        onClick={() => { onChange(option); close(); }}
                        className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm transition outline-none focus-visible:bg-linen ${isActive ? "text-espresso" : "text-bark hover:bg-linen hover:text-espresso"}`}>
                        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl transition ${isActive ? "bg-caramel text-white" : "bg-cream/80 text-caramel"}`}><Icon size={17} strokeWidth={2} aria-hidden="true" /></span>
                        <span className={`flex-1 ${isActive ? "font-semibold" : "font-medium"}`}>{option.label}</span>
                        <span className="text-xs text-bark/60 tabular-nums">{counts[option.type] ?? 0}</span>
                        <Check size={16} strokeWidth={2.5} className={`text-caramel ${isActive ? "opacity-100" : "opacity-0"}`} aria-hidden="true" />
                    </button>
                </div>;
            })}
        </div>}
    </div>;
}

function GridSkeleton() {
    return <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-3 lg:gap-x-6" aria-busy="true" aria-label="Rezepte werden geladen">
        {[0, 1, 2, 3, 4, 5].map((item) => <div key={item} className="animate-fade-in [animation-delay:150ms]">
            <div className="aspect-[4/5] rounded-2xl bg-espresso/[0.06] motion-safe:animate-shimmer" />
            <div className="mt-3 h-3.5 w-3/4 rounded-full bg-espresso/[0.06] motion-safe:animate-shimmer" />
            <div className="mt-2 h-3 w-1/3 rounded-full bg-espresso/[0.05] motion-safe:animate-shimmer" />
        </div>)}
    </div>;
}

export function RecipeExplorer({ initialType }: { initialType?: string }) {
    const [filter, setFilter] = useState<FilterOption>(categories.find((item) => item.type === initialType) ?? allOption);
    const [search, setSearch] = useState("");
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");
    const query = search.trim();
    const isAll = filter.type === allOption.type;

    // Alle Rezepte werden einmal geladen; Kategorie-Wechsel filtert sofort im Browser.
    const counts = useMemo(() => {
        const result: Record<string, number> = { [allOption.type]: recipes.length };
        for (const recipe of recipes) result[recipe.recipe_type] = (result[recipe.recipe_type] ?? 0) + 1;
        return result;
    }, [recipes]);
    const visible = useMemo(() => recipes
        .filter((recipe) => isAll || recipe.recipe_type === filter.type)
        .sort((a, b) => collator.compare(a.title, b.title)), [recipes, filter.type, isAll]);

    // Sync the remembered filter with what the page actually shows (e.g. after opening /recipes via the nav).
    useEffect(() => { rememberRecipeFilter(isAll ? null : filter.type); }, [filter.type, isAll]);

    function selectFilter(option: FilterOption) {
        setFilter(option);
        window.history.replaceState(null, "", option.type === allOption.type ? "/recipes" : `/recipes?type=${option.type}`);
    }

    useEffect(() => {
        const controller = new AbortController();
        const timer = window.setTimeout(async () => {
            const token = sessionStorage.getItem("crave_access_token");
            if (!token) return;
            setIsLoading(true);
            setError("");
            try {
                const params = query ? `?${new URLSearchParams({ search: query })}` : "";
                const response = await fetch(`${apiUrl}/recipes${params}`, {
                    headers: { Authorization: `Bearer ${token}` },
                    signal: controller.signal,
                });
                if (!response.ok) throw new Error("Rezepte konnten nicht geladen werden.");
                setRecipes(await response.json());
            } catch (caughtError) {
                if ((caughtError as Error).name !== "AbortError") {
                    setError(caughtError instanceof Error ? caughtError.message : "Rezepte konnten nicht geladen werden.");
                }
            } finally {
                if (!controller.signal.aborted) setIsLoading(false);
            }
        }, query ? 220 : 0);

        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [query]);

    const EmptyIcon = filter.icon;
    const newRecipeHref = isAll ? "/recipes/new" : `/recipes/new?type=${filter.type}`;

    return (
        <section className="min-h-[calc(100vh-4rem)] bg-linen pb-32">
            <div className="mx-auto max-w-6xl px-5 pt-8 motion-safe:animate-page-in sm:px-8 sm:pt-12">
                <header className="flex items-end justify-between gap-4">
                    <div>
                        <p className="text-[11px] font-semibold tracking-[0.2em] text-caramel">DEIN KOCHBUCH</p>
                        <h1 className="mt-2 text-[2.5rem] leading-none font-semibold tracking-[-0.05em] text-espresso sm:text-5xl">Rezepte</h1>
                    </div>
                    <Link href={newRecipeHref} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-caramel px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(153,97,48,0.6)] transition hover:bg-espresso focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-caramel/40 focus-visible:ring-offset-2 focus-visible:ring-offset-linen" aria-label={isAll ? "Neues Rezept" : `Neues Rezept in ${filter.label}`}>
                        <Plus size={17} strokeWidth={2.5} aria-hidden="true" /><span className="hidden sm:inline">Neues Rezept</span><span className="sm:hidden">Neu</span>
                    </Link>
                </header>

                <div className="sticky top-16 z-30 -mx-5 mt-6 flex items-center gap-2 bg-linen/90 px-5 py-3 backdrop-blur-md sm:-mx-8 sm:px-8">
                    <label className="relative block min-w-0 flex-1">
                        <span className="sr-only">Rezepte durchsuchen</span>
                        <Search size={18} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-bark/60" strokeWidth={2.25} aria-hidden="true" />
                        <input value={search} onChange={(event) => setSearch(event.target.value)} className="h-12 w-full rounded-full border border-espresso/10 bg-white pr-11 pl-11 text-sm text-espresso outline-none transition placeholder:text-bark/50 hover:border-espresso/20 focus:border-caramel/60 focus:ring-4 focus:ring-caramel/10" placeholder="Titel, Zutaten oder Tags suchen" />
                        {search && <button type="button" onClick={() => setSearch("")} className="absolute top-1/2 right-2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-bark/60 transition hover:bg-espresso/[0.05] hover:text-espresso" aria-label="Suche leeren"><X size={16} strokeWidth={2.25} aria-hidden="true" /></button>}
                    </label>
                    <CategoryFilter value={filter} counts={counts} onChange={selectFilter} />
                </div>

                {error && <p role="alert" className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{error}</p>}

                {isLoading ? <GridSkeleton /> : visible.length === 0 ? (
                    <div className="mx-auto mt-20 max-w-sm text-center motion-safe:animate-page-in">
                        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-cream text-caramel"><EmptyIcon size={26} strokeWidth={1.75} aria-hidden="true" /></span>
                        <h2 className="mt-5 text-xl font-semibold tracking-[-0.03em] text-espresso">{query ? "Nichts gefunden" : isAll ? "Noch keine Rezepte" : `Noch keine ${filter.label}`}</h2>
                        <p className="mt-2 text-sm leading-6 text-bark">{query ? `Für „${query}“ gibt es ${isAll ? "" : `in ${filter.label} `}noch kein Rezept.` : "Lege dein erstes Rezept an, dann erscheint es hier."}</p>
                        {!query && <Link href={newRecipeHref} className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-caramel px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-espresso"><Plus size={16} strokeWidth={2.5} aria-hidden="true" />Rezept hinzufügen</Link>}
                        {!isAll && <button type="button" onClick={() => selectFilter(allOption)} className="mt-3 block w-full text-sm font-semibold text-caramel hover:text-espresso">Alle Rezepte zeigen</button>}
                    </div>
                ) : (
                    <div key={`${filter.type}-${query}`} className="mt-2 motion-safe:animate-page-in">
                        <p className="text-xs font-medium text-bark/80" aria-live="polite">
                            {visible.length} {visible.length === 1 ? "Rezept" : "Rezepte"}{!isAll && ` in ${filter.label}`}{query && ` für „${query}“`} · A–Z
                        </p>
                        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-3 lg:gap-x-6">
                            {visible.map((recipe, index) => <RecipeCard key={recipe.id} recipe={recipe} index={index} showCategory={isAll} />)}
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}
