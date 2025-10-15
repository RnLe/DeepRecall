import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';

/**
 * Capacitor utilities for DeepRecall mobile app
 */
export class CapacitorUtils {
  
  /**
   * Check if the app is running on a native platform
   */
  static isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  /**
   * Check if running on iOS specifically
   */
  static isIOS(): boolean {
    return Capacitor.getPlatform() === 'ios';
  }

  /**
   * Provide haptic feedback for pen interactions
   */
  static async hapticFeedback(style: 'light' | 'medium' | 'heavy' = 'light') {
    if (!this.isNative()) return;
    
    try {
      const impactStyle = style === 'light' ? ImpactStyle.Light : 
                         style === 'medium' ? ImpactStyle.Medium : 
                         ImpactStyle.Heavy;
      
      await Haptics.impact({ style: impactStyle });
    } catch (error) {
      console.warn('Haptic feedback failed:', error);
    }
  }

  /**
   * Save annotation data to local filesystem
   */
  static async saveAnnotationToFile(
    annotationId: string, 
    data: any
  ): Promise<boolean> {
    if (!this.isNative()) return false;

    try {
      await Filesystem.writeFile({
        path: `annotations/${annotationId}.json`,
        data: JSON.stringify(data),
        directory: Directory.Documents,
        encoding: Encoding.UTF8
      });
      return true;
    } catch (error) {
      console.error('Failed to save annotation:', error);
      return false;
    }
  }

  /**
   * Load annotation data from local filesystem
   */
  static async loadAnnotationFromFile(annotationId: string): Promise<any | null> {
    if (!this.isNative()) return null;

    try {
      const result = await Filesystem.readFile({
        path: `annotations/${annotationId}.json`,
        directory: Directory.Documents,
        encoding: Encoding.UTF8
      });
      return JSON.parse(result.data as string);
    } catch (error) {
      console.error('Failed to load annotation:', error);
      return null;
    }
  }

  /**
   * Save app preferences
   */
  static async setPreference(key: string, value: string): Promise<void> {
    if (!this.isNative()) {
      // Fallback to localStorage for web
      localStorage.setItem(key, value);
      return;
    }

    try {
      await Preferences.set({ key, value });
    } catch (error) {
      console.error('Failed to set preference:', error);
    }
  }

  /**
   * Get app preferences
   */
  static async getPreference(key: string): Promise<string | null> {
    if (!this.isNative()) {
      // Fallback to localStorage for web
      return localStorage.getItem(key);
    }

    try {
      const result = await Preferences.get({ key });
      return result.value;
    } catch (error) {
      console.error('Failed to get preference:', error);
      return null;
    }
  }

  /**
   * Save image data (e.g., annotation screenshots)
   */
  static async saveImageToFile(
    filename: string, 
    base64Data: string
  ): Promise<string | null> {
    if (!this.isNative()) return null;

    try {
      const result = await Filesystem.writeFile({
        path: `images/${filename}`,
        data: base64Data,
        directory: Directory.Documents
      });
      return result.uri;
    } catch (error) {
      console.error('Failed to save image:', error);
      return null;
    }
  }

  /**
   * Initialize app lifecycle listeners
   */
  static initializeAppListeners() {
    if (!this.isNative()) return;

    App.addListener('appStateChange', ({ isActive }) => {
      console.log('App state changed. Is active?', isActive);
      // Handle app becoming active/inactive
      // Could trigger sync or save pending annotations
    });

    App.addListener('backButton', () => {
      console.log('Hardware back button pressed');
      // Handle back button on Android (if you add Android support later)
    });
  }

  /**
   * Check if device supports pen input (for iPad Pro with Apple Pencil)
   */
  static supportsPenInput(): boolean {
    // For iOS, we can assume modern iPads support Apple Pencil
    // This could be enhanced with more specific detection
    return this.isIOS();
  }
}

export default CapacitorUtils;
