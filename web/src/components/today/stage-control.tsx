"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Popover } from "@base-ui/react/popover";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import type { Family, FamilyUpdate, Stage } from "@/lib/api/types";
import { stageLabel } from "@/lib/format";
import { stageValueIcon } from "@/lib/visuals";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Before a child exists the family can plan, try or be pregnant. After "Baby is
// home" the API refuses earlier stages (409 no_child the other way round), so
// each side only offers its own.
const BEFORE_BIRTH: Stage[] = ["planning", "trying", "pregnancy"];
const AFTER_BIRTH: Stage[] = ["postpartum", "infant", "toddler", "preschool", "school_age"];

// A compact stage chip in the home header. Changing the stage changes the
// content on every screen (listGuides filters by the stored stage), so the page
// refreshes after a save.
export function StageControl({ memberId, stage, dueDate, hasChild }: { memberId: string; stage: Family["stage"]; dueDate?: string; hasChild: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Stage>(stage);
  const [due, setDue] = useState(dueDate ?? "");
  const [pending, startTransition] = useTransition();
  const stages = hasChild ? AFTER_BIRTH : BEFORE_BIRTH;
  const needsDue = picked === "pregnancy";
  const changed = picked !== stage || (needsDue && due !== (dueDate ?? ""));
  const canSave = changed && (!needsDue || due !== "") && !pending;
  const Icon = stageValueIcon[stage];

  function save() {
    const body: FamilyUpdate = {};
    if (picked !== stage) body.stage = picked;
    if (needsDue && due && due !== dueDate) body.dueDate = due;
    startTransition(async () => {
      const { error } = await api.PATCH("/members/{memberId}/family", { params: { path: { memberId } }, body });
      if (error) {
        toast.error(error.message || "Could not change the stage. Please try again.");
        return;
      }
      toast.success(`Your plan now follows ${stageLabel[picked].toLowerCase()}.`);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setPicked(stage);
          setDue(dueDate ?? "");
        }
      }}
    >
      <Popover.Trigger className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card py-1 pr-3 pl-2 text-label font-medium transition-colors duration-150 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 md:min-h-8">
        <Icon className="size-4 text-primary" aria-hidden />
        <span className="sr-only">Stage: </span>
        {stageLabel[stage]}
        <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start" sideOffset={8} className="z-50">
          <Popover.Popup className="w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-border bg-popover p-3 text-popover-foreground shadow-lg outline-none">
            <Popover.Title className="px-1 text-label font-semibold">Where are you now?</Popover.Title>
            <div role="radiogroup" aria-label="Stage" className="mt-2 flex flex-col gap-1">
              {stages.map((s) => {
                const SIcon = stageValueIcon[s];
                const on = picked === s;
                return (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setPicked(s)}
                    className={cn(
                      "flex min-h-11 items-center gap-3 rounded-xl px-2 text-left text-body transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      on ? "bg-secondary font-semibold text-secondary-foreground" : "hover:bg-muted",
                    )}
                  >
                    <SIcon className="size-4.5 shrink-0" aria-hidden />
                    {stageLabel[s]}
                  </button>
                );
              })}
            </div>
            {needsDue && (
              <div className="mt-3 flex flex-col gap-1.5 px-1">
                <Label htmlFor="due-date" className="text-label">
                  Due date
                </Label>
                <Input id="due-date" type="date" value={due} onChange={(e) => setDue(e.target.value)} className="h-11 font-mono md:h-9" />
              </div>
            )}
            <Button type="button" onClick={save} disabled={!canSave} className="mt-3 h-11 w-full text-label md:h-9">
              {pending ? "Saving..." : "Save"}
            </Button>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
