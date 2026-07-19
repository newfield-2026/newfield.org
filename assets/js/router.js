export const routes = {
  dashboard: 'ダッシュボード',
  members: '会員・請求先管理',
  invoices: '請求書一覧',
  invoiceCreate: '請求書新規作成',
  invoiceDetail: '請求書詳細',
  annualFees: '年会費一括作成',
  payments: '入金管理',
  invoiceSettings: '請求書設定',
  feeSettings: '会費設定',
  accounts: 'アカウント管理'
};


/**
 * 現在の画面名を取得する。
 *
 * 例:
 * #/invoiceCreate?invoiceId=inv-001
 * → invoiceCreate
 *
 * @return {string}
 */
export function currentRoute() {
  return (
    location.hash
      .replace(/^#\/?/, '')
      .split('?')[0] ||
    'dashboard'
  );
}


/**
 * 現在のURLパラメータを取得する。
 *
 * 例:
 * #/invoiceCreate?invoiceId=inv-001
 *
 * @return {URLSearchParams}
 */
export function currentParams() {
  const hash = location.hash.replace(
    /^#\/?/,
    ''
  );

  const queryString =
    hash.indexOf('?') >= 0
      ? hash.substring(
          hash.indexOf('?') + 1
        )
      : '';

  return new URLSearchParams(queryString);
}


/**
 * 指定画面へ移動する。
 *
 * @param {string} route
 * @param {Object} params
 */
export function go(route, params = {}) {
  const query = new URLSearchParams();

  Object.keys(params).forEach(function (key) {
    const value = params[key];

    if (
      value !== null &&
      typeof value !== 'undefined' &&
      String(value) !== ''
    ) {
      query.set(key, String(value));
    }
  });

  const queryString = query.toString();

  location.hash =
    '#/' +
    route +
    (queryString ? '?' + queryString : '');
}


/**
 * 画面遷移を監視する。
 *
 * @param {Function} callback
 */
export function onRoute(callback) {
  addEventListener(
    'hashchange',
    callback
  );
}
