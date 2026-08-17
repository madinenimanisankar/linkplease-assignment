import { getStats } from "../services/stats.service.js";

export async function getStatsController(req, res) {
    try {
        const stats = await getStats();

        return res.status(200).json(stats);
    } catch (error) {
        console.error("Failed to get stats:", error);

        return res.status(500).json({
            error: "Internal server error"
        });
    }
}