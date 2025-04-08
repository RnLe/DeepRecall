// speakerTimeline.tsx

import React, { useEffect, useRef, useState } from 'react';
import { DiarizationResult } from '../helpers/diarizationHelpers';
import { Speaker } from '../helpers/diarizationTypes';

interface SpeakerTimelineProps {
  results: DiarizationResult[];
  totalDuration: number;
  assignedMapping: { [key: string]: string }; // diarization speaker label → assigned speaker id
  availableSpeakers: Speaker[];
  audioSrc: string; // New prop for audio source
  fixedSpeakerCount: number; // new prop
}

export const SpeakerTimeline: React.FC<SpeakerTimelineProps> = ({ results, totalDuration, assignedMapping, availableSpeakers, audioSrc, fixedSpeakerCount }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);
  const [currentTime, setCurrentTime] = useState(0);
  const barHeight = 30; // increased height per speaker

  useEffect(() => {
    if (containerRef.current) {
      setContainerWidth(containerRef.current.offsetWidth);
    }
    const handleResize = () => {
      if (containerRef.current) setContainerWidth(containerRef.current.offsetWidth);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Use fixed labels based on fixedSpeakerCount.
  const fixedLabels = Array.from({ length: fixedSpeakerCount }, (_, i) => `SPEAKER_${i < 10 ? `0${i}` : i}`);
  const canvasWidth = containerWidth;
  const canvasHeight = fixedLabels.length * barHeight + barHeight; // Add one extra row for the invisible bar

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    const scaleX = (time: number) => (time / totalDuration) * canvasWidth;

    // Draw subtle grid and x-axis
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= totalDuration; i += 60) { // Show only minutes
      const x = scaleX(i);
      ctx.beginPath();
      ctx.moveTo(x, canvasHeight - barHeight); // Move grid lines to the bottom
      ctx.lineTo(x, canvasHeight); // Extend grid lines to the bottom bar
      ctx.stroke();
      ctx.fillStyle = 'white';
      ctx.font = '10px Arial';
      ctx.fillText(`${Math.floor(i / 60)}m`, x + 2, canvasHeight - 5); // Position text above the bottom bar
    }

    // Draw speaker bars for each result using fixedLabels order.
    results.forEach(result => {
      // result.speaker should match one of fixedLabels e.g., "SPEAKER_00"
      const speakerIndex = fixedLabels.indexOf(result.speaker);
      if (speakerIndex === -1) return;
      const x = scaleX(result.startTime);
      const width = scaleX(result.duration);
      const y = speakerIndex * barHeight; // Adjust bars to start from the top
      const assignedId = assignedMapping[result.speaker];
      let fillColor = '';
      if (assignedId) {
        const sp = availableSpeakers.find(s => s.id === assignedId);
        fillColor = sp && sp.color ? sp.color : 'gray';
      } else {
        fillColor = 'gray';
      }
      ctx.fillStyle = fillColor;
      ctx.fillRect(x, y, width, barHeight - 2);
    });
  }, [results, totalDuration, assignedMapping, availableSpeakers, canvasWidth, canvasHeight, fixedLabels, barHeight]);

  return (
    <div className="mt-4 w-full flex flex-col items-center bg-gray-800 p-4 rounded" ref={containerRef}>
      <h4 className="text-xl font-extrabold mb-2">Speaker Timeline</h4>
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={canvasHeight}
        className="w-full border"
      />
      <div className="mt-4 flex flex-wrap justify-center">
        {fixedLabels.map((label, index) => {
          const assignedId = assignedMapping[label];
          const sp = assignedId ? availableSpeakers.find(s => s.id === assignedId) : null;
          const displayName = sp ? sp.name : `Speaker ${index + 1}`;
          const color = assignedId ? (sp && sp.color ? sp.color : 'gray') : 'gray';
          return (
            <div key={label} className="flex items-center mr-4 mb-2">
              <div className="w-4 h-4 mr-1" style={{ backgroundColor: color }}></div>
              <span className="text-sm text-white">{displayName}</span>
            </div>
          );
        })}
      </div>
      {/* Commented out speaker selection code */}
      {/* <div className="mt-4 flex flex-wrap justify-center">
        {speakers.map((ds, index) => {
          const assignedId = assignedMapping[ds];
          const sp = assignedId ? availableSpeakers.find(s => s.id === assignedId) : null;
          const displayName = sp ? sp.name : ds;
          const hue = sp && sp.color ? sp.color : `hsl(${(index * 137.508) % 360}, 70%, 50%)`;
          return (
            <div key={ds} className="flex items-center mr-4 mb-2">
              <div className="w-4 h-4 mr-1" style={{ backgroundColor: hue }}></div>
              <span className="text-sm">{displayName}</span>
            </div>
          );
        })}
      </div> */}
    </div>
  );
};