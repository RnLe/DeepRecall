// editVersionModal.tsx

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { VersionExtended } from '../../types/deepRecall/strapi/versionTypes';
import { LiteratureExtended } from '../../types/deepRecall/strapi/literatureTypes';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateLiterature } from '../../api/literatureService';
import { uploadFile, deleteFile } from '../../api/uploadFile';
import { prefixStrapiUrl } from '../../helpers/getStrapiMedia';
import PdfThumbnailSelector from './pdfThumbnailSelector';

interface EditVersionModalProps {
  version: VersionExtended | null;
  literature: LiteratureExtended;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const EditVersionModal: React.FC<EditVersionModalProps> = ({
  version,
  literature,
  isOpen,
  onClose,
  onSuccess
}) => {
  const [versionFields, setVersionFields] = useState<Record<string, any>>({});
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [selectedThumbnailPage, setSelectedThumbnailPage] = useState(1);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const queryClient = useQueryClient();

  // Initialize form fields when version changes
  useEffect(() => {
    if (version && isOpen) {
      // Extract all fields from version's customMetadata
      const initialFields: Record<string, any> = {};
      
      // Add core version fields
      if (version.publishingDate) initialFields.publishingDate = version.publishingDate;
      if (version.versionTitle) initialFields.versionTitle = version.versionTitle;
      if (version.editionNumber !== undefined) initialFields.editionNumber = version.editionNumber;
      if (version.versionNumber !== undefined) initialFields.versionNumber = version.versionNumber;
      
      // Add custom metadata fields
      if (version.customMetadata) {
        Object.entries(version.customMetadata).forEach(([key, value]) => {
          // Skip file-related fields
          if (!['fileUrl', 'thumbnailUrl', 'fileId', 'thumbnailId', 'fileHash', 'name'].includes(key)) {
            initialFields[key] = value;
          }
        });
      }
      
      setVersionFields(initialFields);
      setThumbnailUrl(version.thumbnailUrl ? prefixStrapiUrl(version.thumbnailUrl) : null);
      setSelectedThumbnailPage(1);
      setHasChanges(false);
    }
  }, [version, isOpen]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setVersionFields({});
      setThumbnail(null);
      setThumbnailUrl(null);
      setErrorMsg(null);
      setIsSubmitting(false);
      setHasChanges(false);
    }
  }, [isOpen]);

  const updateLiteratureMutation = useMutation({
    mutationFn: ({ documentId, data }: { documentId: string; data: Partial<any> }) => 
      updateLiterature(documentId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["literature"] });
      onSuccess?.();
      onClose();
    },
    onError: (error: Error) => {
      console.error("Failed to update version:", error);
      setErrorMsg(error.message || "Failed to update version");
    },
  });

  // Handle field changes
  const handleFieldChange = (key: string, value: any) => {
    setVersionFields(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  // Thumbnail handling functions
  const handleThumbnailUpload = async (thumbnailFile: File | null) => {
    setThumbnail(thumbnailFile);
    setHasChanges(true);
  };

  const handleThumbnailUrlUpdate = (url: string | null) => {
    setThumbnailUrl(url);
    setHasChanges(true);
  };

  const handlePageChange = (page: number) => {
    setSelectedThumbnailPage(page);
    setHasChanges(true);
  };

  // Render field input
  const renderField = (key: string, value: any) => {
    const baseClassName = "w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200";
    
    if (key === "publishingDate") {
      // Handle date field with dropdowns
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1;
      const currentDay = currentDate.getDate();
      
      const existingDate = versionFields[key] || "";
      let selectedYear = currentYear;
      let selectedMonth = currentMonth;
      let selectedDay = currentDay;
      
      if (existingDate) {
        const dateParts = existingDate.split('-');
        if (dateParts.length === 3) {
          selectedYear = parseInt(dateParts[0]) || currentYear;
          selectedMonth = parseInt(dateParts[1]) || currentMonth;
          selectedDay = parseInt(dateParts[2]) || currentDay;
        }
      }
      
      const years = Array.from({length: 50}, (_, i) => currentYear - i);
      const months = [
        { value: 1, label: "January" }, { value: 2, label: "February" }, { value: 3, label: "March" },
        { value: 4, label: "April" }, { value: 5, label: "May" }, { value: 6, label: "June" },
        { value: 7, label: "July" }, { value: 8, label: "August" }, { value: 9, label: "September" },
        { value: 10, label: "October" }, { value: 11, label: "November" }, { value: 12, label: "December" }
      ];
      
      const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
      const days = Array.from({length: daysInMonth}, (_, i) => i + 1);
      
      const updateDate = (newYear: number, newMonth: number, newDay: number) => {
        const maxDays = new Date(newYear, newMonth, 0).getDate();
        const validDay = Math.min(newDay, maxDays);
        const dateString = `${newYear}-${String(newMonth).padStart(2, '0')}-${String(validDay).padStart(2, '0')}`;
        handleFieldChange(key, dateString);
      };
      
      return (
        <div className="grid grid-cols-3 gap-2">
          <select
            value={selectedDay}
            onChange={e => updateDate(selectedYear, selectedMonth, parseInt(e.target.value))}
            className={baseClassName}
          >
            {days.map(day => (
              <option key={day} value={day}>{day}</option>
            ))}
          </select>
          <select
            value={selectedMonth}
            onChange={e => updateDate(selectedYear, parseInt(e.target.value), selectedDay)}
            className={baseClassName}
          >
            {months.map(month => (
              <option key={month.value} value={month.value}>{month.label}</option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={e => updateDate(parseInt(e.target.value), selectedMonth, selectedDay)}
            className={baseClassName}
          >
            {years.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
      );
    }
    
    if (typeof value === "number" || (!isNaN(Number(value)) && value !== "")) {
      const isVersionOrEdition = key.toLowerCase().includes('version') || key.toLowerCase().includes('edition');
      const minValue = isVersionOrEdition ? 1 : 0;
      const currentValue = versionFields[key] || minValue;
      
      return (
        <input 
          type="number" 
          min={minValue}
          value={Math.max(currentValue, minValue)}
          onChange={e => handleFieldChange(key, Math.max(Number(e.target.value), minValue))}
          className={baseClassName}
          placeholder={`Enter number (min: ${minValue})...`}
        />
      );
    }
    
    if (Array.isArray(value) && value.length > 0) {
      return (
        <select 
          value={versionFields[key] || ""}
          onChange={e => handleFieldChange(key, e.target.value)}
          className={baseClassName}
        >
          <option value="">Select an option...</option>
          {value.map((opt: any, i) => (
            <option key={i} value={opt}>{opt}</option>
          ))}
        </select>
      );
    }
    
    return (
      <input 
        type="text" 
        value={versionFields[key] || ""}
        onChange={e => handleFieldChange(key, e.target.value)}
        className={baseClassName}
        placeholder="Enter text..."
      />
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!version || !literature.documentId) return;
    
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      let newThumbnailId = version.thumbnailId;
      let newThumbnailUrl = version.thumbnailUrl;

      // Handle thumbnail update if changed
      if (thumbnail) {
        // Delete old thumbnail if it exists
        if (version.thumbnailId) {
          try {
            await deleteFile(version.thumbnailId);
            console.log('Successfully deleted old thumbnail');
          } catch (error) {
            console.warn('Failed to delete old thumbnail:', error);
          }
        }

        // Upload new thumbnail
        const uploadedThumb = await uploadFile(thumbnail);
        newThumbnailId = uploadedThumb.id;
        newThumbnailUrl = uploadedThumb.url;
      }

      // Update the version in the literature metadata
      const currentMetadata = typeof literature.metadata === "string" 
        ? JSON.parse(literature.metadata) 
        : literature.metadata || {};
      
      const versions = Array.isArray(currentMetadata.versions) ? currentMetadata.versions : [];
      
      const updatedVersions = versions.map((v: any) => {
        const versionData = typeof v.versionMetadata === "string" 
          ? JSON.parse(v.versionMetadata)
          : v.versionMetadata;
          
        if (versionData.fileUrl === version.fileUrl) {
          // This is the version we're updating
          return {
            versionMetadata: JSON.stringify({
              ...versionData,
              ...versionFields,
              thumbnailUrl: newThumbnailUrl,
              thumbnailId: newThumbnailId,
            })
          };
        }
        return v;
      });

      currentMetadata.versions = updatedVersions;

      await updateLiteratureMutation.mutateAsync({
        documentId: literature.documentId,
        data: { metadata: JSON.stringify(currentMetadata) }
      });

    } catch (error: any) {
      console.error('Error updating version:', error);
      setErrorMsg(error.message || "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !version) return null;

  // Get the recommended and custom fields (similar to versionForm)
  const recommended = ["publishingDate", "versionTitle", "editionNumber", "versionNumber"];
  const recKeys = recommended.filter(k => k in versionFields);
  const customKeys = Object.keys(versionFields).filter(k => !recommended.includes(k));

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700/50 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700/50">
          <div className="flex items-center space-x-3">
            <div className="w-1 h-6 bg-gradient-to-b from-orange-500 to-red-600 rounded-full"></div>
            <h2 className="text-xl font-semibold text-slate-100">Edit Version</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded-lg transition-all duration-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Current PDF Info */}
            <div className="bg-slate-700/30 border border-slate-600/30 rounded-lg p-4">
              <div className="flex items-center space-x-3 mb-2">
                <div className="w-2 h-4 bg-gradient-to-b from-emerald-500 to-blue-600 rounded-full"></div>
                <h4 className="text-md font-semibold text-slate-200">Current PDF</h4>
              </div>
              <p className="text-slate-300 text-sm">
                PDF file cannot be changed in edit mode. Only metadata and thumbnail can be updated.
              </p>
            </div>

            {/* Thumbnail Section */}
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-1 h-4 bg-gradient-to-b from-purple-500 to-pink-600 rounded-full"></div>
                <label className="text-sm font-medium text-slate-300">Thumbnail</label>
              </div>
              
              <PdfThumbnailSelector
                file={null} // No File object in edit mode
                mediaFile={version.pdfFile} // Pass the MediaFile for PDF loading
                onThumbnailChange={handleThumbnailUpload}
                onThumbnailUrlChange={handleThumbnailUrlUpdate}
                selectedPage={selectedThumbnailPage}
                onPageChange={handlePageChange}
                initialThumbnailUrl={version.thumbnailUrl ? prefixStrapiUrl(version.thumbnailUrl) : null}
                className="border border-slate-600/50 rounded-lg"
              />
            </div>

            {/* Core Fields Section */}
            {recKeys.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="w-1 h-4 bg-gradient-to-b from-blue-500 to-purple-600 rounded-full"></div>
                  <h4 className="text-md font-semibold text-slate-200">Core Fields</h4>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-4 border-l border-slate-700/50">
                  {recKeys.map(key => (
                    <div key={key} className="space-y-2">
                      <label className="block text-sm font-medium text-slate-300 capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </label>
                      {renderField(key, versionFields[key])}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Additional Fields Section */}
            {customKeys.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="w-1 h-4 bg-gradient-to-b from-purple-500 to-pink-600 rounded-full"></div>
                  <h4 className="text-md font-semibold text-slate-200">Additional Fields</h4>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-4 border-l border-slate-700/50">
                  {customKeys.map(key => (
                    <div key={key} className="space-y-2">
                      <label className="block text-sm font-medium text-slate-300 capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </label>
                      {renderField(key, versionFields[key])}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Error Message */}
            {errorMsg && (
              <div className="bg-red-950/20 border border-red-900/20 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <p className="text-red-400 text-sm">{errorMsg}</p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-700/50">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-slate-400 hover:text-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !hasChanges}
                className={`px-6 py-2 rounded-lg font-medium transition-all duration-200 ${
                  isSubmitting || !hasChanges
                    ? "bg-slate-700/50 text-slate-500 cursor-not-allowed"
                    : "bg-gradient-to-r from-orange-600 to-red-600 text-white hover:from-orange-700 hover:to-red-700 shadow-sm hover:shadow-md"
                }`}
              >
                {isSubmitting ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                    <span>Updating...</span>
                  </div>
                ) : (
                  "Update Version"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EditVersionModal;
