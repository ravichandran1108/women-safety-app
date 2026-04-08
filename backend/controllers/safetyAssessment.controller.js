import User from "../models/user.model.js";
import { errorHandler } from "../utils/error.js";
import fetch from 'node-fetch';

export const assessLocationSafety = async (req, res, next) => {
    const { lat, lon, timeOfDay } = req.body;

    if (!lat || !lon) {
        return next(errorHandler(400, 'Latitude and Longitude are required.'));
    }

    try {
        // Get current time if not provided
        const currentTime = timeOfDay || new Date().getHours();
        const isNight = currentTime >= 20 || currentTime <= 6;

        // Calculate risk factors
        const riskFactors = {
            timeRisk: isNight ? 0.3 : 0.1,
            locationRisk: 0,
            populationRisk: 0,
            crimeRisk: 0
        };

        // Simplified location assessment without external API calls
        const isUrbanArea = true; // Default to urban for demo
        riskFactors.populationRisk = isUrbanArea ? 0.1 : 0.2;

        // Simulated crime data (in production, use real crime APIs)
        const crimeData = { riskScore: Math.random() * 0.3 };
        riskFactors.crimeRisk = crimeData.riskScore;

        // Calculate overall safety score (0-100, higher is safer)
        const totalRisk = Object.values(riskFactors).reduce((sum, risk) => sum + risk, 0);
        const safetyScore = Math.max(0, Math.min(100, 100 - (totalRisk * 100)));

        // Generate recommendations
        const recommendations = generateRecommendations(riskFactors, safetyScore, isNight);

        res.status(200).json({
            safetyScore: Math.round(safetyScore),
            riskLevel: getRiskLevel(safetyScore),
            riskFactors,
            location: locationData.display_name || 'Unknown Location',
            recommendations,
            timestamp: new Date().toISOString()
        });

    } catch (err) {
        console.error('Error in safety assessment:', err);
        next(errorHandler(500, 'Failed to assess location safety'));
    }
};

export const getSafeRoute = async (req, res, next) => {
    const { startLat, startLon, endLat, endLon } = req.body;

    if (!startLat || !startLon || !endLat || !endLon) {
        return next(errorHandler(400, 'Start and end coordinates are required.'));
    }

    try {
        // Get multiple route options
        const routeUrl = `https://router.project-osrm.org/route/v1/driving/${startLon},${startLat};${endLon},${endLat}?alternatives=true&overview=full`;
        const routeResponse = await fetch(routeUrl);
        const routeData = await routeResponse.json();

        if (!routeData.routes || routeData.routes.length === 0) {
            return next(errorHandler(404, 'No routes found'));
        }

        // Assess each route for safety
        const assessedRoutes = await Promise.all(
            routeData.routes.map(async (route, index) => {
                const safetyScore = await assessRouteSafety(route);
                return {
                    id: index,
                    geometry: route.geometry,
                    duration: route.duration,
                    distance: route.distance,
                    safetyScore,
                    safetyLevel: getRiskLevel(safetyScore),
                    isRecommended: safetyScore >= 70
                };
            })
        );

        // Sort by safety score (highest first)
        assessedRoutes.sort((a, b) => b.safetyScore - a.safetyScore);

        res.status(200).json({
            routes: assessedRoutes,
            recommendedRoute: assessedRoutes[0]
        });

    } catch (err) {
        console.error('Error in safe route calculation:', err);
        next(errorHandler(500, 'Failed to calculate safe route'));
    }
};

export const getSafetyTips = async (req, res, next) => {
    const { situation, location, timeOfDay } = req.query;

    try {
        const tips = generateContextualTips(situation, location, timeOfDay);
        
        res.status(200).json({
            tips,
            timestamp: new Date().toISOString()
        });

    } catch (err) {
        console.error('Error generating safety tips:', err);
        next(errorHandler(500, 'Failed to generate safety tips'));
    }
};

// Helper functions
async function getNearbyCrimeData(lat, lon) {
    // Simulated crime data - in production, integrate with real crime APIs
    // This would use services like CrimeReports, police department APIs, etc.
    
    // For demo purposes, generate random but realistic crime risk scores
    const baseRisk = Math.random() * 0.3; // 0-30% base risk
    const urbanMultiplier = 1.2; // Urban areas have slightly higher risk
    
    return {
        riskScore: baseRisk * urbanMultiplier,
        recentIncidents: Math.floor(Math.random() * 10),
        crimeTypes: ['theft', 'harassment', 'assault'].slice(0, Math.floor(Math.random() * 3) + 1)
    };
}

async function assessRouteSafety(route) {
    // Assess route based on waypoints and road types
    // This is a simplified assessment - in production, use detailed road data
    const baseSafety = 75; // Base safety score
    const lengthFactor = Math.max(0, 100 - (route.distance / 1000)); // Longer routes slightly less safe
    const timeFactor = route.duration > 3600 ? -5 : 0; // Routes over 1 hour get penalty
    
    return Math.max(0, Math.min(100, baseSafety + lengthFactor + timeFactor + (Math.random() * 10)));
}

function getRiskLevel(safetyScore) {
    if (safetyScore >= 80) return 'LOW';
    if (safetyScore >= 60) return 'MODERATE';
    if (safetyScore >= 40) return 'HIGH';
    return 'CRITICAL';
}

function generateRecommendations(riskFactors, safetyScore, isNight) {
    const recommendations = [];

    if (riskFactors.timeRisk > 0.2) {
        recommendations.push('Avoid traveling alone during nighttime hours');
        recommendations.push('Use well-lit main roads instead of shortcuts');
    }

    if (riskFactors.crimeRisk > 0.2) {
        recommendations.push('Stay alert and keep your phone accessible');
        recommendations.push('Share your location with trusted contacts');
        recommendations.push('Avoid displaying valuable items');
    }

    if (riskFactors.populationRisk > 0.15) {
        recommendations.push('Stick to populated areas with good visibility');
        recommendations.push('Avoid isolated shortcuts and empty areas');
    }

    if (safetyScore < 50) {
        recommendations.push('Consider using alternative transportation');
        recommendations.push('Have emergency contacts ready to call');
        recommendations.push('Keep your SOS alert easily accessible');
    }

    if (isNight && safetyScore < 70) {
        recommendations.push('Use trusted ride-sharing services');
        recommendations.push('Inform someone about your expected arrival time');
    }

    return recommendations;
}

function generateContextualTips(situation, location, timeOfDay) {
    const allTips = [
        {
            category: 'General Safety',
            tips: [
                'Always trust your instincts - if a situation feels wrong, it probably is',
                'Keep your phone charged and carry a power bank',
                'Learn basic self-defense techniques',
                'Have emergency contacts on speed dial'
            ]
        },
        {
            category: 'Travel Safety',
            tips: [
                'Share your live location with trusted contacts',
                'Use reputable transportation services',
                'Avoid isolated areas, especially at night',
                'Keep your belongings secure and visible'
            ]
        },
        {
            category: 'Digital Safety',
            tips: [
                'Be cautious about sharing your location publicly',
                'Use strong, unique passwords for all accounts',
                'Enable two-factor authentication where possible',
                'Regularly review app permissions and privacy settings'
            ]
        },
        {
            category: 'Emergency Preparedness',
            tips: [
                'Know your emergency contacts by heart',
                'Familiarize yourself with local emergency numbers',
                'Keep a small personal alarm with you',
                'Practice using the SOS features in this app'
            ]
        }
    ];

    // Filter and prioritize based on context
    if (timeOfDay === 'night' || timeOfDay === 'late') {
        allTips.push({
            category: 'Night Safety',
            tips: [
                'Stick to well-lit, populated areas',
                'Avoid shortcuts through dark or isolated areas',
                'Walk confidently and be aware of your surroundings',
                'Consider using a buddy system when possible'
            ]
        });
    }

    if (situation === 'traveling') {
        allTips.push({
            category: 'Travel Specific',
            tips: [
                'Research your destination beforehand',
                'Keep important documents secure',
                'Learn basic phrases in the local language',
                'Know the location of your country\'s embassy or consulate'
            ]
        });
    }

    return allTips;
}
