// generate-manifest.js (Node.js, CommonJS)
// 🚀 Генерирует: modules.json для оболочки + manifest.json + sw.js для каждого модуля

const fs = require('fs');
const path = require('path');

// 📋 Конфигурация
const CONFIG = {
  srcDir: './modules',                    // Исходные модули
  destDir: './public',                    // Куда собираем (для деплоя)
  modulesJsonPath: './public/modules.json', // Где создать modules.json
  
  // 🗺️ Маппинг: исходная папка → путь на сайте
  // Пример: 'test' → 'modules/taskflow'  (modules/test/ → /modules/taskflow/)
  pathMapping: {
    // 'test': 'modules/taskflow',
    // 'breathing-timer': 'modules/breathe',
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

// 🔒 Нормализация пути для scope: всегда с / в начале и конце
const normalizeScope = (modulePath) => {
  const withLeading = modulePath.startsWith('/') ? modulePath : `/${modulePath}`;
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
};

// 🖼️ Поиск иконки в папке модуля + копирование в public
const findAndCopyIcon = (modulePath, publicModulePath) => {
  const extensions = ['png', 'jpg', 'jpeg', 'webp', 'svg'];
  
  // Приоритет: app-icon (для PWA)
  for (const ext of extensions) {
    const filename = `app-icon.${ext}`;
    const src = path.join(modulePath, filename);
    if (fileExists(src)) {
      const dest = path.join(publicModulePath, filename);
      if (!fileExists(dest)) fs.copyFileSync(src, dest);
      return `./${filename}`;
    }
  }
  // Запасной: megaicon (для карточки в оболочке)
  for (const ext of extensions) {
    const filename = `megaicon.${ext}`;
    if (fileExists(path.join(modulePath, filename))) {
      return `./${filename}`;
    }
  }
  return null;
};

// 📝 Генерация manifest.json для модуля
const generateModuleManifest = (moduleConfig, publicModulePath, modulePath) => {
  const scope = normalizeScope(modulePath);
  
  const manifest = {
    name: moduleConfig.name || moduleConfig.folderName,
    short_name: moduleConfig.short_name || 
                moduleConfig.name?.slice(0, 12) || 
                moduleConfig.folderName.slice(0, 12),
    description: moduleConfig.description || `Модуль ${moduleConfig.folderName}`,
    start_url: moduleConfig.start_url || './index.html',
    scope: scope,  // 🔒 Изоляция: модуль контролирует только свою папку
    display: moduleConfig.display || CONFIG.defaultPwaConfig.display,
    orientation: moduleConfig.orientation || CONFIG.defaultPwaConfig.orientation,
    theme_color: moduleConfig.theme_color || CONFIG.defaultPwaConfig.theme_color,
    background_color: moduleConfig.background_color || CONFIG.defaultPwaConfig.background_color,
    lang: moduleConfig.lang || CONFIG.defaultPwaConfig.lang,
    icons: []
  };

  // Добавляем иконки
  if (moduleConfig.icon) {
    manifest.icons.push(
      { src: moduleConfig.icon, sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: moduleConfig.icon, sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
    );
  }

  const manifestPath = path.join(publicModulePath, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`  ✅ manifest.json: "${moduleConfig.folderName}" (scope: ${scope})`);
  
  return manifest;
};

// 🔄 Генерация sw.js для модуля с изоляцией по пути
const generateModuleSW = (moduleName, publicModulePath, modulePath, assets = []) => {
  const cacheName = `${moduleName}-v1`;
  const MODULE_SCOPE = normalizeScope(modulePath);
  const defaultAssets = ['./index.html', './manifest.json', ...assets];
  
  const swContent = `
const CACHE_NAME = '${cacheName}';
const MODULE_SCOPE = '${MODULE_SCOPE}';
const ASSETS = ${JSON.stringify(defaultAssets)};

// Установка: кэшируем статику
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Активация: чистим старые кэши
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => 
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Запросы: обслуживаем ТОЛЬКО в пределах scope модуля
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  
  // ❌ Пропускаем неподдерживаемые схемы и чужие домены
  if (!['http:', 'https:'].includes(url.protocol)) return;
  if (url.hostname !== location.hostname) return;
  
  // 🔒 ГЛАВНЫЙ ФИКС: игнорируем запросы вне папки модуля
  const pathname = url.pathname;
  if (pathname !== MODULE_SCOPE && !pathname.startsWith(MODULE_SCOPE)) {
    return; // Браузер загрузит оригинал (оболочку / другие модули)
  }
  
  // Стратегия: Cache First, затем Network
  e.respondWith(
    caches.match(e.request).then(cached => {
      const networked = fetch(e.request).then(async res => {
        // Обновляем кэш в фоне
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
  console.log(`  ✅ sw.js: "${moduleName}" (scope: ${MODULE_SCOPE})`);
};

// 🏗️ Главная функция
function generate() {
  console.log('🚀 Генерация манифестов и modules.json...\n');
  
  ensureDir(CONFIG.destDir);
  
  const modules = [];
  
  // Проверяем существование папки с модулями
  if (!fileExists(CONFIG.srcDir)) {
    console.warn(`⚠️ Папка ${CONFIG.srcDir} не найдена. Создаю пустой modules.json`);
    ensureDir(path.dirname(CONFIG.modulesJsonPath));
    fs.writeFileSync(CONFIG.modulesJsonPath, JSON.stringify({ modules: [] }, null, 2));
    return;
  }
  
  const moduleDirs = fs.readdirSync(CONFIG.srcDir)
    .filter(f => {
      const stat = fs.statSync(path.join(CONFIG.srcDir, f));
      return stat.isDirectory();
    });

  if (moduleDirs.length === 0) {
    console.log('ℹ️ Нет папок с модулями');
  }

  for (const folderName of moduleDirs) {
    const srcPath = path.join(CONFIG.srcDir, folderName);
    
    // 🗺️ Определяем путь на сайте (с учётом маппинга)
    const destPath = CONFIG.pathMapping[folderName] || `modules/${folderName}`;
    const publicModulePath = path.join(CONFIG.destDir, destPath);
    ensureDir(publicModulePath);

    // 📋 Читаем pwa-config.json из модуля (если есть)
    const pwaConfigFile = path.join(srcPath, 'pwa-config.json');
    const pwaConfig = readJsonSafe(pwaConfigFile, {});
    
    // 🖼️ Ищем и копируем иконку
    const icon = findAndCopyIcon(srcPath, publicModulePath);
    
    // 📝 Описание для оболочки (describe.md или describe.txt)
    let description = null;
    if (fileExists(path.join(srcPath, 'describe.md'))) {
      description = `${destPath}/describe.md`;
    } else if (fileExists(path.join(srcPath, 'describe.txt'))) {
      description = `${destPath}/describe.txt`;
    }

    // 🧩 Конфиг для manifest.json модуля
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
    generateModuleManifest(moduleManifestConfig, publicModulePath, destPath);
    generateModuleSW(folderName, publicModulePath, destPath, icon ? [icon] : []);

    // ➕ Добавляем в список для modules.json (оболочка)
    modules.push({
      name: folderName,
      url: `${destPath}/index.html`,
      icon: icon ? `${destPath}/${path.basename(icon)}` : null,
      description
    });

    console.log(`✅ Модуль: ${folderName} → /${destPath}/\n`);
  }

  // 📄 Генерируем modules.json для оболочки
  ensureDir(path.dirname(CONFIG.modulesJsonPath));
  fs.writeFileSync(CONFIG.modulesJsonPath, JSON.stringify({ modules }, null, 2));
  console.log(`📄 modules.json сохранён: ${CONFIG.modulesJsonPath}`);
  
  console.log('\n🎉 Готово!');
  console.log('   • Оболочка видит модули через modules.json');
  console.log('   • Каждый модуль можно установить как отдельное PWA');
  console.log('   • Навигация между оболочкой и модулями не ломается 🔒');
}

// Запуск
generate();