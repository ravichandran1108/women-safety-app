import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { 
  Users, 
  AlertTriangle, 
  Shield, 
  MapPin, 
  ThumbsUp, 
  MessageSquare, 
  Plus,
  Eye,
  UserPlus,
  Activity
} from 'lucide-react';
import { toast } from 'react-toastify';
import Header from '../components/shared/Header';
import { API_URL } from '../utils/utils';

const CommunitySafety = () => {
  const [activeTab, setActiveTab] = useState('alerts');
  const [nearbyAlerts, setNearbyAlerts] = useState([]);
  const [communityStats, setCommunityStats] = useState(null);
  const [patrolMembers, setPatrolMembers] = useState([]);
  const [showAlertForm, setShowAlertForm] = useState(false);
  const [showPatrolForm, setShowPatrolForm] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const [newAlert, setNewAlert] = useState({
    type: 'suspicious_activity',
    description: '',
    severity: 'medium',
    anonymous: false
  });

  const [newPatrol, setNewPatrol] = useState({
    area: '',
    availability: 'evening'
  });

  useEffect(() => {
    getCurrentLocation();
    fetchCommunityStats();
    fetchNearbyAlerts();
    fetchPatrolMembers();
  }, []);

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
        }
      );
    }
  };

  const fetchNearbyAlerts = async () => {
    if (!currentLocation) return;
    
    try {
      const response = await fetch(
        `${API_URL}/api/community/alerts/nearby?lat=${currentLocation.lat}&lon=${currentLocation.lon}&radius=10000`,
        { credentials: 'include' }
      );
      const data = await response.json();
      if (response.ok) {
        setNearbyAlerts(data.alerts || []);
      }
    } catch (error) {
      console.error('Error fetching nearby alerts:', error);
    }
  };

  const fetchCommunityStats = async () => {
    try {
      const response = await fetch(`${API_URL}/api/community/stats`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (response.ok) {
        setCommunityStats(data);
      }
    } catch (error) {
      console.error('Error fetching community stats:', error);
    }
  };

  const fetchPatrolMembers = async () => {
    try {
      const response = await fetch(`${API_URL}/api/community/patrol/members`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (response.ok) {
        setPatrolMembers(data.patrolMembers || []);
      }
    } catch (error) {
      console.error('Error fetching patrol members:', error);
    }
  };

  const createSafetyAlert = async (e) => {
    e.preventDefault();
    
    if (!newAlert.description.trim()) {
      toast.error('Please provide a description for the alert');
      return;
    }

    if (!currentLocation) {
      toast.error('Location is required to create an alert');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/community/alerts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          ...newAlert,
          location: {
            lat: currentLocation.lat,
            lon: currentLocation.lon,
            address: 'Current Location'
          }
        })
      });

      const data = await response.json();
      if (response.ok) {
        toast.success('Safety alert created successfully');
        setNewAlert({
          type: 'suspicious_activity',
          description: '',
          severity: 'medium',
          anonymous: false
        });
        setShowAlertForm(false);
        fetchNearbyAlerts();
        fetchCommunityStats();
      } else {
        toast.error(data.message || 'Failed to create alert');
      }
    } catch (error) {
      toast.error('Error creating safety alert');
      console.error('Alert creation error:', error);
    } finally {
      setLoading(false);
    }
  };

  const joinSafetyPatrol = async (e) => {
    e.preventDefault();
    
    if (!newPatrol.area.trim()) {
      toast.error('Please specify your patrol area');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/community/patrol/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(newPatrol)
      });

      const data = await response.json();
      if (response.ok) {
        toast.success('Joined safety patrol successfully');
        setNewPatrol({
          area: '',
          availability: 'evening'
        });
        setShowPatrolForm(false);
        fetchPatrolMembers();
      } else {
        toast.error(data.message || 'Failed to join safety patrol');
      }
    } catch (error) {
      toast.error('Error joining safety patrol');
      console.error('Patrol join error:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAlertHelpful = async (alertId, alertUserId) => {
    try {
      const response = await fetch(`${API_URL}/api/community/alerts/helpful`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ alertId, alertUserId })
      });

      const data = await response.json();
      if (response.ok) {
        toast.success('Alert marked as helpful');
        fetchNearbyAlerts();
      } else {
        toast.error(data.message || 'Failed to mark alert as helpful');
      }
    } catch (error) {
      toast.error('Error marking alert as helpful');
      console.error('Mark helpful error:', error);
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'low': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'critical': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getAlertTypeIcon = (type) => {
    switch (type) {
      case 'suspicious_activity': return <AlertTriangle className="w-4 h-4" />;
      case 'harassment': return <Shield className="w-4 h-4" />;
      case 'theft': return <Eye className="w-4 h-4" />;
      case 'assault': return <AlertTriangle className="w-4 h-4" />;
      case 'safe_zone': return <Shield className="w-4 h-4" />;
      default: return <AlertTriangle className="w-4 h-4" />;
    }
  };

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const alertTime = new Date(timestamp);
    const diffInMinutes = Math.floor((now - alertTime) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hours ago`;
    return `${Math.floor(diffInMinutes / 1440)} days ago`;
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Community Safety Network</h1>
          <p className="text-gray-600">Stay connected with your community for real-time safety updates</p>
        </div>

        {/* Community Stats */}
        {communityStats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4 text-center">
                <Users className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                <div className="text-2xl font-bold">{communityStats.totalUsers}</div>
                <div className="text-sm text-gray-600">Active Users</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-red-600" />
                <div className="text-2xl font-bold">{communityStats.activeAlerts}</div>
                <div className="text-sm text-gray-600">Active Alerts</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Shield className="w-8 h-8 mx-auto mb-2 text-green-600" />
                <div className="text-2xl font-bold">{patrolMembers.length}</div>
                <div className="text-sm text-gray-600">Safety Patrols</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Activity className="w-8 h-8 mx-auto mb-2 text-purple-600" />
                <div className="text-2xl font-bold">{nearbyAlerts.length}</div>
                <div className="text-sm text-gray-600">Nearby Alerts</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex space-x-4 mb-6">
          <button
            onClick={() => setActiveTab('alerts')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'alerts'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            <AlertTriangle className="inline-block w-4 h-4 mr-2" />
            Safety Alerts
          </button>
          <button
            onClick={() => setActiveTab('patrol')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'patrol'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Shield className="inline-block w-4 h-4 mr-2" />
            Safety Patrol
          </button>
        </div>

        {activeTab === 'alerts' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Create Alert Form */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Plus className="w-5 h-5 mr-2" />
                    Create Alert
                  </div>
                  <button
                    onClick={() => setShowAlertForm(!showAlertForm)}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    {showAlertForm ? 'Cancel' : 'New'}
                  </button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {showAlertForm && (
                  <form onSubmit={createSafetyAlert} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Alert Type
                      </label>
                      <select
                        value={newAlert.type}
                        onChange={(e) => setNewAlert({...newAlert, type: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="suspicious_activity">Suspicious Activity</option>
                        <option value="harassment">Harassment</option>
                        <option value="theft">Theft</option>
                        <option value="assault">Assault</option>
                        <option value="safe_zone">Safe Zone</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Severity
                      </label>
                      <select
                        value={newAlert.severity}
                        onChange={(e) => setNewAlert({...newAlert, severity: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                        value={newAlert.description}
                        onChange={(e) => setNewAlert({...newAlert, description: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={3}
                        placeholder="Describe the situation..."
                      />
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="anonymous"
                        checked={newAlert.anonymous}
                        onChange={(e) => setNewAlert({...newAlert, anonymous: e.target.checked})}
                        className="mr-2"
                      />
                      <label htmlFor="anonymous" className="text-sm text-gray-700">
                        Post anonymously
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {loading ? 'Creating...' : 'Create Alert'}
                    </button>
                  </form>
                )}
              </CardContent>
            </Card>

            {/* Nearby Alerts */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <MapPin className="w-5 h-5 mr-2" />
                    Nearby Alerts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {nearbyAlerts.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p>No nearby safety alerts</p>
                      <p className="text-sm">Be the first to report any safety concerns in your area</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {nearbyAlerts.map((alert) => (
                        <div key={alert.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center">
                              {getAlertTypeIcon(alert.type)}
                              <span className="ml-2 font-medium">{alert.userName}</span>
                              <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(alert.severity)}`}>
                                {alert.severity}
                              </span>
                            </div>
                            <div className="text-sm text-gray-500">
                              {formatTimeAgo(alert.timestamp)}
                            </div>
                          </div>
                          
                          <p className="text-gray-700 mb-2">{alert.description}</p>
                          
                          <div className="flex items-center justify-between text-sm text-gray-600">
                            <div className="flex items-center">
                              <MapPin className="w-4 h-4 mr-1" />
                              {alert.distance}m away
                            </div>
                            
                            <div className="flex items-center space-x-4">
                              <button
                                onClick={() => markAlertHelpful(alert.id, alert.userId || alert._id)}
                                className="flex items-center hover:text-blue-600 transition-colors"
                              >
                                <ThumbsUp className="w-4 h-4 mr-1" />
                                {alert.helpfulCount || 0}
                              </button>
                              
                              <button className="flex items-center hover:text-blue-600 transition-colors">
                                <MessageSquare className="w-4 h-4 mr-1" />
                                {alert.comments?.length || 0}
                              </button>
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
        )}

        {activeTab === 'patrol' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Join Patrol Form */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center">
                    <UserPlus className="w-5 h-5 mr-2" />
                    Join Safety Patrol
                  </div>
                  <button
                    onClick={() => setShowPatrolForm(!showPatrolForm)}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    {showPatrolForm ? 'Cancel' : 'Join'}
                  </button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {showPatrolForm ? (
                  <form onSubmit={joinSafetyPatrol} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Patrol Area
                      </label>
                      <input
                        type="text"
                        value={newPatrol.area}
                        onChange={(e) => setNewPatrol({...newPatrol, area: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., Downtown, North District"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Availability
                      </label>
                      <select
                        value={newPatrol.availability}
                        onChange={(e) => setNewPatrol({...newPatrol, availability: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="morning">Morning (6AM - 12PM)</option>
                        <option value="afternoon">Afternoon (12PM - 6PM)</option>
                        <option value="evening">Evening (6PM - 12AM)</option>
                        <option value="night">Night (12AM - 6AM)</option>
                      </select>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      {loading ? 'Joining...' : 'Join Safety Patrol'}
                    </button>
                  </form>
                ) : (
                  <div className="text-center py-4">
                    <Shield className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-gray-600 mb-2">Become a community safety guardian</p>
                    <p className="text-sm text-gray-500">Help keep your neighborhood safe</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Patrol Members */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Users className="w-5 h-5 mr-2" />
                    Safety Patrol Members
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {patrolMembers.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Shield className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p>No safety patrol members in your area</p>
                      <p className="text-sm">Be the first to join and help keep your community safe</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {patrolMembers.map((member) => (
                        <div key={member.patrolId} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center mb-2">
                            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                              <Shield className="w-5 h-5 text-green-600" />
                            </div>
                            <div className="ml-3">
                              <div className="font-medium">{member.userName}</div>
                              <div className="text-sm text-gray-600">{member.area}</div>
                            </div>
                          </div>
                          
                          <div className="text-sm text-gray-600">
                            <div>Available: {member.availability}</div>
                            <div>Patrols: {member.patrolsCompleted}</div>
                            <div>Joined: {new Date(member.joinedAt).toLocaleDateString()}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CommunitySafety;
