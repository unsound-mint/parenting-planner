import { Sprout, type LucideIcon } from "lucide-react";
import type { DemoTemplate } from "@/lib/api/types";

// Families a visitor can start. One line per template that the API seeds;
// add an entry here when a new template lands (never list one that does not exist).
export type FamilyOption = {
  template: DemoTemplate;
  title: string;
  detail: string;
  icon: LucideIcon;
};

export const familyOptions: FamilyOption[] = [
  {
    template: "pregnancy",
    title: "Emily, 25 weeks pregnant",
    detail: "With her partner Jake. Second trimester.",
    icon: Sprout,
  },
];
