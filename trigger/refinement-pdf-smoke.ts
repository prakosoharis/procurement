import { task } from "@trigger.dev/sdk";
import { runRefinementPdfSmoke } from "../lib/refinement/pdf/refinement-pdf-smoke.js";

type RefinementPdfSmokePayload = {
  pdfBase64: string;
  minimumTextCharacters?: number;
};

export const refinementPdfSmoke = task({
  id: "refinement-pdf-smoke",
  run: async (payload: RefinementPdfSmokePayload) => runRefinementPdfSmoke(payload),
});
