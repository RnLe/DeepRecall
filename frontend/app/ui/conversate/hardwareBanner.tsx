// hardwareBanner.tsx

import React, { useState, useEffect } from 'react';
import { hardwareResponse } from '../../types/diarizationTypes';

export const HardwareBanner: React.FC = () => {
  const [hardware, setHardware] = useState<hardwareResponse | null>(null);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_PYTHON_API_URL}/hardware`)
      .then((res) => res.json())
      .then((data) => setHardware(data))
      .catch((err) => console.error('Hardware check failed', err));
  }, []);

  return (
    <div className="p-4 border rounded shadow-lg bg-gray-800">
      <h3 className="text-lg font-bold mb-4 text-white">System Hardware</h3>
      <div className="flex w-full mb-4 space-x-4">
        {/* CPU Card */}
        <div
          className={`p-4 border rounded flex-1 shadow-lg transform hover:scale-105 transition ${
            hardware ? 'bg-gradient-to-r from-green-400 to-blue-500' : 'bg-gray-700'
          }`}
        >
          {hardware ? (
            <>
              <h4 className="font-bold mb-1">CPU</h4>
              <p className="text-sm">
                {hardware.cpu.brand} ({hardware.cpu.architecture})
              </p>
              <p className="text-xs">
                {hardware.cpu.physicalCores} physical / {hardware.cpu.logicalCores} logical cores
              </p>
              <p className="text-xs">Freq: {hardware.cpu.frequencyCurrentMHz} MHz</p>
            </>
          ) : (
            <>
              <p className="text-center">Loading CPU info...</p>
              <p className="text-sm">&nbsp;</p>
              <p className="text-xs">&nbsp;</p>
              <p className="text-xs">&nbsp;</p>
            </>
          )}
        </div>
        {/* GPU Card */}
        <div
          className={`p-4 border rounded flex-1 shadow-lg transform hover:scale-105 transition ${
            hardware && hardware.gpu.available ? 'bg-gradient-to-r from-purple-400 to-pink-500' : 'bg-gray-700'
          }`}
        >
          {hardware && hardware.gpu.available ? (
            <>
              <h4 className="font-bold mb-1">GPU</h4>
              <p className="text-sm">{hardware.gpu.name}</p>
              <p className="text-xs">
                {hardware.gpu.totalMemoryGB} GB, Compute Capability: {hardware.gpu.computeCapability}
              </p>
              <p className="text-xs">Multiprocessors: {hardware.gpu.multiProcessorCount}</p>
            </>
          ) : (
            <>
              <p className="text-center">GPU not available</p>
              <p className="text-sm">&nbsp;</p>
              <p className="text-xs">&nbsp;</p>
              <p className="text-xs">&nbsp;</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
