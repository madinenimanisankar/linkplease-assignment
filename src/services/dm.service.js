export async function sendDM(job) {
    const url = `${process.env.PSEUDOGRAM_BASE_URL}/v1/dm/send`;

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-API-Key": process.env.PSEUDOGRAM_API_KEY,
            "Idempotency-Key": `${job.rule_id}:${job.user_id}`
        },
        body: JSON.stringify({
            recipient_user_id: job.user_id,
            message: job.message,
            comment_id: job.comment_id
        })
    });

    const rawBody = await response.text();

    let body;

    try {
        body = JSON.parse(rawBody);
    } catch {
        body = {
            raw: rawBody
        };
    }

    console.log("PseudoGram DM response:", {
        status: response.status,
        body,
        retryAfter: response.headers.get("retry-after")
    });

    return {
        status: response.status,
        retryAfter: response.headers.get("retry-after"),
        body
    };
}
export async function getDMStatus(dmId) {
    const url =
        `${process.env.PSEUDOGRAM_BASE_URL}/v1/dm/${dmId}`;

    const response = await fetch(url, {
        method: "GET",
        headers: {
            "X-API-Key": process.env.PSEUDOGRAM_API_KEY
        }
    });

    const body = await response.json();

    return {
        status: response.status,
        body
    };
}