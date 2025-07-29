#!/usr/bin/env node
// Small style check until we agree on eslint + prettier.
// No dependencies, runs everywhere node runs: `npm run lint`.
//
// Report only for now: it always exits 0, the old files have too many hits.
// `npm run lint -- --strict` exits 1 when something is found (for new files / later in CI).
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const DIRS = ['api', 'web/src', 'scripts'];
const SKIP = ['node_modules', 'dist', 'data', 'covers', 'samples'];
const EXTENSIONS = ['.js', '.jsx', '.ts', '.css', '.sql', '.html'];
const MAX_LINES = 800;

const strict = process.argv.indexOf('--strict') !== -1;
const quiet = process.argv.indexOf('--quiet') !== -1;

function walk(dir, out) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (entry) {
    if (SKIP.indexOf(entry.name) !== -1 || entry.name.startsWith('.')) return;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full, out);
    if (EXTENSIONS.indexOf(path.extname(entry.name)) !== -1) out.push(full);
  });
  return out;
}

const RULES = [
  {
    name: 'trailing-space',
    line: (text) => /[ \t]+$/.test(text)
  },
  {
    name: 'tab',
    line: (text) => /^\t/.test(text)
  },
  {
    name: 'console-log',
    // the api logs through lib/logger.js, the web app should not log at all
    line: (text, file) => /\bconsole\.log\(/.test(text) && !/scripts|seed|lib[\\/]logger/.test(file)
  },
  {
    name: 'var',
    line: (text, file) => /^\s*var\s/.test(text) && !/admin-old/.test(file)
  }
];

const problems = {};
let total = 0;

function report(rule, file, lineNo) {
  problems[rule] = problems[rule] || [];
  problems[rule].push(path.relative(ROOT, file) + (lineNo ? ':' + lineNo : ''));
  total++;
}

const files = [];
DIRS.forEach(function (d) {
  const dir = path.join(ROOT, d);
  if (fs.existsSync(dir)) walk(dir, files);
});

files.forEach(function (file) {
  const text = fs.readFileSync(file, 'utf8');
  if (text.length && !text.endsWith('\n')) report('final-newline', file);
  if (text.indexOf('\r\n') !== -1) report('crlf', file);
  const lines = text.split('\n');
  if (lines.length > MAX_LINES) report('long-file (' + MAX_LINES + '+ lines)', file);
  lines.forEach(function (line, i) {
    RULES.forEach(function (rule) {
      if (rule.line(line, file)) report(rule.name, file, i + 1);
    });
  });
});

Object.keys(problems).sort().forEach(function (rule) {
  const list = problems[rule];
  console.log(rule + ': ' + list.length);
  if (!quiet) list.slice(0, 10).forEach(p => console.log('  ' + p));
  if (!quiet && list.length > 10) console.log('  ... ' + (list.length - 10) + ' more');
});
console.log(files.length + ' files, ' + total + ' problems' + (strict ? '' : ' (report only)'));

process.exit(strict && total ? 1 : 0);
