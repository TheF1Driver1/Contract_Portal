"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle, ArrowRight, Loader2 } from "lucide-react";

export default function BillingSuccessPage() {
  const params = useSearchParams();
  const sessionId = params.get("session_id");
  const [status, setStatus] = useState<"loading" | "done">("loading");

  useEffect(() => {
    if (!sessionId) { setStatus("done"); return; }
    // Poll briefly — webhook may take a few seconds to update the profile
    const t = setTimeout(() => setStatus("done"), 3000);
    return () => clearTimeout(t);
  }, [sessionId]);

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center px-4">
      {status === "loading" ? (
        <Loader2 size={40} className="text-[#10b981] animate-spin mb-6" />
      ) : (
        <CheckCircle size={56} className="mb-6" style={{ color: "#30d158" }} />
      )}

      <h1 className="text-2xl font-bold text-white mb-2">
        {status === "loading" ? "Procesando tu suscripción…" : "¡Suscripción activada!"}
      </h1>
      <p className="text-sm mb-8" style={{ color: "rgba(200,210,230,0.55)" }}>
        {status === "loading"
          ? "Esto solo tomará un momento."
          : "Tu plan ha sido actualizado. Ya puedes usar todas las funciones."}
      </p>

      {status === "done" && (
        <Link
          href="/dashboard"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: "#10b981", color: "#fff" }}
        >
          Ir al Dashboard
          <ArrowRight size={14} />
        </Link>
      )}
    </div>
  );
}
