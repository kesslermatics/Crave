"use client";

import { ReactNode, useCallback, useEffect, useRef, useState } from "react";

export type ToastState = { id: number; message: string; action?: ReactNode } | null;

/** Kurzlebige Rückmeldung (z. B. „Hinzugefügt · Ansehen“ oder „Abgehakt · Rückgängig“). */
export function useToast(duration = 5000) {
    const [toast, setToast] = useState<ToastState>(null);
    const timer = useRef<number | null>(null);
    const hide = useCallback(() => { if (timer.current) window.clearTimeout(timer.current); setToast(null); }, []);
    const show = useCallback((message: string, action?: ReactNode) => {
        if (timer.current) window.clearTimeout(timer.current);
        setToast({ id: Date.now(), message, action });
        timer.current = window.setTimeout(() => setToast(null), duration);
    }, [duration]);
    useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);
    return { toast, show, hide };
}

export function Toast({ toast }: { toast: ToastState }) {
    return <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-5 md:bottom-8" role="status" aria-live="polite">
        {toast && <div key={toast.id} className="pointer-events-auto flex max-w-md animate-page-in items-center gap-4 rounded-full bg-espresso py-2.5 pr-2.5 pl-5 text-sm text-white shadow-[0_16px_40px_-12px_rgba(66,52,33,0.55)]">
            <span className="min-w-0 truncate">{toast.message}</span>
            {toast.action}
        </div>}
    </div>;
}

export const toastActionClass = "shrink-0 rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60";
