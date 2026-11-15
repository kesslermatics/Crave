import type { Metadata } from "next";
import { AdminEvents } from "@/components/admin-events";
import { AuthGate } from "@/components/auth-gate";
import { MobileNav, SiteHeader } from "@/components/site-header";
export const metadata: Metadata = { title: "Admin · Crave" };
export default function AdminPage() {
    return <AuthGate><SiteHeader /><AdminEvents /><MobileNav /></AuthGate>;
}
