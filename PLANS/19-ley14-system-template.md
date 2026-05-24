# Plan 19 — Ley 14-2022 System Template Upload

**Branch:** `feature/ley14-system-template` (off `dev` once `feature/pr-expansion` merges)

---

## What this is

Upload an attorney-reviewed Ley 14-2022 compliant `.docx` contract template as a platform system template, visible to all users without requiring them to upload their own.

---

## Prerequisites

- [ ] Attorney-reviewed `.docx` template for Puerto Rico residential leases under Ley 14-2022
- Docxtemplater-compatible variable syntax (`{{variable_name}}`) for all dynamic fields
- Variables must map to `buildContext()` output in `web/lib/contract-context.ts`

---

## Code changes required (already identified)

### 1. Fix RLS policy on `contract_templates`

Current policy blocks system templates entirely (`auth.uid() = owner_id` fails when `owner_id = null`).

Add a second SELECT policy:

```sql
CREATE POLICY "system_templates_readable"
ON contract_templates
FOR SELECT
TO authenticated
USING (is_system = true);
```

### 2. Update `generate-docx.ts` to fall back to system templates

After checking user-owned templates and before the static file fallback, add:

```ts
// Fall back to system template for jurisdiction
const { data: system } = await supabase
  .from("contract_templates")
  .select("file_url")
  .eq("is_system", true)
  .eq("is_default", true)
  .eq("jurisdiction", "pr")
  .single();
if (system?.file_url) {
  const res = await fetch(system.file_url);
  if (res.ok) return Buffer.from(await res.arrayBuffer());
}
```

### 3. Update `contracts/new` page template picker

Include system templates in the dropdown:

```ts
supabase
  .from("contract_templates")
  .select("*")
  .or(`owner_id.eq.${user.id},is_system.eq.true`)
  .order("is_system", { ascending: false })
  .order("created_at", { ascending: false })
```

Label system templates visually (e.g. "System — Ley 14-2022") so users can distinguish them from their own uploads.

---

## Upload steps (once file is ready)

1. Upload `.docx` to Supabase Storage bucket `contract-templates` at path `system/<uuid>.docx`
2. Get the public URL
3. Insert into `contract_templates`:

```sql
INSERT INTO contract_templates (
  owner_id, name, description, file_url,
  contract_type, is_default, is_system, jurisdiction, template_version
) VALUES (
  NULL,
  'Contrato de Arrendamiento — Ley 14-2022',
  'Plantilla oficial revisada por abogado bajo la Ley 14-2022 de Puerto Rico',
  '<public_url>',
  'lease',
  true,
  true,
  'pr',
  '1.0.0'
);
```

---

## Notes

- The static fallback at `web/public/templates/contract_template.docx` remains in place as the last resort
- System templates should NOT be deletable via the normal `/api/templates/[id]` DELETE endpoint — add a guard: `if (template.is_system) return 403`
- When the live attorney template is ready, bump `template_version` to distinguish contracts generated with it
