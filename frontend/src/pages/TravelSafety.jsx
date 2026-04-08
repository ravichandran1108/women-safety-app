import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { 
  MapPin, 
  Calendar, 
  Plane, 
  Hotel, 
  Phone, 
  Shield, 
  AlertTriangle,
  CheckCircle,
  Clock,
  Plus,
  Navigation,
  Users,
  Info,
  Globe
} from 'lucide-react';
import { toast } from 'react-toastify';
import Header from '../components/shared/Header';
import { API_URL } from '../utils/utils';

const TravelSafety = () => {
  const [activeTab, setActiveTab] = useState('plans');
  const [travelPlans, setTravelPlans] = useState([]);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [destinationSafety, setDestinationSafety] = useState(null);
  const [activeJourney, setActiveJourney] = useState(null);
  
  const [newPlan, setNewPlan] = useState({
    destination: {
      address: '',
      lat: '',
      lon: '',
      city: '',
      country: ''
    },
    startDate: '',
    endDate: '',
    transportation: 'car',
    accommodation: 'hotel',
    checkInInterval: 3600000 // 1 hour
  });

  useEffect(() => {
    getCurrentLocation();
    fetchTravelPlans();
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

  const fetchTravelPlans = async () => {
    try {
      const response = await fetch(`${API_URL}/api/travel/plans`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (response.ok) {
        setTravelPlans(data.travelPlans || []);
        // Check for active journey
        const active = data.travelPlans?.find(plan => plan.status === 'active');
        setActiveJourney(active || null);
      }
    } catch (error) {
      console.error('Error fetching travel plans:', error);
    }
  };

  const createTravelPlan = async (e) => {
    e.preventDefault();
    
    if (!newPlan.destination.address || !newPlan.startDate || !newPlan.endDate) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/travel/plans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(newPlan)
      });

      const data = await response.json();
      if (response.ok) {
        toast.success('Travel plan created successfully');
        setNewPlan({
          destination: {
            address: '',
            lat: '',
            lon: '',
            city: '',
            country: ''
          },
          startDate: '',
          endDate: '',
          transportation: 'car',
          accommodation: 'hotel',
          checkInInterval: 3600000
        });
        setShowPlanForm(false);
        fetchTravelPlans();
      } else {
        toast.error(data.message || 'Failed to create travel plan');
      }
    } catch (error) {
      toast.error('Error creating travel plan');
      console.error('Travel plan creation error:', error);
    } finally {
      setLoading(false);
    }
  };

  const startJourney = async (travelPlanId) => {
    try {
      const response = await fetch(`${API_URL}/api/travel/journey/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ travelPlanId })
      });

      const data = await response.json();
      if (response.ok) {
        toast.success('Journey started! Stay safe and check in regularly.');
        fetchTravelPlans();
      } else {
        toast.error(data.message || 'Failed to start journey');
      }
    } catch (error) {
      toast.error('Error starting journey');
      console.error('Journey start error:', error);
    }
  };

  const checkIn = async (travelPlanId) => {
    if (!currentLocation) {
      toast.error('Location is required for check-in');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/travel/journey/checkin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          travelPlanId,
          location: {
            lat: currentLocation.lat,
            lon: currentLocation.lon,
            address: 'Current Location'
          },
          status: 'safe',
          message: 'Regular check-in'
        })
      });

      const data = await response.json();
      if (response.ok) {
        toast.success('Check-in successful');
        fetchTravelPlans();
      } else {
        toast.error(data.message || 'Failed to check in');
      }
    } catch (error) {
      toast.error('Error during check-in');
      console.error('Check-in error:', error);
    }
  };

  const endJourney = async (travelPlanId) => {
    try {
      const response = await fetch(`${API_URL}/api/travel/journey/end`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ travelPlanId })
      });

      const data = await response.json();
      if (response.ok) {
        toast.success('Journey completed safely');
        fetchTravelPlans();
      } else {
        toast.error(data.message || 'Failed to end journey');
      }
    } catch (error) {
      toast.error('Error ending journey');
      console.error('Journey end error:', error);
    }
  };

  const checkDestinationSafety = async () => {
    if (!newPlan.destination.address) {
      toast.error('Please enter a destination first');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/travel/destination-safety?destination=${encodeURIComponent(newPlan.destination.address)}`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (response.ok) {
        setDestinationSafety(data);
      }
    } catch (error) {
      console.error('Error checking destination safety:', error);
    }
  };

  const getSafetyColor = (score) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getRiskLevelColor = (level) => {
    switch (level) {
      case 'LOW': return 'bg-green-100 text-green-800';
      case 'MODERATE': return 'bg-yellow-100 text-yellow-800';
      case 'HIGH': return 'bg-orange-100 text-orange-800';
      case 'CRITICAL': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'planned': return 'bg-blue-100 text-blue-800';
      case 'active': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  const useCurrentLocationForDestination = () => {
    if (currentLocation) {
      setNewPlan({
        ...newPlan,
        destination: {
          ...newPlan.destination,
          lat: currentLocation.lat.toString(),
          lon: currentLocation.lon.toString(),
          address: 'Current Location'
        }
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Travel Safety Companion</h1>
          <p className="text-gray-600">Plan safe journeys and stay connected while traveling</p>
        </div>

        {/* Active Journey Alert */}
        {activeJourney && (
          <div className="mb-6">
            <Card className="border-2 border-green-200 bg-green-50">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Navigation className="w-5 h-5 mr-2 text-green-600" />
                    Active Journey
                  </div>
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    JOURNEY IN PROGRESS
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <div className="text-sm text-gray-600">Destination</div>
                    <div className="font-medium">{activeJourney.destination.address}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Started</div>
                    <div className="font-medium">
                      {activeJourney.journeyStartTime ? new Date(activeJourney.journeyStartTime).toLocaleString() : 'Unknown'}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => checkIn(activeJourney._id)}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    <CheckCircle className="w-4 h-4 inline mr-1" />
                    Check In Now
                  </button>
                  
                  <button
                    onClick={() => endJourney(activeJourney._id)}
                    className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
                  >
                    <CheckCircle className="w-4 h-4 inline mr-1" />
                    End Journey
                  </button>
                </div>

                {activeJourney.checkIns && activeJourney.checkIns.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-medium mb-2">Recent Check-ins</h4>
                    <div className="space-y-2">
                      {activeJourney.checkIns.slice(-3).map((checkIn, index) => (
                        <div key={index} className="text-sm text-gray-600 flex items-center">
                          <Clock className="w-3 h-3 mr-2" />
                          {new Date(checkIn.timestamp).toLocaleString()} - {checkIn.status}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex space-x-4 mb-6">
          <button
            onClick={() => setActiveTab('plans')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'plans'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Calendar className="inline-block w-4 h-4 mr-2" />
            Travel Plans
          </button>
          <button
            onClick={() => setActiveTab('safety')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'safety'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Shield className="inline-block w-4 h-4 mr-2" />
            Safety Info
          </button>
        </div>

        {activeTab === 'plans' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Create Travel Plan */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Plus className="w-5 h-5 mr-2" />
                    Create Plan
                  </div>
                  <button
                    onClick={() => setShowPlanForm(!showPlanForm)}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    {showPlanForm ? 'Cancel' : 'New'}
                  </button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {showPlanForm ? (
                  <form onSubmit={createTravelPlan} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Destination Address
                      </label>
                      <input
                        type="text"
                        value={newPlan.destination.address}
                        onChange={(e) => setNewPlan({
                          ...newPlan,
                          destination: { ...newPlan.destination, address: e.target.value }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter destination"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          City
                        </label>
                        <input
                          type="text"
                          value={newPlan.destination.city}
                          onChange={(e) => setNewPlan({
                            ...newPlan,
                            destination: { ...newPlan.destination, city: e.target.value }
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Country
                        </label>
                        <input
                          type="text"
                          value={newPlan.destination.country}
                          onChange={(e) => setNewPlan({
                            ...newPlan,
                            destination: { ...newPlan.destination, country: e.target.value }
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Start Date
                        </label>
                        <input
                          type="date"
                          value={newPlan.startDate}
                          onChange={(e) => setNewPlan({ ...newPlan, startDate: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          End Date
                        </label>
                        <input
                          type="date"
                          value={newPlan.endDate}
                          onChange={(e) => setNewPlan({ ...newPlan, endDate: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Transportation
                        </label>
                        <select
                          value={newPlan.transportation}
                          onChange={(e) => setNewPlan({ ...newPlan, transportation: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="car">Car</option>
                          <option value="plane">Plane</option>
                          <option value="train">Train</option>
                          <option value="bus">Bus</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Accommodation
                        </label>
                        <select
                          value={newPlan.accommodation}
                          onChange={(e) => setNewPlan({ ...newPlan, accommodation: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="hotel">Hotel</option>
                          <option value="hostel">Hostel</option>
                          <option value="airbnb">Airbnb</option>
                          <option value="friends">Friends/Family</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={useCurrentLocationForDestination}
                        className="flex-1 px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
                      >
                        <MapPin className="w-4 h-4 inline mr-1" />
                        Use Current
                      </button>
                      <button
                        type="button"
                        onClick={checkDestinationSafety}
                        className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                      >
                        <Shield className="w-4 h-4 inline mr-1" />
                        Check Safety
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      {loading ? 'Creating...' : 'Create Travel Plan'}
                    </button>
                  </form>
                ) : (
                  <div className="text-center py-4">
                    <Plane className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-gray-600 mb-2">No travel plans</p>
                    <p className="text-sm text-gray-500">Create a plan to start your safe journey</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Travel Plans List */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Calendar className="w-5 h-5 mr-2" />
                    My Travel Plans
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {travelPlans.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p>No travel plans yet</p>
                      <p className="text-sm">Create your first travel plan to get started</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {travelPlans.map((plan) => (
                        <div key={plan._id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h3 className="font-medium text-lg">{plan.destination.address}</h3>
                              <div className="flex items-center space-x-2 mt-1">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(plan.status)}`}>
                                  {plan.status.toUpperCase()}
                                </span>
                                {plan.safetyScore && (
                                  <span className={`text-sm font-medium ${getSafetyColor(plan.safetyScore)}`}>
                                    Safety: {plan.safetyScore}/100
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right text-sm text-gray-500">
                              <div>{formatDate(plan.startDate)}</div>
                              <div>to {formatDate(plan.endDate)}</div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3 text-sm">
                            <div className="flex items-center">
                              <Plane className="w-4 h-4 mr-1 text-gray-400" />
                              {plan.transportation}
                            </div>
                            <div className="flex items-center">
                              <Hotel className="w-4 h-4 mr-1 text-gray-400" />
                              {plan.accommodation}
                            </div>
                            <div className="flex items-center">
                              <MapPin className="w-4 h-4 mr-1 text-gray-400" />
                              {plan.destination.city}
                            </div>
                            <div className="flex items-center">
                              <Globe className="w-4 h-4 mr-1 text-gray-400" />
                              {plan.destination.country}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {plan.status === 'planned' && (
                              <button
                                onClick={() => startJourney(plan._id)}
                                className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                              >
                                <Navigation className="w-3 h-3 inline mr-1" />
                                Start Journey
                              </button>
                            )}
                            
                            {plan.status === 'active' && (
                              <button
                                onClick={() => checkIn(plan._id)}
                                className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                              >
                                <CheckCircle className="w-3 h-3 inline mr-1" />
                                Check In
                              </button>
                            )}
                            
                            {plan.status === 'active' && (
                              <button
                                onClick={() => endJourney(plan._id)}
                                className="px-3 py-1 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
                              >
                                <CheckCircle className="w-3 h-3 inline mr-1" />
                                End Journey
                              </button>
                            )}

                            {plan.checkIns && plan.checkIns.length > 0 && (
                              <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-sm">
                                {plan.checkIns.length} check-ins
                              </span>
                            )}
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

        {activeTab === 'safety' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Destination Safety Check */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Shield className="w-5 h-5 mr-2" />
                  Destination Safety
                </CardTitle>
              </CardHeader>
              <CardContent>
                {destinationSafety ? (
                  <div className="space-y-4">
                    <div className="text-center">
                      <div className={`text-4xl font-bold ${getSafetyColor(destinationSafety.safetyInfo.safetyScore)}`}>
                        {destinationSafety.safetyInfo.safetyScore}/100
                      </div>
                      <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium mt-2 ${getRiskLevelColor(destinationSafety.safetyInfo.riskLevel)}`}>
                        {destinationSafety.safetyInfo.riskLevel} RISK
                      </div>
                    </div>

                    {destinationSafety.safetyInfo.riskFactors.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Risk Factors</h4>
                        <ul className="space-y-1">
                          {destinationSafety.safetyInfo.riskFactors.map((factor, index) => (
                            <li key={index} className="text-sm text-gray-600 flex items-start">
                              <AlertTriangle className="w-3 h-3 mr-2 mt-1 text-yellow-500" />
                              {factor}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {destinationSafety.safetyInfo.recommendations.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Recommendations</h4>
                        <ul className="space-y-1">
                          {destinationSafety.safetyInfo.recommendations.map((rec, index) => (
                            <li key={index} className="text-sm text-gray-600 flex items-start">
                              <Info className="w-3 h-3 mr-2 mt-1 text-blue-500" />
                              {rec}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Shield className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>Enter a destination to check safety</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Travel Tips */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Info className="w-5 h-5 mr-2" />
                  Travel Safety Tips
                </CardTitle>
              </CardHeader>
              <CardContent>
                {destinationSafety && destinationSafety.travelTips ? (
                  <div className="space-y-4">
                    {destinationSafety.travelTips.map((category, index) => (
                      <div key={index}>
                        <h4 className="font-medium mb-2">{category.category}</h4>
                        <ul className="space-y-1">
                          {category.tips.map((tip, tipIndex) => (
                            <li key={tipIndex} className="text-sm text-gray-600 flex items-start">
                              <span className="text-blue-600 mr-2">•</span>
                              {tip}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">General Safety</h4>
                      <ul className="space-y-1 text-sm text-gray-600">
                        <li>• Research your destination before arrival</li>
                        <li>• Keep copies of important documents</li>
                        <li>• Learn basic local phrases</li>
                        <li>• Register with your embassy if traveling internationally</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">Transportation</h4>
                      <ul className="space-y-1 text-sm text-gray-600">
                        <li>• Use reputable taxi or ride-sharing services</li>
                        <li>• Verify driver details before getting in</li>
                        <li>• Share ride details with contacts</li>
                        <li>• Avoid accepting rides from strangers</li>
                      </ul>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default TravelSafety;
