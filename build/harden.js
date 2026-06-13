'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const JavaScriptObfuscator = require('javascript-obfuscator');

const ROOT = path.resolve(__dirname, '..');
const SRC_HTML = path.join(ROOT, 'architect-canvas.html');
const DIST_DIR = path.join(ROOT, 'dist');
const DIST_HTML = path.join(DIST_DIR, 'architect-canvas.html');

const LICENSEE_ARG = process.argv[2] || 'test@buyer.example';
const VERIFY_MODE = process.argv.includes('--verify');

const RESERVED_STRINGS = [
  'architect-canvas-state',
  'diagram-canvas',
  'systems-list',
  'systems-editor',
  'canvas-area',
  'app-header',
  'header-inner',
  'header-brand',
  'header-toolbar',
  'main-nav',
  'nav-inner',
  'main-content',
  'tab-diagram',
  'tab-positioning',
  'positioning-output',
  'narrative-text',
  'narrative-block',
  'copy-narrative',
  'capability-table-container',
  'highlights-container',
  'license-footer',
  'toast',
  'btn-add-system',
  'btn-load-sample',
  'btn-clear',
  'btn-import',
  'btn-export',
  'btn-export-png',
  'btn-export-svg',
  'btn-generate',
  'btn-add-authority',
  'import-file-input',
  'authorities-rows',
  'pos-orgName',
  'pos-coreValue',
  'pos-primaryGoal',
  'pos-duplicationRisks',
  'pos-audience',
  'diagram-legend',
  'generate-btn-row',
  'ArchitectCanvasLayout',
  'ArchitectCanvasPositioning',
];

const RESERVED_NAMES = [
  'ArchitectCanvasLayout',
  'ArchitectCanvasPositioning',
  'layoutSystems',
  'renderLayoutToSVG',
  'generatePositioning',
  'escXML',
  'SAMPLE_STATE',
  'state',
  'loadState',
  'saveState',
  'showToast',
  'genId',
  'renderSystemsList',
  'refreshDiagram',
  'bindDiagramEvents',
  'renderPositioningForm',
  'renderAuthoritiesRows',
  'bindPositioningFormEvents',
  'downloadFile',
  'getSVGString',
  'bindToolbarEvents',
  'bindNavEvents',
];

function ensureSource() {
  if (!fs.existsSync(SRC_HTML)) {
    console.log('[harden] architect-canvas.html not found, running assemble.js...');
    execSync('node ' + path.join(ROOT, 'build', 'assemble.js'), { cwd: ROOT, stdio: 'inherit' });
  }
}

function extractScript(html) {
  const match = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!match) throw new Error('No <script> block found in HTML');
  return match[1];
}

function buildFingerprint(email) {
  const encoded = Buffer.from(email).toString('base64');
  const third = Math.floor(encoded.length / 3);
  const part1 = encoded.slice(0, third);
  const part2 = encoded.slice(third, third * 2);
  const part3 = encoded.slice(third * 2);
  const rev = encoded.split('').reverse().join('').slice(0, 12);

  return [
    '',
    'var _f1="' + part1 + '";',
    'var _f2="' + part2 + '";',
    'var _f3="' + part3 + '";',
    'var _fx="' + rev + '";',
    'var _fp=(function(){return atob(_f1+_f2+_f3);})();',
    '',
  ].join('\n');
}

function buildDomainLock() {
  return [
    '',
    '(function(){',
    '  var _h=(typeof location!=="undefined")?location.hostname:"";',
    '  var _p=(typeof location!=="undefined")?location.protocol:"file:";',
    '  var _w=["","localhost","127.0.0.1"];',
    '  if(_p!=="file:"&&_w.indexOf(_h)<0){',
    '    if(typeof console!=="undefined"){',
    '      console.warn("[Architect Canvas] Unlicensed host: "+_h);',
    '    }',
    '  }',
    '})();',
    '',
  ].join('\n');
}

function buildObfuscateOptions(fullProtection) {
  return {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.6,
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 0.3,
    stringArray: true,
    stringArrayEncoding: ['base64'],
    stringArrayThreshold: 0.75,
    stringArrayWrapperType: 'function',
    splitStrings: true,
    splitStringsChunkLength: 8,
    identifierNamesGenerator: 'hexadecimal',
    selfDefending: false,
    debugProtection: false,
    debugProtectionInterval: 0,
    disableConsoleOutput: true,
    transformObjectKeys: false,
    reservedNames: RESERVED_NAMES,
    reservedStrings: RESERVED_STRINGS,
  };
}

function obfuscateJS(jsCode, fullProtection) {
  const result = JavaScriptObfuscator.obfuscate(jsCode, buildObfuscateOptions(fullProtection));
  return result.getObfuscatedCode();
}

function injectLicensee(html, email) {
  return html.replace(/\{\{LICENSEE\}\}/g, email);
}

function main() {
  ensureSource();

  const srcSize = fs.statSync(SRC_HTML).size;
  console.log('[harden] Source: ' + SRC_HTML + ' (' + srcSize + ' bytes)');
  console.log('[harden] Licensee: ' + LICENSEE_ARG);
  console.log('[harden] Mode: ' + (VERIFY_MODE ? 'verify' : 'production') + ' (selfDefending/debugProtection disabled)');

  let html = fs.readFileSync(SRC_HTML, 'utf8');
  html = injectLicensee(html, LICENSEE_ARG);

  const originalJS = extractScript(html);
  const domainLock = buildDomainLock();
  const fingerprint = buildFingerprint(LICENSEE_ARG);
  const patchedJS = domainLock + fingerprint + originalJS;

  console.log('[harden] Obfuscating JS (' + patchedJS.length + ' chars)...');

  const fullProtection = !VERIFY_MODE;
  const obfuscated = obfuscateJS(patchedJS, fullProtection);
  console.log('[harden] Obfuscated JS: ' + obfuscated.length + ' chars');

  const hardened = html.replace(
    /<script>([\s\S]*?)<\/script>/,
    '<script>' + obfuscated + '</script>'
  );

  if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
  }

  fs.writeFileSync(DIST_HTML, hardened, 'utf8');
  const distSize = fs.statSync(DIST_HTML).size;

  console.log('[harden] Output: ' + DIST_HTML + ' (' + distSize + ' bytes)');
  console.log('[harden] Size ratio: ' + Math.round(distSize / srcSize * 100) + '% of original');
  console.log('[harden] Done.');
}

main();
