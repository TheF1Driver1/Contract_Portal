import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ContractBuilder from "@/components/ContractBuilder";
import type { Property, Tenant } from "@/lib/types";

// --- Mocks ---

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/supabase", () => ({
  createClient: () => ({
    from: () => ({
      insert: () => ({ select: () => ({ single: async () => ({ data: { id: "new-id" }, error: null }) }) }),
      update: () => ({ eq: async () => ({ error: null }) }),
    }),
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
  }),
}));

// SignaturePad uses canvas — stub it out
vi.mock("@/components/SignaturePad", () => ({
  default: ({ label, onChange }: { label: string; onChange: (v: string) => void }) => (
    <div>
      <span>{label}</span>
      <button onClick={() => onChange("data:image/png;base64,fake")}>Sign</button>
    </div>
  ),
}));

// --- Fixtures ---

const properties: Property[] = [
  { id: "p1", owner_id: "u1", name: "Sabana Gardens", address: "456 Oak", city: "San Juan", state: "PR", zip: "00901", unit_count: 5, created_at: "" },
];

const tenants: Tenant[] = [
  { id: "t1", owner_id: "u1", full_name: "Jane Smith", email: "jane@example.com", phone: null, ssn_last4: "4567", license_number: "D123", current_address: "123 Main", created_at: "" },
];

function setup() {
  return render(<ContractBuilder properties={properties} tenants={tenants} userId="u1" landlordEmail="landlord@example.com" />);
}

// --- Tests ---

describe("ContractBuilder step navigation", () => {
  it("renders step 0 (Contract Details) by default", () => {
    setup();
    expect(screen.getByText("Contract Details")).toBeInTheDocument();
  });

  it("shows all 5 step tabs", () => {
    setup();
    ["Details", "Property & Amenities", "Payment", "Signatures", "Send"].forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  it("Back button disabled on step 0", () => {
    setup();
    expect(screen.getByRole("button", { name: /back/i })).toBeDisabled();
  });

  it("Continue advances to step 1", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(screen.getByRole("heading", { name: "Property & Amenities" })).toBeInTheDocument();
  });

  it("Back returns to step 0 from step 1", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: /continue/i }));
    await userEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(screen.getByText("Contract Details")).toBeInTheDocument();
  });

  it("clicking step tab jumps directly to that step", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Payment" }));
    expect(screen.getByText("Payment Terms")).toBeInTheDocument();
  });

  it("Continue not shown on last step", async () => {
    setup();
    // Navigate to last step (Send)
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(screen.queryByRole("button", { name: /continue/i })).not.toBeInTheDocument();
  });

  it("last step shows Send Contract submit button", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(screen.getByRole("button", { name: /save & send contract/i })).toBeInTheDocument();
  });
});

describe("ContractBuilder step 4 (Send) conditional fields", () => {
  it("email input hidden when email checkbox unchecked", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(screen.queryByPlaceholderText("tenant@example.com")).not.toBeInTheDocument();
  });

  it("email input shown when email checkbox checked", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    const emailCheckbox = screen.getByRole("checkbox", { name: /email/i });
    await userEvent.click(emailCheckbox);
    expect(screen.getByPlaceholderText("tenant@example.com")).toBeInTheDocument();
  });

  it("SMS input hidden when SMS checkbox unchecked", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(screen.queryByPlaceholderText("+1 787 555 0100")).not.toBeInTheDocument();
  });

  it("SMS input shown when SMS checkbox checked", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    const smsCheckbox = screen.getByRole("checkbox", { name: /sms/i });
    await userEvent.click(smsCheckbox);
    expect(screen.getByPlaceholderText("+1 787 555 0100")).toBeInTheDocument();
  });
});

describe("ContractBuilder step 3 (Signatures)", () => {
  it("renders signature pads for landlord and tenant", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Signatures" }));
    expect(screen.getByText("Landlord Signature")).toBeInTheDocument();
    expect(screen.getByText("Tenant Signature")).toBeInTheDocument();
  });

  it("Download DOCX button present on signatures step", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Signatures" }));
    expect(screen.getByRole("button", { name: /download docx/i })).toBeInTheDocument();
  });
});
