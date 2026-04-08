import User from "../models/user.model.js";
import { errorHandler } from "../utils/error.js";
import { mail } from "../utils/mail.js";
import createMessage from "../utils/sms.js";

export const createSafetyAlert = async (req, res, next) => {
    const userId = req.user.id;
    const { type, description, location, severity, anonymous } = req.body;

    try {
        const user = await User.findById(userId);
        if (!user) {
            return next(errorHandler(401, "Unauthorized: User not found"));
        }

        const safetyAlert = {
            id: generateAlertId(),
            userId: anonymous ? null : userId,
            userName: anonymous ? 'Anonymous User' : user.name,
            type, // 'suspicious_activity', 'harassment', 'theft', 'assault', 'safe_zone'
            description,
            location: {
                lat: parseFloat(location.lat),
                lon: parseFloat(location.lon),
                address: location.address || 'Unknown Location'
            },
            severity: severity || 'medium', // 'low', 'medium', 'high', 'critical'
            anonymous: anonymous || false,
            timestamp: new Date(),
            verified: false,
            helpfulCount: 0,
            comments: [],
            isActive: true
        };

        // Initialize safety alerts array if it doesn't exist
        if (!user.safetyAlerts) {
            user.safetyAlerts = [];
        }

        user.safetyAlerts.push(safetyAlert);
        await user.save();

        // Notify nearby users (in production, use geospatial queries)
        await notifyNearbyUsers(safetyAlert, user);

        res.status(201).json({
            message: "Safety alert created successfully",
            alert: safetyAlert
        });

    } catch (err) {
        console.error('Error creating safety alert:', err);
        next(errorHandler(500, 'Failed to create safety alert'));
    }
};

export const getNearbyAlerts = async (req, res, next) => {
    const { lat, lon, radius = 5000 } = req.query; // Default 5km radius

    if (!lat || !lon) {
        return next(errorHandler(400, 'Latitude and longitude are required'));
    }

    try {
        // Get all active safety alerts from all users
        const usersWithAlerts = await User.find({
            'safetyAlerts.isActive': true
        }).select('safetyAlerts name');

        const allAlerts = [];
        const userLat = parseFloat(lat);
        const userLon = parseFloat(lon);
        const searchRadius = parseFloat(radius);

        usersWithAlerts.forEach(user => {
            user.safetyAlerts.forEach(alert => {
                if (alert.isActive) {
                    const distance = calculateDistance(
                        userLat, userLon,
                        alert.location.lat, alert.location.lon
                    );

                    if (distance <= searchRadius) {
                        allAlerts.push({
                            ...alert.toObject(),
                            distance: Math.round(distance),
                            userName: alert.anonymous ? 'Anonymous User' : user.name
                        });
                    }
                }
            });
        });

        // Sort by distance and timestamp
        allAlerts.sort((a, b) => {
            if (a.severity === 'critical' && b.severity !== 'critical') return -1;
            if (b.severity === 'critical' && a.severity !== 'critical') return 1;
            return b.timestamp - a.timestamp;
        });

        res.status(200).json({
            alerts: allAlerts,
            total: allAlerts.length,
            searchRadius
        });

    } catch (err) {
        console.error('Error fetching nearby alerts:', err);
        next(errorHandler(500, 'Failed to fetch nearby alerts'));
    }
};

export const markAlertHelpful = async (req, res, next) => {
    const userId = req.user.id;
    const { alertId, alertUserId } = req.body;

    try {
        const alertUser = await User.findById(alertUserId);
        if (!alertUser) {
            return next(errorHandler(404, "Alert not found"));
        }

        const alert = alertUser.safetyAlerts.id(alertId);
        if (!alert) {
            return next(errorHandler(404, "Alert not found"));
        }

        // Check if user already marked it helpful
        if (!alert.helpfulUsers) {
            alert.helpfulUsers = [];
        }

        if (alert.helpfulUsers.includes(userId)) {
            return next(errorHandler(400, "You already marked this alert as helpful"));
        }

        alert.helpfulUsers.push(userId);
        alert.helpfulCount = alert.helpfulUsers.length;
        await alertUser.save();

        res.status(200).json({
            message: "Alert marked as helpful",
            helpfulCount: alert.helpfulCount
        });

    } catch (err) {
        console.error('Error marking alert helpful:', err);
        next(errorHandler(500, 'Failed to mark alert as helpful'));
    }
};

export const addCommentToAlert = async (req, res, next) => {
    const userId = req.user.id;
    const { alertId, alertUserId, comment, anonymous } = req.body;

    try {
        const user = await User.findById(userId);
        const alertUser = await User.findById(alertUserId);
        
        if (!user || !alertUser) {
            return next(errorHandler(404, "User not found"));
        }

        const alert = alertUser.safetyAlerts.id(alertId);
        if (!alert) {
            return next(errorHandler(404, "Alert not found"));
        }

        const commentData = {
            id: generateCommentId(),
            userId: anonymous ? null : userId,
            userName: anonymous ? 'Anonymous User' : user.name,
            comment,
            timestamp: new Date(),
            anonymous: anonymous || false
        };

        if (!alert.comments) {
            alert.comments = [];
        }

        alert.comments.push(commentData);
        await alertUser.save();

        res.status(201).json({
            message: "Comment added successfully",
            comment: commentData
        });

    } catch (err) {
        console.error('Error adding comment:', err);
        next(errorHandler(500, 'Failed to add comment'));
    }
};

export const getCommunityStats = async (req, res, next) => {
    try {
        const totalUsers = await User.countDocuments();
        const activeAlerts = await User.aggregate([
            { $unwind: '$safetyAlerts' },
            { $match: { 'safetyAlerts.isActive': true } },
            { $count: 'total' }
        ]);

        const alertsByType = await User.aggregate([
            { $unwind: '$safetyAlerts' },
            { $match: { 'safetyAlerts.isActive': true } },
            {
                $group: {
                    _id: '$safetyAlerts.type',
                    count: { $sum: 1 }
                }
            }
        ]);

        const recentAlerts = await User.aggregate([
            { $unwind: '$safetyAlerts' },
            { $match: { 'safetyAlerts.isActive': true } },
            { $sort: { 'safetyAlerts.timestamp': -1 } },
            { $limit: 10 },
            {
                $project: {
                    id: '$safetyAlerts.id',
                    type: '$safetyAlerts.type',
                    severity: '$safetyAlerts.severity',
                    timestamp: '$safetyAlerts.timestamp',
                    location: '$safetyAlerts.location'
                }
            }
        ]);

        res.status(200).json({
            totalUsers,
            activeAlerts: activeAlerts[0]?.total || 0,
            alertsByType,
            recentAlerts
        });

    } catch (err) {
        console.error('Error fetching community stats:', err);
        next(errorHandler(500, 'Failed to fetch community stats'));
    }
};

export const joinSafetyPatrol = async (req, res, next) => {
    const userId = req.user.id;
    const { area, availability } = req.body;

    try {
        const user = await User.findById(userId);
        if (!user) {
            return next(errorHandler(401, "Unauthorized: User not found"));
        }

        const patrolData = {
            id: generatePatrolId(),
            userId,
            userName: user.name,
            area,
            availability, // 'morning', 'afternoon', 'evening', 'night'
            joinedAt: new Date(),
            isActive: true,
            patrolsCompleted: 0,
            verifiedBy: null
        };

        // Initialize safety patrol array if it doesn't exist
        if (!user.safetyPatrol) {
            user.safetyPatrol = [];
        }

        user.safetyPatrol.push(patrolData);
        user.isSafetyPatrol = true;
        await user.save();

        res.status(201).json({
            message: "Joined safety patrol successfully",
            patrol: patrolData
        });

    } catch (err) {
        console.error('Error joining safety patrol:', err);
        next(errorHandler(500, 'Failed to join safety patrol'));
    }
};

export const getSafetyPatrolMembers = async (req, res, next) => {
    const { lat, lon, radius = 10000 } = req.query; // Default 10km radius

    try {
        const patrolMembers = await User.find({
            'isSafetyPatrol': true,
            'safetyPatrol.isActive': true
        }).select('name safetyPatrol emergencyContacts');

        const userLat = parseFloat(lat);
        const userLon = parseFloat(lon);
        const searchRadius = parseFloat(radius);

        const nearbyPatrols = [];
        
        if (lat && lon) {
            // Filter by distance if location is provided
            patrolMembers.forEach(member => {
                member.safetyPatrol.forEach(patrol => {
                    if (patrol.isActive && patrol.area) {
                        // For demo purposes, we'll include all patrol members
                        // In production, you'd check if patrol area is within radius
                        nearbyPatrols.push({
                            userId: member._id,
                            userName: member.name,
                            patrolId: patrol.id,
                            area: patrol.area,
                            availability: patrol.availability,
                            joinedAt: patrol.joinedAt,
                            patrolsCompleted: patrol.patrolsCompleted
                        });
                    }
                });
            });
        } else {
            // Return all patrol members if no location filter
            patrolMembers.forEach(member => {
                member.safetyPatrol.forEach(patrol => {
                    if (patrol.isActive) {
                        nearbyPatrols.push({
                            userId: member._id,
                            userName: member.name,
                            patrolId: patrol.id,
                            area: patrol.area,
                            availability: patrol.availability,
                            joinedAt: patrol.joinedAt,
                            patrolsCompleted: patrol.patrolsCompleted
                        });
                    }
                });
            });
        }

        res.status(200).json({
            patrolMembers: nearbyPatrols,
            total: nearbyPatrols.length
        });

    } catch (err) {
        console.error('Error fetching safety patrol members:', err);
        next(errorHandler(500, 'Failed to fetch safety patrol members'));
    }
};

// Helper functions
function generateAlertId() {
    return 'alert_' + Math.random().toString(36).substr(2, 9) + Date.now();
}

function generateCommentId() {
    return 'comment_' + Math.random().toString(36).substr(2, 9);
}

function generatePatrolId() {
    return 'patrol_' + Math.random().toString(36).substr(2, 9);
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

async function notifyNearbyUsers(alert, alertUser) {
    try {
        // In production, use geospatial queries to find nearby users
        // For demo purposes, we'll just log the notification
        console.log(`New safety alert created by ${alert.userName}: ${alert.type} at ${alert.location.address}`);
        
        // You could implement push notifications, SMS alerts, or email notifications here
        // This would involve finding users within a certain radius and sending them alerts
        
    } catch (err) {
        console.error('Error notifying nearby users:', err);
    }
}
