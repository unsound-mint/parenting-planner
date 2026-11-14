"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useSyncExternalStore } from "react";
import { ArrowRight, Loader2, PenLine } from "lucide-react";
import { api } from "@/lib/api/client";
import type { CustomFamilyInput, Stage } from "@/lib/api/types";
import { customStages, dateWindow } from "@/lib/demo-families";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const subscribeNever = () => () => {};
const localDay = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const field = "flex flex-col gap-1.5";
const select =
  "h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30";

// "Try it with your own details": the stage, one date if the stage has one and
// two names. The API builds a family from it that runs through the same rules
// and plan as the demo families (POST /demo/custom-sessions).
export function OwnDetails() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("pregnancy");
  const [date, setDate] = useState("");
  const [mother, setMother] = useState("");
  const [partner, setPartner] = useState("");
  const [child, setChild] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cfg = customStages.find((s) => s.stage === stage) ?? customStages[0];
  // The date limits depend on today, so they are set after mount (Cache Components forbids reading the time during prerender).
  const today = useSyncExternalStore(subscribeNever, localDay, () => "");
  const window = useMemo(() => (today ? dateWindow(cfg, new Date(`${today}T12:00:00`)) : undefined), [cfg, today]);

  function pick(next: Stage) {
    setStage(next);
    setDate("");
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (cfg.date !== "none" && !date) {
      setError(cfg.date === "due" ? "Add the due date." : "Add the child's birth date.");
      return;
    }
    if (window && date && (date < window.min || date > window.max)) {
      setError(
        cfg.date === "due"
          ? "The due date has to be within the next 40 weeks (or up to 2 weeks ago)."
          : `The birth date does not fit "${cfg.label.toLowerCase()}". Pick another stage or date.`,
      );
      return;
    }
    const body: CustomFamilyInput = { stage, motherName: mother.trim(), partnerName: partner.trim() };
    if (cfg.date === "due") body.dueDate = date;
    if (cfg.date === "birth") {
      body.childBirthDate = date;
      if (child.trim()) body.childName = child.trim();
    }
    setPending(true);
    setError(null);
    const { error } = await api.POST("/demo/custom-sessions", { body });
    if (error) {
      setError(error.message);
      setPending(false);
      return;
    }
    router.push("/family");
  }

  return (
    <li className="flex flex-col md:col-span-2 xl:col-span-4">
      <form
        onSubmit={submit}
        aria-labelledby="own-details"
        className="flex flex-col gap-4 rounded-2xl border border-dashed border-primary/40 bg-card p-4"
      >
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
            <PenLine aria-hidden className="size-5" />
          </span>
          <div>
            <h2 id="own-details" className="text-title">
              Or try it with your own details
            </h2>
            <p className="text-label font-normal text-muted-foreground">
              Your dates and names build a new family. The plan is worked out from them, nothing is pre-written.
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_auto] xl:items-end">
          <div className={field}>
            <Label htmlFor="own-stage">Where are you?</Label>
            <select id="own-stage" value={stage} onChange={(e) => pick(e.target.value as Stage)} className={select}>
              {customStages.map((s) => (
                <option key={s.stage} value={s.stage}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className={cn(field, cfg.date === "none" && "opacity-50")}>
            <Label htmlFor="own-date">{cfg.date === "due" ? "Due date" : cfg.date === "birth" ? "Child's birth date" : "Date"}</Label>
            <Input
              id="own-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={window?.min}
              max={window?.max}
              disabled={cfg.date === "none"}
              required={cfg.date !== "none"}
              className="h-11 md:text-sm"
            />
          </div>
          <div className={field}>
            <Label htmlFor="own-mother">Mother&apos;s name</Label>
            <Input id="own-mother" value={mother} onChange={(e) => setMother(e.target.value)} maxLength={40} required autoComplete="off" className="h-11 md:text-sm" />
          </div>
          <div className={field}>
            <Label htmlFor="own-partner">Partner&apos;s name</Label>
            <Input id="own-partner" value={partner} onChange={(e) => setPartner(e.target.value)} maxLength={40} required autoComplete="off" className="h-11 md:text-sm" />
          </div>
          <div className={cn(field, cfg.date !== "birth" && "opacity-50")}>
            <Label htmlFor="own-child">Child&apos;s name (optional)</Label>
            <Input id="own-child" value={child} onChange={(e) => setChild(e.target.value)} maxLength={40} disabled={cfg.date !== "birth"} autoComplete="off" className="h-11 md:text-sm" />
          </div>
          <Button type="submit" size="lg" disabled={pending} className="h-11 rounded-full px-6 text-base sm:col-span-2 xl:col-span-1">
            {pending ? (
              <>
                <Loader2 aria-hidden className="size-4 animate-spin" /> Setting up...
              </>
            ) : (
              <>
                Start <ArrowRight aria-hidden className="size-4" />
              </>
            )}
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-label text-destructive">
            {error}
          </p>
        )}
        <p className="text-caption text-muted-foreground">Use made-up names and dates if you like. This is a demo, so do not enter real health details.</p>
      </form>
    </li>
  );
}
