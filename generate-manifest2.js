// generate-manifest.js (Node.js)
const fs = require('fs');
const path = require('path');

const modulesDir = './modules';
const modules = fs.readdirSync(modulesDir)
  .filter(f => fs.statSync(path.join(modulesDir, f)).isDirectory())
  .map(name => ({
    name,
    url: `modules/${name}/index.html`,
    icon: fs.existsSync(`modules/${name}/megaicon.png`) ? `modules/${name}/megaicon.png` : null,
    description: fs.existsSync(`modules/${name}/describe.md`) 
      ? `modules/${name}/describe.md` 
      : fs.existsSync(`modules/${name}/describe.txt`) 
        ? `modules/${name}/describe.txt` 
        : null
  }));

fs.writeFileSync('modules.json', JSON.stringify({ modules }, null, 2));
console.log('✅ modules.json сгенерирован');