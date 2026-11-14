import Link from "next/link";
import { ArrowLeft, CloudOff } from "lucide-react";

export function BackToCare({ memberId }: { memberId: string }) {
  return (
    <Link
      href={`/family/${memberId}/care`}
      className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-label text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <ArrowLeft className="size-4" aria-hidden />
      Care
    </Link>
  );
}

export function Unavailable({ title }: { title: string }) {
  return (
    <div role="status" className="mt-4 flex max-w-2xl items-center gap-4 rounded-2xl border border-border bg-card p-6">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <CloudOff className="size-6" aria-hidden />
      </span>
      <div>
        <p className="text-title">{title}</p>
        <p className="text-label text-muted-foreground">Nothing is lost. Try again in a moment.</p>
      </div>
    </div>
  );
}

export function WellbeingFallback() {
  return (
    <main className="px-4 pt-6 md:px-8" aria-busy>
      <div className="h-8 w-1/2 max-w-md animate-pulse rounded-lg bg-muted" />
      <div className="mt-8 h-56 max-w-2xl animate-pulse rounded-2xl bg-muted" />
    </main>
  );
}
