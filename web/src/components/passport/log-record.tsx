"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { api, isPreviewMock } from "@/lib/api/client";
import type { LabResult, PassportPerson, Visibility, VaccineDose } from "@/lib/api/types";
import type { components } from "@/lib/api/schema.gen";
import { formatLongDate } from "@/lib/format";
import { screeningName, vaccineKey, vaccineName } from "@/lib/vaccines";
import { visibilityLabel } from "@/lib/visuals";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Logged } from "./summary";

type VaccineKey = components["schemas"]["VaccineKey"];
type ScreeningKind = components["schemas"]["ScreeningKind"];
type Kind = "vaccine" | "screening" | "lab";

const kinds: { id: Kind; label: string }[] = [
  { id: "vaccine", label: "Vaccine" },
  { id: "screening", label: "Screening" },
  { id: "lab", label: "Lab result" },
];

const field = "h-11 w-full min-w-0 rounded-lg border border-input bg-card px-3 text-body outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:h-9 md:text-label";
const today = () => new Date().toLocaleDateString("en-CA");

export type LogPrefill = { vaccine?: VaccineKey; nonce: number };

// Logs a vaccine, screening or lab for the selected person: the acting parent
// or a child (never the other parent). The record is shown at once; the real
// backend also takes the matching item off the plan, so the page refreshes.
// Labs and screenings are sensitive, so their visibility starts at "Only you".
export function LogRecord({
  memberId,
  person,
  prefill,
  onLogged,
  onClose,
}: {
  memberId: string;
  person: PassportPerson;
  prefill: LogPrefill;
  onLogged: (add: Partial<Logged>) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [kind, setKind] = useState<Kind>("vaccine");
  const open = person.vaccines.find((v) => v.status !== "done");
  const [vaccine, setVaccine] = useState<VaccineKey>(prefill.vaccine ?? (open && vaccineKey(open.name)) ?? "tdap");
  const [screening, setScreening] = useState<ScreeningKind>(person.kind === "child" ? "vision_screen" : "glucose_screen");
  const [date, setDate] = useState(today);
  const [visibility, setVisibility] = useState<Visibility>("private");
  const [dose, setDose] = useState("");
  const [lab, setLab] = useState({ name: "", value: "", unit: "", refLow: "", refHigh: "" });
  const [done, setDone] = useState<string[]>([]);
  const childId = person.kind === "child" ? person.id : undefined;
  const path = { params: { path: { memberId } } };
  const num = (s: string) => (s.trim() === "" ? undefined : Number(s));

  function finish(response: Response, line: string, add: Partial<Logged>) {
    setDone((d) => [line, ...d]);
    toast.success(`${line} logged.`);
    if (isPreviewMock(response)) onLogged(add);
    else router.refresh();
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      if (kind === "vaccine") {
        const { data, error, response } = await api.POST("/members/{memberId}/immunizations", {
          ...path,
          body: { childId, vaccine, dose: dose.trim() || undefined, givenOn: date },
        });
        if (error || !data) return void toast.error("Could not log the vaccine. Please try again.");
        finish(response, `${data.name}, ${formatLongDate(data.givenOn ?? date)}`, { vaccines: [data as VaccineDose] });
      } else if (kind === "screening") {
        const { data, error, response } = await api.POST("/members/{memberId}/screenings", {
          ...path,
          body: { childId, kind: screening, takenOn: date, visibility },
        });
        if (error || !data) return void toast.error("Could not log the screening. Please try again.");
        finish(response, `${screeningName[data.kind]}, ${formatLongDate(data.takenOn)}`, {});
      } else {
        const value = num(lab.value);
        if (!lab.name.trim() || value === undefined || Number.isNaN(value) || !lab.unit.trim()) return void toast.error("Add the test name, value and unit.");
        const { data, error, response } = await api.POST("/members/{memberId}/lab-results", {
          ...path,
          body: { childId, name: lab.name.trim(), value, unit: lab.unit.trim(), refLow: num(lab.refLow), refHigh: num(lab.refHigh), takenOn: date, visibility },
        });
        if (error || !data) return void toast.error("Could not log the result. Check the range and date.");
        finish(response, `${data.name} ${data.value} ${data.unit}`, { labs: [data as LabResult] });
        setLab({ name: "", value: "", unit: "", refLow: "", refHigh: "" });
      }
    });
  }

  const sensitive = kind !== "vaccine";
  return (
    <section aria-labelledby="log-title" className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-3">
        <h2 id="log-title" className="flex-1 text-title">
          Log for {person.isActingParent ? "yourself" : person.name}
        </h2>
        <button type="button" onClick={onClose} aria-label="Close" className="flex size-11 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 md:size-9">
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <div role="radiogroup" aria-label="What to log" className="mt-3 flex gap-1 rounded-xl bg-muted p-1">
        {kinds.map((k) => (
          <button
            key={k.id}
            type="button"
            role="radio"
            aria-checked={kind === k.id}
            onClick={() => setKind(k.id)}
            className={cn(
              "min-h-11 flex-1 rounded-lg px-2 text-label whitespace-nowrap transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:min-h-9",
              kind === k.id ? "bg-card font-semibold shadow-[0_1px_2px_rgb(0_0_0/0.08)]" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {k.label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
        {kind === "vaccine" && (
          <>
            <Field label="Vaccine">
              <select className={field} value={vaccine} onChange={(e) => setVaccine(e.target.value as VaccineKey)}>
                {(Object.keys(vaccineName) as VaccineKey[]).map((k) => (
                  <option key={k} value={k}>
                    {vaccineName[k]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Dose (optional)">
              <Input className={field} value={dose} onChange={(e) => setDose(e.target.value)} placeholder="Dose 2 of 5" />
            </Field>
          </>
        )}
        {kind === "screening" && (
          <Field label="Screening">
            <select className={field} value={screening} onChange={(e) => setScreening(e.target.value as ScreeningKind)}>
              {(Object.keys(screeningName) as ScreeningKind[]).map((k) => (
                <option key={k} value={k}>
                  {screeningName[k]}
                </option>
              ))}
            </select>
          </Field>
        )}
        {kind === "lab" && (
          <>
            <Field label="Test">
              <Input className={field} value={lab.name} onChange={(e) => setLab({ ...lab, name: e.target.value })} placeholder="Ferritin" />
            </Field>
            <Field label="Value">
              <div className="flex gap-2">
                <Input className={field} inputMode="decimal" value={lab.value} onChange={(e) => setLab({ ...lab, value: e.target.value })} placeholder="18" />
                <Input className={cn(field, "w-28")} value={lab.unit} onChange={(e) => setLab({ ...lab, unit: e.target.value })} placeholder="ng/mL" aria-label="Unit" />
              </div>
            </Field>
            <Field label="Range, low to high (optional)">
              <div className="flex gap-2">
                <Input className={field} inputMode="decimal" value={lab.refLow} onChange={(e) => setLab({ ...lab, refLow: e.target.value })} placeholder="30" aria-label="Low end" />
                <Input className={field} inputMode="decimal" value={lab.refHigh} onChange={(e) => setLab({ ...lab, refHigh: e.target.value })} placeholder="200" aria-label="High end" />
              </div>
            </Field>
          </>
        )}
        <Field label={kind === "vaccine" ? "Given on" : "Done on"}>
          <Input type="date" className={field} value={date} max={today()} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        {sensitive && (
          <Field label="Who can see it">
            <select className={field} value={visibility} onChange={(e) => setVisibility(e.target.value as Visibility)}>
              {(Object.keys(visibilityLabel) as Visibility[]).map((v) => (
                <option key={v} value={v}>
                  {visibilityLabel[v]}
                </option>
              ))}
            </select>
          </Field>
        )}
        <div className="flex items-end sm:col-span-2">
          <Button type="submit" disabled={pending} className="h-11 w-full px-5 text-label md:h-9 md:w-auto">
            <Plus aria-hidden />
            {pending ? "Saving..." : "Log it"}
          </Button>
        </div>
      </form>

      {done.length > 0 && (
        <ul className="mt-4 flex flex-col gap-1.5 border-t border-border pt-3" aria-label="Logged just now">
          {done.map((line, i) => (
            <li key={i} className="flex items-center gap-2 text-label">
              <Check className="size-4 shrink-0 text-status-ok" aria-hidden />
              <span className="font-mono">{line}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-caption font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
