"use client";

import Image from "next/image";
import { ChangeEvent, FormEvent, KeyboardEvent, useRef, useState } from "react";
import { Camera, Sparkles, X } from "lucide-react";

import { LoadingIndicator } from "@/components/loading-indicator";
import { compressImage } from "@/lib/image";

export const MAX_PHOTOS = 4;

type ComposerProps = {
    value: string;
    onChange: (value: string) => void;
    images: string[];
    onImagesChange: (images: string[]) => void;
    onSubmit: () => void;
    onError: (message: string) => void;
    isLoading: boolean;
    placeholder: string;
    submitLabel: string;
    loadingLabel: string;
    size?: "hero" | "compact";
    label: string;
};

/** Eingabefeld für Wünsche mit optionalen Fotos von Zutaten oder dem Kühlschrank. */
export function SuggestionComposer({ value, onChange, images, onImagesChange, onSubmit, onError, isLoading, placeholder, submitLabel, loadingLabel, size = "hero", label }: ComposerProps) {
    const fileRef = useRef<HTMLInputElement>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const isHero = size === "hero";
    const canSubmit = !isLoading && !isProcessing && (value.trim().length >= 8 || images.length > 0);

    async function addPhotos(event: ChangeEvent<HTMLInputElement>) {
        const files = Array.from(event.target.files ?? []);
        event.target.value = "";
        if (!files.length) return;
        const free = MAX_PHOTOS - images.length;
        if (free <= 0) { onError(`Du kannst höchstens ${MAX_PHOTOS} Fotos hinzufügen.`); return; }
        setIsProcessing(true);
        try {
            const compressed = await Promise.all(files.slice(0, free).map((file) => compressImage(file)));
            onImagesChange([...images, ...compressed]);
            if (files.length > free) onError(`Es wurden nur ${free} Foto${free === 1 ? "" : "s"} übernommen – maximal ${MAX_PHOTOS} sind möglich.`);
        } catch (caught) {
            onError(caught instanceof Error ? caught.message : "Das Foto konnte nicht verarbeitet werden.");
        } finally {
            setIsProcessing(false);
        }
    }

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!isLoading && !isProcessing) onSubmit();
    }

    // Enter sendet im kompakten Feld; im großen Feld Strg/⌘ + Enter (Enter macht dort einen Zeilenumbruch).
    function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
        if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
        if (isHero ? event.metaKey || event.ctrlKey : !event.shiftKey) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
        }
    }

    return <form onSubmit={submit} className="rounded-[1.75rem] bg-white text-left shadow-[0_1px_2px_rgba(66,52,33,0.05),0_20px_44px_-24px_rgba(66,52,33,0.35)] ring-1 ring-espresso/[0.08] transition focus-within:ring-2 focus-within:ring-caramel/40">
        {(images.length > 0 || isProcessing) && <ul className="flex flex-wrap gap-2 px-4 pt-4" aria-label="Angehängte Fotos">
            {images.map((image, index) => <li key={index} className="group relative h-16 w-16 animate-fade-in overflow-hidden rounded-xl bg-cream ring-1 ring-espresso/10">
                <Image src={image} alt={`Foto ${index + 1}`} fill unoptimized className="object-cover" />
                <button type="button" onClick={() => onImagesChange(images.filter((_, itemIndex) => itemIndex !== index))} className="absolute top-1 right-1 grid h-6 w-6 place-items-center rounded-full bg-espresso/75 text-white backdrop-blur transition hover:bg-espresso focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" aria-label={`Foto ${index + 1} entfernen`}><X size={13} strokeWidth={2.5} aria-hidden="true" /></button>
            </li>)}
            {isProcessing && <li className="h-16 w-16 rounded-xl bg-espresso/[0.06] motion-safe:animate-shimmer" aria-label="Foto wird verarbeitet" />}
        </ul>}

        <textarea value={value} onChange={(event) => onChange(event.target.value)} onKeyDown={onKeyDown} placeholder={placeholder} aria-label={label} rows={isHero ? 3 : 1}
            className={`block w-full resize-none bg-transparent px-5 text-espresso outline-none placeholder:text-bark/45 ${isHero ? "min-h-24 pt-5 text-base leading-7" : "min-h-12 pt-4 text-[15px] leading-6"}`} />

        <div className="flex items-center justify-between gap-2 px-3 pt-1 pb-3">
            <button type="button" onClick={() => fileRef.current?.click()} disabled={images.length >= MAX_PHOTOS || isProcessing} title="Foto von Zutaten oder Kühlschrank hinzufügen"
                className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-bark transition hover:bg-linen hover:text-espresso focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-caramel/40 disabled:opacity-50">
                <Camera size={18} strokeWidth={2} aria-hidden="true" />
                <span>{images.length ? `${images.length}/${MAX_PHOTOS} Fotos` : "Foto"}</span>
                <span className="sr-only">von Zutaten oder Kühlschrank hinzufügen</span>
            </button>
            {/* Ohne capture-Attribut bieten Handys Kamera und Galerie zur Auswahl an. */}
            <input ref={fileRef} type="file" accept="image/*" multiple onChange={addPhotos} className="hidden" tabIndex={-1} aria-hidden="true" />
            <button type="submit" disabled={!canSubmit}
                className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-caramel/40 focus-visible:ring-offset-2 ${isLoading ? "bg-caramel text-white opacity-90" : "bg-caramel text-white shadow-[0_8px_20px_-8px_rgba(153,97,48,0.6)] hover:bg-espresso disabled:bg-espresso/15 disabled:text-espresso/45 disabled:shadow-none"}`}>
                {isLoading ? <LoadingIndicator label={loadingLabel} light /> : <><Sparkles size={15} strokeWidth={2.25} aria-hidden="true" />{submitLabel}</>}
            </button>
        </div>
    </form>;
}
