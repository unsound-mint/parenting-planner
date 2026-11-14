"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Check, HeartHandshake, Lock } from "lucide-react";
import { api } from "@/lib/api/client";
import type { RecoveryBleeding, RecoveryBreasts, RecoveryPelvicFloor, RecoveryWarningSign, RecoveryWound } from "@/lib/api/types";
import { bleedingOptions, breastOptions, pelvicOptions, sleepOptions, warningSigns, woundOptions } from "@/lib/recovery";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SoftCard } from "@/components/joy/soft-card";
import { MoodPicker } from "@/components/joy/mood-picker";
import type { Mood } from "@/components/joy/mood-face";
import { helpHref } from "@/components/shell/urgent-help-link";
import { ChipGroup } from "./chip-group";

function Row({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div>
        <h3 className="text-label font-semibold">{title}</h3>
        {hint && <p className="text-caption text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

/**
 * The fixed urgent card: plain words and one link to the fixed Urgent help
 * screen. Never generated text, never animated.
 */
export function UrgentCallout({ memberId }: { memberId: string }) {
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-2xl border-2 border-urgent p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <AlertTriangle aria-hidden className="mt-0.5 size-5 shrink-0 text-urgent" />
        <p className="text-body font-semibold text-urgent">This can be a warning sign. Get help now, do not wait for your next visit.</p>
      </div>
      <a
        href={helpHref(memberId)}
        className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-urgent px-5 text-label font-semibold text-white outline-none focus-visible:ring-3 focus-visible:ring-urgent/40 focus-visible:ring-offset-2"
      >
        Open Urgent help
      </a>
    </div>
  );
}

// How are you healing: seven quick taps, one save. Everything has a default so a
// tired parent can save with a single tap; she changes only what is different.
export function RecoveryComposer({ memberId, partnerName }: { memberId: string; partnerName?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [bleeding, setBleeding] = useState<RecoveryBleeding>("light");
  const [pain, setPain] = useState(2);
  const [wound, setWound] = useState<RecoveryWound>("healing_well");
  const [breasts, setBreasts] = useState<RecoveryBreasts>("comfortable");
  const [pelvic, setPelvic] = useState<RecoveryPelvicFloor>("fine");
  const [sleep, setSleep] = useState<number>(4.5);
  const [mood, setMood] = useState<Mood | null>(null);
  const [signs, setSigns] = useState<RecoveryWarningSign[]>([]);
  const [share, setShare] = useState(false);
  const [saved, setSaved] = useState(false);
  const urgent = bleeding === "heavy" || signs.length > 0;

  function toggleSign(s: RecoveryWarningSign) {
    setSigns((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
  }

  function save() {
    startTransition(async () => {
      const { error } = await api.POST("/members/{memberId}/recovery-checkins", {
        params: { path: { memberId } },
        body: {
          visibility: share ? "partner" : "private",
          bleeding,
          pain,
          wound,
          breasts,
          pelvicFloor: pelvic,
          sleepHours: sleep,
          warningSigns: signs,
          ...(mood ? { mood } : {}),
        },
      });
      if (error) {
        toast.error(error.message ?? "Could not save. Please try again.");
        return;
      }
      setSaved(true);
      toast.success(share && partnerName ? `Saved, shared with ${partnerName}` : "Saved, only you can see it");
      router.refresh();
    });
  }

  return (
    <SoftCard tone="me" as="section" aria-labelledby="recovery-form" className="flex flex-col gap-5">
      <h2 id="recovery-form" className="text-title">
        How are you healing today?
      </h2>
      <Row title="Bleeding">
        <ChipGroup label="Bleeding" options={bleedingOptions} value={bleeding} onChange={setBleeding} />
      </Row>
      <Row title={`Pain: ${pain} of 10`} hint="0 is none, 10 is the worst you can imagine">
        <input
          type="range"
          min={0}
          max={10}
          step={1}
          value={pain}
          onChange={(e) => setPain(Number(e.target.value))}
          aria-label="Pain from 0 to 10"
          className="h-11 w-full accent-(--me)"
        />
      </Row>
      <Row title="Stitches or scar" hint="A tear, an episiotomy or a cesarean incision">
        <ChipGroup label="Stitches or scar" options={woundOptions} value={wound} onChange={setWound} />
      </Row>
      <Row title="Breasts">
        <ChipGroup label="Breasts" options={breastOptions} value={breasts} onChange={setBreasts} />
      </Row>
      <Row title="Pelvic floor">
        <ChipGroup label="Pelvic floor" options={pelvicOptions} value={pelvic} onChange={setPelvic} />
      </Row>
      <Row title="Sleep last night">
        <ChipGroup label="Sleep last night" options={sleepOptions} value={sleep} onChange={setSleep} />
      </Row>
      <Row title="Mood" hint="Optional. It also shows on your mood timeline in the journal.">
        <MoodPicker value={mood} onChange={setMood} label="How are you feeling" />
      </Row>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-label font-semibold">Any of these?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {warningSigns.map((w) => {
            const on = signs.includes(w.value);
            return (
              <label
                key={w.value}
                className={cn(
                  "press flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-label has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                  on ? "border-urgent bg-card font-semibold" : "border-line bg-card",
                )}
              >
                <input type="checkbox" checked={on} onChange={() => toggleSign(w.value)} className="size-4 accent-(--urgent)" />
                {w.label}
              </label>
            );
          })}
        </div>
      </fieldset>
      {urgent && <UrgentCallout memberId={memberId} />}

      <div role="radiogroup" aria-label="Who can see this check-in" className="flex flex-wrap gap-2">
        {[
          { v: false, icon: Lock, label: "Only me" },
          ...(partnerName ? [{ v: true, icon: HeartHandshake, label: `Share with ${partnerName}` }] : []),
        ].map((o) => (
          <button
            key={String(o.v)}
            type="button"
            role="radio"
            aria-checked={share === o.v}
            onClick={() => setShare(o.v)}
            className={cn(
              "press inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-label outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              share === o.v ? "border-me bg-card font-semibold text-me" : "border-line bg-card/60 text-ink-2",
            )}
          >
            <o.icon aria-hidden className="size-4" />
            {o.label}
          </button>
        ))}
      </div>

      <Button type="button" size="lg" onClick={save} disabled={pending} className="min-h-12 self-start px-6">
        {saved && !pending ? <Check aria-hidden className="size-4" /> : null}
        {saved && !pending ? "Saved. Add another" : "Save check-in"}
      </Button>
    </SoftCard>
  );
}
