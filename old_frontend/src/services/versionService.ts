// versionService.ts

import { Literature, LiteratureExtended } from "../types/deepRecall/strapi/literatureTypes";
import { updateLiterature } from "../../src/api/literatureService";

/**
 * Update the annotation count for a specific version in literature metadata.
 * This performs a surgical update without fetching all annotations.
 */
export const updateVersionAnnotationCount = async (
  literatureId: string,
  versionId: string,
  increment: number
): Promise<void> => {
  try {
    // First fetch the current literature to get metadata
    const response = await fetch(`http://localhost:1337/api/literatures/${literatureId}?populate=*`, {
      headers: { 
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_API_TOKEN}` 
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch literature: ${response.status}`);
    }
    
    const { data: literature } = await response.json() as { data: Literature };
    
    // Parse current metadata
    let metadata: any = {};
    if (typeof literature.metadata === "string") {
      try {
        metadata = JSON.parse(literature.metadata);
      } catch (error) {
        console.error("Failed to parse literature metadata:", error);
        metadata = {};
      }
    } else if (typeof literature.metadata === "object" && literature.metadata !== null) {
      metadata = literature.metadata;
    }
    
    // Find and update the specific version
    const versions = Array.isArray(metadata.versions) ? metadata.versions : [];
    let versionFound = false;
    
    const updatedVersions = versions.map((version: any) => {
      // Parse version metadata if it's a string
      let versionMeta: any = {};
      if (typeof version.versionMetadata === "string") {
        try {
          versionMeta = JSON.parse(version.versionMetadata);
        } catch (error) {
          console.error("Failed to parse version metadata:", error);
          versionMeta = {};
        }
      } else if (typeof version.versionMetadata === "object" && version.versionMetadata !== null) {
        versionMeta = version.versionMetadata;
      }
      
      // Check if this is the version we want to update
      if (version.documentId === versionId) {
        versionFound = true;
        
        // Initialize annotationCount if it doesn't exist
        if (typeof versionMeta.annotationCount !== "number") {
          versionMeta.annotationCount = 0;
        }
        
        // Update the count
        versionMeta.annotationCount = Math.max(0, versionMeta.annotationCount + increment);
        
        console.log(`DEBUG: Updated annotation count for version ${versionId}: ${versionMeta.annotationCount - increment} -> ${versionMeta.annotationCount}`);
        
        // Return updated version with stringified metadata
        return {
          ...version,
          versionMetadata: JSON.stringify(versionMeta)
        };
      }
      
      return version;
    });
    
    if (!versionFound) {
      console.warn(`Version ${versionId} not found in literature ${literatureId}`);
      return;
    }
    
    // Update the literature with the modified versions
    const updatedMetadata = {
      ...metadata,
      versions: updatedVersions
    };
    
    await updateLiterature(literatureId, {
      metadata: JSON.stringify(updatedMetadata)
    });
    
    console.log(`Updated annotation count for version ${versionId} by ${increment}`);
    
  } catch (error) {
    console.error("Failed to update version annotation count:", error);
    throw error;
  }
};

/**
 * Initialize annotation count for a version if it doesn't exist.
 * This is useful when adding annotation counting to existing versions.
 */
export const initializeVersionAnnotationCount = async (
  literatureId: string,
  versionId: string,
  initialCount: number = 0
): Promise<void> => {
  try {
    // Fetch current literature
    const response = await fetch(`http://localhost:1337/api/literatures/${literatureId}?populate=*`, {
      headers: { 
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_API_TOKEN}` 
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch literature: ${response.status}`);
    }
    
    const { data: literature } = await response.json() as { data: Literature };
    
    // Parse metadata
    let metadata: any = {};
    if (typeof literature.metadata === "string") {
      try {
        metadata = JSON.parse(literature.metadata);
      } catch (error) {
        metadata = {};
      }
    } else if (typeof literature.metadata === "object" && literature.metadata !== null) {
      metadata = literature.metadata;
    }
    
    // Find and initialize the version if needed
    const versions = Array.isArray(metadata.versions) ? metadata.versions : [];
    let needsUpdate = false;
    
    const updatedVersions = versions.map((version: any) => {
      if (version.documentId === versionId) {
        let versionMeta: any = {};
        if (typeof version.versionMetadata === "string") {
          try {
            versionMeta = JSON.parse(version.versionMetadata);
          } catch (error) {
            versionMeta = {};
          }
        } else if (typeof version.versionMetadata === "object" && version.versionMetadata !== null) {
          versionMeta = version.versionMetadata;
        }
        
        // Only initialize if annotationCount doesn't exist
        if (typeof versionMeta.annotationCount !== "number") {
          versionMeta.annotationCount = initialCount;
          needsUpdate = true;
          
          return {
            ...version,
            versionMetadata: JSON.stringify(versionMeta)
          };
        }
      }
      
      return version;
    });
    
    if (needsUpdate) {
      const updatedMetadata = {
        ...metadata,
        versions: updatedVersions
      };
      
      await updateLiterature(literatureId, {
        metadata: JSON.stringify(updatedMetadata)
      });
      
      console.log(`Initialized annotation count for version ${versionId} to ${initialCount}`);
    }
    
  } catch (error) {
    console.error("Failed to initialize version annotation count:", error);
    throw error;
  }
};

/**
 * Get the current annotation count for a version without fetching all annotations.
 * Returns the count from version metadata.
 */
export const getVersionAnnotationCount = async (
  literatureId: string,
  versionId: string
): Promise<number> => {
  try {
    // Fetch literature
    const response = await fetch(`http://localhost:1337/api/literatures/${literatureId}?populate=*`, {
      headers: { 
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_API_TOKEN}` 
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch literature: ${response.status}`);
    }
    
    const { data: literature } = await response.json() as { data: Literature };
    
    // Parse metadata
    let metadata: any = {};
    if (typeof literature.metadata === "string") {
      try {
        metadata = JSON.parse(literature.metadata);
      } catch (error) {
        return 0;
      }
    } else if (typeof literature.metadata === "object" && literature.metadata !== null) {
      metadata = literature.metadata;
    }
    
    // Find the version and return its annotation count
    const versions = Array.isArray(metadata.versions) ? metadata.versions : [];
    
    for (const version of versions) {
      if (version.documentId === versionId) {
        let versionMeta: any = {};
        if (typeof version.versionMetadata === "string") {
          try {
            versionMeta = JSON.parse(version.versionMetadata);
          } catch (error) {
            return 0;
          }
        } else if (typeof version.versionMetadata === "object" && version.versionMetadata !== null) {
          versionMeta = version.versionMetadata;
        }
        
        return typeof versionMeta.annotationCount === "number" ? versionMeta.annotationCount : 0;
      }
    }
    
    return 0;
    
  } catch (error) {
    console.error("Failed to get version annotation count:", error);
    return 0;
  }
};
