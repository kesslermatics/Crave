"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ReactNode, useCallback, useEffect, useRef, useState } from "react";

export type ToastState = { id: number; message: string; action?: ReactNode } | null;

/** Kurzlebige Rückmeldung (z. B. „Hinzugefügt · Ansehen“ oder „Abgehakt · Rückgängig“). */
export function useToast(duration = 5000) {
    const [toast, setToast] = useState<ToastState>(null);
    const timer = useRef<number | null>(null);
    const hide = useCallback(() => { if (timer.current) window.clearTimeout(timer.current); setToast(null); }, []);
    const show = useCallback((message: string, action?: ReactNode) => {
        if (timer.current) window.clearTimeout(timer.current);
        // Ein sichtbarer Toast behält seine ID: Er aktualisiert sich an Ort und Stelle, statt neu aufzuploppen.
        setToast((current) => ({ id: current?.id ?? Date.now(), message, action }));
        timer.current = window.setTimeout(() => setToast(null), duration);
    }, [duration]);
    useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);
    return { toast, show, hide };
}

/** `onDismiss`: Toast lässt sich nach unten wegwischen. */
export function Toast({ toast, onDismiss }: { toast: ToastState; onDismiss?: () => void }) {
    return <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-5 md:bottom-8" role="status" aria-live="polite">
        <AnimatePresence>
            {toast && <motion.div key={toast.id}
                initial={{ opacity: 0, y: 24, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.97, transition: { duration: 0.18, ease: "easeIn" } }}
                transition={{ type: "spring", stiffness: 440, damping: 32 }}
                drag={onDismiss ? "y" : false}
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0.05, bottom: 0.7 }}
                onDragEnd={(_, info) => { if (info.offset.y > 28 || info.velocity.y > 400) onDismiss?.(); }}
                className="pointer-events-auto flex max-w-md items-center gap-4 rounded-full bg-espresso py-2.5 pr-2.5 pl-5 text-sm text-white shadow-[0_16px_40px_-12px_rgba(66,52,33,0.55)]">
                <motion.span key={toast.message} initial={{ opacity: 0.3 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className="min-w-0 truncate">{toast.message}</motion.span>
                {toast.action}
            </motion.div>}
        </AnimatePresence>
    </div>;
}

export const toastActionClass = "shrink-0 rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-white/25 active:scale-95 active:bg-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60";
