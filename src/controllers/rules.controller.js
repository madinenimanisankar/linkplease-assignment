import crypto from "crypto";
import Rule from "../models/Rule.js";

export async function createRule(req, res) {
    try {
        const { keyword, dm_message } = req.body;

        if (!keyword || !dm_message) {
            return res.status(400).json({
                error: "keyword and dm_message are required"
            });
        }

        const rule = await Rule.create({
            rule_id: crypto.randomUUID(),
            keyword: keyword.trim(),
            dm_message
        });

        return res.status(201).json({
            rule_id: rule.rule_id,
            keyword: rule.keyword,
            dm_message: rule.dm_message
        });

    } catch (error) {
        console.error("Failed to create rule:", error);

        return res.status(500).json({
            error: "Internal server error"
        });
    }
}