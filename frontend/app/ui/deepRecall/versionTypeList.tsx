import React, { useState } from "react";
import { useVersionTypes } from "../../customHooks/useLiterature";
import { transformVersion, VersionType } from "../../types/deepRecall/strapi/versionTypes";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteVersionType } from "../../api/literatureService";

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
  const queryClient = useQueryClient();
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  
  const delMutation = useMutation<void, Error, string>({
    mutationFn: deleteVersionType,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["versionTypes"] }),
  });

  if (isLoading) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-slate-700 rounded w-1/3"></div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-slate-700 rounded-xl"></div>
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
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <span className="text-sm font-medium">New Type</span>
        </button>
      </div>

      <div className="space-y-3">
        {types?.map((vt: VersionType) => {
          const ext = transformVersion(vt);
          const displayName = vt.name
            ? vt.name.charAt(0).toUpperCase() + vt.name.slice(1)
            : "";

          // gather core + custom metadata entries
          const metaEntries: [string, any][] = [];
          if (ext.publishingDate !== undefined) metaEntries.push(["publishingDate", ext.publishingDate]);
          if (ext.versionTitle !== undefined) metaEntries.push(["versionTitle", ext.versionTitle]);
          if (ext.editionNumber !== undefined) metaEntries.push(["editionNumber", ext.editionNumber]);
          if (ext.versionNumber !== undefined) metaEntries.push(["versionNumber", ext.versionNumber]);
          Object.entries(ext.customMetadata).forEach(([k, v]) => metaEntries.push([k, v]));

          const isExpanded = expandedCard === vt.documentId;

          return (
            <div
              key={vt.documentId}
              className="group relative bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4 hover:border-slate-600/50 transition-all duration-300 hover:shadow-lg hover:shadow-black/10"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-full shadow-sm"></div>
                  <h4 className="font-semibold text-slate-100 text-lg">{displayName}</h4>
                </div>
                <div className="flex items-center space-x-2">
                  {/* Add Entry Button */}
                  <button
                    onClick={() => onCreateEntry?.(vt.name)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                  >
                    Add Entry
                  </button>
                  
                  {metaEntries.length > 0 && (
                    <button
                      onClick={() => setExpandedCard(isExpanded ? null : vt.documentId!)}
                      className="p-1.5 rounded-lg bg-slate-700/50 text-slate-400 hover:text-slate-200 hover:bg-slate-600/50 transition-colors"
                    >
                      <svg
                        className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  )}
                  <button
                    className="p-1.5 rounded-lg bg-red-900/20 text-red-400 hover:text-red-300 hover:bg-red-900/30 transition-colors opacity-0 group-hover:opacity-100"
                    onClick={() => {
                      if (
                        vt.documentId &&
                        confirm(
                          `Delete version type "${displayName}"? This cannot be undone.`
                        )
                      ) {
                        delMutation.mutate(vt.documentId);
                      }
                    }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Metadata Tags - Always visible with limited height */}
              {metaEntries.length > 0 && (
                <div className={`transition-all duration-300 overflow-hidden ${isExpanded ? 'max-h-96' : 'max-h-16'}`}>
                  <div className="flex flex-wrap gap-2">
                    {metaEntries.map(([k, v]) => {
                      const type = Array.isArray(v) ? "array" : typeof v;
                      const typeColors = {
                        string: "bg-blue-900/20 border-blue-700/30 text-blue-300",
                        number: "bg-emerald-900/20 border-emerald-700/30 text-emerald-300",
                        boolean: "bg-purple-900/20 border-purple-700/30 text-purple-300",
                        array: "bg-orange-900/20 border-orange-700/30 text-orange-300",
                        object: "bg-pink-900/20 border-pink-700/30 text-pink-300",
                      };
                      const colorClass = typeColors[type as keyof typeof typeColors] || "bg-slate-700/30 border-slate-600/30 text-slate-300";
                      
                      return (
                        <div
                          key={k}
                          className={`relative group/tag px-3 py-1.5 border rounded-lg text-sm font-medium cursor-pointer transition-all duration-200 hover:scale-105 ${colorClass}`}
                        >
                          {k}
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover/tag:opacity-100 transition-opacity duration-200 pointer-events-none">
                            <div className="bg-slate-900 text-slate-200 text-xs px-2 py-1 rounded-md shadow-lg border border-slate-700 whitespace-nowrap">
                              <span className="font-medium">{type}</span>
                              {typeof v === 'string' && v.length > 20 ? (
                                <div className="text-slate-400 mt-1 max-w-48 truncate">{v}</div>
                              ) : (
                                <div className="text-slate-400 mt-1">{String(v)}</div>
                              )}
                            </div>
                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-900"></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {!isExpanded && metaEntries.length > 6 && (
                    <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-slate-800/80 to-transparent flex items-end justify-center">
                      <span className="text-xs text-slate-400 font-medium">
                        +{metaEntries.length - 6} more
                      </span>
                    </div>
                  )}
                </div>
              )}

              {metaEntries.length === 0 && (
                <div className="flex items-center space-x-2 text-slate-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                  <span className="text-sm">No metadata defined</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default VersionTypeList;
