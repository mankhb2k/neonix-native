# ADR: Media probe and derivative lifecycle V3

Phase 6 persists probe metadata and derivative references separately from the
authoring protocol. Probe jobs are idempotent by `(assetId, sourceIntegrity,
pipelineVersion)`. Original media remains the visual resource; extracted audio
and poster/proxy artifacts are explicit derivatives with their own integrity,
version and optional manifest/index.

The compiler receives an immutable metadata snapshot. It never fetches storage,
refreshes signed URLs, or probes media. Runtime adapters resolve a resource at
the last responsible moment through `MediaResourceProviderV3`.

Statuses are `queued → probing → processing → ready`, with `partial` and
`failed` terminal diagnostics. Retrying the same idempotency key updates one
record and does not create orphaned derivatives.
