// mediaTypes.ts

export const MEDIA_TYPES = ["Textbook", "Paper", "Script"] as const;
export type MediaType = typeof MEDIA_TYPES[number];