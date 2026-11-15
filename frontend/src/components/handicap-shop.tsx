"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { DropItem, eventApi, formatAmount } from "@/lib/events";
import { HandicapName, HandicapPicture } from "@/components/handicap-visual";
import { HandicapIcon } from "@/components/handicap-icons";
import { LoadingIndicator } from "@/components/loading-indicator";

type ShopItem = { id: string; cost: number; title: string; description: string; example: DropItem | null; example_text: string };
type Tier = { tier: string; label: string; items: ShopItem[] };

// Sample "photo" for the previews, so every visual effect can be seen without a generated image.
const SAMPLE_IMAGE = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><radialGradient id="g" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="#fcfbf6"/><stop offset="1" stop-color="#f4efcf"/></radialGradient></defs><rect width="200" height="200" fill="url(#g)"/><ellipse cx="100" cy="168" rx="58" ry="12" fill="#e6dcc0"/><circle cx="100" cy="108" r="56" fill="#e0412f"/><circle cx="82" cy="90" r="14" fill="#f27a68" opacity=".7"/><path d="M100 54c-12-16-30-14-34-10 14 2 22 8 26 14-14-4-26 0-30 6 14-2 26 0 38 4 12-4 24-6 38-4-4-6-16-10-30-6 4-6 12-12 26-14-4-4-22-6-34 10z" fill="#3f8a3a"/></svg>')}`;

export function HandicapShop() {
    const [tiers, setTiers] = useState<Tier[] | null>(null);
    const [error, setError] = useState("");
    useEffect(() => { eventApi<{ tiers: Tier[] }>("/handicaps").then((result) => setTiers(result.tiers)).catch((caught: Error) => setError(caught.message)); }, []);

    return <main className="mx-auto max-w-3xl px-5 pt-4 pb-[calc(8rem+env(safe-area-inset-bottom))] sm:px-8 sm:pt-8">
        <Link href="/events" className="-ml-1 flex min-h-11 w-fit items-center gap-1 px-1 text-sm font-semibold text-caramel"><ArrowLeft size={15} aria-hidden="true" /> Events</Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-espresso sm:text-4xl">Handicap-Shop</h1>
        <p className="mt-2 text-sm leading-6 text-bark">Strafpunkte aus Tipps und Jury landen auf eurem Konto. Beim nächsten Event gibt Crave sie komplett aus: Leichte Handicaps verschleiern je eine Zutat (Vorschau: Tomate, 200 g), mittlere verändern das ganze Event.</p>
        {error && <p role="alert" className="mt-6 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
        {!tiers && !error && <div className="mt-8"><LoadingIndicator label="Shop wird geladen…" /></div>}
        {tiers && <nav aria-label="Stufen" className="sticky top-16 z-10 -mx-5 mt-6 grid grid-cols-3 gap-2 bg-linen/95 px-5 py-3 backdrop-blur sm:mx-0 sm:flex sm:px-0">{tiers.map((tier) => <a key={tier.tier} href={`#tier-${tier.tier}`} className="flex min-h-11 min-w-0 items-center justify-center rounded-full border border-espresso/10 bg-white px-3 text-sm font-semibold text-espresso sm:px-4">{tier.label} <span className="ml-1.5 text-caramel">{tier.items[0]?.cost}</span></a>)}</nav>}
        {tiers?.map((tier) => <section key={tier.tier} className="mt-10 scroll-mt-32" aria-labelledby={`tier-${tier.tier}`}>
            <h2 id={`tier-${tier.tier}`} className="flex items-baseline gap-2 text-xl font-semibold text-espresso">{tier.label}{tier.items[0] && <span className="text-sm font-semibold text-caramel">{tier.items[0].cost} {tier.items[0].cost === 1 ? "Strafpunkt" : "Strafpunkte"}</span>}</h2>
            {tier.items.length === 0 ? <p className="mt-3 rounded-3xl border border-dashed border-espresso/15 p-5 text-sm text-bark">Kommt bald.</p>
                : <ul className="mt-4 grid gap-3 sm:grid-cols-2">{tier.items.map((item) => {
                    const example = item.example ? { ...item.example, image_data: SAMPLE_IMAGE } : null;
                    return <li key={item.id} id={item.id} className="flex min-w-0 scroll-mt-32 gap-3 rounded-3xl bg-white p-4 target:ring-4 target:ring-caramel/30 shadow-[0_1px_2px_rgba(66,52,33,0.06)] sm:gap-4">
                        <HandicapIcon id={item.id} tier={tier.tier} title={item.title} size={24} className="h-14 w-14 sm:h-20 sm:w-20" />
                        <div className="min-w-0 flex-1 break-words">
                            <h3 className="font-semibold text-espresso">{item.title}</h3>
                            <p className="mt-1 text-sm leading-6 text-bark">{item.description}</p>
                            {example ? <p className="mt-3 flex items-center gap-2.5 rounded-2xl bg-linen p-2 text-sm font-semibold text-espresso"><HandicapPicture item={example} size="h-10 w-10" /><span className="min-w-0 truncate"><HandicapName item={example} /> <span className="text-caramel">· {formatAmount(example.amount, example.unit)}</span></span></p>
                                : item.example_text && <p className="mt-3 rounded-2xl bg-linen px-3 py-2 text-sm font-semibold text-espresso">{item.example_text}</p>}
                        </div>
                    </li>;
                })}</ul>}
        </section>)}
    </main>;
}
