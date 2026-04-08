import express from "express";
import { assessLocationSafety, getSafeRoute, getSafetyTips } from "../controllers/safetyAssessment.controller.js";
import { verifyToken } from "../utils/verifyUser.js";

const router = express.Router();

router.post("/assess-location", verifyToken, assessLocationSafety);
router.post("/safe-route", verifyToken, getSafeRoute);
router.get("/safety-tips", verifyToken, getSafetyTips);

export default router;
