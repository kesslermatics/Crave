"use client";

import { FormEvent, useState } from "react";

import { apiUrl } from "@/lib/api";
import { LoadingIndicator } from "@/components/loading-indicator";

type RecipeContext = object;
type ChatLine = { role: "user" | "assistant"; content: string };

export function RecipeChat({ recipe, editable = false, onDraft }: { recipe: RecipeContext; editable?: boolean; onDraft?: (draft: RecipeContext) => void }) {
    const [messages, setMessages] = useState<ChatLine[]>([]);
    const [message, setMessage] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState("");

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const question = message.trim();
        if (!question || isSending) return;
        const updated = [...messages, { role: "user" as const, content: question }];
        setMessages(updated); setMessage(""); setError(""); setIsSending(true);
        try {
            const token = sessionStorage.getItem("crave_access_token");
            const response = await fetch(`${apiUrl}/ai/${editable ? "recipe-draft" : "recipe-chat"}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ recipe, message: question, history: messages }) });
            const result: { answer?: string; recipe?: RecipeContext; detail?: string } = await response.json().catch(() => ({}));
            if (!response.ok || !result.answer) throw new Error(result.detail ?? "Der Rezept-Chat ist momentan nicht verfügbar.");
            setMessages((items) => [...items, { role: "assistant", content: result.answer! }]);
            if (editable && result.recipe) onDraft?.(result.recipe);
        } catch (caught) { setError(caught instanceof Error ? caught.message : "Der Rezept-Chat ist momentan nicht verfügbar."); }
        finally { setIsSending(false); }
    }

    return <section className="mt-8 rounded-[2rem] border border-espresso/10 bg-sand/30 p-5 sm:p-7"><div><p className="text-[11px] font-bold tracking-[0.18em] text-caramel">CRAVE ASSISTANT</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-espresso">{editable ? "Rezept gemeinsam anpassen" : "Fragen zum Rezept"}</h2><p className="mt-1 text-sm leading-6 text-bark">{editable ? "Beschreibe eine Änderung. Crave erstellt sofort einen neuen Entwurf und berücksichtigt die Folgen für Zutaten, Schritte und Nährwerte." : "Frage nach Alternativen, Mengen, Zutaten oder einzelnen Zubereitungsschritten."}</p></div><div className="mt-5 space-y-3">{messages.map((entry, index) => <div key={`${entry.role}-${index}`} className={`max-w-xl rounded-2xl px-4 py-3 text-sm leading-6 ${entry.role === "user" ? "ml-auto bg-caramel text-white" : "bg-white text-bark"}`}><span className="mb-1 block text-[10px] font-bold tracking-[0.12em] opacity-70">{entry.role === "user" ? "DU" : "CRAVE"}</span>{entry.content}</div>)}{isSending && <div className="rounded-2xl bg-white px-4 py-3 text-sm text-bark"><LoadingIndicator label="Crave denkt nach…" /></div>}</div>{error && <p role="alert" className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{error}</p>}<form onSubmit={submit} className="mt-5 flex gap-3"><input value={message} onChange={(event) => setMessage(event.target.value)} placeholder={editable ? "z. B. Ersetze Joghurt durch Skyr" : "z. B. Welche Käse-Alternative passt?"} className="min-w-0 flex-1 rounded-2xl border border-espresso/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-caramel focus:ring-4 focus:ring-caramel/10" /><button disabled={isSending} className="rounded-2xl bg-espresso px-5 py-3 text-sm font-bold text-white transition hover:bg-caramel disabled:opacity-60">{isSending ? <LoadingIndicator label="" light /> : "Senden"}</button></form></section>;
}
