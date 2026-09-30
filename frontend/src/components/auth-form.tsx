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
                throw new Error(payload.detail ?? "Something went wrong. Please try again.");
            }

            if (isSignup) {
                setMessage(payload.message ?? "Your account is awaiting activation.");
                return;
            }

            if (!payload.access_token) {
                throw new Error("The server did not return an access token.");
            }
            sessionStorage.setItem("crave_access_token", payload.access_token);
            router.replace("/?login=success");
        } catch (caughtError) {
            setError(caughtError instanceof Error ? caughtError.message : "Something went wrong. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
            <label className="block text-sm font-bold text-espresso">
                Email address
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
                Password
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
                    placeholder="At least 12 characters"
                />
            </label>
            {isSignup && <p className="text-xs leading-5 text-bark">Use at least 12 characters. Your account will need manual activation before you can sign in.</p>}
            {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{error}</p>}
            {message && <p role="status" className="rounded-xl bg-cream px-4 py-3 text-sm font-medium text-espresso">{message}</p>}
            <button disabled={isSubmitting} className="w-full rounded-full bg-caramel px-6 py-4 text-sm font-bold text-white shadow-[0_12px_24px_rgba(153,97,48,0.2)] transition hover:bg-espresso disabled:cursor-wait disabled:opacity-60">
                {isSubmitting ? "Please wait…" : isSignup ? "Create account" : "Log in"}
            </button>
            <p className="text-center text-sm text-bark">
                {isSignup ? "Already have an account?" : "New to Crave?"}{" "}
                <Link href={isSignup ? "/login" : "/signup"} className="font-bold text-caramel hover:text-espresso">
                    {isSignup ? "Log in" : "Create an account"}
                </Link>
            </p>
        </form>
    );
}
