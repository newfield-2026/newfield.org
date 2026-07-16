import {
  routes,
  currentRoute
} from './router.js';


const NAV_ICONS = {
  dashboard: `
    <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <rect x="2.5" y="2.5" width="6" height="6" rx="1"></rect>
      <rect x="11.5" y="2.5" width="6" height="6" rx="1"></rect>
      <rect x="2.5" y="11.5" width="6" height="6" rx="1"></rect>
      <rect x="11.5" y="11.5" width="6" height="6" rx="1"></rect>
    </svg>
  `,
  invoices: `
    <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <path d="M5 2.5h7l3 3v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-14a1 1 0 0 1 1-1z"></path>
      <path d="M7 9.5h6M7 13h6M7 6h3"></path>
    </svg>
  `,
  invoiceCreate: `
    <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <path d="M4.5 2.5h6l3 3v10.5a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1v-12.5a1 1 0 0 1 1-1z"></path>
      <path d="M7 9.5h3"></path>
      <path d="M13.5 13v3M12 14.5h3"></path>
    </svg>
  `,
  annualFees: `
    <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <path d="M6 5.5h7l2 2v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1z"></path>
      <path d="M4 3.5h7"></path>
      <path d="M8 10h5M8 13h5"></path>
    </svg>
  `,
  members: `
    <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <circle cx="7" cy="6.5" r="2.5"></circle>
      <path d="M2.5 16.5c0-2.8 2-4.5 4.5-4.5s4.5 1.7 4.5 4.5"></path>
      <circle cx="14" cy="6" r="2"></circle>
      <path d="M12.8 12.2c1.9.3 3.2 1.7 3.2 4.3"></path>
    </svg>
  `
};


function navIcon(route) {
  return NAV_ICONS[route] || '';
}


const HAMBURGER_ICON = `
  <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" focusable="false">
    <path d="M3 5.5h14M3 10h14M3 14.5h14"></path>
  </svg>
`;


const CLOSE_ICON = `
  <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" focusable="false">
    <path d="M5 5l10 10M15 5L5 15"></path>
  </svg>
`;


function openSidebar() {
  document.body.classList.add('is-sidebar-open');

  const overlay = document.querySelector('.sidebar-overlay');
  if (overlay) {
    overlay.hidden = false;
  }

  const button = document.querySelector('.mobile-menu-button');
  if (button) {
    button.setAttribute('aria-expanded', 'true');
  }

  const closeButton = document.querySelector('.mobile-menu-close');
  if (closeButton) {
    closeButton.focus();
  }
}


function closeSidebar() {
  document.body.classList.remove('is-sidebar-open');

  const overlay = document.querySelector('.sidebar-overlay');
  if (overlay) {
    overlay.hidden = true;
  }

  const button = document.querySelector('.mobile-menu-button');
  if (button) {
    button.setAttribute('aria-expanded', 'false');
    button.focus();
  }
}


function toggleSidebar() {
  if (document.body.classList.contains('is-sidebar-open')) {
    closeSidebar();
  } else {
    openSidebar();
  }
}


window.__nfoOpenSidebar = openSidebar;
window.__nfoCloseSidebar = closeSidebar;
window.__nfoToggleSidebar = toggleSidebar;


addEventListener('keydown', function (event) {
  if (
    event.key === 'Escape' &&
    document.body.classList.contains('is-sidebar-open')
  ) {
    closeSidebar();
  }
});


addEventListener('resize', function () {
  if (
    innerWidth >= 901 &&
    document.body.classList.contains('is-sidebar-open')
  ) {
    closeSidebar();
  }
});


export function layout(user, body) {
  const visibleMenuRoutes = [
    'dashboard',
    'invoices',
    'invoiceCreate',
    'annualFees',
    'members'
  ];

  const allowedRoutes =
    user.menu?.map(function (item) {
      return item.code;
    }) ||
    null;

  const menuRoutes =
    visibleMenuRoutes.filter(function (route) {
      return (
        routes[route] &&
        (
          !allowedRoutes ||
          allowedRoutes.includes(route)
        )
      );
    });

  const userName =
    user.displayName ||
    user.email ||
    'ユーザー';

  const avatarInitial = (
    (user.displayName && user.displayName.trim().charAt(0)) ||
    (user.email && user.email.trim().charAt(0)) ||
    'N'
  ).toUpperCase();

  return `
    <div class="layout">
      <aside class="sidebar" id="app-sidebar">
        <div class="brand">
          <div class="brand-content">
            <span class="brand-mark" aria-hidden="true">
              NFO
            </span>

            <span class="brand-name">
              NFO請求書管理
            </span>
          </div>

          <button
            type="button"
            class="mobile-menu-close"
            aria-label="メニューを閉じる"
            onclick="window.__nfoCloseSidebar && window.__nfoCloseSidebar()"
          >
            ${CLOSE_ICON}
          </button>
        </div>

        <nav class="nav">
          ${
            menuRoutes
              .map(function (route) {
                return `
                  <a
                    class="nav-link ${
                      route === currentRoute()
                        ? 'active'
                        : ''
                    }"
                    href="#/${route}"
                    onclick="window.__nfoCloseSidebar && window.__nfoCloseSidebar()"
                  >
                    <span class="nav-icon" aria-hidden="true">
                      ${navIcon(route)}
                    </span>
                    <span class="nav-label">
                      ${routes[route]}
                    </span>
                  </a>
                `;
              })
              .join('')
          }
        </nav>

        <div class="sidebar-user">
          <span class="sidebar-user__avatar" aria-hidden="true">
            ${avatarInitial}
          </span>

          <div class="sidebar-user__details">
            <div class="sidebar-user__name">
              ${esc(userName)}
            </div>

            <div class="sidebar-user__email">
              ${esc(user.email || '')}
            </div>
          </div>
        </div>
      </aside>

      <div class="sidebar-overlay" hidden onclick="window.__nfoCloseSidebar && window.__nfoCloseSidebar()"></div>

      <main class="main">
        <header class="topbar">
          <button
            type="button"
            class="mobile-menu-button"
            aria-label="メニューを開く"
            aria-expanded="false"
            aria-controls="app-sidebar"
            onclick="window.__nfoToggleSidebar && window.__nfoToggleSidebar()"
          >
            ${HAMBURGER_ICON}
          </button>

          <strong>
            ${
              routes[currentRoute()] ||
              '管理者サイト'
            }
          </strong>

          <span class="muted">
            ${
              esc(
                user.displayName ||
                user.email
              )
            }
            ｜
            ${esc(user.role)}
          </span>
        </header>

        <section class="content">
          ${body}
        </section>
      </main>
    </div>
  `;
}


export const esc = function (value) {
  return String(
    value ?? ''
  ).replace(
    /[&<>"']/g,
    function (character) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[character];
    }
  );
};


export const yen = function (value) {
  return Number(
    value || 0
  ).toLocaleString(
    'ja-JP'
  ) + '円';
};
