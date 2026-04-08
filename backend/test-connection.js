// Simple test file to verify backend connectivity
import fetch from 'node-fetch';

const testConnection = async () => {
  try {
    console.log('Testing backend connection...');
    
    // Test basic API endpoint
    const response = await fetch('http://localhost:3000/', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      'User-Agent': 'test-connection'
      }
    });

    if (response.ok) {
      const data = await response.text();
      console.log('✅ Backend is responding correctly!');
      console.log('Response:', data);
    } else {
      console.log('❌ Backend responded with status:', response.status);
    }
  } catch (error) {
    console.error('❌ Error connecting to backend:', error.message);
  }
};

testConnection();
