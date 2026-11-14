import Link from "next/link";
import { Suspense } from "react";
import { Phone } from "lucide-react";
import { serverApi } from "@/lib/api/server";
import { GuideList } from "@/components/today/guide-list";
import { UndoLoss } from "./undo-loss";

// Parents only, while Family.pregnancyLoss is set: the loss_support guides
// from the API (their wording and sources are the content catalog's, never the
// web's), the fixed help screen for someone to talk to, and the undo. Never
// render this for a grandparent or nanny.
export function LossSupport({ memberId }: { memberId: string }) {
  return (
    <Suspense fallback={null}>
      <LossSupportLoader memberId={memberId} />
    </Suspense>
  );
}

async function LossSupportLoader({ memberId }: { memberId: string }) {
  const api = await serverApi();
  const { data } = await api.GET("/members/{memberId}/guides", { params: { path: { memberId }, query: { kind: "loss_support" } } });
  return (
    <GuideList
      title="Support for the days ahead"
      guides={data?.items ?? []}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            href="/help"
            className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-label font-medium text-foreground transition-colors duration-150 hover:bg-muted md:min-h-9"
          >
            <Phone aria-hidden className="size-4 text-muted-foreground" />
            Someone to talk to, any time
          </Link>
          <UndoLoss memberId={memberId} />
        </div>
      }
    />
  );
}
