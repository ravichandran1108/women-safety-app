import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { API_URL } from '../../utils/utils';

const ShakeDetector = () => {
  const [isShakeEnabled, setIsShakeEnabled] = useState(false);
  const [lastShakeTime, setLastShakeTime] = useState(0);
  const [shakeCount, setShakeCount] = useState(0);
  const accelerationData = useRef([]);
  const shakeThreshold = useRef(30); // Adjust sensitivity
  const shakeTimeout = useRef(null);

  useEffect(() => {
    // Load shake detection preference from localStorage
    const savedPreference = localStorage.getItem('shakeDetectionEnabled');
    if (savedPreference !== null) {
      setIsShakeEnabled(JSON.parse(savedPreference));
    }

    return () => {
      if (shakeTimeout.current) {
        clearTimeout(shakeTimeout.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isShakeEnabled) {
      enableShakeDetection();
    } else {
      disableShakeDetection();
    }

    return () => {
      disableShakeDetection();
    };
  }, [isShakeEnabled]);

  const enableShakeDetection = () => {
    if (window.DeviceMotionEvent) {
      window.addEventListener('devicemotion', handleMotion);
      toast.info('Shake detection enabled. Shake your phone 3 times quickly to send SOS.');
    } else {
      toast.error('Device motion is not supported on this device');
      setIsShakeEnabled(false);
    }
  };

  const disableShakeDetection = () => {
    window.removeEventListener('devicemotion', handleMotion);
    if (shakeTimeout.current) {
      clearTimeout(shakeTimeout.current);
    }
  };

  const handleMotion = (event) => {
    if (!event.accelerationIncludingGravity) return;

    const acceleration = event.accelerationIncludingGravity;
    const currentTime = new Date().getTime();

    // Collect acceleration data
    accelerationData.current.push({
      x: acceleration.x,
      y: acceleration.y,
      z: acceleration.z,
      timestamp: currentTime
    });

    // Keep only recent data (last 500ms)
    accelerationData.current = accelerationData.current.filter(
      data => currentTime - data.timestamp < 500
    );

    // Check for shake pattern
    if (accelerationData.current.length >= 10) {
      detectShake();
    }
  };

  const detectShake = () => {
    const data = accelerationData.current;
    let totalAcceleration = 0;

    // Calculate total acceleration
    for (let i = 1; i < data.length; i++) {
      const deltaX = Math.abs(data[i].x - data[i-1].x);
      const deltaY = Math.abs(data[i].y - data[i-1].y);
      const deltaZ = Math.abs(data[i].z - data[i-1].z);
      
      totalAcceleration += deltaX + deltaY + deltaZ;
    }

    // Check if acceleration exceeds threshold
    if (totalAcceleration > shakeThreshold.current) {
      const currentTime = new Date().getTime();
      
      // Reset shake count if too much time has passed
      if (currentTime - lastShakeTime > 2000) {
        setShakeCount(1);
      } else {
        setShakeCount(prev => prev + 1);
      }
      
      setLastShakeTime(currentTime);

      // Trigger SOS after 3 shakes within 2 seconds
      if (shakeCount >= 2) { // Already at 2, this is the 3rd shake
        triggerSOS();
        setShakeCount(0);
        accelerationData.current = [];
      }
    }
  };

  const triggerSOS = async () => {
    try {
      // Get current location
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0,
        });
      });

      const coords = [position.coords.longitude, position.coords.latitude];
      
      // Send SOS alert
      const res = await fetch(`${API_URL}/api/feature/send-alert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lon: position.coords.longitude, lat: position.coords.latitude }),
        credentials: 'include',
      });

      const data = await res.json();
      if (res.status === 200) {
        // Play SOS sound (using a simple beep)
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800; // 800 Hz tone
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
        toast.success("🚨 SOS Alert sent via Shake Detection!");
        
        // Show confirmation dialog
        if (window.confirm("SOS Alert has been sent to your emergency contacts. Do you want to cancel it?")) {
          // In a real implementation, you might want to add a cancel feature
          toast.info("SOS Alert is active. Emergency contacts have been notified.");
        }
      } else {
        toast.error("Failed to send SOS alert: " + data.message);
      }
    } catch (err) {
      toast.error("Error sending SOS alert: " + err.message);
      console.error('Shake detection SOS error:', err);
    }
  };

  const toggleShakeDetection = () => {
    const newValue = !isShakeEnabled;
    setIsShakeEnabled(newValue);
    localStorage.setItem('shakeDetectionEnabled', JSON.stringify(newValue));
    
    if (newValue) {
      toast.info('Shake detection enabled. Shake your phone 3 times quickly to send SOS.');
    } else {
      toast.info('Shake detection disabled.');
    }
  };

  // Don't render on desktop or if not supported
  if (!window.DeviceMotionEvent) {
    return null;
  }

  return (
    <div className="fixed bottom-20 right-4 z-40">
      <div className="bg-white rounded-lg shadow-lg p-3 mb-2">
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${isShakeEnabled ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
          <span className="text-xs font-medium text-gray-700">Shake SOS</span>
        </div>
        <button
          onClick={toggleShakeDetection}
          className={`mt-2 w-full px-3 py-1 rounded text-xs font-medium transition-colors ${
            isShakeEnabled 
              ? 'bg-red-600 text-white hover:bg-red-700' 
              : 'bg-gray-600 text-white hover:bg-gray-700'
          }`}
        >
          {isShakeEnabled ? 'Disable' : 'Enable'}
        </button>
      </div>
      
      {isShakeEnabled && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-xs text-blue-700">
          <div className="font-medium mb-1">How to use:</div>
          <div>Shake phone 3x quickly to send SOS</div>
          <div className="mt-1 text-blue-600">Current shakes: {shakeCount}/3</div>
        </div>
      )}
    </div>
  );
};

export default ShakeDetector;
