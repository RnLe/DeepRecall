// src/components/leftSidebar/AiTasksPanel.tsx
import React, { useState } from "react";
import { AiTasks } from "@/app/api/openAI/promptTypes";
import { availableModels } from "@/app/api/openAI/openAIService";
import { DollarSign, ChevronDown } from "lucide-react";

type Map = Record<string, string>; // taskKey → modelName

interface Props {
  taskModelMap: Map;                 // current mapping (session state from parent)
  setTaskModelMap: (m: Map) => void; // updater from parent
}

const AiTasksPanel: React.FC<Props> = ({ taskModelMap, setTaskModelMap }) => {
  // helper: update a single entry
  const setModel = (taskKey: string, model: string) =>
    setTaskModelMap({ ...taskModelMap, [taskKey]: model });

  // track which cards are open
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggle = (key: string) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="h-full overflow-y-auto text-sm p-2 space-y-4">
      {/* ────────── MODELS ────────── */}
      <section>
        <h3 className="font-semibold mb-2">Available models</h3>
        <ul className="space-y-1">
          {availableModels.map((m) => (
            <li
              key={m.name}
              className="flex justify-between items-center bg-gray-800 rounded px-2 py-1"
            >
              <span>{m.description}</span>
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <DollarSign size={12} /> {m.input.toFixed(2)} / {m.output.toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* ────────── TASKS ────────── */}
      <section>
        <h3 className="font-semibold mb-2">AI tasks</h3>
        <div className="space-y-1">
          {Object.entries(AiTasks).map(([key, t]) => (
            <div
              key={key}
              className="bg-gray-800 rounded px-2 py-2 space-y-2 min-w-0"
            >
              {/* header with chevron */}
              <div className="flex justify-between items-center">
                <div className="font-medium">{t.name}</div>
                <button onClick={() => toggle(key)} className="p-1">
                  <ChevronDown
                    size={14}
                    className={`text-gray-400 transition-transform ${
                      expanded[key] ? "rotate-180" : ""
                    }`}
                  />
                </button>
              </div>

              {/* expanded content */}
              {expanded[key] && (
                <>
                  <div className="text-xs text-gray-400 break-words whitespace-normal">
                    {t.description}
                  </div>
                  <div>
                    <select
                      value={taskModelMap[key]}
                      onChange={(e) => setModel(key, e.target.value)}
                      className="w-full appearance-none bg-gray-700 text-white pr-5 pl-2 py-0.5 text-xs rounded"
                    >
                      {availableModels.map((m) => (
                        <option key={m.name} value={m.name}>
                          {m.description}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default AiTasksPanel;
