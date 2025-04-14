'use strict';

/**
 * version-type service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::version-type.version-type');
