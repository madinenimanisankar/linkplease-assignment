# Known Failure Modes

1. If the application process restarts while a retry is scheduled in memory, the in-memory retry timer is lost. The DM job remains persisted in MongoDB, but the current implementation depends on the worker polling the persisted job again.

2. The DM rate limiter is maintained in application memory. A process restart resets the local rate-limit window, and multiple application instances would not share the same rate-limit state.

3. If the process crashes after the external DM API accepts a request but before MongoDB records the returned `dm_id`, the job may be retried. The Idempotency-Key reduces the risk of sending the same DM twice, but this failure boundary still depends on the external API's idempotency behavior.

4. The current worker is designed for a single application instance. Running multiple worker instances would require stronger distributed job claiming and coordinated rate limiting.
