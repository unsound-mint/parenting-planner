import type { Middleware } from "openapi-fetch";
import type { paths } from "@/lib/api/schema.gen";
import type { Family } from "@/lib/api/types";

// Preview mocks: while a backend endpoint still answers 501 Not Implemented,
// the web app renders typed demo data instead, so screens can be designed and
// reviewed before the Go handler exists. A real answer always wins: once the
// backend returns anything but 501, the mock is never used.
//
// On by default in development. Production shows mocks only when
// NEXT_PUBLIC_PREVIEW_MOCKS=1 is set at build time (decide before the freeze).

export const previewMocksEnabled =
  process.env.NEXT_PUBLIC_PREVIEW_MOCKS !== undefined
    ? process.env.NEXT_PUBLIC_PREVIEW_MOCKS === "1"
    : process.env.NODE_ENV !== "production";

type Method = "get" | "post" | "put" | "patch" | "delete";
type Json<C> = C extends { content: { "application/json": infer B } } ? B : never;
type SuccessBody<Op> = Op extends { responses: infer R }
  ? 200 extends keyof R
    ? Json<R[200]>
    : 201 extends keyof R
      ? Json<R[201]>
      : never
  : never;
type RequestBody<Op> = Op extends { requestBody?: { content: { "application/json": infer B } } } ? B : undefined;

export type MockContext<Op> = {
  path: Record<string, string>;
  query: Record<string, string>;
  body: RequestBody<Op>;
  /** The demo family of this session (real GET /family), for fixtures that need the ids of its people. */
  family: () => Promise<Family>;
};

type Status = 200 | 201 | 204;
type AnyMock = { status: Status; build: (ctx: MockContext<unknown>) => unknown | Promise<unknown> };
export type MockTable = Record<string, AnyMock>;

/**
 * One mock for one operation, typed against the generated contract:
 * mock("/members/{memberId}/passport", "get", (ctx) => ({ ... })).
 * The body must match the operation's 200 (or 201) JSON response.
 */
export function mock<P extends keyof paths, M extends Method & keyof paths[P]>(
  path: P,
  method: M,
  build: (ctx: MockContext<paths[P][M]>) => SuccessBody<paths[P][M]> | Promise<SuccessBody<paths[P][M]>>,
  status: Status = method === "post" ? 201 : 200,
): MockTable {
  return { [`${method.toUpperCase()} ${String(path)}`]: { status, build: build as AnyMock["build"] } };
}

export function mockMiddleware(table: MockTable): Middleware {
  // The request body is consumed once it is sent, so read it before that.
  const bodies = new WeakMap<Request, unknown>();
  return {
    async onRequest({ request }) {
      if (!previewMocksEnabled || request.method === "GET") return undefined;
      try {
        bodies.set(request, await request.clone().json());
      } catch {
        // No JSON body.
      }
      return undefined;
    },
    async onResponse({ request, response, schemaPath, params }) {
      if (!previewMocksEnabled || response.status !== 501) return undefined;
      const entry = table[`${request.method} ${schemaPath}`];
      if (!entry) return undefined;
      const body = bodies.get(request);
      const data = await entry.build({
        path: (params.path ?? {}) as Record<string, string>,
        query: Object.fromEntries(Object.entries(params.query ?? {}).map(([k, v]) => [k, String(v)])),
        body: body as never,
        family: async () => {
          const res = await fetch(new URL("/api/family", request.url), { headers: { cookie: request.headers.get("cookie") ?? "" }, cache: "no-store" });
          return (await res.json()) as Family;
        },
      });
      if (entry.status === 204) return new Response(null, { status: 204 });
      return new Response(JSON.stringify(data), {
        status: entry.status,
        headers: { "content-type": "application/json", "x-pp-preview-mock": "1" },
      });
    },
  };
}
