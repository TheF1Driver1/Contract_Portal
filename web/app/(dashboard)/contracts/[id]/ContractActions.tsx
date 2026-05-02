"use client";

import { useState } from "react";
import { Download, Loader2, Trash2 } from "lucide-react";
import type { Contract } from "@/lib/types";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function ContractActions({ contract }: { contract: Contract }) {
  const [generating, setGenerating] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleDownload() {
    setGenerating(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractId: contract.id }),
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `contract_${contract.id}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Failed to generate document: " + (e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleDownloadPDF() {
    const { pdf } = await import("@react-pdf/renderer");
    const { default: ContractPDF } = await import("@/components/ContractPDF");
    const blob = await pdf(<ContractPDF contract={contract} />).toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contract_${contract.id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDelete() {
    if (!confirm("Delete this contract? This cannot be undone.")) return;
    await supabase.from("contracts").delete().eq("id", contract.id);
    router.push("/contracts");
  }

  return (
    <div className="flex items-center gap-2">
      <button
        className="btn-tonal flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium disabled:opacity-50"
        onClick={handleDownload}
        disabled={generating}
      >
        {generating ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Download className="h-3.5 w-3.5" />
        )}
        DOCX
      </button>
      <button
        className="btn-tonal flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium"
        onClick={handleDownloadPDF}
      >
        <Download className="h-3.5 w-3.5" />
        PDF
      </button>
      <button
        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium"
        style={{ background: "rgba(255,59,48,0.12)", color: "#ff3b30" }}
        onClick={handleDelete}
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete
      </button>
    </div>
  );
}
