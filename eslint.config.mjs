import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // The reskin backend lives here as its own self-contained project (its own
    // package.json / tsconfig / lint). The frontend's lint + tsc must NOT scan it.
    "server/**",
  ]),
  // Override React Compiler rules - these are experimental and overly strict
  // for common React patterns like URL sync and data fetching
  {
    rules: {
      // setState in effects is sometimes necessary for:
      // - URL parameter synchronization
      // - Data fetching responses
      // - External event handlers
      "react-hooks/set-state-in-effect": "warn",

      // The refs rule has false positives with hook return values
      // that return primitive values (not actual refs)
      "react-hooks/refs": "warn",

      // Preserve manual memoization can conflict with existing patterns
      "react-hooks/preserve-manual-memoization": "warn",
    },
  },
]);

export default eslintConfig;
