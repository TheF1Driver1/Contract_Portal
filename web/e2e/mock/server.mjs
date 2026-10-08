// Minimal stand-in for Supabase Auth + PostgREST, used to render signed-in
// pages for screenshots and axe checks without a real project.
// Usage: node e2e/mock/server.mjs [port]
import http from "node:http";
import { RPCS, TABLES, USER } from "./fixtures.mjs";

const PORT = Number(process.argv[2] ?? process.env.MOCK_SUPABASE_PORT ?? 54399);

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "*",
    "access-control-expose-headers": "content-range",
    ...headers,
  });
  res.end(body === undefined ? "" : JSON.stringify(body));
}

function matches(row, params) {
  for (const [key, raw] of params) {
    if (["select", "order", "limit", "offset", "or", "and", "on_conflict", "columns"].includes(key)) continue;
    const [op, ...rest] = raw.split(".");
    const value = rest.join(".");
    const cell = row[key];
    if (op === "eq" && String(cell) !== value) return false;
    if (op === "neq" && String(cell) === value) return false;
    if (op === "in") {
      const set = value.replace(/^\(|\)$/g, "").split(",").map((v) => v.replace(/^"|"$/g, ""));
      if (!set.includes(String(cell))) return false;
    }
    if (op === "is" && value === "null" && cell != null) return false;
    if (op === "gte" && !(String(cell) >= value)) return false;
    if (op === "lte" && !(String(cell) <= value)) return false;
    if (op === "gt" && !(String(cell) > value)) return false;
    if (op === "lt" && !(String(cell) < value)) return false;
  }
  return true;
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 204);
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === "/auth/v1/user") return send(res, 200, USER);
  if (url.pathname.startsWith("/auth/v1/token")) {
    return send(res, 200, { access_token: "mock", token_type: "bearer", expires_in: 3600, refresh_token: "mock", user: USER });
  }
  if (url.pathname === "/auth/v1/logout") return send(res, 204);

  // Test control: replace a fixture table (or RPC result) at runtime.
  if (url.pathname === "/__mock/set" && req.method === "POST") {
    let body = "";
    for await (const chunk of req) body += chunk;
    const { table, rows, rpc: rpcName, value } = JSON.parse(body || "{}");
    if (table) TABLES[table] = rows ?? [];
    if (rpcName) RPCS[rpcName] = value;
    return send(res, 200, { ok: true });
  }

  const rpc = url.pathname.match(/^\/rest\/v1\/rpc\/([a-z_]+)/);
  if (rpc && rpc[1] in RPCS) return send(res, 200, RPCS[rpc[1]]);

  const rest = url.pathname.match(/^\/rest\/v1\/(?:rpc\/)?([a-z_]+)/);
  if (rest) {
    const table = rest[1];
    if (req.method !== "GET" && req.method !== "HEAD") {
      // Writes succeed and echo the payload so UI flows can continue.
      let body = "";
      for await (const chunk of req) body += chunk;
      const payload = body ? JSON.parse(body) : {};
      const row = Array.isArray(payload) ? payload[0] : payload;
      return send(res, 201, [{ id: "99999999-0000-4000-8000-000000000001", ...row }]);
    }
    const rows = (TABLES[table] ?? []).filter((r) => matches(r, url.searchParams));
    const wantsObject = (req.headers.accept ?? "").includes("vnd.pgrst.object");
    const range = `0-${Math.max(rows.length - 1, 0)}/${rows.length}`;
    if (req.method === "HEAD") return send(res, 200, undefined, { "content-range": range });
    if (wantsObject) {
      if (!rows.length) return send(res, 406, { code: "PGRST116", message: "no rows" });
      return send(res, 200, rows[0]);
    }
    const limit = Number(url.searchParams.get("limit") ?? rows.length);
    return send(res, 200, rows.slice(0, limit), { "content-range": range });
  }

  if (url.pathname.startsWith("/storage/v1/")) return send(res, 200, []);
  send(res, 404, { message: `mock: no route for ${url.pathname}` });
});

server.listen(PORT, () => console.log(`mock supabase on :${PORT}`));
