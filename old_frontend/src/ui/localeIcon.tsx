import React from 'react';
// Import logger
import logger from '@/src/logger';

export default function LocaleIcon ({ locale, ...props }) {

    try {
        require(`@/public/icons/locales/${locale}_icon.svg`);
    }
    catch {
        logger.warn('Locale icon not found: %s', locale);
        return null;
    }
    
    const iconPath = `/icons/locales/${locale}_icon.svg`;

    return <img src={iconPath} alt={`${locale} icon`} {...props} />;
}