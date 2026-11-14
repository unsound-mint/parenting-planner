"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronDown, Pencil, RotateCcw } from "lucide-react";
import { api } from "@/lib/api/client";
import type { ContentItem } from "@/lib/api/types";
import { formatLongDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { contentKinds } from "./labels";
import { SourceLink, shortSource } from "@/components/joy/source-line";

// One list per content kind. Saving and resetting only touch this visitor's
// demo copy; the catalog and its sources stay as they are.
export function ContentEditor({ initial }: { initial: ContentItem[] }) {
  const [items, setItems] = useState(initial);
  const [open, setOpen] = useState<string | null>(null);
  const replace = (next: ContentItem) => setItems((all) => all.map((i) => (i.id === next.id ? next : i)));

  if (items.length === 0) return <p className="mt-6 text-label text-muted-foreground">Nothing to edit here yet.</p>;
  return (
    <ul className="mt-4 grid items-start gap-2 xl:grid-cols-2 2xl:grid-cols-3">
      {items.map((item) => (
        <Row key={item.id} item={item} open={open === item.id} onToggle={() => setOpen(open === item.id ? null : item.id)} onChange={replace} />
      ))}
    </ul>
  );
}

function Row({ item, open, onToggle, onChange }: { item: ContentItem; open: boolean; onToggle: () => void; onChange: (i: ContentItem) => void }) {
  const [title, setTitle] = useState(item.title);
  const [body, setBody] = useState(item.body);
  const [pending, start] = useTransition();
  const bodyLabel = contentKinds.find((k) => k.id === item.kind)?.bodyLabel ?? "Text";
  const dirty = title !== item.title || body !== item.body;
  const valid = title.trim() !== "" && body.trim() !== "";
  const path = { params: { path: { kind: item.kind, itemId: item.id } } };

  function save() {
    start(async () => {
      const { data, error } = await api.PATCH("/admin/content-items/{kind}/{itemId}", { ...path, body: { title: title.trim(), body: body.trim() } });
      if (error || !data) return void toast.error("Could not save. Please try again.");
      onChange(data);
      toast.success("Saved to your demo copy.");
    });
  }
  function reset() {
    start(async () => {
      const { data, error } = await api.POST("/admin/content-items/{kind}/{itemId}/reset", path);
      if (error || !data) return void toast.error("Could not reset. Please try again.");
      onChange(data);
      setTitle(data.title);
      setBody(data.body);
      toast.success("Back to the original text.");
    });
  }

  return (
    <li className="rounded-2xl border border-border bg-card">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-4 py-2 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-title">{item.title}</span>
          <span className="block truncate font-mono text-caption text-muted-foreground">{item.id}</span>
        </span>
        {item.edited && (
          <span className="inline-flex h-6 shrink-0 items-center gap-1 rounded-full bg-status-up-soft px-2.5 text-caption font-medium text-status-up">
            <Pencil className="size-3" aria-hidden />
            Edited
          </span>
        )}
        <ChevronDown className={cn("size-5 shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <form
          className="grid gap-4 border-t border-border px-4 py-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (dirty && valid) save();
          }}
        >
          <label className="grid gap-1.5 text-label font-medium">
            Title
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-11 md:h-10" />
          </label>
          <label className="grid gap-1.5 text-label font-medium">
            {bodyLabel}
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} />
          </label>
          {item.source && (
            <p className="text-caption text-muted-foreground">
              The source link stays: <SourceLink source={item.source}>{shortSource(item.source.title)}</SourceLink>
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" size="lg" className="h-11 px-4" disabled={!dirty || !valid || pending}>
              {pending ? "Saving..." : "Save"}
            </Button>
            {item.edited && (
              <Button type="button" variant="ghost" size="lg" className="h-11 px-3" onClick={reset} disabled={pending}>
                <RotateCcw aria-hidden />
                Reset to original
              </Button>
            )}
            {item.updatedAt && <span className="font-mono text-caption text-muted-foreground">Changed {formatLongDate(item.updatedAt.slice(0, 10))}</span>}
          </div>
        </form>
      )}
    </li>
  );
}
