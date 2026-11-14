"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Visibility } from "@/lib/api/types";
import { visibilityIcon, visibilityLabel } from "@/lib/visuals";
import { cn } from "@/lib/utils";
import { visibilityShort } from "./visibility-chip";

// Shared pieces for adding, editing and removing passport records in place:
// every section edits its own rows the same way, so the page reads as one tool.

export const fieldClass =
  "h-11 w-full min-w-0 rounded-lg border border-input bg-card px-3 text-body outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:h-9 md:text-label";

const pill =
  "inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-label font-medium outline-none transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60 md:min-h-9";

export function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <span className="text-caption font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

type Result = { error?: unknown; response: Response };

/**
 * Runs one write, says what went wrong in a toast, and refreshes the server
 * render on success so every section shows the stored state.
 */
export function useSave() {
  const router = useRouter();
  const [pending, start] = useTransition();
  function run(call: () => Promise<Result>, failed: string, onDone?: () => void) {
    start(async () => {
      const { error, response } = await call();
      if (error || !response.ok) {
        toast.error(response.status === 400 ? `${failed} Check the fields and try again.` : `${failed} Please try again.`);
        return;
      }
      onDone?.();
      router.refresh();
    });
  }
  return { pending, run };
}

/** The "+ Add" control in a section header. */
export function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn(pill, "border border-border bg-card hover:bg-muted")}>
      <Plus className="size-4" aria-hidden />
      {label}
    </button>
  );
}

/** A quiet pencil beside a row. */
export function EditButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 md:size-8"
    >
      <Pencil className="size-4" aria-hidden />
    </button>
  );
}

/**
 * The form frame for one record: fields, then Save and Cancel, and Delete
 * for an existing record. Delete asks once more in place instead of a dialog.
 */
export function EditorForm({
  title,
  pending,
  onSubmit,
  onCancel,
  onDelete,
  children,
  className,
}: {
  title: string;
  pending: boolean;
  onSubmit: () => void;
  onCancel: () => void;
  onDelete?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const [confirm, setConfirm] = useState(false);
  return (
    <form
      aria-label={title}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className={cn("flex flex-col gap-3 rounded-xl border border-border bg-background p-3", className)}
    >
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={pending} className={cn(pill, "bg-primary text-primary-foreground hover:bg-primary/85")}>
          {pending ? "Saving..." : "Save"}
        </button>
        <button type="button" onClick={onCancel} className={cn(pill, "text-muted-foreground hover:bg-muted hover:text-foreground")}>
          Cancel
        </button>
        {onDelete && (
          <button
            type="button"
            disabled={pending}
            onClick={() => (confirm ? onDelete() : setConfirm(true))}
            className={cn(pill, "ml-auto text-status-late hover:bg-status-late-soft", confirm && "bg-status-late-soft")}
          >
            <Trash2 className="size-4" aria-hidden />
            {confirm ? "Remove for good" : "Remove"}
          </button>
        )}
      </div>
    </form>
  );
}

/**
 * Who can see a record, changeable in place: the chip is a native select, so
 * it works with the keyboard and on phones without a custom menu.
 */
export function VisibilityPicker({ value, onChange, disabled }: { value: Visibility; onChange: (v: Visibility) => void; disabled?: boolean }) {
  const Icon = visibilityIcon[value];
  return (
    <label
      title={`${visibilityLabel[value]}. Change who can see it.`}
      className="relative inline-flex h-7 cursor-pointer items-center gap-1 rounded-full bg-muted pr-2.5 pl-2 font-sans text-caption text-muted-foreground transition-colors duration-150 focus-within:ring-3 focus-within:ring-ring/50 hover:bg-muted/70 hover:text-foreground"
    >
      <Icon className="size-3.5" aria-hidden />
      {visibilityShort[value]}
      <svg viewBox="0 0 8 5" className="ml-0.5 size-2 opacity-60" aria-hidden>
        <path d="M0 0l4 5 4-5z" fill="currentColor" />
      </svg>
      <select
        aria-label="Who can see it"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as Visibility)}
        className="absolute inset-0 cursor-pointer appearance-none opacity-0"
      >
        {(Object.keys(visibilityLabel) as Visibility[]).map((v) => (
          <option key={v} value={v}>
            {visibilityLabel[v]}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Visibility as a field inside an editor. */
export function VisibilityField({ value, onChange }: { value: Visibility; onChange: (v: Visibility) => void }) {
  return (
    <Field label="Who can see it">
      <select className={fieldClass} value={value} onChange={(e) => onChange(e.target.value as Visibility)}>
        {(Object.keys(visibilityLabel) as Visibility[]).map((v) => (
          <option key={v} value={v}>
            {visibilityLabel[v]}
          </option>
        ))}
      </select>
    </Field>
  );
}

/** Text to optional number: blank is "not given". */
export const optNum = (s: string) => (s.trim() === "" ? undefined : Number(s));
