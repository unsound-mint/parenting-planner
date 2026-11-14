"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import type { CaregiverPermission } from "@/lib/api/types";
import { PermissionRow } from "@/components/people/permission-row";

const allPermissions: CaregiverPermission[] = ["care_log", "baby_passport", "schedule", "family_plan", "pregnancy_updates"];

// One caregiver's permissions as switches. Each switch saves at once; the API checks the new
// list on the caregiver's next request, so turning one off takes effect immediately.
export function CaregiverPermissions({ memberId, caregiverId, initial }: { memberId: string; caregiverId: string; initial: CaregiverPermission[] }) {
  const router = useRouter();
  const [granted, setGranted] = useState(initial);
  const [pending, startTransition] = useTransition();

  function change(p: CaregiverPermission, on: boolean) {
    const next = on ? [...granted, p] : granted.filter((x) => x !== p);
    const before = granted;
    setGranted(next);
    startTransition(async () => {
      const { error } = await api.PATCH("/members/{memberId}/caregivers/{caregiverId}", {
        params: { path: { memberId, caregiverId } },
        body: { permissions: next },
      });
      if (error) {
        setGranted(before);
        toast.error(error.message ?? "Could not change what they see. Nothing changed.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className={pending ? "pointer-events-none flex flex-col" : "flex flex-col"}>
      {allPermissions.map((p) => (
        <PermissionRow key={p} permission={p} on={granted.includes(p)} onChange={(on) => change(p, on)} idPrefix={caregiverId} />
      ))}
    </div>
  );
}
