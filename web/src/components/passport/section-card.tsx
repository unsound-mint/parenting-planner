import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Shared frame for every passport section: tinted icon, title, optional figure on the right.
export function SectionCard({
  id,
  icon: Icon,
  title,
  figure,
  className,
  children,
}: {
  id: string;
  icon: LucideIcon;
  title: string;
  figure?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className={cn("rounded-2xl border border-border bg-card p-5", className)}>
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-status-up-soft text-status-up">
          <Icon className="size-4.5" aria-hidden />
        </span>
        <h2 id={id} className="flex-1 text-title">
          {title}
        </h2>
        {figure}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function EmptyLine({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-label text-muted-foreground">{children}</p>;
}
