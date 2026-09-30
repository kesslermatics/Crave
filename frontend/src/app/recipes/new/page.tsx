import { AuthGate } from "@/components/auth-gate";
import { RecipeEditor } from "@/components/recipe-editor";
import { MobileNav, SiteHeader } from "@/components/site-header";

export default async function NewRecipePage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
    const { type } = await searchParams;
    return <AuthGate><SiteHeader /><RecipeEditor initialType={type} /><MobileNav /></AuthGate>;
}