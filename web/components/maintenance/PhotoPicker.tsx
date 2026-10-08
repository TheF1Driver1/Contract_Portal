"use client";

import { useId, useRef } from "react";
import { useTranslations } from "next-intl";
import { Camera, ImagePlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createBrowserClient } from "@/lib/supabase";
import { requestPhotoUpload, registerPhoto } from "@/lib/actions/maintenance";
import { checkPhoto, PHOTO_ACCEPT, PHOTO_BUCKET, type PhotoScope } from "@/lib/maintenance/logic";

/**
 * "Tomar foto" opens the phone camera (capture="environment"); "Elegir fotos"
 * opens the gallery or file picker. Hands the chosen files to `onFiles`.
 */
export function PhotoPicker({
  onFiles,
  busy,
  disabled,
  compact,
  labelSuffix,
}: {
  onFiles: (files: File[]) => void;
  busy?: boolean;
  disabled?: boolean;
  compact?: boolean;
  /** Extra context for screen readers, e.g. the checklist item. */
  labelSuffix?: string;
}) {
  const t = useTranslations("maintenance.photos");
  const id = useId();
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length) onFiles(files);
  }

  const label = (s: string) => (labelSuffix ? `${s}: ${labelSuffix}` : s);

  return (
    <div className="flex flex-wrap gap-2">
      <input ref={camera} id={`${id}-camera`} type="file" accept="image/*" capture="environment" className="hidden" onChange={pick} />
      <input ref={gallery} id={`${id}-gallery`} type="file" accept={`${PHOTO_ACCEPT},image/*`} multiple className="hidden" onChange={pick} />
      <Button type="button" variant="outline" size={compact ? "sm" : "default"} disabled={disabled || busy} onClick={() => camera.current?.click()} aria-label={label(t("take"))}>
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Camera aria-hidden />}
        {!compact && t("take")}
      </Button>
      <Button type="button" variant="outline" size={compact ? "sm" : "default"} disabled={disabled || busy} onClick={() => gallery.current?.click()} aria-label={label(t("choose"))}>
        <ImagePlus aria-hidden />
        {!compact && t("choose")}
      </Button>
    </div>
  );
}

/** Thumbnails of stored photos (signed URLs). HEIC files show as a link. */
export function PhotoGrid({ photos, altPrefix }: { photos: { id: string; url: string | null; renderable: boolean }[]; altPrefix: string }) {
  const t = useTranslations("maintenance.photos");
  if (!photos.length) return null;
  return (
    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {photos.map((p, i) => (
        <li key={p.id}>
          {p.url ? (
            <a
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block aspect-square overflow-hidden rounded-lg border bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={t("open", { n: i + 1 })}
            >
              {p.renderable ? (
                // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URLs from private storage
                <img src={p.url} alt={`${altPrefix} ${i + 1}`} className="size-full object-cover" loading="lazy" />
              ) : (
                <span className="flex size-full items-center justify-center p-2 text-center text-xs text-muted-foreground">{t("heic")}</span>
              )}
            </a>
          ) : (
            <span className="flex aspect-square items-center justify-center rounded-lg border bg-surface-muted text-xs text-muted-foreground">{t("unavailable")}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

// Browser side of photo uploads: ask the server for a signed upload URL,
// send the file straight to private storage, then register it.

const BY_EXT: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", heif: "image/heif" };

/** Some phones leave `type` empty for HEIC; fall back to the extension. */
export function photoType(file: File): string {
  if (file.type) return file.type;
  return BY_EXT[file.name.split(".").pop()?.toLowerCase() ?? ""] ?? "";
}

export async function uploadPhoto(
  scope: PhotoScope,
  recordId: string,
  file: File,
  itemId?: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const type = photoType(file);
  const check = checkPhoto(type, file.size);
  if (!check.ok) return { ok: false, error: check.error === "type" ? "Usa una foto JPG, PNG, WebP o HEIC." : "La foto no puede pasar de 8 MB." };
  const ticket = await requestPhotoUpload({ scope, record_id: recordId, item_id: itemId ?? null, content_type: type, size: file.size });
  if (!ticket.ok) return ticket;
  const { error } = await createBrowserClient().storage.from(PHOTO_BUCKET).uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: type });
  if (error) return { ok: false, error: "No se pudo subir la foto." };
  return registerPhoto({ scope, record_id: recordId, item_id: itemId ?? null, path: ticket.path });
}
