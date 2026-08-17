import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const payload = {
    event_id: crypto.randomUUID(),
    event_type: "comment.created",
    sent_at: new Date().toISOString(),
    data: {
        comment_id: crypto.randomUUID(),
        post_id: "post_test",
        text: "PRICE please",
        created_at: new Date().toISOString(),
        from: {
            user_id: `usr_test_${Date.now()}`,
            username: "test.user"
        }
    }
};

const rawBody = JSON.stringify(payload);

const signature = crypto
    .createHmac("sha256", process.env.PSEUDOGRAM_API_KEY)
    .update(rawBody)
    .digest("hex");

const response = await fetch("http://localhost:3000/webhook", {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        "X-PseudoGram-Signature": `sha256=${signature}`
    },
    body: rawBody
});

console.log("Status:", response.status);
console.log("Response:", await response.text());