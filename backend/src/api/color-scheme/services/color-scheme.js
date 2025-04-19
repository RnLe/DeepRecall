'use strict';

/**
 * color-scheme service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::color-scheme.color-scheme');
