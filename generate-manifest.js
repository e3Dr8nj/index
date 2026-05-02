// generate-manifest.js (Node.js, CommonJS)
const fs = require('fs');
const path = require('path');

// 📋 Конфигурация
const CONFIG = {
  srcDir: './modules',           // Исходные модули
  destDir: './public',           // Куда собираем (для деплоя)
  modulesJsonPath: './public/modules.json', // Где создать modules.json
  
  // 🗺️ Маппинг: исходная папка → путь на сайте
  // Если не указано, используется по умолчанию: modules/{name}/
 pathMapping: {
  'test': 'modules/taskflow',        // modules/test/ → /modules/taskflow/
  'breathing-timer': 'modules/breathe',  // → /modules/breathe/
  'medication': 'modules/pills'      // → /modules/pills/
},
  
  // 🎨 Дефолтные настройки PWA для модулей (если нет pwa-config.json)
  defaultPwaConfig: {
    display: 'standalone',
    orientation: 'portrait-primary',
    theme_color: '#0d1117',
    background_color: '#0d1117',
    lang: 'ru'
  }
};

// 🔧 Утилиты
const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const fileExists = (file) => {
  try { fs.accessSync(file); return true; } 
  catch { return false; }
};

const readJsonSafe = (file, fallback = {}) => {
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); }
  catch { return fallback; }
};

// 🖼️ Поиск иконки в папке модуля
const findIcon = (modulePath, publicModulePath) => {
  const extensions = ['png', 'jpg', 'jpeg', 'webp', 'svg'];
  
  // Сначала ищем app-icon (приоритет для PWA)
  for (const ext of extensions) {
    const file = `app-icon.${ext}`;
    if (fileExists(path.join(modulePath, file))) {
      // Копируем в public, если нужно
      const dest = path.join(publicModulePath, file);
      if (!fileExists(dest)) fs.copyFileSync(path.join(modulePath, file), dest);
      return `./${file}`;
    }
  }
  // Потом megaicon (для карточки в оболочке)
  for (const ext of extensions) {
    const file = `megaicon.${ext}`;
    if (fileExists(path.join(modulePath, file))) {
      return `./${file}`;
    }
  }
  return null;
};

// 📝 Генерация manifest.json для модуля
const generateModuleManifest = (moduleConfig, publicModulePath) => {
  const manifest = {
    name: moduleConfig.name || moduleConfig.folderName,
    short_name: moduleConfig.short_name || moduleConfig.name?.slice(0, 12) || moduleConfig.folderName.slice(0, 12),
    description: moduleConfig.description || `Модуль ${moduleConfig.folderName}`,
    start_url: moduleConfig.start_url || './index.html',
    display: moduleConfig.display || CONFIG.defaultPwaConfig.display,
    orientation: moduleConfig.orientation || CONFIG.defaultPwaConfig.orientation,
    theme_color: moduleConfig.theme_color || CONFIG.defaultPwaConfig.theme_color,
    background_color: moduleConfig.background_color || CONFIG.defaultPwaConfig.background_color,
    lang: moduleConfig.lang || CONFIG.defaultPwaConfig.lang,
    icons: []
  };

  // Добавляем иконки, если нашли
  if (moduleConfig.icon) {
    manifest.icons.push(
      { src: moduleConfig.icon, sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: moduleConfig.icon, sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
    );
  }

  const manifestPath = path.join(publicModulePath, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`  ✅ manifest.json для "${moduleConfig.folderName}"`);
  
  return manifest;
};

// 🔄 Генерация базового sw.js для модуля
const generateModuleSW = (moduleName, publicModulePath, assets = []) => {
  const cacheName = `${moduleName}-v1`;
  const defaultAssets = ['./index.html', './manifest.json', ...assets];
  
  const swContent = `
const CACHE_NAME = '${cacheName}';
const ASSETS = ${JSON.stringify(defaultAssets)};

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => 
    Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (!['http:', 'https:'].includes(url.protocol)) return;
  if (url.hostname !== location.hostname) return;
  
  e.respondWith(
    caches.match(e.request).then(cached => {
      const networked = fetch(e.request).then(async res => {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(e.request, res.clone());
        return res;
      }).catch(() => cached);
      return cached || networked;
    })
  );
});
`.trim();

  const swPath = path.join(publicModulePath, 'sw.js');
  fs.writeFileSync(swPath, swContent);
  console.log(`  ✅ sw.js для "${moduleName}"`);
};

// 🏗️ Главная функция
function generate() {
  console.log('🚀 Генерация манифестов и modules.json...');
  
  ensureDir(CONFIG.destDir);
  
  const modules = [];
  const moduleDirs = fs.readdirSync(CONFIG.srcDir)
    .filter(f => fs.statSync(path.join(CONFIG.srcDir, f)).isDirectory());

  for (const folderName of moduleDirs) {
    const srcPath = path.join(CONFIG.srcDir, folderName);
    
    // 🗺️ Определяем путь на сайте
    const destPath = CONFIG.pathMapping[folderName] || `modules/${folderName}`;
    const publicModulePath = path.join(CONFIG.destDir, destPath);
    ensureDir(publicModulePath);

    // 📋 Читаем pwa-config.json из модуля (если есть)
    const pwaConfigFile = path.join(srcPath, 'pwa-config.json');
    const pwaConfig = readJsonSafe(pwaConfigFile, {});
    
    // 🖼️ Ищем иконку
    const icon = findIcon(srcPath, publicModulePath);
    
    // 📝 Описание для оболочки
    let description = null;
    if (fileExists(path.join(srcPath, 'describe.md'))) {
      description = `${destPath}/describe.md`;
    } else if (fileExists(path.join(srcPath, 'describe.txt'))) {
      description = `${destPath}/describe.txt`;
    }

    // 🧩 Конфиг для манифеста модуля
    const moduleManifestConfig = {
      folderName,
      name: pwaConfig.name || folderName,
      short_name: pwaConfig.short_name,
      description: pwaConfig.description,
      start_url: pwaConfig.start_url,
      display: pwaConfig.display,
      orientation: pwaConfig.orientation,
      theme_color: pwaConfig.theme_color,
      background_color: pwaConfig.background_color,
      lang: pwaConfig.lang,
      icon
    };

    // 📦 Генерируем manifest.json и sw.js для модуля
    generateModuleManifest(moduleManifestConfig, publicModulePath);
    generateModuleSW(folderName, publicModulePath, icon ? [icon] : []);

    // ➕ Добавляем в список для modules.json (оболочка)
    modules.push({
      name: folderName,
      url: `${destPath}/index.html`,
      icon: icon ? `${destPath}/${path.basename(icon)}` : null,
      description
    });

    console.log(`✅ Обработан модуль: ${folderName} → /${destPath}/`);
  }

  // 📄 Генерируем modules.json для оболочки
  ensureDir(path.dirname(CONFIG.modulesJsonPath));
  fs.writeFileSync(CONFIG.modulesJsonPath, JSON.stringify({ modules }, null, 2));
  console.log(`✅ modules.json сохранён в ${CONFIG.modulesJsonPath}`);
  
  console.log('🎉 Готово! Теперь каждый модуль можно установить как отдельное PWA.');
}

// Запуск
generate();