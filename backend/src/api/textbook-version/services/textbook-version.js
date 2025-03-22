'use strict';

/**
 * textbook-version service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::textbook-version.textbook-version');
