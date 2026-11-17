import { readFileSync, writeFileSync } from "node:fs";
import { defineConfig, type Options } from "tsup";
import type { Plugin } from "esbuild";

// `src/page/motion.tsx` is the renderer's only client component. It is built
// as its own file and imported from the main bundle, not inlined into it, so
// its "use client" directive marks just that boundary and `MentraPage` stays
// usable from a React Server Component. esbuild drops module directives when
// it bundles, so the directive is written back after the build.
const CLIENT_OUTPUTS = ["dist/motion.js", "dist/motion.cjs"];

const clientBoundary: Plugin = {
  name: "client-boundary",
  setup(build) {
    const ext = build.initialOptions.format === "cjs" ? "cjs" : "js";
    build.onResolve({ filter: /^\.\/motion$/ }, (args) =>
      args.importer.endsWith("blocks.tsx") ? { path: `./motion.${ext}`, external: true } : undefined,
    );
  },
};

export default defineConfig((): Options => ({
  entry: { index: "src/index.ts", motion: "src/page/motion.tsx" },
  format: ["esm", "cjs"],
  dts: { entry: { index: "src/index.ts" } },
  sourcemap: true,
  clean: true,
  external: ["react", "react-dom"],
  // No shared chunks: the client component must live only in motion.*.
  splitting: false,
  esbuildPlugins: [clientBoundary],
  onSuccess: async () => {
    for (const file of CLIENT_OUTPUTS) {
      const code = readFileSync(file, "utf8");
      if (!/^(?:"use strict";\s*)?"use client";/.test(code)) writeFileSync(file, `"use client";\n${code}`);
    }
    writeFileSync("dist/mentra-content.css", readFileSync("src/mentra-content.css"));
  },
}));
