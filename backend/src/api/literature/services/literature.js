'use strict';

/**
 * literature service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::literature.literature');
