"use client";

import type { PartnerOffer } from "@/lib/api/types";

// Up to three offers, quiet and clearly labelled. Never place this inside
// health guidance or the crisis path. The partners are invented, so the card
// carries no outbound link (the API still stores a url; it is not rendered).
export function PartnerOffers({ offers }: { offers: PartnerOffer[] }) {
  if (offers.length === 0) return null;
  return (
    <section aria-label="Partner offers" className="mt-8">
      <ul className="grid gap-3 md:grid-cols-3">
        {offers.map((o) => (
          <li key={o.id} className="flex flex-col gap-1 rounded-2xl border border-dashed border-border bg-muted/40 p-4">
            <p className="text-caption font-medium tracking-wide text-muted-foreground">Sample partner offer · {o.partnerName}</p>
            <p className="text-title">{o.title}</p>
            <p className="text-label font-normal text-muted-foreground">{o.detail}</p>
            <p className="mt-auto pt-2 text-caption text-muted-foreground">Sample offer for the demo. Nothing to buy and no link.</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
