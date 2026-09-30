import { AuthGate } from "@/components/auth-gate";
import { HomeSuggestions } from "@/components/home-suggestions";
import { MobileNav, SiteHeader } from "@/components/site-header";
import { History } from "lucide-react";
import Link from "next/link";

export default function Home() {
    return (
        <AuthGate>
            <SiteHeader />
            <Link href="/history" className="fixed right-5 top-20 z-40 inline-flex items-center gap-1.5 rounded-full border border-espresso/10 bg-white/90 px-4 py-2 text-xs font-bold text-bark shadow-sm backdrop-blur transition hover:border-caramel hover:text-caramel sm:right-8">
                <History size={14} strokeWidth={2.25} aria-hidden="true" /> Verlauf
            </Link>
            <HomeSuggestions />
            <MobileNav />
        </AuthGate>
    );
}
