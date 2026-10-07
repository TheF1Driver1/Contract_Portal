// Fails when es and en message files differ in keys or ICU placeholders.
// Run: node scripts/check-messages.mjs
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "@formatjs/icu-messageformat-parser";

const root = new URL("../messages/", import.meta.url).pathname;
const flat = (obj, prefix = "") =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" ? flat(v, `${prefix}${k}.`) : [[`${prefix}${k}`, String(v)]]
  );
// Argument names used by an ICU message (plural/select branches included).
function args(elements, out = new Set()) {
  for (const el of elements) {
    if (el.value && typeof el.value === "string" && el.type !== 0) out.add(el.value);
    if (el.options) for (const opt of Object.values(el.options)) args(opt.value, out);
    if (el.children) args(el.children, out);
  }
  return out;
}
const vars = (s) => {
  try { return [...args(parse(s))].sort().join(","); } catch { return `invalid:${s}`; }
};

let problems = 0;
const files = new Set([...readdirSync(join(root, "es")), ...readdirSync(join(root, "en"))]);
for (const file of files) {
  const load = (loc) => {
    try { return Object.fromEntries(flat(JSON.parse(readFileSync(join(root, loc, file), "utf8")))); }
    catch { console.error(`missing ${loc}/${file}`); problems++; return {}; }
  };
  const es = load("es"), en = load("en");
  for (const k of Object.keys(es)) if (!(k in en)) { console.error(`en/${file}: missing ${k}`); problems++; }
  for (const k of Object.keys(en)) if (!(k in es)) { console.error(`es/${file}: missing ${k}`); problems++; }
  for (const k of Object.keys(es)) if (k in en && vars(es[k]) !== vars(en[k])) {
    console.error(`${file}: placeholders differ for ${k}`); problems++;
  }
}
if (problems) { console.error(`${problems} translation problem(s)`); process.exit(1); }
console.log("messages OK");
