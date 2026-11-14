import type { Visibility } from "@/lib/api/types";
import { visibilityIcon, visibilityLabel } from "@/lib/visuals";

export const visibilityShort: Record<Visibility, string> = {
  private: "Only you",
  partner: "Partner",
  care_team: "Care team",
  family: "Whole family",
};

// Who can see a record: lock or people icon with the words beside it, full wording on hover.
export function VisibilityChip({ visibility }: { visibility: Visibility }) {
  const Icon = visibilityIcon[visibility];
  return (
    <span title={visibilityLabel[visibility]} className="inline-flex h-6 items-center gap-1 rounded-full bg-muted px-2 font-sans text-caption text-muted-foreground">
      <Icon className="size-3.5" aria-hidden />
      {visibilityShort[visibility]}
      <span className="sr-only">: {visibilityLabel[visibility]}</span>
    </span>
  );
}
