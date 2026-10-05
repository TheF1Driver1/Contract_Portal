import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ContractSignatures from "@/app/(dashboard)/contracts/[id]/ContractSignatures";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const SIG = "data:image/png;base64," + "A".repeat(200);

beforeEach(() => {
  refresh.mockReset();
  vi.restoreAllMocks();
});

describe("ContractSignatures", () => {
  it("offers landlord and in-person tenant signing when nothing is signed", () => {
    render(<ContractSignatures contractId="c1" tenantName="Ana" />);
    expect(screen.getByRole("button", { name: /sign as tenant \(in person\)/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign as landlord/i })).toBeInTheDocument();
  });

  it("opens the signing modal with save disabled until something is drawn", () => {
    render(<ContractSignatures contractId="c1" />);
    fireEvent.click(screen.getByRole("button", { name: /sign as tenant \(in person\)/i }));
    expect(screen.getByText(/marks the contract as signed/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save signature/i })).toBeDisabled();
  });

  it("removes a saved signature via the API after confirmation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
    render(<ContractSignatures contractId="c1" landlordSignature={SIG} />);
    fireEvent.click(screen.getByRole("button", { name: /remove/i }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith("/api/contracts/c1/signature?role=landlord", { method: "DELETE" });
  });
});
