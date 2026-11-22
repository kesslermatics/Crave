"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowUp, MessageCircleQuestion } from "lucide-react";
import { eventApi } from "@/lib/events";
import { FormattedMessage } from "@/components/formatted-message";
import { LoadingIndicator } from "@/components/loading-indicator";

type Message = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = ["Was hätten wir besser machen können?", "Wie geht die Originalzubereitung genau?", "Welche Handicaps haben uns am meisten geschadet?"];
// Matches the backend's ChatMessage limits (12 messages, 2000 characters each).
const HISTORY_MESSAGES = 12;
const HISTORY_CHARS = 2000;

/** Free follow-up chat after the jury: the coach knows recipes, handicaps, photos, verdicts, tips and guesses. Not counted as tips. */
export function EventDebrief({ eventId }: { eventId: string }) {
    const storageKey = `crave_debrief_${eventId}`;
    // Kept for this browser session, so the live reloads of the event page don't wipe the conversation.
    // Only rendered client-side (after the event was fetched), so reading sessionStorage here is safe.
    const [messages, setMessages] = useState<Message[]>(() => {
        try { return JSON.parse(sessionStorage.getItem(storageKey) ?? "[]") as Message[]; } catch { return []; }
    });
    const [question, setQuestion] = useState("");
    const [sending, setSending] = useState(false);
    const [error, setError] = useState("");
    useEffect(() => {
        try { sessionStorage.setItem(storageKey, JSON.stringify(messages)); } catch { /* storage unavailable */ }
    }, [messages, storageKey]);

    async function ask(text: string) {
        const trimmed = text.trim();
        if (!trimmed || sending) return;
        setSending(true); setError("");
        const history = messages.slice(-HISTORY_MESSAGES).map((m) => ({ role: m.role, content: m.content.slice(0, HISTORY_CHARS) }));
        setMessages((current) => [...current, { role: "user", content: trimmed }]);
        setQuestion("");
        try {
            const { answer } = await eventApi<{ answer: string }>(`/events/${eventId}/debrief`, { method: "POST", body: { question: trimmed, history } });
            setMessages((current) => [...current, { role: "assistant", content: answer }]);
        } catch (caught) {
            setError((caught as Error).message);
            setMessages((current) => current.slice(0, -1));
            setQuestion(trimmed);
        } finally { setSending(false); }
    }

    function submit(event: FormEvent) { event.preventDefault(); void ask(question); }

    return <section className="mt-14 border-t border-espresso/10 pt-10" aria-labelledby="debrief-title">
        <h2 id="debrief-title" className="flex items-center gap-2 text-xl font-semibold text-espresso"><MessageCircleQuestion size={20} className="text-caramel" aria-hidden="true" /> Nachbesprechung</h2>
        <p className="mt-1 text-sm text-bark">Jetzt ist alles aufgedeckt. Fragt den Koch-Coach, was ihr besser machen könnt – er kennt Rezepte, Handicaps, eure Fotos, das Jury-Urteil und eure Tipps. Kostet keine Strafpunkte.</p>
        <div className="mt-6 space-y-3">
            {messages.map((message, index) => message.role === "user"
                ? <p key={index} className="ml-auto max-w-[85%] rounded-[1.25rem] rounded-br-md bg-espresso px-4 py-2.5 text-sm break-words text-white sm:max-w-md">{message.content}</p>
                : <div key={index} className="max-w-[92%] rounded-[1.25rem] rounded-bl-md bg-white px-4 py-2.5 text-sm leading-6 break-words text-espresso shadow-[0_1px_2px_rgba(66,52,33,0.06)] sm:max-w-xl"><FormattedMessage text={message.content} /></div>)}
            {sending && <LoadingIndicator label="Der Coach schaut sich alles an…" />}
        </div>
        {messages.length === 0 && !sending && <div className="mt-2 flex flex-wrap gap-2">{SUGGESTIONS.map((suggestion) => <button key={suggestion} type="button" onClick={() => void ask(suggestion)} className="rounded-full bg-white px-4 py-2 text-left text-sm font-semibold text-espresso ring-1 ring-espresso/10 transition hover:ring-caramel/40">{suggestion}</button>)}</div>}
        {error && <p role="alert" className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{error}</p>}
        <form onSubmit={submit} className="mt-6 flex items-center gap-2 rounded-full border border-espresso/10 bg-white py-1.5 pr-1.5 pl-5 focus-within:border-caramel/50 focus-within:ring-4 focus-within:ring-caramel/10">
            <input value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={800} placeholder="z. B. Warum war unser Dessert zu flüssig?" aria-label="Frage für die Nachbesprechung" enterKeyHint="send" className="min-w-0 flex-1 bg-transparent py-2 text-base text-espresso outline-none placeholder:text-bark/50 sm:text-sm" />
            <button disabled={sending || question.trim().length < 2} aria-label="Frage senden" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-caramel text-white disabled:bg-espresso/15"><ArrowUp size={17} strokeWidth={2.5} aria-hidden="true" /></button>
        </form>
    </section>;
}
