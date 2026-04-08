import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Shield, AlertTriangle, MapPin, Clock, Lightbulb, Route } from 'lucide-react';
import { toast } from 'react-toastify';
import Header from '../components/shared/Header';
import { API_URL } from '../utils/utils';

const SafetyAssessment = () => {
  const [currentLocation, setCurrentLocation] = useState(null);
  const [safetyData, setSafetyData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [safetyTips, setSafetyTips] = useState([]);
  const [activeTab, setActiveTab] = useState('assessment');

  useEffect(() => {
    getCurrentLocation();
    fetchSafetyTips();
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
          assessSafety(location);
        },
        (error) => {
          toast.error('Unable to get your location. Please enable location services.');
          console.error('Geolocation error:', error);
        }
      );
    } else {
      toast.error('Geolocation is not supported by your browser');
    }
  };

  const assessSafety = async (location) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/safety/assess-location`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          lat: location.lat,
          lon: location.lon,
          timeOfDay: new Date().getHours()
        })
      });

      const data = await response.json();
      if (response.ok) {
        setSafetyData(data);
      } else {
        toast.error(data.message || 'Failed to assess safety');
      }
    } catch (error) {
      toast.error('Error assessing location safety');
      console.error('Safety assessment error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSafetyTips = async () => {
    try {
      const response = await fetch(`${API_URL}/api/safety/safety-tips?situation=general`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (response.ok) {
        setSafetyTips(data.tips || []);
      }
    } catch (error) {
      console.error('Error fetching safety tips:', error);
    }
  };

  const getRiskColor = (riskLevel) => {
    switch (riskLevel) {
      case 'LOW': return 'text-green-600 bg-green-100';
      case 'MODERATE': return 'text-yellow-600 bg-yellow-100';
      case 'HIGH': return 'text-orange-600 bg-orange-100';
      case 'CRITICAL': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getSafetyScoreColor = (score) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const handleReassess = () => {
    if (currentLocation) {
      assessSafety(currentLocation);
    } else {
      getCurrentLocation();
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">AI Safety Assessment</h1>
          <p className="text-gray-600">Get real-time safety analysis and personalized recommendations</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-4 mb-6">
          <button
            onClick={() => setActiveTab('assessment')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'assessment'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Shield className="inline-block w-4 h-4 mr-2" />
            Safety Assessment
          </button>
          <button
            onClick={() => setActiveTab('tips')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'tips'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Lightbulb className="inline-block w-4 h-4 mr-2" />
            Safety Tips
          </button>
        </div>

        {activeTab === 'assessment' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Safety Score Card */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Shield className="w-6 h-6 mr-2 text-blue-600" />
                  Current Location Safety Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Analyzing location safety...</p>
                  </div>
                ) : safetyData ? (
                  <div className="space-y-6">
                    {/* Safety Score */}
                    <div className="text-center">
                      <div className={`text-6xl font-bold ${getSafetyScoreColor(safetyData.safetyScore)}`}>
                        {safetyData.safetyScore}
                      </div>
                      <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium mt-2 ${getRiskColor(safetyData.riskLevel)}`}>
                        {safetyData.riskLevel} RISK
                      </div>
                    </div>

                    {/* Location Info */}
                    <div className="flex items-center text-gray-600">
                      <MapPin className="w-4 h-4 mr-2" />
                      <span className="text-sm">{safetyData.location}</span>
                    </div>

                    {/* Risk Factors */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-gray-700">
                          {Math.round(safetyData.riskFactors.timeRisk * 100)}%
                        </div>
                        <div className="text-sm text-gray-500">Time Risk</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-gray-700">
                          {Math.round(safetyData.riskFactors.locationRisk * 100)}%
                        </div>
                        <div className="text-sm text-gray-500">Location Risk</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-gray-700">
                          {Math.round(safetyData.riskFactors.populationRisk * 100)}%
                        </div>
                        <div className="text-sm text-gray-500">Population Risk</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-gray-700">
                          {Math.round(safetyData.riskFactors.crimeRisk * 100)}%
                        </div>
                        <div className="text-sm text-gray-500">Crime Risk</div>
                      </div>
                    </div>

                    {/* Recommendations */}
                    {safetyData.recommendations.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-gray-800 mb-3 flex items-center">
                          <AlertTriangle className="w-4 h-4 mr-2 text-yellow-600" />
                          Safety Recommendations
                        </h3>
                        <ul className="space-y-2">
                          {safetyData.recommendations.map((recommendation, index) => (
                            <li key={index} className="flex items-start">
                              <span className="text-blue-600 mr-2">•</span>
                              <span className="text-gray-700 text-sm">{recommendation}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <button
                      onClick={handleReassess}
                      className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Reassess Current Location
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 mb-4">No safety data available</p>
                    <button
                      onClick={getCurrentLocation}
                      className="bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Get Location Assessment
                    </button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'tips' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {safetyTips.map((category, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Lightbulb className="w-5 h-5 mr-2 text-yellow-500" />
                    {category.category}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {category.tips.map((tip, tipIndex) => (
                      <li key={tipIndex} className="flex items-start">
                        <span className="text-blue-600 mr-2 mt-1">•</span>
                        <span className="text-gray-700 text-sm">{tip}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SafetyAssessment;
