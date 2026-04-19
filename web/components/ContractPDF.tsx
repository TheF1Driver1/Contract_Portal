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
        <Text style={styles.value}>{contract.tenant?.full_name ?? '—'}</Text>
        <Text style={styles.label}>Property</Text>
        <Text style={styles.value}>{contract.property?.name ?? '—'}</Text>
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
