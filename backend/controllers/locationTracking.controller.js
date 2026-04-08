import User from "../models/user.model.js";
import { errorHandler } from "../utils/error.js";
import { mail } from "../utils/mail.js";
import createMessage from "../utils/sms.js";

// Store active location tracking sessions (in production, use Redis)
const activeTrackingSessions = new Map();

export const startLocationTracking = async (req, res, next) => {
    const userId = req.user.id;
    const { duration = 3600000, checkInterval = 30000, emergencyContacts } = req.body; // Default 1 hour, 30 second intervals

    try {
        const user = await User.findById(userId);
        if (!user) {
            return next(errorHandler(401, "Unauthorized: User not found"));
        }

        // Create tracking session
        const sessionId = generateSessionId();
        const trackingData = {
            userId,
            startTime: new Date(),
            endTime: new Date(Date.now() + duration),
            checkInterval,
            emergencyContacts: emergencyContacts || user.emergencyContacts,
            lastLocation: null,
            alertsSent: [],
            isActive: true
        };

        activeTrackingSessions.set(sessionId, trackingData);

        // Start monitoring (in production, use background jobs)
        startLocationMonitoring(sessionId);

        res.status(200).json({
            sessionId,
            message: "Location tracking started successfully",
            duration,
            checkInterval
        });

    } catch (err) {
        console.error('Error starting location tracking:', err);
        next(errorHandler(500, 'Failed to start location tracking'));
    }
};

export const stopLocationTracking = async (req, res, next) => {
    const userId = req.user.id;
    const { sessionId } = req.body;

    try {
        const session = activeTrackingSessions.get(sessionId);
        
        if (!session || session.userId !== userId) {
            return next(errorHandler(404, "Tracking session not found"));
        }

        session.isActive = false;
        activeTrackingSessions.delete(sessionId);

        res.status(200).json({
            message: "Location tracking stopped successfully"
        });

    } catch (err) {
        console.error('Error stopping location tracking:', err);
        next(errorHandler(500, 'Failed to stop location tracking'));
    }
};

export const updateLocation = async (req, res, next) => {
    const { sessionId, lat, lon, timestamp } = req.body;

    try {
        const session = activeTrackingSessions.get(sessionId);
        
        if (!session || !session.isActive) {
            return next(errorHandler(404, "Active tracking session not found"));
        }

        // Update location
        const locationData = {
            lat: parseFloat(lat),
            lon: parseFloat(lon),
            timestamp: timestamp || new Date().toISOString(),
            sessionId
        };

        session.lastLocation = locationData;

        // Check if user is in safe zone
        const safetyAssessment = await assessLocationSafety(lat, lon);
        
        // Check for geofence alerts
        await checkGeofenceAlerts(session, locationData, safetyAssessment);

        res.status(200).json({
            message: "Location updated successfully",
            safetyScore: safetyAssessment.safetyScore,
            riskLevel: safetyAssessment.riskLevel
        });

    } catch (err) {
        console.error('Error updating location:', err);
        next(errorHandler(500, 'Failed to update location'));
    }
};

export const createGeofence = async (req, res, next) => {
    const userId = req.user.id;
    const { name, lat, lon, radius, type, alertConditions } = req.body;

    try {
        const user = await User.findById(userId);
        if (!user) {
            return next(errorHandler(401, "Unauthorized: User not found"));
        }

        const geofence = {
            id: generateGeofenceId(),
            name,
            center: { lat: parseFloat(lat), lon: parseFloat(lon) },
            radius: parseFloat(radius), // in meters
            type: type || 'safety', // 'safety', 'danger', 'waypoint'
            alertConditions: alertConditions || {
                entry: true,
                exit: true,
                dwellTime: 300000 // 5 minutes
            },
            createdAt: new Date(),
            isActive: true
        };

        // Initialize geofences array if it doesn't exist
        if (!user.geofences) {
            user.geofences = [];
        }

        user.geofences.push(geofence);
        await user.save();

        res.status(201).json({
            message: "Geofence created successfully",
            geofence
        });

    } catch (err) {
        console.error('Error creating geofence:', err);
        next(errorHandler(500, 'Failed to create geofence'));
    }
};

export const getGeofences = async (req, res, next) => {
    const userId = req.user.id;

    try {
        const user = await User.findById(userId).select('geofences');
        
        if (!user) {
            return next(errorHandler(401, "Unauthorized: User not found"));
        }

        res.status(200).json({
            geofences: user.geofences || []
        });

    } catch (err) {
        console.error('Error fetching geofences:', err);
        next(errorHandler(500, 'Failed to fetch geofences'));
    }
};

export const deleteGeofence = async (req, res, next) => {
    const userId = req.user.id;
    const { geofenceId } = req.params;

    try {
        const user = await User.findById(userId);
        
        if (!user) {
            return next(errorHandler(401, "Unauthorized: User not found"));
        }

        if (!user.geofences) {
            return next(errorHandler(404, "No geofences found"));
        }

        user.geofences = user.geofences.filter(gf => gf.id !== geofenceId);
        await user.save();

        res.status(200).json({
            message: "Geofence deleted successfully"
        });

    } catch (err) {
        console.error('Error deleting geofence:', err);
        next(errorHandler(500, 'Failed to delete geofence'));
    }
};

// Helper functions
function generateSessionId() {
    return 'session_' + Math.random().toString(36).substr(2, 9) + Date.now();
}

function generateGeofenceId() {
    return 'gf_' + Math.random().toString(36).substr(2, 9);
}

function startLocationMonitoring(sessionId) {
    const session = activeTrackingSessions.get(sessionId);
    if (!session) return;

    const monitorInterval = setInterval(async () => {
        const currentSession = activeTrackingSessions.get(sessionId);
        
        if (!currentSession || !currentSession.isActive) {
            clearInterval(monitorInterval);
            return;
        }

        // Check if session has expired
        if (new Date() > currentSession.endTime) {
            currentSession.isActive = false;
            activeTrackingSessions.delete(sessionId);
            clearInterval(monitorInterval);
            return;
        }

        // Check for missed location updates
        if (currentSession.lastLocation) {
            const timeSinceLastUpdate = Date.now() - new Date(currentSession.lastLocation.timestamp).getTime();
            const maxDelay = currentSession.checkInterval * 3; // Allow 3 intervals of delay

            if (timeSinceLastUpdate > maxDelay) {
                await sendMissedUpdateAlert(currentSession);
            }
        }
    }, session.checkInterval);
}

async function assessLocationSafety(lat, lon) {
    // Simplified safety assessment - integrate with the full safety assessment controller
    const hour = new Date().getHours();
    const isNight = hour >= 20 || hour <= 6;
    
    let safetyScore = 75; // Base score
    
    if (isNight) safetyScore -= 15;
    if (Math.random() > 0.7) safetyScore -= 10; // Random risk factor
    
    return {
        safetyScore: Math.max(0, Math.min(100, safetyScore)),
        riskLevel: safetyScore >= 70 ? 'LOW' : safetyScore >= 50 ? 'MODERATE' : 'HIGH'
    };
}

async function checkGeofenceAlerts(session, locationData, safetyAssessment) {
    try {
        const user = await User.findById(session.userId);
        if (!user || !user.geofences) return;

        for (const geofence of user.geofences) {
            if (!geofence.isActive) continue;

            const distance = calculateDistance(
                locationData.lat, locationData.lon,
                geofence.center.lat, geofence.center.lon
            );

            const isInside = distance <= geofence.radius;
            const wasInside = session.lastLocation ? 
                calculateDistance(
                    session.lastLocation.lat, session.lastLocation.lon,
                    geofence.center.lat, geofence.center.lon
                ) <= geofence.radius : false;

            // Check for entry/exit alerts
            if (isInside && !wasInside && geofence.alertConditions.entry) {
                await sendGeofenceAlert(session, geofence, 'entry', locationData);
            } else if (!isInside && wasInside && geofence.alertConditions.exit) {
                await sendGeofenceAlert(session, geofence, 'exit', locationData);
            }

            // Check for safety alerts in dangerous areas
            if (isInside && geofence.type === 'danger' && safetyAssessment.riskLevel !== 'LOW') {
                await sendSafetyAlert(session, locationData, safetyAssessment);
            }
        }
    } catch (err) {
        console.error('Error checking geofence alerts:', err);
    }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
}

async function sendGeofenceAlert(session, geofence, eventType, locationData) {
    const alertKey = `${geofence.id}_${eventType}`;
    
    // Prevent duplicate alerts within 5 minutes
    if (session.alertsSent.some(alert => alert.key === alertKey && 
        Date.now() - alert.timestamp < 300000)) {
        return;
    }

    const user = await User.findById(session.userId);
    const locationUrl = `https://www.google.com/maps/search/?api=1&query=${locationData.lat},${locationData.lon}`;
    
    const message = `🚨 Geofence Alert: ${user.name} has ${eventType}ed ${geofence.name} area. Location: ${locationUrl}`;
    
    // Send alerts to emergency contacts
    for (const contact of session.emergencyContacts) {
        try {
            await mail(user.name, contact, locationUrl, `Geofence ${eventType} Alert`);
            // In production, also send SMS
        } catch (err) {
            console.error('Error sending geofence alert:', err);
        }
    }

    session.alertsSent.push({ key: alertKey, timestamp: Date.now() });
}

async function sendSafetyAlert(session, locationData, safetyAssessment) {
    const alertKey = 'safety_alert';
    
    if (session.alertsSent.some(alert => alert.key === alertKey && 
        Date.now() - alert.timestamp < 600000)) { // 10 minutes
        return;
    }

    const user = await User.findById(session.userId);
    const locationUrl = `https://www.google.com/maps/search/?api=1&query=${locationData.lat},${locationData.lon}`;
    
    const message = `⚠️ Safety Alert: ${user.name} is in a high-risk area (Safety Score: ${safetyAssessment.safetyScore}). Location: ${locationUrl}`;
    
    for (const contact of session.emergencyContacts) {
        try {
            await mail(user.name, contact, locationUrl, 'High-Risk Area Alert');
        } catch (err) {
            console.error('Error sending safety alert:', err);
        }
    }

    session.alertsSent.push({ key: alertKey, timestamp: Date.now() });
}

async function sendMissedUpdateAlert(session) {
    const alertKey = 'missed_update';
    
    if (session.alertsSent.some(alert => alert.key === alertKey && 
        Date.now() - alert.timestamp < 1800000)) { // 30 minutes
        return;
    }

    const user = await User.findById(session.userId);
    const lastLocation = session.lastLocation;
    
    if (lastLocation) {
        const locationUrl = `https://www.google.com/maps/search/?api=1&query=${lastLocation.lat},${lastLocation.lon}`;
        
        for (const contact of session.emergencyContacts) {
            try {
                await mail(user.name, contact, locationUrl, 'Location Tracking Alert');
            } catch (err) {
                console.error('Error sending missed update alert:', err);
            }
        }
    }

    session.alertsSent.push({ key: alertKey, timestamp: Date.now() });
}
