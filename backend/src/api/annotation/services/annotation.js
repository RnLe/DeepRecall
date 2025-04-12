'use strict';

/**
 * annotation service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::annotation.annotation');
