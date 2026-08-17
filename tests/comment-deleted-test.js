import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const userId = `usr_deleted_${Date.now()}`;
const commentId = `cmt_deleted_${Date.now()}`;

async function sendEvent(eventType) {
    const payload = {
        event_id: `evt_${eventType}_${Date.now()}`,
        event_type: eventType,
        sent_at: new Date().toISOString(),

        data: {
            comment_id: commentId,
            post_id: "post_deleted_test"
        }
    };

    // comment.created needs the full comment information
    if (eventType === "comment.created") {
        payload.data.text = "PRICE please";

        payload.data.created_at =
            new Date().toISOString();

        payload.data.from = {
            user_id: userId,
            username: "deleted.test"
        };
    }

    const rawBody = JSON.stringify(payload);

    const signature = crypto
        .createHmac(
            "sha256",
            process.env.PSEUDOGRAM_API_KEY
        )
        .update(rawBody)
        .digest("hex");

    const response = await fetch(
        "http://localhost:3000/webhook",
        {
            method: "POST",

            headers: {
                "Content-Type": "application/json",
                "X-PseudoGram-Signature":
                    `sha256=${signature}`
            },

            body: rawBody
        }
    );

    console.log(
        `${eventType}:`,
        response.status,
        await response.text()
    );
}

// 1. Create comment
await sendEvent("comment.created");

// Give the webhook a tiny amount of time to create the DM job
await new Promise(
    resolve => setTimeout(resolve, 100)
);

// 2. Delete the comment
await sendEvent("comment.deleted");