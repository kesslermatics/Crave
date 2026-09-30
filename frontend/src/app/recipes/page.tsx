import { AuthGate } from "@/components/auth-gate";
import { MobileNav, SiteHeader } from "@/components/site-header";
import { Footer, Recipes } from "@/components/sections";

export default function RecipesPage() {
    return (
        <AuthGate>
            <SiteHeader />
            <main>
                <Recipes />
            </main>
            <Footer />
            <MobileNav />
        </AuthGate>
    );
}