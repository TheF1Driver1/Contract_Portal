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
  return render(<ContractBuilder properties={properties} tenants={tenants} templates={[]} userId="u1" landlordEmail="landlord@example.com" />);
}

// --- Tests ---

describe("ContractBuilder step navigation", () => {
  it("renders step 0 (Contract Details) by default", () => {
    setup();
    expect(screen.getByText("Contract Details")).toBeInTheDocument();
  });

  it("shows all 5 step tabs", () => {
    setup();
    ["Details", "Property", "Payment", "Signatures", "Send"].forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  it("Back button disabled on step 0", () => {
    setup();
    expect(screen.getByRole("button", { name: /back/i })).toBeDisabled();
  });

  it("clicking Property tab advances to step 1 content", async () => {
    setup();
    await userEvent.click(getStepButton("Property"));
    expect(screen.getByText("Property & Amenities")).toBeInTheDocument();
  });

  it("Back returns to step 0 from step 1", async () => {
    setup();
    await userEvent.click(getStepButton("Property"));
    await userEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(screen.getByText("Contract Details")).toBeInTheDocument();
  });

  it("clicking step tab jumps directly to that step", async () => {
    setup();
    await userEvent.click(getStepButton("Payment"));
    expect(screen.getByText("Payment Terms")).toBeInTheDocument();
  });

  it("Continue not shown on last step", async () => {
    setup();
    await userEvent.click(getStepButton("Send"));
    expect(screen.queryByRole("button", { name: /continue/i })).not.toBeInTheDocument();
  });

  it("last step shows Send Contract submit button", async () => {
    setup();
    await userEvent.click(getStepButton("Send"));
    expect(screen.getByRole("button", { name: /save & send contract/i })).toBeInTheDocument();
  });
});

function getStepButton(label: string) {
  return screen.getAllByRole("button").find(b => {
    const spans = b.querySelectorAll("span");
    return Array.from(spans).some(s => s.textContent?.trim() === label);
  })!;
}

describe("ContractBuilder step 4 (Send) conditional fields", () => {
  async function goToSendStep() {
    setup();
    await userEvent.click(getStepButton("Send"));
  }

  it("Send step shows Save & Send Contract button", async () => {
    await goToSendStep();
    expect(screen.getByRole("button", { name: /save & send contract/i })).toBeInTheDocument();
  });

  it("SMS phone input hidden when SMS checkbox unchecked", async () => {
    await goToSendStep();
    expect(screen.queryByPlaceholderText("+1 787 555 0100")).not.toBeInTheDocument();
  });

  it("SMS phone input shown when SMS checkbox checked", async () => {
    await goToSendStep();
    const smsCheckbox = screen.getAllByRole("checkbox")[0];
    await userEvent.click(smsCheckbox);
    expect(screen.getByPlaceholderText("+1 787 555 0100")).toBeInTheDocument();
  });

  it("email address input always visible for landlord copy", async () => {
    await goToSendStep();
    const emailInputs = screen.getAllByRole("textbox");
    expect(emailInputs.some(i => (i as HTMLInputElement).type === "email")).toBe(true);
  });
});

describe("ContractBuilder step 3 (Signatures)", () => {
  async function goToSignaturesStep() {
    setup();
    await userEvent.click(getStepButton("Signatures"));
  }

  it("renders signature pads for landlord and tenant", async () => {
    await goToSignaturesStep();
    expect(screen.getByText("Landlord Signature")).toBeInTheDocument();
    expect(screen.getByText("Tenant Signature")).toBeInTheDocument();
  });

  it("PDF and DOCX download buttons present on signatures step", async () => {
    await goToSignaturesStep();
    const buttons = screen.getAllByRole("button");
    expect(buttons.some(b => b.textContent?.trim() === "PDF")).toBe(true);
    expect(buttons.some(b => b.textContent?.trim() === "DOCX")).toBe(true);
  });
});
