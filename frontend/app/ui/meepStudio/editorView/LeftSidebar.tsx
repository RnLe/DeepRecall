"use client";

import React, { useState } from "react";
import { FolderGit2, Wrench } from "lucide-react";
import { MeepProject } from "@/app/types/meepStudio/meepProjectTypes";

type Panel = "explorer" | "toolbar" | null;

interface Props {
  projects: MeepProject[];
  openProject: (p: MeepProject) => void;
  createProject: (p: { title: string; description?: string }) => Promise<MeepProject>;
}

export default function LeftSidebar({ projects, openProject, createProject }: Props) {
  const [panel, setPanel] = useState<Panel>("explorer");
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);

  const toggle = (p: Panel) => setPanel((cur) => (cur === p ? null : p));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;

    try {
      const project = await createProject({ title, description: newDescription.trim() });
      setNewTitle("");
      setNewDescription("");
      setShowCreateForm(false);
      openProject(project);
    } catch (error) {
      console.error("Failed to create project", error);
    }
  };

  const icons = [
    { key: "explorer", Icon: FolderGit2, title: "Explorer" },
    { key: "toolbar", Icon: Wrench, title: "Toolbar" },
  ] as const;

  return (
    <div className="flex h-full">
      {/* Icon column */}
      <div className="flex flex-col w-14 bg-gray-800 border-r border-gray-700 space-y-2">
        {icons.map(({ key, Icon, title }) => {
          const isActive = panel === key;
          return (
            <button
              key={key}
              onClick={() => toggle(key)}
              title={title}
              className={`group relative flex items-center justify-center w-full h-12 box-border ${
                isActive ? "border-l-4 border-blue-400" : "border-l-4 border-transparent"
              }`}
            >
              <Icon
                size={25}
                className={`transition-colors ${
                  isActive ? "text-white" : "text-gray-400 group-hover:text-white"
                }`}
              />
            </button>
          );
        })}
      </div>

      {/* Sliding panel */}
      <div
        className={`flex-none bg-gray-900 border-r border-gray-700 overflow-hidden transition-all duration-200 ${
          panel ? "w-64" : "w-0"
        }`}
      >
        <div className="h-full flex flex-col">
          {panel === "explorer" && (
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

              {/* Create new project */}
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
          )}

          {panel === "toolbar" && (
            <div className="p-4 text-sm text-gray-400">
              <p className="mb-2 font-semibold text-white">Toolbar (stub)</p>
              <p>Add geometry primitives, sources, …</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
