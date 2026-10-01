import { CookingPot } from "lucide-react";

export type Appliance = "none" | "thermomix" | "monsieur_cuisine";

export const applianceLabels: Record<Exclude<Appliance, "none">, { label: string; short: string; className: string }> = {
    thermomix: { label: "Thermomix", short: "TM", className: "bg-espresso text-white" },
    monsieur_cuisine: { label: "Monsieur Cuisine", short: "MC", className: "bg-caramel text-white" },
};

/** Gut sichtbares Kennzeichen für Rezepte, die für eine Küchenmaschine geschrieben sind. */
export function ApplianceBadge({ appliance, size = "md", className = "" }: { appliance?: string | null; size?: "sm" | "md"; className?: string }) {
    if (!appliance || !(appliance in applianceLabels)) return null;
    const info = applianceLabels[appliance as keyof typeof applianceLabels];
    const sizing = size === "sm" ? "gap-1 px-2 py-0.5 text-[10px]" : "gap-1.5 px-3 py-1 text-xs";
    return <span className={`inline-flex items-center rounded-full font-semibold shadow-sm ${sizing} ${info.className} ${className}`} title={`${info.label}-Rezept`}>
        <CookingPot size={size === "sm" ? 11 : 13} strokeWidth={2.25} aria-hidden="true" />
        <span>{info.label}</span>
    </span>;
}
