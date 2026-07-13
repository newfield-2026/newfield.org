import {
  getToken,
  initGoogleLogin,
  clearToken
} from './auth.js';

import { api } from './api.js';

import {
  currentRoute,
  currentParams,
  onRoute,
  go
} from './router.js';

import {
  layout,
  esc
} from './components.js';


let bootstrap = null;

const root = document.querySelector('#app');


async function start() {
  if (!getToken()) {
    login();
    return;
  }

  try {
    bootstrap = await api('bootstrap');
    await render();

  } catch (error) {
    const message =
      error?.message ||
      'APIエラー';

    if (
      /ログイン|登録|有効期限|認証|Invalid Value/.test(
        message
      )
    ) {
      clearToken();
      login(message);
      return;
    }

    root.innerHTML = `
      <div class="error">
        ${esc(message)}
      </div>
    `;
  }
}


function login(message = '') {
  root.innerHTML = `
    <div class="login">
      <div class="login-box">
        <h1>NFO 管理者サイト</h1>

        <p class="muted">
          登録済みGoogleアカウントでログインしてください。
        </p>

        ${
          message
            ? `
              <p class="error">
                ${esc(message)}
              </p>
            `
            : ''
        }

        <div id="google-login"></div>
      </div>
    </div>
  `;

  const waitForGoogle = function () {
    if (
      window.google &&
      window.google.accounts &&
      window.google.accounts.id
    ) {
      initGoogleLogin(
        document.querySelector(
          '#google-login'
        ),
        start
      );

      return;
    }

    setTimeout(
      waitForGoogle,
      100
    );
  };

  waitForGoogle();
}


async function render() {
  root.innerHTML = `
    <div class="loading">
      読み込み中…
    </div>
  `;

  const route = currentRoute();
  const params = currentParams();

  let module;

  try {
    module = await import(
      `../../views/${route}.js`
    );

  } catch (error) {
    module = await import(
      '../../views/placeholder.js'
    );
  }

  const body = await module.render({
    user: bootstrap.user,
    fiscalYear: bootstrap.fiscalYear,
    invoiceId:
      params.get('invoiceId') || ''
  });

  root.innerHTML = layout(
    bootstrap.user,
    body
  );

  if (
    typeof module.bind === 'function'
  ) {
    module.bind();
  }

  document
    .querySelectorAll('[data-go]')
    .forEach(function (element) {
      element.onclick = function () {
        go(
          element.dataset.go
        );
      };
    });
}


onRoute(function () {
  if (bootstrap) {
    render();
  }
});


start();
