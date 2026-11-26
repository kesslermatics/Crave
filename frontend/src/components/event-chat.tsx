"use client";

import { FormEvent, ReactNode, RefObject } from "react";
import { motion } from "framer-motion";
import { ArrowUp } from "lucide-react";

import { FormattedMessage } from "@/components/formatted-message";
import { ease } from "@/components/event-stage";

/** Eigene Frage (rechts). `pending`: schon abgeschickt, Antwort steht noch aus. */
export function QuestionBubble({ author, children, pending = false }: { author?: string; children: ReactNode; pending?: boolean }) {
    return <motion.div initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: pending ? 0.75 : 1, y: 0, scale: 1 }} transition={{ duration: 0.25, ease }}
        className="ml-auto w-fit max-w-[85%] rounded-[1.25rem] rounded-br-md bg-espresso px-4 py-2.5 text-sm leading-6 break-words text-white sm:max-w-md">
        {author && <span className="block text-[11px] font-semibold text-white/60">{author}</span>}
        {children}
    </motion.div>;
}

/** Antwort von Crave (links). */
export function AnswerBubble({ text, footer }: { text: string; footer?: ReactNode }) {
    return <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease }}
        className="w-fit max-w-[92%] rounded-[1.25rem] rounded-bl-md bg-white px-4 py-2.5 text-sm leading-6 break-words text-espresso ring-1 ring-espresso/[0.06] sm:max-w-xl">
        <FormattedMessage text={text} />
        {footer}
    </motion.div>;
}

/** „Crave tippt…“ – drei hüpfende Punkte in einer Antwort-Blase. */
export function TypingBubble({ label }: { label: string }) {
    return <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease }}
        className="flex w-fit items-center gap-1.5 rounded-[1.25rem] rounded-bl-md bg-white px-4 py-3.5 ring-1 ring-espresso/[0.06]" role="status" aria-label={label}>
        {[0, 1, 2].map((index) => <motion.span key={index} aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-caramel"
            animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }} transition={{ duration: 0.8, repeat: Infinity, delay: index * 0.12, ease: "easeInOut" }} />)}
    </motion.div>;
}

/** Eingabezeile wie auf der Einkaufsliste: Tastatur bleibt nach dem Senden offen. */
export function ChatComposer({ id, value, onChange, onSubmit, placeholder, label, sendLabel, canSend, inputRef }: {
    id?: string; value: string; onChange: (value: string) => void; onSubmit: (event: FormEvent) => void; placeholder: string; label: string; sendLabel: string; canSend: boolean; inputRef?: RefObject<HTMLInputElement | null>;
}) {
    return <form onSubmit={onSubmit} className="flex items-center gap-2 rounded-full bg-white py-1.5 pr-1.5 pl-5 shadow-[0_1px_2px_rgba(66,52,33,0.05),0_16px_36px_-22px_rgba(66,52,33,0.35)] ring-1 ring-espresso/[0.08] transition-shadow focus-within:ring-2 focus-within:ring-caramel/40">
        <input id={id} ref={inputRef} value={value} onChange={(event) => onChange(event.target.value)} maxLength={800} placeholder={placeholder} aria-label={label} enterKeyHint="send" autoComplete="off"
            className="h-10 min-w-0 flex-1 bg-transparent text-base text-espresso outline-none placeholder:text-bark/45" />
        <motion.button type="submit" disabled={!canSend} aria-label={sendLabel} onPointerDown={(event) => event.preventDefault()} whileTap={{ scale: 0.86 }}
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors duration-200 ${canSend ? "bg-caramel text-white" : "bg-espresso/[0.07] text-espresso/35"}`}>
            <ArrowUp size={18} strokeWidth={2.5} aria-hidden="true" />
        </motion.button>
    </form>;
}
