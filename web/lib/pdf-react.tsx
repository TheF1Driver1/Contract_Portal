/**
 * Contract PDF renderer using @react-pdf/renderer.
 * Pure Node.js — no Puppeteer / headless Chrome required.
 */
import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import type {
  Contract,
  Profile,
  Tenant,
  TenantSnapshot,
  Property,
  PropertySnapshot,
  ContractOccupant,
} from "@/lib/types";

// ─── helpers ────────────────────────────────────────────────────────────────

function fmtDate(d: string | null | undefined): string {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  const months = [
    "", "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${months[parseInt(m)]} ${parseInt(day)}, ${y}`;
}

function fmtMoney(n: number | null | undefined): string {
  if (n == null) return "";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

// ─── styles ─────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10.5,
    lineHeight: 1.55,
    color: "#111111",
    paddingTop: 50,
    paddingBottom: 60,
    paddingHorizontal: 62,
    backgroundColor: "#ffffff",
  },

  // Header
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18, paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: "#111111" },
  landlordName: { fontFamily: "Helvetica-Bold", fontSize: 11, marginBottom: 2 },
  landlordInfo: { fontSize: 9 },
  docMeta: { textAlign: "right", fontSize: 9, color: "#444444" },
  docTitle: { textAlign: "center", fontFamily: "Helvetica-Bold", fontSize: 15, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 3 },
  docSubtitle: { textAlign: "center", fontSize: 8.5, color: "#666666", marginBottom: 18 },

  // Sections
  section: { marginBottom: 14 },
  sectionTitleWrap: { borderBottomWidth: 1, borderBottomColor: "#cccccc", paddingBottom: 3, marginBottom: 7 },
  sectionTitle: { fontFamily: "Helvetica-Bold", fontSize: 8, textTransform: "uppercase", letterSpacing: 1, color: "#333333" },

  // Party grid (2-col)
  partyGrid: { flexDirection: "row", gap: 16 },
  partyBlock: { flex: 1 },
  partyLabel: { fontFamily: "Helvetica-Bold", fontSize: 7.5, textTransform: "uppercase", letterSpacing: 0.8, color: "#555555", marginBottom: 4 },

  // Key/value rows
  row: { flexDirection: "row", marginBottom: 2 },
  rowLabel: { width: "38%", fontSize: 9, color: "#555555" },
  rowValue: { flex: 1, fontSize: 10 },

  // Sub-section label
  subLabel: { fontFamily: "Helvetica-Bold", fontSize: 8, textTransform: "uppercase", letterSpacing: 0.7, color: "#666666", marginTop: 8, marginBottom: 3 },

  // Amenity pills
  pillWrap: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 },
  pill: { fontSize: 8.5, borderWidth: 1, borderColor: "#cccccc", borderRadius: 3, paddingVertical: 1.5, paddingHorizontal: 6, color: "#333333" },

  // Signatures
  sigSection: { marginTop: 20 },
  sigGrid: { flexDirection: "row", gap: 24, marginTop: 12 },
  sigBlock: { flex: 1 },
  sigRole: { fontFamily: "Helvetica-Bold", fontSize: 7.5, textTransform: "uppercase", letterSpacing: 0.8, color: "#555555", marginBottom: 6 },
  sigImage: { maxWidth: 200, maxHeight: 48, marginBottom: 2 },
  sigLine: { borderBottomWidth: 1, borderBottomColor: "#333333", marginBottom: 4, height: 44 },
  sigName: { fontFamily: "Helvetica-Bold", fontSize: 9 },
  sigDate: { fontSize: 8.5, color: "#555555", marginTop: 4 },

  // Footer
  footer: { marginTop: 20, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#dddddd", fontSize: 8, color: "#888888", lineHeight: 1.4 },

  // Page number
  pageNum: { position: "absolute", bottom: 20, left: 0, right: 0, textAlign: "center", fontSize: 8, color: "#999999" },
});

// ─── primitives ─────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === "" || value === 0) return null;
  return (
    <View style={S.row}>
      <Text style={S.rowLabel}>{label}</Text>
      <Text style={S.rowValue}>{String(value)}</Text>
    </View>
  );
}

function SectionBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={S.section}>
      <View style={S.sectionTitleWrap}>
        <Text style={S.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

// ─── document ────────────────────────────────────────────────────────────────

interface Props { contract: Contract; profile: Profile | null }

function ContractDocument({ contract, profile }: Props) {
  const amenities = (contract.amenities ?? {}) as Record<string, string | number | boolean>;
  const tenant    = (contract.tenant_snapshot ?? contract.tenant) as (TenantSnapshot | Tenant) | null;
  const property  = (contract.property_snapshot ?? contract.property) as (PropertySnapshot | Property) | null;

  const ten  = tenant   as Record<string, unknown> | null;
  const prop = property as Record<string, unknown> | null;

  const today      = new Date();
  const todayFmt   = fmtDate(today.toISOString().split("T")[0]);
  const contractNo = contract.id.slice(-8).toUpperCase();

  const landlordName  = (profile?.company_name || profile?.full_name || "Landlord").trim();
  const landlordEmail = profile?.email  ?? "";
  const landlordPhone = profile?.phone  ?? "";

  // Lease duration label
  const years     = Math.floor(contract.lease_months / 12);
  const remMonths = contract.lease_months % 12;
  const durationParts: string[] = [];
  if (years > 0)     durationParts.push(`${years} year${years !== 1 ? "s" : ""}`);
  if (remMonths > 0) durationParts.push(`${remMonths} month${remMonths !== 1 ? "s" : ""}`);
  const duration = durationParts.join(" and ") || `${contract.lease_months} months`;

  // Late fee
  const lfType  = contract.late_fee_type ?? "fixed";
  const lfGrace = contract.late_fee_grace_period_days ?? 0;
  const lfFixed = contract.late_fee_fixed_amount ?? 0;
  const lfDaily = contract.late_fee_daily_amount ?? 0;
  const showLateFee = lfFixed > 0 || lfDaily > 0 || lfGrace > 0;

  // Parking
  const parkingAvailable = (prop?.parking_available as boolean | undefined) ?? Boolean(amenities.parking);
  const parkingCount     = (prop?.parking_count as number | null | undefined) ?? 0;
  const parkingSpot      = amenities.parking_spot ? String(amenities.parking_spot) : "";

  // Amenities pills
  const amenityLabels: Record<string, string> = {
    mirror_doors:       "Mirror Closet Doors",
    renovated_bathroom: "Renovated Bathroom",
    microwave:          "Microwave",
    fridge:             "Refrigerator",
    ac:                 "Air Conditioning",
    mini_blinds:        "Mini Blinds",
    sofa:               "Sofa",
    futon:              "Futon",
    wall_art:           "Wall Art",
    fan_count:          "Ceiling Fans",
    stool_count:        "Bar Stools",
    stove_count:        "Stoves",
  };

  const activePills = Object.entries(amenityLabels).filter(([key]) => {
    const v = amenities[key];
    return v === true || (typeof v === "number" && v > 0);
  });

  // Occupants
  const occupantNames = contract.occupant_names ?? [];
  const occupantCount = contract.occupant_count ?? 1;
  const coTenants: ContractOccupant[] = (contract.occupants ?? []).filter((o) => o.role === "co_tenant");

  // Signatures
  const signedDate = contract.signed_at ? fmtDate(contract.signed_at.split("T")[0]) : "";

  const hasEmployer  = ten && (ten.employer_name || ten.employer_phone || ten.monthly_income);
  const hasEmergency = ten && (ten.emergency_contact_name || ten.emergency_contact_phone);

  return (
    <Document>
      <Page size="LETTER" style={S.page}>
        {/* Page numbers */}
        <Text
          style={S.pageNum}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          fixed
        />

        {/* ── Header ── */}
        <View style={S.headerRow}>
          <View>
            <Text style={S.landlordName}>{landlordName}</Text>
            {!!landlordEmail && <Text style={S.landlordInfo}>{landlordEmail}</Text>}
            {!!landlordPhone && <Text style={S.landlordInfo}>{landlordPhone}</Text>}
          </View>
          <View>
            <Text style={S.docMeta}>Date: {todayFmt}</Text>
            <Text style={S.docMeta}>Contract No: {contractNo}</Text>
          </View>
        </View>

        <Text style={S.docTitle}>Lease Agreement</Text>
        <Text style={S.docSubtitle}>
          {contract.contract_type.charAt(0).toUpperCase() + contract.contract_type.slice(1)}
          {" — "}{fmtDate(contract.lease_start)} through {fmtDate(contract.lease_end)}
        </Text>

        {/* ── Parties ── */}
        <SectionBlock title="Parties">
          <View style={S.partyGrid}>
            <View style={S.partyBlock}>
              <Text style={S.partyLabel}>Landlord</Text>
              <Row label="Name"  value={landlordName} />
              <Row label="Email" value={landlordEmail} />
              <Row label="Phone" value={landlordPhone} />
            </View>
            <View style={S.partyBlock}>
              {ten ? (
                <>
                  <Text style={S.partyLabel}>Tenant</Text>
                  <Row label="Full Name"        value={String(ten.full_name ?? "")} />
                  <Row label="Email"            value={String(ten.email ?? "")} />
                  <Row label="Phone"            value={String(ten.phone ?? "")} />
                  <Row label="License / ID"     value={String(ten.license_number ?? "")} />
                  {ten.ssn_last4 ? <Row label="SSN (Last 4)" value={`xxx-xx-${ten.ssn_last4}`} /> : null}
                  <Row label="Date of Birth"    value={fmtDate(String(ten.date_of_birth ?? ""))} />
                  <Row label="Current Address"  value={String(ten.current_address ?? "")} />
                </>
              ) : (
                <Text style={{ fontSize: 9, color: "#888888" }}>No tenant on record</Text>
              )}
            </View>
          </View>
        </SectionBlock>

        {/* ── Co-Tenants ── */}
        {coTenants.length > 0 ? coTenants.map((ct, i) => (
          <SectionBlock key={ct.id} title={`Co-Tenant ${i + 2}`}>
            <Row label="Full Name"    value={ct.full_name} />
            <Row label="Email"        value={ct.email ?? ""} />
            <Row label="Phone"        value={ct.phone ?? ""} />
            <Row label="License / ID" value={ct.license_number ?? ""} />
            {ct.ssn_last4 ? <Row label="SSN (Last 4)" value={`xxx-xx-${ct.ssn_last4}`} /> : null}
            <Row label="Date of Birth"    value={fmtDate(ct.date_of_birth ?? "")} />
            <Row label="Current Address"  value={ct.current_address ?? ""} />
          </SectionBlock>
        )) : null}

        {/* ── Additional Tenant Details ── */}
        {(hasEmployer || hasEmergency) ? (
          <SectionBlock title="Additional Tenant Details">
            {hasEmployer ? (
              <>
                <Text style={S.subLabel}>Employment</Text>
                <Row label="Employer"       value={String(ten!.employer_name ?? "")} />
                <Row label="Employer Phone" value={String(ten!.employer_phone ?? "")} />
                {ten!.monthly_income != null ? (
                  <Row label="Monthly Income" value={fmtMoney(Number(ten!.monthly_income))} />
                ) : null}
              </>
            ) : null}
            {hasEmergency ? (
              <>
                <Text style={S.subLabel}>Emergency Contact</Text>
                <Row label="Name"  value={String(ten!.emergency_contact_name ?? "")} />
                <Row label="Phone" value={String(ten!.emergency_contact_phone ?? "")} />
              </>
            ) : null}
          </SectionBlock>
        ) : null}

        {/* ── Property ── */}
        {prop ? (
          <SectionBlock title="Property">
            <Row label="Property Name" value={String(prop.name ?? "")} />
            <Row label="Address"       value={String(prop.address ?? "")} />
            <Row label="City / State"  value={[prop.city, prop.state].filter(Boolean).join(", ")} />
            <Row label="ZIP"           value={String(prop.zip ?? "")} />
            <Row label="Unit"          value={contract.unit_number} />
          </SectionBlock>
        ) : null}

        {/* ── Unit Details ── */}
        <SectionBlock title="Unit Details">
          {amenities.room_count ? <Row label="Bedrooms"       value={String(amenities.room_count)} /> : null}
          {(prop?.bathroom_count as number | undefined) ? <Row label="Bathrooms" value={String(prop!.bathroom_count)} /> : null}
          <Row label="Parking"        value={parkingAvailable ? "Yes" : "No"} />
          {parkingAvailable && parkingCount ? <Row label="Parking Spaces" value={String(parkingCount)} /> : null}
          {parkingAvailable && parkingSpot  ? <Row label="Parking Spot"   value={parkingSpot} /> : null}
          {contract.key_count ? <Row label="Keys Provided" value={String(contract.key_count)} /> : null}
        </SectionBlock>

        {/* ── Lease Term ── */}
        <SectionBlock title="Lease Term">
          <Row label="Start Date" value={fmtDate(contract.lease_start)} />
          <Row label="End Date"   value={fmtDate(contract.lease_end)} />
          <Row label="Duration"   value={duration} />
        </SectionBlock>

        {/* ── Financial Terms ── */}
        <SectionBlock title="Financial Terms">
          <View style={S.row}>
            <Text style={S.rowLabel}>Monthly Rent</Text>
            <Text style={S.rowValue}>
              {fmtMoney(contract.rent_amount)}
              {contract.rent_amount_verbal ? `  (${contract.rent_amount_verbal})` : ""}
            </Text>
          </View>
          {contract.security_deposit ? <Row label="Security Deposit" value={fmtMoney(contract.security_deposit)} /> : null}
          <Row label="Payment Due"    value={`Day ${contract.payment_due_day} of each month`} />
          <Row label="Late Fee After" value={`Day ${contract.late_fee_day} of each month`} />
        </SectionBlock>

        {/* ── Late Fee Policy ── */}
        {showLateFee ? (
          <SectionBlock title="Late Fee Policy">
            <Row label="Fee Type"
              value={lfType === "fixed" ? "Fixed Amount" : lfType === "daily" ? "Daily Accrual" : "Fixed + Daily"}
            />
            {lfGrace > 0 ? <Row label="Grace Period" value={`${lfGrace} day${lfGrace !== 1 ? "s" : ""}`} /> : null}
            {(lfType === "fixed" || lfType === "both") && lfFixed > 0
              ? <Row label="Fixed Late Fee" value={fmtMoney(lfFixed)} /> : null}
            {(lfType === "daily" || lfType === "both") && lfDaily > 0
              ? <Row label="Daily Penalty" value={`${fmtMoney(lfDaily)} / day`} /> : null}
          </SectionBlock>
        ) : null}

        {/* ── Included Amenities ── */}
        {activePills.length > 0 ? (
          <SectionBlock title="Included Amenities">
            <View style={S.pillWrap}>
              {activePills.map(([key, label]) => {
                const v = amenities[key];
                const display = typeof v === "number" ? `${v} ${label}` : label;
                return <Text key={key} style={S.pill}>{display}</Text>;
              })}
            </View>
          </SectionBlock>
        ) : null}

        {/* ── Additional Occupants ── */}
        {(occupantNames.length > 0 || occupantCount > 1) ? (
          <SectionBlock title="Additional Occupants">
            {occupantNames.length > 0
              ? <Row label="Names"          value={occupantNames.join(", ")} />
              : null}
            <Row label="Total Occupants" value={String(occupantCount)} />
          </SectionBlock>
        ) : null}

        {/* ── Signatures ── */}
        <View style={S.sigSection}>
          <View style={S.sectionTitleWrap}>
            <Text style={S.sectionTitle}>Signatures</Text>
          </View>
          <View style={S.sigGrid}>
            {/* Primary Tenant */}
            <View style={S.sigBlock}>
              <Text style={S.sigRole}>Tenant</Text>
              {contract.tenant_signature
                ? <Image style={S.sigImage} src={contract.tenant_signature} />
                : <View style={S.sigLine} />}
              <Text style={S.sigName}>{String(ten?.full_name ?? "")}</Text>
              <Text style={S.sigDate}>Date: {signedDate || "_________________"}</Text>
            </View>
            {/* Landlord */}
            <View style={S.sigBlock}>
              <Text style={S.sigRole}>Landlord</Text>
              {contract.landlord_signature
                ? <Image style={S.sigImage} src={contract.landlord_signature} />
                : <View style={S.sigLine} />}
              <Text style={S.sigName}>{landlordName}</Text>
              <Text style={S.sigDate}>Date: {signedDate || "_________________"}</Text>
            </View>
          </View>
          {/* Co-Tenant Signatures */}
          {coTenants.length > 0 ? (
            <View style={{ ...S.sigGrid, marginTop: 16 }}>
              {coTenants.map((ct, i) => (
                <View key={ct.id} style={S.sigBlock}>
                  <Text style={S.sigRole}>Co-Tenant {i + 2}</Text>
                  {ct.signature
                    ? <Image style={S.sigImage} src={ct.signature} />
                    : <View style={S.sigLine} />}
                  <Text style={S.sigName}>{ct.full_name}</Text>
                  <Text style={S.sigDate}>Date: {ct.signed_at ? fmtDate(ct.signed_at.split("T")[0]) : "_________________"}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {/* ── Footer ── */}
        <View style={S.footer}>
          <Text>
            This document constitutes a legally binding agreement between the parties listed above.
            Any modifications must be made in writing and signed by both parties.
            Contract ID: {contract.id}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

// ─── public API ──────────────────────────────────────────────────────────────

export async function renderContractPdf(
  contract: Contract,
  profile: Profile | null,
): Promise<Buffer | null> {
  try {
    const buf = await renderToBuffer(
      <ContractDocument contract={contract} profile={profile} />
    );
    return Buffer.from(buf);
  } catch (err) {
    console.error("[pdf-react] renderToBuffer failed:", err);
    return null;
  }
}
