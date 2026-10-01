"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CakeSlice, Clock3, CookingPot, CupSoda, Plus, Search, Soup, X } from "lucide-react";

import { apiUrl } from "@/lib/api";
import { formatDuration } from "@/lib/duration";

const categories = [
    { type: "meal", label: "Mahlzeiten", icon: Soup },
    { type: "baking", label: "Backen & Desserts", icon: CakeSlice },
    { type: "drink", label: "Getränke", icon: CupSoda },
    { type: "basic", label: "Grundrezepte", icon: CookingPot },
] as const;

type Category = (typeof categories)[number];
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
};

const difficultyLabels: Record<string, string> = { easy: "Einfach", medium: "Mittel", hard: "Anspruchsvoll", einfach: "Einfach", mittel: "Mittel", schwer: "Anspruchsvoll" };

const gradients = [
    "from-saffron via-caramel to-espresso",
    "from-cream via-saffron to-caramel",
    "from-caramel via-bark to-espresso",
    "from-cream via-saffron to-bark",
];

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-caramel/50 focus-visible:ring-offset-4 focus-visible:ring-offset-linen";

function RecipeImage({ recipe, index, icon: Icon, sizes, className = "" }: { recipe: Recipe; index: number; icon: Category["icon"]; sizes: string; className?: string }) {
    return <div className={`relative overflow-hidden bg-gradient-to-br ${gradients[index % gradients.length]} ${className}`}>
        {recipe.image_data
            ? <Image src={recipe.image_data} alt="" fill unoptimized sizes={sizes} className="object-cover transition duration-700 ease-out group-hover:scale-[1.04]" />
            : <div className="grid h-full place-items-center text-white/70"><Icon size={36} strokeWidth={1.5} aria-hidden="true" /></div>}
    </div>;
}

function FeaturedCard({ recipe, icon }: { recipe: Recipe; icon: Category["icon"] }) {
    return <Link href={`/recipes/${recipe.id}`} className={`group relative col-span-2 block overflow-hidden rounded-3xl lg:row-span-2 ${focusRing}`}>
        <RecipeImage recipe={recipe} index={0} icon={icon} sizes="(min-width: 1024px) 66vw, 100vw" className="aspect-[4/3] sm:aspect-[16/10] lg:aspect-auto lg:h-full lg:min-h-[28rem]" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-espresso/90 via-espresso/25 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-7">
            <p className="text-[10px] font-semibold tracking-[0.2em] text-saffron">ZULETZT HINZUGEFÜGT</p>
            <h2 className="mt-2 max-w-xl text-2xl leading-tight font-semibold tracking-[-0.04em] text-balance sm:text-3xl">{recipe.title}</h2>
            {recipe.description && <p className="mt-2 hidden max-w-lg text-sm leading-6 text-white/80 sm:line-clamp-2">{recipe.description}</p>}
            <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-white/85">
                <span className="inline-flex items-center gap-1"><Clock3 size={13} strokeWidth={2.25} aria-hidden="true" />{formatDuration(recipe.total_time_minutes)}</span>
                <span aria-hidden="true">·</span><span>{difficultyLabels[recipe.difficulty] ?? recipe.difficulty}</span>
                <span aria-hidden="true">·</span><span>{recipe.calories} kcal</span>
            </p>
        </div>
    </Link>;
}

function RecipeCard({ recipe, index, icon }: { recipe: Recipe; index: number; icon: Category["icon"] }) {
    return <Link href={`/recipes/${recipe.id}`} className={`group block rounded-2xl ${focusRing}`}>
        <div className="relative">
            <RecipeImage recipe={recipe} index={index} icon={icon} sizes="(min-width: 1024px) 33vw, 50vw" className="aspect-[4/5] rounded-2xl" />
            <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-espresso shadow-sm backdrop-blur">
                <Clock3 size={12} strokeWidth={2.5} aria-hidden="true" />{formatDuration(recipe.total_time_minutes)}
            </span>
        </div>
        <h2 className="mt-3 line-clamp-2 text-[15px] leading-snug font-semibold tracking-[-0.02em] text-espresso transition group-hover:text-caramel">{recipe.title}</h2>
        <p className="mt-1 text-xs text-bark">{difficultyLabels[recipe.difficulty] ?? recipe.difficulty} · {recipe.calories} kcal</p>
    </Link>;
}

function GridSkeleton() {
    return <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-3 lg:gap-x-6" aria-busy="true" aria-label="Rezepte werden geladen">
        {[0, 1, 2, 3, 4, 5].map((item) => <div key={item} className="animate-fade-in [animation-delay:150ms]">
            <div className="aspect-[4/5] rounded-2xl bg-espresso/[0.06] motion-safe:animate-shimmer" />
            <div className="mt-3 h-3.5 w-3/4 rounded-full bg-espresso/[0.06] motion-safe:animate-shimmer" />
            <div className="mt-2 h-3 w-1/3 rounded-full bg-espresso/[0.05] motion-safe:animate-shimmer" />
        </div>)}
    </div>;
}

export function RecipeExplorer({ initialType }: { initialType?: string }) {
    const [category, setCategory] = useState<Category>(categories.find((item) => item.type === initialType) ?? categories[0]);
    const [search, setSearch] = useState("");
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");
    const CategoryIcon = category.icon;
    const query = search.trim();
    const featured = !query && recipes.length >= 3 ? recipes[0] : null;
    const rest = featured ? recipes.slice(1) : recipes;

    function selectCategory(item: Category) {
        setCategory(item);
        // Kategorie in der URL halten, damit „Zurück" wieder hier landet.
        window.history.replaceState(null, "", `/recipes?type=${item.type}`);
    }

    useEffect(() => {
        const controller = new AbortController();
        const timer = window.setTimeout(async () => {
            const token = sessionStorage.getItem("crave_access_token");
            if (!token) return;
            setIsLoading(true);
            setError("");
            try {
                const params = new URLSearchParams({ recipe_type: category.type });
                if (search.trim()) params.set("search", search.trim());
                const response = await fetch(`${apiUrl}/recipes?${params}`, {
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
        }, search ? 220 : 0);

        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [category.type, search]);

    return (
        <section className="min-h-[calc(100vh-4rem)] bg-linen pb-32">
            <div className="mx-auto max-w-6xl px-5 pt-8 motion-safe:animate-page-in sm:px-8 sm:pt-12">
                <header className="flex items-end justify-between gap-4">
                    <div>
                        <p className="text-[11px] font-semibold tracking-[0.2em] text-caramel">DEIN KOCHBUCH</p>
                        <h1 className="mt-2 text-[2.5rem] leading-none font-semibold tracking-[-0.05em] text-espresso sm:text-5xl">Rezepte</h1>
                    </div>
                    <Link href={`/recipes/new?type=${category.type}`} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-caramel px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(153,97,48,0.6)] transition hover:bg-espresso focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-caramel/40 focus-visible:ring-offset-2 focus-visible:ring-offset-linen" aria-label={`Neues Rezept in ${category.label}`}>
                        <Plus size={17} strokeWidth={2.5} aria-hidden="true" /><span className="hidden sm:inline">Neues Rezept</span><span className="sm:hidden">Neu</span>
                    </Link>
                </header>

                <label className="relative mt-7 block">
                    <span className="sr-only">{category.label} durchsuchen</span>
                    <Search size={18} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-bark/60" strokeWidth={2.25} aria-hidden="true" />
                    <input value={search} onChange={(event) => setSearch(event.target.value)} className="h-12 w-full rounded-full border border-espresso/10 bg-white pr-11 pl-11 text-sm text-espresso outline-none transition placeholder:text-bark/50 hover:border-espresso/20 focus:border-caramel/60 focus:ring-4 focus:ring-caramel/10" placeholder="Titel, Zutaten oder Tags suchen" />
                    {search && <button type="button" onClick={() => setSearch("")} className="absolute top-1/2 right-2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-bark/60 transition hover:bg-espresso/[0.05] hover:text-espresso" aria-label="Suche leeren"><X size={16} strokeWidth={2.25} aria-hidden="true" /></button>}
                </label>

                <nav aria-label="Kategorien" className="sticky top-16 z-30 -mx-5 mt-4 bg-linen/90 px-5 py-3 backdrop-blur-md sm:-mx-8 sm:px-8">
                    <ul className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {categories.map((item) => {
                            const isActive = item.type === category.type;
                            return <li key={item.type} className="shrink-0">
                                <button type="button" onClick={() => selectCategory(item)} aria-pressed={isActive} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-caramel/40 ${isActive ? "bg-espresso text-white" : "bg-white text-bark ring-1 ring-espresso/10 hover:text-espresso hover:ring-espresso/20"}`}>
                                    <item.icon size={16} strokeWidth={2} aria-hidden="true" />{item.label}
                                </button>
                            </li>;
                        })}
                    </ul>
                </nav>

                {error && <p role="alert" className="mt-6 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{error}</p>}

                {isLoading ? <GridSkeleton /> : recipes.length === 0 ? (
                    <div className="mx-auto mt-20 max-w-sm text-center motion-safe:animate-page-in">
                        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-cream text-caramel"><CategoryIcon size={26} strokeWidth={1.75} aria-hidden="true" /></span>
                        <h2 className="mt-5 text-xl font-semibold tracking-[-0.03em] text-espresso">{query ? "Nichts gefunden" : `Noch keine ${category.label}`}</h2>
                        <p className="mt-2 text-sm leading-6 text-bark">{query ? `Für „${query}" gibt es in ${category.label} noch kein Rezept.` : "Lege das erste Rezept dieser Kategorie an, dann erscheint es hier."}</p>
                        {!query && <Link href={`/recipes/new?type=${category.type}`} className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-caramel px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-espresso"><Plus size={16} strokeWidth={2.5} aria-hidden="true" />Rezept hinzufügen</Link>}
                    </div>
                ) : (
                    <div key={`${category.type}-${query}`} className="mt-6 motion-safe:animate-page-in">
                        <p className="text-xs font-medium text-bark/80">{recipes.length} {recipes.length === 1 ? "Rezept" : "Rezepte"}{query && ` für „${query}"`}</p>
                        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-3 lg:gap-x-6">
                            {featured && <FeaturedCard recipe={featured} icon={CategoryIcon} />}
                            {rest.map((recipe, index) => <RecipeCard key={recipe.id} recipe={recipe} index={index + 1} icon={CategoryIcon} />)}
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}
