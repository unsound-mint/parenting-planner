// Plain helpers shared by the server page and the client islands.

/** "Dr. Maya Ellison (demo)" without the bracket. */
export const cleanName = (name: string) => name.replace(/\s*\(.*\)\s*$/, "").trim();

/** "Dr. Maya Ellison (demo)" reads as "Dr. Ellison" in buttons and chips. */
export function shortName(name: string): string {
  const parts = cleanName(name).split(/\s+/);
  return /^dr\.?$/i.test(parts[0]) && parts.length > 1 ? `Dr. ${parts.at(-1)}` : parts[0];
}
