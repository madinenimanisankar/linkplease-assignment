import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
    {
        event_id: {
            type: String,
            required: true,
            unique: true,
            index: true
        },

        event_type: {
            type: String,
            required: true
        },

        comment_id: {
            type: String,
            required: true,
            index: true
        },

        user_id: {
            type: String,
            default: null,
            index: true
        },

        text: {
            type: String,
            default: ""
        },

        processed: {
            type: Boolean,
            default: false
        }
    },
    {
        timestamps: true
    }
);

const Event = mongoose.model("Event", eventSchema);

export default Event;