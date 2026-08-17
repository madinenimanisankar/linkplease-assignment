import crypto from "crypto";
import Event from "../models/Event.js";
import Rule from "../models/Rule.js";
import DMJob from "../models/DMJob.js";
import {incrementDuplicatesBlocked} from "./stats.service.js";

export function verifyWebhookSignature(rawBody, signature) {
    if (!signature) {
        return false;
    }

    if (!signature.startsWith("sha256=")) {
        return false;
    }

    const receivedSignature = signature.slice("sha256=".length);

    const expectedSignature = crypto
        .createHmac("sha256", process.env.PSEUDOGRAM_API_KEY)
        .update(rawBody)
        .digest("hex");

    try {
        return crypto.timingSafeEqual(
            Buffer.from(receivedSignature, "hex"),
            Buffer.from(expectedSignature, "hex")
        );
    } catch {
        return false;
    }
}

export async function processWebhookEvent(event) {
    if (event.event_type !== "comment.created") {
        return;
    }

    const text = event.data?.text || "";
    const userId = event.data?.from?.user_id;
    const commentId = event.data?.comment_id;

    if (!userId || !commentId) {
        return;
    }

    const rules = await Rule.find({});

    for (const rule of rules) {
        const keyword = rule.keyword.trim();

        if (!keyword) {
            continue;
        }

        const matches = text
            .toLowerCase()
            .includes(keyword.toLowerCase());

        if (!matches) {
            continue;
        }

        try {
            await DMJob.create({
                job_id: crypto.randomUUID(),
                rule_id: rule.rule_id,
                user_id: userId,
                comment_id: commentId,
                message: rule.dm_message,
                status: "queued"
            });

            console.log(
                `DM job created: rule=${rule.rule_id}, user=${userId}`
            );
        } catch (error) {
            if (error.code === 11000) {
    await incrementDuplicatesBlocked();

    console.log(
        `Duplicate DM blocked: rule=${rule.rule_id}, user=${userId}`
    );
} else {
                console.error("Failed to create DM job:", error);
            }
        }
    }
}
export async function handleCommentDeleted(commentId) {
    const job = await DMJob.findOne({
        comment_id: commentId,
        status: {
            $in: [
                "queued",
                "processing"
            ]
        }
    });

    if (!job) {
        console.log(
            `Deleted comment has no cancellable DM job: ${commentId}`
        );

        return;
    }

    await DMJob.findByIdAndUpdate(job._id, {
        status: "cancelled",
        last_error: "comment_deleted"
    });

    console.log(
        `DM job cancelled because comment was deleted: job=${job.job_id}`
    );
}