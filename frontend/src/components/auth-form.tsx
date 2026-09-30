"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { apiUrl } from "@/lib/api";

type AuthMode = "login" | "signup";

type AuthFormProps = {
    mode: AuthMode;
};

export function AuthForm({ mode }: AuthFormProps) {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const isSignup = mode === "signup";

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        setMessage("");
        setIsSubmitting(true);

        try {
            const response = await fetch(`${apiUrl}/auth/${mode}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });
            const payload: { detail?: string; message?: string; access_token?: string } = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(payload.detail ?? "Etwas ist schiefgelaufen. Bitte versuche es erneut.");
            }

            if (isSignup) {
                setMessage(payload.message ?? "Dein Konto wartet auf die Freischaltung.");
                return;
            }

            if (!payload.access_token) {
                throw new Error("Der Server hat keinen Zugriffstoken zurückgegeben.");
            }
            sessionStorage.setItem("crave_access_token", payload.access_token);
            router.replace("/?login=success");
        } catch (caughtError) {
            setError(caughtError instanceof Error ? caughtError.message : "Etwas ist schiefgelaufen. Bitte versuche es erneut.");
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
            <label className="block text-sm font-bold text-espresso">
                E-Mail-Adresse
                <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    className="mt-2 block w-full rounded-xl border border-espresso/15 bg-white px-4 py-3.5 text-base font-medium outline-none transition placeholder:text-bark/50 focus:border-caramel focus:ring-4 focus:ring-saffron/30"
                    placeholder="you@example.com"
                />
            </label>
            <label className="block text-sm font-bold text-espresso">
                Passwort
                <input
                    type="password"
                    name="password"
                    autoComplete={isSignup ? "new-password" : "current-password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    minLength={12}
                    maxLength={128}
                    className="mt-2 block w-full rounded-xl border border-espresso/15 bg-white px-4 py-3.5 text-base font-medium outline-none transition placeholder:text-bark/50 focus:border-caramel focus:ring-4 focus:ring-saffron/30"
                    placeholder="Mindestens 12 Zeichen"
                />
            </label>
            {isSignup && <p className="text-xs leading-5 text-bark">Nutze mindestens 12 Zeichen. Dein Konto muss vor der Anmeldung manuell freigeschaltet werden.</p>}
            {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{error}</p>}
            {message && <p role="status" className="rounded-xl bg-cream px-4 py-3 text-sm font-medium text-espresso">{message}</p>}
            <button disabled={isSubmitting} className="w-full rounded-full bg-caramel px-6 py-4 text-sm font-bold text-white shadow-[0_12px_24px_rgba(153,97,48,0.2)] transition hover:bg-espresso disabled:cursor-wait disabled:opacity-60">
                {isSubmitting ? "Bitte warten…" : isSignup ? "Konto erstellen" : "Anmelden"}
            </button>
            <p className="text-center text-sm text-bark">
                {isSignup ? "Hast du bereits ein Konto?" : "Neu bei Crave?"}{" "}
                <Link href={isSignup ? "/login" : "/signup"} className="font-bold text-caramel hover:text-espresso">
                    {isSignup ? "Anmelden" : "Konto erstellen"}
                </Link>
            </p>
        </form>
    );
}
