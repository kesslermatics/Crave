"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { BookOpen, Gift, House, LucideIcon, ShoppingBasket } from "lucide-react";
import { MouseEvent, useEffect, useState } from "react";

import { tick } from "@/lib/haptics";
import { useShoppingList } from "@/lib/shopping-list";

type Tab = { href: string; icon: LucideIcon; label: string; matches: (path: string) => boolean };

const tabs: Tab[] = [
    // Verlauf und Vorschläge gehören thematisch zur Startseite.
    { href: "/", icon: House, label: "Start", matches: (path) => path === "/" || path.startsWith("/history") || path.startsWith("/suggestions") },
    { href: "/recipes", icon: BookOpen, label: "Rezepte", matches: (path) => path.startsWith("/recipes") },
    { href: "/einkaufsliste", icon: ShoppingBasket, label: "Einkauf", matches: (path) => path.startsWith("/einkaufsliste") },
    { href: "/events", icon: Gift, label: "Events", matches: (path) => path.startsWith("/events") || path.startsWith("/handicaps") || path.startsWith("/admin") },
];

/** Seiten ohne Navigation (vor dem Anmelden). */
const bareRoutes = ["/login", "/signup"];

const pillSpring = { type: "spring", stiffness: 500, damping: 38, mass: 0.9 } as const;

const isTextField = (element: Element | null) =>
    element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement
    || (element instanceof HTMLInputElement && !["checkbox", "radio", "range", "button", "submit", "reset", "file", "color", "image"].includes(element.type))
    || (element instanceof HTMLElement && element.isContentEditable);

/**
 * Ob gerade die Bildschirmtastatur offen ist: ein Textfeld hat den Fokus *und* der sichtbare Bereich ist
 * geschrumpft. So taucht die Leiste auch wieder auf, wenn die Tastatur per Zurück-Taste (Android) zugeht,
 * während das Feld noch fokussiert ist.
 */
function useKeyboardOpen() {
    const [open, setOpen] = useState(false);
    useEffect(() => {
        const viewport = window.visualViewport;
        let frame = 0;
        const update = () => {
            cancelAnimationFrame(frame);
            // Erst nach dem Fokuswechsel auswerten – während focusout zeigt activeElement noch nichts Sinnvolles.
            frame = requestAnimationFrame(() => {
                const shrunk = viewport ? viewport.height < window.innerHeight - 120 : true;
                setOpen(isTextField(document.activeElement) && shrunk);
            });
        };
        document.addEventListener("focusin", update);
        document.addEventListener("focusout", update);
        viewport?.addEventListener("resize", update);
        return () => {
            cancelAnimationFrame(frame);
            document.removeEventListener("focusin", update);
            document.removeEventListener("focusout", update);
            viewport?.removeEventListener("resize", update);
        };
    }, []);
    return open;
}

export function MobileNav() {
    const pathname = usePathname();
    const shoppingCount = useShoppingList().length;
    const keyboardOpen = useKeyboardOpen();

    if (bareRoutes.some((route) => pathname.startsWith(route))) return null;

    function onTabClick(event: MouseEvent<HTMLAnchorElement>, tab: Tab) {
        if (pathname === tab.href) {
            // Wie in nativen Apps: aktiven Tab nochmal antippen = nach oben scrollen.
            event.preventDefault();
            window.scrollTo({ top: 0, behavior: "smooth" });
            return;
        }
        tick();
    }

    return <MotionConfig reducedMotion="user">
        <nav aria-label="Schnellnavigation" className={`fixed inset-x-0 bottom-0 z-40 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] md:hidden ${keyboardOpen ? "translate-y-full" : ""}`}>
            <div className="border-t border-espresso/[0.07] bg-linen/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl backdrop-saturate-150">
                <ul className="mx-auto grid max-w-md grid-cols-4 px-2">
                    {tabs.map((tab) => {
                        const active = tab.matches(pathname);
                        const badge = tab.href === "/einkaufsliste" && shoppingCount > 0 ? (shoppingCount > 99 ? "99+" : String(shoppingCount)) : null;
                        return <li key={tab.href}>
                            <Link href={tab.href} onClick={(event) => onTabClick(event, tab)} aria-current={active ? "page" : undefined}
                                aria-label={badge ? `${tab.label}, ${badge} offen` : undefined}
                                className="group flex flex-col items-center gap-1 pt-2 pb-1.5 select-none [-webkit-touch-callout:none] focus-visible:outline-none">
                                <span className="relative grid h-8 w-14 place-items-center">
                                    {active && <motion.span layoutId="mobile-nav-pill" transition={pillSpring} className="absolute inset-0 rounded-full bg-saffron/25" />}
                                    <span className="absolute inset-0 rounded-full ring-caramel/50 group-focus-visible:ring-2" aria-hidden="true" />
                                    <tab.icon size={22} strokeWidth={active ? 2.2 : 1.8} aria-hidden="true"
                                        className={`relative transition duration-200 group-active:scale-[0.84] ${active ? "text-espresso" : "text-bark/65"}`} />
                                    <AnimatePresence initial={false}>
                                        {badge && <motion.span key="badge" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: "spring", stiffness: 600, damping: 26 }}
                                            className="absolute -top-0.5 right-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-caramel px-1 text-[10px] leading-none font-semibold text-white tabular-nums ring-2 ring-linen" aria-hidden="true">
                                            <motion.span key={badge} initial={{ scale: 1.5, opacity: 0.4 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 500, damping: 22 }}>{badge}</motion.span>
                                        </motion.span>}
                                    </AnimatePresence>
                                </span>
                                <span className={`text-[11px] leading-none transition-colors duration-200 ${active ? "font-semibold text-espresso" : "font-medium text-bark/80"}`}>{tab.label}</span>
                            </Link>
                        </li>;
                    })}
                </ul>
            </div>
        </nav>
    </MotionConfig>;
}
