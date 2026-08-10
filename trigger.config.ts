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
    extensions: [prismaExtension({ mode: "legacy", schema: "prisma/schema.prisma" })],
  },
  maxDuration: 300,
});
