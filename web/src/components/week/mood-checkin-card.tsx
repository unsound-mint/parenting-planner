"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Annoyed,
  Battery,
  BatteryFull,
  BatteryLow,
  BatteryMedium,
  CheckCircle2,
  Frown,
  Laugh,
  Meh,
  Minus,
  Moon,
  Plus,
  Smile,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { api } from "@/lib/api/client";
import type { Visibility } from "@/lib/api/types";
import { visibilityIcon } from "@/lib/visuals";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type Level = { value: string; icon: LucideIcon; label: string };

const moods: Level[] = [
  { value: "1", icon: Frown, label: "Very low" },
  { value: "2", icon: Annoyed, label: "Low" },
  { value: "3", icon: Meh, label: "Okay" },
  { value: "4", icon: Smile, label: "Good" },
  { value: "5", icon: Laugh, label: "Very good" },
];

const energies: Level[] = [
  { value: "1", icon: Battery, label: "Drained" },
  { value: "2", icon: BatteryLow, label: "Low" },
  { value: "3", icon: BatteryMedium, label: "Some" },
  { value: "4", icon: BatteryFull, label: "Good" },
  { value: "5", icon: Zap, label: "Full" },
];

const itemClass =
  "h-12 flex-1 text-muted-foreground data-[pressed]:border-primary data-[pressed]:bg-secondary data-[pressed]:text-secondary-foreground";

const DEFAULT_SLEEP = 7;

// A one-minute check-in. Private by default: the parent chooses per entry who
// else may see it (docs/product.md, diaries and check-ins are private).
export function MoodCheckinCard({ memberId, partnerName }: { memberId: string; partnerName?: string }) {
  const router = useRouter();
  const [mood, setMood] = useState<string[]>([]);
  const [energy, setEnergy] = useState<string[]>([]);
  const [sleep, setSleep] = useState(DEFAULT_SLEEP);
  const [note, setNote] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("private");
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const audiences: { value: Visibility; label: string; done: string }[] = [
    { value: "private", label: "Only me", done: "Only you can see it." },
    ...(partnerName
      ? [{ value: "partner" as const, label: `Me and ${partnerName}`, done: `You and ${partnerName} can see it.` }]
      : []),
    { value: "care_team", label: "Care team", done: "You and your care team can see it." },
  ];

  const ready = mood.length === 1 && energy.length === 1;
  const started = mood.length === 1;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    startTransition(async () => {
      const { error } = await api.POST("/members/{memberId}/mood-checkins", {
        params: { path: { memberId } },
        body: {
          mood: Number(mood[0]),
          energy: Number(energy[0]),
          sleepHours: sleep,
          note: note.trim() || undefined,
          visibility,
        },
      });
      if (error) {
        toast.error("Could not save your check-in. Please try again.");
        return;
      }
      toast.success(`Check-in saved. ${audiences.find((a) => a.value === visibility)?.done ?? ""}`);
      setMood([]);
      setEnergy([]);
      setSleep(DEFAULT_SLEEP);
      setNote("");
      setSaved(true);
      setTimeout(() => setSaved(false), 1600);
      router.refresh();
    });
  }

  return (
    <section aria-labelledby="checkin-title" className="rounded-2xl border border-border bg-card p-5">
      <h2 id="checkin-title" className="text-title">
        How are you today?
      </h2>
      <form onSubmit={submit} className="mt-4">
        <Scale label="Mood" levels={moods} value={mood} onChange={setMood} />

        {/* Faces first; the rest opens once one is picked. Closed content is inert. */}
        <div
          className={cn(
            "grid transition-[grid-template-rows,opacity] duration-220 ease-(--ease-out)",
            started ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
          )}
          inert={!started}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="flex flex-col gap-5 pt-5">
              <Scale label="Energy" levels={energies} value={energy} onChange={setEnergy} />

              <div className="flex items-center gap-3">
                <Moon className="size-4.5 text-muted-foreground" aria-hidden />
                <span id="sleep-label" className="flex-1 text-label">
                  Sleep last night
                </span>
                <div role="group" aria-labelledby="sleep-label" className="flex items-center gap-1">
                  <Button type="button" variant="outline" size="icon" aria-label="Less sleep" className="size-11 md:size-8" onClick={() => setSleep((h) => Math.max(0, h - 0.5))}>
                    <Minus />
                  </Button>
                  <output aria-live="polite" className="w-14 text-center font-mono text-title tabular-nums">
                    {sleep} h
                  </output>
                  <Button type="button" variant="outline" size="icon" aria-label="More sleep" className="size-11 md:size-8" onClick={() => setSleep((h) => Math.min(24, h + 0.5))}>
                    <Plus />
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="note" className="text-label">
                  Note <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Textarea id="note" maxLength={500} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-label">Who can see this</span>
                <ToggleGroup
                  aria-label="Who can see this"
                  variant="outline"
                  spacing={1}
                  value={[visibility]}
                  onValueChange={(v: string[]) => v[0] && setVisibility(v[0] as Visibility)}
                  className="w-full"
                >
                  {audiences.map((a) => {
                    const Icon = visibilityIcon[a.value];
                    return (
                      <ToggleGroupItem key={a.value} value={a.value} className={`${itemClass} h-auto min-h-12 flex-col gap-1 py-2 text-caption`}>
                        <Icon className="size-4" aria-hidden />
                        {a.label}
                      </ToggleGroupItem>
                    );
                  })}
                </ToggleGroup>
              </div>

              <div className="flex flex-col gap-2">
                <Button type="submit" size="lg" disabled={!ready || pending} className="h-11 w-full text-label">
                  {pending ? "Saving..." : "Save check-in"}
                </Button>
                {!ready && <p className="text-center text-caption text-muted-foreground">Pick an energy level to save.</p>}
              </div>
            </div>
          </div>
        </div>
        {saved && (
          <p role="status" className="mt-3 flex items-center gap-1.5 text-label text-status-ok">
            <CheckCircle2 className="size-4" aria-hidden />
            Saved
          </p>
        )}
      </form>
    </section>
  );
}

function Scale({ label, levels, value, onChange }: { label: string; levels: Level[]; value: string[]; onChange: (v: string[]) => void }) {
  const picked = levels.find((l) => l.value === value[0]);
  return (
    <div className="flex flex-col gap-2">
      <span className="flex items-baseline justify-between">
        <span className="text-label">{label}</span>
        <span className="text-caption text-muted-foreground">{picked?.label ?? ""}</span>
      </span>
      <ToggleGroup aria-label={label} variant="outline" spacing={1} value={value} onValueChange={(v: string[]) => onChange(v)} className="w-full">
        {levels.map((l) => (
          <ToggleGroupItem key={l.value} value={l.value} aria-label={`${label}: ${l.label}`} className={itemClass}>
            <l.icon className="size-5" aria-hidden />
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
