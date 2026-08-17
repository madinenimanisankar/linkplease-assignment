import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { connectDatabase } from "./database/mongodb.js";
import rulesRouter from "./routes/rules.routes.js";
import webhookRouter from "./routes/webhook.routes.js";
import statsRouter from "./routes/stats.routes.js";
import { startDMWorker } from "./workers/dm.worker.js";

dotenv.config();

const app = express();

app.use(cors());

app.use(
    express.json({
        verify: (req, res, buffer) => {
            req.rawBody = buffer;
        }
    })
);

app.use("/rules", rulesRouter);
app.use("/webhook", webhookRouter);
app.use("/stats", statsRouter);

app.get("/", (req, res) => {
    res.json({
        message: "LinkPlease assignment API is running"
    });
});

const PORT = process.env.PORT || 3000;

async function startServer() {
    await connectDatabase();

    startDMWorker();

    app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on port ${PORT}`);
    });
}

startServer();