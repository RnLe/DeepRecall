// getStrapiMedia.ts

import { MediaFile } from "../types/strapiTypes";

export function getStrapiMedia(media: MediaFile | undefined | null): string {
  if (!media) return "";
  // Already absolute?
  if (media.url.startsWith("http")) return media.url;
  // Otherwise prefix with Strapi host
  return `${process.env.NEXT_PUBLIC_STRAPI_API_URL}${media.url}`;
}
export function prefixStrapiUrl(relativeUrl: string): string {
  if (relativeUrl.startsWith("http")) return relativeUrl;
  return `${process.env.NEXT_PUBLIC_STRAPI_API_URL}${relativeUrl}`;
}
