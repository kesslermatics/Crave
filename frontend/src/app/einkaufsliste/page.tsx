import type { Metadata } from "next";

import { AuthGate } from "@/components/auth-gate";
import { ShoppingList } from "@/components/shopping-list";
import { MobileNav, SiteHeader } from "@/components/site-header";

export const metadata: Metadata = { title: "Einkaufsliste · Crave" };

export default function ShoppingListPage() {
    return <AuthGate allowOffline><SiteHeader /><ShoppingList /><MobileNav /></AuthGate>;
}
