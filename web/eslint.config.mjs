import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // The configured cn in src/lib/utils.ts knows our type scale; the bare one
    // drops sizes like text-caption when a colour is also set.
    ignores: ["src/lib/utils.ts"],
    rules: {
      "no-restricted-imports": ["error", { paths: [{ name: "cn", message: 'Import cn from "@/lib/utils".' }] }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
