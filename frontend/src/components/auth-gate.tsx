"use client";

import { useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";

import { apiUrl } from "@/lib/api";

export function AuthGate({ children }: { children: ReactNode }) {
    const router = useRouter();
    const [isAuthorised, setIsAuthorised] = useState(false);

    useEffect(() => {
        const token = sessionStorage.getItem("crave_access_token");
        if (!token) {
            router.replace("/login");
            return;
        }

        void fetch(`${apiUrl}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
            .then((response) => {
                if (!response.ok) {
                    sessionStorage.removeItem("crave_access_token");
                    router.replace("/login");
                    return;
                }
                setIsAuthorised(true);
            })
            .catch(() => {
                sessionStorage.removeItem("crave_access_token");
                router.replace("/login");
            });
    }, [router]);

    if (!isAuthorised) {
        return <main className="grid min-h-screen place-items-center bg-linen text-sm font-bold text-bark">Dein Crave-Konto wird geprüft…</main>;
    }

    return <>{children}</>;
}