import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { 
  AlertTriangle, 
  Phone, 
  MapPin, 
  Users, 
  Clock, 
  Shield,
  Activity,
  Plus,
  ArrowUp,
  MessageSquare,
  CheckCircle
} from 'lucide-react';
import { toast } from 'react-toastify';
import Header from '../components/shared/Header';
import { API_URL } from '../utils/utils';

const EmergencyResponse = () => {
  const [activeEmergency, setActiveEmergency] = useState(null);
  const [emergencyHistory, setEmergencyHistory] = useState([]);
  const [showEmergencyForm, setShowEmergencyForm] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [monitoringActive, setMonitoringActive] = useState(false);
  
  const [newEmergency, setNewEmergency] = useState({
    type: 'general',
    severity: 'medium',
    description: '',
    contacts: []
  });

  useEffect(() => {
    getCurrentLocation();
    fetchEmergencyHistory();
  }, []);

  useEffect(() => {
    if (activeEmergency && activeEmergency.status === 'active') {
      setMonitoringActive(true);
      startStatusMonitoring();
    } else {
      setMonitoringActive(false);
    }

    return () => {
      if (monitoringInterval) {
        clearInterval(monitoringInterval);
      }
    };
  }, [activeEmergency]);

  let monitoringInterval;

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lon: position.coords.longitude
          };
          setCurrentLocation(location);
        },
        (error) => {
          console.error('Geolocation error:', error);
          toast.error('Unable to get your location');
        }
      );
    }
  };

  const fetchEmergencyHistory = async () => {
    try {
      const response = await fetch(`${API_URL}/api/emergency/history`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (response.ok) {
        setEmergencyHistory(data.emergencies || []);
      }
    } catch (error) {
      console.error('Error fetching emergency history:', error);
    }
  };

  const initiateEmergency = async (e) => {
    e.preventDefault();
    
    if (!newEmergency.description.trim()) {
      toast.error('Please describe the emergency situation');
      return;
    }

    if (!currentLocation) {
      toast.error('Location is required for emergency response');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/emergency/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          ...newEmergency,
          location: {
            lat: currentLocation.lat,
            lon: currentLocation.lon,
            address: 'Current Location'
          }
        })
      });

      const data = await response.json();
      if (response.ok) {
        toast.success('🚨 Emergency response initiated! Contacts have been notified.');
        setActiveEmergency({
          emergencyId: data.emergencyId,
          status: 'active',
          type: newEmergency.type,
          severity: newEmergency.severity,
          timestamp: new Date(),
          escalationLevel: 1,
          responseActions: []
        });
        
        setNewEmergency({
          type: 'general',
          severity: 'medium',
          description: '',
          contacts: []
        });
        setShowEmergencyForm(false);
        fetchEmergencyHistory();
      } else {
        toast.error(data.message || 'Failed to initiate emergency response');
      }
    } catch (error) {
      toast.error('Error initiating emergency response');
      console.error('Emergency initiation error:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateEmergencyStatus = async (message) => {
    if (!activeEmergency) return;

    try {
      const response = await fetch(`${API_URL}/api/emergency/update`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          emergencyId: activeEmergency.emergencyId,
          message,
          userLocation: currentLocation
        })
      });

      const data = await response.json();
      if (response.ok) {
        setActiveEmergency(prev => ({
          ...prev,
          ...data.emergency
        }));
        toast.success('Emergency status updated');
      } else {
        toast.error(data.message || 'Failed to update emergency status');
      }
    } catch (error) {
      toast.error('Error updating emergency status');
      console.error('Status update error:', error);
    }
  };

  const escalateEmergency = async () => {
    if (!activeEmergency) return;

    try {
      const response = await fetch(`${API_URL}/api/emergency/escalate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          emergencyId: activeEmergency.emergencyId,
          reason: 'User requested escalation'
        })
      });

      const data = await response.json();
      if (response.ok) {
        setActiveEmergency(prev => ({
          ...prev,
          escalationLevel: data.escalationLevel
        }));
        toast.success('Emergency escalated to next level');
      } else {
        toast.error(data.message || 'Failed to escalate emergency');
      }
    } catch (error) {
      toast.error('Error escalating emergency');
      console.error('Escalation error:', error);
    }
  };

  const resolveEmergency = async () => {
    if (!activeEmergency) return;

    try {
      const response = await fetch(`${API_URL}/api/emergency/update`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          emergencyId: activeEmergency.emergencyId,
          status: 'resolved'
        })
      });

      const data = await response.json();
      if (response.ok) {
        setActiveEmergency(null);
        setMonitoringActive(false);
        toast.success('Emergency resolved successfully');
        fetchEmergencyHistory();
      } else {
        toast.error(data.message || 'Failed to resolve emergency');
      }
    } catch (error) {
      toast.error('Error resolving emergency');
      console.error('Resolution error:', error);
    }
  };

  const startStatusMonitoring = () => {
    if (monitoringInterval) clearInterval(monitoringInterval);
    
    monitoringInterval = setInterval(async () => {
      if (!activeEmergency) return;
      
      try {
        const response = await fetch(`${API_URL}/api/emergency/status/${activeEmergency.emergencyId}`, {
          credentials: 'include'
        });
        
        const data = await response.json();
        if (response.ok) {
          setActiveEmergency(data.emergency);
        }
      } catch (error) {
        console.error('Error monitoring emergency status:', error);
      }
    }, 30000); // Check every 30 seconds
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getEscalationColor = (level) => {
    switch (level) {
      case 1: return 'text-blue-600';
      case 2: return 'text-yellow-600';
      case 3: return 'text-orange-600';
      case 4: return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getEmergencyTypeIcon = (type) => {
    switch (type) {
      case 'medical': return <Activity className="w-5 h-5" />;
      case 'assault': return <Shield className="w-5 h-5" />;
      case 'theft': return <AlertTriangle className="w-5 h-5" />;
      case 'harassment': return <Users className="w-5 h-5" />;
      default: return <AlertTriangle className="w-5 h-5" />;
    }
  };

  const formatDuration = (timestamp) => {
    const now = new Date();
    const emergencyTime = new Date(timestamp);
    const diffInMinutes = Math.floor((now - emergencyTime) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} minutes`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hours`;
    return `${Math.floor(diffInMinutes / 1440)} days`;
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Smart Emergency Response</h1>
          <p className="text-gray-600">Intelligent emergency coordination and escalation system</p>
        </div>

        {/* Active Emergency Alert */}
        {activeEmergency && (
          <div className="mb-6">
            <Card className={`border-2 ${getSeverityColor(activeEmergency.severity)}`}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center">
                    {getEmergencyTypeIcon(activeEmergency.type)}
                    <span className="ml-2">Active Emergency</span>
                    <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(activeEmergency.severity)}`}>
                      {activeEmergency.severity.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className={`text-sm font-medium ${getEscalationColor(activeEmergency.escalationLevel)}`}>
                      Level {activeEmergency.escalationLevel}
                    </div>
                    {monitoringActive && (
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <div className="text-sm text-gray-600">Emergency ID</div>
                    <div className="font-medium">{activeEmergency.emergencyId}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Duration</div>
                    <div className="font-medium">{formatDuration(activeEmergency.timestamp)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Status</div>
                    <div className="font-medium capitalize">{activeEmergency.status}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Escalation Level</div>
                    <div className={`font-medium ${getEscalationColor(activeEmergency.escalationLevel)}`}>
                      Level {activeEmergency.escalationLevel}
                    </div>
                  </div>
                </div>

                {/* Response Actions */}
                {activeEmergency.responseActions && activeEmergency.responseActions.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-medium mb-2">Response Actions</h4>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {activeEmergency.responseActions.map((action, index) => (
                        <div key={index} className="text-sm text-gray-600 flex items-start">
                          <Clock className="w-3 h-3 mr-2 mt-1 flex-shrink-0" />
                          <span>
                            {action.type.replace(/_/g, ' ').toUpperCase()}: {action.message || 'Action completed'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Emergency Controls */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => updateEmergencyStatus('Status update from user')}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    <MessageSquare className="w-4 h-4 inline mr-1" />
                    Update Status
                  </button>
                  
                  <button
                    onClick={escalateEmergency}
                    className="px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm"
                  >
                    <ArrowUp className="w-4 h-4 inline mr-1" />
                    Escalate
                  </button>
                  
                  <button
                    onClick={resolveEmergency}
                    className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                  >
                    <CheckCircle className="w-4 h-4 inline mr-1" />
                    Resolve
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Initiate Emergency */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  <AlertTriangle className="w-5 h-5 mr-2 text-red-600" />
                  Initiate Emergency
                </div>
                <button
                  onClick={() => setShowEmergencyForm(!showEmergencyForm)}
                  className="text-red-600 hover:text-red-700"
                  disabled={activeEmergency !== null}
                >
                  {showEmergencyForm ? 'Cancel' : 'New'}
                </button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {showEmergencyForm ? (
                <form onSubmit={initiateEmergency} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Emergency Type
                    </label>
                    <select
                      value={newEmergency.type}
                      onChange={(e) => setNewEmergency({...newEmergency, type: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      <option value="general">General Emergency</option>
                      <option value="medical">Medical Emergency</option>
                      <option value="assault">Assault</option>
                      <option value="theft">Theft</option>
                      <option value="harassment">Harassment</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Severity Level
                    </label>
                    <select
                      value={newEmergency.severity}
                      onChange={(e) => setNewEmergency({...newEmergency, severity: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={newEmergency.description}
                      onChange={(e) => setNewEmergency({...newEmergency, description: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                      rows={3}
                      placeholder="Describe the emergency situation..."
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || activeEmergency !== null}
                    className="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Initiating...' : '🚨 Initiate Emergency Response'}
                  </button>
                </form>
              ) : (
                <div className="text-center py-4">
                  <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-gray-600 mb-2">No active emergency</p>
                  <p className="text-sm text-gray-500">Click "New" to initiate emergency response</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Emergency History */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="w-5 h-5 mr-2" />
                  Emergency History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {emergencyHistory.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Clock className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No emergency history</p>
                    <p className="text-sm">Your emergency response history will appear here</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {emergencyHistory.map((emergency) => (
                      <div key={emergency.emergencyId} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center">
                            {getEmergencyTypeIcon(emergency.type)}
                            <span className="ml-2 font-medium">{emergency.emergencyId}</span>
                            <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(emergency.severity)}`}>
                              {emergency.severity}
                            </span>
                          </div>
                          <div className="text-sm text-gray-500">
                            {new Date(emergency.timestamp).toLocaleDateString()}
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-4 text-sm text-gray-600">
                          <div>
                            <div className="font-medium">Type</div>
                            <div className="capitalize">{emergency.type}</div>
                          </div>
                          <div>
                            <div className="font-medium">Status</div>
                            <div className="capitalize">{emergency.status}</div>
                          </div>
                          <div>
                            <div className="font-medium">Escalation</div>
                            <div className={getEscalationColor(emergency.escalationLevel)}>
                              Level {emergency.escalationLevel}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Emergency Information */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Shield className="w-5 h-5 mr-2 text-blue-600" />
              Emergency Response Protocol
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-2">Escalation Levels</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li><span className="font-medium text-blue-600">Level 1:</span> Notify emergency contacts</li>
                  <li><span className="font-medium text-yellow-600">Level 2:</span> Consider notifying authorities</li>
                  <li><span className="font-medium text-orange-600">Level 3:</span> Broadcast to community</li>
                  <li><span className="font-medium text-red-600">Level 4:</span> Contact emergency services</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">Automatic Escalation</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Critical emergencies escalate after 2 minutes</li>
                  <li>• High severity escalates after 5 minutes</li>
                  <li>• Medium severity escalates after 15 minutes</li>
                  <li>• Manual escalation available at any time</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EmergencyResponse;
