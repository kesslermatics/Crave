"use client";

import { FormEvent, useState } from "react";
import { ArrowUp, Check, Sparkles, X } from "lucide-react";

import { apiUrl } from "@/lib/api";
import { diffRecipes, RecipeDiff, RecipeDraft } from "@/lib/recipe-diff";
import { FormattedMessage } from "@/components/formatted-message";
import { LoadingIndicator } from "@/components/loading-indicator";

type ChatLine = { role: "user" | "assistant"; content: string };
// A pending change request the user confirmed as a proposal; before it is applied.
type Proposal = { sourceMessage: string; text: string };
// A fully regenerated recipe with its computed diff, awaiting final confirmation.
type Review = { answer: string; recipe: RecipeDraft; diff: RecipeDiff };

const confirmButton = "inline-flex items-center justify-center gap-1.5 rounded-full bg-caramel px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-espresso focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-caramel/40 disabled:opacity-60";
const cancelButton = "inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold text-bark transition hover:bg-espresso/[0.05] hover:text-espresso focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-caramel/40 disabled:opacity-60";

export function RecipeEditChat({ buildRecipe, onApply }: { buildRecipe: () => RecipeDraft; onApply: (recipe: RecipeDraft) => void }) {
    const [messages, setMessages] = useState<ChatLine[]>([]);
    const [message, setMessage] = useState("");
    const [proposal, setProposal] = useState<Proposal | null>(null);
    const [review, setReview] = useState<Review | null>(null);
    const [isSending, setIsSending] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState("");

    const token = () => sessionStorage.getItem("crave_access_token");
    const busy = isSending || isGenerating;

    // Stage 1: classify the message as a question (answer it) or a change request (propose it).
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const question = message.trim();
        if (!question || busy) return;
        const history = messages;
        setMessages((items) => [...items, { role: "user", content: question }]);
        setMessage(""); setError(""); setProposal(null); setReview(null); setIsSending(true);
        try {
            const response = await fetch(`${apiUrl}/ai/recipe-edit-intent`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` }, body: JSON.stringify({ recipe: buildRecipe(), message: question, history }) });
            const result: { is_change_request?: boolean; message?: string; detail?: string } = await response.json().catch(() => ({}));
            if (!response.ok || !result.message) throw new Error(result.detail ?? "Der Rezept-Chat ist momentan nicht verfügbar.");
            if (result.is_change_request) {
                setProposal({ sourceMessage: question, text: result.message });
            } else {
                setMessages((items) => [...items, { role: "assistant", content: result.message! }]);
            }
        } catch (caught) { setError(caught instanceof Error ? caught.message : "Der Rezept-Chat ist momentan nicht verfügbar."); }
        finally { setIsSending(false); }
    }

    // Stage 2: the user accepted the proposal → regenerate the full recipe and compute the diff.
    async function generate() {
        if (!proposal || busy) return;
        setError(""); setIsGenerating(true);
        const current = buildRecipe();
        try {
            const response = await fetch(`${apiUrl}/ai/recipe-draft`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` }, body: JSON.stringify({ recipe: current, message: proposal.sourceMessage, history: messages }) });
            const result: { answer?: string; recipe?: RecipeDraft; detail?: string } = await response.json().catch(() => ({}));
            if (!response.ok || !result.recipe) throw new Error(result.detail ?? "Der Rezeptentwurf konnte nicht erstellt werden.");
            setProposal(null);
            setReview({ answer: result.answer ?? "", recipe: result.recipe, diff: diffRecipes(current, result.recipe) });
        } catch (caught) { setError(caught instanceof Error ? caught.message : "Der Rezeptentwurf konnte nicht erstellt werden."); }
        finally { setIsGenerating(false); }
    }

    function declineProposal() {
        if (!proposal) return;
        setMessages((items) => [...items, { role: "assistant", content: "Alles klar, ich habe nichts geändert. Sag mir, was du stattdessen möchtest." }]);
        setProposal(null);
    }

    // Stage 3: the user confirmed the diff → push every field into the editor.
    function applyReview() {
        if (!review) return;
        onApply(review.recipe);
        setMessages((items) => [...items, { role: "assistant", content: "Die Änderungen sind übernommen. Du kannst sie jetzt oben prüfen und als Änderung oder Kopie speichern." }]);
        setReview(null);
    }

    function declineReview() {
        setMessages((items) => [...items, { role: "assistant", content: "Okay, ich habe die Änderungen verworfen. Dein Rezept bleibt unverändert." }]);
        setReview(null);
    }

    return <section className="mt-20 border-t border-espresso/10 pt-12" aria-labelledby="recipe-edit-chat-title">
        <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-saffron/40 text-espresso" aria-hidden="true"><Sparkles size={16} strokeWidth={2.25} /></span>
            <div>
                <h2 id="recipe-edit-chat-title" className="text-xl font-semibold tracking-[-0.03em] text-espresso sm:text-2xl">Mit Crave anpassen</h2>
                <p className="mt-1 max-w-xl text-sm leading-6 text-bark">Stell Fragen zum Rezept oder beschreibe eine Änderung. Crave zeigt dir zuerst einen Vorschlag und danach genau, was sich ändert.</p>
            </div>
        </div>

        {(messages.length > 0 || isSending) && <div className="mt-8 space-y-3" aria-live="polite">
            {messages.map((entry, index) => <div key={`${entry.role}-${index}`} className={`flex motion-safe:animate-page-in ${entry.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] px-4 py-2.5 text-sm leading-6 sm:max-w-xl ${entry.role === "user" ? "rounded-[1.25rem] rounded-br-md bg-espresso whitespace-pre-line text-white" : "rounded-[1.25rem] rounded-bl-md bg-white text-espresso shadow-[0_1px_2px_rgba(66,52,33,0.06)]"}`}>
                    <span className="sr-only">{entry.role === "user" ? "Du: " : "Crave: "}</span>
                    {entry.role === "user" ? entry.content : <FormattedMessage text={entry.content} />}
                </div>
            </div>)}
            {isSending && <div className="flex justify-start"><div className="rounded-[1.25rem] rounded-bl-md bg-white px-4 py-3 text-sm shadow-[0_1px_2px_rgba(66,52,33,0.06)]"><LoadingIndicator label="Crave denkt nach…" /></div></div>}
        </div>}

        {/* Stage 2 — proposal of what would change */}
        {proposal && <div className="mt-6 rounded-2xl border border-caramel/25 bg-saffron/[0.12] p-5 motion-safe:animate-page-in">
            <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] text-caramel"><Sparkles size={14} strokeWidth={2.25} aria-hidden="true" />VORSCHLAG</p>
            <div className="mt-2 text-sm leading-6 text-espresso"><FormattedMessage text={proposal.text} /></div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
                <button type="button" onClick={generate} disabled={busy} className={confirmButton}>{isGenerating ? <LoadingIndicator label="Wird erstellt…" light /> : <><Check size={15} strokeWidth={2.5} aria-hidden="true" />Vorschlag umsetzen</>}</button>
                <button type="button" onClick={declineProposal} disabled={busy} className={cancelButton}><X size={15} strokeWidth={2.5} aria-hidden="true" />Abbrechen</button>
            </div>
        </div>}

        {/* Stage 3 — diff of the regenerated recipe */}
        {review && <div className="mt-6 rounded-2xl border border-espresso/10 bg-white p-5 shadow-[0_1px_2px_rgba(66,52,33,0.06)] motion-safe:animate-page-in">
            <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] text-caramel"><Sparkles size={14} strokeWidth={2.25} aria-hidden="true" />DAS ÄNDERT SICH</p>
            {review.answer && <div className="mt-2 text-sm leading-6 text-bark"><FormattedMessage text={review.answer} /></div>}

            {review.diff.isEmpty
                ? <p className="mt-4 text-sm leading-6 text-bark">Crave hat keine Änderungen am Rezept vorgenommen.</p>
                : <div className="mt-4 space-y-4">
                    {review.diff.fields.length > 0 && <ul className="space-y-2">
                        {review.diff.fields.map((change) => <li key={change.label} className="text-sm leading-6">
                            <span className="font-semibold text-espresso">{change.label}: </span>
                            <span className="text-red-700 line-through decoration-red-700/50">{change.before}</span>
                            <span className="px-1.5 text-bark/60" aria-hidden="true">→</span>
                            <span className="font-medium text-green-700">{change.after}</span>
                        </li>)}
                    </ul>}

                    {(review.diff.ingredients.removed.length > 0 || review.diff.ingredients.added.length > 0 || review.diff.ingredients.changed.length > 0) && <div>
                        <p className="text-[13px] font-semibold text-espresso">Zutaten</p>
                        <ul className="mt-1.5 space-y-1 text-sm leading-6">
                            {review.diff.ingredients.removed.map((item) => <li key={`r-${item}`} className="text-red-700 line-through decoration-red-700/50">{item}</li>)}
                            {review.diff.ingredients.added.map((item) => <li key={`a-${item}`} className="text-green-700">{item}</li>)}
                            {review.diff.ingredients.changed.map((item) => <li key={`c-${item.name}`}>
                                <span className="font-medium text-espresso">{item.name}: </span>
                                <span className="text-red-700 line-through decoration-red-700/50">{item.before}</span>
                                <span className="px-1.5 text-bark/60" aria-hidden="true">→</span>
                                <span className="font-medium text-green-700">{item.after}</span>
                            </li>)}
                        </ul>
                    </div>}

                    {review.diff.steps.length > 0 && <div>
                        <p className="text-[13px] font-semibold text-espresso">Zubereitung</p>
                        <ul className="mt-1.5 space-y-2 text-sm leading-6">
                            {review.diff.steps.map((change) => <li key={`s-${change.index}`}>
                                <span className="font-medium text-espresso">Schritt {change.index + 1}</span>
                                {change.before && <span className="mt-0.5 block text-red-700 line-through decoration-red-700/50">{change.before}</span>}
                                {change.after && <span className="mt-0.5 block text-green-700">{change.after}</span>}
                            </li>)}
                        </ul>
                    </div>}
                </div>}

            <div className="mt-5 flex flex-wrap items-center gap-2">
                <button type="button" onClick={applyReview} className={confirmButton}><Check size={15} strokeWidth={2.5} aria-hidden="true" />Übernehmen</button>
                <button type="button" onClick={declineReview} className={cancelButton}><X size={15} strokeWidth={2.5} aria-hidden="true" />Verwerfen</button>
            </div>
        </div>}

        {error && <p role="alert" className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{error}</p>}

        <form onSubmit={submit} className="mt-6 flex items-center gap-2 rounded-full border border-espresso/10 bg-white py-1.5 pr-1.5 pl-5 shadow-[0_1px_2px_rgba(66,52,33,0.05)] transition focus-within:border-caramel/50 focus-within:ring-4 focus-within:ring-caramel/10">
            <input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="z. B. Ersetze Zucker durch Erythrit" aria-label="Frage oder Änderungswunsch an Crave" disabled={busy || Boolean(proposal) || Boolean(review)} className="min-w-0 flex-1 bg-transparent py-2 text-sm text-espresso outline-none placeholder:text-bark/50 disabled:opacity-60" />
            <button disabled={busy || !message.trim() || Boolean(proposal) || Boolean(review)} aria-label="Senden" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-caramel text-white transition hover:bg-espresso focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-caramel/40 disabled:bg-espresso/15 disabled:text-espresso/40">
                <ArrowUp size={17} strokeWidth={2.5} aria-hidden="true" />
            </button>
        </form>
        {(proposal || review) && <p className="mt-2 px-5 text-xs text-bark/70">Bitte entscheide zuerst über den {proposal ? "Vorschlag" : "Änderungsvorschlag"} oben, bevor du weiterschreibst.</p>}
    </section>;
}
