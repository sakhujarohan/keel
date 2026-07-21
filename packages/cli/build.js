import { build } from "esbuild";

await build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  banner: {
    js: `import { createRequire } from 'module';
const require = createRequire(import.meta.url);
`,
  },
  outfile: "dist/main.js",
});
