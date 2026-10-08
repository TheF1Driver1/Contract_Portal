// Minimal in-memory stand-in for the supabase-js query builder, enough for
// server-side service tests. Joins are not resolved: put joined data on rows.
type Row = Record<string, unknown>;
type Filter = (r: Row) => boolean;

export function fakeSupabase(tables: Record<string, Row[]>) {
  const storage = new Map<string, Buffer>();
  const emails: string[] = [];

  function query(table: string) {
    const rows = (tables[table] ??= []);
    const filters: Filter[] = [];
    let op: "select" | "insert" | "update" | "delete" = "select";
    let payload: Row | Row[] | null = null;
    let order: { col: string; asc: boolean } | null = null;
    let limit: number | null = null;
    let wantSelect = false;
    let count = false;

    const matching = () => rows.filter((r) => filters.every((f) => f(r)));
    const apply = (): { data: unknown; error: null | { message: string }; count?: number } => {
      if (op === "insert") {
        const list = (Array.isArray(payload) ? payload : [payload]) as Row[];
        const inserted = list.map((p) => ({ id: p.id ?? crypto.randomUUID(), created_at: new Date().toISOString(), ...p }));
        rows.push(...inserted);
        return { data: wantSelect ? inserted : null, error: null };
      }
      if (op === "update") {
        const hit = matching();
        hit.forEach((r) => Object.assign(r, payload));
        return { data: wantSelect ? hit : null, error: null };
      }
      if (op === "delete") {
        const keep = rows.filter((r) => !filters.every((f) => f(r)));
        rows.splice(0, rows.length, ...keep);
        return { data: null, error: null };
      }
      let out = matching();
      if (order) {
        const { col, asc } = order;
        out = [...out].sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : 1) * (asc ? 1 : -1));
      }
      if (limit != null) out = out.slice(0, limit);
      return { data: out, error: null, count: count ? out.length : undefined };
    };

    const b: Record<string, unknown> = {
      select: (_cols?: string, opts?: { count?: string; head?: boolean }) => {
        wantSelect = true;
        if (opts?.count) count = true;
        return b;
      },
      insert: (p: Row | Row[]) => ((op = "insert"), (payload = p), b),
      update: (p: Row) => ((op = "update"), (payload = p), b),
      delete: () => ((op = "delete"), b),
      eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), b),
      neq: (c: string, v: unknown) => (filters.push((r) => r[c] !== v), b),
      in: (c: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[c])), b),
      ilike: (c: string, v: string) => (filters.push((r) => String(r[c] ?? "").toLowerCase() === v.toLowerCase()), b),
      order: (col: string, o?: { ascending?: boolean }) => ((order = { col, asc: o?.ascending !== false }), b),
      limit: (n: number) => ((limit = n), b),
      maybeSingle: async () => {
        const r = apply();
        const list = r.data as Row[] | null;
        return { data: list?.[0] ?? null, error: null };
      },
      single: async () => {
        const r = apply();
        const list = r.data as Row[] | null;
        return list?.[0] ? { data: list[0], error: null } : { data: null, error: { message: "no rows" } };
      },
      then: (resolve: (v: unknown) => void) => resolve(apply()),
    };
    return b;
  }

  const client = {
    from: query,
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string, data: Buffer) => (storage.set(`${bucket}/${path}`, Buffer.from(data)), { error: null }),
        download: async (path: string) => {
          const d = storage.get(`${bucket}/${path}`);
          return { data: d ? new Blob([new Uint8Array(d)]) : null, error: d ? null : { message: "not found" } };
        },
      }),
    },
    auth: { admin: { getUserById: async (id: string) => ({ data: { user: { id, email: `${id}@owner.test` } } }) } },
  };
  return { client, tables, storage, emails };
}
