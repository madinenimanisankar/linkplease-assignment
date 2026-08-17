import mongoose from "mongoose";

const dmJobSchema = new mongoose.Schema(
    {
        job_id: {
            type: String,
            required: true,
            unique: true
        },

        rule_id: {
            type: String,
            required: true
        },

        user_id: {
            type: String,
            required: true
        },

        comment_id: {
            type: String,
            required: true
        },

        message: {
            type: String,
            required: true
        },

        status: {
            type: String,
            enum: [
    "queued",
    "processing",
    "waiting_for_delivery",
    "sent",
    "failed",
    "cancelled"
],
            default: "queued",
            index: true
        },

        attempts: {
            type: Number,
            default: 0
        },

        retry_count: {
            type: Number,
            default: 0
        },

        last_error: {
            type: String,
            default: null
        },

        dm_id: {
            type: String,
            default: null
        },

        next_retry_at: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

dmJobSchema.index(
    { rule_id: 1, user_id: 1 },
    { unique: true }
);

const DMJob = mongoose.model("DMJob", dmJobSchema);

export default DMJob;