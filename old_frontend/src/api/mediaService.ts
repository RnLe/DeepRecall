// mediaService.ts

import { MediaFile } from '../types/strapiTypes';

const API_TOKEN = process.env.NEXT_PUBLIC_API_TOKEN;
const BASE_URL = "http://localhost:1337/api/upload/files";

/**
 * Fetches a MediaFile by its ID from Strapi.
 * 
 * @param fileId The ID of the file to fetch
 * @returns The MediaFile object with full metadata
 */
export const fetchMediaFile = async (fileId: number): Promise<MediaFile | null> => {
  if (!fileId) return null;
  
  try {
    const response = await fetch(`${BASE_URL}/${fileId}`, {
      headers: { Authorization: `Bearer ${API_TOKEN}` },
    });

    if (!response.ok) {
      console.warn(`Failed to fetch media file ${fileId}:`, response.status);
      return null;
    }

    const mediaFile: MediaFile = await response.json();
    return mediaFile;
  } catch (error) {
    console.error(`Error fetching media file ${fileId}:`, error);
    return null;
  }
};

/**
 * Fetches multiple MediaFiles by their IDs.
 * 
 * @param fileIds Array of file IDs to fetch
 * @returns Array of MediaFile objects (null for failed fetches)
 */
export const fetchMediaFiles = async (fileIds: number[]): Promise<(MediaFile | null)[]> => {
  const fetchPromises = fileIds.map(id => fetchMediaFile(id));
  return Promise.all(fetchPromises);
};

/**
 * Fetches MediaFile data for a version and returns enhanced version data.
 * This function can be used to enrich version data with full file information.
 * 
 * @param fileId PDF file ID
 * @param thumbnailId Thumbnail file ID  
 * @returns Object with pdfFile and thumbnailFile MediaFile objects
 */
export const fetchVersionFiles = async (fileId?: number, thumbnailId?: number): Promise<{
  pdfFile: MediaFile | null;
  thumbnailFile: MediaFile | null;
}> => {
  const [pdfFile, thumbnailFile] = await Promise.all([
    fileId ? fetchMediaFile(fileId) : Promise.resolve(null),
    thumbnailId ? fetchMediaFile(thumbnailId) : Promise.resolve(null)
  ]);

  return { pdfFile, thumbnailFile };
};
