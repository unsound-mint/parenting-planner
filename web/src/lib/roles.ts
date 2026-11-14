import type { Caregiver, Family, Parent } from "@/lib/api/types";

// The people in a family and what each may open. The API returns who exists
// (parents and caregivers); a role the API does not return never shows up.
// Permissions match the CaregiverRole description in api/openapi.yaml: a
// grandparent or nanny sees the baby's care, never a parent's health data.
// This only decides what the web app shows; the API must enforce it too.

export type Role = Parent["role"] | Caregiver["role"];
export type Person = { id: string; role: Role; displayName: string };

/** First path segment under /family/<id>: "" is the home screen. */
export type Screen = "" | "journey" | "plan";

const screens: Record<Role, readonly Screen[]> = {
  mother: ["", "journey", "plan"],
  partner: ["", "journey", "plan"],
  grandparent: [""],
  nanny: [""],
};

export function canOpen(role: Role, screen: string): boolean {
  return (screens[role] as readonly string[]).includes(screen);
}

export function isCaregiver(role: Role): role is Caregiver["role"] {
  return role === "grandparent" || role === "nanny";
}

/**
 * Everyone in the family, in switcher order: mom, partner, then caregivers.
 * caregivers is optional here so an API that predates it still renders.
 */
export function familyPeople(family: Pick<Family, "parents"> & Partial<Pick<Family, "caregivers">>): Person[] {
  const order: Role[] = ["mother", "partner", "grandparent", "nanny"];
  const all: Person[] = [...family.parents, ...(family.caregivers ?? [])];
  return all.sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role));
}

/** The same screen for another person, or their home when they may not open it. */
export function pathFor(person: Person, screen: string): string {
  const base = `/family/${person.id}`;
  return screen && canOpen(person.role, screen) ? `${base}/${screen}` : base;
}
