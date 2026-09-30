import { AuthGate } from "@/components/auth-gate";
import { RecipeEditDraft } from "@/components/recipe-edit-draft";
import { MobileNav, SiteHeader } from "@/components/site-header";

export default async function EditRecipePage({ params }: { params: Promise<{ recipeId: string }> }) {
    const { recipeId } = await params;
    return <AuthGate><SiteHeader /><RecipeEditDraft recipeId={recipeId} /><MobileNav /></AuthGate>;
}
