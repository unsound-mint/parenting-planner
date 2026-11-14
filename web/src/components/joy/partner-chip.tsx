import type { Person } from "@/lib/roles";
import { roleAccent, roleLabel } from "@/lib/visuals";
import { cn } from "@/lib/utils";

type Who = Pick<Person, "displayName" | "role">;

/** A person's initial in their own colour. Fixed per person: it does not swap with the acting parent. */
export function Avatar({ person, size = "md", className }: { person: Who; size?: "sm" | "md"; className?: string }) {
  return (
    <span
      title={`${person.displayName}, ${roleLabel[person.role]}`}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
        size === "sm" ? "size-5.5 text-[0.6875rem]" : "size-7 text-caption",
        roleAccent[person.role].bg,
        className,
      )}
    >
      {person.displayName.charAt(0).toUpperCase()}
    </span>
  );
}

/**
 * Who did or said something, in their colour: "Jake saved it for you",
 * "3 of 8", "Emily added". With no children it is just the avatar and name.
 * Use it wherever both parents' activity shows, so each person reads the same everywhere.
 */
export function PartnerChip({ person, children, className }: { person: Who; children?: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 max-w-full items-center gap-1.5 rounded-full py-0.5 pr-2.5 pl-0.5 text-label",
        roleAccent[person.role].soft,
        roleAccent[person.role].text,
        className,
      )}
    >
      <Avatar person={person} size="sm" />
      <span className="truncate">{children ?? person.displayName}</span>
    </span>
  );
}
