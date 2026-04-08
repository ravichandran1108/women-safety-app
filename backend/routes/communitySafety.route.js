import express from "express";
import { 
    createSafetyAlert, 
    getNearbyAlerts, 
    markAlertHelpful, 
    addCommentToAlert,
    getCommunityStats,
    joinSafetyPatrol,
    getSafetyPatrolMembers
} from "../controllers/communitySafety.controller.js";
import { verifyToken } from "../utils/verifyUser.js";

const router = express.Router();

// Safety alerts endpoints
router.post("/alerts", verifyToken, createSafetyAlert);
router.get("/alerts/nearby", verifyToken, getNearbyAlerts);
router.post("/alerts/helpful", verifyToken, markAlertHelpful);
router.post("/alerts/comment", verifyToken, addCommentToAlert);

// Community stats
router.get("/stats", verifyToken, getCommunityStats);

// Safety patrol endpoints
router.post("/patrol/join", verifyToken, joinSafetyPatrol);
router.get("/patrol/members", verifyToken, getSafetyPatrolMembers);

export default router;
