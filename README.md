1. Add a Quick Start section

Right now setup is detailed, but a reviewer should be able to understand the fastest path in 30 seconds.

## Quick Start


```bash
git clone https://github.com/madinenimanisankar/linkplease-assignment.git
cd linkplease-assignment
npm install

Create .env:

MONGODB_URI=your_mongodb_uri
PSEUDOGRAM_API_KEY=your_api_key
PSEUDOGRAM_BASE_URL=https://pseudogram-api.onrender.com
PORT=3000

Start the application:

npm run dev

The API will be available at:

http://localhost:3000

Health check:

curl http://localhost:3000/


This helps an evaluator immediately run your project.


---


### 2. Add an explicit **End-to-End Example**


This is probably the **best addition**.


Show exactly what happens when someone comments `PRICE`.


```md
## End-to-End Example


Suppose the following rule exists:


```json
{
  "keyword": "PRICE",
  "dm_message": "Here's the price list: ..."
}

A user comments:

Can you send me the PRICE?

The complete processing flow is:

1. PseudoGram creates comment.created event
                    |
                    v
2. POST /webhook
                    |
                    v
3. Verify HMAC-SHA256 signature
                    |
                    v
4. Check event_id for duplicates
                    |
                    v
5. Persist event in MongoDB
                    |
                    v
6. Return HTTP 200
                    |
                    v
7. Match "PRICE" rule
                    |
                    v
8. Check rule_id + user_id
                    |
                    v
9. Create persistent DM job
                    |
                    v
10. Background worker claims job
                    |
                    v
11. POST DM to PseudoGram
                    |
                    v
12. Receive 202 Accepted
                    |
                    v
13. Store dm_id
                    |
                    v
14. Poll/check delivery status
                    |
             +------+------+
             |             |
             v             v
         delivered       failed

This demonstrates that you understand the entire system, not just individual APIs.



---


### 3. Add a **State Machine**


This would make your queue/retry implementation much clearer.


```md
## DM Job State Machine


A DM job moves through the following states:


```text
                  +---------+
                  | queued  |
                  +----+----+
                       |
                       v
                 +-----------+
                 | processing|
                 +-----+-----+
                       |
             +---------+---------+
             |                   |
             v                   v
        API 202/200          API 500/429
             |                   |
             v                   v
 +---------------------+      retry
 | waiting_for_delivery|
 +----------+----------+
            |
       +----+----+
       |         |
       v         v
  delivered    failed


At any point before sending:


comment.deleted
       |
       v
   cancelled
Terminal states
sent
failed
cancelled
Retryable states
queued
processing
waiting_for_delivery


This is a strong backend-engineering addition.


---


### 4. Add a **Failure Matrix**


You already explain failures, but a table makes it much easier to review.


```md
## Failure Matrix


| Failure | Example | Retry? | Action |
|---|---|---:|---|
| Success | 200 | No | Mark successful |
| Accepted | 202 | No immediate retry | Store `dm_id` and reconcile |
| Rate limit | 429 | Yes | Respect `Retry-After` |
| Server error | 500 | Yes | Retry with backoff |
| Invalid request | 400 | No | Mark failed |
| Duplicate event | Duplicate `event_id` | No | Ignore |
| Duplicate DM | Same `rule_id + user_id` | No | Block |
| Comment deleted | `comment.deleted` | No | Cancel pending job |
| Invalid signature | HMAC mismatch | No | Return 401 |

This is much more professional than only describing the errors in paragraphs.

5. Add API Examples with cURL

Your API documentation currently describes endpoints, but an evaluator may want something executable.

For example:

## API Examples


### Create Rule


```bash
curl -X POST http://localhost:3000/rules \
  -H "Content-Type: application/json" \
  -d '{
    "keyword": "PRICE",
    "dm_message": "Here is the price list."
  }'
Get Statistics
curl http://localhost:3000/stats
Health Check
curl http://localhost:3000/


For `/webhook`, because your API requires an HMAC signature, document how your test script generates it rather than encouraging users to bypass the security mechanism.


---


### 6. Add **Idempotency Guarantees**


You already mention idempotency, but I would make the guarantees explicit:


```md
## Idempotency Guarantees


The application provides idempotency at multiple levels.


| Layer | Identifier | Purpose |
|---|---|---|
| Webhook | `event_id` | Prevent duplicate event processing |
| Business | `rule_id + user_id` | Prevent duplicate DMs |
| External API | `Idempotency-Key` | Reduce duplicate external requests |


This means retries and webhook redelivery do not automatically result in multiple DMs.
7. Add Concurrency / Race Condition Considerations

This is especially valuable for an intern backend assignment.

## Concurrency Considerations


A webhook-driven system can receive multiple events for the same user at nearly the same time.


For example:


```text
comment.created #1 ----\
                         \
                          > Worker / MongoDB
                         /
comment.created #2 ----/

Both events may attempt to create a DM job concurrently.

The application therefore relies on database-level uniqueness and idempotency checks rather than only application-level checks.

The important business invariant is:

One user + one rule = at most one DM

For production-scale deployment, atomic job claiming and stronger distributed locking would be added to support multiple workers safely.



This directly connects to your **Known Limitations** section.


---


### 8. Add **Observability / Logging**


If your actual code has logs, document them.


```md
## Observability


The worker and webhook processor log important processing information such as:


- event ID
- comment ID
- user ID
- rule ID
- job ID
- attempt number
- external API status
- retry reason
- delivery status


Example:


```text
[Webhook] event=evt_123 type=comment.created
[Rule] rule=rule_123 matched
[DMJob] job=job_123 created
[Worker] job=job_123 attempt=1
[PseudoGram] status=500
[Retry] job=job_123 retry scheduled
[PseudoGram] status=202 dm_id=dm_123
[Delivery] dm_id=dm_123 status=delivered


**Only add this if your implementation actually produces these logs.**


---


### 9. Add **Performance Expectations**


Don't claim numbers you haven't measured.


Instead:


```md
## Performance Considerations


The webhook endpoint is intentionally designed to acknowledge events before performing slow external operations.


The critical path is:


```text
Receive request
      |
      v
Verify signature
      |
      v
Validate event
      |
      v
Persist event
      |
      v
Return 200

External DM requests, retries, and delivery reconciliation happen outside the webhook response path.

A dedicated load test for 500 events over 10 seconds is planned but has not yet been validated.



This is honest and technically strong.


---


### 10. Add **Demo Flow**


This is useful when the recruiter opens your GitHub repository.


```md
## Demo Flow


To manually demonstrate the system:


1. Start MongoDB.
2. Start the Node.js application.
3. Create a `PRICE` rule.
4. Send a `comment.created` webhook.
5. Observe the webhook response.
6. Observe the DM job being created.
7. Observe the background worker processing the job.
8. Simulate a temporary `500` response.
9. Observe the retry.
10. Verify the final delivery status.
11. Send the same webhook again.
12. Verify duplicate protection.
13. Send another matching comment from the same user.
14. Verify that another DM is not created.
15. Send `comment.deleted`.
16. Verify cancellation of an unsent DM job.
17. Check `/stats`.
One important correction I'd make

Your README currently says:

Delivered / Retried / Failed

I'd make the flow more precise:

                  PseudoGram Response
                         |
          +--------------+--------------+
          |              |              |
          v              v              v
       200/202           429            500
          |              |              |
          v              v              v
    Accepted/Queued   Wait using      Retry with
                      Retry-After      backoff
          |
          v
 Delivery Reconciliation
          |
      +---+---+
      |       |
      v       v
 delivered  failed

Because retried isn't really a final state. A retry is an action/transition, while sent, failed, and cancelled are states.
