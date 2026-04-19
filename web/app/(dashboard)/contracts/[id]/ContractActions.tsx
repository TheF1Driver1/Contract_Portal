"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Send, Loader2, Trash2 } from "lucide-react";
import type { Contract } from "@/lib/types";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function ContractActions({ contract }: { contract: Contract }) {
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
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

  async function handleDelete() {
    if (!confirm("Delete this contract? This cannot be undone.")) return;
    await supabase.from("contracts").delete().eq("id", contract.id);
    router.push("/contracts");
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={handleDownload} disabled={generating}>
        {generating ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        ) : (
          <Download className="mr-1.5 h-3.5 w-3.5" />
        )}
        Download
      </Button>
      <Button
        variant="destructive"
        size="sm"
        onClick={handleDelete}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
