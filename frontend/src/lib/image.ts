/**
 * Verkleinert ein Foto im Browser und gibt es als JPEG-Data-URL zurück.
 * Hält Uploads klein (≈ 150–400 KB) und entfernt dabei Metadaten wie GPS-Daten.
 */
export async function compressImage(file: File, maxSide = 1280, quality = 0.82): Promise<string> {
    if (!file.type.startsWith("image/")) throw new Error("Bitte wähle eine Bilddatei aus.");
    let bitmap: ImageBitmap;
    try {
        bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
        throw new Error("Dieses Bildformat wird nicht unterstützt. Versuche es mit JPEG oder PNG.");
    }
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Das Foto konnte nicht verarbeitet werden.");
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    return canvas.toDataURL("image/jpeg", quality);
}
