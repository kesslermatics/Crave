import { AuthGate } from "@/components/auth-gate";
import { RecipeExplorer } from "@/components/recipe-explorer";
import { MobileNav, SiteHeader } from "@/components/site-header";

export default async function RecipesPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
    const { type } = await searchParams;
    return (
        <AuthGate>
            <SiteHeader />
            <main className="flex-1">
                <RecipeExplorer initialType={type} />
            </main>
            <MobileNav />
        </AuthGate>
    );
}
