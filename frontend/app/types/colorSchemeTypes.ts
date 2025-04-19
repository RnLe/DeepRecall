// src/types/colorSchemeTypes.ts
import { StrapiResponse } from "./strapiTypes";

/**
 * Definition of all color‑related settings in a scheme.
 * You can extend with other areas (e.g. buttonColors, chartColors).
 */
export interface ColorSchemeDefinition {
    /** Mapping from annotationType to its base color (hex). */
    annotationColors: Record<string, string>;
    // e.g. chartColors?: Record<string,string>;
}
  
/**
 * Represents one ColorScheme entity from Strapi.
 */
export interface ColorScheme extends StrapiResponse {
    /** Human‑readable name for this scheme. */
    name: string;
    /** The JSON payload holding all color mappings. */
    scheme: ColorSchemeDefinition;
}

