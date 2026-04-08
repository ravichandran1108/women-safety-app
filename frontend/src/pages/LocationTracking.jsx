import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { MapPin, Play, Pause, Plus, Trash2, Shield, AlertTriangle, Clock } from 'lucide-react';
import { toast } from 'react-toastify';
import Header from '../components/shared/Header';
import { API_URL } from '../utils/utils';

const LocationTracking = () => {
  const [isTracking, setIsTracking] = useState(false);
  const [trackingSession, setTrackingSession] = useState(null);
  const [geofences, setGeofences] = useState([]);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [showGeofenceForm, setShowGeofenceForm] = useState(false);
  const [newGeofence, setNewGeofence] = useState({
    name: '',
    lat: '',
    lon: '',
    radius: '100',
    type: 'safety'
  });
  const [trackingStats, setTrackingStats] = useState({
    startTime: null,
    duration: 0,
    lastUpdate: null
  });
  
  const trackingInterval = useRef(null);
  const durationInterval = useRef(null);

  useEffect(() => {
    fetchGeofences();
    return () => {
      if (trackingInterval.current) clearInterval(trackingInterval.current);
      if (durationInterval.current) clearInterval(durationInterval.current);
    };
  }, []);

  useEffect(() => {
    if (isTracking && trackingSession) {
      startLocationUpdates();
      startDurationCounter();
    } else {
      stopLocationUpdates();
      stopDurationCounter();
    }
  }, [isTracking, trackingSession]);

  const fetchGeofences = async () => {
    try {
      const response = await fetch(`${API_URL}/api/location/geofences`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (response.ok) {
        setGeofences(data.geofences || []);
      }
    } catch (error) {
      console.error('Error fetching geofences:', error);
    }
  };

  const getCurrentLocation = () => {
    return new Promise((resolve, reject) => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const location = {
              lat: position.coords.latitude,
              lon: position.coords.longitude
            };
            setCurrentLocation(location);
            resolve(location);
          },
          (error) => {
            toast.error('Unable to get your location');
            reject(error);
          }
        );
      } else {
        toast.error('Geolocation is not supported');
        reject(new Error('Geolocation not supported'));
      }
    });
  };

  const startTracking = async () => {
    try {
      const location = await getCurrentLocation();
      
      const response = await fetch(`${API_URL}/api/location/start-tracking`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          duration: 3600000, // 1 hour
          checkInterval: 30000 // 30 seconds
        })
      });

      const data = await response.json();
      if (response.ok) {
        setTrackingSession(data);
        setIsTracking(true);
        setTrackingStats({
          startTime: new Date(),
          duration: 0,
          lastUpdate: new Date()
        });
        toast.success('Location tracking started');
      } else {
        toast.error(data.message || 'Failed to start tracking');
      }
    } catch (error) {
      toast.error('Error starting location tracking');
      console.error('Tracking start error:', error);
    }
  };

  const stopTracking = async () => {
    if (!trackingSession) return;

    try {
      const response = await fetch(`${API_URL}/api/location/stop-tracking`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          sessionId: trackingSession.sessionId
        })
      });

      const data = await response.json();
      if (response.ok) {
        setIsTracking(false);
        setTrackingSession(null);
        setTrackingStats({
          startTime: null,
          duration: 0,
          lastUpdate: null
        });
        toast.success('Location tracking stopped');
      } else {
        toast.error(data.message || 'Failed to stop tracking');
      }
    } catch (error) {
      toast.error('Error stopping location tracking');
      console.error('Tracking stop error:', error);
    }
  };

  const startLocationUpdates = () => {
    if (trackingInterval.current) clearInterval(trackingInterval.current);

    trackingInterval.current = setInterval(async () => {
      try {
        const location = await getCurrentLocation();
        if (trackingSession && location) {
          await updateLocation(location);
        }
      } catch (error) {
        console.error('Location update error:', error);
      }
    }, 30000); // Update every 30 seconds
  };

  const stopLocationUpdates = () => {
    if (trackingInterval.current) {
      clearInterval(trackingInterval.current);
      trackingInterval.current = null;
    }
  };

  const startDurationCounter = () => {
    if (durationInterval.current) clearInterval(durationInterval.current);

    durationInterval.current = setInterval(() => {
      setTrackingStats(prev => ({
        ...prev,
        duration: Date.now() - prev.startTime.getTime()
      }));
    }, 1000);
  };

  const stopDurationCounter = () => {
    if (durationInterval.current) {
      clearInterval(durationInterval.current);
      durationInterval.current = null;
    }
  };

  const updateLocation = async (location) => {
    try {
      const response = await fetch(`${API_URL}/api/location/update-location`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          sessionId: trackingSession.sessionId,
          lat: location.lat,
          lon: location.lon,
          timestamp: new Date().toISOString()
        })
      });

      const data = await response.json();
      if (response.ok) {
        setTrackingStats(prev => ({
          ...prev,
          lastUpdate: new Date()
        }));
      } else {
        console.error('Location update failed:', data.message);
      }
    } catch (error) {
      console.error('Error updating location:', error);
    }
  };

  const createGeofence = async (e) => {
    e.preventDefault();
    
    if (!newGeofence.name || !newGeofence.lat || !newGeofence.lon) {
      toast.error('Please fill in all geofence details');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/location/geofences`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(newGeofence)
      });

      const data = await response.json();
      if (response.ok) {
        setGeofences([...geofences, data.geofence]);
        setNewGeofence({
          name: '',
          lat: '',
          lon: '',
          radius: '100',
          type: 'safety'
        });
        setShowGeofenceForm(false);
        toast.success('Geofence created successfully');
      } else {
        toast.error(data.message || 'Failed to create geofence');
      }
    } catch (error) {
      toast.error('Error creating geofence');
      console.error('Geofence creation error:', error);
    }
  };

  const deleteGeofence = async (geofenceId) => {
    try {
      const response = await fetch(`${API_URL}/api/location/geofences/${geofenceId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      const data = await response.json();
      if (response.ok) {
        setGeofences(geofences.filter(gf => gf.id !== geofenceId));
        toast.success('Geofence deleted successfully');
      } else {
        toast.error(data.message || 'Failed to delete geofence');
      }
    } catch (error) {
      toast.error('Error deleting geofence');
      console.error('Geofence deletion error:', error);
    }
  };

  const formatDuration = (milliseconds) => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const getGeofenceTypeColor = (type) => {
    switch (type) {
      case 'safety': return 'bg-green-100 text-green-800';
      case 'danger': return 'bg-red-100 text-red-800';
      case 'waypoint': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const useCurrentLocationForGeofence = () => {
    if (currentLocation) {
      setNewGeofence({
        ...newGeofence,
        lat: currentLocation.lat.toString(),
        lon: currentLocation.lon.toString()
      });
    } else {
      getCurrentLocation().then(location => {
        setNewGeofence({
          ...newGeofence,
          lat: location.lat.toString(),
          lon: location.lon.toString()
        });
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Location Tracking & Geofencing</h1>
          <p className="text-gray-600">Monitor your location and set up safety zones</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Tracking Control */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <MapPin className="w-6 h-6 mr-2 text-blue-600" />
                Location Tracking
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Current Status */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <div className="flex items-center">
                      <div className={`w-3 h-3 rounded-full mr-2 ${isTracking ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                      <span className="font-medium">
                        {isTracking ? 'Tracking Active' : 'Tracking Inactive'}
                      </span>
                    </div>
                    {trackingStats.startTime && (
                      <div className="text-sm text-gray-600 mt-1">
                        Duration: {formatDuration(trackingStats.duration)}
                      </div>
                    )}
                    {trackingStats.lastUpdate && (
                      <div className="text-sm text-gray-600">
                        Last update: {trackingStats.lastUpdate.toLocaleTimeString()}
                      </div>
                    )}
                  </div>
                  
                  <button
                    onClick={isTracking ? stopTracking : startTracking}
                    className={`flex items-center px-4 py-2 rounded-lg font-medium transition-colors ${
                      isTracking 
                        ? 'bg-red-600 text-white hover:bg-red-700' 
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    {isTracking ? (
                      <>
                        <Pause className="w-4 h-4 mr-2" />
                        Stop Tracking
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Start Tracking
                      </>
                    )}
                  </button>
                </div>

                {/* Current Location */}
                {currentLocation && (
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="flex items-center mb-2">
                      <MapPin className="w-4 h-4 mr-2 text-blue-600" />
                      <span className="font-medium text-blue-800">Current Location</span>
                    </div>
                    <div className="text-sm text-blue-700">
                      Lat: {currentLocation.lat.toFixed(6)}, Lon: {currentLocation.lon.toFixed(6)}
                    </div>
                  </div>
                )}

                {/* Tracking Info */}
                <div className="text-sm text-gray-600">
                  <div className="flex items-center mb-1">
                    <Clock className="w-4 h-4 mr-2" />
                    Updates every 30 seconds when tracking is active
                  </div>
                  <div className="flex items-center">
                    <Shield className="w-4 h-4 mr-2" />
                    Emergency contacts will be alerted if no updates are received
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Geofences */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  <Shield className="w-6 h-6 mr-2 text-green-600" />
                  Geofences
                </div>
                <button
                  onClick={() => setShowGeofenceForm(!showGeofenceForm)}
                  className="flex items-center px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Geofence
                </button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {showGeofenceForm && (
                <form onSubmit={createGeofence} className="mb-4 p-4 bg-gray-50 rounded-lg">
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <input
                      type="text"
                      placeholder="Geofence Name"
                      value={newGeofence.name}
                      onChange={(e) => setNewGeofence({...newGeofence, name: e.target.value})}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <select
                      value={newGeofence.type}
                      onChange={(e) => setNewGeofence({...newGeofence, type: e.target.value})}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="safety">Safety Zone</option>
                      <option value="danger">Danger Zone</option>
                      <option value="waypoint">Waypoint</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <input
                      type="number"
                      placeholder="Latitude"
                      value={newGeofence.lat}
                      onChange={(e) => setNewGeofence({...newGeofence, lat: e.target.value})}
                      step="any"
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="number"
                      placeholder="Longitude"
                      value={newGeofence.lon}
                      onChange={(e) => setNewGeofence({...newGeofence, lon: e.target.value})}
                      step="any"
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="number"
                      placeholder="Radius (m)"
                      value={newGeofence.radius}
                      onChange={(e) => setNewGeofence({...newGeofence, radius: e.target.value})}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={useCurrentLocationForGeofence}
                      className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
                    >
                      Use Current Location
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                    >
                      Create Geofence
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowGeofenceForm(false)}
                      className="px-3 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition-colors text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-3">
                {geofences.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Shield className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No geofences created yet</p>
                    <p className="text-sm">Create geofences to get alerts when entering or leaving specific areas</p>
                  </div>
                ) : (
                  geofences.map((geofence) => (
                    <div key={geofence.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <div className="flex items-center">
                          <span className="font-medium mr-2">{geofence.name}</span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getGeofenceTypeColor(geofence.type)}`}>
                            {geofence.type}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600">
                          Radius: {geofence.radius}m
                        </div>
                      </div>
                      <button
                        onClick={() => deleteGeofence(geofence.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Instructions */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2 text-yellow-600" />
              How It Works
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium mb-2">Location Tracking</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Automatically shares your location with emergency contacts</li>
                  <li>• Updates every 30 seconds when active</li>
                  <li>• Alerts contacts if no updates are received</li>
                  <li>• Works in background when app is open</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">Geofencing</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Create virtual boundaries around important locations</li>
                  <li>• Get alerts when entering or leaving geofenced areas</li>
                  <li>• Set up safety zones, danger zones, or waypoints</li>
                  <li>• Customize alert conditions for each geofence</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LocationTracking;
