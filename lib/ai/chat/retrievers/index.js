import { retrieveAudit } from './audit.js';
import { retrievePeople } from './people.js';
import { retrieveRefinement } from './refinement.js';
import { retrieveRepository } from './repository.js';
import { retrieveSubmissions } from './submissions.js';

// Topic name from the scope classifier to its scoped retriever. Every retriever
// applies the actor's effective Business Unit scope inside its own query; none
// of them accept a caller-supplied filter.
export const chatRetrievers = Object.freeze({
  repository: retrieveRepository,
  submissions: retrieveSubmissions,
  refinement: retrieveRefinement,
  audit: retrieveAudit,
  people: retrievePeople,
  // Engagement is derived from repository coverage and calendar participation,
  // which the repository and audit retrievers already return in scope.
  engagement: retrieveRepository
});

export async function retrieveForTopics({ actor, db, topics, limitPerTopic }) {
  const unique = [...new Set(topics)].filter((topic) => chatRetrievers[topic]);
  const results = await Promise.all(unique.map(async (topic) => {
    try {
      return await chatRetrievers[topic]({ actor, db, ...(limitPerTopic ? { limit: limitPerTopic } : {}) });
    } catch (error) {
      // One failing retriever must not remove the rest of the context.
      console.error(`[ai:chat:retriever:${topic}]`, error);
      return { topic, records: [], failed: true };
    }
  }));
  return results;
}
