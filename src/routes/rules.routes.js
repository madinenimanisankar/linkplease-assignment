import express from "express";
import { createRule } from "../controllers/rules.controller.js";

const router = express.Router();

router.post("/", createRule);

export default router;