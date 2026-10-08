// Messaging (Plan 34): email, SMS and WhatsApp notices with consent,
// idempotency and delivery status. See send.ts.
export { sendMessage, type SendMessageInput, type SendMessageResult, type SkipReason } from "@/lib/messaging/send";
export { TEMPLATES, type TemplateName, type TemplateVars } from "@/lib/messaging/templates";
