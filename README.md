LinkPlease Tech Intern --- Instagram Comment Automation

A reliable event-driven backend that automates Instagram-style
comment-to-DM workflows.

This project was built for the LinkPlease Tech Intern assignment using
the provided PseudoGram mock Instagram API.

The system receives comment webhook events, matches comments against
configurable keyword rules, creates persistent DM jobs, sends DMs
through the PseudoGram API, handles temporary failures and rate limits,
prevents duplicate DMs, reconciles delivery status, and handles deleted
comments.

Table of Contents

Overview

Problem Statement

Solution

Key Requirements

Features

Architecture

Request Flow

End-to-End Example

Webhook Processing

Rule Matching

Duplicate Protection

DM Job Queue

DM Job State Machine

Retry Strategy

Rate Limit Handling

Delivery Reconciliation

Comment Deletion Handling

Webhook Security

Statistics

Database Design

API Documentation

API Examples

Idempotency Guarantees

Concurrency Considerations

Project Structure

Technology Stack

Environment Variables

Quick Start

Local Setup

Demo Flow

Testing

Testing Scenarios

Failure Matrix

Failure Handling

Performance Considerations

Observability

Known Limitations

Assignment Status

Production Deployment

Security Considerations

Design Decisions

Future Improvements

What I Learned

Author

Overview

LinkPlease automates Instagram workflows for creators.

A typical workflow looks like:

Creator publishes a post
        |
        v
User comments "PRICE please"
        |
        v
Instagram / PseudoGram sends webhook
        |
        v
Application receives comment
        |
        v
Keyword rule matching
        |
        v
DM job created
        |
        v
Background worker processes job
        |
        v
PseudoGram DM API
        |
        v
Delivery status checked

The application checks the configured rules.

If a rule exists:

Keyword:
PRICE

DM:
Here's the price list: ...

a persistent DM job is created.

A background worker then processes the job and communicates with the
PseudoGram DM API.

Problem Statement

The system needs to reliably automate comment-to-DM workflows while
handling real-world backend concerns such as:

Duplicate webhook delivery

Duplicate comments from the same user

Temporary external API failures

API rate limits

Asynchronous DM delivery

Deleted comments

Webhook authentication

Persistent job state

Application restarts

The goal is to avoid sending duplicate DMs while ensuring that temporary
failures do not permanently lose work.

Solution

The application uses an event-driven architecture with:

Express.js for HTTP/webhook endpoints

MongoDB for persistent state

Mongoose for data modeling

A background DM worker for asynchronous processing

HMAC-SHA256 for webhook authentication

Idempotency checks for duplicate protection

Retry handling for temporary failures

Delivery reconciliation for asynchronous DM delivery

The webhook endpoint performs only the work necessary to safely accept
the event and persist it. Slow external API operations are handled
asynchronously by the background worker.

Key Requirements

Part A --- Required

Create keyword-based DM rules

Case-insensitive keyword matching

Match keywords anywhere in comment text

Process incoming comment webhooks

Use user_id as the stable user identity

Prevent duplicate webhook processing

Prevent duplicate DMs for the same user and rule

Persistent DM jobs using MongoDB

Background DM worker

Retry temporary API failures

Handle external API errors

Part B

HMAC-SHA256 webhook signature verification

/stats endpoint

Persistent duplicate statistics

Part C

DM delivery status reconciliation

Handle comment.deleted events

Cancel pending DM jobs when a comment is deleted

Retry handling for temporary failures

Features

Configurable keyword-to-DM rules

Case-insensitive substring matching

Secure webhook verification

Persistent event storage

Webhook event deduplication

Business-level DM deduplication

Persistent DM job queue

Background worker

Retry handling

Rate-limit handling

Delivery reconciliation

Comment deletion handling

Statistics endpoint

MongoDB persistence

Failure-aware processing

Architecture

                    PseudoGram API
                          |
                          | Webhook
                          v
                 +-------------------+
                 |   POST /webhook   |
                 +-------------------+
                          |
                          v
                 HMAC Verification
                          |
                          v
                 Event Validation
                          |
                          v
                 Duplicate Detection
                          |
                          v
                     MongoDB
                          |
                          v
                 Async Processing
                          |
                          v
                   Rule Matching
                          |
                          v
                    DM Job
                          |
                          v
                 +----------------+
                 |   DM Worker    |
                 +----------------+
                          |
                          v
                  PseudoGram API
                          |
                          v
                Delivery Reconciliation
                          |
                 +--------+--------+
                 |                 |
                 v                 v
             Delivered           Failed

Request Flow

The complete flow is:

User comments on post
        |
        v
PseudoGram webhook
        |
        v
POST /webhook
        |
        v
Verify webhook signature
        |
        v
Check duplicate event
        |
        v
Store event in MongoDB
        |
        v
Return HTTP 200
        |
        v
Process event asynchronously
        |
        v
Match keyword rule
        |
        v
Check duplicate DM
        |
        v
Create DM job
        |
        v
Background DM Worker
        |
        v
PseudoGram DM API
        |
        v
Delivery status check
        |
        v
Delivered / Retried / Failed

A retry is an operation/transition rather than a final job state. Final
application states are described in the DM Job State Machine section.

End-to-End Example

Suppose the following rule exists:

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
10. Background worker processes job
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
14. Check delivery status
                    |
             +------+------+
             |             |
             v             v
         delivered       failed

This demonstrates the complete lifecycle from webhook ingestion to final
delivery status.

Webhook Processing

PseudoGram sends events to:

POST /webhook

Example event:

{
  "event_id": "evt_123",
  "event_type": "comment.created",
  "data": {
    "comment_id": "cmt_123",
    "text": "PRICE please",
    "from": {
      "user_id": "usr_123",
      "username": "example.user"
    }
  }
}

The application:

Captures the raw request body.

Verifies the HMAC-SHA256 signature.

Validates the event.

Checks whether the event_id has already been processed.

Persists the event.

Returns HTTP 200 quickly.

Processes the business logic asynchronously.

This prevents slow external API operations from blocking webhook
ingestion.

Rule Matching

Rules contain a keyword and DM message.

Example:

{
  "keyword": "PRICE",
  "dm_message": "Here's the price list: ..."
}

Keyword matching is:

Case-insensitive

Substring-based

For example, the rule:

PRICE

matches:

PRICE
price
Price please
Can you send the price?
I WANT THE PRICE

Duplicate Protection

The application uses two levels of duplicate protection.

Event-Level Deduplication

PseudoGram can redeliver the same event.

The application stores:

event_id

with a unique database constraint.

If the same event arrives again:

First Event
    |
    v
Stored
    |
    v
Processed


Same Event Again
    |
    v
Duplicate Detected
    |
    v
Ignored

The duplicate is counted in:

duplicates_blocked

DM-Level Deduplication

Different comments can come from the same user.

Example:

Comment 1:
PRICE


Comment 2:
price please


Comment 3:
Can I get the PRICE?

All three comments may match the same rule.

The system prevents the user from receiving the same rule's DM multiple
times.

The logical business key is:

rule_id + user_id

This gives the business-level guarantee:

One user + one rule = at most one DM

Why user_id Is Used

The PseudoGram API provides both:

user_id

username

The assignment states that user_id represents the user's identity
while usernames can change.

Therefore, duplicate protection and DM targeting use:

user_id

instead of:

username

DM Job Queue

If a matching rule is found and no previous DM exists, a persistent DM
job is created in MongoDB.

Example:

{
  "job_id": "job_123",
  "rule_id": "rule_123",
  "user_id": "usr_123",
  "comment_id": "cmt_123",
  "message": "Here's the price list: ...",
  "status": "queued",
  "attempts": 0
}

The background worker continuously looks for jobs that need processing.

Queued Job
    |
    v
DM Worker
    |
    v
PseudoGram API
    |
    v
Result

This separates webhook ingestion from external API communication.

DM Job State Machine

A DM job can move through the following internal states:

                  +---------+
                  | queued  |
                  +----+----+
                       |
                       v
                +------------+
                | processing |
                +------+-----+
                       |
          +------------+-------------+
          |                          |
          v                          v
    API 200/202                  API 500/429
          |                          |
          v                          v
waiting_for_delivery              retry
          |
          v
   Delivery Status
          |
      +---+---+
      |       |
      v       v
 delivered  failed
      |
      v
    sent

If a comment is deleted before the DM is sent:

comment.deleted
       |
       v
   cancelled

Terminal States

sent

failed

cancelled

Processing / Retry States

queued

processing

waiting_for_delivery

A retry is an operation that moves a job back into processing rather
than a final state itself.

Retry Strategy

The PseudoGram API can return temporary failures.

Important responses include:

200

202

400

429

500

HTTP 500

A 500 represents a temporary internal server error.

The application retries the job.

Example:

Attempt 1
    |
    +---- 500
    |
    v
Wait
    |
    v
Attempt 2
    |
    +---- 200/202
    |
    v
Continue processing

During testing, the system successfully demonstrated a temporary
500 internal_error followed by a successful retry.

HTTP 400

A 400 indicates an invalid request.

Retrying the same invalid request does not normally solve the problem.

Therefore, 400 responses are not blindly retried.

Rate Limit Handling

The PseudoGram API can limit DM requests.

When the API returns:

429 rate_limited

it also provides:

Retry-After

The worker uses the retry information instead of immediately sending
another request.

The intended flow is:

DM Request
    |
    v
429
    |
    v
Read Retry-After
    |
    v
Wait
    |
    v
Retry

This helps prevent repeated rate-limit violations.

Delivery Reconciliation

The PseudoGram API can return:

202 Accepted

This does not necessarily mean that the DM has been delivered.

Example response:

{
  "dm_id": "dm_123",
  "status": "queued"
}

The application stores the dm_id and checks the delivery status.

Possible external statuses include:

queued
delivered
failed

Therefore:

202 Accepted

is treated as:

waiting_for_delivery

rather than immediately counting the DM as delivered.

The final result is determined by the delivery status.

Comment Deletion Handling

The application handles:

comment.deleted

events.

If a comment is deleted before its DM is sent, the pending DM job is
cancelled.

Example:

comment.created
       |
       v
DM job created
       |
       v
Job queued
       |
       v
comment.deleted
       |
       v
Job cancelled

The cancelled job is not sent to the PseudoGram API.

Example database state:

status:
cancelled

last_error:
comment_deleted

This behavior was tested locally.

Webhook Security

PseudoGram signs webhook requests using HMAC-SHA256.

The signature format is:

sha256=<hex>

The application captures the raw request body before JSON parsing.

The verification flow is:

Raw Request Body
       |
       v
HMAC-SHA256
       |
       v
Compare Signature
       |
       +------ Valid ------> Process
       |
       +------ Invalid ----> 401

Invalid requests receive:

{
  "error": "invalid_signature"
}

with HTTP:

401 Unauthorized

Statistics

The application exposes:

GET /stats

Example:

{
  "sent": 5,
  "failed": 2,
  "queued": 0,
  "duplicates_blocked": 2
}

sent

Number of DMs confirmed as delivered/successfully completed according to
the application's final delivery handling.

failed

Number of DMs that were ultimately given up after retry handling.

queued

Number of DM jobs currently waiting to be processed or retried.

duplicates_blocked

Number of duplicate events or duplicate DM attempts blocked according to
the application's statistics logic.

Database Design

MongoDB is used for persistent state.

The application uses the following collections/models.

Rules

Stores automation rules.

Example:

{
  "rule_id": "rule_123",
  "keyword": "PRICE",
  "dm_message": "Here's the price list: ..."
}

Events

Stores webhook events.

Example:

{
  "event_id": "evt_123",
  "event_type": "comment.created",
  "comment_id": "cmt_123",
  "user_id": "usr_123",
  "text": "PRICE please"
}

The event_id is uniquely indexed.

DM Jobs

Stores persistent DM jobs.

Example:

{
  "job_id": "job_123",
  "rule_id": "rule_123",
  "user_id": "usr_123",
  "comment_id": "cmt_123",
  "message": "Here's the price list: ...",
  "status": "sent",
  "attempts": 1,
  "dm_id": "dm_123"
}

Possible internal states include:

queued
processing
waiting_for_delivery
sent
failed
cancelled

Statistics

Stores application statistics.

Example:

{
  "key": "global",
  "sent": 5,
  "failed": 2,
  "queued": 0,
  "duplicates_blocked": 2
}

API Documentation

GET /

Health endpoint.

Example response:

{
  "message": "LinkPlease assignment API is running"
}

POST /rules

Creates a new keyword rule.

Request:

{
  "keyword": "PRICE",
  "dm_message": "Here's the price list: ..."
}

Response:

HTTP 201 Created

{
  "rule_id": "example-rule-id",
  "keyword": "PRICE",
  "dm_message": "Here's the price list: ..."
}

POST /webhook

Receives PseudoGram events.

Successful response:

{
  "received": true
}

Duplicate response:

{
  "received": true,
  "duplicate": true
}

GET /stats

Returns live application statistics.

Example:

{
  "sent": 5,
  "failed": 2,
  "queued": 0,
  "duplicates_blocked": 2
}

API Examples

Create Rule

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

For /webhook, the request must include a valid HMAC-SHA256 signature.
The repository's webhook test scripts demonstrate how the signed request
is generated and sent.

Idempotency Guarantees

The application provides idempotency at multiple levels.

Layer                   Identifier              Purpose

Webhook                 event_id              Prevent duplicate event
processing

Business                rule_id + user_id     Prevent duplicate DMs

This means webhook redelivery and retry scenarios do not automatically
result in multiple DMs.

Concurrency Considerations

A webhook-driven system can receive multiple events for the same user at
nearly the same time.

For example:

comment.created #1 ----\
                         \
                          > Worker / MongoDB
                         /
comment.created #2 ----/

Both events may attempt to create a DM job concurrently.

The application therefore relies on database-level uniqueness and
idempotency checks rather than only application-level checks.

The important business invariant is:

One user + one rule = at most one DM

For production-scale deployment, atomic job claiming and stronger
distributed locking would be added to support multiple workers safely.

Project Structure

linkplease-assignment/
│
├── src/
│   │
│   ├── controllers/
│   │   ├── rules.controller.js
│   │   ├── stats.controller.js
│   │   └── webhook.controller.js
│   │
│   ├── database/
│   │   └── mongodb.js
│   │
│   ├── models/
│   │   ├── DMJob.js
│   │   ├── Event.js
│   │   ├── Rule.js
│   │   └── Stats.js
│   │
│   ├── routes/
│   │   ├── rules.routes.js
│   │   ├── stats.routes.js
│   │   └── webhook.routes.js
│   │
│   ├── services/
│   │   ├── dm.service.js
│   │   ├── stats.service.js
│   │   └── webhook.service.js
│   │
│   ├── workers/
│   │   └── dm.worker.js
│   │
│   └── server.js
│
├── tests/
│   ├── webhook-test.js
│   ├── duplicate-webhook-test.js
│   ├── same-user-test.js
│   └── comment-deleted-test.js
│
├── .env.example
├── .gitignore
├── FAILURES.md
├── README.md
├── package.json
└── package-lock.json

Technology Stack

Node.js

Express.js

MongoDB

Mongoose

REST APIs

HMAC-SHA256

Background worker

Git

GitHub

Environment Variables

Create a local .env file.

Example:

MONGODB_URI=your_mongodb_connection_string
PSEUDOGRAM_API_KEY=your_pseudogram_api_key
PSEUDOGRAM_BASE_URL=https://pseudogram-api.onrender.com
PORT=3000

Never commit .env to GitHub.

The repository contains:

.env.example

for documenting the required variables.

Quick Start

The fastest way to run the project locally:

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

Expected response:

{
  "message": "LinkPlease assignment API is running"
}

Local Setup

1. Clone the Repository

git clone https://github.com/madinenimanisankar/linkplease-assignment.git
cd linkplease-assignment

2. Install Dependencies

npm install

3. Configure Environment Variables

Create:

.env

and add your own MongoDB and PseudoGram credentials.

4. Start the Development Server

npm run dev

Expected output:

MongoDB connected successfully
DM worker started
Server running on port 3000

5. Start Production Server

npm start

Demo Flow

To manually demonstrate the system:

Start MongoDB.

Start the Node.js application.

Create a PRICE rule.

Send a valid comment.created webhook.

Observe the webhook response.

Observe the DM job being created.

Observe the background worker processing the job.

Simulate a temporary 500 response.

Observe the retry.

Verify the final delivery status.

Send the same webhook again.

Verify duplicate protection.

Send another matching comment from the same user.

Verify that another DM is not created.

Send comment.deleted.

Verify cancellation of an unsent DM job.

Check /stats.

Testing

The repository contains tests for the important assignment scenarios.

Webhook Test

node tests/webhook-test.js

Expected:

Status: 200
Response: {"received":true}

Duplicate Webhook Test

node tests/duplicate-webhook-test.js

The same webhook event is sent twice.

Expected behavior:

First request:
200 {"received":true}

Second request:
200 {"received":true,"duplicate":true}

Only one DM job should be created.

Same User Test

node tests/same-user-test.js

Multiple matching comments are sent from the same user.

Expected behavior:

Comment 1
    |
    v
DM created


Comment 2
    |
    v
Duplicate DM blocked

Comment Deleted Test

node tests/comment-deleted-test.js

The test sends a comment.created event followed by a comment.deleted
event.

Expected behavior:

comment.created
      |
      v
DM job created
      |
      v
comment.deleted
      |
      v
DM job cancelled

Testing Scenarios

The following scenarios have been tested during development:

Scenario                              Result

Create rule                           ✅ Passed
Webhook receives event                ✅ Passed
Duplicate webhook                     ✅ Passed
Same user commenting multiple times   ✅ Passed
Duplicate DM prevention               ✅ Passed
Temporary HTTP 500                    ✅ Retry tested
Successful retry                      ✅ Passed
DM delivery reconciliation            ✅ Tested
Comment deletion                      ✅ Passed
HMAC signature verification           ✅ Implemented
/stats endpoint                     ✅ Tested
500 events / 10 seconds               ⏳ Not yet validated
Public deployment                     ⏳ Not yet completed

Failure Matrix

Failure             Example                                  Retry? Action

Success             200                                        No Mark successful
Accepted            202                        No immediate retry Store dm_id and reconcile
Rate limit          429                                       Yes Respect Retry-After
Server error        500                                       Yes Retry with backoff
Invalid request     400                                        No Mark failed
Duplicate event     Duplicate event_id                         No Ignore
Duplicate DM        Same rule_id + user_id                     No Block
Comment deleted     comment.deleted                            No Cancel pending job
Invalid signature   HMAC mismatch                                No Return 401

Failure Handling

The external API is intentionally unreliable.

The application therefore distinguishes between temporary and permanent
failures.

Temporary Failures

Examples:

500 Internal Error
429 Rate Limited

These can be retried.

Permanent Request Failures

Example:

400 Invalid Request

These should not be blindly retried.

Why Persistent Jobs?

A simple in-memory queue could lose work if the application crashes.

Example:

Webhook
   |
   v
Memory Queue
   |
   v
Application crashes
   |
   v
Job lost

With MongoDB:

Webhook
   |
   v
MongoDB
   |
   v
DM Job
   |
   v
Application restarts
   |
   v
Worker finds job

This provides better durability.

Why Background Processing?

The webhook must respond quickly.

If the application performed all work synchronously:

Webhook
   |
   v
Rule matching
   |
   v
DM API
   |
   v
Retry
   |
   v
Delivery check
   |
   v
Response

the webhook could take too long.

Instead:

Webhook
   |
   v
Store Event
   |
   v
HTTP 200


Background Worker
   |
   v
DM Processing

This separates event ingestion from business processing.

Performance Considerations

The webhook endpoint is intentionally designed to acknowledge events
before performing slow external operations.

The critical path is:

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

External DM requests, retries, and delivery reconciliation happen
outside the webhook response path.

A dedicated load test for 500 events over 10 seconds is planned but has
not yet been validated.

Observability

The application can be observed through application and worker logs.

Important processing information includes, where available:

Event ID

Comment ID

User ID

Rule ID

Job ID

Attempt number

External API status

Retry reason

Delivery status

Example log flow:

[Webhook] event=evt_123 type=comment.created
[Rule] rule=rule_123 matched
[DMJob] job=job_123 created
[Worker] job=job_123 attempt=1
[PseudoGram] status=500
[Retry] job=job_123 retry scheduled
[PseudoGram] status=202 dm_id=dm_123
[Delivery] dm_id=dm_123 status=delivered

Known Limitations

This project intentionally documents its limitations rather than
claiming perfect reliability.

Known areas that can be improved include:

Multi-instance worker coordination

Distributed rate limiting

Stronger atomic job claiming

Crash recovery around an external API request

Distributed job processing

More extensive concurrent load testing

Production-grade observability

Detailed known failure modes are documented in:

FAILURES.md

Assignment Status

Requirement                       Status

Create keyword rules              ✅
Case-insensitive matching         ✅
Keyword matching anywhere         ✅
POST /webhook                     ✅
Fast webhook response             ✅
Event persistence                 ✅
Event deduplication               ✅
Same user/rule DM deduplication   ✅
Persistent DM jobs                ✅
Background worker                 ✅
HTTP 500 retry                    ✅
HTTP 429 handling                 ✅
HMAC-SHA256 verification          ✅
GET /stats                        ✅
Delivery reconciliation           ✅
comment.deleted handling          ✅
Local tests                       ✅
500-event load test               ⏳
Public deployment                 ⏳

Production Deployment

For a production deployment, the application could be deployed with:

                    Load Balancer
                         |
              +----------+----------+
              |                     |
              v                     v
          API Instance 1       API Instance 2
              |                     |
              +----------+----------+
                         |
                         v
                    Shared DB
                         |
                         v
                 Worker Instances

Production deployment would additionally require:

Shared/distributed job coordination

Distributed rate limiting

Stronger atomic job claiming

Centralized logging

Monitoring and alerting

Secret management

Health checks

Graceful shutdown handling

Horizontal scaling strategy

Security Considerations

The following secrets are never committed:

.env
.env.local
.env.*.local

node_modules is also ignored.

Webhook requests are protected using HMAC-SHA256 signature verification.

Do not place API keys, MongoDB passwords, or other secrets inside:

README.md

Source code

Test files

GitHub commits

Design Decisions

MongoDB

MongoDB was selected to persist:

Rules

Webhook events

DM jobs

Statistics

This prevents important state from existing only in application memory.

Background Worker

The worker separates external API processing from webhook ingestion.

Event ID Deduplication

A unique event_id prevents repeated webhook deliveries from creating
duplicate work.

User ID

user_id is used instead of username because usernames may change.

Persistent DM Jobs

DM work is stored in MongoDB so it can survive application restarts.

Delivery Reconciliation

A 202 Accepted response is not treated as final delivery because the
external API can later report failure.

Future Improvements

With additional development time, the system could be improved with:

Distributed Queue

Use a dedicated queue such as:

Redis + BullMQ

RabbitMQ

Kafka

Cloud-managed queue

Distributed Rate Limiting

Use Redis or another shared store when multiple workers are running.

Dead Letter Queue

Move jobs that repeatedly fail into a dead-letter queue for manual
investigation.

Better Observability

Add:

Structured logging

Request IDs

Job IDs

Metrics

Tracing

Error monitoring

Horizontal Scaling

Run multiple API instances and workers behind a load balancer.

What I Learned

This project provided practical experience with:

Event-driven backend architecture

Webhook processing

HMAC request verification

MongoDB persistence

Mongoose data modeling

Background workers

Retry strategies

Rate-limit handling

Idempotency

Duplicate event protection

Asynchronous delivery reconciliation

Failure handling

Designing APIs for reliability

Separating webhook ingestion from background processing

Thinking about concurrency and production scalability

The main engineering lesson was that a reliable webhook system is not
just about receiving an HTTP request. It must also handle duplicate
delivery, persistence, retries, rate limits, asynchronous results,
cancellation, and failures without creating duplicate side effects.

Author

Mani Sankar Madineni

B.Tech CSE --- 2027 Batch

GitHub:

https://github.com/madinenimanisankar

Repository:

https://github.com/madinenimanisankar/linkplease-assignment