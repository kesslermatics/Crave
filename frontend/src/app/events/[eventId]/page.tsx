import { AuthGate } from "@/components/auth-gate";
import { EventDetail } from "@/components/event-detail";
import { MobileNav, SiteHeader } from "@/components/site-header";
export default async function EventPage({ params }: { params: Promise<{ eventId: string }> }) {
    const { eventId } = await params;
    return <AuthGate><SiteHeader /><EventDetail eventId={eventId} /><MobileNav /></AuthGate>;
}
