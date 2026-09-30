"use client";

import { motion } from "framer-motion";

export function LoadingIndicator({ label = "Crave arbeitet daran…", light = false }: { label?: string; light?: boolean }) {
    return <span className={`inline-flex items-center justify-center gap-2 ${light ? "text-white" : "text-bark"}`} aria-live="polite" aria-label={label}>
        <span className="flex items-end gap-1" aria-hidden="true">
            {[0, 1, 2].map((index) => <motion.span key={index} className={`h-1.5 w-1.5 rounded-full ${light ? "bg-white" : "bg-caramel"}`} animate={{ y: [0, -5, 0], opacity: [0.45, 1, 0.45] }} transition={{ duration: 0.72, repeat: Infinity, delay: index * 0.12, ease: "easeInOut" }} />)}
        </span>
        <span>{label}</span>
    </span>;
}
