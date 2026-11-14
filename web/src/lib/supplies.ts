import { Baby, Droplets, Milk, Package, Pill, Shirt, type LucideIcon } from "lucide-react";
import type { SupplyCategory, SupplyItem } from "@/lib/api/types";

export const supplyIcon: Record<SupplyCategory, LucideIcon> = {
  diapers: Baby,
  wipes: Droplets,
  formula: Milk,
  medicine: Pill,
  clothing: Shirt,
  other: Package,
};

export const supplyCategoryLabel: Record<SupplyCategory, string> = {
  diapers: "Diapers",
  wipes: "Wipes",
  formula: "Formula",
  medicine: "Medicine",
  clothing: "Clothing",
  other: "Other",
};

// One tap adds a starter item with sensible defaults. Medicines carry no dose:
// dosing is for the pediatrician or pharmacist.
export type Starter = { name: string; category: SupplyCategory; quantity: number; unit: string; lowAt: number; perUse?: number };
export const starters: Starter[] = [
  { name: "Diapers", category: "diapers", quantity: 40, unit: "diapers", lowAt: 12 },
  { name: "Wipes", category: "wipes", quantity: 120, unit: "wipes", lowAt: 40, perUse: 3 },
  { name: "Formula", category: "formula", quantity: 8, unit: "bottles", lowAt: 3 },
  { name: "Vitamin D drops", category: "medicine", quantity: 1, unit: "bottle", lowAt: 0 },
  { name: "Diaper cream", category: "medicine", quantity: 1, unit: "tube", lowAt: 0 },
  { name: "Onesies", category: "clothing", quantity: 6, unit: "pcs", lowAt: 0 },
];

/** The body of a full update that changes only the quantity. */
export function withQuantity(item: SupplyItem, quantity: number) {
  return {
    name: item.name,
    category: item.category,
    quantity,
    unit: item.unit,
    lowAt: item.lowAt,
    perUse: item.perUse,
    ...(item.size ? { size: item.size } : {}),
    ...(item.expiresOn ? { expiresOn: item.expiresOn } : {}),
  };
}

/** "about 3 days", "about a day", "less than a day". */
export function daysWords(days: number): string {
  if (days <= 0) return "less than a day";
  if (days === 1) return "about a day";
  return `about ${days} days`;
}
