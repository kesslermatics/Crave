import type { Metadata } from "next";
import { AuthGate } from "@/components/auth-gate";
import { HandicapShop } from "@/components/handicap-shop";
import { SiteHeader } from "@/components/site-header";
export const metadata: Metadata = { title: "Handicaps · Crave" };
export default function HandicapsPage() {
    return <AuthGate><SiteHeader /><HandicapShop /></AuthGate>;
}
