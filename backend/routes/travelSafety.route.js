import express from "express";
import { 
    createTravelPlan, 
    startTravelJourney, 
    checkInDuringTravel,
    getTravelPlans,
    getDestinationSafetyInfo,
    addTravelAlert,
    endTravelJourney
} from "../controllers/travelSafety.controller.js";
import { verifyToken } from "../utils/verifyUser.js";

const router = express.Router();

// Travel plan endpoints
router.post("/plans", verifyToken, createTravelPlan);
router.get("/plans", verifyToken, getTravelPlans);
router.post("/journey/start", verifyToken, startTravelJourney);
router.post("/journey/checkin", checkInDuringTravel);
router.post("/journey/end", verifyToken, endTravelJourney);

// Travel safety info
router.get("/destination-safety", verifyToken, getDestinationSafetyInfo);

// Travel alerts
router.post("/alerts", verifyToken, addTravelAlert);

export default router;
