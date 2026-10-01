"use client";

import { FormEvent, useState } from "react";
import { ArrowUp, Sparkles } from "lucide-react";

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

    return <section className="mt-20 border-t border-espresso/10 pt-12" aria-labelledby="recipe-chat-title">
        <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-saffron/40 text-espresso" aria-hidden="true"><Sparkles size={16} strokeWidth={2.25} /></span>
            <div>
                <h2 id="recipe-chat-title" className="text-xl font-semibold tracking-[-0.03em] text-espresso sm:text-2xl">{editable ? "Mit Crave anpassen" : "Fragen zum Rezept"}</h2>
                <p className="mt-1 max-w-xl text-sm leading-6 text-bark">{editable ? "Beschreibe eine Änderung. Crave passt Zutaten, Schritte und Nährwerte direkt an." : "Frag nach Alternativen, Mengen, Zutaten oder einzelnen Schritten."}</p>
            </div>
        </div>

        {(messages.length > 0 || isSending) && <div className="mt-8 space-y-3" aria-live="polite">
            {messages.map((entry, index) => <div key={`${entry.role}-${index}`} className={`flex motion-safe:animate-page-in ${entry.role === "user" ? "justify-end" : "justify-start"}`}>
                <p className={`max-w-[85%] px-4 py-2.5 text-sm leading-6 whitespace-pre-line sm:max-w-xl ${entry.role === "user" ? "rounded-[1.25rem] rounded-br-md bg-espresso text-white" : "rounded-[1.25rem] rounded-bl-md bg-white text-espresso shadow-[0_1px_2px_rgba(66,52,33,0.06)]"}`}>
                    <span className="sr-only">{entry.role === "user" ? "Du: " : "Crave: "}</span>{entry.content}
                </p>
            </div>)}
            {isSending && <div className="flex justify-start"><div className="rounded-[1.25rem] rounded-bl-md bg-white px-4 py-3 text-sm shadow-[0_1px_2px_rgba(66,52,33,0.06)]"><LoadingIndicator label="Crave denkt nach…" /></div></div>}
        </div>}

        {error && <p role="alert" className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{error}</p>}

        <form onSubmit={submit} className="mt-6 flex items-center gap-2 rounded-full border border-espresso/10 bg-white py-1.5 pr-1.5 pl-5 shadow-[0_1px_2px_rgba(66,52,33,0.05)] transition focus-within:border-caramel/50 focus-within:ring-4 focus-within:ring-caramel/10">
            <input value={message} onChange={(event) => setMessage(event.target.value)} placeholder={editable ? "z. B. Ersetze Joghurt durch Skyr" : "z. B. Welche Käse-Alternative passt?"} aria-label={editable ? "Änderungswunsch an Crave" : "Frage an Crave"} className="min-w-0 flex-1 bg-transparent py-2 text-sm text-espresso outline-none placeholder:text-bark/50" />
            <button disabled={isSending || !message.trim()} aria-label="Senden" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-caramel text-white transition hover:bg-espresso focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-caramel/40 disabled:bg-espresso/15 disabled:text-espresso/40">
                <ArrowUp size={17} strokeWidth={2.5} aria-hidden="true" />
            </button>
        </form>
    </section>;
}
