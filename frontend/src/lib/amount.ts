const fractions: [number, string][] = [[0.25, "¼"], [1 / 3, "⅓"], [0.5, "½"], [2 / 3, "⅔"], [0.75, "¾"]];
const preciseUnits = new Set(["g", "kg", "ml", "l"]);
const number = (value: number, digits: number) => new Intl.NumberFormat("de-DE", { maximumFractionDigits: digits }).format(value);

/**
 * Formatiert Mengen gut lesbar: 1½ EL, 250 g, 0,3 l.
 * Gewichte/Volumen werden sinnvoll gerundet, Stück/EL/TL als Brüche dargestellt.
 */
export function formatAmount(amount: number, unit = ""): string {
    if (!Number.isFinite(amount) || amount <= 0) return "";
    if (preciseUnits.has(unit.toLowerCase())) {
        if (amount >= 100) return number(Math.round(amount / 5) * 5, 0);
        if (amount >= 10) return number(Math.round(amount), 0);
        return number(amount, 2);
    }
    const whole = Math.floor(amount);
    const rest = amount - whole;
    if (rest < 0.08) return number(whole, 0);
    if (rest > 0.92) return number(whole + 1, 0);
    const fraction = fractions.find(([valueOf]) => Math.abs(rest - valueOf) < 0.06);
    if (fraction) return `${whole > 0 ? whole : ""}${fraction[1]}`;
    return number(amount, 1);
}

/** Menge + Einheit als ein String, z. B. "200 g" oder "2 Stück". */
export function formatQuantity(amount: number | null, unit: string): string {
    if (amount === null || amount <= 0) return unit;
    const formatted = formatAmount(amount, unit);
    return unit ? `${formatted} ${unit}` : formatted;
}
