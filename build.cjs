// Dependency-free bundler for the pinned Three.js module and this game.
// Produces classic scripts so the game also runs directly from file://.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname,'dist');
const source = fs.readFileSync(path.join(root,'vendor/three.module.js'),'utf8');
const match = source.match(/export \{([^}]+)\};\s*$/);
if(!match)throw Error('Unexpected Three.js export format');
const names = match[1].trim().split(',').map(s=>s.trim());
if(names.some(n=>!/^\w+$/.test(n)))throw Error('Unexpected export name');
const bundled = '/* Three.js r170 — MIT license: vendor/THREE-LICENSE.txt */\nconst THREE = (()=>{\n'+source.slice(0,match.index)+'\nreturn { '+names.join(', ')+' };\n})();\n';
fs.writeFileSync(path.join(root,'vendor/three.js'),bundled);
const game = fs.readFileSync(path.join(root,'game.js'),'utf8').replace(/^import \* as THREE from '[^']+';\s*/, '');
fs.writeFileSync(path.join(root,'game.classic.js'),'(()=>{\n'+game+'\n})();\n');
console.log('Built offline-compatible Neon Rift. Open dist/index.html.');
