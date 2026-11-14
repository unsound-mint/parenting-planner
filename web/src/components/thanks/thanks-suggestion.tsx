"use client";

import { useRef, useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import type { Thanks } from "@/lib/api/types";
import type { Person } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar } from "@/components/joy/partner-chip";
import { flyToChip } from "./fly";

export type ThanksDraft = { key?: string; toMemberId: string; text: string };

/**
 * One thank-you the data suggested, already worded and editable, with a send
 * button. Use it anywhere a parent could say thanks (the People page, This
 * week). On send the card flies to the recipient's chip when the page has one
 * (data-thanks-chip) and onSent hands the stored note to the caller.
 */
export function ThanksSuggestion({
  memberId,
  suggestion,
  people,
  onSent,
}: {
  memberId: string;
  suggestion: ThanksDraft;
  people: Person[];
  onSent?: (t: Thanks, key?: string) => void;
}) {
  const [text, setText] = useState(suggestion.text);
  const [sending, setSending] = useState(false);
  const card = useRef<HTMLLIElement>(null);
  const to = people.find((p) => p.id === suggestion.toMemberId);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    const { data, error, response } = await api.POST("/members/{memberId}/thanks", {
      params: { path: { memberId } },
      body: { toMemberId: suggestion.toMemberId, body: text.trim(), suggestionKey: suggestion.key },
    });
    if (error || !data) {
      setSending(false);
      toast.error(response.status === 409 ? "That one was thanked already." : "Could not send that. Please try again.");
      return;
    }
    if (card.current) await flyToChip(card.current, suggestion.toMemberId);
    onSent?.(data, suggestion.key);
  }

  return (
    <li ref={card} className="list-none">
      <form onSubmit={send} className="flex flex-col gap-3 rounded-2xl bg-muted p-4">
        <div className="flex items-center gap-2 text-label text-ink-2">
          {to && <Avatar person={to} size="sm" />}
          <label htmlFor={`thanks-${suggestion.key ?? suggestion.toMemberId}`}>Thank {to?.displayName ?? "them"}</label>
        </div>
        <Textarea
          id={`thanks-${suggestion.key ?? suggestion.toMemberId}`}
          value={text}
          maxLength={400}
          rows={2}
          onChange={(e) => setText(e.target.value)}
          className="min-h-16 resize-none bg-card text-body"
        />
        <Button type="submit" disabled={sending || !text.trim()} className="press min-h-11 gap-2 self-end px-5">
          <Send aria-hidden className="size-4" />
          Send
        </Button>
      </form>
    </li>
  );
}
