# Task: Email Enhancement

## Files to modify
- `web/app/(dashboard)/contracts/new/page.tsx`
- `web/components/ContractBuilder.tsx`
- `web/app/api/send/route.ts`

## Install
None.

## Context
- Email provider: Resend. `FROM_EMAIL` env var must be a verified domain address.
- Current send API takes `{ contractId, email, phone }` — changing `email` to `landlordEmail`.
- Tenant email lives on the `tenants` table, already joined when contract loads.

## Changes

### `web/app/(dashboard)/contracts/new/page.tsx`
This is a server component. After fetching `user`, add:
```typescript
const { data: profile } = await supabase
  .from("profiles")
  .select("email")
  .eq("id", user.id)
  .single()
const landlordEmail = profile?.email ?? user.email ?? ""
```
Pass as prop: `<ContractBuilder landlordEmail={landlordEmail} ... />`

### `web/components/ContractBuilder.tsx`
1. Add prop: `landlordEmail: string`
2. Add state: `const [landlordEmailInput, setLandlordEmailInput] = useState(landlordEmail)`
3. In Step 4 (send step), replace current email input with:
```tsx
<div className="space-y-4">
  <div>
    <label className="text-sm font-medium">Your copy</label>
    <input type="email" value={landlordEmailInput}
      onChange={e => setLandlordEmailInput(e.target.value)}
      className="w-full mt-1 border rounded-md px-3 py-2 bg-background" />
  </div>
  <div>
    <label className="text-sm font-medium">Tenant copy</label>
    {tenant?.email
      ? <p className="text-sm text-muted-foreground mt-1">Also sending to: {tenant.email}</p>
      : <p className="text-sm text-destructive mt-1">⚠ No email on file for this tenant</p>
    }
  </div>
</div>
```
4. In send API call body, change `email` → `landlordEmail: landlordEmailInput`

### `web/app/api/send/route.ts`
Change request body destructure:
```typescript
// Before:
const { contractId, email, phone } = await req.json()

// After:
const { contractId, landlordEmail, phone } = await req.json()
```

Send to both:
```typescript
const sends: Promise<any>[] = []
sends.push(resend.emails.send({ from: process.env.FROM_EMAIL!, to: landlordEmail, subject, html }))
if (tenant?.email) {
  sends.push(resend.emails.send({ from: process.env.FROM_EMAIL!, to: tenant.email, subject, html }))
}
await Promise.all(sends)
```

## Done
- Step 4 shows landlord email pre-filled (editable) + tenant email read-only (or warning)
- Submitting send: both landlord and tenant receive email
- If tenant has no email: only landlord gets email, no crash
