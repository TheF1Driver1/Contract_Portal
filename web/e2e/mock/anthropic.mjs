// Stand-in for the Anthropic Messages API so the AI panels (Plan 39) can be
// exercised end to end without a key. Start the app with
// ANTHROPIC_API_KEY=mock ANTHROPIC_BASE_URL=http://127.0.0.1:<port>.
// Usage: node e2e/mock/anthropic.mjs [port]
import http from "node:http";

const PORT = Number(process.argv[2] ?? 54398);

const message = (content, stop_reason = "end_turn") => ({
  id: `msg_mock_${Date.now()}`,
  type: "message",
  role: "assistant",
  model: "claude-opus-5-5",
  content,
  stop_reason,
  stop_sequence: null,
  usage: { input_tokens: 1200, output_tokens: 180 },
});
const json = (o) => [{ type: "text", text: JSON.stringify(o) }];

function reply(body) {
  const system = Array.isArray(body.system) ? body.system.map((b) => b.text).join("\n") : String(body.system ?? "");
  if (body.tools) {
    const answered = body.messages.some((m) => Array.isArray(m.content) && m.content.some((b) => b.type === "tool_result"));
    if (!answered) return message([{ type: "tool_use", id: "toolu_mock_1", name: "list_overdue_leases", input: {} }], "tool_use");
    return message([{ type: "text", text: "- José Martínez (Edificio Las Palmas 2B) debe $1,200 de renta.\n- Los demás contratos firmados están al día." }]);
  }
  if (system.includes("translate custom clauses")) {
    return message(json({ title: "Pets", translation: "No pets are allowed on the premises without the landlord's written authorization.", notes: ["“Arrendador” was translated as “landlord” per the glossary."] }));
  }
  const es = system.startsWith("Redactas");
  return message(
    json(
      es
        ? { subject: "Balance pendiente de renta", body: "Saludos, José Martínez:\n\nLe escribimos para recordarle que su cuenta de renta de Edificio Las Palmas 2B tiene un balance vencido de $1,200.\n\nLe agradeceremos que realice el pago o se comunique con nosotros para acordar un plan.\n\nAtentamente,\nMaría Rivera" }
        : { subject: "Rent balance due", body: "Hello,\n\nThis is a reminder of a past-due balance.\n\nSincerely,\nMaría Rivera" }
    )
  );
}

http
  .createServer(async (req, res) => {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    if (req.method !== "POST" || !req.url?.startsWith("/v1/messages")) {
      res.writeHead(404, { "content-type": "application/json" });
      return res.end(JSON.stringify({ type: "error", error: { type: "not_found_error", message: "mock" } }));
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(reply(JSON.parse(raw || "{}"))));
  })
  .listen(PORT, () => console.log(`mock anthropic on :${PORT}`));
