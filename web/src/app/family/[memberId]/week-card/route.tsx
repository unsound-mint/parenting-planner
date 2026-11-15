import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { serverApi } from "@/lib/api/server";
import type { Stage } from "@/lib/api/types";
import { MASCOT_SHAPES, STAGE_SHAPE } from "@/components/illustrations/mascots";
import { resolveSize } from "@/components/illustrations/size-map";
import { SHAPES } from "@/components/illustrations/sizes";
import { PRODUCT_NAME } from "@/lib/product";
import { cleanNickname } from "@/lib/share";
import { staticSvg } from "@/lib/static-svg";

// The shareable week card: a 1080x1080 PNG of this week's fruit (pregnancy) or
// stage mascot, with the week's headline. No photo, no names, no dates; the
// only extra is a nickname the sharer typed (?nickname=). It is built from the
// acting parent's own data, so it is never cached: the response is private and
// the handler reads cookies through serverApi (never "use cache").
//
// Fonts are the app's own (Fraunces, Figtree, JetBrains Mono), static latin
// cuts from Fontsource under the SIL OFL (licences beside the files in
// assets/share-card). Satori reads ttf, otf and woff, not the woff2 next/font
// serves. next.config.ts lists the folder in outputFileTracingIncludes so the
// standalone image ships it.
const fontFile = (name: string) => readFile(join(process.cwd(), "assets/share-card", name));
const fonts = Promise.all([
  fontFile("fraunces-latin-600-normal.woff"),
  fontFile("figtree-latin-500-normal.woff"),
  fontFile("jetbrains-mono-latin-400-normal.woff"),
]);

// Tokens from globals.css, as plain values: Satori has no CSS variables.
const C = { paper: "#FBF7F0", sun: "#FCEBD5", ink: "#2B2620", muted: "#6B6157", mom: "#A04828", line: "#EDE3D3" };

const noStore = { "Cache-Control": "private, no-store" };

type Params = { params: Promise<{ memberId: string }> };

export async function GET(request: Request, { params }: Params) {
  const { memberId } = await params;
  const api = await serverApi();
  const { data: family, response } = await api.GET("/family");
  if (response.status === 401) return new Response("Start a demo first", { status: 401, headers: noStore });
  const person = family && [...family.parents, ...family.caregivers].find((p) => p.id === memberId);
  if (!family || !person) return new Response("Not found", { status: 404, headers: noStore });
  // Caregivers do not share the family's card; the postcard is their surface.
  if (!family.parents.some((p) => p.id === memberId)) return new Response("Only parents share this card", { status: 403, headers: noStore });

  const nickname = cleanNickname(new URL(request.url).searchParams.get("nickname"));
  const path = { params: { path: { memberId } } };
  let eyebrow = "";
  let headline = "";
  let art: React.ReactNode;

  if (family.stage === "pregnancy" && family.gestationalWeek != null) {
    const week = Math.min(Math.max(family.gestationalWeek, 4), 40);
    const { data } = await api.GET("/members/{memberId}/pregnancy-weeks/{week}", { params: { path: { memberId, week } } });
    if (!data?.size) return new Response("No card for this week", { status: 409, headers: noStore });
    const { shape, variant } = resolveSize(data.size.comparison);
    art = SHAPES[shape](variant);
    eyebrow = `Week ${week}`;
    headline = `About the size of ${data.size.comparison}`;
  } else if (family.stage !== "pregnancy") {
    const { data } = await api.GET("/members/{memberId}/now", path);
    if (!data) return new Response("No card for this stage", { status: 409, headers: noStore });
    const Shape = MASCOT_SHAPES[STAGE_SHAPE[family.stage as Stage]];
    art = <Shape />;
    headline = data.headline;
  } else {
    return new Response("No card yet", { status: 409, headers: noStore });
  }

  // Satori draws inline SVG as an image; the shared illustration is turned into markup once.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 30 300 230" width="780" height="598">${staticSvg(art)}</svg>`;
  const picture = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  const [fraunces, figtree, mono] = await fonts;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", padding: 48, background: C.paper, fontFamily: "Figtree" }}>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "52px 56px 40px",
            borderRadius: 64,
            background: C.sun,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            {eyebrow && <div style={{ fontSize: 34, letterSpacing: 7, textTransform: "uppercase", color: C.mom, marginBottom: 14 }}>{eyebrow}</div>}
            <div style={{ fontFamily: "Fraunces", fontSize: eyebrow ? 78 : 66, lineHeight: 1.08, textAlign: "center", color: C.ink, maxWidth: 880, textWrap: "balance" }}>{headline}</div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element -- Satori draws a plain img, not next/image */}
          <img src={picture} width={780} height={598} alt="" />
          <div style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between", fontSize: 26, color: C.muted }}>
            <div style={{ display: "flex" }} />
            <div style={{ display: "flex", color: C.ink }}>{nickname ? `For ${nickname}` : PRODUCT_NAME}</div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1080,
      headers: noStore,
      fonts: [
        { name: "Fraunces", data: fraunces, weight: 600, style: "normal" },
        { name: "Figtree", data: figtree, weight: 500, style: "normal" },
        { name: "JetBrains Mono", data: mono, weight: 400, style: "normal" },
      ],
    },
  );
}
