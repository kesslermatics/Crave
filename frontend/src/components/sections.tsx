const modes = [
    { icon: "✦", title: "Scan your fridge", text: "Snap a photo and Vision AI recognizes what you have, then builds a recipe around it.", tag: "Vision AI" },
    { icon: "◈", title: "Hit your macros", text: "Set protein, carbs and calories — ideal for post-workout meals that fit your goals.", tag: "Nutrition" },
    { icon: "⌁", title: "Cook by mood", text: "Comforting, fresh, quick or indulgent. Tell Crave how you feel and it does the rest.", tag: "Mood" },
];

const steps = [
    { n: "01", title: "Tell us what you crave", text: "Scan, set a goal or pick a mood." },
    { n: "02", title: "Crave creates your recipe", text: "Gemini tailors ingredients, steps and nutrition." },
    { n: "03", title: "Cook and enjoy", text: "Follow clear steps, swap anything, save your favorites." },
];

const recipes = [
    { title: "Golden chicken bowl", meta: "18 min · 542 kcal · 46g protein", g: "from-saffron via-caramel to-espresso" },
    { title: "Creamy miso noodles", meta: "15 min · 480 kcal · 18g protein", g: "from-cream via-saffron to-caramel" },
    { title: "Caramelized tofu stir-fry", meta: "22 min · 510 kcal · 32g protein", g: "from-caramel via-bark to-espresso" },
    { title: "Saffron egg toast", meta: "10 min · 360 kcal · 21g protein", g: "from-cream via-saffron to-bark" },
    { title: "Roasted veggie traybake", meta: "30 min · 420 kcal · 15g protein", g: "from-saffron via-caramel to-bark" },
    { title: "Honey salmon rice", meta: "20 min · 590 kcal · 41g protein", g: "from-saffron via-bark to-espresso" },
];

const pantry = ["Chicken", "Sweet potato", "Broccoli", "Rice", "Eggs", "Garlic", "Lemon"];

function Heading({ eyebrow, title, text }: { eyebrow: string; title: string; text?: string }) {
    return (
        <div className="max-w-2xl">
            <p className="text-[11px] font-bold tracking-[0.18em] text-caramel">{eyebrow}</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.06em] sm:text-4xl lg:text-5xl">{title}</h2>
            {text && <p className="mt-4 text-base leading-7 text-bark">{text}</p>}
        </div>
    );
}

export function Modes() {
    return (
        <section id="modes" className="border-y border-espresso/8 bg-linen">
            <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-24">
                <Heading eyebrow="THREE WAYS IN" title="However you cook, Crave starts where you are." />
                <div className="mt-10 grid gap-4 md:grid-cols-3">
                    {modes.map((mode) => (
                        <article key={mode.title} className="rounded-3xl border border-espresso/8 bg-white p-6 transition hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(66,52,33,0.1)]">
                            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-cream text-xl text-caramel">{mode.icon}</span>
                            <p className="mt-6 text-[10px] font-bold tracking-[0.15em] text-caramel">{mode.tag.toUpperCase()}</p>
                            <h3 className="mt-1 text-xl font-semibold tracking-[-0.05em]">{mode.title}</h3>
                            <p className="mt-3 text-sm leading-6 text-bark">{mode.text}</p>
                        </article>
                    ))}
                </div>
            </div>
        </section>
    );
}

export function HowItWorks() {
    return (
        <section id="how" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-24">
            <Heading eyebrow="HOW IT WORKS" title="From craving to plate in three steps." />
            <ol className="mt-10 grid gap-8 md:grid-cols-3">
                {steps.map((step) => (
                    <li key={step.n} className="border-t-2 border-saffron pt-5">
                        <span className="text-sm font-bold text-caramel">{step.n}</span>
                        <h3 className="mt-2 text-xl font-semibold tracking-[-0.05em]">{step.title}</h3>
                        <p className="mt-2 text-sm leading-6 text-bark">{step.text}</p>
                    </li>
                ))}
            </ol>
        </section>
    );
}

export function Recipes() {
    return (
        <section id="recipes" className="border-t border-espresso/8 bg-linen">
            <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-24">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <Heading eyebrow="MADE FOR YOU" title="Today's best matches" />
                    <a href="#start" className="text-sm font-bold text-caramel hover:text-espresso">See all recipes →</a>
                </div>
                <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {recipes.map((recipe) => (
                        <article key={recipe.title} className="group overflow-hidden rounded-3xl border border-espresso/8 bg-white transition hover:shadow-[0_16px_40px_rgba(66,52,33,0.1)]">
                            <div className={`h-44 bg-gradient-to-br ${recipe.g} transition duration-500 group-hover:scale-[1.03] sm:h-48`} />
                            <div className="relative bg-white p-5">
                                <h3 className="text-lg font-semibold tracking-[-0.04em]">{recipe.title}</h3>
                                <p className="mt-1 text-xs text-bark">{recipe.meta}</p>
                            </div>
                        </article>
                    ))}
                </div>
            </div>
        </section>
    );
}

export function Pantry() {
    return (
        <section id="pantry" className="mx-auto grid max-w-7xl gap-8 px-5 py-16 sm:px-8 lg:grid-cols-2 lg:items-center lg:gap-16 lg:py-24">
            <Heading eyebrow="YOUR PANTRY" title="Keep your kitchen in sync." text="Add what you have once. Crave remembers it, so every suggestion is ready to cook tonight." />
            <div className="rounded-3xl bg-cream p-6 sm:p-8">
                <div className="flex flex-wrap gap-2.5">
                    {pantry.map((item) => (
                        <span key={item} className="rounded-full bg-white px-4 py-2.5 text-sm font-semibold">{item}</span>
                    ))}
                    <button aria-label="Add pantry item" className="grid h-10 w-10 place-items-center rounded-full border border-dashed border-caramel/60 text-caramel">+</button>
                </div>
            </div>
        </section>
    );
}

export function Cta() {
    return (
        <section className="mx-auto max-w-7xl px-5 pb-16 sm:px-8 lg:pb-24">
            <div className="rounded-[2rem] bg-espresso px-6 py-12 text-center text-white sm:px-12 sm:py-16">
                <h2 className="mx-auto max-w-2xl text-3xl font-semibold leading-tight tracking-[-0.06em] sm:text-5xl">Hungry for something good?</h2>
                <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-white/70">Open your fridge, tell Crave how you feel, and dinner is sorted.</p>
                <a href="/signup" className="mt-8 inline-block rounded-full bg-saffron px-8 py-4 text-sm font-bold text-espresso transition hover:bg-white">Start cooking</a>
            </div>
        </section>
    );
}

export function Footer() {
    return (
        <footer className="border-t border-espresso/8 pb-28 md:pb-0">
            <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-8 text-xs text-bark sm:flex-row sm:items-center sm:justify-between sm:px-8">
                <p className="font-bold text-espresso">crave</p>
                <p>AI-powered culinary engine · Built with Next.js, FastAPI &amp; Gemini</p>
            </div>
        </footer>
    );
}
