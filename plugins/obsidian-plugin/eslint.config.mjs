import tsparser from "@typescript-eslint/parser";
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";
import { DEFAULT_BRANDS } from "eslint-plugin-obsidianmd/dist/lib/rules/ui/brands.js";
import globals from "globals";

export default defineConfig([
  {
    ignores: ["tests/**", "node_modules/**", "main.js"],
  },
  ...obsidianmd.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: { project: "./tsconfig.json" },
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      "obsidianmd/ui/sentence-case": [
        "error",
        { brands: [...DEFAULT_BRANDS, "Atomic"] },
      ],
    },
  },
]);
