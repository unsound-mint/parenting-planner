"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Droplet, Thermometer, TestTube } from "lucide-react";
import { api } from "@/lib/api/client";
import type { FertilityEntry, FertilityVisibility } from "@/lib/api/types";
import { flowLabel, flows, fToC, symptomLabel, symptoms, testLabel, tests } from "@/lib/fertility";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AudienceChoice } from "./audience-choice";

type Props = { memberId: string; today: string; partnerName?: string; entries: FertilityEntry[]; mine: string };

/**
 * The quick log: a day's bleeding, symptoms, ovulation test and temperature in one tap
 * each and one save. Private unless the parent picks "Me and partner" for that save.
 * A day has one flow, one test and one temperature, so saving again replaces them.
 */
export function DailyLog({ memberId, today, partnerName, entries, mine }: Props) {
  const router = useRouter();
  const [date, setDate] = useState(today);
  const own = entries.filter((e) => e.authorId === mine && e.date === date);
  const saved = {
    flow: own.find((e) => e.kind === "period")?.code ?? null,
    test: own.find((e) => e.kind === "ovulation_test")?.code ?? null,
    symptoms: own.filter((e) => e.kind === "symptom").map((e) => e.code as string),
    temp: own.find((e) => e.kind === "bbt")?.tempC,
  };
  // Choices start from what is already saved for the day; `touched` keeps edits when the list refreshes.
  const [edit, setEdit] = useState<{ date: string; flow?: string | null; test?: string | null; symptoms?: string[]; temp?: string }>({ date });
  const mineEdit = edit.date === date ? edit : { date };
  const flow = mineEdit.flow !== undefined ? mineEdit.flow : saved.flow;
  const test = mineEdit.test !== undefined ? mineEdit.test : saved.test;
  const picked = mineEdit.symptoms ?? saved.symptoms;
  const temp = mineEdit.temp ?? (saved.temp != null ? (saved.temp * 1.8 + 32).toFixed(1) : "");
  const [visibility, setVisibility] = useState<FertilityVisibility>("private");
  const [pending, startTransition] = useTransition();

  const set = (patch: Partial<typeof edit>) => setEdit({ ...mineEdit, date, ...patch });
  const tempF = parseFloat(temp);
  const tempOk = temp === "" || (tempF >= 93.2 && tempF <= 104);

  function save() {
    startTransition(async () => {
      const base = { date, visibility };
      const posts: Promise<{ response: Response }>[] = [];
      const path = { params: { path: { memberId } } };
      if (flow) posts.push(api.POST("/members/{memberId}/fertility-entries", { ...path, body: { ...base, kind: "period", code: flow } }));
      if (test) posts.push(api.POST("/members/{memberId}/fertility-entries", { ...path, body: { ...base, kind: "ovulation_test", code: test } }));
      for (const s of picked) posts.push(api.POST("/members/{memberId}/fertility-entries", { ...path, body: { ...base, kind: "symptom", code: s } }));
      if (temp !== "" && tempOk) posts.push(api.POST("/members/{memberId}/fertility-entries", { ...path, body: { ...base, kind: "bbt", tempC: fToC(tempF) } }));
      const results = await Promise.all(posts);
      if (results.some((r) => !r.response.ok)) {
        toast.error("Some of that did not save. Try again in a moment.");
        return;
      }
      toast.success(visibility === "partner" ? `Saved, and shared with ${partnerName}` : "Saved, only you can see it");
      setEdit({ date });
      router.refresh();
    });
  }

  const nothing = !flow && !test && picked.length === 0 && (temp === "" || !tempOk);

  return (
    <section aria-labelledby="log-title" className="flex min-w-0 flex-col gap-5 rounded-[1.75rem] bg-sun p-5.5 md:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="log-title" className="text-title">
          How is {date === today ? "today" : "that day"}?
        </h2>
        <label className="flex items-center gap-2 text-label text-muted-foreground">
          <span className="sr-only">Day</span>
          <Input type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} className="h-11 w-40 bg-card md:h-9" />
        </label>
      </div>

      <Group icon={Droplet} title="Bleeding">
        {flows.map((f) => (
          <Chip key={f} on={flow === f} onClick={() => set({ flow: flow === f ? null : f })}>
            {flowLabel[f]}
          </Chip>
        ))}
      </Group>
      <Group icon={TestTube} title="Ovulation test">
        {tests.map((t) => (
          <Chip key={t} on={test === t} onClick={() => set({ test: test === t ? null : t })}>
            {testLabel[t]}
          </Chip>
        ))}
      </Group>
      <Group title="Symptoms">
        {symptoms.map((s) => (
          <Chip key={s} on={picked.includes(s)} onClick={() => set({ symptoms: picked.includes(s) ? picked.filter((x) => x !== s) : [...picked, s] })}>
            {symptomLabel[s]}
          </Chip>
        ))}
      </Group>
      <Group icon={Thermometer} title="Morning temperature">
        <label className="flex items-center gap-2">
          <span className="sr-only">Basal body temperature in degrees Fahrenheit</span>
          <Input inputMode="decimal" placeholder="97.8" value={temp} onChange={(e) => set({ temp: e.target.value })} aria-invalid={!tempOk} className="h-11 w-28 bg-card font-mono md:h-9" />
          <span className="font-mono text-label text-muted-foreground">°F</span>
          {tempOk && temp !== "" && <span className="font-mono text-caption text-muted-foreground">{fToC(tempF).toFixed(1)} °C</span>}
          {!tempOk && <span className="text-caption text-destructive">Between 93.2 and 104 °F</span>}
        </label>
      </Group>

      <div className="flex flex-col gap-3 border-t border-black/5 pt-4">
        <AudienceChoice value={visibility} onChange={setVisibility} partnerName={partnerName} label="Who can see this day" />
        <Button onClick={save} disabled={pending || nothing} className="press h-11 self-start rounded-full px-6 text-label md:h-10">
          <Check data-icon="inline-start" />
          {pending ? "Saving" : "Save this day"}
        </Button>
      </div>
    </section>
  );
}

function Group({ title, icon: Icon, children }: { title: string; icon?: typeof Check; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="flex items-center gap-1.5 font-mono text-caption tracking-[0.07em] text-muted-foreground uppercase">
        {Icon && <Icon className="size-3.5" aria-hidden />}
        {title}
      </h3>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "press inline-flex min-h-11 items-center rounded-full border px-4 text-label outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:min-h-9",
        "transition-colors duration-(--duration-fast)",
        on ? "border-me bg-me text-white" : "border-transparent bg-card text-ink hover:bg-white",
      )}
    >
      {children}
    </button>
  );
}
