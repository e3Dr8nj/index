/**
 * 📱 PWA Installer
 * Универсальный скрипт для программного вызова установки PWA.
 * Поддерживает: Android/Chrome, Desktop Chromium, iOS Safari (инструкция).
 * 
 * Использование:
 *   new PWAInstaller({ buttonId: 'installBtn', onInstalled: () => {} });
 */
(() => {
  'use strict';

  class PWAInstaller {
    constructor(options = {}) {
      this.options = {
        buttonId: 'pwa-install-btn',          // ID кнопки в HTML (или null для авто-создания)
        delay: 0,                             // Задержка показа (мс)
        onInstallReady: null,                 // Колбэк когда установка доступна
        onInstalled: null,                    // Колбэк при успешной установке
        onDismissed: null,                    // Колбэк при отмене
        ...options
      };

      this.deferredPrompt = null;
      this.isInstalled = this._checkInstalled();
      this._iosModal = null;
      this._button = null;
      
      this._bindEvents();
    }

    // 🧠 Инициализация
    _bindEvents() {
      if (this.isInstalled) return;

      // Chrome/Edge/Android: событие готовности к установке
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        this.deferredPrompt = e;
        if (this.options.delay > 0) {
          setTimeout(() => this._showUI(), this.options.delay);
        } else {
          this._showUI();
        }
        if (this.options.onInstallReady) this.options.onInstallReady();
      });

      // Срабатывает после фактической установки
      window.addEventListener('appinstalled', () => {
        this.deferredPrompt = null;
        this.isInstalled = true;
        this._hideUI();
        if (this.options.onInstalled) this.options.onInstalled();
      });
    }

    // 🔍 Проверка: уже установлено?
    _checkInstalled() {
      return (
        window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches ||
        window.navigator.standalone // iOS fallback
      );
    }

    // 📱 Определение платформы
    _isIOS() {
      return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    }

    // 🎨 Показ интерфейса
    _showUI() {
      if (this.isInstalled) return;

      this._button = document.getElementById(this.options.buttonId) || this._createButton();
      
      if (this._isIOS()) {
        this._showIOSInstructions();
      } else {
        this._button.style.display = 'flex';
        this._button.onclick = () => this._triggerInstall();
      }
    }

    _hideUI() {
      if (this._button) this._button.style.display = 'none';
      if (this._iosModal) this._hideIOSInstructions();
    }

    // 🔘 Создание кнопки (если нет в HTML)
    _createButton() {
      const btn = document.createElement('button');
      btn.id = this.options.buttonId;
      btn.className = 'pwa-install-btn';
      btn.setAttribute('aria-label', 'Установить приложение');
      btn.style.display = 'none';
      
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        <span>Установить</span>
      `;
      
      document.body.appendChild(btn);
      this._injectStyles();
      return btn;
    }

    // 💉 Инъекция стилей
    _injectStyles() {
      if (document.getElementById('pwa-install-styles')) return;
      
      const style = document.createElement('style');
      style.id = 'pwa-install-styles';
      style.textContent = `
        .pwa-install-btn {
          position: fixed; bottom: 20px; right: 20px; z-index: 9999;
          display: none; align-items: center; gap: 8px;
          padding: 12px 20px; background: var(--accent, #58a6ff);
          color: #fff; border: none; border-radius: 10px;
          font-family: inherit; font-size: 14px; font-weight: 600;
          cursor: pointer; box-shadow: 0 4px 16px rgba(0,0,0,0.3);
          transition: transform 0.2s, background 0.2s, opacity 0.3s;
          backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
        }
        .pwa-install-btn:hover { transform: translateY(-2px); background: var(--accent-hover, #79b8ff); }
        .pwa-install-btn:active { transform: scale(0.98); }
        
        .pwa-ios-modal {
          position: fixed; inset: 0; z-index: 10000;
          background: rgba(0,0,0,0.5); backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center; padding: 20px;
          opacity: 0; pointer-events: none; transition: opacity 0.3s;
        }
        .pwa-ios-modal.active { opacity: 1; pointer-events: auto; }
        .pwa-ios-card {
          background: var(--bg-secondary, #161b22); border: 1px solid var(--border, #30363d);
          border-radius: 16px; padding: 24px; max-width: 340px; width: 100%;
          box-shadow: 0 20px 40px rgba(0,0,0,0.4);
        }
        .pwa-ios-card h3 { margin: 0 0 12px; font-size: 18px; color: var(--text-primary, #e6edf3); }
        .pwa-ios-card p { margin: 0 0 16px; font-size: 14px; line-height: 1.5; color: var(--text-secondary, #8b949e); }
        .pwa-ios-steps { margin: 0 0 20px; padding-left: 20px; }
        .pwa-ios-steps li { margin-bottom: 8px; }
        .pwa-ios-btn {
          width: 100%; padding: 10px; background: var(--accent, #58a6ff);
          color: #fff; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;
        }
        .pwa-ios-close {
          position: absolute; top: 12px; right: 12px; background: transparent;
          border: none; color: var(--text-secondary, #8b949e); font-size: 20px; cursor: pointer;
        }
        @media (max-width: 600px) {
          .pwa-install-btn { bottom: 16px; right: 16px; padding: 10px 16px; }
        }
      `;
      document.head.appendChild(style);
    }

    // 📥 Запуск установки (Android/Desktop)
    async _triggerInstall() {
      if (!this.deferredPrompt) return;
      
      try {
        this.deferredPrompt.prompt();
        const { outcome } = await this.deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
          this.isInstalled = true;
          this._hideUI();
          if (this.options.onInstalled) this.options.onInstalled();
        } else {
          if (this.options.onDismissed) this.options.onDismissed();
        }
      } catch (err) {
        console.warn('PWA Install error:', err);
      } finally {
        this.deferredPrompt = null;
      }
    }

    // 🍎 iOS инструкции
    _showIOSInstructions() {
      if (this._iosModal) return;
      
      this._iosModal = document.createElement('div');
      this._iosModal.className = 'pwa-ios-modal';
      this._iosModal.innerHTML = `
        <div class="pwa-ios-card">
          <button class="pwa-ios-close" aria-label="Закрыть">×</button>
          <h3>📲 Установка на iPhone/iPad</h3>
          <p>В Safari нажмите «Поделиться», затем «На экран «Домой»»:</p>
          <ol class="pwa-ios-steps">
            <li>Откройте меню <strong>📤 Поделиться</strong></li>
            <li>Выберите <strong>📱 На экран «Домой»</strong></li>
            <li>Подтвердите <strong>Добавить</strong></li>
          </ol>
          <button class="pwa-ios-btn" data-close>Понятно</button>
        </div>
      `;
      document.body.appendChild(this._iosModal);

      // Обработчики
      this._iosModal.querySelector('.pwa-ios-close').onclick = () => this._hideIOSInstructions();
      this._iosModal.querySelector('[data-close]').onclick = () => this._hideIOSInstructions();
      this._iosModal.onclick = (e) => { if (e.target === this._iosModal) this._hideIOSInstructions(); };
      
      // Анимация показа
      requestAnimationFrame(() => this._iosModal.classList.add('active'));
    }

    _hideIOSInstructions() {
      if (!this._iosModal) return;
      this._iosModal.classList.remove('active');
      setTimeout(() => {
        this._iosModal.remove();
        this._iosModal = null;
      }, 300);
    }

    // 🧹 Очистка (опционально)
    destroy() {
      this._hideUI();
      this.deferredPrompt = null;
      window.removeEventListener('beforeinstallprompt', this._bindEvents);
      window.removeEventListener('appinstalled', this._bindEvents);
    }
  }

  // Экспорт в глобальную область
  window.PWAInstaller = PWAInstaller;
})();