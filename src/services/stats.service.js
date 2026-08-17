import DMJob from "../models/DMJob.js";
import Stats from "../models/Stats.js";

export async function incrementDuplicatesBlocked() {
    await Stats.findOneAndUpdate(
        { key: "global" },
        {
            $inc: {
                duplicates_blocked: 1
            }
        },
        {
            upsert: true,
            returnDocument: "after"
        }
    );
}

export async function getStats() {
    const [
        sent,
        failed,
        queued,
        stats
    ] = await Promise.all([
        DMJob.countDocuments({
            status: "sent"
        }),

        DMJob.countDocuments({
            status: "failed"
        }),

        DMJob.countDocuments({
            status: {
                $in: [
                    "queued",
                    "processing",
                    "waiting_for_delivery"
                ]
            }
        }),

        Stats.findOne({
            key: "global"
        })
    ]);

    return {
        sent,
        failed,
        queued,
        duplicates_blocked:
            stats?.duplicates_blocked || 0
    };
}