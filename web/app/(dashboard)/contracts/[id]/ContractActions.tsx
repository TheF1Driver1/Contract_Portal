"use client";

import { useState } from "react";
import { Download, Loader2, Trash2 } from "lucide-react";
import type { Contract } from "@/lib/types";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function ContractActions({ contract }: { contract: Contract }) {
  const [generatingDocx, setGeneratingDocx] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleDownload(format: "docx" | "pdf") {
    format === "pdf" ? setGeneratingPdf(true) : setGeneratingDocx(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractId: contract.id, format }),
      });
      if (!res.ok) throw new Error(await res.text());
      const contentType = res.headers.get("content-type") ?? "";
      const ext = contentType.includes("pdf") ? "pdf" : "docx";
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `contract_${contract.id}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Failed to generate document: " + (e as Error).message);
    } finally {
      setGeneratingDocx(false);
      setGeneratingPdf(false);
    }
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
        onClick={() => handleDownload("docx")}
        disabled={generatingDocx}
      >
        {generatingDocx ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        DOCX
      </button>
      <button
        className="btn-tonal flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium disabled:opacity-50"
        onClick={() => handleDownload("pdf")}
        disabled={generatingPdf}
      >
        {generatingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
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
