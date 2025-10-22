/**
 * NoteTreeView - Horizontal kanban-style note group container
 * Manages note groups with independent scrolling and view controls
 */

"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { Annotation } from "@deeprecall/core";
import type { Asset } from "@deeprecall/core";
import { NoteBranch } from "./NoteBranch";
import { CreateGroupDialog } from "./CreateGroupDialog";
import * as annotationRepo from "@deeprecall/data/repos/annotations";

interface NoteTreeViewProps {
  annotation: Annotation;
  notes: Asset[];
  onNotesChange: () => void;
}

export function NoteTreeView({
  annotation,
  notes,
  onNotesChange,
}: NoteTreeViewProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [draggedGroupId, setDraggedGroupId] = useState<string | null>(null);
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);

  // Get groups from annotation metadata
  const groups = annotation.metadata?.noteGroups || [];
  const sortedGroups = [...groups].sort((a, b) => a.order - b.order);

  // Group notes by noteGroup field
  const notesByGroup = new Map<string, Asset[]>();

  // Initialize with empty arrays for all groups
  sortedGroups.forEach((group) => {
    notesByGroup.set(group.id, []);
  });

  // Add "Unsorted" group for notes without a group
  notesByGroup.set("unsorted", []);

  // Distribute notes into groups
  notes.forEach((note) => {
    const groupId = note.noteGroup || "unsorted";
    const groupNotes = notesByGroup.get(groupId) || [];
    groupNotes.push(note);
    notesByGroup.set(groupId, groupNotes);
  });

  const handleGroupCreate = async (
    name: string,
    description?: string,
    color?: string
  ) => {
    try {
      await annotationRepo.createNoteGroup(annotation.id, name, color);
      setShowCreateDialog(false);
      // Trigger reload
      window.location.reload();
    } catch (error) {
      console.error("Failed to create group:", error);
    }
  };

  const handleGroupUpdate = async (groupId: string, updates: any) => {
    try {
      await annotationRepo.updateNoteGroup(annotation.id, groupId, updates);
      // Only reload for structural changes (not view/column preferences)
      if (
        updates.name !== undefined ||
        updates.color !== undefined ||
        updates.description !== undefined
      ) {
        onNotesChange();
        window.location.reload();
      }
      // For view mode and column changes, just trigger a lightweight refresh
      else {
        onNotesChange();
      }
    } catch (error) {
      console.error("Failed to update group:", error);
      throw error; // Re-throw to allow caller to handle
    }
  };

  const handleGroupDelete = async (groupId: string) => {
    try {
      await annotationRepo.deleteNoteGroup(annotation.id, groupId);
      onNotesChange();
      // Trigger reload
      window.location.reload();
    } catch (error) {
      console.error("Failed to delete group:", error);
    }
  };

  const handleGroupReorder = async (draggedId: string, targetId: string) => {
    if (draggedId === targetId || targetId === "unsorted") return;

    try {
      const draggedIndex = sortedGroups.findIndex((g) => g.id === draggedId);
      const targetIndex = sortedGroups.findIndex((g) => g.id === targetId);

      if (draggedIndex === -1 || targetIndex === -1) return;

      // Reorder groups
      const reordered = [...sortedGroups];
      const [removed] = reordered.splice(draggedIndex, 1);
      reordered.splice(targetIndex, 0, removed);

      // Update order values
      for (let i = 0; i < reordered.length; i++) {
        await annotationRepo.updateNoteGroup(annotation.id, reordered[i].id, {
          order: i,
        });
      }

      // Reload
      window.location.reload();
    } catch (error) {
      console.error("Failed to reorder groups:", error);
    }
  };

  const handleNoteDrop = async (noteId: string, targetGroupId: string) => {
    try {
      const note = notes.find((n) => n.id === noteId);
      if (!note) return;

      // Don't update if already in target group
      if (
        note.noteGroup === targetGroupId ||
        (targetGroupId === "unsorted" && !note.noteGroup)
      ) {
        return;
      }

      // Update note's group
      const newGroupId =
        targetGroupId === "unsorted" ? undefined : targetGroupId;
      await annotationRepo.moveNoteToGroup(noteId, newGroupId);

      onNotesChange();
    } catch (error) {
      console.error("Failed to move note:", error);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-700">
        <h2 className="text-lg font-semibold text-gray-200">Note Groups</h2>
        <button
          onClick={() => setShowCreateDialog(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded text-sm text-white transition-colors"
        >
          <Plus size={16} />
          New Group
        </button>
      </div>

      {/* Horizontal Scrollable Container */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-4 h-full pb-4">
          {/* Unsorted Group (always first) */}
          <NoteBranch
            groupId="unsorted"
            groupName="Unsorted"
            notes={notesByGroup.get("unsorted") || []}
            annotation={annotation}
            onNotesChange={onNotesChange}
            onGroupUpdate={handleGroupUpdate}
            onGroupDelete={handleGroupDelete}
            onNoteDrop={handleNoteDrop}
            isUnsorted
            isDragOver={dragOverGroupId === "unsorted"}
          />

          {/* User-created Groups */}
          {sortedGroups.map((group) => (
            <NoteBranch
              key={group.id}
              groupId={group.id}
              groupName={group.name}
              groupDescription={group.description}
              groupColor={group.color}
              viewMode={group.viewMode || "compact"}
              columns={group.columns || 1}
              width={(group as any).width}
              notes={notesByGroup.get(group.id) || []}
              annotation={annotation}
              onNotesChange={onNotesChange}
              onGroupUpdate={handleGroupUpdate}
              onGroupDelete={handleGroupDelete}
              onNoteDrop={handleNoteDrop}
              isDragging={draggedGroupId === group.id}
              isDragOver={dragOverGroupId === group.id}
              onDragStart={() => setDraggedGroupId(group.id)}
              onDragEnd={() => {
                setDraggedGroupId(null);
                setDragOverGroupId(null);
              }}
              onDragEnter={() => setDragOverGroupId(group.id)}
              onDrop={() => {
                if (draggedGroupId && draggedGroupId !== group.id) {
                  handleGroupReorder(draggedGroupId, group.id);
                }
              }}
            />
          ))}

          {/* Empty State */}
          {sortedGroups.length === 0 && (
            <div className="flex-shrink-0 w-80 flex items-center justify-center text-gray-500 border-2 border-dashed border-gray-700 rounded-lg">
              <div className="text-center p-6">
                <p className="text-sm mb-2">No note groups yet</p>
                <button
                  onClick={() => setShowCreateDialog(true)}
                  className="text-purple-400 hover:text-purple-300 text-sm underline"
                >
                  Create your first group
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Group Dialog */}
      {showCreateDialog && (
        <CreateGroupDialog
          onClose={() => setShowCreateDialog(false)}
          onCreate={handleGroupCreate}
        />
      )}
    </div>
  );
}
