'use strict';

/**
 * version-type router
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::version-type.version-type');
