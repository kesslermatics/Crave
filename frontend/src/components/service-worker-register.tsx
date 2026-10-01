"use client";

import { useEffect } from "react";

/** Registriert den Service Worker für Offline-Zugriff – nur im Produktions-Build, damit lokal nichts veraltet gecacht wird. */
export function ServiceWorkerRegister() {
    useEffect(() => {
        if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
        navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => undefined);
    }, []);
    return null;
}
