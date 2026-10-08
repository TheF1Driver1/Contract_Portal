// Plain, table-based email layout that renders in every client. All dynamic
// text is HTML-escaped; colors match the light theme tokens.

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function emailLayout(opts: {
  lang: "es" | "en";
  heading: string;
  paragraphs: string[];
  cta?: { label: string; url: string };
  note?: string;
  footer: string;
  /** Marketing-style emails must carry a visible unsubscribe link. */
  unsubscribe?: { label: string; url: string };
}): string {
  const p = (text: string) =>
    `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">${escapeHtml(text)}</p>`;
  const cta = opts.cta
    ? `<tr><td style="padding:8px 32px 24px;"><a href="${escapeHtml(opts.cta.url)}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:15px;font-weight:600;">${escapeHtml(opts.cta.label)}</a></td></tr>`
    : "";
  const note = opts.note
    ? `<tr><td style="padding:0 32px 24px;"><p style="margin:0;font-size:13px;color:#64748b;">${escapeHtml(opts.note)}</p></td></tr>`
    : "";
  return `<!DOCTYPE html>
<html lang="${opts.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(opts.heading)}</title></head>
<body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:32px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e6ec;border-radius:12px;">
<tr><td style="padding:24px 32px 8px;"><p style="margin:0;font-size:14px;font-weight:700;color:#0f766e;">ContractOS</p></td></tr>
<tr><td style="padding:8px 32px 8px;"><h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#0f172a;">${escapeHtml(opts.heading)}</h1>${opts.paragraphs.map(p).join("")}</td></tr>
${cta}${note}
<tr><td style="padding:16px 32px;border-top:1px solid #e2e6ec;"><p style="margin:0;font-size:12px;line-height:1.5;color:#64748b;">${escapeHtml(opts.footer)}${opts.unsubscribe ? ` <a href="${escapeHtml(opts.unsubscribe.url)}" style="color:#64748b;text-decoration:underline;">${escapeHtml(opts.unsubscribe.label)}</a>` : ""}</p></td></tr>
</table></td></tr></table></body></html>`;
}
