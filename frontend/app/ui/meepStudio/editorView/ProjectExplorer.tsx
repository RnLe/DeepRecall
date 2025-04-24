// src/components/meep/Explorer/ProjectExplorer.tsx
import React, { useState } from "react";
import { MeepProject } from "@/app/types/meepStudio/strapi/meepProjectTypes";

interface Props {
  projects: MeepProject[];
  openProject: (p: MeepProject) => void;
  createProject: (p: MeepProject) => Promise<MeepProject>;
}

export default function ProjectExplorer({ projects, openProject, createProject }: Props) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newDimension, setNewDimension] = useState<number>(2);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    const dimension = newDimension;
    try {
      const project = await createProject({
        title,
        dimension,
        description: newDescription.trim()
      });
      setNewTitle("");
      setNewDescription("");
      setShowCreateForm(false);
      openProject(project);
    } catch (error) {
      console.error("Failed to create project", error);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto px-2 py-2">
      <div className="space-y-1">
        {projects.map((project) => (
          <div
            key={project.documentId}
            className="px-3 py-1 text-sm text-gray-300 hover:text-white transition-colors cursor-pointer truncate"
            onClick={() => openProject(project)}
          >
            {project.title}
          </div>
        ))}
      </div>
      <div className="px-2 py-2 border-t border-gray-700">
        {!showCreateForm ? (
          <button
            onClick={() => setShowCreateForm(true)}
            className="w-full px-2 py-2 border-2 border-gray-600 border-dashed text-sm text-gray-300 hover:text-white rounded"
          >
            Create New Project
          </button>
        ) : (
          <form onSubmit={handleCreate} className="space-y-2">
            <input
              type="text"
              required
              placeholder="New project title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full mb-2 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-sm placeholder-gray-500 text-white"
            />
            <textarea
              placeholder="Description (optional)"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              className="w-full mb-2 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-sm placeholder-gray-500 text-white"
            />
            <div className="flex space-x-2 mb-2">
              {[1, 2, 3].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setNewDimension(d)}
                  className={`flex-1 px-2 py-1 rounded ${
                    newDimension === d
                      ? "bg-blue-500 text-white"
                      : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                  }`}
                >
                  {d}D
                </button>
              ))}
            </div>
            <div className="flex space-x-2">
              <button
                type="submit"
                className="flex-1 px-2 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setNewTitle("");
                  setNewDescription("");
                }}
                className="flex-1 px-2 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
