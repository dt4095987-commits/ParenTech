'use strict';

const { createAppHandler } = require('../backend/server.cjs');

let handlerPromise = null;

module.exports = async function vercelHandler(req, res) {
  if (!handlerPromise) {
    handlerPromise = createAppHandler().catch(error => {
      handlerPromise = null;
      throw error;
    });
  }
  const handle = await handlerPromise;
  return handle(req, res);
};
