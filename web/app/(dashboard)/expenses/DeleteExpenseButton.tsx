"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export default function DeleteExpenseButton({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this expense?")) return;
    setLoading(true);
    await fetch(`/api/expenses/${id}`, { method: "DELETE" });
    router.refresh();
    setLoading(false);
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="opacity-0 group-hover:opacity-100 flex h-7 w-7 items-center justify-center rounded-lg transition-all hover:bg-red-500/20"
      aria-label="Delete expense"
    >
      <Trash2 className="h-3.5 w-3.5" style={{ color: "#ef4444" }} />
    </button>
  );
}
