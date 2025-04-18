// Planner12WeekGoals.tsx
"use client";

import React, { useState, useRef, useEffect } from "react";
import TwelveWeekSelector from "./TwelveWeekSelector";

interface TacticRow {
  tactic: string;
  due: string;
}

const VINTAGE_COLORS = [
  "#A3C1AD", // Sage
  "#F6C28B", // Peach
  "#B5B9B6", // Mist
  "#F7CAC9", // Rose
  "#92A8D1", // Dusty Blue
  "#FFE5B4", // Apricot
  "#BFD8B8", // Mint
  "#E6C7C2", // Blush
  "#C9BBCF", // Lavender
  "#F9E79F", // Pale Yellow
];

const Planner12WeekGoals: React.FC = () => {
  // ===============================
  // Section 1: 12 Week Goals State
  // ===============================
  const [goals, setGoals] = useState<string[]>([]);
  const [isAddingGoal, setIsAddingGoal] = useState<boolean>(false);
  const [goalInput, setGoalInput] = useState<string>("");

  // New states for goal color selection.
  const [goalColors, setGoalColors] = useState<{ [index: number]: string }>({});
  const [editingColorGoal, setEditingColorGoal] = useState<number | null>(null);

  // Refs for closing editing areas on outside click
  const addGoalRef = useRef<HTMLLIElement>(null);
  const colorMenuRef = useRef<HTMLDivElement>(null);
  const tacticInputRefs = useRef<{ [goalIndex: number]: HTMLDivElement | null }>({});
  const struggleInputRef = useRef<HTMLLIElement>(null);
  const overcomeInputRef = useRef<HTMLLIElement>(null);

  // ===============================
  // Section 2: Tactic Tables per Goal
  // ===============================
  const [tacticTables, setTacticTables] = useState<{ [goalIndex: number]: TacticRow[] }>({});
  const [newTacticInputs, setNewTacticInputs] = useState<{ [goalIndex: number]: TacticRow | null }>({});

  // ===============================
  // Section 3: Reflection Questions State
  // ===============================
  // For "What actions will you struggle with?"
  const [struggleActions, setStruggleActions] = useState<string[]>([]);
  const [isAddingStruggleAction, setIsAddingStruggleAction] = useState<boolean>(false);
  const [struggleActionInput, setStruggleActionInput] = useState<string>("");

  // For "What will you do to overcome these struggles?"
  const [overcomeActions, setOvercomeActions] = useState<string[]>([]);
  const [isAddingOvercomeAction, setIsAddingOvercomeAction] = useState<boolean>(false);
  const [overcomeActionInput, setOvercomeActionInput] = useState<string>("");

  // Close editing areas on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      // Add Goal
      if (
        isAddingGoal &&
        addGoalRef.current &&
        !addGoalRef.current.contains(e.target as Node)
      ) {
        setIsAddingGoal(false);
        setGoalInput("");
      }
      // Color menu
      if (
        editingColorGoal !== null &&
        colorMenuRef.current &&
        !colorMenuRef.current.contains(e.target as Node)
      ) {
        setEditingColorGoal(null);
      }
      // Tactic input
      Object.keys(newTacticInputs).forEach((goalIdx) => {
        if (
          newTacticInputs[parseInt(goalIdx)] &&
          tacticInputRefs.current[goalIdx] &&
          !tacticInputRefs.current[goalIdx]?.contains(e.target as Node)
        ) {
          setNewTacticInputs((prev) => ({ ...prev, [parseInt(goalIdx)]: null }));
        }
      });
      // Struggle input
      if (
        isAddingStruggleAction &&
        struggleInputRef.current &&
        !struggleInputRef.current.contains(e.target as Node)
      ) {
        setIsAddingStruggleAction(false);
        setStruggleActionInput("");
      }
      // Overcome input
      if (
        isAddingOvercomeAction &&
        overcomeInputRef.current &&
        !overcomeInputRef.current.contains(e.target as Node)
      ) {
        setIsAddingOvercomeAction(false);
        setOvercomeActionInput("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  });

  // =====================
  // Section 1: Add a Goal
  // =====================
  const handleAddGoal = () => {
    if (goalInput.trim() !== "") {
      setGoals((prevGoals) => [...prevGoals, goalInput.trim()]);
      setTacticTables((prevTables) => ({ ...prevTables, [goals.length]: [] }));
      setGoalInput("");
      setIsAddingGoal(false);
    }
  };

  // Handler to remove a goal and update dependent states.
  const handleRemoveGoal = (goalIndex: number) => {
    setGoals(prev => prev.filter((_, i) => i !== goalIndex));
    setTacticTables(prev => {
      const newTables = Object.keys(prev)
        .filter(key => Number(key) !== goalIndex)
        .map(key => prev[Number(key)]);
      const updated: { [index: number]: any } = {};
      newTables.forEach((table, i) => { updated[i] = table; });
      return updated;
    });
    setNewTacticInputs(prev => {
      const newInputs = Object.keys(prev)
        .filter(key => Number(key) !== goalIndex)
        .map(key => prev[Number(key)]);
      const updated: { [index: number]: any } = {};
      newInputs.forEach((input, i) => { updated[i] = input; });
      return updated;
    });
    setGoalColors(prev => {
      const updated: { [index: number]: string } = {};
      Object.entries(prev).forEach(([key, value]) => {
        const idx = Number(key);
        if (idx < goalIndex) updated[idx] = value;
        else if (idx > goalIndex) updated[idx - 1] = value;
      });
      return updated;
    });
  };

  // ==============================
  // Section 2: Add a Tactic Row
  // ==============================
  const handleAddTactic = (goalIndex: number) => {
    const input = newTacticInputs[goalIndex];
    if (input && input.tactic.trim() !== "" && input.due.trim() !== "") {
      setTacticTables((prevTables) => {
        const existingRows = prevTables[goalIndex] ? [...prevTables[goalIndex]] : [];
        return {
          ...prevTables,
          [goalIndex]: [...existingRows, { tactic: input.tactic.trim(), due: input.due.trim() }],
        };
      });
      setNewTacticInputs((prev) => ({ ...prev, [goalIndex]: null }));
    }
  };

  const startAddingTactic = (goalIndex: number) => {
    setNewTacticInputs((prev) => ({ ...prev, [goalIndex]: { tactic: "", due: "" } }));
  };

  // Handler to remove a tactic row from a specific goal.
  const handleRemoveTactic = (goalIndex: number, rowIndex: number) => {
    setTacticTables(prev => {
      const newRows = [...(prev[goalIndex] || [])];
      newRows.splice(rowIndex, 1);
      return { ...prev, [goalIndex]: newRows };
    });
  };

  // ================================
  // Section 3: Add Reflection / Struggle Rows
  // ================================
  const handleAddStruggleAction = () => {
    if (struggleActionInput.trim() !== "") {
      setStruggleActions((prev) => [...prev, struggleActionInput.trim()]);
      setStruggleActionInput("");
      setIsAddingStruggleAction(false);
    }
  };

  const handleAddOvercomeAction = () => {
    if (overcomeActionInput.trim() !== "") {
      setOvercomeActions((prev) => [...prev, overcomeActionInput.trim()]);
      setOvercomeActionInput("");
      setIsAddingOvercomeAction(false);
    }
  };

  const handleRemoveStruggleAction = (index: number) => {
    setStruggleActions(prev => prev.filter((_, i) => i !== index));
  };

  const handleRemoveOvercomeAction = (index: number) => {
    setOvercomeActions(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div
        id="export-planner12week"
        className="p-4 mx-auto bg-gray-300 text-gray-900"
        style={{minWidth: "1000px"}}
    >
       <TwelveWeekSelector /> 
      <div className="flex flex-col space-y-8">
        {/* Section 1: 12 Week Goals */}
        <div className="border p-4 rounded bg-gray-400 mb-6 relative">
          <h2 className="text-2xl font-semibold mb-4">12 Week Goals</h2>
          <ul className="space-y-2">
            {goals.map((goal, index) => (
              <div key={index} className="relative flex items-center">
                <li
                  onClick={() =>
                    setEditingColorGoal(editingColorGoal === index ? null : index)
                  }
                  style={{
                    borderColor: goalColors[index] || "#ccc",
                    borderWidth: "2px",
                    background: goalColors[index]
                      ? `${goalColors[index]}22`
                      : "#e5e7eb",
                    transition: "background 0.2s",
                  }}
                  className="p-2 border rounded text-gray-900 cursor-pointer flex-1"
                >
                  <span className="flex-1">{goal}</span>
                  <span
                    className="w-4 h-4 rounded-full border ml-2"
                    style={{
                      background: goalColors[index] || "#e5e7eb",
                      borderColor: goalColors[index] || "#ccc",
                    }}
                  ></span>
                </li>
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemoveGoal(index); }}
                  className="ml-2 text-red-600 font-bold"
                  aria-label="Remove goal"
                >
                  &times;
                </button>
                {editingColorGoal === index && (
                  <div
                    ref={colorMenuRef}
                    className="absolute z-20 mt-2 left-0 flex flex-row gap-2 bg-white border border-gray-300 rounded shadow-lg p-2"
                  >
                    {VINTAGE_COLORS.map((color) => (
                      <button
                        key={color}
                        className="w-7 h-7 rounded-full border-2 border-gray-300 hover:border-gray-500 focus:outline-none"
                        style={{ background: color }}
                        onClick={() => {
                          setGoalColors((prev) => ({ ...prev, [index]: color }));
                          setEditingColorGoal(null);
                        }}
                        tabIndex={0}
                        aria-label={`Choose color ${color}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
            {isAddingGoal ? (
              <li
                ref={addGoalRef}
                className="flex items-center bg-white border border-dashed border-gray-400 rounded p-2"
              >
                <input
                  type="text"
                  placeholder="Enter goal"
                  value={goalInput}
                  onChange={(e) => setGoalInput(e.target.value)}
                  className="p-2 border rounded flex-grow bg-gray-50 text-gray-900"
                  autoFocus
                />
                <button
                  onMouseDown={(e) => e.stopPropagation()} // prevent canvas dragging
                  onClick={handleAddGoal}
                  className="ml-2 p-2 bg-blue-500 rounded text-white"
                >
                  Add
                </button>
              </li>
            ) : (
              <li>
                <button
                  onMouseDown={(e) => e.stopPropagation()} // prevent canvas dragging
                  onClick={() => setIsAddingGoal(true)}
                  className="w-full p-2 border border-dashed border-gray-400 rounded flex items-center justify-center bg-white text-blue-700 font-bold hover:bg-blue-50 transition"
                >
                  <span className="text-2xl mr-2 flex items-center">+</span>
                  <span>Add Goal</span>
                </button>
              </li>
            )}
          </ul>
        </div>

        {/* Divider */}
        <div className="w-full border-t border-gray-300 my-2"></div>

        {/* Section 2: Tactics Table for Each Goal */}
        <div className="space-y-8">
          {goals.map((goal, goalIndex) => (
            <div
              key={goalIndex}
              style={{
                borderColor: goalColors[goalIndex] || "#ccc",
                borderWidth: "2px",
                background: goalColors[goalIndex]
                  ? `${goalColors[goalIndex]}11`
                  : "#fff",
                transition: "background 0.2s",
              }}
              className="border rounded p-4 bg-white"
            >
              <h3
                className="text-xl font-medium mb-2 flex items-center"
                style={{ color: "#2d3748" }}
              >
                <span
                  className="mr-2 font-semibold"
                  style={{ color: "#2d3748" }}
                >
                  Goal:
                </span>
                <span className="font-normal text-gray-900">{goal}</span>
              </h3>
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="w-3/4 text-left pb-2 border-b">Tactics</th>
                    <th className="w-1/4 text-left pb-2 border-b">Due</th>
                    <th className="pb-2 border-b">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(tacticTables[goalIndex] || []).map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      <td className="p-2 border">{row.tactic}</td>
                      <td className="p-2 border">{row.due}</td>
                      <td className="p-2 border">
                        <button
                          onClick={() => handleRemoveTactic(goalIndex, rowIndex)}
                          className="text-red-600"
                          aria-label="Remove tactic"
                        >
                          &times;
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={3} className="p-2">
                      {newTacticInputs[goalIndex] ? (
                        <div
                          ref={(el) => {
                            tacticInputRefs.current[goalIndex] = el;
                          }}
                          className="flex space-x-2 bg-white border border-dashed border-gray-400 rounded p-2"
                        >
                          <input
                            type="text"
                            placeholder="Enter tactic"
                            value={newTacticInputs[goalIndex]?.tactic || ""}
                            onChange={(e) =>
                              setNewTacticInputs((prev) => ({
                                ...prev,
                                [goalIndex]: {
                                  ...(prev[goalIndex] || { due: "" }),
                                  tactic: e.target.value,
                                },
                              }))
                            }
                            className="p-2 border rounded flex-grow bg-gray-50 text-gray-900"
                            autoFocus
                          />
                          <input
                            type="text"
                            placeholder="Due"
                            value={newTacticInputs[goalIndex]?.due || ""}
                            onChange={(e) =>
                              setNewTacticInputs((prev) => ({
                                ...prev,
                                [goalIndex]: {
                                  ...(prev[goalIndex] || { tactic: "" }),
                                  due: e.target.value,
                                },
                              }))
                            }
                            className="p-2 border rounded w-1/4 bg-gray-50 text-gray-900"
                          />
                          <button
                            onClick={() => handleAddTactic(goalIndex)}
                            className="p-2 bg-blue-500 rounded text-white"
                          >
                            Add
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startAddingTactic(goalIndex)}
                          className="w-full p-2 border border-dashed border-gray-400 rounded flex items-center justify-center bg-white text-blue-700 font-bold hover:bg-blue-50 transition"
                        >
                          <span className="text-2xl mr-2 flex items-center">+</span>
                          <span>Add Tactic</span>
                        </button>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="w-full border-t border-gray-300 my-2"></div>

        {/* Section 3: Reflection Questions */}
        <div className="border p-4 rounded bg-white">
          <h2 className="text-2xl text-center font-semibold mb-6 text-slate-900">
            Things to consider after setting your goals
          </h2>
          <div className="space-y-8">
            {/* Question 1: What actions will you struggle with? */}
            <div>
              <h3 className="text-lg font-medium mb-2">
                What actions will you struggle with?
              </h3>
              <ul className="space-y-2">
                {struggleActions.map((action, idx) => (
                  <li
                    key={idx}
                    className="p-2 border rounded bg-gray-200 text-gray-900 flex justify-between items-center"
                  >
                    <span>{action}</span>
                    <button
                      onClick={() => handleRemoveStruggleAction(idx)}
                      className="text-red-600"
                      aria-label="Remove struggle"
                    >
                      &times;
                    </button>
                  </li>
                ))}
                {isAddingStruggleAction ? (
                  <li
                    ref={struggleInputRef}
                    className="flex items-center bg-white border border-dashed border-gray-400 rounded p-2"
                  >
                    <input
                      type="text"
                      placeholder="Enter action"
                      value={struggleActionInput}
                      onChange={(e) => setStruggleActionInput(e.target.value)}
                      className="p-2 border rounded flex-grow bg-gray-50 text-gray-900"
                      autoFocus
                    />
                    <button
                      onClick={handleAddStruggleAction}
                      className="ml-2 p-2 bg-blue-500 rounded text-white"
                    >
                      Add
                    </button>
                  </li>
                ) : (
                  <li>
                    <button
                      onClick={() => setIsAddingStruggleAction(true)}
                      className="w-full p-2 border border-dashed border-gray-400 rounded flex items-center justify-center bg-white text-blue-700 font-bold hover:bg-blue-50 transition"
                    >
                      <span className="text-2xl mr-2 flex items-center">+</span>
                      <span>Add Struggle</span>
                    </button>
                  </li>
                )}
              </ul>
            </div>

            {/* Divider */}
            <div className="w-full border-t border-gray-200 my-2"></div>

            {/* Question 2: What will you do to overcome these struggles? */}
            <div>
              <h3 className="text-lg font-medium mb-2">
                What will you do to overcome these struggles?
              </h3>
              <ul className="space-y-2">
                {overcomeActions.map((action, idx) => (
                  <li
                    key={idx}
                    className="p-2 border rounded bg-gray-200 text-gray-900 flex justify-between items-center"
                  >
                    <span>{action}</span>
                    <button
                      onClick={() => handleRemoveOvercomeAction(idx)}
                      className="text-red-600"
                      aria-label="Remove solution"
                    >
                      &times;
                    </button>
                  </li>
                ))}
                {isAddingOvercomeAction ? (
                  <li
                    ref={overcomeInputRef}
                    className="flex items-center bg-white border border-dashed border-gray-400 rounded p-2"
                  >
                    <input
                      type="text"
                      placeholder="Enter action"
                      value={overcomeActionInput}
                      onChange={(e) => setOvercomeActionInput(e.target.value)}
                      className="p-2 border rounded flex-grow bg-gray-50 text-gray-900"
                      autoFocus
                    />
                    <button
                      onClick={handleAddOvercomeAction}
                      className="ml-2 p-2 bg-blue-500 rounded text-white"
                    >
                      Add
                    </button>
                  </li>
                ) : (
                  <li>
                    <button
                      onClick={() => setIsAddingOvercomeAction(true)}
                      className="w-full p-2 border border-dashed border-gray-400 rounded flex items-center justify-center bg-white text-blue-700 font-bold hover:bg-blue-50 transition"
                    >
                      <span className="text-2xl mr-2 flex items-center">+</span>
                      <span>Add Solution</span>
                    </button>
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Planner12WeekGoals;
