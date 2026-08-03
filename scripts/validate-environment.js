const { validateEnvironment } = require("../lib/refinement/ai/environment.js");

const requireAiProviders = process.argv.includes("--require-ai");
const result = validateEnvironment(process.env, { requireAiProviders });

for (const warning of result.warnings) console.warn(`Warning: ${warning}`);
for (const error of result.errors) console.error(`Environment error: ${error}`);

if (!result.valid) process.exitCode = 1;
else console.log("Environment validation passed.");
