"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { EyeOff, FlaskConical, HeartCrack, Lock, type LucideIcon } from "lucide-react";
import { api } from "@/lib/api/client";
import type { JourneySettings } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

type Flag = "hideBabyContent" | "fertilityTreatment" | "previousLoss";

const rows: { flag: Flag; icon: LucideIcon; title: string; text: string }[] = [
  { flag: "hideBabyContent", icon: EyeOff, title: "Hide baby content", text: "This week and Learn leave out baby size, development and names for you." },
  { flag: "fertilityTreatment", icon: FlaskConical, title: "We are in fertility treatment", text: "Keeps the planning screens about appointments and notes, not just cycles." },
  { flag: "previousLoss", icon: HeartCrack, title: "We have had a loss before", text: "Only a note for how gently we word things. It does not turn on loss support." },
];

/**
 * Journey preferences for the acting parent, saved the moment a switch moves.
 * Private to them: the partner has their own, and no caregiver sees any of it.
 * Sits in Privacy, which People links to.
 */
export function JourneyPreferences({ memberId, initial, showTrying }: { memberId: string; initial: JourneySettings; showTrying: boolean }) {
  const router = useRouter();
  const [s, setS] = useState(initial);
  const [saving, setSaving] = useState(false);

  async function save(next: JourneySettings) {
    const before = s;
    setS(next);
    setSaving(true);
    const { data, response } = await api.PUT("/members/{memberId}/journey-settings", { params: { path: { memberId } }, body: next });
    setSaving(false);
    if (!response.ok || !data) {
      setS(before);
      toast.error("That did not save. Try again in a moment.");
      return;
    }
    setS(data);
    router.refresh();
  }

  return (
    <div className="flex flex-col">
      {rows.map(({ flag, icon: Icon, title, text }) => (
        <div key={flag} className="flex min-h-14 items-center gap-3 border-t border-border py-2.5 first:border-t-0">
          <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Icon className="size-4.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-label font-medium" id={`jp-${flag}`}>
              {title}
            </p>
            <p className="text-caption font-normal text-muted-foreground">{text}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={s[flag]}
            aria-labelledby={`jp-${flag}`}
            disabled={saving}
            onClick={() => save({ ...s, [flag]: !s[flag] })}
            className="press flex h-11 w-14 shrink-0 items-center justify-center outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:h-9"
          >
            <span className={cn("relative h-7 w-12 rounded-full transition-colors duration-(--duration-base)", s[flag] ? "bg-me" : "bg-line-2")}>
              <span className={cn("absolute top-0.5 left-0.5 size-6 rounded-full bg-white shadow-sm transition-transform duration-(--duration-base) ease-out", s[flag] && "translate-x-5")} />
            </span>
          </button>
        </div>
      ))}
      {showTrying && (
        <label className="flex flex-wrap items-center gap-3 border-t border-border py-2.5 text-label">
          <span className="min-w-0 flex-1 font-medium">Trying since</span>
          <Input
            type="date"
            value={s.tryingSince ?? ""}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => save({ ...s, tryingSince: e.target.value || undefined })}
            className="h-11 w-40 md:h-9"
          />
        </label>
      )}
      <p className="mt-1 flex items-center gap-1.5 text-caption text-muted-foreground">
        <Lock className="size-3" aria-hidden />
        Only you see this. Your partner has their own.
      </p>
    </div>
  );
}
