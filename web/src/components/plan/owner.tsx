import type { Person } from "@/lib/roles";
import { roleAccent, roleLabel } from "@/lib/visuals";
import { cn } from "@/lib/utils";

// The owner of a task as a coloured initial, in the same role colours as the
// role switcher. Colour is never the only signal: the role name is in the label.
export function OwnerAvatar({ person, size = "md", dashed = false, className }: { person?: Person; size?: "sm" | "md"; dashed?: boolean; className?: string }) {
  return (
    <span
      role="img"
      aria-label={person ? `${roleLabel[person.role]}, ${person.displayName}` : "Unknown owner"}
      title={person ? `${roleLabel[person.role]}: ${person.displayName}` : undefined}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold text-card",
        size === "sm" ? "size-6 text-caption" : "size-8 text-label",
        person ? roleAccent[person.role].bg : "bg-muted-foreground",
        dashed && "opacity-60 ring-2 ring-card outline-2 -outline-offset-2 outline-dashed outline-foreground/40",
        className,
      )}
    >
      {person ? person.displayName.charAt(0).toUpperCase() : "?"}
    </span>
  );
}
