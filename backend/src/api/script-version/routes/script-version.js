'use strict';

/**
 * script-version router
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::script-version.script-version');
