import {
  routes,
  currentRoute
} from './router.js';


export function layout(user, body) {
  const allowed =
    user.menu?.map(function (item) {
      return item.code;
    }) ||
    Object.keys(routes);

  const hiddenMenuRoutes = [
    'invoiceDetail'
  ];

  const menuRoutes =
    allowed.filter(function (route) {
      return (
        routes[route] &&
        !hiddenMenuRoutes.includes(route)
      );
    });

  return `
    <div class="layout">
      <aside class="sidebar">
        <div class="brand">
          NFO
          <br>

          <span class="muted">
            ニューフィールド文化機構
          </span>
        </div>

        <nav class="nav">
          ${
            menuRoutes
              .map(function (route) {
                return `
                  <a
                    class="${
                      route === currentRoute()
                        ? 'active'
                        : ''
                    }"
                    href="#/${route}"
                  >
                    ${routes[route]}
                  </a>
                `;
              })
              .join('')
          }
        </nav>
      </aside>

      <main class="main">
        <header class="topbar">
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
