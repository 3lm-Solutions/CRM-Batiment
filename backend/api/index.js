// Vercel Function: forwards every request to the compiled Nest app (see src/serverless.ts)
module.exports = require('../dist/serverless.js').default;
