
// Dotenv
require('dotenv').config()

import logger from '@/src/logger';

const STRAPI_URL = process.env.NEXT_PUBLIC_STRAPI_URL
const API_TOKEN = process.env.API_TOKEN

export async function fetchUser(provider: string, providerID: string, providerUserName: string) {
  const params = new URLSearchParams({
    'filters[providers][provider][$eq]': provider,
    'filters[providers][providerID][$eq]': providerID,
    'filters[providers][providerUserName][$eq]': providerUserName,
    'populate': '*'
  }).toString();

  logger.debug('fetchUser: %s', `${STRAPI_URL}/profiles?${params}`);

  try {
    const response = await fetch(`${STRAPI_URL}/profiles?${params}`, {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`
      }
    });

    const data = await response.json();
    // data.data => Array von Profilen, die die Bedingung erfüllen
    return data;
  } catch (error) {
    logger.error('fetchUser: %s', error);
  }
  
  return null;
}