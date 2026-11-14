import { StartDemo } from "@/components/start-demo";
import { familyOptions } from "./templates";

// One card per template that exists. The first card carries the primary action.
export function FamilyPicker() {
  return (
    <ul className="flex flex-col gap-3">
      {familyOptions.map((f, i) => (
        <li
          key={f.template}
          className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card p-4"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
            <f.icon aria-hidden className="size-6" />
          </span>
          <div className="min-w-0 flex-1 basis-40">
            <p className="text-title">{f.title}</p>
            <p className="text-label font-normal text-muted-foreground">{f.detail}</p>
          </div>
          <StartDemo template={f.template} label="Start the demo" primary={i === 0} />
        </li>
      ))}
    </ul>
  );
}
