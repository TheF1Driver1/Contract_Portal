import type {
  Contract,
  Profile,
  Tenant,
  TenantSnapshot,
  Property,
  PropertySnapshot,
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

// Renders a table row only when value is truthy
function r(label: string, value: string | number | null | undefined): string {
  if (value == null || value === "" || value === 0) return "";
  return `<tr><td class="lbl">${label}</td><td class="val">${value}</td></tr>`;
}

function section(title: string, body: string): string {
  if (!body.trim()) return "";
  return `
  <div class="section">
    <div class="section-title">${title}</div>
    ${body}
  </div>`;
}

function table(rows: string): string {
  const filtered = rows.trim();
  if (!filtered) return "";
  return `<table>${filtered}</table>`;
}

function check(val: boolean | number | undefined): string {
  return val ? "Yes" : "No";
}

// ─── CSS ────────────────────────────────────────────────────────────────────

const CSS = `
  @page {
    margin: 1.8cm 2.2cm;
    size: Letter;
    @bottom-center {
      content: "Page " counter(page) " of " counter(pages);
      font-family: Arial, sans-serif;
      font-size: 8pt;
      color: #999;
    }
  }

  * { box-sizing: border-box; }

  body {
    font-family: "Times New Roman", Times, serif;
    font-size: 10.5pt;
    line-height: 1.55;
    color: #111;
    margin: 0;
    background: #fff;
  }

  /* ── Header ── */
  .doc-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 18pt;
    padding-bottom: 12pt;
    border-bottom: 2px solid #111;
  }
  .doc-header .landlord-block { font-size: 9.5pt; line-height: 1.5; }
  .doc-header .landlord-block .landlord-name { font-size: 11pt; font-weight: bold; }
  .doc-header .doc-meta { text-align: right; font-size: 9pt; color: #444; }

  .doc-title {
    text-align: center;
    font-size: 15pt;
    font-weight: bold;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    margin: 0 0 4pt;
  }
  .doc-subtitle {
    text-align: center;
    font-size: 8.5pt;
    color: #666;
    margin-bottom: 18pt;
  }

  /* ── Sections ── */
  .section {
    margin-bottom: 14pt;
    page-break-inside: avoid;
  }
  .section-title {
    font-size: 8pt;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #333;
    border-bottom: 1px solid #ccc;
    padding-bottom: 3pt;
    margin-bottom: 7pt;
  }

  /* ── Two-col party blocks ── */
  .party-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16pt;
    margin-bottom: 4pt;
  }
  .party-block { font-size: 9.5pt; }
  .party-label {
    font-size: 7.5pt;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #555;
    margin-bottom: 4pt;
  }

  /* ── Key/value tables ── */
  table { width: 100%; border-collapse: collapse; }
  td.lbl {
    color: #555;
    font-size: 9pt;
    width: 38%;
    padding: 2pt 8pt 2pt 0;
    vertical-align: top;
  }
  td.val {
    font-size: 10pt;
    padding: 2pt 0;
    vertical-align: top;
  }

  /* ── Amenity pills ── */
  .amenity-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 5pt;
    margin-top: 4pt;
  }
  .amenity-pill {
    font-size: 8.5pt;
    border: 1px solid #ccc;
    border-radius: 3pt;
    padding: 1pt 6pt;
    color: #333;
  }

  /* ── Signatures ── */
  .sig-section {
    margin-top: 20pt;
    page-break-inside: avoid;
  }
  .sig-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24pt;
    margin-top: 12pt;
  }
  .sig-block { font-size: 9.5pt; }
  .sig-role {
    font-size: 7.5pt;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #555;
    margin-bottom: 6pt;
  }
  .sig-image { max-width: 200pt; max-height: 48pt; display: block; margin-bottom: 2pt; }
  .sig-line { border-bottom: 1px solid #333; margin-bottom: 4pt; height: 44pt; }
  .sig-name { font-size: 9pt; font-weight: bold; }
  .sig-date { font-size: 8.5pt; color: #555; margin-top: 4pt; }

  /* ── Footer ── */
  .doc-footer {
    margin-top: 20pt;
    padding-top: 8pt;
    border-top: 1px solid #ddd;
    font-size: 8pt;
    color: #888;
    line-height: 1.4;
  }

  /* ── Subsection label ── */
  .sub-label {
    font-size: 8pt;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: #666;
    margin: 8pt 0 3pt;
  }
`;

// ─── main builder ────────────────────────────────────────────────────────────

export function buildPdfHtml(contract: Contract, profile: Profile | null): string {
  const amenities = (contract.amenities ?? {}) as Record<string, string | number | boolean>;
  const tenant = (contract.tenant_snapshot ?? contract.tenant) as
    | (TenantSnapshot | Tenant)
    | null;
  const property = (contract.property_snapshot ?? contract.property) as
    | (PropertySnapshot | Property)
    | null;

  const ten  = tenant  as Record<string, unknown> | null;
  const prop = property as Record<string, unknown> | null;

  const today    = new Date();
  const todayFmt = fmtDate(today.toISOString().split("T")[0]);
  const contractNo = contract.id.slice(-8).toUpperCase();

  const landlordName   = (profile?.company_name || profile?.full_name || "Landlord").trim();
  const landlordEmail  = profile?.email ?? "";
  const landlordPhone  = profile?.phone ?? "";

  // ── 1. Header ──────────────────────────────────────────────────────────────
  const header = `
  <div class="doc-header">
    <div class="landlord-block">
      <div class="landlord-name">${landlordName}</div>
      ${landlordEmail ? `<div>${landlordEmail}</div>` : ""}
      ${landlordPhone ? `<div>${landlordPhone}</div>` : ""}
    </div>
    <div class="doc-meta">
      <div>Date: ${todayFmt}</div>
      <div>Contract No: ${contractNo}</div>
    </div>
  </div>
  <div class="doc-title">Lease Agreement</div>
  <div class="doc-subtitle">
    ${contract.contract_type.charAt(0).toUpperCase() + contract.contract_type.slice(1)} &mdash;
    ${fmtDate(contract.lease_start)} through ${fmtDate(contract.lease_end)}
  </div>`;

  // ── 2. Parties ─────────────────────────────────────────────────────────────
  const tenantPartyRows = !ten ? "<em>No tenant on record</em>" : `
    <div class="party-label">Tenant</div>
    ${table(`
      ${r("Full Name",    String(ten.full_name ?? ""))}
      ${r("Email",        String(ten.email ?? ""))}
      ${r("Phone",        String(ten.phone ?? ""))}
      ${r("License / ID", String(ten.license_number ?? ""))}
      ${ten.ssn_last4 ? `<tr><td class="lbl">SSN (Last 4)</td><td class="val">xxx-xx-${ten.ssn_last4}</td></tr>` : ""}
      ${r("Date of Birth",    fmtDate(String(ten.date_of_birth ?? "")))}
      ${r("Current Address",  String(ten.current_address ?? ""))}
    `)}
  `;

  const landlordPartyBlock = `
    <div class="party-label">Landlord</div>
    ${table(`
      ${r("Name",  landlordName)}
      ${r("Email", landlordEmail)}
      ${r("Phone", landlordPhone)}
    `)}
  `;

  const partiesHtml = `
  <div class="section">
    <div class="section-title">Parties</div>
    <div class="party-grid">
      <div class="party-block">${landlordPartyBlock}</div>
      <div class="party-block">${tenantPartyRows}</div>
    </div>
  </div>`;

  // ── 3. Tenant — employment & emergency contact (if present) ────────────────
  const hasEmployer  = ten && (ten.employer_name || ten.employer_phone || ten.monthly_income);
  const hasEmergency = ten && (ten.emergency_contact_name || ten.emergency_contact_phone);

  const tenantExtended = (hasEmployer || hasEmergency) ? `
  <div class="section">
    <div class="section-title">Additional Tenant Details</div>
    ${hasEmployer ? `
      <div class="sub-label">Employment</div>
      ${table(`
        ${r("Employer",        String(ten!.employer_name ?? ""))}
        ${r("Employer Phone",  String(ten!.employer_phone ?? ""))}
        ${ten!.monthly_income != null ? `<tr><td class="lbl">Monthly Income</td><td class="val">${fmtMoney(Number(ten!.monthly_income))}</td></tr>` : ""}
      `)}
    ` : ""}
    ${hasEmergency ? `
      <div class="sub-label">Emergency Contact</div>
      ${table(`
        ${r("Name",  String(ten!.emergency_contact_name ?? ""))}
        ${r("Phone", String(ten!.emergency_contact_phone ?? ""))}
      `)}
    ` : ""}
  </div>` : "";

  // ── 4. Property ────────────────────────────────────────────────────────────
  const propertySection = !prop ? "" : section("Property", table(`
    ${r("Property Name",  String(prop.name ?? ""))}
    ${r("Address",        String(prop.address ?? ""))}
    ${r("City / State",   [prop.city, prop.state].filter(Boolean).join(", "))}
    ${r("ZIP",            String(prop.zip ?? ""))}
    ${r("Unit",           contract.unit_number)}
  `));

  // ── 5. Unit Details ────────────────────────────────────────────────────────
  const parkingAvailable = prop?.parking_available ?? Boolean(amenities.parking);
  const parkingCount     = prop?.parking_count ?? 0;
  const parkingSpot      = amenities.parking_spot ? String(amenities.parking_spot) : "";

  const unitSection = section("Unit Details", table(`
    ${amenities.room_count     ? r("Bedrooms",       String(amenities.room_count))      : ""}
    ${prop?.bathroom_count     ? r("Bathrooms",      String(prop.bathroom_count))        : ""}
    ${r("Parking",             check(Boolean(parkingAvailable)))}
    ${parkingAvailable && parkingCount ? r("Parking Spaces", String(parkingCount))       : ""}
    ${parkingAvailable && parkingSpot  ? r("Parking Spot",   parkingSpot)               : ""}
    ${r("Keys Provided",       contract.key_count ? String(contract.key_count) : "")}
  `));

  // ── 6. Lease Term ──────────────────────────────────────────────────────────
  const years = Math.floor(contract.lease_months / 12);
  const remMonths = contract.lease_months % 12;
  const durationParts = [];
  if (years > 0)      durationParts.push(`${years} year${years !== 1 ? "s" : ""}`);
  if (remMonths > 0)  durationParts.push(`${remMonths} month${remMonths !== 1 ? "s" : ""}`);
  const duration = durationParts.join(" and ") || `${contract.lease_months} months`;

  const leaseSection = section("Lease Term", table(`
    ${r("Start Date",  fmtDate(contract.lease_start))}
    ${r("End Date",    fmtDate(contract.lease_end))}
    ${r("Duration",    duration)}
  `));

  // ── 7. Financial Terms ─────────────────────────────────────────────────────
  const paymentVerbal = contract.rent_amount_verbal
    ? ` <span style="color:#555;font-size:9.5pt;">(${contract.rent_amount_verbal})</span>`
    : "";

  const financialSection = section("Financial Terms", `
    ${table(`
      <tr><td class="lbl">Monthly Rent</td><td class="val">${fmtMoney(contract.rent_amount)}${paymentVerbal}</td></tr>
      ${contract.security_deposit ? `<tr><td class="lbl">Security Deposit</td><td class="val">${fmtMoney(contract.security_deposit)}</td></tr>` : ""}
      ${r("Payment Due",   `Day ${contract.payment_due_day} of each month`)}
      ${r("Late Fee After", `Day ${contract.late_fee_day} of each month`)}
    `)}
  `);

  // ── 8. Late Fee Policy ─────────────────────────────────────────────────────
  const lfType  = contract.late_fee_type ?? "fixed";
  const lfGrace = contract.late_fee_grace_period_days ?? 0;
  const lfFixed = contract.late_fee_fixed_amount ?? 0;
  const lfDaily = contract.late_fee_daily_amount ?? 0;

  const lateFeeRows = [
    r("Fee Type",      lfType === "fixed" ? "Fixed Amount" : lfType === "daily" ? "Daily Accrual" : "Fixed + Daily"),
    lfGrace > 0       ? r("Grace Period",  `${lfGrace} day${lfGrace !== 1 ? "s" : ""}`) : "",
    (lfType === "fixed" || lfType === "both") && lfFixed > 0 ? r("Fixed Late Fee", fmtMoney(lfFixed)) : "",
    (lfType === "daily" || lfType === "both") && lfDaily > 0 ? r("Daily Penalty",  `${fmtMoney(lfDaily)} / day`) : "",
  ].join("");

  const lateFeeSection = lateFeeRows.trim()
    ? section("Late Fee Policy", table(lateFeeRows))
    : "";

  // ── 9. Included Amenities ──────────────────────────────────────────────────
  const amenityLabels: Record<string, string> = {
    mirror_doors:        "Mirror Closet Doors",
    renovated_bathroom:  "Renovated Bathroom",
    microwave:           "Microwave",
    fridge:              "Refrigerator",
    ac:                  "Air Conditioning",
    mini_blinds:         "Mini Blinds",
    sofa:                "Sofa",
    futon:               "Futon",
    wall_art:            "Wall Art",
    fan_count:           "Ceiling Fans",
    stool_count:         "Bar Stools",
    stove_count:         "Stoves",
  };

  const activePills = Object.entries(amenityLabels)
    .filter(([key]) => {
      const v = amenities[key];
      return v === true || (typeof v === "number" && v > 0);
    })
    .map(([key, label]) => {
      const v = amenities[key];
      const display = typeof v === "number" ? `${v} ${label}` : label;
      return `<span class="amenity-pill">${display}</span>`;
    })
    .join("");

  const amenitiesSection = activePills
    ? section("Included Amenities", `<div class="amenity-grid">${activePills}</div>`)
    : "";

  // ── 10. Additional Occupants ───────────────────────────────────────────────
  const occupantNames = contract.occupant_names ?? [];
  const occupantCount = contract.occupant_count ?? 1;
  const occupantsSection = (occupantNames.length > 0 || occupantCount > 1)
    ? section("Additional Occupants", table(`
        ${occupantNames.length > 0 ? r("Names", occupantNames.join(", ")) : ""}
        ${r("Total Occupants", String(occupantCount))}
      `))
    : "";

  // ── 11. Signatures ─────────────────────────────────────────────────────────
  const signedDate = contract.signed_at ? fmtDate(contract.signed_at.split("T")[0]) : "";

  function sigBlock(role: string, name: string, sig: string | null): string {
    return `
    <div class="sig-block">
      <div class="sig-role">${role}</div>
      ${sig
        ? `<img class="sig-image" src="${sig}" alt="${role} signature">`
        : `<div class="sig-line"></div>`}
      <div class="sig-name">${name}</div>
      <div class="sig-date">Date: ${signedDate || "_________________"}</div>
    </div>`;
  }

  const sigSection = `
  <div class="sig-section">
    <div class="section-title">Signatures</div>
    <div class="sig-grid">
      ${sigBlock("Landlord", landlordName, contract.landlord_signature)}
      ${sigBlock("Tenant",   String(ten?.full_name ?? ""), contract.tenant_signature)}
    </div>
  </div>`;

  // ── 12. Footer ─────────────────────────────────────────────────────────────
  const footer = `
  <div class="doc-footer">
    This document constitutes a legally binding agreement between the parties listed above.
    Any modifications to this agreement must be made in writing and signed by both parties.
    Contract ID: ${contract.id}
  </div>`;

  // ── Assemble ───────────────────────────────────────────────────────────────
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>${CSS}</style>
</head>
<body>
  ${header}
  ${partiesHtml}
  ${tenantExtended}
  ${propertySection}
  ${unitSection}
  ${leaseSection}
  ${financialSection}
  ${lateFeeSection}
  ${amenitiesSection}
  ${occupantsSection}
  ${sigSection}
  ${footer}
</body>
</html>`;
}
