import type { Metadata } from "next";
import { AuthGate } from "@/components/auth-gate";
import { EventList } from "@/components/event-list";
import { SiteHeader } from "@/components/site-header";
export const metadata: Metadata = { title: "Events · Crave" };
export default function EventsPage() {
    return <AuthGate><SiteHeader /><EventList /></AuthGate>;
}
