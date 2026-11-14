import "server-only";
import { cookies } from "next/headers";

// No login: the jury must be able to use the product without signing up.
// A cookie points the browser at its own demo family.
export const FAMILY_COOKIE = "family_id";

// Reading cookies makes the caller dynamic under Cache Components, so pages
// that call this must render it inside <Suspense>.
export async function getFamilyId(): Promise<string | null> {
  return (await cookies()).get(FAMILY_COOKIE)?.value ?? null;
}
