#!/usr/bin/env node
// Generates src/styles/tokens.css (a Tailwind v4 theme) from design-system/tokens.json.
// Run `npm run tokens` after editing the tokens; `npm run tokens:check` fails when the CSS is stale.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("..", import.meta.url);
const SOURCE = fileURLToPath(new URL("design-system/tokens.json", root));
const TARGET = fileURLToPath(new URL("src/styles/tokens.css", root));

// next/font/local exposes each self-hosted face as a CSS variable (see src/app/fonts.ts).
const FONT_VARIABLES = { "Noto Serif": "--font-noto-serif", Carlito: "--font-carlito" };

const tokens = JSON.parse(readFileSync(SOURCE, "utf8"));
const themes = tokens.color.themes.map((t) => t.id);
const [firstTheme, ...otherThemes] = themes;

const valueFor = (value, theme) =>
  typeof value === "string" ? value : (value[theme] ?? value[firstTheme]);
const alias = (value) => {
  const m = /^\{(.+)\}$/.exec(value);
  return m ? `var(--color-${m[1]})` : value;
};

function themeBlock(theme) {
  const lines = [];
  for (const t of tokens.color.tokens)
    lines.push(`--color-${t.name}: ${alias(valueFor(t.value, theme))};`);
  for (const t of tokens.shadow.tokens)
    lines.push(`--shadow-${t.name.replace(/^shadow-/, "")}: ${valueFor(t.value, theme)};`);
  return lines;
}

function fontStack(stack) {
  const [first, ...rest] = stack.split(",").map((s) => s.trim());
  const name = first.replace(/^"|"$/g, "");
  const variable = FONT_VARIABLES[name];
  return variable ? [`var(${variable})`, ...rest].join(", ") : stack;
}

const out = [];
const indent = (lines, n = 2) => lines.map((l) => " ".repeat(n) + l);

out.push(
  "/* DineFlow — generated from design-system/tokens.json by scripts/build-tokens.mjs. Do not edit by hand. */",
);
out.push("");
out.push("@theme static {");
out.push("  /* Only DineFlow colours: the default Tailwind palette is switched off. */");
out.push("  --color-*: initial;");
out.push(...indent(themeBlock(firstTheme)));
out.push("");
for (const [key, stack] of Object.entries(tokens.type.families))
  out.push(`  --font-${key}: ${fontStack(stack)};`);
out.push("");
for (const group of tokens.type.groups) {
  for (const s of group.styles) {
    out.push(`  --text-${s.name}: ${s.fontSize};`);
    out.push(`  --text-${s.name}--line-height: ${s.lineHeight};`);
    out.push(`  --text-${s.name}--font-weight: ${s.fontWeight};`);
    if (s.letterSpacing) out.push(`  --text-${s.name}--letter-spacing: ${s.letterSpacing};`);
  }
}
out.push("");
for (const t of tokens.radius.tokens)
  out.push(`  --radius-${t.name.replace(/^radius-/, "")}: ${t.value};`);
out.push("");
// Tailwind's spacing unit is 4px, so p-1 … p-12 are space-1 … space-12.
out.push("  --spacing: 4px;");
for (const t of tokens.size.tokens) {
  if (t.name.startsWith("touch-")) out.push(`  --spacing-${t.name}: ${t.value};`);
  if (t.name === "content-max") out.push(`  --container-content: ${t.value};`);
}
out.push("}");
out.push("");

for (const theme of otherThemes) {
  const block = [...themeBlock(theme), "color-scheme: dark;"];
  out.push("@media (prefers-color-scheme: dark) {");
  out.push(`  :root:not([data-theme="${firstTheme}"]) {`);
  out.push(...indent(block, 4));
  out.push("  }");
  out.push("}");
  out.push("");
  out.push(`:root[data-theme="${theme}"] {`);
  out.push(...indent(block));
  out.push("}");
  out.push("");
}

const css = out.join("\n");

if (process.argv.includes("--check")) {
  let current = "";
  try {
    current = readFileSync(TARGET, "utf8");
  } catch {}
  if (current !== css) {
    console.error("src/styles/tokens.css is out of date. Run `npm run tokens`.");
    process.exit(1);
  }
  console.log("tokens.css is up to date.");
} else {
  writeFileSync(TARGET, css);
  console.log(`Wrote ${TARGET}`);
}
