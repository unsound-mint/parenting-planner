"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { BookHeart, Lock, NotebookPen, Plus, Sparkles, Users, X } from "lucide-react";
import { api } from "@/lib/api/client";
import type { StoryArt as Art, StoryTheme } from "@/lib/api/types";
import { spring } from "@/components/joy/motion";
import { cn } from "@/lib/utils";
import { StoryArt } from "./story-art";

export type JournalLine = { id: string; text: string };

const THEMES: { id: StoryTheme; label: string; art: Art; starters: string[] }[] = [
  {
    id: "bedtime",
    label: "Bedtime",
    art: "moon",
    starters: ["The first time you laughed was when", "Before bed you always ask for", "You fall asleep holding"],
  },
  {
    id: "adventure",
    label: "Adventure",
    art: "journey",
    starters: ["The bravest thing you did was", "At the park you found", "You laughed so hard when"],
  },
  {
    id: "born",
    label: "The day you were born",
    art: "sunrise",
    starters: ["The first night home, you", "When you first opened your eyes,", "Everyone smiled when you"],
  },
  {
    id: "sibling",
    label: "A new baby is coming",
    art: "cuddle",
    starters: ["When you heard about the baby, you said", "You helped get ready by", "You will teach the baby how to"],
  },
];

const SIGNATURES = ["Mommy", "Mom", "Mama", "Daddy", "Dad", "Papa"];
const MAX_MEMORIES = 4;
const MAX_LEN = 280;

type Memory = { key: number; text: string };

/** Short enough for a chip: the first sentence, at most 90 characters. */
function snippet(text: string) {
  const first = text.split(/(?<=[.!?])\s/)[0] ?? text;
  return first.length > 90 ? `${first.slice(0, 87).trimEnd()}…` : first;
}

export function StoryComposer({
  memberId,
  kids,
  ageMonths,
  signedAs: defaultSignature,
  partnerName,
  aiEnabled,
  journal,
}: {
  memberId: string;
  kids: { id: string; name: string }[];
  /** Age of each child by id, for the theme pictures. */
  ageMonths: Record<string, number>;
  signedAs: string;
  partnerName?: string;
  aiEnabled: boolean;
  journal: JournalLine[];
}) {
  const router = useRouter();
  const [theme, setTheme] = useState<StoryTheme>(kids.length ? "bedtime" : "sibling");
  const [childId, setChildId] = useState(kids[0]?.id ?? "");
  const [nickname, setNickname] = useState("");
  const [signedAs, setSignedAs] = useState(defaultSignature);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [shared, setShared] = useState(false);
  const [pending, startTransition] = useTransition();
  const nextKey = useRef(1);
  const fields = useRef(new Map<number, HTMLTextAreaElement>());

  const current = THEMES.find((t) => t.id === theme)!;
  const name = kids.find((k) => k.id === childId)?.name.split(" ")[0] ?? (nickname.trim() || "your child");
  const usable = memories.filter((m) => m.text.trim().length >= 2);
  const full = memories.length >= MAX_MEMORIES;
  const used = new Set(memories.map((m) => m.text));

  function add(text: string, focus = false) {
    if (full) return;
    const key = nextKey.current++;
    setMemories((ms) => [...ms, { key, text: text.slice(0, MAX_LEN) }]);
    if (focus) {
      requestAnimationFrame(() => {
        const el = fields.current.get(key);
        if (!el) return;
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      });
    }
  }

  function make() {
    startTransition(async () => {
      const { data, error } = await api.POST("/members/{memberId}/stories", {
        params: { path: { memberId } },
        body: {
          theme,
          ...(childId ? { childId } : { childName: nickname.trim() }),
          signedAs,
          memories: usable.map((m) => ({ text: m.text.trim() })),
          visibility: shared ? "partner" : "private",
        },
      });
      if (error || !data) {
        toast.error(error?.code === "invalid_memory" ? "Add a memory with a few words in it." : "Could not make the book. Please try again.");
        return;
      }
      router.push(`/family/${memberId}/baby/storybook/${data.id}`);
    });
  }

  const ready = usable.length > 0 && (childId !== "" || nickname.trim() !== "") && !pending;

  return (
    <form
      className="flex flex-col gap-7"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) make();
      }}
    >
      <fieldset>
        <legend className="text-title">What kind of story?</legend>
        <div className="mt-3 grid grid-cols-2 gap-3 @2xl:grid-cols-4">
          {THEMES.map((t) => (
            <label
              key={t.id}
              className={cn(
                "press group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border-2 bg-card text-left has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                theme === t.id ? "border-me" : "border-transparent",
              )}
            >
              <input type="radio" name="theme" value={t.id} checked={theme === t.id} onChange={() => setTheme(t.id)} className="sr-only" />
              <StoryArt art={t.art} ageMonths={ageMonths[childId]} seed={`theme-${t.id}`} />
              <span className="px-3 py-2.5 text-label">{t.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-5 @2xl:grid-cols-2">
        <fieldset>
          <legend className="text-label text-muted-foreground">For</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {kids.map((k) => (
              <Chip key={k.id} on={childId === k.id} onClick={() => setChildId(k.id)}>
                {k.name.split(" ")[0]}
              </Chip>
            ))}
            {kids.length === 0 && (
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value.slice(0, 40))}
                placeholder="A name or nickname, like Peanut"
                aria-label="Name or nickname"
                className="h-11 w-full rounded-full border border-line-2 bg-card px-4 text-body"
              />
            )}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-label text-muted-foreground">Told by</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {SIGNATURES.map((s) => (
              <Chip key={s} on={signedAs === s} onClick={() => setSignedAs(s)}>
                {s}
              </Chip>
            ))}
          </div>
        </fieldset>
      </div>

      <fieldset>
        <legend className="text-title">Memories to put in it</legend>
        <p className="mt-1 text-label font-normal text-muted-foreground">
          One to four little moments with {name}. Finish a starter, write your own, or take one from your journal.
        </p>

        <ul className="mt-3 flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {memories.map((m, i) => (
              <motion.li
                key={m.key}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={spring.ui}
                className="flex items-start gap-2 rounded-2xl bg-card p-2 pl-4 shadow-[0_0_0_1px_var(--line)]"
              >
                <span className="mt-2.5 font-mono text-caption text-muted-foreground">{i + 1}</span>
                <textarea
                  ref={(el) => {
                    if (el) fields.current.set(m.key, el);
                    else fields.current.delete(m.key);
                  }}
                  value={m.text}
                  rows={2}
                  maxLength={MAX_LEN}
                  aria-label={`Memory ${i + 1}`}
                  onChange={(e) => setMemories((ms) => ms.map((x) => (x.key === m.key ? { ...x, text: e.target.value } : x)))}
                  className="min-h-11 flex-1 resize-none bg-transparent py-2 text-body outline-none"
                />
                <button
                  type="button"
                  onClick={() => setMemories((ms) => ms.filter((x) => x.key !== m.key))}
                  aria-label={`Remove memory ${i + 1}`}
                  className="press flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground"
                >
                  <X aria-hidden className="size-4" />
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>

        {!full && (
          <div className="mt-3 flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {current.starters
                .filter((s) => !used.has(s + " "))
                .map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => add(s + " ", true)}
                    className="press flex min-h-11 items-center gap-1.5 rounded-full border border-dashed border-line-2 bg-card px-4 text-label"
                  >
                    <Sparkles aria-hidden className="size-3.5 text-me" />
                    {s}…
                  </button>
                ))}
              <button
                type="button"
                onClick={() => add("", true)}
                className="press flex min-h-11 items-center gap-1.5 rounded-full border border-dashed border-line-2 bg-card px-4 text-label"
              >
                <Plus aria-hidden className="size-3.5" /> My own words
              </button>
            </div>
            {journal.length > 0 && (
              <div>
                <p className="flex items-center gap-1.5 text-caption text-muted-foreground">
                  <NotebookPen aria-hidden className="size-3.5" /> From your journal
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {journal
                    .filter((j) => !used.has(j.text.slice(0, MAX_LEN)))
                    .slice(0, 4)
                    .map((j) => (
                      <button
                        key={j.id}
                        type="button"
                        onClick={() => add(j.text)}
                        className="press flex min-h-11 max-w-full items-center rounded-full bg-me-soft px-4 text-left text-label"
                      >
                        <span className="truncate">{snippet(j.text)}</span>
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </fieldset>

      <div className="flex flex-col gap-4 border-t border-line pt-5">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            aria-pressed={shared}
            onClick={() => setShared((s) => !s)}
            className={cn(
              "press flex h-11 items-center gap-2 rounded-full px-4 text-label transition-colors duration-200",
              shared ? "bg-them-soft text-them" : "border border-line bg-card",
            )}
          >
            {shared ? <Users aria-hidden className="size-4" /> : <Lock aria-hidden className="size-4" />}
            {shared ? `${partnerName ?? "Your partner"} can read it too` : "Only you, until you share it"}
          </button>
          <button
            type="submit"
            disabled={!ready}
            className="press ml-auto flex h-12 items-center gap-2 rounded-full bg-me px-6 text-label text-white disabled:opacity-40"
          >
            <BookHeart aria-hidden className="size-4.5" />
            {pending ? "Making the book…" : "Make the book"}
          </button>
        </div>
        <p className="text-caption text-muted-foreground">
          {aiEnabled
            ? "To write it, only the first name, age, theme and these lines are sent to Claude, never photos or other records. Grandparents and the nanny do not see stories."
            : "Written on our server from a story template, nothing is sent anywhere. Grandparents and the nanny do not see stories."}
        </p>
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
      className={cn("press flex h-11 items-center rounded-full px-4 text-label transition-colors duration-200", on ? "bg-me text-white" : "border border-line bg-card")}
    >
      {children}
    </button>
  );
}
