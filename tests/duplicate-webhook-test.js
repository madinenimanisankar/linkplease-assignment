import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const payload = {
    event_id: "evt_duplicate_test_001",
    event_type: "comment.created",
    sent_at: new Date().toISOString(),
    data: {
        comment_id: "cmt_duplicate_test_001",
        post_id: "post_test",
        text: "PRICE please",
        created_at: new Date().toISOString(),
        from: {
            user_id: "usr_duplicate_test_001",
            username: "test.user"
        }
    }
};

const rawBody = JSON.stringify(payload);

const signature = crypto
    .createHmac(
        "sha256",
        process.env.PSEUDOGRAM_API_KEY
    )
    .update(rawBody)
    .digest("hex");

async function sendWebhook() {
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
        "Status:",
        response.status
    );

    console.log(
        "Response:",
        await response.text()
    );
}

await sendWebhook();

await new Promise(
    resolve => setTimeout(resolve, 1000)
);

await sendWebhook();