import { AuthGate } from "@/components/auth-gate";
import { SuggestionDetail } from "@/components/recipe-full-view";
import { MobileNav, SiteHeader } from "@/components/site-header";

export default function SuggestionPage() {
    return <AuthGate><SiteHeader /><SuggestionDetail /><MobileNav /></AuthGate>;
}
