'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

export interface GraphSettingsProps {
  chargeStrength: number;
  onChargeStrengthChange: (value: number) => void;
  linkDistance: number;
  onLinkDistanceChange: (value: number) => void;
  linkStrength: number;
  onLinkStrengthChange: (value: number) => void;
  collisionRadius: number;
  onCollisionRadiusChange: (value: number) => void;
  centerStrength: number;
  onCenterStrengthChange: (value: number) => void;
  onReset: () => void;
}

export default function GraphSettings({
  chargeStrength,
  onChargeStrengthChange,
  linkDistance,
  onLinkDistanceChange,
  linkStrength,
  onLinkStrengthChange,
  collisionRadius,
  onCollisionRadiusChange,
  centerStrength,
  onCenterStrengthChange,
  onReset,
}: GraphSettingsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 min-w-[300px]">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-2 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 rounded-t-lg transition-colors"
      >
        <span className="font-semibold text-sm">Graph Settings</span>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
      </button>

      {isExpanded && (
        <div className="p-4 space-y-4 border-t border-gray-200 dark:border-gray-700">
          <div>
            <label className="flex items-center justify-between text-xs font-medium mb-1">
              <span>Charge Strength (Repulsion)</span>
              <span className="text-gray-500">{chargeStrength}</span>
            </label>
            <input
              type="range"
              min="-1000"
              max="-50"
              step="10"
              value={chargeStrength}
              onChange={(e) => onChargeStrengthChange(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
            />
          </div>

          <div>
            <label className="flex items-center justify-between text-xs font-medium mb-1">
              <span>Link Distance</span>
              <span className="text-gray-500">{linkDistance}</span>
            </label>
            <input
              type="range"
              min="20"
              max="200"
              step="5"
              value={linkDistance}
              onChange={(e) => onLinkDistanceChange(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
            />
          </div>

          <div>
            <label className="flex items-center justify-between text-xs font-medium mb-1">
              <span>Link Strength</span>
              <span className="text-gray-500">{linkStrength.toFixed(2)}</span>
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={linkStrength}
              onChange={(e) => onLinkStrengthChange(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
            />
          </div>

          <div>
            <label className="flex items-center justify-between text-xs font-medium mb-1">
              <span>Collision Radius</span>
              <span className="text-gray-500">{collisionRadius}</span>
            </label>
            <input
              type="range"
              min="10"
              max="50"
              step="1"
              value={collisionRadius}
              onChange={(e) => onCollisionRadiusChange(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
            />
          </div>

          <div>
            <label className="flex items-center justify-between text-xs font-medium mb-1">
              <span>Center Strength</span>
              <span className="text-gray-500">{centerStrength.toFixed(2)}</span>
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={centerStrength}
              onChange={(e) => onCenterStrengthChange(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
            />
          </div>

          <button
            onClick={onReset}
            className="w-full px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
          >
            Reset to Defaults
          </button>
        </div>
      )}
    </div>
  );
}
