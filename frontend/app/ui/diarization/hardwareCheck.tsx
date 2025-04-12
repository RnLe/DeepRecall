import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

interface HardwareCheckProps {
  onCheckComplete: (device: string) => void;
}

const HardwareCheck: React.FC<HardwareCheckProps> = ({ onCheckComplete }) => {
  const [device, setDevice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const checkHardware = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_PYTHON_API_URL}/hardware-check`);
      const data = await res.json();
      setDevice(data.device);
      onCheckComplete(data.device);
    } catch (error) {
      console.error("Hardware check failed", error);
    }
    setLoading(false);
  };

  return (
    <div className="p-4 bg-gray-800 rounded text-white">
      <h2 className="text-xl font-bold">Hardware Check</h2>
      <button
        onClick={checkHardware}
        disabled={loading}
        className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded"
      >
        {loading ? "Checking..." : "Check Hardware"}
      </button>
      {device && (
        <p className="mt-2 text-green-500">Device: {device.toUpperCase()}</p>
      )}
    </div>
  );
};

export default HardwareCheck;