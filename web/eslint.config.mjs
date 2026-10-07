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
    files: ["app/**/*.tsx", "app/**/*.ts", "components/**/*.tsx"],

    rules: {
        "no-restricted-imports": "off",
    },
}]);