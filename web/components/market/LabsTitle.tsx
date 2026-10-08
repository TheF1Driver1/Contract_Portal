import { LabsBadge } from "./LabsBadge";

/** Page title with the Labs badge, for use as PageHeader `title`. */
export function LabsTitle({ title, labs }: { title: string; labs: string }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {title}
      <LabsBadge label={labs} />
    </span>
  );
}
