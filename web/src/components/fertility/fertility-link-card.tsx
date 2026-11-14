import Link from "next/link";
import { CalendarHeart, ChevronRight, Flower2, ListChecks, Lock } from "lucide-react";

const rows = [
  { path: "", icon: Flower2, title: "Cycle journal", text: "Period, symptoms, ovulation tests and temperature" },
  { path: "/readiness", icon: ListChecks, title: "Getting ready", text: "A checklist for each of you" },
  { path: "/appointments", icon: CalendarHeart, title: "Appointments", text: "Questions, tests and clinic notes" },
];

/** Journal and care entry to the planning screens; shown for planning and trying families only. */
export function FertilityLinkCard({ memberId }: { memberId: string }) {
  const base = `/family/${memberId}/care/fertility`;
  return (
    <section aria-labelledby="fertility-links" className="flex min-w-0 flex-col gap-2 rounded-3xl bg-leaf-soft p-5.5 md:rounded-[1.75rem] md:p-7">
      <h2 id="fertility-links" className="text-title">
        Planning your pregnancy
      </h2>
      <ul className="flex flex-col">
        {rows.map(({ path, icon: Icon, title, text }) => (
          <li key={path} className="border-t border-black/5 first:border-t-0">
            <Link href={base + path} className="press group flex min-h-14 items-center gap-3 py-2.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
              <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-card">
                <Icon className="size-4.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-label">{title}</span>
                <span className="block text-caption font-normal text-muted-foreground">{text}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 transition-transform duration-(--duration-base) ease-out group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      <p className="flex items-center gap-1.5 text-caption text-muted-foreground">
        <Lock className="size-3" aria-hidden />
        Private to you. Your partner sees only what you share.
      </p>
    </section>
  );
}
