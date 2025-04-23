'use strict';

/**
 * deck service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::deck.deck');
