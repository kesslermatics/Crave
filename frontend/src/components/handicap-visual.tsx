"use client";
/* eslint-disable @next/next/no-img-element -- images are generated data URLs */
import { useEffect, useRef } from "react";
import { Gift } from "lucide-react";
import type { DropItem } from "@/lib/events";

type Visual = Pick<DropItem, "name" | "image_data" | "handicap">;

/** Downscales the picture onto a tiny canvas and lets the browser blow it up with hard pixel edges. */
function PixelCanvas({ src, cells, grid = false }: { src: string; cells: number; grid?: boolean }) {
    const canvas = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const image = new Image();
        image.onload = () => canvas.current?.getContext("2d")?.drawImage(image, 0, 0, cells, cells);
        image.src = src;
    }, [src, cells]);
    return <span className="relative block h-full w-full">
        <canvas ref={canvas} width={cells} height={cells} className="h-full w-full [image-rendering:pixelated]" />
        {grid && <span aria-hidden="true" className="absolute inset-0" style={{ backgroundImage: "linear-gradient(to right, rgba(252,251,246,0.9) 2px, transparent 2px), linear-gradient(to bottom, rgba(252,251,246,0.9) 2px, transparent 2px)", backgroundSize: `${100 / cells}% ${100 / cells}%` }} />}
    </span>;
}

const IMAGE_EFFECT: Record<string, string> = {
    anagramm_nebel: "scale-110 blur-[5px]",
    vokal_schwund: "sepia",
    graustufen: "grayscale",
    spiegelwelt: "-scale-x-100",
    lsd_trip: "hue-rotate-180 saturate-200",
    makro_zoom: "scale-[4]",
};

/** Ingredient picture with the handicap's visual effect (CSS filter, mirror, zoom or pixelation). */
export function HandicapPicture({ item, size = "h-16 w-16" }: { item: Visual; size?: string }) {
    const effect = item.handicap?.id ?? "";
    return <span className={`${size} relative block shrink-0 overflow-hidden rounded-2xl bg-saffron/25`}>
        {!item.image_data ? <span className="grid h-full w-full place-items-center text-caramel" aria-hidden="true"><Gift size={20} /></span>
            : effect === "emoji_code" ? <PixelCanvas src={item.image_data} cells={14} />
            : effect === "lueckentext" ? <PixelCanvas src={item.image_data} cells={8} grid />
            : <img src={item.image_data} alt="" className={`h-full w-full object-cover ${IMAGE_EFFECT[effect] ?? ""}`} />}
    </span>;
}

/** The (already disguised) name; "Spiegelwelt" also mirrors the text. */
export function HandicapName({ item }: { item: Visual }) {
    return item.handicap?.id === "spiegelwelt" ? <span className="inline-block -scale-x-100">{item.name}</span> : <>{item.name}</>;
}
