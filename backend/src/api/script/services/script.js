'use strict';

/**
 * script service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::script.script');
