"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { MessageCircleQuestion } from "lucide-react";
import { eventApi } from "@/lib/events";
import { AnswerBubble, ChatComposer, QuestionBubble, TypingBubble } from "@/components/event-chat";

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
    const endRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        try { sessionStorage.setItem(storageKey, JSON.stringify(messages)); } catch { /* storage unavailable */ }
    }, [messages, storageKey]);

    const scrollToEnd = () => window.requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));

    async function ask(text: string) {
        const trimmed = text.trim();
        if (!trimmed || sending) return;
        setSending(true); setError("");
        const history = messages.slice(-HISTORY_MESSAGES).map((m) => ({ role: m.role, content: m.content.slice(0, HISTORY_CHARS) }));
        setMessages((current) => [...current, { role: "user", content: trimmed }]);
        setQuestion("");
        scrollToEnd();
        try {
            const { answer } = await eventApi<{ answer: string }>(`/events/${eventId}/debrief`, { method: "POST", body: { question: trimmed, history } });
            setMessages((current) => [...current, { role: "assistant", content: answer }]);
            scrollToEnd();
        } catch (caught) {
            setError((caught as Error).message);
            setMessages((current) => current.slice(0, -1));
            setQuestion(trimmed);
        } finally { setSending(false); }
    }

    function submit(event: FormEvent) { event.preventDefault(); void ask(question); }

    return <section className="mt-10" aria-labelledby="debrief-title">
        <h2 id="debrief-title" className="flex items-center gap-2 text-xl font-semibold tracking-[-0.02em] text-espresso"><MessageCircleQuestion size={20} className="text-caramel" aria-hidden="true" /> Nachbesprechung</h2>
        <p className="mt-1 text-sm leading-6 text-bark">Jetzt ist alles aufgedeckt. Fragt den Koch-Coach, was ihr besser machen könnt – er kennt Rezepte, Handicaps, eure Fotos, das Jury-Urteil und eure Tipps. Kostet keine Strafpunkte.</p>
        <div className="mt-5 space-y-3" aria-live="polite">
            {messages.map((message, index) => message.role === "user"
                ? <QuestionBubble key={index}>{message.content}</QuestionBubble>
                : <AnswerBubble key={index} text={message.content} />)}
            {sending && <TypingBubble label="Der Coach schaut sich alles an…" />}
            <div ref={endRef} />
        </div>
        {messages.length === 0 && !sending && <div className="flex flex-wrap gap-2">{SUGGESTIONS.map((suggestion) => <button key={suggestion} type="button" onClick={() => void ask(suggestion)} className="rounded-full bg-white px-4 py-2 text-left text-sm font-medium text-espresso ring-1 ring-espresso/10 transition hover:ring-caramel/40 active:scale-[0.97]">{suggestion}</button>)}</div>}
        {error && <p role="alert" className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{error}</p>}
        <div className="mt-5">
            <ChatComposer value={question} onChange={setQuestion} onSubmit={submit} placeholder="z. B. Warum war unser Dessert zu flüssig?" label="Frage für die Nachbesprechung" sendLabel="Frage senden" canSend={!sending && question.trim().length >= 2} />
        </div>
    </section>;
}
