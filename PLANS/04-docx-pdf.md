# Task: DOCX Fix + PDF Download

## Files to modify
- `web/next.config.mjs`
- `web/components/ContractBuilder.tsx`
- `web/app/(dashboard)/contracts/[id]/ContractActions.tsx`

## Files to create
- `web/components/ContractPDF.tsx`

## Install
```bash
cd Contract_Portal/web && npm install @react-pdf/renderer
```

## Part A: DOCX Fix

### `web/next.config.mjs`
Add inside config object — ensures Vercel bundles the .docx template:
```js
experimental: {
  outputFileTracingIncludes: {
    '/api/generate': ['./templates/**'],
  },
},
```

## Part B: PDF Download

### Create `web/components/ContractPDF.tsx`
```tsx
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 12, fontFamily: 'Helvetica' },
  title: { fontSize: 18, marginBottom: 16, fontWeight: 'bold' },
  label: { fontSize: 10, color: '#666', marginBottom: 2 },
  value: { fontSize: 12, marginBottom: 10 },
  row: { flexDirection: 'row', gap: 24 },
})

export default function ContractPDF({ contract }: { contract: any }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Rental Contract</Text>
        <Text style={styles.label}>Tenant</Text>
        <Text style={styles.value}>{contract.tenant?.name}</Text>
        <Text style={styles.label}>Property</Text>
        <Text style={styles.value}>{contract.property?.address}</Text>
        <View style={styles.row}>
          <View>
            <Text style={styles.label}>Monthly Rent</Text>
            <Text style={styles.value}>${contract.rent_amount}</Text>
          </View>
          <View>
            <Text style={styles.label}>Lease Period</Text>
            <Text style={styles.value}>{contract.lease_start} – {contract.lease_end}</Text>
          </View>
        </View>
        <Text style={styles.label}>Status</Text>
        <Text style={styles.value}>{contract.status}</Text>
      </Page>
    </Document>
  )
}
```
**WARNING:** No HTML/Tailwind inside react-pdf. Only its own DSL (`View`, `Text`, `StyleSheet`).

### Download helper (add to both files below)
```typescript
async function downloadPDF(contract: any) {
  const { pdf } = await import('@react-pdf/renderer')
  const { default: ContractPDF } = await import('@/components/ContractPDF')
  const blob = await pdf(<ContractPDF contract={contract} />).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `contract_${contract.id}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
```
Use dynamic `import()` — never static top-level import. SSR will break.

### `web/components/ContractBuilder.tsx`
Add "Download PDF" button next to existing DOCX button. On click: `downloadPDF(contract)`.

### `web/app/(dashboard)/contracts/[id]/ContractActions.tsx`
Add "Download PDF" button. Same `downloadPDF` helper.

## Done
- `next.config.mjs` has `outputFileTracingIncludes` for `/api/generate`
- Clicking "Download PDF" in ContractBuilder and ContractActions triggers browser download of a `.pdf`
- PDF contains tenant name, property, rent, lease dates
