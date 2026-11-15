"use client";

import { Check, Heart } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { SizeIllustration, StageMascot } from "@/components/illustrations";
import { SoftCard } from "@/components/joy/soft-card";
import { spring } from "@/components/joy/motion";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import type { Postcard } from "@/lib/api/types";
import { HeartBurst } from "./heart-burst";

const MESSAGE_MAX = 140;

/**
 * The weekly postcard: this week's fruit or milestone, the parents' line and,
 * for a grandparent, one big "Send love" button. It flips in once on arrival.
 *
 * mode "send" is the grandparent's card. mode "preview" is the same card in a
 * parent's hands, without the button, so they see exactly what grandparents see.
 * Large type on purpose: this is the surface for people who are not at home in apps.
 */
export function PostcardCard({
  memberId,
  postcard,
  parentNames,
  mode,
}: {
  memberId: string;
  postcard: Postcard;
  parentNames: string[];
  mode: "send" | "preview";
}) {
  // What a love just returned replaces the server's copy; in preview the parent's saved line arrives as a new prop.
  const [sent, setSent] = useState<Postcard>();
  const card = sent ?? postcard;
  const [message, setMessage] = useState("");
  const [bursts, setBursts] = useState(0);
  const [sentNow, setSentNow] = useState(false);
  const [pending, startTransition] = useTransition();
  const reduce = useReducedMotion();
  const to = parentNames.length ? parentNames.join(" and ") : "the parents";

  function sendLove() {
    // The hearts leave on the tap; the request follows. A failure says so.
    setBursts((n) => n + 1);
    startTransition(async () => {
      const { data, error } = await api.POST("/members/{memberId}/postcard/love", {
        params: { path: { memberId } },
        body: { message: message.trim() || undefined },
      });
      if (!data) {
        toast.error(error?.message ?? "Could not send love. Please try again.");
        return;
      }
      setSent(data);
      setSentNow(true);
      setMessage("");
    });
  }

  return (
    // The card turns toward you like a postcard picked up from the table.
    <div style={{ perspective: 1400 }}>
      <motion.div
        initial={{ opacity: 0, rotateY: reduce ? 0 : -78, y: reduce ? 0 : 14 }}
        animate={{ opacity: 1, rotateY: 0, y: 0 }}
        transition={{ ...spring.gentle, opacity: { duration: 0.2 } }}
        style={{ transformOrigin: "left center" }}
      >
        <SoftCard tone="sun" hero as="article" aria-label="This week's postcard" className="flex flex-col gap-6 ring-1 ring-sun-2">
          <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] sm:gap-8">
            <div className="mx-auto w-full max-w-64 sm:max-w-none">
              {card.kind === "pregnancy" && card.comparison ? (
                <SizeIllustration comparison={card.comparison} label={`${card.period}, ${card.headline.toLowerCase()}`} bubble="Hello!" />
              ) : (
                <StageMascot stage={card.stage} label={card.headline} bubble="Hello!" />
              )}
            </div>
            <div className="flex min-w-0 flex-col gap-2">
              <p className="font-mono text-caption tracking-widest text-mom uppercase">{card.period}</p>
              <h2 className="text-display text-balance">{card.headline}</h2>
              {card.detail && <p className="max-w-prose text-body text-ink-2">{card.detail}</p>}
            </div>
          </div>

          {card.line ? (
            <figure className="rounded-2xl bg-card/70 px-5 py-4">
              <blockquote className="text-title text-balance">&ldquo;{card.line.text}&rdquo;</blockquote>
              <figcaption className="mt-1 text-label font-normal text-muted-foreground">From {card.line.authorName}</figcaption>
            </figure>
          ) : (
            mode === "preview" && (
              <p className="rounded-2xl border border-dashed border-line-2 px-5 py-4 text-label font-normal text-muted-foreground">
                Add a line below and it shows up here, in your words.
              </p>
            )
          )}

          {mode === "send" && (
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5 text-label">
                <span className="sr-only">A few words for {to} (optional)</span>
                <input
                  value={message}
                  maxLength={MESSAGE_MAX}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={`A few words for ${to} (optional)`}
                  className="h-12 w-full rounded-2xl border border-line-2 bg-card px-4 text-body outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </label>
              <div className="relative">
                <Button
                  size="lg"
                  disabled={pending}
                  onClick={sendLove}
                  className="press h-14 w-full gap-2.5 rounded-full bg-mom text-title font-semibold text-white hover:bg-mom/90"
                >
                  <motion.span key={bursts} initial={{ scale: bursts ? 0.5 : 1 }} animate={{ scale: 1 }} transition={spring.playful} className="inline-flex">
                    <Heart aria-hidden className={`size-6 ${card.loveSentToday ? "fill-current" : ""}`} />
                  </motion.span>
                  {card.loveSentToday ? "Send more love" : "Send love"}
                </Button>
                {bursts > 0 && <HeartBurst key={bursts} />}
              </div>
              <div aria-live="polite" className="min-h-6">
                <AnimatePresence>
                  {sentNow && (
                    <motion.p
                      key="sent"
                      initial={{ opacity: 0, y: reduce ? 0 : 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={spring.ui}
                      className="flex items-center justify-center gap-1.5 text-label text-leaf"
                    >
                      <Check aria-hidden className="size-4" />
                      Sent to {to}. They will see it on their week.
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}
        </SoftCard>
      </motion.div>
    </div>
  );
}
