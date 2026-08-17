import Event from "../models/Event.js";

import {
    verifyWebhookSignature,
    processWebhookEvent,
    handleCommentDeleted
} from "../services/webhook.service.js";

import {
    incrementDuplicatesBlocked
} from "../services/stats.service.js";

export async function receiveWebhook(req, res) {
    const signature = req.headers["x-pseudogram-signature"];

    const isValid = verifyWebhookSignature(
        req.rawBody,
        signature
    );

    if (!isValid) {
        return res.status(401).json({
            error: "invalid_signature"
        });
    }

    const payload = req.body;

    if (!payload.event_id || !payload.event_type) {
        return res.status(400).json({
            error: "invalid_event"
        });
    }

    try {
        await Event.create({
            event_id: payload.event_id,
            event_type: payload.event_type,
            comment_id: payload.data?.comment_id,
            user_id: payload.data?.from?.user_id || null,
            text: payload.data?.text || ""
        });
    } catch (error) {
        if (error.code === 11000) {
            await incrementDuplicatesBlocked();

            return res.status(200).json({
                received: true,
                duplicate: true
            });
        }

        console.error(
            "Failed to store webhook event:",
            error
        );

        return res.status(500).json({
            error: "failed_to_store_event"
        });
    }

    // Handle deleted comments before normal comment processing
    if (payload.event_type === "comment.deleted") {
        handleCommentDeleted(
            payload.data?.comment_id
        ).catch((error) => {
            console.error(
                "Background deleted-comment processing failed:",
                error
            );
        });

        return res.status(200).json({
            received: true
        });
    }

    // Important:
    // Don't wait for DM processing.
    processWebhookEvent(payload).catch((error) => {
        console.error(
            "Background webhook processing failed:",
            error
        );
    });

    return res.status(200).json({
        received: true
    });
}