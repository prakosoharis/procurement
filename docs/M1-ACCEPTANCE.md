# M1 acceptance evidence

Local evidence for native SOP core operations:

- Repository supports URL-backed search, lifecycle and review filters, loading/error/empty states.
- Create SOP is metadata-first and scoped through governance options/API.
- Draft metadata edit uses `expectedState` and `expectedUpdatedAt`.
- Lifecycle actions are capability/state gated; Human-Only Refinement is explicitly manual.
- Revision source is the official published version.
- Guest governance API returns the standard 401 request-ID contract.

This is implementation evidence only. M1 remains `DONE` pending user acceptance.
