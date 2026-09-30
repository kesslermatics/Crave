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
                    <p className="text-[11px] font-bold tracking-[0.18em] text-saffron">SLOW FOOD, SMARTLY MADE</p>
                    <h1 className="mt-4 text-5xl font-semibold leading-[1.02] tracking-[-0.07em]">A better answer to “what&apos;s for dinner?”</h1>
                    <p className="mt-5 text-base leading-7 text-white/70">Turn your ingredients, nutrition goals and mood into something genuinely good.</p>
                </div>
                <p className="text-xs text-white/50">Crave culinary intelligence</p>
            </section>
            <section className="flex items-center justify-center px-5 py-10 sm:px-8">
                <div className="w-full max-w-md">
                    <Link href="/" className="flex items-center gap-2 font-bold tracking-[-0.07em] lg:hidden">
                        <span className="grid h-8 w-8 place-items-center rounded-xl bg-saffron text-[17px] shadow-sm" aria-hidden="true">🍳</span>
                        <span className="text-2xl">crave</span>
                    </Link>
                    <p className="mt-12 text-[11px] font-bold tracking-[0.18em] text-caramel">{isSignup ? "JOIN CRAVE" : "WELCOME BACK"}</p>
                    <h1 className="mt-3 text-4xl font-semibold tracking-[-0.065em] text-espresso">{isSignup ? "Make every meal count." : "Good to see you."}</h1>
                    <p className="mt-3 text-sm leading-6 text-bark">{isSignup ? "Create an account to start cooking with what you have." : "Log in to continue cooking with Crave."}</p>
                    <AuthForm mode={mode} />
                </div>
            </section>
        </main>
    );
}
