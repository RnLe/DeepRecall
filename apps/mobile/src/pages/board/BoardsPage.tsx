/**
 * Boards List Page - Mobile (Capacitor)
 * Overview of all boards
 */

"use client";

import { useBoards, useCreateBoard, useDeleteBoard } from "@deeprecall/data";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

export default function BoardsPage() {
  const navigate = useNavigate();
  const { data: boards = [], isLoading } = useBoards();
  const createBoard = useCreateBoard();
  const deleteBoard = useDeleteBoard();

  const [newBoardTitle, setNewBoardTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateBoard = async () => {
    if (!newBoardTitle.trim()) return;

    setIsCreating(true);
    try {
      const board = await createBoard.mutateAsync({
        title: newBoardTitle.trim(),
        description: "",
        width: 10000,
        height: 10000,
        backgroundColor: "#ffffff",
      });

      setNewBoardTitle("");
      navigate(`/board/${board.id}`);
    } catch (error) {
      console.error("Failed to create board:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteBoard = async (id: string) => {
    if (!confirm("Delete this board? This action cannot be undone.")) return;

    try {
      await deleteBoard.mutateAsync(id);
    } catch (error) {
      console.error("Failed to delete board:", error);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-950">
      <div className="max-w-6xl mx-auto p-6 pb-safe">
        <h1 className="text-3xl font-bold mb-6 text-white">Boards</h1>

        {/* Create New Board */}
        <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 p-4 mb-6">
          <h2 className="text-lg font-semibold mb-3 text-white">
            Create New Board
          </h2>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={newBoardTitle}
              onChange={(e) => setNewBoardTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateBoard();
              }}
              placeholder="Board title..."
              className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isCreating}
            />
            <button
              onClick={handleCreateBoard}
              disabled={!newBoardTitle.trim() || isCreating}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors active:bg-blue-800"
            >
              {isCreating ? "Creating..." : "Create"}
            </button>
          </div>
        </div>

        {/* Boards List */}
        {isLoading ? (
          <div className="text-center py-12 text-gray-400">
            Loading boards...
          </div>
        ) : boards.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            No boards yet. Create one to get started!
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {boards.map((board) => (
              <div
                key={board.id}
                className="bg-gray-800 border border-gray-700 rounded-lg shadow-lg hover:shadow-xl hover:border-gray-600 transition-all active:scale-98"
              >
                <div
                  onClick={() => navigate(`/board/${board.id}`)}
                  className="p-4 cursor-pointer"
                >
                  <h3 className="text-lg font-semibold mb-2 text-white">
                    {board.title}
                  </h3>
                  {board.description && (
                    <p className="text-gray-400 text-sm mb-3">
                      {board.description}
                    </p>
                  )}
                  <div className="text-xs text-gray-500">
                    Updated: {new Date(board.updatedAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="border-t border-gray-700 px-4 py-2 flex justify-end">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteBoard(board.id);
                    }}
                    className="text-sm text-red-400 hover:text-red-300 active:text-red-200 transition-colors px-2 py-1"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
