// strapiTypes.ts

// Strapi backend base response
export interface StrapiResponse {
  documentId?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Strapi MediaFile. Stores any type of media (not changeable)
export interface MediaFile {
    id: number;
    name: string;
    alternativeText?: string | null;
    caption?: string | null;
    width?: number | null;
    height?: number | null;
    formats?: any;
    hash: string;
    ext: string;
    mime: string;
    size: number;
    url: string;
    previewUrl?: string | null;
    provider: string;
    provider_metadata?: any;
    createdAt: string;
    updatedAt: string;
    publishedAt: string;
    documentId: string;
}