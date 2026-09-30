import { AuthGate } from "@/components/auth-gate";
import { RecipeExplorer } from "@/components/recipe-explorer";
import { MobileNav, SiteHeader } from "@/components/site-header";

export default function RecipesPage() {
    return (
        <AuthGate>
            <SiteHeader />
            <main>
                <RecipeExplorer />
            </main>
            <MobileNav />
        </AuthGate>
    );
}