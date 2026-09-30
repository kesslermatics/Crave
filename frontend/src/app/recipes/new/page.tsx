import { AuthGate } from "@/components/auth-gate";
import { RecipeEditor } from "@/components/recipe-editor";

export default async function NewRecipePage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
    const { type } = await searchParams;
    return <AuthGate><RecipeEditor initialType={type} /></AuthGate>;
}