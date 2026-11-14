"use client";

import { Switch } from "@base-ui/react/switch";
import { Check, Minus } from "lucide-react";
import type { CaregiverPermission } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { permissionIcon, permissionLabel } from "@/lib/visuals";

// One permission as an icon, a name and a switch. The invite form edits it;
// the privacy centre shows the same row read-only (no onChange), because the
// contract has no call to change a caregiver's permissions after the invite.
export function PermissionRow({ permission, on, onChange, idPrefix = "perm" }: { permission: CaregiverPermission; on: boolean; onChange?: (on: boolean) => void; idPrefix?: string }) {
  const Icon = permissionIcon[permission];
  const id = `${idPrefix}-${permission}`;
  return (
    <div className={cn("flex min-h-14 items-center gap-3 border-t border-border py-2 first:border-t-0 transition-opacity duration-150", !on && "opacity-60")}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon aria-hidden className="size-4.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span id={id} className="block text-label font-medium">
          {permissionLabel[permission].name}
        </span>
        <span className="block text-caption text-muted-foreground">{permissionLabel[permission].hint}</span>
      </span>
      {onChange ? (
        <Switch.Root
          checked={on}
          onCheckedChange={onChange}
          aria-labelledby={id}
          className="relative flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full bg-input p-0.5 transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 data-[checked]:bg-primary"
        >
          <Switch.Thumb className="size-6 rounded-full bg-card shadow-sm transition-transform duration-150 ease-(--ease-out) data-[checked]:translate-x-5" />
        </Switch.Root>
      ) : (
        <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full", on ? "bg-status-ok-soft text-status-ok" : "bg-muted text-muted-foreground")}>
          {on ? <Check aria-hidden className="size-4" /> : <Minus aria-hidden className="size-4" />}
          <span className="sr-only">{on ? "Can see" : "Cannot see"}</span>
        </span>
      )}
    </div>
  );
}
