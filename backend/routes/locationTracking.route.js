import express from "express";
import { 
    startLocationTracking, 
    stopLocationTracking, 
    updateLocation, 
    createGeofence, 
    getGeofences, 
    deleteGeofence 
} from "../controllers/locationTracking.controller.js";
import { verifyToken } from "../utils/verifyUser.js";

const router = express.Router();

// Location tracking endpoints
router.post("/start-tracking", verifyToken, startLocationTracking);
router.post("/stop-tracking", verifyToken, stopLocationTracking);
router.post("/update-location", updateLocation);

// Geofence endpoints
router.post("/geofences", verifyToken, createGeofence);
router.get("/geofences", verifyToken, getGeofences);
router.delete("/geofences/:geofenceId", verifyToken, deleteGeofence);

export default router;
