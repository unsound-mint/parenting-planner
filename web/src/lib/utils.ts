import { createCn } from "cn/config";

// Our type scale (globals.css, --text-*) must merge as font sizes. Without
// this, cn("text-caption", "text-status-due") treats both as colours and
// drops one. Import cn from here, never from "cn" directly.
export const cn = createCn({
  extend: { classGroups: { "font-size": [{ text: ["display", "headline", "title", "body", "label", "caption"] }] } },
});
