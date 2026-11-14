"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { api } from "@/lib/api/client";
import type { DemoTemplate } from "@/lib/api/types";
import { roleAccent } from "@/lib/visuals";
import { stageValueIcon } from "@/lib/visuals";
import type { DemoFamilyCard } from "@/lib/demo-families";
import { cn } from "@/lib/utils";
import { StageRail } from "./stage-rail";

// One whole card is the button: a judge picks a family with one click and lands
// on that family's This week. Each pick makes a fresh copy (POST /demo/sessions).
export function FamilyCard({ family }: { family: DemoFamilyCard }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const Icon = stageValueIcon[family.stage];

  async function start(template: Exclude<DemoTemplate, "custom">) {
    setPending(true);
    setError(null);
    const { error } = await api.POST("/demo/sessions", { body: { template } });
    if (error) {
      setError(error.message);
      setPending(false);
      return;
    }
    router.push("/family");
  }

  return (
    <li className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => start(family.template)}
        disabled={pending}
        className={cn(
          "group flex w-full flex-1 flex-col gap-4 rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-[border-color,box-shadow,transform] duration-150",
          "outline-none hover:border-primary/50 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.99] disabled:opacity-70",
        )}
      >
        <StageRail stage={family.stage} label={family.stageLabel} />
        <div className="flex flex-col gap-1">
          <p className="inline-flex items-center gap-1.5 text-label font-medium text-primary">
            <Icon aria-hidden className="size-4" />
            {family.stageLabel}
          </p>
          <p className="text-title">{family.title}</p>
          <p className="flex flex-wrap items-center gap-x-2 text-label font-normal text-muted-foreground">
            {family.parents.map((p) => (
              <span key={p.name} className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className={cn("flex size-5 items-center justify-center rounded-full text-caption font-semibold text-card", roleAccent[p.role].bg)}
                >
                  {p.name.charAt(0)}
                </span>
                {p.name}
              </span>
            ))}
          </p>
        </div>
        <p className="flex-1 text-label font-normal text-muted-foreground">{family.firstUp}</p>
        <span className="inline-flex items-center gap-1.5 text-label font-medium">
          {pending ? (
            <>
              <Loader2 aria-hidden className="size-4 animate-spin" /> Setting up this family...
            </>
          ) : (
            <>
              Open this family
              <ArrowRight aria-hidden className="size-4 transition-transform duration-150 group-hover:translate-x-0.5" />
            </>
          )}
        </span>
      </button>
      {error && <p role="alert" className="text-label text-destructive">{error}</p>}
    </li>
  );
}
