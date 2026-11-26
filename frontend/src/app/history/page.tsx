import { AuthGate } from "@/components/auth-gate";
import { SuggestionHistory } from "@/components/suggestion-history";
import { SiteHeader } from "@/components/site-header";

export default function HistoryPage() {
    return <AuthGate><SiteHeader /><SuggestionHistory /></AuthGate>;
}
