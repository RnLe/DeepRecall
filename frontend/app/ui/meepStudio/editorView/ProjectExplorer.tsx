// src/components/meep/Explorer/ProjectExplorer.tsx
import React, { useState } from "react";
import { MeepProject } from "@/app/types/meepStudio/meepProjectTypes";

interface Props {
  projects: MeepProject[];
  openProject: (p: MeepProject) => void;
  createProject: (p: { title: string; description?: string }) => Promise<MeepProject>;
}
export default function ProjectExplorer({ projects, openProject, createProject }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const onCreate = async () => {
    if (!title.trim()) return;
    setIsCreating(true);
    try {
      const newProj = await createProject({ title: title.trim(), description: description.trim() || undefined });
      openProject(newProj);
      setModalOpen(false);
      setTitle("");
      setDescription("");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="px-2 py-2 flex flex-col h-full">
      {/* scroll both list _and_ button together */}
      <div className="overflow-y-auto space-y-1">
        {projects.length > 0 ? (
          projects.map((p) => (
            <div
              key={p.documentId}
              onClick={() => openProject(p)}
              className="px-3 py-1 truncate text-sm hover:text-white cursor-pointer"
            >
              {p.title}
            </div>
          ))
        ) : (
          <div className="px-3 py-1 text-gray-500">
            No projects available
          </div>
        )}
 
        <button
          onClick={() => setModalOpen(true)}
          className="w-full px-3 py-2 mt-2 text-sm border-2 border-dashed border-gray-500 rounded hover:border-gray-400"
        >
          + Create New Project
        </button>
      </div>
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-gray-800 p-6 rounded-lg w-80">
            <h2 className="text-lg mb-4 text-white">New Project</h2>
            <label className="block text-sm text-gray-400">Title</label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full mt-1 mb-3 px-2 py-1 bg-gray-700 border border-gray-600 rounded focus:outline-none"
            />
            <label className="block text-sm text-gray-400">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full mt-1 px-2 py-1 bg-gray-700 border border-gray-600 rounded focus:outline-none"
            />
            <div className="mt-4 flex justify-end space-x-2">
              <button
                onClick={() => setModalOpen(false)}
                className="px-3 py-1 text-sm bg-gray-600 rounded hover:bg-gray-500"
                disabled={isCreating}
              >
                Cancel
              </button>
              <button
                onClick={onCreate}
                className="px-3 py-1 text-sm bg-blue-600 rounded hover:bg-blue-500 disabled:opacity-50"
                disabled={isCreating}
              >
                {isCreating ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
