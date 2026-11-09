/**
 * NOIRADIX Maintenance & System Upgrade Banner Module
 * (c) 2026 NOIRADIX
 *
 * Requirements:
 * - Bilingual: Top Vietnamese, Bottom English (no toggle switch, both displayed).
 * - Periodic: Re-displays every 15 minutes after dismissal.
 * - Responsive: Works smoothly on desktop, tablet, and mobile without obstructing core tools.
 * - Dismissible: User can close/dismiss anytime.
 * - Modular & Toggable: Master toggle (enabled: true/false) to enable/disable cleanly without dirtying code.
 */

(function (global) {
  'use strict';

  const STORAGE_KEY = 'noira_maintenance_dismissed_at';
  const DEFAULT_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

  const DEFAULT_CONFIG = {
    enabled: true, // Master toggle: set false to disable cleanly
    intervalMs: DEFAULT_INTERVAL_MS,
    storageKey: STORAGE_KEY,
    autoCheckIntervalMs: 60 * 1000, // Check every 60 seconds
    viTitle: 'Nâng cấp & Bảo trì Hệ thống',
    viMessage: 'Ứng dụng đang trong giai đoạn nâng cấp & bảo trì. Rất có thể một số công cụ tạm thời chưa khả dụng hoặc phát sinh lỗi, rất mong quý người dùng thông cảm!',
    enTitle: 'System Upgrade & Maintenance',
    enMessage: 'The application is currently undergoing upgrades and maintenance. Some tools may be temporarily unavailable or encounter errors. We appreciate your patience and understanding!'
  };

  class MaintenanceBanner {
    constructor(userConfig = {}) {
      this.config = Object.assign({}, DEFAULT_CONFIG, userConfig);
      this.bannerEl = null;
      this.timerId = null;
      this.isVisible = false;
      this._boundCheck = this.checkAndShow.bind(this);

      if (this.config.enabled) {
        this._injectStyles();
        this._scheduleAutoCheck();
        // Check immediately on load after brief delay
        setTimeout(() => this.checkAndShow(), 1200);
      }
    }

    /**
     * Injects scoped, responsive CSS for the floating banner card
     */
    _injectStyles() {
      if (typeof document === 'undefined') return;
      if (document.getElementById('noira-maintenance-banner-styles')) return;

      const style = document.createElement('style');
      style.id = 'noira-maintenance-banner-styles';
      style.textContent = `
        .noira-maintenance-banner {
          position: fixed;
          bottom: 24px;
          right: 24px;
          max-width: 420px;
          width: calc(100vw - 48px);
          background: rgba(15, 23, 42, 0.94);
          color: #f1f5f9;
          border: 1px solid rgba(245, 158, 11, 0.45);
          border-left: 4px solid #f59e0b;
          border-radius: 12px;
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          z-index: 999999;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          box-sizing: border-box;
          opacity: 0;
          transform: translateY(20px) scale(0.96);
          pointer-events: none;
          transition: opacity 0.28s cubic-bezier(0.16, 1, 0.3, 1), transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
          overflow: hidden;
        }

        .noira-maintenance-banner.is-visible {
          opacity: 1;
          transform: translateY(0) scale(1);
          pointer-events: auto;
        }

        .noira-mb-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px 8px 14px;
          background: rgba(245, 158, 11, 0.12);
          border-bottom: 1px solid rgba(245, 158, 11, 0.2);
        }

        .noira-mb-badge {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          color: #fbbf24;
        }

        .noira-mb-badge svg,
        .noira-mb-badge i {
          font-size: 13px;
        }

        .noira-mb-close-btn {
          background: transparent;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          padding: 4px 6px;
          border-radius: 6px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          line-height: 1;
          transition: all 0.15s ease;
        }

        .noira-mb-close-btn:hover {
          color: #ffffff;
          background: rgba(239, 68, 68, 0.2);
        }

        .noira-mb-body {
          padding: 12px 14px 14px 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .noira-mb-section {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .noira-mb-lang-label {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 10px;
          font-weight: 700;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }

        .noira-mb-text {
          font-size: 12px;
          line-height: 1.48;
          color: #e2e8f0;
          margin: 0;
          word-break: break-word;
        }

        .noira-mb-divider {
          height: 1px;
          background: rgba(148, 163, 184, 0.15);
          width: 100%;
        }

        .noira-mb-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 14px 10px 14px;
          font-size: 10px;
          color: #64748b;
        }

        .noira-mb-dismiss-action {
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: #cbd5e1;
          padding: 3px 8px;
          border-radius: 5px;
          font-size: 11px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease;
        }

        .noira-mb-dismiss-action:hover {
          background: rgba(255, 255, 255, 0.16);
          color: #ffffff;
        }

        /* Responsive Breakpoints */
        @media (max-width: 640px) {
          .noira-maintenance-banner {
            bottom: 12px;
            right: 12px;
            left: 12px;
            width: auto;
            max-width: none;
            border-radius: 10px;
          }
          .noira-mb-body {
            padding: 10px 12px 12px 12px;
            gap: 8px;
          }
          .noira-mb-text {
            font-size: 11.5px;
          }
        }
      `;
      document.head.appendChild(style);
    }

    /**
     * Determines whether 15 minutes have passed since last dismissal
     */
    shouldShow() {
      if (!this.config.enabled) return false;
      try {
        const lastDismissed = localStorage.getItem(this.config.storageKey);
        if (!lastDismissed) return true;
        const timePassed = Date.now() - parseInt(lastDismissed, 10);
        return timePassed >= this.config.intervalMs;
      } catch (err) {
        return true;
      }
    }

    /**
     * Periodic check
     */
    checkAndShow() {
      if (this.shouldShow() && !this.isVisible) {
        this.show();
      }
    }

    _scheduleAutoCheck() {
      if (this.timerId) clearInterval(this.timerId);
      this.timerId = setInterval(this._boundCheck, this.config.autoCheckIntervalMs);
    }

    /**
     * Displays the banner
     */
    show() {
      if (!this.config.enabled) return;
      if (typeof document === 'undefined') return;

      if (!this.bannerEl) {
        this._buildDOM();
      }

      this.isVisible = true;
      requestAnimationFrame(() => {
        if (this.bannerEl) {
          this.bannerEl.classList.add('is-visible');
        }
      });
    }

    /**
     * Dismisses the banner and records timestamp for the 15-minute schedule
     */
    dismiss() {
      try {
        localStorage.setItem(this.config.storageKey, Date.now().toString());
      } catch (err) {
        // Safe localStorage fallback
      }

      this.isVisible = false;
      if (this.bannerEl) {
        this.bannerEl.classList.remove('is-visible');
      }
    }

    _buildDOM() {
      const banner = document.createElement('div');
      banner.className = 'noira-maintenance-banner';
      banner.setAttribute('role', 'status');
      banner.setAttribute('aria-live', 'polite');

      banner.innerHTML = `
        <div class="noira-mb-header">
          <div class="noira-mb-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            <span>${this.config.enTitle}</span>
          </div>
          <button type="button" class="noira-mb-close-btn" aria-label="Close notification" title="Dismiss">
            ✕
          </button>
        </div>

        <div class="noira-mb-body">
          <!-- Top Section: Tiếng Việt -->
          <div class="noira-mb-section">
            <span class="noira-mb-lang-label">🇻🇳 Tiếng Việt</span>
            <p class="noira-mb-text">${this.config.viMessage}</p>
          </div>

          <div class="noira-mb-divider"></div>

          <!-- Bottom Section: English -->
          <div class="noira-mb-section">
            <span class="noira-mb-lang-label">🇬🇧 English</span>
            <p class="noira-mb-text">${this.config.enMessage}</p>
          </div>
        </div>

        <div class="noira-mb-footer">
          <span>Auto re-checks every 30 minutes</span>
          <button type="button" class="noira-mb-dismiss-action">Got it</button>
        </div>
      `;

      const closeBtn = banner.querySelector('.noira-mb-close-btn');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => this.dismiss());
      }

      const dismissAction = banner.querySelector('.noira-mb-dismiss-action');
      if (dismissAction) {
        dismissAction.addEventListener('click', () => this.dismiss());
      }

      document.body.appendChild(banner);
      this.bannerEl = banner;
    }

    /**
     * Master toggle to easily turn ON/OFF without code changes
     */
    setEnabled(enabled) {
      this.config.enabled = Boolean(enabled);
      if (!this.config.enabled) {
        this.dismiss();
        if (this.timerId) {
          clearInterval(this.timerId);
          this.timerId = null;
        }
      } else {
        this._scheduleAutoCheck();
        this.checkAndShow();
      }
    }

    destroy() {
      if (this.timerId) {
        clearInterval(this.timerId);
        this.timerId = null;
      }
      if (this.bannerEl && this.bannerEl.parentNode) {
        this.bannerEl.parentNode.removeChild(this.bannerEl);
      }
      this.bannerEl = null;
      this.isVisible = false;
    }
  }

  // Export singleton & class
  let instance = null;

  function init(options) {
    if (!instance) {
      instance = new MaintenanceBanner(options);
    }
    return instance;
  }

  function getInstance() {
    return instance || init();
  }

  const NoiraMaintenanceBanner = {
    MaintenanceBanner,
    init,
    getInstance,
    show: () => getInstance().show(),
    dismiss: () => getInstance().dismiss(),
    setEnabled: (val) => getInstance().setEnabled(val),
    destroy: () => {
      if (instance) {
        instance.destroy();
        instance = null;
      }
    }
  };

  // UMD / Global export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = NoiraMaintenanceBanner;
  } else {
    global.NoiraMaintenanceBanner = NoiraMaintenanceBanner;
    // Auto-init on page load if browser environment
    if (typeof window !== 'undefined') {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => init());
      } else {
        init();
      }
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);

