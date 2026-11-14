import { Activity, Baby, Bone, Brain, Droplets, Ear, Eye, Feather, Footprints, Hand, Heart, Link2, Milk, Soup, Sprout, Wind, type LucideIcon } from "lucide-react";
import type { Area } from "./model";

// One icon and one label per hotspot area. Record<Area, ...> makes a new area in
// the contract a type error here until it has both (and an anchor in model.ts).
export const AREA_ICON: Record<Area, LucideIcon> = {
  brain: Brain,
  face: Baby,
  eyes: Eye,
  ears: Ear,
  mouth: Milk,
  heart: Heart,
  lungs: Wind,
  tummy: Soup,
  kidneys: Droplets,
  hands: Hand,
  legs: Footprints,
  skin: Feather,
  bones: Bone,
  movement: Activity,
  body: Sprout,
  cord: Link2,
};

export const AREA_LABEL: Record<Area, string> = {
  brain: "Brain",
  face: "Face",
  eyes: "Eyes",
  ears: "Ears and hearing",
  mouth: "Mouth",
  heart: "Heart",
  lungs: "Lungs",
  tummy: "Tummy",
  kidneys: "Kidneys",
  hands: "Arms and hands",
  legs: "Legs",
  skin: "Skin",
  bones: "Bones",
  movement: "Movement",
  body: "Growing",
  cord: "Cord and placenta",
};
