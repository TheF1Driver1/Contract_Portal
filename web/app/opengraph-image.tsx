import { ImageResponse } from "next/og";

export const alt = "ContractOS — Contratos de arrendamiento para Puerto Rico";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Share card (Open Graph / Twitter). Colors mirror the light theme tokens.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#f6f7f9",
          color: "#0f172a",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 36, fontWeight: 700 }}>
          <div style={{ width: 56, height: 56, borderRadius: 12, background: "#0f766e" }} />
          ContractOS
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.1, letterSpacing: -1.5 }}>
            Contratos de arrendamiento para Puerto Rico
          </div>
          <div style={{ fontSize: 34, color: "#475569" }}>Prepara, envía y firma en minutos.</div>
        </div>
        <div style={{ fontSize: 28, color: "#0f766e", fontWeight: 600 }}>prcontract.online</div>
      </div>
    ),
    size
  );
}
