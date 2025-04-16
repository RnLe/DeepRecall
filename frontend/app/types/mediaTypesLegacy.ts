// mediaTypes.ts

export const MEDIA_TYPES = ["Textbook", "Paper", "Script"] as const;
export type MediaType = typeof MEDIA_TYPES[number];

export type Version = TextbookVersion | ScriptVersion | PaperVersion;

// General notes on the structure of the media types:
// - Each media type (Textbook, Paper, Script) has a corresponding version type (TextbookVersion, PaperVersion, ScriptVersion)
// - The payload types (TextbookVersionPayload, PaperVersionPayload, ScriptVersionPayload) are used for creating new versions.
// The upload requires the ID of the corresponding relation (e.g., textbook, paper, script).
// - The MediaFile type is used for the file uploads (pdf, thumbnail, etc.). It doesn't contain the actual file data, but metadata like the URL, size, etc.
// Since it doesn't store the page count for pdf files, a field page_count is added to the version types. This prevents the need to fetch the file for this information.

// Textbooks, Papers, Scripts, etc.
export interface TextbookVersion {
    id: number;
    createdAt?: string;
    updatedAt?: string;
    file_hash?: string;
    textbook: Textbook;
    edition_number: number;
    year: number;
    pdf_file?: MediaFile;
    tasks_pdf?: string;
    thumbnail: MediaFile;
    page_count: number;
    file_size: number;
}

export interface TextbookVersionPayload {
    id: number;
    file_hash?: string;
    textbook: number;
    edition_number: number;
    year: number;
    pdf_file?: number;
    tasks_pdf?: string;
    thumbnail: number;
    page_count: number;
    file_size: number;
}

export interface Textbook {
    id: number;
    createdAt?: string;
    updatedAt?: string;
    title: string;
    subtitle?: string;
    description?: string;
    isbn?: string;
    doi?: string;
    authors?: Author[];
    textbook_versions?: TextbookVersion[];
}

export interface ScriptVersion {
    id: number;
    createdAt?: string;
    updatedAt?: string;
    file_hash?: string;
    script: Script;
    year: number;
    version?: string;
    pdf_file: MediaFile;
    thumbnail: MediaFile;
    page_count: number;
    file_size: number;
}

export interface ScriptVersionPayload {
    id: number;
    file_hash?: string;
    script: number;
    year: number;
    version?: string;
    pdf_file: number;
    thumbnail: number;
    page_count: number;
    file_size: number;
}
  
export interface Script {
    id: number;
    createdAt?: string;
    updatedAt?: string;
    title: string;
    subtitle?: string;
    authors?: Author[];
    script_versions?: ScriptVersion[];
}

export interface PaperVersion {
    id: number;
    createdAt?: string;
    updatedAt?: string;
    file_hash?: string;
    paper: Paper;
    pdf_file: MediaFile;
    version_number?: string;
    year: number;
    volume?: string;
    pages?: string;
    thumbnail: MediaFile;
    page_count: number;
    file_size: number;
}

export interface PaperVersionPayload {
    id: number;
    file_hash?: string;
    paper: number;      // References the created paper
    pdf_file: number;   // References the uploaded file
    version_number?: string;
    year: number;
    volume?: string;
    pages?: string;
    thumbnail: number;
    page_count: number;
    file_size: number;
}

export interface Paper {
    id: number;
    createdAt?: string;
    updatedAt?: string;
    title: string;
    subtitle?: string;
    journal?: string;
    doi?: string;
    authors?: Author[] ;
    paper_versions?: PaperVersion[];
}

export interface Author {
    id?: number;
    createdAt?: string;
    updatedAt?: string;
    first_name: string;
    last_name: string;
    orcid?: string;
}

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