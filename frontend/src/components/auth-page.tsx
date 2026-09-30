import Link from "next/link";

import { AuthForm } from "@/components/auth-form";

type AuthPageProps = {
    mode: "login" | "signup";
};

export function AuthPage({ mode }: AuthPageProps) {
    const isSignup = mode === "signup";
    return (
        <main className="grid min-h-screen bg-linen lg:grid-cols-2">
            <section className="hidden bg-espresso p-12 text-white lg:flex lg:flex-col lg:justify-between">
                <Link href="/" className="flex items-center gap-2 self-start font-bold tracking-[-0.07em]">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-saffron text-[19px] shadow-sm" aria-hidden="true">🍳</span>
                    <span className="text-3xl">crave</span>
                </Link>
                <div className="max-w-md">
                    <p className="text-[11px] font-bold tracking-[0.18em] text-saffron">SMART KOCHEN, GUT ESSEN</p>
                    <h1 className="mt-4 text-5xl font-semibold leading-[1.02] tracking-[-0.07em]">Die bessere Antwort auf „Was koche ich heute?“</h1>
                    <p className="mt-5 text-base leading-7 text-white/70">Mach aus Zutaten, Ernährungszielen und deinem Gefühl etwas richtig Gutes.</p>
                </div>
                    <p className="text-xs text-white/50">Crave · kulinarische Intelligenz</p>
            </section>
            <section className="flex items-center justify-center px-5 py-10 sm:px-8">
                <div className="w-full max-w-md">
                    <Link href="/" className="flex items-center gap-2 font-bold tracking-[-0.07em] lg:hidden">
                        <span className="grid h-8 w-8 place-items-center rounded-xl bg-saffron text-[17px] shadow-sm" aria-hidden="true">🍳</span>
                        <span className="text-2xl">crave</span>
                    </Link>
                    <p className="mt-12 text-[11px] font-bold tracking-[0.18em] text-caramel">{isSignup ? "CRAVE BEITRETEN" : "WILLKOMMEN ZURÜCK"}</p>
                    <h1 className="mt-3 text-4xl font-semibold tracking-[-0.065em] text-espresso">{isSignup ? "Mach jede Mahlzeit besonders." : "Schön, dass du da bist."}</h1>
                    <p className="mt-3 text-sm leading-6 text-bark">{isSignup ? "Erstelle ein Konto und koche aus dem, was du da hast." : "Melde dich an und koche mit Crave weiter."}</p>
                    <AuthForm mode={mode} />
                </div>
            </section>
        </main>
    );
}
