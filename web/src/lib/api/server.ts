import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import createClient from "openapi-fetch";
import type { paths } from "./schema.gen";

const API_URL = process.env.API_INTERNAL_URL ?? "http://localhost:8091";

// Server-side client for server components. Forwards the visitor's cookies so
// the API resolves their session. Reading cookies makes the caller dynamic,
// so render it inside <Suspense>.
export async function serverApi() {
  // API data is per visitor and changes on every request; never prerender it.
  await connection();
  const cookie = (await cookies()).toString();
  return createClient<paths>({
    baseUrl: `${API_URL}/api`,
    headers: cookie ? { cookie } : undefined,
    cache: "no-store",
  });
}
