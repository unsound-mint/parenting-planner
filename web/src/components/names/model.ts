import { Heart, Layers, ListChecks, Trophy, type LucideIcon } from "lucide-react";
import type { NameCard, NamesQuest, NameSex, NameVerdict } from "@/lib/api/types";

// Shared words and numbers for the names quest screens.

export const stageInfo: Record<NamesQuest["stages"][number]["id"], { icon: LucideIcon; label: string }> = {
  lists: { icon: ListChecks, label: "Pick lists" },
  swipe: { icon: Layers, label: "Swipe 30" },
  matches: { icon: Heart, label: "5 matches" },
  final: { icon: Trophy, label: "Final round" },
};

export const verdictLabel: Record<NameVerdict, string> = { love: "Love", maybe: "Maybe", no: "Not for us" };

export const sexLabel: Record<NameSex, string> = { girl: "Girl", boy: "Boy", neutral: "Either" };

/** Rare vs popular, as US babies given the name in the latest SSA year. */
export const popularity = {
  any: { label: "Any", min: undefined, max: undefined },
  rare: { label: "Rare", min: undefined, max: 999 },
  popular: { label: "Popular", min: 5000, max: undefined },
} as const;
export type Popularity = keyof typeof popularity;

export const fmt = (n: number) => n.toLocaleString("en-US");

/** "#101 for girls" or "#12 for boys"; a neutral name's rank is its better one. */
export function rankWords(card: NameCard): string | undefined {
  const rank = card.popularity?.rank;
  if (!rank) return undefined;
  return card.sex === "girl" ? `#${fmt(rank)} for girls` : card.sex === "boy" ? `#${fmt(rank)} for boys` : `#${fmt(rank)} in the US`;
}

export function listTitles(card: NameCard, quest: Pick<NamesQuest, "lists">): string[] {
  return card.lists.map((id) => quest.lists.find((l) => l.id === id)?.title ?? id);
}
