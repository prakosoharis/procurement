# CP2B Governance Services

CP2B adds server-side services only. Legacy routes and iframe behaviour are unchanged; no route exposes unrestricted lifecycle writes.

## Source of truth and concurrency

`SopVersion.lifecycleState` is the governance source of truth. Every transition reloads the version inside a Prisma transaction and may require `expectedState`; stale callers receive `CONCURRENT_MODIFICATION`. Publishing updates the version, `PublishingRecord`, document official pointer, and prior official version in one transaction. Residual risk remains for two concurrent callers that omit `expectedState`; future route handlers must pass the state displayed to the user.

## Business dates

`effectiveAt` and `nextReviewAt` are stored as timestamps but handled as UTC governance calendar dates. The resolver adds calendar months, not milliseconds, using priority: version override, SOP category, Business Unit, then 12 months.

## Legacy compatibility

Legacy APIs remain unchanged. New services use only `SopVersion.lifecycleState`; legacy `SopStatus` is not rewritten by CP2B.
