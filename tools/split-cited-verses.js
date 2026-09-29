#!/usr/bin/env node
// Splits a monolithic cited-verses file (window.CITED_VERSES = {...}) into
// one chunk per month section of index.html: verses/<month>.js.
// index.html loads a month's chunk only when a Cited Scripture popup opens.
//
// Usage (from the repo root):
//   node tools/split-cited-verses.js [path/to/cited-verses.js]
// The original monolithic file is in git history, e.g.:
//   git show 7cc5766:cited-verses.js > /tmp/cited-verses.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const source = process.argv[2] || path.join(root, 'cited-verses.js');
const outDir = path.join(root, 'verses');

const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(source, 'utf8'), sandbox);
const verses = sandbox.window.CITED_VERSES;
if (!verses || typeof verses !== 'object') throw new Error('No window.CITED_VERSES in ' + source);

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sections = [...html.matchAll(/<section id="([a-z]+)">([\s\S]*?)<\/section>/g)];
if (sections.length !== 12) throw new Error('Expected 12 month sections, found ' + sections.length);

fs.mkdirSync(outDir, { recursive: true });
const used = new Set();
let missing = 0;
for (const [, month, body] of sections) {
    const chunk = {};
    for (const m of body.matchAll(/#v(\d+)-v(\d+)/g)) {
        const id = m[1] + '-' + m[2];
        if (verses[id]) { chunk[id] = verses[id]; used.add(id); }
        else { missing++; console.warn('No verses for ' + id + ' (' + month + ')'); }
    }
    const js = '(window.CBR_VERSES = window.CBR_VERSES || {})[' + JSON.stringify(month) + '] = ' + JSON.stringify(chunk) + ';\n';
    fs.writeFileSync(path.join(outDir, month + '.js'), js);
    console.log(month.padEnd(10) + String(Object.keys(chunk).length).padStart(4) + ' readings  ' + (Buffer.byteLength(js) / 1024).toFixed(0) + ' KB');
}
const unused = Object.keys(verses).filter(id => !used.has(id)).length;
console.log('Done. Missing: ' + missing + ', unused entries: ' + unused);
