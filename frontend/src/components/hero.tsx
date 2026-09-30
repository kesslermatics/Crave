export function Hero() {
    return (
        <section id="top" className="mx-auto grid max-w-7xl gap-12 px-5 pb-16 pt-10 sm:px-8 md:pt-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-16 lg:pb-24">
            <div>
                <p className="mb-4 text-[11px] font-bold tracking-[0.18em] text-caramel">SLOW FOOD, SMARTLY MADE</p>
                <h1 className="max-w-2xl text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.07em] sm:text-6xl lg:text-7xl">
                    What should we make with what you have?
                </h1>
                <p className="mt-5 max-w-xl text-base leading-7 text-bark sm:text-lg sm:leading-8">
                    Crave is an AI-powered culinary engine. Scan your fridge, hit your macros, or cook by mood — and get the perfect recipe in seconds.
                </p>
                <div id="start" className="mt-8 flex flex-col gap-3 sm:flex-row">
                    <a href="/signup" className="rounded-full bg-caramel px-7 py-4 text-center text-sm font-bold text-white shadow-[0_12px_24px_rgba(153,97,48,0.2)] transition hover:bg-espresso">
                        ✦ Scan my fridge
                    </a>
                    <a href="#modes" className="rounded-full bg-cream px-7 py-4 text-center text-sm font-bold transition hover:bg-saffron">
                        Cook by mood
                    </a>
                </div>
                <dl className="mt-10 grid max-w-md grid-cols-3 gap-4 border-t border-espresso/10 pt-6">
                    {[
                        ["18 min", "average cook time"],
                        ["3 ways", "to get inspired"],
                        ["0 waste", "use what you have"],
                    ].map(([value, label]) => (
                        <div key={value}>
                            <dt className="text-xl font-semibold tracking-[-0.05em] sm:text-2xl">{value}</dt>
                            <dd className="mt-1 text-xs leading-5 text-bark">{label}</dd>
                        </div>
                    ))}
                </dl>
            </div>

            <div className="relative mx-auto w-full max-w-md lg:max-w-none">
                <div className="absolute -inset-4 -z-10 rounded-[3rem] bg-saffron/25 blur-3xl" aria-hidden />
                <article className="overflow-hidden rounded-[2rem] border border-espresso/8 bg-white shadow-[0_24px_60px_rgba(66,52,33,0.14)]">
                    <div className="flex h-64 items-end justify-between bg-[linear-gradient(135deg,#D7C56D_0%,#996130_52%,#423421_100%)] p-5 sm:h-80">
                        <span className="rounded-full bg-white/90 px-3 py-1.5 text-[10px] font-bold">18 MIN · HIGH PROTEIN</span>
                        <span className="grid h-12 w-12 place-items-center rounded-full bg-white text-xl shadow-lg">→</span>
                    </div>
                    <div className="flex items-end justify-between gap-4 p-5 sm:p-6">
                        <div>
                            <p className="text-[10px] font-bold tracking-[0.15em] text-caramel">MADE FOR YOU</p>
                            <h2 className="mt-1 text-xl font-semibold tracking-[-0.05em] sm:text-2xl">Golden chicken bowl</h2>
                            <p className="mt-1 text-xs text-bark">With roasted sweet potato &amp; broccoli</p>
                        </div>
                        <p className="shrink-0 text-right text-xs font-bold text-bark">542 kcal<br />46g protein</p>
                    </div>
                </article>
            </div>
        </section>
    );
}
