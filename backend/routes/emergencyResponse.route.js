import express from "express";
import { 
    initiateEmergencyResponse, 
    updateEmergencyStatus, 
    getEmergencyStatus,
    escalateEmergency,
    addEmergencyContact,
    getEmergencyHistory
} from "../controllers/emergencyResponse.controller.js";
import { verifyToken } from "../utils/verifyUser.js";

const router = express.Router();

// Emergency response endpoints
router.post("/initiate", verifyToken, initiateEmergencyResponse);
router.put("/update", verifyToken, updateEmergencyStatus);
router.get("/status/:emergencyId", verifyToken, getEmergencyStatus);
router.post("/escalate", verifyToken, escalateEmergency);
router.post("/add-contact", verifyToken, addEmergencyContact);
router.get("/history", verifyToken, getEmergencyHistory);

export default router;
