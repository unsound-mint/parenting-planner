import createClient from "openapi-fetch";
import type { paths } from "./schema.gen";
import { previewMocks } from "@/lib/mock";

// Browser-side client. Requests go to /api on the same origin: Caddy routes
// them to the Go API in production, next.config.ts rewrites them in dev.
export const api = createClient<paths>({ baseUrl: "/api" });
api.use(previewMocks);

/** True when the answer came from a preview mock (the endpoint still returns 501), so nothing was stored. */
export const isPreviewMock = (response: Response) => response.headers.get("x-pp-preview-mock") === "1";
