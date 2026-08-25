import { defineConfig } from "@trigger.dev/sdk";
import { prismaExtension } from "@trigger.dev/build/extensions/prisma";

export default defineConfig({
  project: "proj_ixdmfhoziibhqkwvfqni",
  dirs: ["./trigger"],
  machine: "small-1x",
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      factor: 2,
      minTimeoutInMs: 1_000,
      maxTimeoutInMs: 10_000,
      randomize: true,
    },
  },
  build: {
    // pdfjs-dist must be a real dependency in the deployed image, not bundled:
    // lib/refinement/pdf/searchable-pdf.js resolves pdf.worker.mjs through
    // Node module resolution (import.meta.resolve) at runtime, which only
    // works when node_modules/pdfjs-dist actually exists on disk. Bundling it
    // made every deployed text-extraction run fail with "Failed to resolve
    // module pdfjs-dist/..." while dev mode kept working, because dev runs
    // next to the project's real node_modules.
    external: ["pdfjs-dist"],
    extensions: [prismaExtension({ mode: "legacy", schema: "prisma/schema.prisma" })],
  },
  maxDuration: 300,
});
