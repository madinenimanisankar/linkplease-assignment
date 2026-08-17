import DMJob from "../models/DMJob.js";
import {
    sendDM,
    getDMStatus
} from "../services/dm.service.js";

const MAX_RETRIES = 5;

// PseudoGram allows 10 POST requests per rolling 60 seconds.
// We intentionally stay below the limit for safety.
const MAX_REQUESTS_PER_WINDOW = 9;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

const requestTimestamps = [];

function canSendRequest() {
    const now = Date.now();

    while (
        requestTimestamps.length > 0 &&
        now - requestTimestamps[0] >= RATE_LIMIT_WINDOW_MS
    ) {
        requestTimestamps.shift();
    }

    return requestTimestamps.length < MAX_REQUESTS_PER_WINDOW;
}

function recordRequest() {
    requestTimestamps.push(Date.now());
}

function calculateBackoff(retryCount) {
    const baseDelay = 2000;

    return baseDelay * Math.pow(2, retryCount);
}

async function processJob(job) {
    try {
        await DMJob.findByIdAndUpdate(job._id, {
            status: "processing",
            attempts: job.attempts + 1
        });

        const result = await sendDM(job);

        console.log("DM API result:", {
            job_id: job.job_id,
            status: result.status,
            body: result.body
        });

        // API accepted the DM.
        // Actual delivery still needs reconciliation.
        if (
            (result.status === 200 || result.status === 202) &&
            result.body?.dm_id
        ) {
            await DMJob.findByIdAndUpdate(job._id, {
                status: "waiting_for_delivery",
                dm_id: result.body.dm_id,
                last_error: null
            });

            console.log(
                `DM accepted: job=${job.job_id}, dm=${result.body.dm_id}`
            );

            return;
        }

        // Rate limited.
        if (result.status === 429) {
            const retryAfter = Number(
                result.retryAfter || 60
            );

            const nextRetryAt = new Date(
                Date.now() + retryAfter * 1000
            );

            await DMJob.findByIdAndUpdate(job._id, {
                status: "queued",
                next_retry_at: nextRetryAt,
                last_error: "rate_limited"
            });

            console.log(
                `Rate limited: job=${job.job_id}, retry in ${retryAfter}s`
            );

            return;
        }

        // Temporary server error.
        if (result.status === 500) {
            const retryCount = job.retry_count + 1;

            if (retryCount >= MAX_RETRIES) {
                await DMJob.findByIdAndUpdate(job._id, {
                    status: "failed",
                    retry_count: retryCount,
                    last_error: "internal_server_error",
                    next_retry_at: null
                });

                console.log(
                    `Permanent failure after retries: job=${job.job_id}`
                );

                return;
            }

            const delay = calculateBackoff(job.retry_count);

            const nextRetryAt = new Date(
                Date.now() + delay
            );

            await DMJob.findByIdAndUpdate(job._id, {
                status: "queued",
                retry_count: retryCount,
                next_retry_at: nextRetryAt,
                last_error: "internal_server_error"
            });

            console.log(
                `500 error: job=${job.job_id}, retry in ${delay}ms`
            );

            return;
        }

        // Invalid request.
        // Retrying won't fix malformed data.
        if (result.status === 400) {
            await DMJob.findByIdAndUpdate(job._id, {
                status: "failed",
                last_error: "invalid_request",
                next_retry_at: null
            });

            console.log(
                `Invalid request: job=${job.job_id}`
            );

            return;
        }

        // Unknown response.
        await DMJob.findByIdAndUpdate(job._id, {
            status: "failed",
            last_error: `unexpected_status_${result.status}`
        });

    } catch (error) {
        console.error(
            `Worker error for job ${job.job_id}:`,
            error.message
        );

        const retryCount = job.retry_count + 1;

        if (retryCount >= MAX_RETRIES) {
            await DMJob.findByIdAndUpdate(job._id, {
                status: "failed",
                retry_count: retryCount,
                last_error: error.message
            });

            return;
        }

        const delay = calculateBackoff(job.retry_count);

        await DMJob.findByIdAndUpdate(job._id, {
            status: "queued",
            retry_count: retryCount,
            next_retry_at: new Date(Date.now() + delay),
            last_error: error.message
        });
    }
}

async function processQueuedJobs() {
    try {
        if (!canSendRequest()) {
            return;
        }

        const job = await DMJob.findOne({
            status: "queued",
            $or: [
                { next_retry_at: null },
                { next_retry_at: { $lte: new Date() } }
            ]
        }).sort({
            createdAt: 1
        });

        if (!job) {
            return;
        }

        recordRequest();

        await processJob(job);

    } catch (error) {
        console.error(
            "Worker polling error:",
            error.message
        );
    }
}

async function reconcileDeliveries() {
    try {
        const jobs = await DMJob.find({
            status: "waiting_for_delivery",
            dm_id: { $ne: null }
        }).limit(20);

        for (const job of jobs) {
            try {
                const result = await getDMStatus(job.dm_id);

                if (result.status !== 200) {
                    console.log(
                        `Delivery check failed: job=${job.job_id}`
                    );

                    continue;
                }

                const dmStatus = result.body?.status;

                if (dmStatus === "delivered") {
                    await DMJob.findByIdAndUpdate(job._id, {
                        status: "sent",
                        last_error: null
                    });

                    console.log(
                        `DM delivered: job=${job.job_id}`
                    );
                }

                if (dmStatus === "failed") {
                    await DMJob.findByIdAndUpdate(job._id, {
                        status: "queued",
                        dm_id: null,
                        next_retry_at: new Date(),
                        last_error: "delivery_failed"
                    });

                    console.log(
                        `Delivery failed, retry queued: job=${job.job_id}`
                    );
                }

            } catch (error) {
                console.error(
                    `Delivery reconciliation error for ${job.job_id}:`,
                    error.message
                );
            }
        }

    } catch (error) {
        console.error(
            "Delivery reconciliation polling error:",
            error.message
        );
    }
}

export function startDMWorker() {
    console.log("DM worker started");

    // Process outgoing POST requests.
    setInterval(processQueuedJobs, 1000);

    // Check delivery status.
    setInterval(reconcileDeliveries, 3000);
}