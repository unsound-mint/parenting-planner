"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import type { Visibility } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const scale = ["1", "2", "3", "4", "5"];
const itemClass = "flex-1 data-[pressed]:bg-secondary data-[pressed]:text-secondary-foreground";

// A one-minute check-in. Private by default: the parent chooses per entry who
// else may see it (docs/product.md, diaries and check-ins are private).
export function MoodCheckinCard({ memberId, partnerName }: { memberId: string; partnerName?: string }) {
  const router = useRouter();
  const [mood, setMood] = useState<string[]>([]);
  const [energy, setEnergy] = useState<string[]>([]);
  const [sleep, setSleep] = useState("");
  const [note, setNote] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("private");
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const audience: Record<Visibility, string> = {
    private: "Only you can see it.",
    partner: `You and ${partnerName ?? "your partner"} can see it.`,
    care_team: "You and your care team can see it.",
    family: "Both parents can see it.",
  };

  const sleepHours = Number(sleep);
  const ready = mood.length === 1 && energy.length === 1 && sleep !== "" && sleepHours >= 0 && sleepHours <= 24;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    startTransition(async () => {
      const { error } = await api.POST("/members/{memberId}/mood-checkins", {
        params: { path: { memberId } },
        body: {
          mood: Number(mood[0]),
          energy: Number(energy[0]),
          sleepHours,
          note: note.trim() || undefined,
          visibility,
        },
      });
      if (error) {
        toast.error("Could not save your check-in. Please try again.");
        return;
      }
      toast.success(`Check-in saved. ${audience[visibility]}`);
      setMood([]);
      setEnergy([]);
      setSleep("");
      setNote("");
      setSaved(true);
      setTimeout(() => setSaved(false), 1600);
      router.refresh();
    });
  }

  return (
    <section aria-labelledby="checkin-title" className="rounded-2xl border border-border bg-card px-5 py-4">
      <h2 id="checkin-title" className="text-sm font-semibold">How are you today?</h2>
      <p className="mt-0.5 text-[13px] text-muted-foreground">A minute for yourself. It helps spot patterns early.</p>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-4">
        <Scale label="Mood" hint="1 very low, 5 very good" value={mood} onChange={setMood} />
        <Scale label="Energy" hint="1 drained, 5 full" value={energy} onChange={setEnergy} />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sleep">Hours slept</Label>
          <Input
            id="sleep"
            type="number"
            inputMode="decimal"
            min={0}
            max={24}
            step={0.5}
            value={sleep}
            onChange={(e) => setSleep(e.target.value)}
            className="w-28"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="note">Note (optional)</Label>
          <Textarea id="note" maxLength={500} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Who can see this</span>
          <ToggleGroup
            aria-label="Who can see this"
            variant="outline"
            size="sm"
            spacing={1}
            value={[visibility]}
            onValueChange={(v: string[]) => v[0] && setVisibility(v[0] as Visibility)}
            className="w-full flex-wrap"
          >
            <ToggleGroupItem value="private" className={itemClass}>Only me</ToggleGroupItem>
            {partnerName && (
              <ToggleGroupItem value="partner" className={itemClass}>Me and {partnerName}</ToggleGroupItem>
            )}
            <ToggleGroupItem value="care_team" className={itemClass}>My care team</ToggleGroupItem>
          </ToggleGroup>
        </div>
        <Button type="submit" disabled={!ready || pending} className="self-start">
          {pending ? "Saving..." : saved ? "Saved" : "Save check-in"}
        </Button>
      </form>
    </section>
  );
}

function Scale({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-baseline justify-between text-sm font-medium">
        {label}
        <span className="text-xs font-normal text-muted-foreground">{hint}</span>
      </span>
      <ToggleGroup
        aria-label={label}
        variant="outline"
        size="sm"
        spacing={1}
        value={value}
        onValueChange={(v: string[]) => onChange(v)}
        className="w-full"
      >
        {scale.map((n) => (
          <ToggleGroupItem key={n} value={n} aria-label={`${label} ${n} of 5`} className={itemClass}>
            {n}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
