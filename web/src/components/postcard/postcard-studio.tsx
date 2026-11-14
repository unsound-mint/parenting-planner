"use client";

import { Eye, Lock } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { SoftCard } from "@/components/joy/soft-card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import type { Postcard } from "@/lib/api/types";
import { PostcardCard } from "./postcard-card";

const LINE_MAX = 140;
// Starters, so the field is never blank: tap one, change it, save.
const STARTERS = ["Kicks kept me up, happily.", "Feeling good this week.", "We heard the heartbeat today."];

/**
 * For a parent: the card exactly as grandparents see it, and the one line that
 * goes on it this week. Saving swaps the line in the preview. Either parent can
 * write or replace it; a new week starts empty.
 */
export function PostcardStudio({ memberId, postcard, parentNames, sharedWith }: { memberId: string; postcard: Postcard; parentNames: string[]; sharedWith: string[] }) {
  const [card, setCard] = useState(postcard);
  const [text, setText] = useState(postcard.line?.text ?? "");
  const [pending, startTransition] = useTransition();
  const dirty = text.trim() !== (card.line?.text ?? "");

  function save() {
    startTransition(async () => {
      const { data, error } = await api.PUT("/members/{memberId}/postcard/line", { params: { path: { memberId } }, body: { text } });
      if (!data) {
        toast.error(error?.message ?? "Could not save the line. Please try again.");
        return;
      }
      setCard(data);
      setText(data.line?.text ?? "");
      toast.success(data.line ? "Saved. Grandparents see it now." : "Cleared.");
    });
  }

  return (
    <div className="grid min-w-0 items-start gap-6 @5xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="flex min-w-0 flex-col gap-3">
        <p className="flex items-center gap-2 text-label font-normal text-muted-foreground">
          <Eye aria-hidden className="size-4" />
          {sharedWith.length ? `${sharedWith.join(" and ")} see${sharedWith.length === 1 ? "s" : ""} this card.` : "This is the card your family will see."}
        </p>
        <PostcardCard memberId={memberId} postcard={card} parentNames={parentNames} mode="preview" />
      </div>

      <SoftCard as="section" aria-labelledby="line-title" className="flex flex-col gap-4">
        <h2 id="line-title" className="text-title">
          One line from you
        </h2>
        <div className="flex flex-wrap gap-2">
          {STARTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setText(s)}
              className="press min-h-11 rounded-full border border-dashed border-line-2 px-4 text-label transition-colors hover:bg-muted"
            >
              {s}
            </button>
          ))}
        </div>
        <label className="flex flex-col gap-1.5 text-label">
          <span className="sr-only">This week&apos;s line</span>
          <textarea
            value={text}
            maxLength={LINE_MAX}
            rows={3}
            onChange={(e) => setText(e.target.value)}
            placeholder="What would you tell the family this week?"
            className="w-full resize-none rounded-2xl border border-line-2 bg-card px-4 py-3 text-body outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <span className="self-end font-mono text-caption text-muted-foreground">
            {text.length}/{LINE_MAX}
          </span>
        </label>
        <Button size="lg" disabled={pending || !dirty} onClick={save} className="press h-12 text-body font-semibold">
          {text.trim() ? "Save the line" : "Clear the line"}
        </Button>
        <p className="flex items-start gap-2 rounded-2xl bg-leaf-soft px-4 py-3 text-label font-normal text-leaf">
          <Lock aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>Only this line goes on the card. Your diary, mood and visit notes never do.</span>
        </p>
      </SoftCard>
    </div>
  );
}
