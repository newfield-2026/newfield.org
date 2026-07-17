import { api } from '../assets/js/api.js';
import { esc } from '../assets/js/components.js';

let currentItems = [];
let searchTerm = '';
let memberTypeFilter = 'all';
let statusFilter = 'all';


/**
 * 会員・請求先一覧を表示する。
 *
 * @return {Promise<string>}
 */
export async function render() {
  searchTerm = '';
  memberTypeFilter = 'all';
  statusFilter = 'all';

  let data;

  try {
    data = await api(
      'listPayees',
      {
        type: 'all',
        status: 'all'
      }
    );

  } catch (error) {
    return renderError_(error);
  }

  currentItems = data.items || [];

  const filteredItems =
    getFilteredItems_();

  return `
    <div class="members-view">
      <div class="members-intro">
        会員情報と請求先情報を確認できます。
      </div>

      <div class="members-toolbar">
        <div class="members-toolbar__filters">
          <input
            id="member-q"
            type="search"
            class="c-input members-search"
            placeholder="氏名・団体名・会員区分・連絡先で検索"
            value="${escapeAttr_(searchTerm)}"
          >

          <select
            id="member-type-filter"
            class="c-select members-filter"
          >
            ${renderMemberTypeOptions_()}
          </select>

          <select
            id="member-status-filter"
            class="c-select members-filter"
          >
            ${renderStatusOptions_()}
          </select>
        </div>

        <div class="members-toolbar__actions">
          <button
            type="button"
            class="btn"
            id="member-search"
          >
            検索
          </button>
        </div>
      </div>

      <div
        class="members-count"
        id="members-count"
      >
        ${esc(getCountLabel_(filteredItems))}
      </div>

      <div class="members-desktop table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>種別</th>
              <th>名称</th>
              <th>会員区分</th>
              <th>連絡先</th>
              <th>住所</th>
              <th>状態</th>
            </tr>
          </thead>

          <tbody id="member-body">
            ${renderRows_(filteredItems)}
          </tbody>
        </table>
      </div>

      <div class="members-mobile">
        <div id="member-cards">
          ${renderCards_(filteredItems)}
        </div>
      </div>
    </div>
  `;
}


/**
 * 検索語・会員区分・状態フィルターを適用したcurrentItemsを返す。
 * currentItems自体は変更しない。
 *
 * @return {Array}
 */
function getFilteredItems_() {
  const term =
    searchTerm.trim().toLowerCase();

  return currentItems.filter(function (item) {
    return (
      itemMatchesSearch_(item, term) &&
      itemMatchesMemberType_(item) &&
      itemMatchesStatus_(item)
    );
  });
}


/**
 * 検索語に一致するか判定する
 * （バックエンドのkeyword検索と同じ対象フィールド：
 * 氏名/団体名・電話・メール・会員区分・種別）。
 *
 * @param {Object} item
 * @param {string} term
 * @return {boolean}
 */
function itemMatchesSearch_(item, term) {
  if (!term) {
    return true;
  }

  const haystack =
    [
      item.name,
      item.phone,
      item.email,
      item.memberType,
      item.sourceType
    ]
      .map(function (value) {
        return String(value || '').toLowerCase();
      })
      .join(' ');

  return haystack.indexOf(term) >= 0;
}


/**
 * 会員区分フィルターに一致するか判定する。
 *
 * @param {Object} item
 * @return {boolean}
 */
function itemMatchesMemberType_(item) {
  if (memberTypeFilter === 'all') {
    return true;
  }

  return (
    String(item.memberType || '') ===
    memberTypeFilter
  );
}


/**
 * 状態フィルターに一致するか判定する。
 *
 * @param {Object} item
 * @return {boolean}
 */
function itemMatchesStatus_(item) {
  if (statusFilter === 'all') {
    return true;
  }

  return (
    String(item.status || '') ===
    statusFilter
  );
}


/**
 * 会員区分フィルターの選択肢を作る。
 * 実際にcurrentItemsへ存在する値だけを候補にする
 * （区分コード表記か日本語表記か確定できないため、
 * 実データの値をそのまま候補にする）。
 *
 * @return {string}
 */
function renderMemberTypeOptions_() {
  const values =
    Array.from(
      new Set(
        currentItems
          .map(function (item) {
            return String(
              item.memberType || ''
            ).trim();
          })
          .filter(Boolean)
      )
    ).sort(function (a, b) {
      return a.localeCompare(b, 'ja');
    });

  const options = values
    .map(function (value) {
      return `
        <option value="${escapeAttr_(value)}">
          ${esc(value)}
        </option>
      `;
    })
    .join('');

  return (
    '<option value="all">会員区分：すべて</option>' +
    options
  );
}


/**
 * 状態フィルターの選択肢を作る。
 * 実際にcurrentItemsへ存在する値だけを候補にする。
 *
 * @return {string}
 */
function renderStatusOptions_() {
  const values =
    Array.from(
      new Set(
        currentItems
          .map(function (item) {
            return String(
              item.status || ''
            ).trim();
          })
          .filter(Boolean)
      )
    ).sort(function (a, b) {
      return a.localeCompare(b, 'ja');
    });

  const options = values
    .map(function (value) {
      return `
        <option value="${escapeAttr_(value)}">
          ${esc(getStatusLabel_(value))}
        </option>
      `;
    })
    .join('');

  return (
    '<option value="all">状態：すべて</option>' +
    options
  );
}


/**
 * 件数表示テキストを作る。
 *
 * @param {Array} filteredItems
 * @return {string}
 */
function getCountLabel_(filteredItems) {
  const total = currentItems.length;
  const filteredCount = filteredItems.length;

  if (!total) {
    return '0件';
  }

  if (filteredCount === total) {
    return total + '件';
  }

  return total + '件中 ' + filteredCount + '件を表示';
}


/**
 * 検索・フィルター再適用後、一覧部分だけを再描画する。
 * ページ全体の再描画やAPI再呼び出しは行わない。
 */
function refreshList_() {
  const filteredItems =
    getFilteredItems_();

  const tbody =
    document.querySelector('#member-body');

  if (tbody) {
    tbody.innerHTML =
      renderRows_(filteredItems);
  }

  const cardList =
    document.querySelector('#member-cards');

  if (cardList) {
    cardList.innerHTML =
      renderCards_(filteredItems);
  }

  const countEl =
    document.querySelector('#members-count');

  if (countEl) {
    countEl.textContent =
      getCountLabel_(filteredItems);
  }
}


/**
 * 画面イベントを設定する。
 */
export function bind() {
  const searchInput =
    document.querySelector('#member-q');

  const searchButton =
    document.querySelector('#member-search');

  const typeSelect =
    document.querySelector(
      '#member-type-filter'
    );

  const statusSelect =
    document.querySelector(
      '#member-status-filter'
    );

  if (searchInput) {
    searchInput.addEventListener(
      'input',
      function () {
        searchTerm = searchInput.value || '';
        refreshList_();
      }
    );
  }

  if (searchButton) {
    searchButton.addEventListener(
      'click',
      function () {
        searchTerm =
          searchInput?.value || '';
        refreshList_();
      }
    );
  }

  if (typeSelect) {
    typeSelect.addEventListener(
      'change',
      function () {
        memberTypeFilter =
          typeSelect.value || 'all';
        refreshList_();
      }
    );
  }

  if (statusSelect) {
    statusSelect.addEventListener(
      'change',
      function () {
        statusFilter =
          statusSelect.value || 'all';
        refreshList_();
      }
    );
  }

  const view =
    document.querySelector('.members-view');

  if (view) {
    view.addEventListener(
      'click',
      function (event) {
        const clearButton =
          event.target.closest(
            '.members-clear'
          );

        if (!clearButton) {
          return;
        }

        searchTerm = '';
        memberTypeFilter = 'all';
        statusFilter = 'all';

        if (searchInput) {
          searchInput.value = '';
        }

        if (typeSelect) {
          typeSelect.value = 'all';
        }

        if (statusSelect) {
          statusSelect.value = 'all';
        }

        refreshList_();
      }
    );
  }
}


/**
 * 一覧の行（PC版テーブル）を作る。
 * 900px以下ではCSSでこの<tr>/<td>自体をカード風に変形するため、
 * PC/モバイルで要素を複製していない。
 *
 * @param {Array} items
 * @return {string}
 */
function renderRows_(items) {
  if (!currentItems.length) {
    return `
      <tr>
        <td
          colspan="6"
          class="members-empty"
        >
          会員・請求先はまだ登録されていません。
        </td>
      </tr>
    `;
  }

  if (!items.length) {
    return `
      <tr>
        <td
          colspan="6"
          class="members-empty"
        >
          <p>条件に一致する会員・請求先がありません。</p>

          <button
            type="button"
            class="btn members-clear"
          >
            検索条件をクリア
          </button>
        </td>
      </tr>
    `;
  }

  return items
    .map(function (item) {
      return renderRow_(item);
    })
    .join('');
}


/**
 * 会員・請求先1件分の行を作る。
 *
 * @param {Object} item
 * @return {string}
 */
function renderRow_(item) {
  const contact =
    renderContact_(item);

  const address =
    renderAddress_(item);

  return `
    <tr class="member-row">
      <td data-label="種別">
        ${esc(getSourceTypeLabel_(item.sourceType))}
      </td>

      <td data-label="名称" class="members-table__name">
        ${esc(item.name || '')}
      </td>

      <td data-label="会員区分">
        ${
          item.memberType
            ? `<span class="c-badge members-badge">${esc(item.memberType)}</span>`
            : '―'
        }
      </td>

      <td data-label="連絡先" class="members-table__contact">
        ${contact}
      </td>

      <td data-label="住所" class="members-table__address">
        ${address}
      </td>

      <td data-label="状態">
        <span class="members-status ${getStatusClass_(item.status)}">
          ${esc(getStatusLabel_(item.status))}
        </span>
      </td>
    </tr>
  `;
}


/**
 * モバイル用カード一覧を作る（PC版と同じitemsを使用）。
 *
 * @param {Array} items
 * @return {string}
 */
function renderCards_(items) {
  if (!currentItems.length) {
    return `
      <div class="members-empty">
        会員・請求先はまだ登録されていません。
      </div>
    `;
  }

  if (!items.length) {
    return `
      <div class="members-empty">
        <p>条件に一致する会員・請求先がありません。</p>

        <button
          type="button"
          class="btn members-clear"
        >
          検索条件をクリア
        </button>
      </div>
    `;
  }

  return items
    .map(function (item) {
      return renderCard_(item);
    })
    .join('');
}


/**
 * 会員・請求先1件分のモバイルカードを作る。
 *
 * @param {Object} item
 * @return {string}
 */
function renderCard_(item) {
  const contact =
    renderContact_(item);

  const address =
    renderAddress_(item);

  return `
    <div class="member-card">
      <div class="member-card__header">
        <div class="member-card__name">
          ${esc(item.name || '')}
        </div>

        <span class="members-status ${getStatusClass_(item.status)}">
          ${esc(getStatusLabel_(item.status))}
        </span>
      </div>

      <div class="member-card__badges">
        <span class="c-badge members-badge">
          ${esc(getSourceTypeLabel_(item.sourceType))}
        </span>

        ${
          item.memberType
            ? `<span class="c-badge members-badge">${esc(item.memberType)}</span>`
            : ''
        }
      </div>

      <div class="member-card__details">
        <div class="member-card__row">
          <span class="member-card__row-label">連絡先</span>
          <span class="member-card__row-value">${contact}</span>
        </div>

        <div class="member-card__row">
          <span class="member-card__row-label">住所</span>
          <span class="member-card__row-value">${address}</span>
        </div>
      </div>
    </div>
  `;
}


/**
 * 連絡先（メール・電話）表示を作る。
 * どちらも未登録の場合のみ「未登録」を表示する。
 *
 * @param {Object} item
 * @return {string}
 */
function renderContact_(item) {
  const email =
    String(item.email || '').trim();

  const phone =
    String(item.phone || '').trim();

  if (!email && !phone) {
    return '<span class="members-muted">未登録</span>';
  }

  return [
    email
      ? `<span class="members-contact__email">${esc(email)}</span>`
      : '',
    phone
      ? `<span class="members-contact__phone">${esc(phone)}</span>`
      : ''
  ]
    .filter(Boolean)
    .join('');
}


/**
 * 住所表示を作る。
 *
 * @param {Object} item
 * @return {string}
 */
function renderAddress_(item) {
  const postalCode =
    String(item.postalCode || '').trim();

  const address =
    String(item.address || '').trim();

  if (!postalCode && !address) {
    return '<span class="members-muted">未登録</span>';
  }

  const parts = [];

  if (postalCode) {
    parts.push('〒' + postalCode);
  }

  if (address) {
    parts.push(address);
  }

  return esc(parts.join(' '));
}


/**
 * エラー表示を作る。
 *
 * @param {*} error
 * @return {string}
 */
function renderError_(error) {
  const message =
    (error && error.message) ||
    '会員・請求先一覧の読み込みに失敗しました。';

  return `
    <div class="members-view">
      <div class="c-alert c-alert--danger members-error">
        ${esc(message)}
      </div>
    </div>
  `;
}


/**
 * 請求先種別の表示名。
 *
 * @param {*} sourceType
 * @return {string}
 */
function getSourceTypeLabel_(sourceType) {
  const value =
    String(sourceType || '');

  if (value === 'member') {
    return '会員';
  }

  if (
    value === 'other' ||
    value === 'otherPayee'
  ) {
    return 'その他請求先';
  }

  return value || '―';
}


/**
 * 状態の表示名。
 * 既存データの値をそのまま使い、勝手な名称変更はしない。
 * 唯一「active」だけ分かりやすく「有効」と表示する。
 *
 * @param {*} status
 * @return {string}
 */
function getStatusLabel_(status) {
  const value =
    String(status || '');

  if (value.toLowerCase() === 'active') {
    return '有効';
  }

  return value || '未設定';
}


/**
 * 状態バッジの見た目クラス。
 *
 * @param {*} status
 * @return {string}
 */
function getStatusClass_(status) {
  const value =
    String(status || '').toLowerCase();

  if (value === 'active') {
    return 'members-status--active';
  }

  if (!value) {
    return 'members-status--unknown';
  }

  return 'members-status--inactive';
}


/**
 * HTML属性値用エスケープ。
 *
 * @param {*} value
 * @return {string}
 */
function escapeAttr_(value) {
  return esc(value)
    .replace(
      /`/g,
      '&#96;'
    );
}
