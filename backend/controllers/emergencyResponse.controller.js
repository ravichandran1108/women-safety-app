import User from "../models/user.model.js";
import { errorHandler } from "../utils/error.js";
import { mail } from "../utils/mail.js";
import createMessage, { createCall } from "../utils/sms.js";

// Store active emergency sessions (in production, use Redis)
const activeEmergencies = new Map();

export const initiateEmergencyResponse = async (req, res, next) => {
    const userId = req.user.id;
    const { emergencyType, severity, location, description, contacts } = req.body;

    try {
        const user = await User.findById(userId);
        if (!user) {
            return next(errorHandler(401, "Unauthorized: User not found"));
        }

        const emergencyId = generateEmergencyId();
        const emergencyData = {
            emergencyId,
            userId,
            userName: user.name,
            type: emergencyType || 'general', // 'medical', 'assault', 'theft', 'harassment', 'general'
            severity: severity || 'medium', // 'low', 'medium', 'high', 'critical'
            location: {
                lat: parseFloat(location.lat),
                lon: parseFloat(location.lon),
                address: location.address || 'Unknown Location'
            },
            description: description || 'Emergency situation',
            contacts: contacts || user.emergencyContacts,
            status: 'active',
            timestamp: new Date(),
            escalationLevel: 1,
            notificationsSent: [],
            responseActions: [],
            resolvedAt: null
        };

        activeEmergencies.set(emergencyId, emergencyData);

        // Start emergency response protocol
        await startEmergencyProtocol(emergencyData);

        res.status(201).json({
            message: "Emergency response initiated",
            emergencyId,
            protocol: "Emergency contacts notified, monitoring started"
        });

    } catch (err) {
        console.error('Error initiating emergency response:', err);
        next(errorHandler(500, 'Failed to initiate emergency response'));
    }
};

export const updateEmergencyStatus = async (req, res, next) => {
    const { emergencyId, status, userLocation, message } = req.body;

    try {
        const emergency = activeEmergencies.get(emergencyId);
        if (!emergency) {
            return next(errorHandler(404, "Emergency session not found"));
        }

        // Update emergency status
        if (status) {
            emergency.status = status;
            if (status === 'resolved') {
                emergency.resolvedAt = new Date();
            }
        }

        // Update user location if provided
        if (userLocation) {
            emergency.currentLocation = {
                lat: parseFloat(userLocation.lat),
                lon: parseFloat(userLocation.lon),
                timestamp: new Date()
            };
        }

        // Add message or action
        if (message) {
            emergency.responseActions.push({
                type: 'user_update',
                message,
                timestamp: new Date()
            });
        }

        // Check if escalation is needed
        if (emergency.status === 'active') {
            await checkEscalation(emergency);
        }

        res.status(200).json({
            message: "Emergency status updated",
            emergency: {
                status: emergency.status,
                escalationLevel: emergency.escalationLevel,
                responseActions: emergency.responseActions
            }
        });

    } catch (err) {
        console.error('Error updating emergency status:', err);
        next(errorHandler(500, 'Failed to update emergency status'));
    }
};

export const getEmergencyStatus = async (req, res, next) => {
    const { emergencyId } = req.params;

    try {
        const emergency = activeEmergencies.get(emergencyId);
        if (!emergency) {
            return next(errorHandler(404, "Emergency session not found"));
        }

        res.status(200).json({
            emergency: {
                emergencyId: emergency.emergencyId,
                status: emergency.status,
                type: emergency.type,
                severity: emergency.severity,
                location: emergency.location,
                currentLocation: emergency.currentLocation,
                escalationLevel: emergency.escalationLevel,
                responseActions: emergency.responseActions,
                timestamp: emergency.timestamp,
                resolvedAt: emergency.resolvedAt
            }
        });

    } catch (err) {
        console.error('Error getting emergency status:', err);
        next(errorHandler(500, 'Failed to get emergency status'));
    }
};

export const escalateEmergency = async (req, res, next) => {
    const { emergencyId, reason } = req.body;

    try {
        const emergency = activeEmergencies.get(emergencyId);
        if (!emergency) {
            return next(errorHandler(404, "Emergency session not found"));
        }

        emergency.escalationLevel += 1;
        emergency.responseActions.push({
            type: 'escalation',
            reason: reason || 'Manual escalation',
            timestamp: new Date()
        });

        await performEscalation(emergency);

        res.status(200).json({
            message: "Emergency escalated successfully",
            escalationLevel: emergency.escalationLevel
        });

    } catch (err) {
        console.error('Error escalating emergency:', err);
        next(errorHandler(500, 'Failed to escalate emergency'));
    }
};

export const addEmergencyContact = async (req, res, next) => {
    const userId = req.user.id;
    const { emergencyId, contactInfo } = req.body;

    try {
        const emergency = activeEmergencies.get(emergencyId);
        if (!emergency) {
            return next(errorHandler(404, "Emergency session not found"));
        }

        // Add new contact to emergency
        emergency.contacts.push(contactInfo);
        emergency.responseActions.push({
            type: 'contact_added',
            contact: contactInfo,
            timestamp: new Date()
        });

        // Notify the new contact
        await notifyEmergencyContact(emergency, contactInfo);

        res.status(200).json({
            message: "Emergency contact added and notified",
            contact: contactInfo
        });

    } catch (err) {
        console.error('Error adding emergency contact:', err);
        next(errorHandler(500, 'Failed to add emergency contact'));
    }
};

export const getEmergencyHistory = async (req, res, next) => {
    const userId = req.user.id;

    try {
        const user = await User.findById(userId);
        if (!user) {
            return next(errorHandler(401, "Unauthorized: User not found"));
        }

        // Get emergency history from user profile (if stored) or active emergencies
        const userEmergencies = Array.from(activeEmergencies.values())
            .filter(emergency => emergency.userId === userId);

        res.status(200).json({
            emergencies: userEmergencies.map(emergency => ({
                emergencyId: emergency.emergencyId,
                type: emergency.type,
                severity: emergency.severity,
                status: emergency.status,
                timestamp: emergency.timestamp,
                resolvedAt: emergency.resolvedAt,
                escalationLevel: emergency.escalationLevel
            }))
        });

    } catch (err) {
        console.error('Error getting emergency history:', err);
        next(errorHandler(500, 'Failed to get emergency history'));
    }
};

// Helper functions
function generateEmergencyId() {
    return 'EMG_' + Math.random().toString(36).substr(2, 9).toUpperCase() + Date.now();
}

async function startEmergencyProtocol(emergency) {
    try {
        console.log(`Starting emergency protocol for ${emergency.emergencyId}`);
        
        // Level 1: Notify emergency contacts
        await notifyEmergencyContacts(emergency);
        
        // Start monitoring
        startEmergencyMonitoring(emergency);
        
        // Log the action
        emergency.responseActions.push({
            type: 'protocol_started',
            timestamp: new Date()
        });

    } catch (err) {
        console.error('Error starting emergency protocol:', err);
    }
}

async function notifyEmergencyContacts(emergency) {
    try {
        const locationUrl = `https://www.google.com/maps/search/?api=1&query=${emergency.location.lat},${emergency.location.lon}`;
        
        for (const contact of emergency.contacts) {
            try {
                // Send email
                await mail(emergency.userName, contact, locationUrl, `Emergency Alert: ${emergency.type}`);
                
                // Send SMS
                await createMessage(locationUrl, contact.phone);
                
                emergency.notificationsSent.push({
                    contact: contact,
                    method: 'email_sms',
                    timestamp: new Date()
                });
                
            } catch (err) {
                console.error(`Error notifying contact ${contact.name}:`, err);
            }
        }
        
        emergency.responseActions.push({
            type: 'contacts_notified',
            contactsCount: emergency.contacts.length,
            timestamp: new Date()
        });

    } catch (err) {
        console.error('Error notifying emergency contacts:', err);
    }
}

async function notifyEmergencyContact(emergency, contact) {
    try {
        const locationUrl = `https://www.google.com/maps/search/?api=1&query=${emergency.location.lat},${emergency.location.lon}`;
        
        await mail(emergency.userName, contact, locationUrl, `Emergency Alert: ${emergency.type}`);
        await createMessage(locationUrl, contact.phone);
        
    } catch (err) {
        console.error(`Error notifying emergency contact ${contact.name}:`, err);
    }
}

function startEmergencyMonitoring(emergency) {
    const monitoringInterval = setInterval(async () => {
        const currentEmergency = activeEmergencies.get(emergency.emergencyId);
        
        if (!currentEmergency || currentEmergency.status === 'resolved') {
            clearInterval(monitoringInterval);
            return;
        }

        // Check if escalation is needed based on time
        const timeElapsed = Date.now() - new Date(currentEmergency.timestamp).getTime();
        const escalationThresholds = [5 * 60 * 1000, 15 * 60 * 1000, 30 * 60 * 1000]; // 5min, 15min, 30min
        
        for (let i = 0; i < escalationThresholds.length; i++) {
            if (timeElapsed > escalationThresholds[i] && currentEmergency.escalationLevel <= i + 1) {
                await performEscalation(currentEmergency);
                break;
            }
        }
    }, 60000); // Check every minute
}

async function checkEscalation(emergency) {
    // Check if automatic escalation is needed
    const timeElapsed = Date.now() - new Date(emergency.timestamp).getTime();
    
    if (emergency.severity === 'critical' && timeElapsed > 2 * 60 * 1000 && emergency.escalationLevel < 2) {
        await performEscalation(emergency);
    } else if (emergency.severity === 'high' && timeElapsed > 5 * 60 * 1000 && emergency.escalationLevel < 2) {
        await performEscalation(emergency);
    }
}

async function performEscalation(emergency) {
    try {
        emergency.escalationLevel += 1;
        
        const escalationActions = {
            2: 'notify_authorities', // Level 2: Consider notifying authorities
            3: 'broadcast_alert',    // Level 3: Broadcast to community
            4: 'emergency_services'  // Level 4: Direct emergency services
        };
        
        const action = escalationActions[emergency.escalationLevel];
        
        switch (action) {
            case 'notify_authorities':
                // In production, integrate with local police/emergency services API
                console.log('Notifying authorities for emergency:', emergency.emergencyId);
                emergency.responseActions.push({
                    type: 'authorities_notified',
                    timestamp: new Date()
                });
                break;
                
            case 'broadcast_alert':
                // Broadcast to community safety network
                console.log('Broadcasting emergency to community:', emergency.emergencyId);
                emergency.responseActions.push({
                    type: 'community_broadcast',
                    timestamp: new Date()
                });
                break;
                
            case 'emergency_services':
                // Direct call to emergency services
                console.log('Calling emergency services for:', emergency.emergencyId);
                emergency.responseActions.push({
                    type: 'emergency_services_called',
                    timestamp: new Date()
                });
                break;
        }
        
        // Re-notify contacts about escalation
        await notifyEscalation(emergency);
        
    } catch (err) {
        console.error('Error performing escalation:', err);
    }
}

async function notifyEscalation(emergency) {
    try {
        const escalationMessage = `EMERGENCY ESCALATED to Level ${emergency.escalationLevel} for ${emergency.userName}. Immediate attention required.`;
        
        for (const contact of emergency.contacts) {
            try {
                // Send escalation notification
                await mail(emergency.userName, contact, '', escalationMessage);
                // In production, also send urgent SMS
            } catch (err) {
                console.error(`Error sending escalation to ${contact.name}:`, err);
            }
        }
        
    } catch (err) {
        console.error('Error notifying escalation:', err);
    }
}
