'use strict';

/**
 * script-version service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::script-version.script-version');
