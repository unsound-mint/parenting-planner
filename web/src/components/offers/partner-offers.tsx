"use client";

import { ExternalLink } from "lucide-react";
import { api } from "@/lib/api/client";
import type { PartnerOffer } from "@/lib/api/types";

// Up to three offers, quiet and clearly labelled. Never place this inside
// health guidance or the crisis path. A click is counted for analytics; the
// link still opens if the count fails.
export function PartnerOffers({ memberId, offers }: { memberId: string; offers: PartnerOffer[] }) {
  if (offers.length === 0) return null;
  return (
    <section aria-label="Partner offers" className="mt-8">
      <ul className="grid gap-3 md:grid-cols-3">
        {offers.map((o) => (
          <li key={o.id} className="flex flex-col gap-1 rounded-2xl border border-dashed border-border bg-muted/40 p-4">
            <p className="text-caption font-medium tracking-wide text-muted-foreground">Partner offer · {o.partnerName}</p>
            <p className="text-title">{o.title}</p>
            <p className="text-label font-normal text-muted-foreground">{o.detail}</p>
            <a
              href={o.url}
              target="_blank"
              rel="sponsored noopener noreferrer"
              onClick={() => void api.POST("/members/{memberId}/partner-offers/{offerId}/clicks", { params: { path: { memberId, offerId: o.id } } }).catch(() => undefined)}
              className="mt-auto inline-flex min-h-11 items-center gap-1.5 pt-2 text-label font-semibold text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground md:min-h-9"
            >
              See the offer
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
