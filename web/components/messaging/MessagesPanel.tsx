import { useFormatter, useTranslations } from "next-intl";
import { AlertTriangle, Ban, Check, CheckCheck, Clock, Inbox, Mail, MessageCircle, MessageSquare, Send } from "lucide-react";
import type { MessageLog } from "@/lib/db";
import { cn } from "@/lib/utils";

export type MessageRow = Pick<
  MessageLog,
  "id" | "direction" | "channel" | "template" | "to_address" | "body" | "status" | "error" | "created_at"
>;

const CHANNEL_ICON = { email: Mail, sms: MessageSquare, whatsapp: MessageCircle } as const;

const STATUS = {
  queued: { icon: Clock, className: "bg-surface-muted text-muted-foreground" },
  sent: { icon: Send, className: "bg-info-soft text-info" },
  delivered: { icon: Check, className: "bg-success-soft text-success" },
  read: { icon: CheckCheck, className: "bg-success-soft text-success" },
  failed: { icon: AlertTriangle, className: "bg-danger-soft text-danger" },
  skipped: { icon: Ban, className: "bg-warning-soft text-warning" },
  received: { icon: Inbox, className: "bg-primary-soft text-primary-soft-foreground" },
} as const;

const KNOWN_TEMPLATES = [
  "rent_reminder", "rent_overdue", "contract_ready_to_sign", "contract_signed", "lease_ending", "receipt",
  "landlord_digest", "inbound", "inbound_stop", "inbound_start", "inbound_help",
];
const SKIP_REASONS = ["no_consent", "invalid_address", "whatsapp_not_configured", "sms_not_configured", "duplicate"];

/** Status with icon and text, never color alone. */
export function MessageStatusBadge({ status }: { status: MessageRow["status"] }) {
  const t = useTranslations("messaging.status");
  const s = STATUS[status] ?? STATUS.queued;
  const Icon = s.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", s.className)}>
      <Icon className="size-3.5" aria-hidden />
      {t(status)}
    </span>
  );
}

/** Recent messages for one contract: what went out (or came in), on which channel, and how it went. */
export function MessagesPanel({ rows }: { rows: MessageRow[] }) {
  const t = useTranslations("messaging");
  const f = useFormatter();

  if (!rows.length) {
    return (
      <div className="space-y-1 text-sm">
        <p className="font-medium text-foreground">{t("panel.empty")}</p>
        <p className="text-muted-foreground">{t("panel.emptyHint")}</p>
      </div>
    );
  }

  return (
    <ul className="divide-y">
      {rows.map((m) => {
        const Icon = CHANNEL_ICON[m.channel] ?? Mail;
        const inbound = m.direction === "inbound";
        const template = KNOWN_TEMPLATES.includes(m.template) ? m.template : "other";
        const reason =
          m.status === "skipped" && m.error && SKIP_REASONS.includes(m.error)
            ? t(`skip.${m.error}` as "skip.no_consent")
            : m.status === "failed"
              ? m.error
              : null;
        return (
          <li key={m.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-muted-foreground">
              <Icon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                <p className="text-sm font-medium text-foreground">{t(`template.${template}` as "template.other")}</p>
                <MessageStatusBadge status={m.status} />
              </div>
              <p className="text-xs text-muted-foreground">
                {t(`channel.${m.channel}` as "channel.email")}
                <span aria-hidden> · </span>
                <span className="break-all">{t(inbound ? "panel.from" : "panel.to", { address: m.to_address })}</span>
                <span aria-hidden> · </span>
                <time dateTime={m.created_at}>{f.dateTime(new Date(m.created_at), { dateStyle: "medium", timeStyle: "short" })}</time>
              </p>
              {inbound && m.body && <p className="rounded-md bg-surface-muted px-2.5 py-1.5 text-sm text-foreground">{m.body}</p>}
              {reason && <p className="text-xs text-muted-foreground">{t("panel.reason", { reason })}</p>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
