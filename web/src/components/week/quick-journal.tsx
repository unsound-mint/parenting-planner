"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { Battery, BatteryFull, BatteryLow, BatteryMedium, Check, Lock, Minus, Plus, Zap, type LucideIcon } from "lucide-react";
import { api } from "@/lib/api/client";
import { MoodPicker } from "@/components/joy/mood-picker";
import type { Mood } from "@/components/joy/mood-face";
import { SoftCard } from "@/components/joy/soft-card";
import { duration, ease, spring } from "@/components/joy/motion";
import { cn } from "@/lib/utils";

// The quick journal: a face, one line, save. Both stay private to the author.
// The line is a diary entry (POST /diary-entries, private); the face is a mood
// check-in (POST /mood-checkins), which also needs energy and sleep, so those
// two small rows open once a face is picked. Nothing is filled in for the
// parent: mood patterns are computed from these numbers.

const energies: { value: number; icon: LucideIcon; label: string }[] = [
  { value: 1, icon: Battery, label: "Drained" },
  { value: 2, icon: BatteryLow, label: "Low" },
  { value: 3, icon: BatteryMedium, label: "Some" },
  { value: 4, icon: BatteryFull, label: "Good" },
  { value: 5, icon: Zap, label: "Full" },
];

export function QuickJournal({
  memberId,
  prompt,
  starters,
  todayMood,
  className,
}: {
  memberId: string;
  prompt: string;
  starters: string[];
  /** Today's check-in, if the parent already did one: the face shows picked. */
  todayMood?: Mood;
  className?: string;
}) {
  const [mood, setMood] = useState<Mood | null>(todayMood ?? null);
  // The mood already on record today; picking it again saves no new check-in.
  const [base, setBase] = useState<Mood | undefined>(todayMood);
  const [energy, setEnergy] = useState<number | null>(null);
  const [sleep, setSleep] = useState(7);
  const [line, setLine] = useState("");
  const [state, setState] = useState<"edit" | "saving" | "saved">("edit");
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const newMood = mood != null && mood !== base;
  const ready = (line.trim() !== "" || newMood) && (!newMood || energy != null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || state === "saving") return;
    setState("saving");
    const path = { params: { path: { memberId } } };
    const body = line.trim();
    const [diary, checkin] = await Promise.all([
      body ? api.POST("/members/{memberId}/diary-entries", { ...path, body: { body, visibility: "private" } }) : undefined,
      newMood && energy != null
        ? api.POST("/members/{memberId}/mood-checkins", { ...path, body: { mood, energy, sleepHours: sleep, visibility: "private" } })
        : undefined,
    ]);
    if (diary?.error || checkin?.error) {
      setState("edit");
      toast.error("Could not save. Please try again.");
      return;
    }
    setState("saved");
    if (checkin) {
      setBase(mood ?? undefined);
      // A check-in can complete a mood pattern; the calm list then offers someone to talk to.
      router.refresh();
    }
  }

  function again() {
    setLine("");
    setEnergy(null);
    setState("edit");
    // Wait for the composer to be back before focusing it.
    requestAnimationFrame(() => input.current?.focus());
  }

  return (
    <SoftCard as="section" aria-labelledby="journal-title" className={className}>
      <h2 id="journal-title" className="text-headline">
        {prompt}
      </h2>
      <MoodPicker value={mood} onChange={setMood} label="Your mood today" className="mt-5" />

      {/* Energy and sleep open under the faces once a new face is picked; an accordion, so height may move. */}
      <AnimatePresence initial={false}>
        {newMood && state !== "saved" && (
          <motion.div
            key="more"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: duration.base, ease: ease.out }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-4">
              <div role="group" aria-label="Energy" className="flex items-center gap-1">
                <span className="mr-1.5 text-label font-normal text-muted-foreground">Energy</span>
                {energies.map(({ value, icon: Icon, label }) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={energy === value}
                    aria-label={label}
                    title={label}
                    onClick={() => setEnergy(value)}
                    className={cn(
                      "press inline-flex size-11 items-center justify-center rounded-full transition-colors duration-(--duration-fast) md:size-9",
                      energy === value ? "bg-me-soft text-me" : "text-muted-foreground hover:bg-muted",
                    )}
                  >
                    <Icon aria-hidden className="size-4.5" />
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1" role="group" aria-label="Sleep last night">
                <span className="mr-1.5 text-label font-normal text-muted-foreground">Slept</span>
                <button type="button" aria-label="Less sleep" onClick={() => setSleep((s) => Math.max(0, s - 0.5))} className="press inline-flex size-11 items-center justify-center rounded-full hover:bg-muted md:size-9">
                  <Minus aria-hidden className="size-4" />
                </button>
                <span className="w-12 text-center font-mono text-label" aria-live="polite">
                  {sleep} h
                </span>
                <button type="button" aria-label="More sleep" onClick={() => setSleep((s) => Math.min(24, s + 0.5))} className="press inline-flex size-11 items-center justify-center rounded-full hover:bg-muted md:size-9">
                  <Plus aria-hidden className="size-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* The composer and its confirmation share one grid cell, so saving swaps them in place without the card jumping. */}
      <div className="mt-4 grid">
        <motion.form
          onSubmit={save}
          aria-hidden={state === "saved"}
          inert={state === "saved"}
          animate={state === "saved" ? { opacity: 0, y: -6 } : { opacity: 1, y: 0 }}
          transition={{ duration: duration.base, ease: ease.out }}
          className="col-start-1 row-start-1"
        >
          <label className="flex min-h-13 items-center gap-2.5 rounded-full border-[1.5px] border-line-2 bg-white py-1.5 pr-1.5 pl-4.5 transition-colors duration-(--duration-fast) focus-within:border-me">
            <span className="sr-only">One line for your journal</span>
            <input
              ref={input}
              value={line}
              onChange={(e) => setLine(e.target.value)}
              maxLength={500}
              placeholder="One line is plenty. Only you will see it."
              className="min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-muted-foreground/80"
            />
          </label>
          <ul className="mt-3.5 flex flex-wrap gap-2">
            {starters.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => {
                    setLine(s);
                    input.current?.focus();
                  }}
                  className="press min-h-9 rounded-full border border-dashed border-line-2 px-3 text-label font-normal text-ink-2 transition-colors duration-(--duration-fast) hover:border-solid hover:bg-white"
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center gap-3">
            <p className="flex flex-1 items-center gap-1.5 text-label font-normal text-muted-foreground">
              <Lock aria-hidden className="size-3.5 shrink-0" />
              {/* A check-in needs energy (MoodCheckinInput), so say so instead of a silent grey button. */}
              {newMood && energy == null ? "Tap your energy above to save how you feel." : "Private to you. Share any entry later, one at a time."}
            </p>
            <motion.button
              type="submit"
              disabled={!ready || state === "saving"}
              whileTap={{ scale: 0.97 }}
              className="inline-flex min-h-11 items-center rounded-full bg-me px-5 text-body font-semibold text-white transition-opacity duration-(--duration-fast) disabled:opacity-45"
            >
              {state === "saving" ? "Saving" : "Save"}
            </motion.button>
          </div>
        </motion.form>

        <AnimatePresence>
          {state === "saved" && (
            <motion.div
              key="saved"
              role="status"
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6 }}
              transition={spring.ui}
              className="col-start-1 row-start-1 flex flex-col items-start gap-3 self-center rounded-2xl bg-leaf-soft px-4.5 py-4"
            >
              <p className="flex items-start gap-3 text-body">
                <motion.span
                  initial={{ scale: 0.5, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ ...spring.playful, delay: 0.08 }}
                  className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-leaf text-white"
                >
                  <Check aria-hidden className="size-4" strokeWidth={3} />
                </motion.span>
                <span>
                  Saved, just for you.{" "}
                  <Link href={`/family/${memberId}/care`} className="font-semibold text-leaf underline decoration-leaf/40 underline-offset-4 hover:decoration-current">
                    Talk it through with your psychologist
                  </Link>
                </span>
              </p>
              <button type="button" onClick={again} className="press min-h-9 rounded-full px-3 text-label font-semibold text-leaf hover:bg-card/60">
                Write another line
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </SoftCard>
  );
}
