import Link from "next/link";
import { ChefHat } from "lucide-react";

const links = [
    { href: "/", label: "Start" },
    { href: "/recipes", label: "Rezepte" },
    { href: "/einkaufsliste", label: "Einkaufsliste" },
    { href: "/events", label: "Events" },
];

export function Logo() {
    return (
        <Link href="/" className="flex items-center gap-2 font-bold tracking-[-0.07em]" aria-label="Crave Startseite">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-saffron text-espresso shadow-sm" aria-hidden="true"><ChefHat size={18} strokeWidth={2.25} /></span>
            <span className="text-2xl">crave</span>
        </Link>
    );
}

export function SiteHeader() {
    return (
        <header className="sticky top-0 z-50 border-b border-espresso/8 bg-white/90 backdrop-blur">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
                <Logo />
                <nav aria-label="Hauptnavigation" className="hidden items-center gap-8 text-sm font-semibold text-bark md:flex">
                    {links.map((link) => (
                        <Link key={link.href} href={link.href} className="transition hover:text-caramel">
                            {link.label}
                        </Link>
                    ))}
                </nav>
            </div>
        </header>
    );
}
