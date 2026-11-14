"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { Check, Copy, KeyRound, UserPlus } from "lucide-react";
import { api } from "@/lib/api/client";
import type { Friends } from "@/lib/api/types";
import { spring } from "@/components/joy/motion";
import { formatShortDate } from "@/lib/format";

/**
 * Connecting, both ways: make a code to pass on, or enter a friend's code. A
 * code grants nothing by itself; the other family still has to accept.
 */
export function CodeCard({ memberId, code }: { memberId: string; code?: Friends["code"] }) {
  const router = useRouter();
  const [mine, setMine] = useState(code ?? null);
  const [theirs, setTheirs] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const path = { params: { path: { memberId } } };

  const make = () =>
    start(async () => {
      const { data } = await api.POST("/members/{memberId}/friend-code", path);
      if (data) setMine(data);
      else toast.error("Could not make a code. Try again in a moment.");
    });

  const copy = async () => {
    if (!mine) return;
    try {
      await navigator.clipboard.writeText(mine.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Copy did not work; read the code out instead.");
    }
  };

  const connect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!theirs.trim() || pending) return;
    start(async () => {
      const { data, error } = await api.POST("/members/{memberId}/friend-connections", { ...path, body: { code: theirs.trim() } });
      if (!data) {
        setError(
          error?.code === "own_code"
            ? "That is your own family's code. Send it to a friend instead."
            : error?.code === "already_connected"
              ? "Your families are already connected, or one of you already asked."
              : error?.code === "code_not_found"
                ? "No family has that code, or it expired. Ask them for a fresh one."
                : "That code does not look right. It has 8 letters and numbers.",
        );
        return;
      }
      setError(null);
      setTheirs("");
      toast.success(data.status === "connected" ? `You are now connected with ${data.names.join(" and ")}.` : `Asked ${data.names.join(" and ")}. They will see your request.`);
      router.refresh();
    });
  };

  return (
    <div className="flex min-w-0 flex-col gap-4 self-start rounded-3xl bg-card/85 p-5">
      <div className="flex min-w-0 flex-col gap-2">
        <p className="flex items-center gap-2 text-label text-ink">
          <KeyRound className="size-4 text-me" aria-hidden />
          Your family code
        </p>
        <AnimatePresence mode="popLayout" initial={false}>
          {mine ? (
            <motion.div key={mine.code} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={spring.ui} className="flex items-center gap-2">
              <span className="rounded-2xl bg-muted px-4 py-2.5 font-mono text-title tracking-[0.18em] text-ink select-all">{mine.code}</span>
              <button type="button" onClick={copy} aria-label="Copy the code" className="press grid size-11 place-items-center rounded-full text-ink-2 hover:bg-muted">
                {copied ? <Check className="size-4.5 text-leaf" aria-hidden /> : <Copy className="size-4.5" aria-hidden />}
              </button>
            </motion.div>
          ) : (
            <motion.button
              key="make"
              type="button"
              onClick={make}
              disabled={pending}
              exit={{ opacity: 0 }}
              className="press inline-flex min-h-11 w-fit items-center gap-2 rounded-full bg-me px-4 text-label font-semibold text-white disabled:opacity-60"
            >
              Make a code to send
            </motion.button>
          )}
        </AnimatePresence>
        <p className="text-caption text-muted-foreground">
          {mine ? `Works until ${formatShortDate(mine.expiresAt.slice(0, 10))}. You still accept each family.` : "Send it to a friend; nothing is shared until you both agree."}
        </p>
      </div>
      <form onSubmit={connect} className="flex min-w-0 flex-col gap-2 border-t border-line pt-4">
        <label htmlFor="friend-code" className="flex items-center gap-2 text-label text-ink">
          <UserPlus className="size-4 text-me" aria-hidden />
          Have a friend&apos;s code?
        </label>
        <div className="flex min-w-0 gap-2">
          <input
            id="friend-code"
            value={theirs}
            onChange={(e) => {
              setTheirs(e.target.value.toUpperCase());
              setError(null);
            }}
            placeholder="ABCD-2345"
            maxLength={12}
            autoComplete="off"
            className="h-11 min-w-0 flex-1 rounded-full border border-line-2 bg-card px-4 font-mono text-body tracking-widest outline-none placeholder:text-muted-foreground focus-visible:border-me focus-visible:ring-3 focus-visible:ring-me/20"
          />
          <button type="submit" disabled={!theirs.trim() || pending} className="press min-h-11 shrink-0 rounded-full border border-line-2 bg-card px-4 text-label text-ink hover:bg-muted disabled:opacity-50">
            Connect
          </button>
        </div>
        {error && (
          <p role="alert" className="text-caption text-ink-2">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
