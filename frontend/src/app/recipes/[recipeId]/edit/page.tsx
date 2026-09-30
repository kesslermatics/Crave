import { AuthGate } from "@/components/auth-gate";
import { RecipeEditor } from "@/components/recipe-editor";
import { MobileNav, SiteHeader } from "@/components/site-header";

export default async function EditRecipePage({ params }: { params: Promise<{ recipeId: string }> }) {
    const { recipeId } = await params;
    return <AuthGate><SiteHeader /><RecipeEditor recipeId={recipeId} /><MobileNav /></AuthGate>;
}
