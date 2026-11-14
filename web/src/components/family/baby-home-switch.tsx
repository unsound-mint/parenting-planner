"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Baby } from "lucide-react";
import { api } from "@/lib/api/client";
import type { Shift } from "@/lib/api/types";
import { shiftTimes, dayWords, todayKey, addDays } from "@/lib/schedule";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// One deliberate step: flipping the switch asks for the baby's name and birth
// date, and nothing changes until the parent confirms. It cannot be undone.
export function BabyHomeSwitch({ memberId, agreedShifts }: { memberId: string; agreedShifts: Shift[] }) {
  const router = useRouter();
  const today = todayKey();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState(today);
  const [pending, startTransition] = useTransition();
  const nameRef = useRef<HTMLInputElement>(null);

  function confirm(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    startTransition(async () => {
      const { error, response } = await api.POST("/members/{memberId}/baby-arrival", {
        params: { path: { memberId } },
        body: { name: name.trim(), birthDate },
      });
      if (error) {
        setOpen(false);
        toast.error(
          response.status === 501
            ? "This is not available yet."
            : error.code === "not_pregnant"
              ? "Your family is already past pregnancy."
              : "Could not save. Please try again.",
        );
        if (error.code === "not_pregnant") router.refresh();
        return;
      }
      setDone(true);
      toast.success(`Welcome, ${name.trim()}. ${agreedShifts.length > 0 ? "Your shifts are in the calendar." : "Your plan has moved on."}`);
      router.refresh();
    });
  }

  return (
    <section
      aria-labelledby="home-title"
      className={cn("rounded-2xl border bg-card p-5 transition-colors duration-220", open || done ? "border-primary" : "border-border")}
    >
      <div className="flex items-center gap-4">
        <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
          <Baby className="size-5.5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="home-title" className="text-title">
            Baby is home
          </h2>
          <p className="text-label font-normal text-muted-foreground">Flip it on the day you arrive.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={done}
          aria-label="Baby is home"
          aria-expanded={open}
          disabled={done || pending}
          onClick={() => {
            setOpen((o) => !o);
            setTimeout(() => nameRef.current?.focus(), 0);
          }}
          className="group relative flex h-11 w-[72px] shrink-0 items-center rounded-full bg-muted p-1 transition-colors duration-220 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-checked:bg-primary"
        >
          <span
            aria-hidden
            className={cn(
              "size-9 rounded-full bg-card shadow-[0_1px_3px_rgb(0_0_0/0.2)] transition-transform duration-220 ease-(--ease-out)",
              (open || done) && "translate-x-7",
            )}
          />
        </button>
      </div>

      {/* Closed content is inert, so keyboard and screen readers skip it. */}
      <div
        inert={!open || done}
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-220 ease-(--ease-out)",
          open && !done ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <form onSubmit={confirm} className="min-h-0 overflow-hidden">
          <div className="mt-4 flex flex-col gap-4 border-t border-border pt-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="baby-name">Baby&apos;s name</Label>
              <Input id="baby-name" ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required autoComplete="off" className="h-11" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="baby-birth">Born on</Label>
              <Input
                id="baby-birth"
                type="date"
                value={birthDate}
                min={addDays(today, -30)}
                max={today}
                onChange={(e) => setBirthDate(e.target.value)}
                required
                className="h-11 font-mono"
              />
            </div>

            {agreedShifts.length > 0 && (
              <div>
                <p className="text-label">These start today</p>
                <ul className="mt-1.5 flex flex-col gap-1">
                  {agreedShifts.map((s) => (
                    <li key={s.id} className="flex items-center gap-2 text-label font-normal text-muted-foreground">
                      <Baby className="size-3.5 shrink-0" aria-hidden />
                      <span>
                        {s.title} <span className="font-mono text-caption">· {dayWords(s.days)}, {shiftTimes(s)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-caption text-muted-foreground">Your plan changes to life with a newborn. This cannot be undone.</p>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={pending || !name.trim()} className="h-11 px-4 text-label">
                {pending ? "Saving..." : "Yes, baby is home"}
              </Button>
              <Button type="button" variant="ghost" disabled={pending} onClick={() => setOpen(false)} className="h-11 px-4 text-label">
                Not yet
              </Button>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
}
