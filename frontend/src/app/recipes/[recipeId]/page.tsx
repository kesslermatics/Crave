import { AuthGate } from "@/components/auth-gate";
import { StoredRecipeDetail } from "@/components/recipe-full-view";
import { MobileNav, SiteHeader } from "@/components/site-header";

export default async function RecipePage({ params }: { params: Promise<{ recipeId: string }> }) {
    const { recipeId } = await params;
    return <AuthGate><SiteHeader /><StoredRecipeDetail recipeId={recipeId} /><MobileNav /></AuthGate>;
}
