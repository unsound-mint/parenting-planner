import createClient from "openapi-fetch";
import type { paths } from "./schema.gen";

// Browser-side client. Requests go to /api on the same origin: Caddy routes
// them to the Go API in production, next.config.ts rewrites them in dev.
export const api = createClient<paths>({ baseUrl: "/api" });
