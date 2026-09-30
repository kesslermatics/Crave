import { AuthGate } from "@/components/auth-gate";
import { SuggestionHistory } from "@/components/suggestion-history";
import { MobileNav, SiteHeader } from "@/components/site-header";

export default function HistoryPage() {
    return <AuthGate><SiteHeader /><SuggestionHistory /><MobileNav /></AuthGate>;
}
