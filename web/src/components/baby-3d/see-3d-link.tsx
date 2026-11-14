"use client";

import Link from "next/link";
import { Rotate3d } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The entry to the 3D baby, for the This week hero:
 * <See3DLink memberId={memberId} week={week} />. It opens the given week, and
 * starts loading the 3D code when the pointer or focus reaches the link, so
 * the view is ready by the time the page opens.
 */
export function See3DLink({ memberId, week, className }: { memberId: string; week: number; className?: string }) {
  const warm = () => void import("./scene");
  return (
    <Link
      href={`/family/${memberId}/baby-3d?week=${week}`}
      onPointerEnter={warm}
      onFocus={warm}
      className={cn(
        "inline-flex h-11 items-center gap-2 rounded-full bg-card/90 px-4 text-label font-semibold text-[#A04828] shadow-[0_1px_0_#EDE3D3] transition-[transform,background-color] duration-150 ease-out hover:bg-card active:scale-[0.97]",
        className,
      )}
    >
      <Rotate3d className="size-4" aria-hidden />
      See your baby in 3D
    </Link>
  );
}
