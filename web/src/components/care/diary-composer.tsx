"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import type { DiaryEntryInput } from "@/lib/api/types";
import { careIcon, visibilityIcon } from "@/lib/visuals";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type Audience = DiaryEntryInput["visibility"];

const itemClass =
  "h-auto flex-1 flex-col gap-1 py-2 text-caption text-muted-foreground data-[pressed]:border-primary data-[pressed]:bg-secondary data-[pressed]:text-secondary-foreground";

// A private diary. Every entry starts private; the parent picks per entry:
// keep it, share it with the partner, or put one short topic on the
// psychologist agenda (the text itself is never shared there).
export function DiaryComposer({ memberId, partnerName }: { memberId: string; partnerName?: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<Audience>("private");
  const [topic, setTopic] = useState("");
  const [pending, startTransition] = useTransition();
  const Diary = careIcon.diary;

  const options: { value: Audience; label: string; hint: string }[] = [
    { value: "private", label: "Only me", hint: "Only you can see this entry." },
    ...(partnerName
      ? [{ value: "partner" as const, label: partnerName, hint: `You and ${partnerName} can see this entry.` }]
      : []),
    {
      value: "care_team",
      label: "Agenda",
      hint: `Only the topic goes on your psychologist agenda, not this text.${partnerName ? ` ${partnerName} cannot see it.` : ""}`,
    },
  ];
  const needsTopic = audience === "care_team";
  const ready = body.trim().length > 0 && (!needsTopic || topic.trim().length > 0);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    startTransition(async () => {
      const { error } = await api.POST("/members/{memberId}/diary-entries", {
        params: { path: { memberId } },
        body: { body: body.trim(), visibility: audience, agendaTopic: needsTopic ? topic.trim() : undefined },
      });
      if (error) {
        toast.error("Could not save your entry. Please try again.");
        return;
      }
      toast.success(needsTopic ? "Saved. The topic is on your agenda." : "Entry saved.");
      setBody("");
      setTopic("");
      setAudience("private");
      router.refresh();
    });
  }

  return (
    <section aria-labelledby="diary-title" className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
          <Diary className="size-4.5" aria-hidden />
        </span>
        <h2 id="diary-title" className="text-title">
          What is on your mind?
        </h2>
      </div>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-4">
        <Textarea
          aria-label="Diary entry"
          maxLength={2000}
          rows={4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write as much or as little as you like."
        />

        <div className="flex flex-col gap-2">
          <span id="audience-label" className="text-label">
            Who can see this
          </span>
          <ToggleGroup
            aria-labelledby="audience-label"
            variant="outline"
            spacing={1}
            value={[audience]}
            onValueChange={(v: string[]) => v[0] && setAudience(v[0] as Audience)}
            className="w-full"
          >
            {options.map((o) => {
              const Icon = visibilityIcon[o.value];
              return (
                <ToggleGroupItem key={o.value} value={o.value} className={itemClass}>
                  <Icon className="size-4" aria-hidden />
                  {o.label}
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>
          <p aria-live="polite" className="text-caption text-muted-foreground">
            {options.find((o) => o.value === audience)?.hint}
          </p>
        </div>

        {needsTopic && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="agenda-topic" className="text-label">
              Topic for the agenda
            </Label>
            <Input
              id="agenda-topic"
              maxLength={120}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="A few words, for example: sleeping badly, worried"
            />
          </div>
        )}

        <Button type="submit" size="lg" disabled={!ready || pending} className="w-full">
          {pending ? "Saving..." : needsTopic ? "Save and add topic" : "Save entry"}
        </Button>
      </form>
    </section>
  );
}
