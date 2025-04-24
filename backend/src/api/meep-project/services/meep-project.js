'use strict';

/**
 * meep-project service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::meep-project.meep-project');
