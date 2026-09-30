"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiUrl } from "@/lib/api";

const categories = [
    { type: "meal", label: "Meals", icon: "🍲" },
    { type: "baking", label: "Baking", icon: "🧁" },
    { type: "drink", label: "Drinks", icon: "🥤" },
    { type: "basic", label: "Basics", icon: "🫙" },
] as const;

type Category = (typeof categories)[number];
type Recipe = {
    id: string;
    title: string;
    description: string;
    total_time_minutes: number;
    calories: number;
    protein_g: number;
    tags: string[];
};

const gradients = [
    "from-saffron via-caramel to-espresso",
    "from-cream via-saffron to-caramel",
    "from-caramel via-bark to-espresso",
    "from-cream via-saffron to-bark",
];

export function RecipeExplorer() {
    const [category, setCategory] = useState<Category>(categories[0]);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");

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
                if (!response.ok) throw new Error("Recipes could not be loaded.");
                setRecipes(await response.json());
            } catch (caughtError) {
                if ((caughtError as Error).name !== "AbortError") {
                    setError(caughtError instanceof Error ? caughtError.message : "Recipes could not be loaded.");
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
        <section className="min-h-[calc(100vh-4rem)] bg-linen pb-28">
            <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-12">
                <div className="relative flex items-center justify-between gap-3">
                    <div>
                        <p className="text-[11px] font-bold tracking-[0.18em] text-caramel">YOUR COOKBOOK</p>
                        <button onClick={() => setIsMenuOpen((open) => !open)} className="mt-2 flex items-center gap-2 text-left text-3xl font-semibold tracking-[-0.06em] text-espresso sm:text-4xl" aria-expanded={isMenuOpen} aria-haspopup="listbox">
                            <span>{category.icon}</span>{category.label}<span className="text-base text-caramel">⌄</span>
                        </button>
                    </div>
                    <Link href={`/recipes/new?type=${category.type}`} className="grid h-11 w-11 place-items-center rounded-full bg-caramel text-2xl text-white shadow-[0_10px_20px_rgba(153,97,48,0.2)] transition hover:bg-espresso" aria-label={`Create ${category.label.toLowerCase()} recipe`}>+</Link>
                    {isMenuOpen && (
                        <div role="listbox" className="absolute left-0 top-20 z-20 w-56 overflow-hidden rounded-2xl border border-espresso/10 bg-white p-1.5 shadow-[0_16px_40px_rgba(66,52,33,0.15)]">
                            {categories.map((item) => (
                                <button key={item.type} onClick={() => { setCategory(item); setIsMenuOpen(false); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-bold transition ${item.type === category.type ? "bg-cream text-espresso" : "text-bark hover:bg-linen"}`} role="option" aria-selected={item.type === category.type}>
                                    <span className="text-lg">{item.icon}</span>{item.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <label className="relative mt-7 block">
                    <span className="sr-only">Search {category.label.toLowerCase()}</span>
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-caramel">⌕</span>
                    <input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full rounded-2xl border border-espresso/10 bg-white py-4 pl-11 pr-4 text-sm font-medium outline-none transition placeholder:text-bark/50 focus:border-caramel focus:ring-4 focus:ring-saffron/30" placeholder={`Search ${category.label.toLowerCase()}, ingredients or tags`} />
                </label>
                <p className="mt-3 text-xs leading-5 text-bark">Fuzzy search includes titles, descriptions, ingredients, instructions, tags and all category details.</p>

                {error && <p role="alert" className="mt-8 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{error}</p>}
                {isLoading ? <p className="mt-12 text-center text-sm font-semibold text-bark">Finding recipes…</p> : recipes.length === 0 ? (
                    <div className="mt-12 rounded-3xl border border-dashed border-espresso/20 bg-white px-6 py-14 text-center">
                        <span className="text-3xl">{category.icon}</span>
                        <h2 className="mt-4 text-xl font-semibold tracking-[-0.04em] text-espresso">No {category.label.toLowerCase()} yet</h2>
                        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-bark">Create the first recipe for this category and it will appear here.</p>
                        <Link href={`/recipes/new?type=${category.type}`} className="mt-6 inline-block rounded-full bg-caramel px-5 py-3 text-sm font-bold text-white hover:bg-espresso">Add recipe</Link>
                    </div>
                ) : (
                    <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        {recipes.map((recipe, index) => (
                            <article key={recipe.id} className="overflow-hidden rounded-3xl border border-espresso/8 bg-white shadow-[0_10px_25px_rgba(66,52,33,0.06)]">
                                <div className={`h-36 bg-gradient-to-br ${gradients[index % gradients.length]}`} />
                                <div className="p-5"><h2 className="text-lg font-semibold tracking-[-0.04em] text-espresso">{recipe.title}</h2><p className="mt-1 line-clamp-2 text-xs leading-5 text-bark">{recipe.description}</p><p className="mt-4 text-xs font-bold text-caramel">{recipe.total_time_minutes} min · {recipe.calories} kcal · {recipe.protein_g}g protein</p></div>
                            </article>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}
