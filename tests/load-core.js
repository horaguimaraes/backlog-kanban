// Extracts the pure-logic <script id="core"> block from index.html so it can be
// unit-tested without a browser, a bundler, or any dependency.
// (new Function keeps the code in this realm, so deepStrictEqual works on its output.)
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const match = html.match(/<script id="core">([\s\S]*?)<\/script>/);
if (!match) throw new Error('core script block not found in index.html');

const mod = { exports: {} };
new Function('module', match[1])(mod);
module.exports = mod.exports;
