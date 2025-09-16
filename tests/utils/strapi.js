'use strict';

const { createStrapi, compileStrapi } = require('@strapi/strapi');

let instance;

async function setupStrapi() {
  if (!instance) {
    const appContext = await compileStrapi();
    instance = await createStrapi(appContext).load();
  }
  return instance;
}

async function stopStrapi() {
  if (instance) {
    await instance.destroy();
    instance = undefined;
  }
}

module.exports = { setupStrapi, stopStrapi };


