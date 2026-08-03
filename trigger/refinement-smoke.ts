import { task } from "@trigger.dev/sdk";

type RefinementSmokePayload = {
  message?: string;
};

export const refinementSmoke = task({
  id: "refinement-smoke",
  run: async (payload: RefinementSmokePayload, { ctx }) => {
    return {
      ok: true,
      task: ctx.task.id,
      attempt: ctx.attempt.number,
      message: payload.message ?? "Trigger.dev refinement smoke task is ready.",
      checkedAt: new Date().toISOString(),
    };
  },
});
