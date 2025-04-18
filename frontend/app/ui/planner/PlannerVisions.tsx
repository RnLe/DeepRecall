"use client";

import React, { useState, useRef, useEffect } from "react";

const PlannerVisions: React.FC = () => {
  // State for Aspirational Vision
  const [aspirationalVisions, setAspirationalVisions] = useState<string[]>([]);
  const [isAddingAspirational, setIsAddingAspirational] = useState<boolean>(false);
  const [aspirationalInput, setAspirationalInput] = useState<string>("");

  // State for Three-Year Vision
  const [threeYearVisions, setThreeYearVisions] = useState<string[]>([]);
  const [isAddingThreeYear, setIsAddingThreeYear] = useState<boolean>(false);
  const [threeYearInput, setThreeYearInput] = useState<string>("");

  // Refs for closing editing areas on outside click
  const aspirationalInputRef = useRef<HTMLLIElement>(null);
  const threeYearInputRef = useRef<HTMLLIElement>(null);

  // Close editing areas on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        isAddingAspirational &&
        aspirationalInputRef.current &&
        !aspirationalInputRef.current.contains(e.target as Node)
      ) {
        setIsAddingAspirational(false);
        setAspirationalInput("");
      }
      if (
        isAddingThreeYear &&
        threeYearInputRef.current &&
        !threeYearInputRef.current.contains(e.target as Node)
      ) {
        setIsAddingThreeYear(false);
        setThreeYearInput("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isAddingAspirational, isAddingThreeYear]);

  const handleAddAspirational = () => {
    if (aspirationalInput.trim() !== "") {
      setAspirationalVisions((prev) => [...prev, aspirationalInput.trim()]);
      setAspirationalInput("");
      setIsAddingAspirational(false);
    }
  };

  const handleRemoveAspirational = (index: number) => {
    setAspirationalVisions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddThreeYear = () => {
    if (threeYearInput.trim() !== "") {
      setThreeYearVisions((prev) => [...prev, threeYearInput.trim()]);
      setThreeYearInput("");
      setIsAddingThreeYear(false);
    }
  };

  const handleRemoveThreeYear = (index: number) => {
    setThreeYearVisions((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div
      id="export-plannerVisions"
      className="p-4 mx-auto bg-gray-300 text-gray-900"
      style={{ minWidth: "800px" }}
    >
      <div className="flex flex-col space-y-8">
        {/* Aspirational Vision Section */}
        <div className="border p-4 rounded bg-gray-400 mb-6 relative">
          <h2 className="text-2xl font-semibold mb-4">Aspirational Vision</h2>
          <ul className="space-y-2">
            {aspirationalVisions.map((vision, index) => (
              <li
                key={index}
                className="p-2 border rounded bg-gray-200 text-gray-900 flex justify-between items-center"
              >
                <span>{vision}</span>
                <button
                  onClick={() => handleRemoveAspirational(index)}
                  className="text-red-600"
                  aria-label="Remove aspirational vision"
                >
                  &times;
                </button>
              </li>
            ))}
            {isAddingAspirational ? (
              <li
                ref={aspirationalInputRef}
                className="flex items-center bg-white border border-dashed border-gray-400 rounded p-2"
              >
                <input
                  type="text"
                  placeholder="Enter vision"
                  value={aspirationalInput}
                  onChange={(e) => setAspirationalInput(e.target.value)}
                  className="p-2 border rounded flex-grow bg-gray-50 text-gray-900"
                  autoFocus
                />
                <button
                  onClick={handleAddAspirational}
                  className="ml-2 p-2 bg-blue-500 rounded text-white"
                >
                  Add
                </button>
              </li>
            ) : (
              <li>
                <button
                  onClick={() => setIsAddingAspirational(true)}
                  className="w-full p-2 border border-dashed border-gray-400 rounded flex items-center justify-center bg-white text-blue-700 font-bold hover:bg-blue-50 transition"
                >
                  <span className="text-2xl mr-2 flex items-center">+</span>
                  <span>Add Vision</span>
                </button>
              </li>
            )}
          </ul>
        </div>

        {/* Three-Year Vision Section */}
        <div className="border p-4 rounded bg-gray-400 mb-6 relative">
          <h2 className="text-2xl font-semibold mb-4">Three-Year Vision</h2>
          <ul className="space-y-2">
            {threeYearVisions.map((vision, index) => (
              <li
                key={index}
                className="p-2 border rounded bg-gray-200 text-gray-900 flex justify-between items-center"
              >
                <span>{vision}</span>
                <button
                  onClick={() => handleRemoveThreeYear(index)}
                  className="text-red-600"
                  aria-label="Remove three-year vision"
                >
                  &times;
                </button>
              </li>
            ))}
            {isAddingThreeYear ? (
              <li
                ref={threeYearInputRef}
                className="flex items-center bg-white border border-dashed border-gray-400 rounded p-2"
              >
                <input
                  type="text"
                  placeholder="Enter vision"
                  value={threeYearInput}
                  onChange={(e) => setThreeYearInput(e.target.value)}
                  className="p-2 border rounded flex-grow bg-gray-50 text-gray-900"
                  autoFocus
                />
                <button
                  onClick={handleAddThreeYear}
                  className="ml-2 p-2 bg-blue-500 rounded text-white"
                >
                  Add
                </button>
              </li>
            ) : (
              <li>
                <button
                  onClick={() => setIsAddingThreeYear(true)}
                  className="w-full p-2 border border-dashed border-gray-400 rounded flex items-center justify-center bg-white text-blue-700 font-bold hover:bg-blue-50 transition"
                >
                  <span className="text-2xl mr-2 flex items-center">+</span>
                  <span>Add Vision</span>
                </button>
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default PlannerVisions;