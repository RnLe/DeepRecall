import { useEffect, useState } from 'react';
import CapacitorUtils from '@/app/utils/capacitorUtils';

/**
 * Hook to integrate Capacitor functionality with annotation features
 */
export const useCapacitorAnnotations = () => {
  const [isNative, setIsNative] = useState(false);
  const [supportsPen, setSupportsPen] = useState(false);

  useEffect(() => {
    // Initialize Capacitor detection
    const checkCapacitor = async () => {
      const native = CapacitorUtils.isNative();
      const pen = CapacitorUtils.supportsPenInput();
      
      setIsNative(native);
      setSupportsPen(pen);

      if (native) {
        // Initialize app lifecycle listeners
        CapacitorUtils.initializeAppListeners();
      }
    };

    checkCapacitor();
  }, []);

  /**
   * Enhanced annotation save with offline storage
   */
  const saveAnnotationWithOfflineSupport = async (
    annotationId: string,
    annotationData: any
  ) => {
    try {
      // Always try to save to your existing Strapi backend first
      // (your existing save logic here)
      
      // Additionally save locally for offline access
      if (isNative) {
        await CapacitorUtils.saveAnnotationToFile(annotationId, annotationData);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to save annotation:', error);
      
      // If backend save fails but we're on native, save locally only
      if (isNative) {
        return await CapacitorUtils.saveAnnotationToFile(annotationId, annotationData);
      }
      
      return false;
    }
  };

  /**
   * Enhanced annotation creation with haptic feedback
   */
  const createAnnotationWithFeedback = async (
    pageNumber: number,
    x: number,
    y: number,
    width: number,
    height: number
  ) => {
    // Provide haptic feedback when starting annotation
    if (supportsPen) {
      await CapacitorUtils.hapticFeedback('light');
    }

    // Your existing annotation creation logic here
    // Return the annotation data
  };

  /**
   * Save annotation as image with native file system
   */
  const saveAnnotationImage = async (
    annotationId: string,
    canvas: HTMLCanvasElement
  ): Promise<string | null> => {
    try {
      const base64Data = canvas.toDataURL('image/png').split(',')[1];
      
      if (isNative) {
        // Save to native file system
        const filename = `annotation_${annotationId}_${Date.now()}.png`;
        return await CapacitorUtils.saveImageToFile(filename, base64Data);
      } else {
        // Web fallback - trigger download
        const link = document.createElement('a');
        link.download = `annotation_${annotationId}.png`;
        link.href = canvas.toDataURL();
        link.click();
        return null;
      }
    } catch (error) {
      console.error('Failed to save annotation image:', error);
      return null;
    }
  };

  /**
   * Save user preferences with native storage
   */
  const savePreference = async (key: string, value: string) => {
    await CapacitorUtils.setPreference(key, value);
  };

  /**
   * Load user preferences with native storage
   */
  const loadPreference = async (key: string): Promise<string | null> => {
    return await CapacitorUtils.getPreference(key);
  };

  return {
    isNative,
    supportsPen,
    saveAnnotationWithOfflineSupport,
    createAnnotationWithFeedback,
    saveAnnotationImage,
    savePreference,
    loadPreference,
  };
};

export default useCapacitorAnnotations;
