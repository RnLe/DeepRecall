import React, { useState } from "react";
import { useVersionTypes, useLiterature } from "../../customHooks/useLiterature";
import { transformVersion, VersionType } from "../../types/deepRecall/strapi/versionTypes";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteVersionType } from "../../api/literatureService";
import { Plus, Edit3, Calendar, Type, Hash, ToggleLeft, List, Clock, FileText, Users, BookOpen, Link, GitMerge } from 'lucide-react';

export interface VersionTypeListProps {
  className?: string;
  onCreateVersionType?: () => void;
  onCreateEntry?: (typeName: string) => void;
}

const VersionTypeList: React.FC<VersionTypeListProps> = ({
  className = "",
  onCreateVersionType,
  onCreateEntry,
}) => {
  const { data: types, isLoading, error } = useVersionTypes();
  const { data: literatures } = useLiterature();
  const queryClient = useQueryClient();
  const [editModalOpen, setEditModalOpen] = useState<string | null>(null);
  
  const delMutation = useMutation<void, Error, string>({
    mutationFn: deleteVersionType,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["versionTypes"] }),
  });

  // Helper function to get field icon
  const getFieldIcon = (fieldName: string, fieldType: string) => {
    // Icon mapping based on field name first, then type
    const iconMap: { [key: string]: React.ReactNode } = {
      // By field name
      publishingDate: <Calendar className="w-3 h-3" />,
      versionTitle: <FileText className="w-3 h-3" />,
      editionNumber: <Hash className="w-3 h-3" />,
      versionNumber: <Hash className="w-3 h-3" />,
      title: <Type className="w-3 h-3" />,
      subtitle: <Type className="w-3 h-3" />,
      authors: <Users className="w-3 h-3" />,
      journal: <BookOpen className="w-3 h-3" />,
      publisher: <BookOpen className="w-3 h-3" />,
      doi: <Link className="w-3 h-3" />,
      versionsAreEqual: <GitMerge className="w-3 h-3" />,
      date: <Calendar className="w-3 h-3" />,
      time: <Clock className="w-3 h-3" />,
      // By field type
      string: <Type className="w-3 h-3" />,
      number: <Hash className="w-3 h-3" />,
      boolean: <ToggleLeft className="w-3 h-3" />,
      array: <List className="w-3 h-3" />,
    };
    
    return iconMap[fieldName.toLowerCase()] || iconMap[fieldType] || <FileText className="w-3 h-3" />;
  };

  // Helper function to get type color
  const getTypeColor = (type: string) => {
    const colors = {
      string: "bg-blue-900/30 border-blue-600/50 text-blue-300",
      number: "bg-emerald-900/30 border-emerald-600/50 text-emerald-300", 
      boolean: "bg-purple-900/30 border-purple-600/50 text-purple-300",
      array: "bg-orange-900/30 border-orange-600/50 text-orange-300",
      object: "bg-pink-900/30 border-pink-600/50 text-pink-300",
      date: "bg-indigo-900/30 border-indigo-600/50 text-indigo-300",
    };
    return colors[type as keyof typeof colors] || "bg-slate-700/30 border-slate-600/30 text-slate-300";
  };

  // Helper function to count entries per version type
  const getEntryCount = (versionTypeName: string) => {
    if (!literatures || !Array.isArray(literatures)) return 0;
    
    return literatures.reduce((count, lit) => {
      if (!lit.versions || !Array.isArray(lit.versions)) return count;
      
      // Count how many versions of this type exist across all literature
      const versionsOfThisType = lit.versions.filter(version => 
        version && version.name === versionTypeName
      );
      
      return count + versionsOfThisType.length;
    }, 0);
  };

  if (isLoading) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-slate-700 rounded w-1/3"></div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-slate-700 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="bg-red-950/20 border border-red-900/20 rounded-xl p-4">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            <p className="text-red-400 font-medium">Failed to load version types</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-purple-600 rounded-full"></div>
          <h3 className="text-xl font-bold text-slate-100">Version Types</h3>
          <div className="flex-1 h-px bg-gradient-to-r from-slate-700 to-transparent"></div>
          <span className="text-sm text-slate-400 font-medium">{types?.length || 0}</span>
        </div>
        
        {/* Add New Version Type Button */}
        <button
          onClick={() => onCreateVersionType?.()}
          className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl"
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm font-medium">New Type</span>
        </button>
      </div>

      {/* Version Type Cards */}
      <div className="space-y-4">
        {types?.map((vt: VersionType) => {
          const ext = transformVersion(vt);
          const displayName = vt.name
            ? vt.name.charAt(0).toUpperCase() + vt.name.slice(1)
            : "";

          // Show field definitions from the version type's metadata structure
          const metaEntries: [string, string][] = [];
          
          // Always show core supported version fields as potential fields
          metaEntries.push(["publishingDate", "string"]);
          metaEntries.push(["versionTitle", "string"]);
          metaEntries.push(["editionNumber", "number"]);
          metaEntries.push(["versionNumber", "number"]);
          
          // Add custom fields defined in the version type's metadata
          const customMeta = ext.customMetadata || {};
          Object.entries(customMeta).forEach(([fieldName, fieldValue]) => {
            const fieldType = Array.isArray(fieldValue) ? "array" : typeof fieldValue;
            metaEntries.push([fieldName, fieldType]);
          });

          const entryCount = getEntryCount(vt.name);

          return (
            <div
              key={vt.documentId}
              className="group bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-5 hover:border-slate-600/50 transition-all duration-300 hover:shadow-lg hover:shadow-black/10"
            >
              {/* Header with title, entry count, and action buttons */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-full shadow-sm"></div>
                  <div>
                    <h4 className="font-semibold text-slate-100 text-lg">{displayName}</h4>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-xs text-slate-400">
                        {entryCount} {entryCount === 1 ? 'entry' : 'entries'}
                      </span>
                      {entryCount > 0 && (
                        <>
                          <span className="text-slate-600">•</span>
                          <span className="text-xs text-slate-500">
                            {metaEntries.length} {metaEntries.length === 1 ? 'field' : 'fields'}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Action buttons - only visible on hover */}
                <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <button
                    onClick={() => onCreateEntry?.(vt.name)}
                    className="flex items-center justify-center w-8 h-8 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors shadow-sm"
                    title="Add Entry"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setEditModalOpen(vt.documentId!)}
                    className="flex items-center justify-center w-8 h-8 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg transition-colors shadow-sm"
                    title="Edit Version Type"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Fields - Always visible with icons and hover tooltips */}
              {metaEntries.length > 0 ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {metaEntries.map(([fieldName, fieldType]) => {
                      const colorClass = getTypeColor(fieldType);
                      const icon = getFieldIcon(fieldName, fieldType);
                      
                      return (
                        <div
                          key={fieldName}
                          className={`flex items-center space-x-2 px-2 py-1.5 border rounded-md transition-all duration-200 hover:scale-[1.02] ${colorClass}`}
                          title={`${fieldName} (${fieldType})`}
                        >
                          {icon}
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium truncate">
                              {fieldName}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center py-8 text-slate-500">
                  <div className="text-center">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No fields defined</p>
                    <p className="text-xs mt-1 opacity-75">Edit this type to add fields</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Edit Modal Placeholder */}
      {editModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-100">Edit Version Type</h3>
              <button
                onClick={() => setEditModalOpen(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                <span className="sr-only">Close</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="text-slate-300 text-sm mb-6">
              Editing functionality will be implemented here.
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setEditModalOpen(null)}
                className="px-4 py-2 text-slate-400 hover:text-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => setEditModalOpen(null)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VersionTypeList;
