'use strict';

/**
 * textbook service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::textbook.textbook');
