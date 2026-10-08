import { FlaskConical } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/** Small "Labs" (beta) marker shown next to page titles. */
export function LabsBadge({ label }: { label: string }) {
  return (
    <Badge variant="secondary" className="bg-info-soft text-info align-middle">
      <FlaskConical aria-hidden />
      {label}
    </Badge>
  );
}
