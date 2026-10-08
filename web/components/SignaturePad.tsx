"use client";

import { useRef, useEffect, useId } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Eraser } from "lucide-react";

// The canvas stays white in both themes so signatures remain legible and
// export with a white background; ink is near-black.
const PAPER = "white";
const INK = "black";

interface SignaturePadProps {
  label: string;
  value: string;
  onChange: (dataUrl: string) => void;
}

export default function SignaturePad({ label, value, onChange }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const t = useTranslations("builder.signaturePad");
  const labelId = useId();

  // Restore from value
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restore once on mount
  }, []);

  function getPos(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ("touches" in e) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    isDrawing.current = true;
    lastPos.current = getPos(e);
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    if (!isDrawing.current) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const pos = getPos(e);

    ctx.beginPath();
    ctx.moveTo(lastPos.current!.x, lastPos.current!.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();

    lastPos.current = pos;
  }

  function endDraw() {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    lastPos.current = null;
    const canvas = canvasRef.current!;
    onChange(canvas.toDataURL("image/png"));
  }

  function clear() {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    onChange("");
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p id={labelId} className="text-sm font-medium text-foreground">{label}</p>
        <Button type="button" variant="ghost" size="sm" className="h-10 md:h-8" onClick={clear}>
          <Eraser />
          {t("clear")}
        </Button>
      </div>
      <canvas
        ref={canvasRef}
        width={500}
        height={160}
        role="img"
        aria-labelledby={labelId}
        aria-describedby={`${labelId}-hint`}
        className="block w-full cursor-crosshair touch-none rounded-lg border border-dashed border-border-strong bg-white"
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
      />
      <p id={`${labelId}-hint`} className="text-xs text-muted-foreground">
        {value ? t("signed") : t("hint")}
      </p>
    </div>
  );
}
