import mongoose from "mongoose";

const ruleSchema = new mongoose.Schema(
    {
        rule_id: {
            type: String,
            required: true,
            unique: true
        },

        keyword: {
            type: String,
            required: true
        },

        dm_message: {
            type: String,
            required: true
        }
    },
    {
        timestamps: true
    }
);

const Rule = mongoose.model("Rule", ruleSchema);

export default Rule;