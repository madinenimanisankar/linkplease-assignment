import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const userId = "usr_same_user_test_001";

async function sendWebhook(commentNumber) {
    const payload = {
        event_id: `evt_same_user_${commentNumber}_${Date.now()}`,
        event_type: "comment.created",
        sent_at: new Date().toISOString(),

        data: {
            comment_id: `cmt_same_user_${commentNumber}_${Date.now()}`,
            post_id: "post_same_user_test",

            text: commentNumber === 1
                ? "PRICE please"
                : "PRICE again please",

            created_at: new Date().toISOString(),

            from: {
                user_id: userId,
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
        `Comment ${commentNumber}:`,
        response.status,
        await response.text()
    );
}

await sendWebhook(1);

await new Promise(
    resolve => setTimeout(resolve, 3000)
);

await sendWebhook(2);