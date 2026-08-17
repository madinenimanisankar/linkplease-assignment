import express from "express";
import { receiveWebhook } from "../controllers/webhook.controller.js";

const router = express.Router();

router.post("/", receiveWebhook);

export default router;