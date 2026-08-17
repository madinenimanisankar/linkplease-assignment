import express from "express";
import { getStatsController } from "../controllers/stats.controller.js";

const router = express.Router();

router.get("/", getStatsController);

export default router;