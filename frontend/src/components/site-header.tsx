import Link from "next/link";

const links = [
    { href: "/", label: "Start" },
    { href: "/recipes", label: "Rezepte" },
];

export function Logo() {
    return (
        <Link href="/" className="flex items-center gap-2 font-bold tracking-[-0.07em]" aria-label="Crave home">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-saffron text-[17px] shadow-sm" aria-hidden="true">🍳</span>
            <span className="text-2xl">crave</span>
        </Link>
    );
}

export function SiteHeader() {
    return (
        <header className="sticky top-0 z-40 border-b border-espresso/8 bg-white/90 backdrop-blur">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
                <Logo />
                <nav aria-label="Main" className="hidden items-center gap-8 text-sm font-semibold text-bark md:flex">
                    {links.map((link) => (
                        <Link key={link.href} href={link.href} className="transition hover:text-caramel">
                            {link.label}
                        </Link>
                    ))}
                </nav>
                <Link href="/recipes" className="rounded-full bg-caramel px-4 py-2.5 text-xs font-bold text-white transition hover:bg-espresso sm:px-5 sm:text-sm">
                    Rezepte ansehen
                </Link>
            </div>
        </header>
    );
}

export function MobileNav() {
    const items = [
        { href: "/", icon: "⌂", label: "Start" },
        { href: "/recipes", icon: "◫", label: "Rezepte" },
    ];
    return (
        <nav aria-label="Quick navigation" className="fixed inset-x-0 bottom-0 z-40 border-t border-espresso/8 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
            <ul className="mx-auto flex max-w-md justify-around px-4 py-2.5">
                {items.map((item) => (
                    <li key={item.href}>
                        <Link href={item.href} className="flex min-w-14 flex-col items-center gap-0.5 text-[10px] font-bold text-bark">
                            <span className="text-base text-caramel">{item.icon}</span>
                            {item.label}
                        </Link>
                    </li>
                ))}
            </ul>
        </nav>
    );
}
