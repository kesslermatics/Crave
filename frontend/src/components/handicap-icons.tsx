"use client";
/* eslint-disable @next/next/no-img-element -- icons are generated data URLs */
import { useEffect, useState } from "react";
import { eventApi } from "@/lib/events";

export const TIER_STYLE: Record<string, string> = {
    light: "bg-saffron/30 text-espresso",
    medium: "bg-orange-100 text-orange-800",
    heavy: "bg-red-100 text-red-700",
};

// AI-generated icons, loaded once per page session and shared by every HandicapIcon.
let cache: Record<string, string> | null = null;
let pending: Promise<Record<string, string>> | null = null;
const listeners = new Set<(icons: Record<string, string>) => void>();

export function loadHandicapIcons(force = false): Promise<Record<string, string>> {
    if (cache && !force) return Promise.resolve(cache);
    if (!pending || force) {
        pending = eventApi<{ icons: Record<string, string> }>("/handicaps/icons")
            .then((result) => { cache = result.icons; listeners.forEach((listener) => listener(result.icons)); return result.icons; })
            .catch(() => cache ?? {})
            .finally(() => { pending = null; });
    }
    return pending;
}

function useHandicapIcons() {
    const [icons, setIcons] = useState<Record<string, string>>(cache ?? {});
    useEffect(() => {
        listeners.add(setIcons);
        void loadHandicapIcons();
        return () => { listeners.delete(setIcons); };
    }, []);
    return icons;
}

/** Generated icon; until it exists, a tier-coloured placeholder with the first letter of the title. */
export function HandicapIcon({ id, tier, title = "", size = 18, className = "h-10 w-10" }: { id: string; tier: string; title?: string; size?: number; className?: string }) {
    const src = useHandicapIcons()[id];
    return src
        ? <img src={src} alt="" aria-hidden="true" className={`${className} shrink-0 rounded-2xl object-cover`} />
        : <span className={`${className} grid shrink-0 place-items-center rounded-2xl font-bold ${TIER_STYLE[tier] ?? TIER_STYLE.heavy}`} style={{ fontSize: size }} aria-hidden="true">{title.replace(/^(Der|Die|Das)\s+/, "").charAt(0) || "?"}</span>;
}
