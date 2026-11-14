import { cn } from "@/lib/utils";

// The page frame for every family screen (docs/design.md, "Layout"). The
// family layout caps the width once (max-w-page) for the header and the page
// together, so a page never sets its own max-w on the wrapper. Inside, pages
// put independent cards in a PageGrid and keep long text at a reading measure.

/** The page's <main>: padding that matches the header, and a vertical rhythm of 24 px between groups. */
export function PageFrame({ className, ...props }: React.ComponentProps<"main">) {
  return <main className={cn("flex min-w-0 flex-1 flex-col gap-6 px-4 pt-6 pb-16 md:px-8", className)} {...props} />;
}

/**
 * Independent cards side by side: one column on phones, two from lg, three from
 * 2xl when cols is 3. Children keep their DOM order, which is the phone order;
 * a child that should span or start a column says so with its own lg:/2xl: classes.
 */
export function PageGrid({ cols = 2, className, ...props }: React.ComponentProps<"div"> & { cols?: 2 | 3 }) {
  return <div className={cn("grid min-w-0 items-start gap-6 lg:grid-cols-2", cols === 3 && "2xl:grid-cols-3", className)} {...props} />;
}

/** A column of cards inside a PageGrid cell, with the same 24 px gap. */
export function Stack({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex min-w-0 flex-col gap-6", className)} {...props} />;
}
