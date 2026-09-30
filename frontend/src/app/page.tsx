import { AuthGate } from "@/components/auth-gate";
import { Hero } from "@/components/hero";
import { MobileNav, SiteHeader } from "@/components/site-header";
import { Cta, Footer, HowItWorks, Modes, Pantry, Recipes } from "@/components/sections";

export default function Home() {
    return (
        <AuthGate>
            <SiteHeader />
            <main>
                <Hero />
                <Modes />
                <HowItWorks />
                <Recipes />
                <Pantry />
                <Cta />
            </main>
            <Footer />
            <MobileNav />
        </AuthGate>
    );
}
