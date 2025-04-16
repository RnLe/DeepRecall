// PlannerRightSidebar.tsx
import React, { useState } from 'react';
import { agoTimeToString } from '@/app/helpers/timesToString';
import { GoogleIntegrationCard } from './GoogleIntegrationCard';
import { toPng } from "html-to-image";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

type IntegrationType = 'google-calendar' | 'todoist' | 'obsidian' | 'openai';

// Extend props with canvasState and setCanvasState
interface PlannerRightSidebarProps {
  collapsed: boolean;
  toggleCollapse: () => void;
  canvasState: any; // Ideally CanvasState interface
  setCanvasState: React.Dispatch<React.SetStateAction<any>>;
}

// A simple integration card for non-Google integrations.
const IntegrationCard: React.FC<{ type: IntegrationType }> = ({ type }) => {
  return (
    <div className="flex items-center p-4 mb-4 bg-gray-700 rounded shadow border border-gray-600">
      <div className="text-3xl mr-4">
        <img 
          src={`/icons/integrations/${type === 'openai' ? 'openAiIcon_dark' : type + 'Icon'}.svg`} 
          alt={`${type} Icon`} 
          className="w-8 h-8" 
        />
      </div>
      <div className="flex-1">
        <p className="text-white font-bold">
          {type.charAt(0).toUpperCase() + type.slice(1)}
        </p>
      </div>
    </div>
  );
};

// List of exportable components on the canvas.
// In a real app, you might derive this list dynamically.
const availableComponents = [
  { id: "planner12week", name: "12 Week Goals" }
];

// ----- Export helper functions -----
const exportAsPng = (element: HTMLElement, fileName: string) => {
  toPng(element)
    .then((dataUrl) => {
      const link = document.createElement('a');
      link.download = fileName;
      link.href = dataUrl;
      link.click();
    })
    .catch((err) => console.error("Export PNG error: ", err));
};

const exportAsPdf = async (element: HTMLElement, fileName: string) => {
  try {
    const canvas = await html2canvas(element);
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "px",
      format: [canvas.width, canvas.height],
    });
    pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
    pdf.save(fileName);
  } catch (error) {
    console.error("Export PDF error: ", error);
  }
};

export const PlannerRightSidebar: React.FC<PlannerRightSidebarProps> = ({ collapsed, toggleCollapse, canvasState, setCanvasState }) => {
  const [lastSaved, setLastSaved] = useState<number>(Math.floor(Date.now() / 1000));
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [selectedExportType, setSelectedExportType] = useState<'pdf' | 'png' | null>(null);
  // New state for load modal visibility and list of saves.
  const [loadModalOpen, setLoadModalOpen] = useState(false);
  const [availableSaves, setAvailableSaves] = useState<any[]>([]);

  const handleSave = () => {
    const newSave = {
      timestamp: Date.now(),
      version: canvasState.version,
      state: canvasState,
    };
    // Get existing saves from localStorage
    const saves = JSON.parse(localStorage.getItem("deepRecallSaves") || "[]");
    saves.push(newSave);
    localStorage.setItem("deepRecallSaves", JSON.stringify(saves));
    setLastSaved(Math.floor(Date.now() / 1000));
  };

  const openExportModal = (exportType: 'pdf' | 'png') => {
    setSelectedExportType(exportType);
    setExportModalOpen(true);
  };

  const handleExport = (target: "canvas" | { componentId: string }) => {
    let element: HTMLElement | null = null;
    let fileName = "";
    if (target === "canvas") {
      // The entire canvas should be wrapped with id "reactflow-container"
      element = document.getElementById("reactflow-container");
      fileName = exportModalOpen && selectedExportType === "pdf" ? "canvas-export.pdf" : "canvas-export.png";
    } else {
      // Single component export; we expect its export container has id "export-[componentId]"
      element = document.getElementById(`export-${target.componentId}`);
      fileName = exportModalOpen && selectedExportType === "pdf"
        ? `${target.componentId}-export.pdf`
        : `${target.componentId}-export.png`;
    }
    if (element && selectedExportType) {
      if (selectedExportType === "png") {
        exportAsPng(element, fileName);
      } else if (selectedExportType === "pdf") {
        exportAsPdf(element, fileName);
      }
    } else {
      console.error("Unable to find element to export.");
    }
    // Close modal after export.
    setExportModalOpen(false);
    setSelectedExportType(null);
  };

  // Load saves: open modal and list all saved states
  const openLoadModal = () => {
    const saves = JSON.parse(localStorage.getItem("deepRecallSaves") || "[]");
    setAvailableSaves(saves);
    setLoadModalOpen(true);
  };

  // On selecting a save, check version warning and load state
  const handleLoad = (save: any) => {
    if (save.version !== canvasState.version) {
      if (
        !window.confirm(
          `Version mismatch: saved version ${save.version} vs canvas version ${canvasState.version}. Continue?`
        )
      ) {
        return;
      }
    }
    setCanvasState(save.state);
    setLoadModalOpen(false);
  };

  return (
    <div
      className={`box-border h-full flex flex-col transition-all duration-300 ${
        collapsed ? 'w-8' : 'w-60 p-4'
      } bg-gray-800 border-l border-gray-700 relative overflow-y-auto overflow-x-hidden`}
    >
      {/* Collapse/Expand Button */}
      <button
        className="absolute -left-8 top-1/2 -translate-y-1/2 w-8 h-16 bg-gray-700 hover:bg-gray-600 flex items-center justify-center rounded-l z-20 border border-gray-600"
        onClick={toggleCollapse}
        tabIndex={0}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <span className="text-white text-lg">{collapsed ? '⮜' : '⮞'}</span>
      </button>
      {!collapsed && (
        <>
          {/* Integrations Section */}
          <div className="mb-6">
            <h3 className="text-xl font-bold mb-2 text-white">Integrations</h3>
            <GoogleIntegrationCard />
            <IntegrationCard type="todoist" />
            <IntegrationCard type="obsidian" />
            <IntegrationCard type="openai" />
          </div>

          {/* Export Section */}
          <div className="mb-6">
            <h3 className="text-xl font-bold mb-2 text-white">Export</h3>
            <button
              onClick={() => openExportModal("pdf")}
              className="w-full mb-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
            >
              Export to PDF
            </button>
            <button
              onClick={() => openExportModal("png")}
              className="w-full mb-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
            >
              Export to PNG
            </button>
          </div>

          {/* Save/Load Section */}
          <div className="mb-6">
            <h3 className="text-xl font-bold mb-2 text-white">Save & Load</h3>
            <button
              className="w-full mb-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
              onClick={handleSave}
            >
              Save
            </button>
            <button
              className="w-full mb-2 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded"
              onClick={openLoadModal}
            >
              Load
            </button>
            <div className="text-sm text-gray-300 mt-2">Last saved: {agoTimeToString(lastSaved)}</div>
          </div>
        </>
      )}

      {/* Export Modal */}
      {exportModalOpen && selectedExportType && (
        <div className="fixed inset-0 z-50 flex justify-center items-center bg-black bg-opacity-50">
          <div className="bg-white rounded shadow-lg w-80 p-6 text-center">
            <h2 className="text-xl font-bold mb-4">Export Options</h2>
            {/* Option 1: Entire Canvas */}
            <button
              onClick={() => handleExport("canvas")}
              className="w-full mb-4 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded"
            >
              Entire Canvas
            </button>
            {/* Option 2: Single Component */}
            <div className="mb-2 text-gray-700 font-medium">Single Component</div>
            {availableComponents.map((comp) => (
              <button
                key={comp.id}
                onClick={() => handleExport({ componentId: comp.id })}
                className="w-full mb-2 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 rounded"
              >
                {comp.name}
              </button>
            ))}
            <button
              onClick={() => { setExportModalOpen(false); setSelectedExportType(null); }}
              className="mt-2 text-sm text-red-500 underline"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Load Modal */}
      {loadModalOpen && (
        <div className="fixed inset-0 z-50 flex justify-center items-center">
          <div className="absolute inset-0 bg-black bg-opacity-50"></div>
          <div className="bg-white rounded shadow-lg w-80 p-6 text-center z-10">
            <h2 className="text-xl font-bold mb-4">Available Saves</h2>
            <div className="max-h-60 overflow-y-auto">
              {availableSaves.length === 0 ? (
                <p>No saves found.</p>
              ) : (
                availableSaves.map((save, idx) => (
                  <div
                    key={idx}
                    className="p-2 border-b cursor-pointer hover:bg-gray-100"
                    onClick={() => handleLoad(save)}
                  >
                    <div>
                      {new Date(save.timestamp).toLocaleString()}
                    </div>
                    <div>Version: {save.version}</div>
                  </div>
                ))
              )}
            </div>
            <button
              onClick={() => setLoadModalOpen(false)}
              className="mt-4 text-sm text-red-500 underline"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlannerRightSidebar;
