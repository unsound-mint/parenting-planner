"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Switch } from "@base-ui/react/switch";
import { toast } from "sonner";
import { Check, Copy, Lock } from "lucide-react";
import { api } from "@/lib/api/client";
import type { CaregiverPermission, CaregiverRole, CreatedInvitation } from "@/lib/api/types";
import { formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { permissionIcon, permissionLabel, roleAccent, roleIcon, roleLabel } from "@/lib/visuals";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// The contract lists the defaults per role (InvitationInput in api/openapi.yaml).
const defaults: Record<CaregiverRole, CaregiverPermission[]> = {
  nanny: ["care_log", "baby_passport", "schedule"],
  grandparent: ["care_log", "baby_passport", "schedule", "pregnancy_updates"],
};
const roles: CaregiverRole[] = ["nanny", "grandparent"];
const allPermissions: CaregiverPermission[] = ["care_log", "baby_passport", "schedule", "family_plan", "pregnancy_updates"];

// Role first, then what they may see as switches. The switches are also the
// "what they will see" preview: off rows are dimmed, and the never-shared line
// below is fixed because the API cannot grant those records at all.
export function InviteForm({ memberId }: { memberId: string }) {
  const router = useRouter();
  const [role, setRole] = useState<CaregiverRole>("nanny");
  const [name, setName] = useState("");
  const [perms, setPerms] = useState<Set<CaregiverPermission>>(new Set(defaults.nanny));
  const [created, setCreated] = useState<CreatedInvitation | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  function pick(r: CaregiverRole) {
    setRole(r);
    setPerms(new Set(defaults[r]));
  }

  function toggle(p: CaregiverPermission, on: boolean) {
    setPerms((cur) => {
      const next = new Set(cur);
      if (on) next.add(p);
      else next.delete(p);
      return next;
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || perms.size === 0) return;
    startTransition(async () => {
      const { data, error } = await api.POST("/members/{memberId}/invitations", {
        params: { path: { memberId } },
        body: { role, displayName: name.trim(), permissions: allPermissions.filter((p) => perms.has(p)) },
      });
      if (error || !data) {
        toast.error(error?.message ?? "Could not create the link. Please try again.");
        return;
      }
      // The link exists only in this response. Keep it in state: the refresh below must not lose it.
      setCreated(data);
      setCopied(false);
      setName("");
      router.refresh();
    });
  }

  const link = created ? `${window.location.origin}${created.path}` : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Link copied. Send it to " + (created?.invitation.displayName ?? "them") + ".");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy. Select the link and copy it by hand.");
    }
  }

  return (
    <section aria-labelledby="invite-title" className="rounded-2xl border border-border bg-card p-4 md:p-5">
      <h2 id="invite-title" className="text-title">
        Invite someone to help
      </h2>

      {created ? (
        <div className="mt-4 flex flex-col gap-3" aria-live="polite">
          <p className="text-body">
            Link for <span className="font-semibold">{created.invitation.displayName}</span>. It opens once and works until{" "}
            <span className="font-mono">{formatShortDate(created.invitation.expiresAt)}</span>. It is not shown again.
          </p>
          <div className="flex items-center gap-2">
            <Input readOnly value={link} aria-label="Invitation link" onFocus={(e) => e.currentTarget.select()} className="h-11 font-mono text-label" />
            <Button type="button" onClick={copy} className="h-11 shrink-0 gap-2 px-4">
              {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <Button type="button" variant="ghost" className="h-11 self-start" onClick={() => setCreated(null)}>
            Invite someone else
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-4 flex flex-col gap-5">
          <div role="radiogroup" aria-label="Role" className="grid grid-cols-2 gap-2">
            {roles.map((r) => {
              const Icon = roleIcon[r];
              const on = role === r;
              return (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => pick(r)}
                  className={cn(
                    "flex min-h-14 items-center gap-3 rounded-xl border px-3 text-left transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    on ? "border-primary bg-secondary" : "border-border bg-background hover:bg-muted",
                  )}
                >
                  <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full text-card", roleAccent[r].bg)}>
                    <Icon aria-hidden className="size-4.5" />
                  </span>
                  <span className="text-title font-semibold">{roleLabel[r]}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="invitee" className="text-label font-medium">
              Their name
            </Label>
            <Input id="invitee" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required placeholder={role === "nanny" ? "Maria" : "Grandma Rose"} className="h-11 text-base" />
          </div>

          <fieldset className="flex flex-col">
            <legend className="mb-1 text-label font-medium">They will see</legend>
            {allPermissions.map((p) => {
              const Icon = permissionIcon[p];
              const on = perms.has(p);
              return (
                <div key={p} className={cn("flex min-h-14 items-center gap-3 border-t border-border py-2 first:border-t-0 transition-opacity duration-150", !on && "opacity-60")}>
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Icon aria-hidden className="size-4.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span id={`perm-${p}`} className="block text-label font-medium">
                      {permissionLabel[p].name}
                    </span>
                    <span className="block text-caption text-muted-foreground">{permissionLabel[p].hint}</span>
                  </span>
                  <Switch.Root
                    checked={on}
                    onCheckedChange={(v) => toggle(p, v)}
                    aria-labelledby={`perm-${p}`}
                    className="relative flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full bg-input p-0.5 transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 data-[checked]:bg-primary"
                  >
                    <Switch.Thumb className="size-6 rounded-full bg-card shadow-sm transition-transform duration-150 ease-(--ease-out) data-[checked]:translate-x-5" />
                  </Switch.Root>
                </div>
              );
            })}
            <p className="mt-2 flex items-center gap-2 rounded-xl bg-muted px-3 py-2.5 text-label text-muted-foreground">
              <Lock aria-hidden className="size-4 shrink-0" />
              Never shared: diaries, mood check-ins, labs and session notes.
            </p>
          </fieldset>

          <Button type="submit" size="lg" disabled={pending || !name.trim() || perms.size === 0} className="h-12 text-body font-semibold">
            Create link
          </Button>
        </form>
      )}
    </section>
  );
}
