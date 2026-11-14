import { isValidElement, type ReactNode } from "react";

// Turns the flat SVG illustrations into markup without react-dom/server, which
// Next refuses in the server layer. Only for hook-free trees made of function
// components and SVG tags, like components/illustrations/sizes.tsx and
// mascots.tsx. className and event props are dropped; camelCase props become
// kebab-case attributes (strokeWidth to stroke-width).

const kebab = (name: string) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const escape = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

export function staticSvg(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return escape(String(node));
  if (Array.isArray(node)) return node.map(staticSvg).join("");
  if (!isValidElement(node)) return "";
  const { type, props } = node as { type: unknown; props: Record<string, unknown> & { children?: ReactNode } };
  if (typeof type === "function") return staticSvg((type as (p: unknown) => ReactNode)(props));
  const { children, ...rest } = props;
  // A fragment: its type is a symbol.
  if (typeof type !== "string") return staticSvg(children);
  const attrs = Object.entries(rest)
    .filter(([k, v]) => k !== "className" && !k.startsWith("on") && v != null && v !== false)
    .map(([k, v]) => ` ${kebab(k)}="${escape(String(v))}"`)
    .join("");
  const inner = staticSvg(children);
  return inner ? `<${type}${attrs}>${inner}</${type}>` : `<${type}${attrs}/>`;
}
