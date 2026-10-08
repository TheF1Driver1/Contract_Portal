import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import ContractSignatures from "@/app/(dashboard)/contracts/[id]/ContractSignatures";
import common from "@/messages/en/common.json";
import contracts from "@/messages/en/contracts.json";
import builder from "@/messages/en/builder.json";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));

const SIG = "data:image/png;base64," + "A".repeat(200);

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ common, contracts, builder }} timeZone="America/Puerto_Rico">
      {ui}
    </NextIntlClientProvider>
  );
}

beforeEach(() => {
  refresh.mockReset();
  vi.restoreAllMocks();
});

describe("ContractSignatures", () => {
  it("offers only landlord signing; tenants sign in the verified flow", () => {
    renderWithIntl(<ContractSignatures contractId="c1" tenantName="Ana" />);
    expect(screen.getByRole("button", { name: /sign as landlord/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /sign as tenant/i })).not.toBeInTheDocument();
  });

  it("opens the landlord signing dialog with save disabled until something is drawn", () => {
    renderWithIntl(<ContractSignatures contractId="c1" />);
    fireEvent.click(screen.getByRole("button", { name: /sign as landlord/i }));
    expect(screen.getByRole("button", { name: /save signature/i })).toBeDisabled();
  });

  it("shows a legacy tenant signature read-only", () => {
    renderWithIntl(<ContractSignatures contractId="c1" tenantName="Ana" tenantSignature={SIG} />);
    expect(screen.getByRole("img", { name: /ana/i })).toBeInTheDocument();
  });

  it("removes a saved signature via the API after confirmation", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
    renderWithIntl(<ContractSignatures contractId="c1" landlordSignature={SIG} />);
    fireEvent.click(screen.getByRole("button", { name: /^remove$/i }));
    const dialog = await screen.findByRole("alertdialog").catch(() => screen.getByRole("dialog"));
    fireEvent.click(within(dialog).getByRole("button", { name: /^remove$/i }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith("/api/contracts/c1/signature?role=landlord", { method: "DELETE" });
  });
});
