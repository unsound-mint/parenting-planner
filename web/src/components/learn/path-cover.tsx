import { cn } from "@/lib/utils";

// Flat cover art for each learning path, in the comp's style: a soft sky, a sun
// or moon, two hills and one small motif. The contract has no cover field, so
// covers are keyed by path slug with a warm fallback for any new path.
// Art colours live in the SVG (docs/design.md, Tokens: illustrations are the exception).

type Art = { mark: string; sky: string; orb: string; halo: string; far: string; near: string; motif: "birds" | "drops" | "stars" | "hearts" | "sprouts" | "house" };

const ART: Record<string, Art> = {
  "your-pregnancy": { mark: "#E6EFDC", sky: "#FDF0DF", orb: "#F4CD6A", halo: "#F8D9A6", far: "#E6EFDC", near: "#3F6B37", motif: "sprouts" },
  birth: { mark: "#F4CD6A", sky: "#FDF0DF", orb: "#F4CD6A", halo: "#F8D9A6", far: "#E8A07C", near: "#A84E2C", motif: "birds" },
  feeding: { mark: "#F7CB92", sky: "#FCEFE0", orb: "#F7CB92", halo: "#FAE3D5", far: "#F7CB92", near: "#4F7F45", motif: "drops" },
  "first-weeks": { mark: "#CBD3DA", sky: "#E9EEF1", orb: "#F3E0A6", halo: "#F6EBC8", far: "#CBD3DA", near: "#1D6A70", motif: "stars" },
  couple: { mark: "#FAE3D5", sky: "#FBEDE4", orb: "#E8A07C", halo: "#FAE3D5", far: "#F3D3C0", near: "#A04828", motif: "hearts" },
  partner: { mark: "#D8EDEB", sky: "#E8F3F1", orb: "#F4CD6A", halo: "#F6E6B5", far: "#7DBAB6", near: "#1D6A70", motif: "birds" },
  "money-leave": { mark: "#F3E0A6", sky: "#FAF2DC", orb: "#F4CD6A", halo: "#F6E6B5", far: "#F3E0A6", near: "#8A6414", motif: "house" },
  "mental-health": { mark: "#CFE0C3", sky: "#EEF4E8", orb: "#F4CD6A", halo: "#F6E6B5", far: "#CFE0C3", near: "#3F6B37", motif: "sprouts" },
};
const FALLBACK = ART.birth;

export const pathArt = (pathId: string): Art => ART[pathId] ?? FALLBACK;

function Motif({ kind, color }: { kind: Art["motif"]; color: string }) {
  switch (kind) {
    case "birds":
      return (
        <g fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" opacity=".5">
          <path d="M150 52c8-8 16-8 24 0 8-8 16-8 24 0" />
          <path d="M230 34c6-6 12-6 18 0 6-6 12-6 18 0" />
        </g>
      );
    case "drops":
      return (
        <g fill={color} opacity=".45">
          <path d="M170 40c8 12 12 18 12 24a12 12 0 0 1-24 0c0-6 4-12 12-24z" />
          <path d="M228 64c6 9 9 13 9 18a9 9 0 0 1-18 0c0-5 3-9 9-18z" />
        </g>
      );
    case "stars":
      return (
        <g fill={color} opacity=".55">
          <path d="M160 40l4 9 9 4-9 4-4 9-4-9-9-4 9-4z" />
          <path d="M236 70l3 6 6 3-6 3-3 6-3-6-6-3 6-3z" />
          <circle cx="300" cy="36" r="3" />
          <circle cx="118" cy="84" r="2.5" />
        </g>
      );
    case "hearts":
      return (
        <g fill={color} opacity=".5">
          <path d="M170 70c-14-10-20-18-20-26a10 10 0 0 1 20-3 10 10 0 0 1 20 3c0 8-6 16-20 26z" />
          <path d="M236 46c-9-7-13-12-13-17a7 7 0 0 1 13-2 7 7 0 0 1 13 2c0 5-4 10-13 17z" />
        </g>
      );
    case "sprouts":
      return (
        <g fill={color} opacity=".5">
          <path d="M180 100c0-20 0-34 0-44M180 70c-14-2-22-10-24-22 14 0 22 8 24 22zM180 62c12-4 20-12 20-26-12 2-20 10-20 26z" stroke={color} strokeWidth="3" strokeLinecap="round" />
        </g>
      );
    case "house":
      return (
        <g fill={color} opacity=".5">
          <path d="M160 96V70l22-18 22 18v26h-14V80h-16v16z" />
        </g>
      );
  }
}

/** The path's cover: a wide band on the hero (190 px tall at desktop). Decorative. */
export function PathCover({ pathId, className }: { pathId: string; className?: string }) {
  const a = pathArt(pathId);
  return (
    <svg viewBox="0 0 900 190" preserveAspectRatio="xMidYMax slice" aria-hidden className={cn("block h-32 w-full md:h-47.5", className)}>
      <rect width="900" height="190" fill={a.sky} />
      <circle cx="640" cy="120" r="70" fill={a.halo} />
      <circle cx="640" cy="120" r="46" fill={a.orb} />
      {a.motif === "stars" && <circle cx="660" cy="104" r="40" fill={a.sky} />}
      <path d="M0 150c120-50 240-60 380-30s260 40 520-20v90H0z" fill={a.far} opacity=".55" />
      <path d="M0 168c160-30 300-34 460-10s300 20 440-10v42H0z" fill={a.near} opacity=".75" />
      <Motif kind={a.motif} color={a.near} />
    </svg>
  );
}

const BLOB = "M32 4c11 0 21 6 25 15s3 21-3 29-17 12-27 11S8 53 5 44 3 24 9 15 21 4 32 4z";

/** The small mark in the path list: a soft blob in the path's colour with a dot, turned a little per path. */
export function PathMark({ pathId, turn = 0, className }: { pathId: string; turn?: number; className?: string }) {
  const a = pathArt(pathId);
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={cn("size-11 shrink-0", className)}>
      <path d={BLOB} fill={a.mark} transform={`rotate(${turn * 40} 32 32)`} />
      <circle cx="32" cy="32" r="7" fill={a.near} />
    </svg>
  );
}
