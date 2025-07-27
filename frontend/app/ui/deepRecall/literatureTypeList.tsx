import React, { useState } from "react";
import { useLiteratureTypes, useLiterature, useVersionTypes } from "../../customHooks/useLiterature";
import { LiteratureType } from "../../types/deepRecall/strapi/literatureTypes";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteLiteratureType } from "../../api/literatureService";
import { 
  Plus, 
  Edit3, 
  BookOpen, 
  FileText, 
  Users, 
  Building, 
  Link, 
  Hash, 
  Calendar,
  Microscope,
  GraduationCap,
  Presentation,
  FileSearch,
  Bookmark,
  Settings
} from 'lucide-react';

export interface LiteratureTypeListProps {
  className?: string;
  onCreateLiteratureType?: () => void;
  onCreateLiterature?: (literatureType: LiteratureType) => void;
  onEditLiteratureType?: (literatureType: LiteratureType) => void;
}

const LiteratureTypeList: React.FC<LiteratureTypeListProps> = ({
  className = "",
  onCreateLiteratureType,
  onCreateLiterature,
  onEditLiteratureType,
}) => {
  const { data: literatureTypes, isLoading, error } = useLiteratureTypes();
  const { data: literatures } = useLiterature();
  const { data: versionTypes } = useVersionTypes();
  const queryClient = useQueryClient();

  const delMutation = useMutation<void, Error, string>({
    mutationFn: deleteLiteratureType,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["literatureTypes"] }),
  });

  // Helper function to get icon component based on icon name
  const getIconComponent = (iconName?: string) => {
    const iconMap: { [key: string]: React.ReactNode } = {
      'book-open': <BookOpen className="w-4 h-4" />,
      'file-text': <FileText className="w-4 h-4" />,
      'microscope': <Microscope className="w-4 h-4" />,
      'graduation-cap': <GraduationCap className="w-4 h-4" />,
      'presentation': <Presentation className="w-4 h-4" />,
      'file-search': <FileSearch className="w-4 h-4" />,
      'bookmark': <Bookmark className="w-4 h-4" />,
      'users': <Users className="w-4 h-4" />,
      'building': <Building className="w-4 h-4" />,
      'link': <Link className="w-4 h-4" />,
      'hash': <Hash className="w-4 h-4" />,
      'calendar': <Calendar className="w-4 h-4" />,
    };
    
    return iconMap[iconName || ''] || <BookOpen className="w-4 h-4" />;
  };

  // Helper function to get field icon
  const getFieldIcon = (fieldName: string, fieldType: string) => {
    const iconMap: { [key: string]: React.ReactNode } = {
      subtitle: <FileText className="w-3 h-3" />,
      publisher: <Building className="w-3 h-3" />,
      authors: <Users className="w-3 h-3" />,
      journal: <BookOpen className="w-3 h-3" />,
      doi: <Link className="w-3 h-3" />,
      versionsAreEqual: <Settings className="w-3 h-3" />,
      icon: <Bookmark className="w-3 h-3" />,
      // By field type
      string: <FileText className="w-3 h-3" />,
      number: <Hash className="w-3 h-3" />,
      boolean: <Settings className="w-3 h-3" />,
      array: <Users className="w-3 h-3" />,
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
    };
    return colors[type as keyof typeof colors] || "bg-slate-700/30 border-slate-600/30 text-slate-300";
  };

  // Helper function to format field names with proper capitalization and spacing
  const formatFieldName = (fieldName: string): string => {
    // Handle special cases
    const specialCases: { [key: string]: string } = {
      'doi': 'DOI',
      'versionsAreEqual': 'Versions Are Equal',
      'publishingDate': 'Publishing Date',
      'versionTitle': 'Version Title',
      'editionNumber': 'Edition Number',
      'versionNumber': 'Version Number',
    };

    if (specialCases[fieldName]) {
      return specialCases[fieldName];
    }

    // Convert camelCase to Title Case
    return fieldName
      .replace(/([a-z])([A-Z])/g, '$1 $2') // Add space before capital letters
      .replace(/^./, str => str.toUpperCase()); // Capitalize first letter
  };

  // Helper function to count literature entries per type
  const getLiteratureCount = (typeName: string) => {
    if (!literatures || !Array.isArray(literatures)) return 0;
    return literatures.filter(lit => lit.type === typeName).length;
  };

  // Helper function to get available version types for a literature type
  const getAvailableVersionTypes = (typeName: string) => {
    if (!versionTypes || !Array.isArray(versionTypes)) return [];
    
    return versionTypes.filter(vt => {
      // Parse version type metadata to check if it supports this literature type
      let metadataObj: any = {};
      if (vt.versionMetadata) {
        try {
          if (typeof vt.versionMetadata === 'string') {
            metadataObj = JSON.parse(vt.versionMetadata);
          } else {
            metadataObj = vt.versionMetadata;
          }
        } catch (error) {
          console.error('Failed to parse version metadata:', error);
        }
      }
      
      const literatureTypes = metadataObj.literatureTypes;
      // Handle both old and new metadata structures
      const actualLiteratureTypes = literatureTypes?.default_value !== undefined ? literatureTypes.default_value : literatureTypes;
      return Array.isArray(actualLiteratureTypes) && actualLiteratureTypes.includes(typeName);
    });
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
            <p className="text-red-400 font-medium">Failed to load literature types</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-1 h-6 bg-gradient-to-b from-emerald-500 to-blue-600 rounded-full"></div>
            <h3 className="text-xl font-bold text-slate-100">Literature Types</h3>
            <div className="flex-1 h-px bg-gradient-to-r from-slate-700 to-transparent"></div>
            <span className="text-sm text-slate-400 font-medium">{literatureTypes?.length || 0}</span>
          </div>
          
          {/* Add New Literature Type Button */}
          <button
            onClick={() => onCreateLiteratureType?.()}
            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm font-medium">New Type</span>
          </button>
        </div>
      </div>

      {/* Literature Type Cards */}
      <div className="flex-1 overflow-y-auto px-6 pb-4">
        <div className="space-y-4">
          {literatureTypes?.map((literatureType: LiteratureType) => {
            // Parse metadata to get supported fields
            let metadataObj: any = {};
            if (literatureType.typeMetadata) {
              try {
                if (typeof literatureType.typeMetadata === 'string') {
                  metadataObj = JSON.parse(literatureType.typeMetadata);
                } else {
                  metadataObj = literatureType.typeMetadata;
                }
              } catch (error) {
                console.error('Failed to parse literature type metadata:', error);
              }
            }

            const { icon, subtitle, publisher, authors, journal, doi, versionsAreEqual, ...customMetadata } = metadataObj;
            
            // Build field entries for display - Literature fields
            const literatureMetaEntries: [string, string][] = [];
            
            // Add enabled core fields (excluding icon as it shouldn't be shown as a tag)
            if (subtitle !== undefined) {
              const value = subtitle?.default_value !== undefined ? subtitle.default_value : subtitle;
              if (value !== undefined) literatureMetaEntries.push(["subtitle", "string"]);
            }
            if (publisher !== undefined) {
              const value = publisher?.default_value !== undefined ? publisher.default_value : publisher;
              if (value !== undefined) literatureMetaEntries.push(["publisher", "string"]);
            }
            if (authors !== undefined) {
              const value = authors?.default_value !== undefined ? authors.default_value : authors;
              if (value !== undefined) literatureMetaEntries.push(["authors", "array"]);
            }
            if (journal !== undefined) {
              const value = journal?.default_value !== undefined ? journal.default_value : journal;
              if (value !== undefined) literatureMetaEntries.push(["journal", "string"]);
            }
            if (doi !== undefined) {
              const value = doi?.default_value !== undefined ? doi.default_value : doi;
              if (value !== undefined) literatureMetaEntries.push(["doi", "string"]);
            }
            if (versionsAreEqual !== undefined) {
              const value = versionsAreEqual?.default_value !== undefined ? versionsAreEqual.default_value : versionsAreEqual;
              // Only show versionsAreEqual if it's true
              if (value === true) literatureMetaEntries.push(["versionsAreEqual", "boolean"]);
            }
            // Note: icon is excluded from display tags
            
            // Add custom fields
            Object.entries(customMetadata).forEach(([fieldName, fieldValue]) => {
              const value = (fieldValue as any)?.default_value !== undefined ? (fieldValue as any).default_value : fieldValue;
              const fieldType = Array.isArray(value) ? "array" : typeof value === "number" ? "number" : typeof value === "boolean" ? "boolean" : "string";
              literatureMetaEntries.push([fieldName, fieldType]);
            });

            const displayName = literatureType.name
              ? literatureType.name.charAt(0).toUpperCase() + literatureType.name.slice(1)
              : "";

            const literatureCount = getLiteratureCount(literatureType.name);
            const availableVersionTypes = getAvailableVersionTypes(literatureType.name);

            // Get version type fields
            const correspondingVersionType = availableVersionTypes[0]; // Get the first (should be only one)
            const versionMetaEntries: [string, string][] = [];
            
            if (correspondingVersionType) {
              let versionMetadataObj: any = {};
              if (correspondingVersionType.versionMetadata) {
                try {
                  if (typeof correspondingVersionType.versionMetadata === 'string') {
                    versionMetadataObj = JSON.parse(correspondingVersionType.versionMetadata);
                  } else {
                    versionMetadataObj = correspondingVersionType.versionMetadata;
                  }
                } catch (error) {
                  console.error('Failed to parse version type metadata:', error);
                }
              }

              const { publishingDate, versionTitle, editionNumber, versionNumber, literatureTypes, ...versionCustomMetadata } = versionMetadataObj;
              
              // Add enabled version core fields (excluding literatureTypes as it's internal)
              if (publishingDate !== undefined) {
                const value = (publishingDate as any)?.default_value !== undefined ? (publishingDate as any).default_value : publishingDate;
                if (value !== undefined) versionMetaEntries.push(["publishingDate", "string"]);
              }
              if (versionTitle !== undefined) {
                const value = (versionTitle as any)?.default_value !== undefined ? (versionTitle as any).default_value : versionTitle;
                if (value !== undefined) versionMetaEntries.push(["versionTitle", "string"]);
              }
              if (editionNumber !== undefined) {
                const value = (editionNumber as any)?.default_value !== undefined ? (editionNumber as any).default_value : editionNumber;
                if (value !== undefined) versionMetaEntries.push(["editionNumber", "number"]);
              }
              if (versionNumber !== undefined) {
                const value = (versionNumber as any)?.default_value !== undefined ? (versionNumber as any).default_value : versionNumber;
                if (value !== undefined) versionMetaEntries.push(["versionNumber", "number"]);
              }
              
              // Add version custom fields
              Object.entries(versionCustomMetadata).forEach(([fieldName, fieldValue]) => {
                const value = (fieldValue as any)?.default_value !== undefined ? (fieldValue as any).default_value : fieldValue;
                const fieldType = Array.isArray(value) ? "array" : typeof value === "number" ? "number" : typeof value === "boolean" ? "boolean" : "string";
                versionMetaEntries.push([fieldName, fieldType]);
              });
            }

            const totalFieldCount = literatureMetaEntries.length + versionMetaEntries.length;

            return (
              <div
                key={literatureType.documentId}
                className="group bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-5 hover:border-slate-600/50 transition-all duration-300 hover:shadow-lg hover:shadow-black/10"
              >
                {/* Header with title, counts, and action buttons */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                      {getIconComponent(icon)}
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-100 text-lg">{displayName}</h4>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-xs text-slate-400">
                          {literatureCount} {literatureCount === 1 ? 'entry' : 'entries'}
                        </span>
                        {totalFieldCount > 0 && (
                          <>
                            <span className="text-slate-600">•</span>
                            <span className="text-xs text-slate-500">
                              {totalFieldCount} {totalFieldCount === 1 ? 'field' : 'fields'}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Action buttons - only visible on hover */}
                  <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button
                      onClick={() => onCreateLiterature?.(literatureType)}
                      className="flex items-center justify-center w-8 h-8 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors shadow-sm"
                      title="Add Literature"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onEditLiteratureType?.(literatureType)}
                      className="flex items-center justify-center w-8 h-8 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg transition-colors shadow-sm"
                      title="Edit Literature Type"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Fields - Always visible with icons */}
                {totalFieldCount > 0 ? (
                  <div className="space-y-3">
                    {/* Literature Type Fields */}
                    {literatureMetaEntries.length > 0 && (
                      <div>
                        <h5 className="text-xs font-medium text-slate-400 mb-2 flex items-center space-x-2">
                          <div className="w-1 h-3 bg-emerald-500 rounded-full"></div>
                          <span>Literature Fields</span>
                        </h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {literatureMetaEntries.map(([fieldName, fieldType]) => {
                            const colorClass = getTypeColor(fieldType);
                            const icon = getFieldIcon(fieldName, fieldType);
                            
                            return (
                              <div
                                key={`lit-${fieldName}`}
                                className={`flex items-center space-x-2 px-2 py-1.5 border rounded-md transition-all duration-200 hover:scale-[1.02] ${colorClass}`}
                                title={`${formatFieldName(fieldName)} (${fieldType})`}
                              >
                                {icon}
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-medium truncate">
                                    {formatFieldName(fieldName)}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Version Type Fields */}
                    {versionMetaEntries.length > 0 && (
                      <div>
                        <h5 className="text-xs font-medium text-slate-400 mb-2 flex items-center space-x-2">
                          <div className="w-1 h-3 bg-blue-500 rounded-full"></div>
                          <span>Version Fields</span>
                        </h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {versionMetaEntries.map(([fieldName, fieldType]) => {
                            const colorClass = getTypeColor(fieldType);
                            const icon = getFieldIcon(fieldName, fieldType);
                            
                            return (
                              <div
                                key={`ver-${fieldName}`}
                                className={`flex items-center space-x-2 px-2 py-1.5 border rounded-md transition-all duration-200 hover:scale-[1.02] ${colorClass}`}
                                title={`${formatFieldName(fieldName)} (${fieldType})`}
                              >
                                {icon}
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-medium truncate">
                                    {formatFieldName(fieldName)}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
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
      </div>
    </div>
  );
};

export default LiteratureTypeList;
