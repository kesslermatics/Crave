"use client";

import { useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";

import { apiUrl } from "@/lib/api";
import { LoadingIndicator } from "@/components/loading-indicator";

const tokenKey = "crave_access_token";

// Merkt sich das bereits geprüfte Token für die Dauer der Browser-Session (im Speicher),
// damit Seitenwechsel nicht jedes Mal einen Vollbild-Ladezustand zeigen.
let verifiedToken: string | null = null;

function isAlreadyVerified() {
    if (typeof window === "undefined" || verifiedToken === null) return false;
    return sessionStorage.getItem(tokenKey) === verifiedToken;
}

export function AuthGate({ children }: { children: ReactNode }) {
    const router = useRouter();
    const [isAuthorised, setIsAuthorised] = useState(isAlreadyVerified);

    useEffect(() => {
        const token = sessionStorage.getItem(tokenKey);
        const rejectSession = () => {
            verifiedToken = null;
            sessionStorage.removeItem(tokenKey);
            router.replace("/login");
        };
        if (!token) {
            verifiedToken = null;
            router.replace("/login");
            return;
        }

        // Bereits geprüft: Inhalt sofort zeigen, Token aber im Hintergrund erneut validieren.
        void fetch(`${apiUrl}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
            .then((response) => {
                if (!response.ok) {
                    rejectSession();
                    return;
                }
                verifiedToken = token;
                setIsAuthorised(true);
            })
            .catch(rejectSession);
    }, [router]);

    if (!isAuthorised) {
        return <main className="grid min-h-screen place-items-center bg-linen text-sm font-semibold">
            {/* Verzögert eingeblendet, damit schnelle Prüfungen nicht aufblitzen */}
            <span className="animate-fade-in [animation-delay:400ms]"><LoadingIndicator label="Dein Crave-Konto wird geprüft…" /></span>
        </main>;
    }

    return <>{children}</>;
}
