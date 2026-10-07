import { defineConfig } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig([{
    ignores: [".next/**", "node_modules/**", "next-env.d.ts", "tsconfig.tsbuildinfo"],
}, {
    extends: [...nextCoreWebVitals],

    rules: {
        "@typescript-eslint/no-explicit-any": "off",
        // React Compiler rules new in eslint-config-next 16. Existing effects are
        // refactored screen by screen in the design-system migration (Plan 29).
        "react-hooks/set-state-in-effect": "warn",
        "react-hooks/immutability": "warn",

        "no-restricted-imports": ["error", {
            paths: [{
                name: "@/lib/supabase",
                message: "Browser-only client. Use '@/lib/supabase-server' in API routes and Server Components.",
            }],
        }],
    },
}, {
    // Design system guardrail (Plan 29): colors come from tokens in globals.css.
    files: ["app/**/*.tsx", "components/**/*.tsx"],
    ignores: [
      "components/ui/**",          // vendored shadcn primitives
      "components/*Chart*.tsx",    // charts may set series colors
      "components/*Map*.tsx",
      "app/opengraph-image.tsx",
      "app/**/opengraph-image.tsx",
    ],
    rules: {
      "no-restricted-syntax": ["warn",
        {
          selector: "JSXAttribute[name.name='style'] > JSXExpressionContainer > ObjectExpression",
          message: "Use Tailwind utilities and design tokens instead of inline style objects.",
        },
        {
          selector: "Literal[value=/#[0-9a-fA-F]{3,8}\\b/]",
          message: "No hex colors in components; use a token (bg-primary, text-muted-foreground, ...).",
        },
        {
          selector: "TemplateElement[value.raw=/#[0-9a-fA-F]{3,8}\\b/]",
          message: "No hex colors in components; use a token.",
        },
      ],
    },
}, {
    files: ["app/**/*.tsx", "app/**/*.ts", "components/**/*.tsx"],

    rules: {
        "no-restricted-imports": "off",
    },
}]);