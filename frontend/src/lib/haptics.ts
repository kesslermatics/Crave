/** Kurzes Antippen-Feedback (Android; iOS-Safari kennt keine Vibration und ignoriert es). */
export function tick() {
    try { navigator.vibrate?.(8); } catch { /* egal */ }
}
