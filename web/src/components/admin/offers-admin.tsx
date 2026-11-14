"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { MousePointerClick, Pencil, Plus } from "lucide-react";
import { api } from "@/lib/api/client";
import type { ParentRole, PartnerOffer, PartnerOfferInput, Stage } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { offerStages } from "./labels";

const blank: PartnerOfferInput = { partnerName: "", title: "", detail: "", url: "https://", stages: ["pregnancy"], audience: ["mother", "partner"], active: true };
const roles: { id: ParentRole; label: string }[] = [
  { id: "mother", label: "Mother" },
  { id: "partner", label: "Partner" },
];

// Parents see at most three active offers that match their stage and role.
export function OffersAdmin({ initial }: { initial: PartnerOffer[] }) {
  const [offers, setOffers] = useState(initial);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [pending, start] = useTransition();

  function toggle(o: PartnerOffer) {
    start(async () => {
      const { data, error } = await api.PATCH("/admin/partner-offers/{offerId}", { params: { path: { offerId: o.id } }, body: { active: !o.active } });
      if (error || !data) return void toast.error("Could not update the offer.");
      setOffers((all) => all.map((x) => (x.id === o.id ? { ...x, ...data, clicks: x.clicks } : x)));
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-label text-muted-foreground">Parents see at most three matching offers, labelled &ldquo;Partner offer&rdquo;.</p>
        <Button size="lg" className="h-11 shrink-0 px-4" onClick={() => setEditing("new")} disabled={editing === "new"}>
          <Plus aria-hidden />
          New offer
        </Button>
      </div>

      <ul className="mt-4 flex flex-col gap-2">
        {editing === "new" && (
          <li className="rounded-2xl border border-primary/60 bg-card p-4">
            <OfferForm
              start={blank}
              submitLabel="Create offer"
              onCancel={() => setEditing(null)}
              onSubmit={async (input) => {
                const { data, error } = await api.POST("/admin/partner-offers", { body: input });
                if (error || !data) return void toast.error("Could not create the offer.");
                setOffers((all) => [{ ...data, clicks: 0 }, ...all]);
                setEditing(null);
                toast.success("Offer created for your demo copy.");
              }}
            />
          </li>
        )}
        {offers.map((o) => (
          <li key={o.id} className="rounded-2xl border border-border bg-card p-4">
            {editing === o.id ? (
              <OfferForm
                start={o}
                submitLabel="Save"
                onCancel={() => setEditing(null)}
                onSubmit={async (input) => {
                  const { data, error } = await api.PATCH("/admin/partner-offers/{offerId}", { params: { path: { offerId: o.id } }, body: input });
                  if (error || !data) return void toast.error("Could not save the offer.");
                  setOffers((all) => all.map((x) => (x.id === o.id ? { ...x, ...data, clicks: x.clicks } : x)));
                  setEditing(null);
                  toast.success("Saved to your demo copy.");
                }}
              />
            ) : (
              <div className={cn("flex flex-wrap items-start gap-x-4 gap-y-3", !o.active && "opacity-70")}>
                <div className="min-w-0 flex-1 basis-60">
                  <p className="text-caption text-muted-foreground">{o.partnerName}</p>
                  <p className="text-title">{o.title}</p>
                  <p className="mt-1 text-label font-normal text-muted-foreground">
                    {o.stages.map((s) => offerStages.find((x) => x.id === s)?.label ?? s).join(", ")}
                    {" · "}
                    {o.audience.length === 2 ? "Both parents" : o.audience[0] === "mother" ? "Mother" : "Partner"}
                  </p>
                </div>
                <span className="inline-flex h-8 items-center gap-1.5 font-mono text-label text-muted-foreground" title="Clicks">
                  <MousePointerClick className="size-4" aria-hidden />
                  {o.clicks ?? 0}
                  <span className="sr-only"> clicks</span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={o.active}
                  aria-label={`${o.partnerName} offer shown to parents`}
                  onClick={() => toggle(o)}
                  disabled={pending}
                  className="group inline-flex min-h-11 items-center gap-2 rounded-lg px-1 text-label outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className={cn("flex h-6 w-10 items-center rounded-full p-0.5 transition-colors duration-150", o.active ? "bg-status-ok" : "bg-border")}>
                    <span className={cn("size-5 rounded-full bg-card transition-transform duration-150", o.active && "translate-x-4")} />
                  </span>
                  {o.active ? "Shown" : "Hidden"}
                </button>
                <Button variant="outline" size="lg" className="h-11 px-3" onClick={() => setEditing(o.id)}>
                  <Pencil aria-hidden />
                  Edit
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function OfferForm({ start, submitLabel, onSubmit, onCancel }: { start: PartnerOfferInput; submitLabel: string; onSubmit: (i: PartnerOfferInput) => Promise<void>; onCancel: () => void }) {
  const [v, setV] = useState<PartnerOfferInput>({ partnerName: start.partnerName, title: start.title, detail: start.detail, url: start.url, stages: start.stages, audience: start.audience, active: start.active });
  const [pending, begin] = useTransition();
  const urlOk = /^https?:\/\/\S+\.\S+/.test(v.url);
  const valid = v.partnerName.trim() && v.title.trim() && v.detail.trim() && urlOk && v.stages.length > 0 && v.audience.length > 0;
  const flip = <T,>(list: T[], x: T) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) begin(() => onSubmit({ ...v, partnerName: v.partnerName.trim(), title: v.title.trim(), detail: v.detail.trim(), url: v.url.trim() }));
      }}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-1.5 text-label font-medium">
          Partner name
          <Input value={v.partnerName} onChange={(e) => setV({ ...v, partnerName: e.target.value })} className="h-11 md:h-10" />
        </label>
        <label className="grid gap-1.5 text-label font-medium">
          Link
          <Input value={v.url} onChange={(e) => setV({ ...v, url: e.target.value })} inputMode="url" aria-invalid={v.url !== start.url && !urlOk} className="h-11 font-mono md:h-10" />
        </label>
      </div>
      <label className="grid gap-1.5 text-label font-medium">
        Offer
        <Input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} className="h-11 md:h-10" />
      </label>
      <label className="grid gap-1.5 text-label font-medium">
        Detail
        <Textarea value={v.detail} onChange={(e) => setV({ ...v, detail: e.target.value })} rows={2} />
      </label>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-label font-medium">Shown in these stages</legend>
        <div className="flex flex-wrap gap-2">
          {offerStages.map((s) => (
            <Chip key={s.id} on={v.stages.includes(s.id)} onClick={() => setV({ ...v, stages: flip<Stage>(v.stages, s.id) })}>
              {s.label}
            </Chip>
          ))}
        </div>
      </fieldset>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-label font-medium">Shown to</legend>
        <div className="flex flex-wrap gap-2">
          {roles.map((r) => (
            <Chip key={r.id} on={v.audience.includes(r.id)} onClick={() => setV({ ...v, audience: flip<ParentRole>(v.audience, r.id) })}>
              {r.label}
            </Chip>
          ))}
        </div>
      </fieldset>
      <div className="flex gap-3">
        <Button type="submit" size="lg" className="h-11 px-4" disabled={!valid || pending}>
          {pending ? "Saving..." : submitLabel}
        </Button>
        <Button type="button" variant="ghost" size="lg" className="h-11 px-3" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-11 items-center rounded-full border px-4 text-label outline-none transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-ring/50 md:min-h-9",
        on ? "border-primary bg-primary/15 font-semibold" : "border-border text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}
