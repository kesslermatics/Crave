import { AuthGate } from "@/components/auth-gate";
import { HomeSuggestions } from "@/components/home-suggestions";
import { MobileNav, SiteHeader } from "@/components/site-header";

export default function Home() {
    return (
        <AuthGate>
            <SiteHeader />
            <HomeSuggestions />
            <MobileNav />
        </AuthGate>
    );
}
