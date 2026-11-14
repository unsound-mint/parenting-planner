import type { components } from "@/lib/api/schema.gen";

type S = components["schemas"];

/** Passport names for the vaccine keys the rules read (VaccineDose.name uses the same words). */
export const vaccineName: Record<S["VaccineKey"], string> = {
  tdap: "Tdap",
  td: "Td",
  flu: "Flu",
  covid19: "COVID-19",
  rsv: "RSV",
  hepb: "Hepatitis B",
  hepa: "Hepatitis A",
  dtap: "DTaP",
  mmr: "MMR",
  varicella: "Varicella",
  hib: "Hib",
  pcv: "Pneumococcal",
  ipv: "Polio",
  rotavirus: "Rotavirus",
};

export const screeningName: Record<S["ScreeningKind"], string> = {
  glucose_screen: "Glucose screening",
  gbs: "GBS test",
  vision_screen: "Vision screening",
};

/** The key behind a passport vaccine name, when it is one of the keys the API accepts. */
export function vaccineKey(name: string): S["VaccineKey"] | undefined {
  const n = name.toLowerCase();
  return (Object.keys(vaccineName) as S["VaccineKey"][]).find((k) => k === n || vaccineName[k].toLowerCase() === n);
}
