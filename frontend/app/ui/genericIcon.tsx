import React from 'react';
// Import logger
import logger from '@/src/logger';

export default function GenericIcon({ iconName, ...props }) {

    try {
        require(`@/public/icons/${iconName}.svg`);
    }
    catch {
        logger.warn('Icon not found: %s', iconName);
        return null;
    }
    
    const iconPath = `/icons/${iconName}.svg`;

    return <img src={iconPath} alt={`${iconName} icon`} {...props} />;
}