"use client";

import { HelpCircle } from "lucide-react";
import { useState } from "react";

interface HelpTooltipProps {
  text: string;
  side?: "top" | "bottom" | "left" | "right";
}

export function HelpTooltip({ text, side = "top" }: HelpTooltipProps) {
  const [visible, setVisible] = useState(false);

  const positionClass: Record<string, string> = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        className="inline-flex items-center justify-center rounded-full opacity-40 hover:opacity-70 transition-opacity focus:outline-none"
        aria-label="Help"
      >
        <HelpCircle className="h-3.5 w-3.5" style={{ color: "var(--text-muted)" }} />
      </button>

      {visible && (
        <span
          className={`absolute z-50 whitespace-normal pointer-events-none ${positionClass[side]}`}
          style={{ maxWidth: 240 }}
        >
          <span
            className="block rounded-xl px-3 py-2 text-xs leading-relaxed"
            style={{
              background: "rgba(22,28,40,0.92)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.10)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.40)",
              color: "rgba(200,210,230,0.85)",
              fontSize: 12,
            }}
          >
            {text}
          </span>
        </span>
      )}
    </span>
  );
}
