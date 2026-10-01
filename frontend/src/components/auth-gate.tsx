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

/**
 * Zeigt Inhalte nur angemeldeten Nutzern. Das ist reine UI-Steuerung – das Backend prüft jedes Token selbst.
 * `allowOffline`: Seiten mit rein lokalen Daten (Einkaufsliste) bleiben ohne Netz auch ohne Token nutzbar.
 */
export function AuthGate({ children, allowOffline = false }: { children: ReactNode; allowOffline?: boolean }) {
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
            if (allowOffline && !navigator.onLine) {
                const offlineTimer = window.setTimeout(() => setIsAuthorised(true), 0);
                return () => window.clearTimeout(offlineTimer);
            }
            router.replace("/login");
            return;
        }

        // Bereits geprüft: Inhalt sofort zeigen, Token aber im Hintergrund erneut validieren.
        void fetch(`${apiUrl}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
            .then((response) => {
                // Nur ein abgelehntes Token meldet ab – Serverfehler (5xx) sollen niemanden ausloggen.
                if (response.status === 401 || response.status === 403) {
                    rejectSession();
                    return;
                }
                if (response.ok) verifiedToken = token;
                setIsAuthorised(true);
            })
            // Kein Netz: angemeldet bleiben, damit z. B. die Einkaufsliste offline nutzbar ist.
            .catch(() => setIsAuthorised(true));
    }, [allowOffline, router]);

    if (!isAuthorised) {
        return <main className="grid min-h-screen place-items-center bg-linen text-sm font-semibold">
            {/* Verzögert eingeblendet, damit schnelle Prüfungen nicht aufblitzen */}
            <span className="animate-fade-in [animation-delay:400ms]"><LoadingIndicator label="Dein Crave-Konto wird geprüft…" /></span>
        </main>;
    }

    return <>{children}</>;
}
