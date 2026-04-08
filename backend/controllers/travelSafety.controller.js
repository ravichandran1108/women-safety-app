import User from "../models/user.model.js";
import { errorHandler } from "../utils/error.js";
import { mail } from "../utils/mail.js";
import createMessage from "../utils/sms.js";

// Store active travel sessions (in production, use Redis)
const activeTravelSessions = new Map();

export const createTravelPlan = async (req, res, next) => {
    const userId = req.user.id;
    const { 
        destination, 
        startDate, 
        endDate, 
        transportation, 
        accommodation, 
        emergencyContacts,
        checkInInterval = 3600000 // Default 1 hour
    } = req.body;

    try {
        const user = await User.findById(userId);
        if (!user) {
            return next(errorHandler(401, "Unauthorized: User not found"));
        }

        const travelPlanId = generateTravelPlanId();
        const travelData = {
            travelPlanId,
            userId,
            userName: user.name,
            destination: {
                address: destination.address,
                lat: parseFloat(destination.lat),
                lon: parseFloat(destination.lon),
                city: destination.city,
                country: destination.country
            },
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            transportation: transportation || 'unknown',
            accommodation: accommodation || 'unknown',
            emergencyContacts: emergencyContacts || user.emergencyContacts,
            checkInInterval,
            status: 'planned', // 'planned', 'active', 'completed', 'cancelled'
            createdAt: new Date(),
            checkIns: [],
            safetyScore: await calculateDestinationSafety(destination),
            alerts: [],
            route: null
        };

        // Initialize travel plans array if it doesn't exist
        if (!user.travelPlans) {
            user.travelPlans = [];
        }

        user.travelPlans.push(travelData);
        await user.save();

        res.status(201).json({
            message: "Travel plan created successfully",
            travelPlan: travelData
        });

    } catch (err) {
        console.error('Error creating travel plan:', err);
        next(errorHandler(500, 'Failed to create travel plan'));
    }
};

export const startTravelJourney = async (req, res, next) => {
    const userId = req.user.id;
    const { travelPlanId } = req.body;

    try {
        const user = await User.findById(userId);
        if (!user) {
            return next(errorHandler(401, "Unauthorized: User not found"));
        }

        const travelPlan = user.travelPlans.id(travelPlanId);
        if (!travelPlan) {
            return next(errorHandler(404, "Travel plan not found"));
        }

        travelPlan.status = 'active';
        travelPlan.journeyStartTime = new Date();
        await user.save();

        // Create active session
        const sessionData = {
            travelPlanId,
            userId,
            startTime: new Date(),
            lastCheckIn: new Date(),
            checkInInterval: travelPlan.checkInInterval,
            emergencyContacts: travelPlan.emergencyContacts,
            destination: travelPlan.destination,
            status: 'active'
        };

        activeTravelSessions.set(travelPlanId, sessionData);

        // Start journey monitoring
        startJourneyMonitoring(travelPlanId);

        res.status(200).json({
            message: "Travel journey started",
            travelPlanId,
            monitoringInterval: travelPlan.checkInInterval
        });

    } catch (err) {
        console.error('Error starting travel journey:', err);
        next(errorHandler(500, 'Failed to start travel journey'));
    }
};

export const checkInDuringTravel = async (req, res, next) => {
    const { travelPlanId, location, status, message } = req.body;

    try {
        const session = activeTravelSessions.get(travelPlanId);
        if (!session) {
            return next(errorHandler(404, "Active travel session not found"));
        }

        const user = await User.findById(session.userId);
        const travelPlan = user.travelPlans.id(travelPlanId);

        if (!travelPlan) {
            return next(errorHandler(404, "Travel plan not found"));
        }

        const checkInData = {
            timestamp: new Date(),
            location: location ? {
                lat: parseFloat(location.lat),
                lon: parseFloat(location.lon),
                address: location.address || 'Unknown Location'
            } : null,
            status: status || 'safe', // 'safe', 'concerned', 'emergency'
            message: message || 'Regular check-in'
        };

        travelPlan.checkIns.push(checkInData);
        session.lastCheckIn = new Date();

        // Assess safety if location provided
        if (location) {
            const safetyAssessment = await assessLocationSafety(location.lat, location.lon);
            checkInData.safetyScore = safetyAssessment.safetyScore;
            
            if (safetyAssessment.safetyScore < 50) {
                await sendTravelAlert(session, checkInData, safetyAssessment);
            }
        }

        await user.save();

        res.status(200).json({
            message: "Check-in recorded successfully",
            checkIn: checkInData
        });

    } catch (err) {
        console.error('Error during travel check-in:', err);
        next(errorHandler(500, 'Failed to record check-in'));
    }
};

export const getTravelPlans = async (req, res, next) => {
    const userId = req.user.id;

    try {
        const user = await User.findById(userId).select('travelPlans');
        
        if (!user) {
            return next(errorHandler(401, "Unauthorized: User not found"));
        }

        res.status(200).json({
            travelPlans: user.travelPlans || []
        });

    } catch (err) {
        console.error('Error fetching travel plans:', err);
        next(errorHandler(500, 'Failed to fetch travel plans'));
    }
};

export const getDestinationSafetyInfo = async (req, res, next) => {
    const { destination } = req.query;

    if (!destination) {
        return next(errorHandler(400, 'Destination is required'));
    }

    try {
        const safetyInfo = await calculateDestinationSafety(destination);
        const travelTips = await generateTravelTips(destination);

        res.status(200).json({
            destination,
            safetyInfo,
            travelTips
        });

    } catch (err) {
        console.error('Error getting destination safety info:', err);
        next(errorHandler(500, 'Failed to get destination safety info'));
    }
};

export const addTravelAlert = async (req, res, next) => {
    const { travelPlanId, alertType, message, location } = req.body;

    try {
        const user = await User.findById(req.user.id);
        const travelPlan = user.travelPlans.id(travelPlanId);

        if (!travelPlan) {
            return next(errorHandler(404, "Travel plan not found"));
        }

        const alertData = {
            id: generateAlertId(),
            type: alertType, // 'delay', 'safety_concern', 'emergency', 'location_change'
            message,
            location: location ? {
                lat: parseFloat(location.lat),
                lon: parseFloat(location.lon),
                address: location.address
            } : null,
            timestamp: new Date(),
            resolved: false
        };

        if (!travelPlan.alerts) {
            travelPlan.alerts = [];
        }

        travelPlan.alerts.push(alertData);

        // Notify emergency contacts for critical alerts
        if (alertType === 'emergency') {
            await notifyTravelEmergency(travelPlan, alertData);
        }

        await user.save();

        res.status(201).json({
            message: "Travel alert added successfully",
            alert: alertData
        });

    } catch (err) {
        console.error('Error adding travel alert:', err);
        next(errorHandler(500, 'Failed to add travel alert'));
    }
};

export const endTravelJourney = async (req, res, next) => {
    const { travelPlanId } = req.body;

    try {
        const user = await User.findById(req.user.id);
        const travelPlan = user.travelPlans.id(travelPlanId);

        if (!travelPlan) {
            return next(errorHandler(404, "Travel plan not found"));
        }

        travelPlan.status = 'completed';
        travelPlan.journeyEndTime = new Date();

        // Remove from active sessions
        activeTravelSessions.delete(travelPlanId);

        await user.save();

        res.status(200).json({
            message: "Travel journey completed successfully"
        });

    } catch (err) {
        console.error('Error ending travel journey:', err);
        next(errorHandler(500, 'Failed to end travel journey'));
    }
};

// Helper functions
function generateTravelPlanId() {
    return 'TRV_' + Math.random().toString(36).substr(2, 9).toUpperCase() + Date.now();
}

function generateAlertId() {
    return 'ALT_' + Math.random().toString(36).substr(2, 9).toUpperCase();
}

async function calculateDestinationSafety(destination) {
    try {
        // Simulate destination safety assessment
        // In production, integrate with travel safety APIs, crime data, weather, etc.
        
        const baseSafetyScore = 70; // Base score
        let riskFactors = [];

        // Simulate different risk factors based on destination
        if (destination.country) {
            // Add country-specific risk factors (simplified)
            const highRiskCountries = ['XYZ', 'ABC']; // Example
            if (highRiskCountries.includes(destination.country)) {
                baseSafetyScore -= 20;
                riskFactors.push('High-risk destination country');
            }
        }

        // Time-based risk (traveling at night)
        const currentHour = new Date().getHours();
        if (currentHour >= 22 || currentHour <= 6) {
            baseSafetyScore -= 10;
            riskFactors.push('Night-time travel');
        }

        // Random factors for demo
        if (Math.random() > 0.7) {
            baseSafetyScore -= 15;
            riskFactors.push('Recent safety incidents in area');
        }

        const safetyScore = Math.max(0, Math.min(100, baseSafetyScore));
        const riskLevel = safetyScore >= 80 ? 'LOW' : safetyScore >= 60 ? 'MODERATE' : safetyScore >= 40 ? 'HIGH' : 'CRITICAL';

        return {
            safetyScore,
            riskLevel,
            riskFactors,
            recommendations: generateSafetyRecommendations(riskLevel, riskFactors)
        };

    } catch (err) {
        console.error('Error calculating destination safety:', err);
        return {
            safetyScore: 50,
            riskLevel: 'MODERATE',
            riskFactors: ['Unable to assess current conditions'],
            recommendations: ['Exercise caution and stay alert']
        };
    }
}

function generateSafetyRecommendations(riskLevel, riskFactors) {
    const recommendations = [
        'Share your itinerary with trusted contacts',
        'Keep your phone charged and portable charger handy',
        'Research emergency numbers at your destination'
    ];

    if (riskLevel === 'HIGH' || riskLevel === 'CRITICAL') {
        recommendations.push(
            'Consider traveling with a companion',
            'Avoid isolated areas, especially at night',
            'Use reputable transportation services',
            'Check in frequently with your contacts'
        );
    }

    if (riskFactors.includes('Night-time travel')) {
        recommendations.push(
            'Avoid walking alone at night',
            'Use well-lit, populated routes',
            'Consider trusted ride-sharing services'
        );
    }

    return recommendations;
}

async function generateTravelTips(destination) {
    return [
        {
            category: 'General Safety',
            tips: [
                'Research your destination before arrival',
                'Keep copies of important documents',
                'Learn basic local phrases',
                'Register with your embassy if traveling internationally'
            ]
        },
        {
            category: 'Transportation',
            tips: [
                'Use reputable taxi or ride-sharing services',
                'Verify driver details before getting in',
                'Share ride details with contacts',
                'Avoid accepting rides from strangers'
            ]
        },
        {
            category: 'Accommodation',
            tips: [
                'Choose well-reviewed accommodations',
                'Lock doors and windows when leaving',
                'Use hotel safe for valuables',
                'Know emergency exits and procedures'
            ]
        },
        {
            category: 'Communication',
            tips: [
                'Get local SIM card or international plan',
                'Download offline maps',
                'Share location with trusted contacts',
                'Establish regular check-in schedule'
            ]
        }
    ];
}

async function assessLocationSafety(lat, lon) {
    // Simplified location safety assessment
    const hour = new Date().getHours();
    const isNight = hour >= 20 || hour <= 6;
    
    let safetyScore = 75; // Base score
    
    if (isNight) safetyScore -= 15;
    if (Math.random() > 0.8) safetyScore -= 10; // Random risk factor
    
    return {
        safetyScore: Math.max(0, Math.min(100, safetyScore)),
        riskLevel: safetyScore >= 70 ? 'LOW' : safetyScore >= 50 ? 'MODERATE' : 'HIGH'
    };
}

function startJourneyMonitoring(travelPlanId) {
    const session = activeTravelSessions.get(travelPlanId);
    if (!session) return;

    const monitoringInterval = setInterval(async () => {
        const currentSession = activeTravelSessions.get(travelPlanId);
        
        if (!currentSession || currentSession.status !== 'active') {
            clearInterval(monitoringInterval);
            return;
        }

        // Check for missed check-ins
        const timeSinceLastCheckIn = Date.now() - new Date(currentSession.lastCheckIn).getTime();
        const maxDelay = currentSession.checkInInterval * 2; // Allow 2x interval delay

        if (timeSinceLastCheckIn > maxDelay) {
            await sendMissedCheckInAlert(currentSession);
        }
    }, session.checkInInterval);
}

async function sendTravelAlert(session, checkInData, safetyAssessment) {
    try {
        const alertMessage = `Travel Safety Alert: ${session.userName} has checked in from a location with safety score ${safetyAssessment.safetyScore}. Location: ${checkInData.location.address}`;
        
        for (const contact of session.emergencyContacts) {
            try {
                await mail(session.userName, contact, '', alertMessage);
                // In production, also send SMS
            } catch (err) {
                console.error('Error sending travel alert:', err);
            }
        }
    } catch (err) {
        console.error('Error sending travel alert:', err);
    }
}

async function sendMissedCheckInAlert(session) {
    try {
        const alertMessage = `Missed Check-in Alert: ${session.userName} was expected to check in but hasn't. Last known location: ${session.destination.address}`;
        
        for (const contact of session.emergencyContacts) {
            try {
                await mail(session.userName, contact, '', alertMessage);
            } catch (err) {
                console.error('Error sending missed check-in alert:', err);
            }
        }
    } catch (err) {
        console.error('Error sending missed check-in alert:', err);
    }
}

async function notifyTravelEmergency(travelPlan, alertData) {
    try {
        const emergencyMessage = `TRAVEL EMERGENCY: ${travelPlan.userName} has reported an emergency during travel to ${travelPlan.destination.address}. Message: ${alertData.message}`;
        
        for (const contact of travelPlan.emergencyContacts) {
            try {
                await mail(travelPlan.userName, contact, '', emergencyMessage);
                await createMessage('', contact.phone);
            } catch (err) {
                console.error('Error notifying travel emergency:', err);
            }
        }
    } catch (err) {
        console.error('Error notifying travel emergency:', err);
    }
}
