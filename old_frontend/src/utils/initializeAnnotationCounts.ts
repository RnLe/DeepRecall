// initializeAnnotationCounts.ts
// This is a utility script to initialize annotation counts for existing versions

import { fetchLiteratures } from "../api/literatureService";
import { initializeVersionAnnotationCount } from "../services/versionService";
import { fetchAnnotations } from "../api/annotationService";

/**
 * Initialize annotation counts for all existing versions in the system.
 * This should be run once when implementing the annotation counting feature.
 */
export const initializeAllAnnotationCounts = async (): Promise<void> => {
  console.log("Starting annotation count initialization...");
  
  try {
    // Fetch all literatures with their versions
    const literatures = await fetchLiteratures(false);
    console.log(`Found ${literatures.length} literature entries`);
    
    let totalVersions = 0;
    let totalUpdated = 0;
    
    for (const literature of literatures) {
      console.log(`Processing literature: ${literature.title}`);
      
      for (const version of literature.versions) {
        totalVersions++;
        
        try {
          // Count existing annotations for this version
          const annotations = await fetchAnnotations(literature.documentId || '', version.documentId || '');
          const annotationCount = annotations.length;
          
          console.log(`  Version ${version.documentId}: ${annotationCount} annotations`);
          
          // Initialize the count in version metadata
          await initializeVersionAnnotationCount(
            literature.documentId || '',
            version.documentId || '',
            annotationCount
          );
          
          totalUpdated++;
          
        } catch (error) {
          console.error(`Error processing version ${version.documentId}:`, error);
        }
      }
    }
    
    console.log(`Annotation count initialization complete!`);
    console.log(`Total versions processed: ${totalVersions}`);
    console.log(`Total versions updated: ${totalUpdated}`);
    
  } catch (error) {
    console.error("Failed to initialize annotation counts:", error);
    throw error;
  }
};

/**
 * Initialize annotation count for a specific version.
 * Useful for testing or fixing individual entries.
 */
export const initializeSingleVersionAnnotationCount = async (
  literatureId: string,
  versionId: string
): Promise<void> => {
  try {
    // Count existing annotations for this version
    const annotations = await fetchAnnotations(literatureId, versionId);
    const annotationCount = annotations.length;
    
    console.log(`Found ${annotationCount} annotations for version ${versionId}`);
    
    // Initialize the count in version metadata
    await initializeVersionAnnotationCount(literatureId, versionId, annotationCount);
    
    console.log(`Initialized annotation count for version ${versionId}: ${annotationCount}`);
    
  } catch (error) {
    console.error(`Failed to initialize annotation count for version ${versionId}:`, error);
    throw error;
  }
};

// Make functions available globally for easy testing in browser console
if (typeof window !== 'undefined') {
  (window as any).initializeAnnotationCounts = initializeAllAnnotationCounts;
  (window as any).initializeSingleVersionAnnotationCount = initializeSingleVersionAnnotationCount;
  console.log("✨ Annotation count utilities available in console:");
  console.log("  - initializeAnnotationCounts() - Initialize all versions");
  console.log("  - initializeSingleVersionAnnotationCount(litId, versionId) - Initialize single version");
}
