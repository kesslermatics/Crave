import type { Metadata } from "next";
import { AdminEvents } from "@/components/admin-events";
import { AuthGate } from "@/components/auth-gate";
import { SiteHeader } from "@/components/site-header";
export const metadata: Metadata = { title: "Admin · Crave" };
export default function AdminPage() {
    return <AuthGate><SiteHeader /><AdminEvents /></AuthGate>;
}
