import { api } from '../assets/js/api.js';
import { esc } from '../assets/js/components.js';

let currentItems = [];
let searchTerm = '';
let memberTypeFilter = 'all';
let statusFilter = 'all';
let masterData = null;
let escapeHandlerBound = false;

/**
 * 現在表示中のタブ。'members'（会員・団体）| 'other'（会員外の請求先）。
 * ページ内状態としてのみ保持し、URLやページ再読み込みには持ち越さない。
 */
let activeTab = 'members';


/**
 * 団体編集モーダルで表示中の「年度別会員数」の状態。
 * { organizationId: string, data: Object|null } または null（会員編集時など）。
 * data.historyには対象団体の全年度分の履歴が含まれるため、
 * 対象年度セレクトの切り替えはAPIを呼び直さずこの中から算出する。
 */
let organizationCountState_ = null;


/**
 * 会員区分コード → 表示名（getMemberManagementMasterが取得できない場合のフォールバック）。
 * Apps Script側のmemberTypeLabel_と同じ対応表。
 */
const MEMBER_TYPE_LABELS_ = {
  special_regular: '特別正会員',
  organization: '団体会員',
  regular: '正会員',
  student: '学生会員',
  senior_executive: 'シニアエグゼクティブ会員',
  supporting: '賛助会員',
  honorary: '名誉会員'
};


/** 変更履歴のaction → 表示名。 */
const ACTION_LABELS_ = {
  'member.create': '会員登録',
  'member.update': '会員情報更新',
  'member.withdraw': '退会処理',
  'organization.create': '団体登録',
  'organization.update': '団体情報更新',
  'organization.withdraw': '退会処理',
  'payee.create': '請求先登録',
  'payee.update': '請求先情報更新'
};


/** 変更履歴の差分表示から除外するフィールド（毎回変わる/内部用のため）。 */
const HISTORY_IGNORE_KEYS_ = [
  'created_at',
  'updated_at',
  'member_id',
  'organization_id',
  '_rowNumber'
];


/** フィールド名 → 表示ラベル（Members/Organizations両方の列を含む）。 */
const FIELD_LABELS_ = {
  member_number: '会員番号',
  name: '氏名',
  member_type: '会員区分',
  postal_code: '郵便番号',
  address: '住所',
  phone: '電話番号',
  email: 'メール',
  line_send_allowed: 'LINE送付可否',
  joined_at: '入会日',
  resigned_at: '退会日',
  membership_status: '会員状態',
  annual_fee_override: '年会費個別設定',
  fee_exempt: '会費免除',
  invoice_target: '年会費請求対象',
  remarks: '備考',
  company_name: '会社名',
  department: '部署',
  position: '役職',
  company_postal_code: '会社郵便番号',
  company_address: '会社住所',
  company_phone: '会社電話番号',
  company_email: '会社メール',
  billing_source_type: '請求先区分',
  billing_source_id: '請求先ID',
  organization_number: '団体番号',
  organization_name: '会社名・団体名',
  representative_name: '代表者名',
  contact_name: '担当者名',
  corporate_number: '法人番号',
  contact_department: '担当部署',
  contact_position: '担当者役職',
  payee_type: '請求先種別'
};


/**
 * 会員・請求先一覧を表示する。
 *
 * @return {Promise<string>}
 */
export async function render() {
  searchTerm = '';
  memberTypeFilter = 'all';
  statusFilter = 'all';
  activeTab = 'members';

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

  try {
    masterData = await api('getMemberManagementMaster');
  } catch (error) {
    masterData = { feeTypes: [], fiscalYear: null };
  }

  return `
    <div class="members-view">
      <div class="members-intro">
        <p class="members-intro__text">
          会員情報と請求先情報を確認できます。
        </p>

        <div class="members-intro__actions" id="members-intro-actions">
          ${renderIntroActions_()}
        </div>
      </div>

      <div id="members-banner"></div>

      <div
        class="members-tabs"
        role="tablist"
        aria-label="会員・請求先の種別"
      >
        ${renderTabButtons_()}
      </div>

      <div
        id="members-panel"
        role="tabpanel"
        tabindex="0"
        aria-labelledby="${activeTab === 'other' ? 'members-tab-other' : 'members-tab-members'}"
      >
        ${renderPanel_()}
      </div>

      <div id="member-modal-root"></div>
    </div>
  `;
}


/**
 * タブボタン（会員・団体／会員外の請求先）を作る。
 * 件数はcurrentItems全体から算出する登録総数で、検索・絞り込みの影響は受けない。
 *
 * @return {string}
 */
function renderTabButtons_() {
  const memberCount =
    currentItems.filter(function (item) {
      return matchesTab_('members', item);
    }).length;

  const otherCount =
    currentItems.filter(function (item) {
      return matchesTab_('other', item);
    }).length;

  return `
    <button
      type="button"
      role="tab"
      id="members-tab-members"
      class="members-tab"
      data-tab="members"
      aria-selected="${activeTab === 'members' ? 'true' : 'false'}"
      aria-controls="members-panel"
    >
      会員・団体
      <span class="members-tab__count">${memberCount}件</span>
    </button>

    <button
      type="button"
      role="tab"
      id="members-tab-other"
      class="members-tab"
      data-tab="other"
      aria-selected="${activeTab === 'other' ? 'true' : 'false'}"
      aria-controls="members-panel"
    >
      会員外の請求先
      <span class="members-tab__count">${otherCount}件</span>
    </button>
  `;
}


/**
 * タブに応じた右上の登録ボタンを作る。
 *
 * @return {string}
 */
function renderIntroActions_() {
  if (activeTab === 'other') {
    return `
      <button type="button" class="btn primary" id="other-payee-add">
        ＋ 会員外の請求先を登録
      </button>
    `;
  }

  return `
    <button type="button" class="btn primary" id="member-add">
      ＋ 会員を登録
    </button>

    <button type="button" class="btn primary" id="organization-add">
      ＋ 団体を登録
    </button>
  `;
}


/**
 * タブ内のツールバー・件数・一覧をまとめて作る。
 * タブ切替時（見出し列が変わるため）にまるごと再描画する。
 * 検索語・絞り込みの変更時はrefreshList_で一覧部分だけを更新するため
 * こちらは呼ばない。
 *
 * @return {string}
 */
function renderPanel_() {
  const filteredItems = getFilteredItems_();

  return `
    <div class="members-toolbar">
      <div class="members-toolbar__filters">
        <input
          id="member-q"
          type="search"
          class="c-input members-search"
          placeholder="${escapeAttr_(getSearchPlaceholder_())}"
          value="${escapeAttr_(searchTerm)}"
        >

        ${
          activeTab === 'members'
            ? `
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
            `
            : ''
        }
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

    ${
      activeTab === 'other'
        ? renderOtherPayeeList_(filteredItems)
        : renderMemberList_(filteredItems)
    }
  `;
}


/**
 * 「会員・団体」タブの一覧（PCテーブル＋モバイルカード）を作る。
 *
 * @param {Array} filteredItems
 * @return {string}
 */
function renderMemberList_(filteredItems) {
  return `
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
            <th class="members-table__actions">操作</th>
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
  `;
}


/**
 * 「会員外の請求先」タブの一覧（PCテーブル＋モバイルカード）を作る。
 *
 * @param {Array} filteredItems
 * @return {string}
 */
function renderOtherPayeeList_(filteredItems) {
  return `
    <div class="members-desktop table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>請求先名</th>
            <th>請求先種別</th>
            <th>担当者名</th>
            <th>電話番号</th>
            <th>メールアドレス</th>
            <th class="members-table__actions">操作</th>
          </tr>
        </thead>

        <tbody id="member-body">
          ${renderOtherPayeeRows_(filteredItems)}
        </tbody>
      </table>
    </div>

    <div class="members-mobile">
      <div id="member-cards">
        ${renderOtherPayeeCards_(filteredItems)}
      </div>
    </div>
  `;
}


/**
 * タブ切替時の検索欄プレースホルダー。
 *
 * @return {string}
 */
function getSearchPlaceholder_() {
  if (activeTab === 'other') {
    return '請求先名・担当者名・住所・電話番号・メールで検索';
  }

  return '氏名・団体名・会員区分・連絡先で検索';
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
      itemMatchesTab_(item) &&
      itemMatchesSearch_(item, term) &&
      itemMatchesMemberType_(item) &&
      itemMatchesStatus_(item)
    );
  });
}


/**
 * 指定タブの表示対象か判定する。
 * sourceType==='other'/'otherPayee'は「会員外の請求先」タブ、
 * 'member'/'organization'は「会員・団体」タブとして扱う。
 *
 * @param {string} tab 'members' | 'other'
 * @param {Object} item
 * @return {boolean}
 */
function matchesTab_(tab, item) {
  const sourceType = String(item.sourceType || '');

  if (tab === 'other') {
    return sourceType === 'other' || sourceType === 'otherPayee';
  }

  return sourceType === 'member' || sourceType === 'organization';
}


/**
 * 現在アクティブなタブの表示対象か判定する。
 *
 * @param {Object} item
 * @return {boolean}
 */
function itemMatchesTab_(item) {
  return matchesTab_(activeTab, item);
}


/**
 * 検索語に一致するか判定する。タブごとに検索対象フィールドが異なる。
 *
 * 「会員・団体」タブ：氏名/団体名・電話・メール・会員区分・種別
 * （バックエンドのkeyword検索と同じ対象フィールド）。
 *
 * 「会員外の請求先」タブ：請求先名・担当者名・郵便番号・住所・電話番号・
 * メールアドレス・請求先種別・備考。ただし現在のlistPayees応答には
 * contact_name/remarksが含まれないため、この2項目は実データがある限り
 * 一致しない（詳細画面で取得するgetPayeeDetailには含まれる）。
 *
 * @param {Object} item
 * @param {string} term
 * @return {boolean}
 */
function itemMatchesSearch_(item, term) {
  if (!term) {
    return true;
  }

  const fields =
    activeTab === 'other'
      ? [
          item.name,
          item.contactName,
          item.postalCode,
          item.address,
          item.phone,
          item.email,
          item.memberType,
          item.remarks
        ]
      : [
          item.name,
          item.phone,
          item.email,
          item.memberType,
          item.sourceType
        ];

  const haystack =
    fields
      .map(function (value) {
        return String(value || '').toLowerCase();
      })
      .join(' ');

  return haystack.indexOf(term) >= 0;
}


/**
 * 会員区分フィルターに一致するか判定する。
 * 「会員外の請求先」タブでは会員区分フィルター自体を表示しないため、
 * 常にtrueを返す。
 *
 * @param {Object} item
 * @return {boolean}
 */
function itemMatchesMemberType_(item) {
  if (activeTab !== 'members') {
    return true;
  }

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
 * 「会員外の請求先」タブでは会員状態フィルター自体を表示しないため、
 * 常にtrueを返す。
 *
 * @param {Object} item
 * @return {boolean}
 */
function itemMatchesStatus_(item) {
  if (activeTab !== 'members') {
    return true;
  }

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
          .filter(itemMatchesTab_)
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
          .filter(itemMatchesTab_)
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
  const total = currentItems.filter(itemMatchesTab_).length;
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
      activeTab === 'other'
        ? renderOtherPayeeRows_(filteredItems)
        : renderRows_(filteredItems);
  }

  const cardList =
    document.querySelector('#member-cards');

  if (cardList) {
    cardList.innerHTML =
      activeTab === 'other'
        ? renderOtherPayeeCards_(filteredItems)
        : renderCards_(filteredItems);
  }

  const countEl =
    document.querySelector('#members-count');

  if (countEl) {
    countEl.textContent =
      getCountLabel_(filteredItems);
  }
}


/**
 * タブ切替・検索条件クリア時に、ツールバー・件数・一覧を含む
 * パネル全体を再描画する（見出し列がタブごとに異なるため）。
 */
function renderPanelInPlace_() {
  const panelEl =
    document.querySelector('#members-panel');

  if (panelEl) {
    panelEl.innerHTML = renderPanel_();
  }
}


/**
 * タブを切り替える。検索語・絞り込み条件はタブごとにリセットする。
 *
 * @param {string} tab 'members' | 'other'
 */
function switchTab_(tab) {
  if (tab !== 'members' && tab !== 'other') {
    return;
  }

  if (tab === activeTab) {
    return;
  }

  activeTab = tab;
  searchTerm = '';
  memberTypeFilter = 'all';
  statusFilter = 'all';

  const tabsEl =
    document.querySelector('.members-tabs');

  if (tabsEl) {
    tabsEl.innerHTML = renderTabButtons_();
  }

  const actionsEl =
    document.querySelector('#members-intro-actions');

  if (actionsEl) {
    actionsEl.innerHTML = renderIntroActions_();
  }

  const panelEl =
    document.querySelector('#members-panel');

  if (panelEl) {
    panelEl.setAttribute(
      'aria-labelledby',
      activeTab === 'other' ? 'members-tab-other' : 'members-tab-members'
    );

    panelEl.innerHTML = renderPanel_();
  }
}


/**
 * 一覧をAPIから再取得し、現在の検索・フィルター条件を保ったまま再描画する。
 * 登録・編集・退会の成功後に呼び出す。
 */
async function reloadItems_() {
  try {
    const data = await api(
      'listPayees',
      {
        type: 'all',
        status: 'all'
      }
    );

    currentItems = data.items || [];

  } catch (error) {
    showBanner_(
      'danger',
      (error && error.message) ||
        '一覧の再取得に失敗しました。'
    );
    return;
  }

  const tabsEl =
    document.querySelector('.members-tabs');

  if (tabsEl) {
    tabsEl.innerHTML = renderTabButtons_();
  }

  refreshList_();
}


/**
 * 画面イベントを設定する。
 */
export function bind() {
  const view =
    document.querySelector('.members-view');

  if (!view) {
    ensureEscapeHandlerBound_();
    return;
  }

  // タブ切替でツールバー・一覧のDOMごと再生成するため、
  // 入力欄・セレクト・ボタンは個別要素ではなく.members-view単位で
  // イベント委譲する（input/change/clickはすべてバブリングする）。

  view.addEventListener(
    'input',
    function (event) {
      if (event.target && event.target.id === 'member-q') {
        searchTerm = event.target.value || '';
        refreshList_();
      }
    }
  );

  view.addEventListener(
    'change',
    function (event) {
      if (!event.target) {
        return;
      }

      if (event.target.id === 'member-type-filter') {
        memberTypeFilter = event.target.value || 'all';
        refreshList_();
        return;
      }

      if (event.target.id === 'member-status-filter') {
        statusFilter = event.target.value || 'all';
        refreshList_();
      }
    }
  );

  view.addEventListener(
    'click',
    function (event) {
      const tabButton =
        event.target.closest('.members-tab');

      if (tabButton) {
        switchTab_(tabButton.dataset.tab || '');
        return;
      }

      if (event.target.closest('#member-search')) {
        const searchInput =
          document.querySelector('#member-q');

        searchTerm =
          searchInput ? (searchInput.value || '') : '';

        refreshList_();
        return;
      }

      if (event.target.closest('#member-add')) {
        clearBanner_();
        openMemberForm_('member', null, null);
        return;
      }

      if (event.target.closest('#organization-add')) {
        clearBanner_();
        openMemberForm_('organization', null, null);
        return;
      }

      if (event.target.closest('#other-payee-add')) {
        clearBanner_();
        openOtherPayeeForm_(null);
        return;
      }

      const clearButton =
        event.target.closest(
          '.members-clear'
        );

      if (clearButton) {
        searchTerm = '';
        memberTypeFilter = 'all';
        statusFilter = 'all';
        renderPanelInPlace_();
        return;
      }

      const actionButton =
        event.target.closest(
          '[data-member-action]'
        );

      if (!actionButton) {
        return;
      }

      const action =
        actionButton.dataset.memberAction;

      const sourceType =
        actionButton.dataset.sourceType || '';

      const id =
        actionButton.dataset.id || '';

      if (action === 'detail') {
        clearBanner_();
        openDetailModal_(sourceType, id);

      } else if (action === 'edit') {
        clearBanner_();
        openEditModal_(sourceType, id);

      } else if (action === 'edit-other') {
        clearBanner_();
        openOtherPayeeForm_(id);

      } else if (action === 'withdraw') {
        clearBanner_();
        openWithdrawModal_(
          sourceType,
          id,
          actionButton.dataset.name || ''
        );
      }
    }
  );

  ensureEscapeHandlerBound_();
}


/**
 * Escapeキーでモーダルを閉じるハンドラーを一度だけ登録する。
 * bind()は画面遷移のたびに呼ばれるため、多重登録を避ける。
 */
function ensureEscapeHandlerBound_() {
  if (escapeHandlerBound) {
    return;
  }

  escapeHandlerBound = true;

  document.addEventListener(
    'keydown',
    function (event) {
      if (event.key === 'Escape') {
        closeModal_();
      }
    }
  );
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
  if (!currentItems.filter(itemMatchesTab_).length) {
    return `
      <tr>
        <td
          colspan="7"
          class="members-empty"
        >
          会員・団体はまだ登録されていません。
        </td>
      </tr>
    `;
  }

  if (!items.length) {
    return `
      <tr>
        <td
          colspan="7"
          class="members-empty"
        >
          <p>条件に一致する会員・団体がありません。</p>

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

      <td data-label="操作" class="members-table__actions">
        ${renderRowActions_(item)}
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
  if (!currentItems.filter(itemMatchesTab_).length) {
    return `
      <div class="members-empty">
        会員・団体はまだ登録されていません。
      </div>
    `;
  }

  if (!items.length) {
    return `
      <div class="members-empty">
        <p>条件に一致する会員・団体がありません。</p>

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
 * 「会員外の請求先」タブの一覧行（PCテーブル）を作る。
 *
 * @param {Array} items
 * @return {string}
 */
function renderOtherPayeeRows_(items) {
  if (!currentItems.filter(itemMatchesTab_).length) {
    return `
      <tr>
        <td colspan="6" class="members-empty">
          会員外の請求先はまだ登録されていません。
        </td>
      </tr>
    `;
  }

  if (!items.length) {
    return `
      <tr>
        <td colspan="6" class="members-empty">
          <p>条件に一致する会員外の請求先がありません。</p>

          <button type="button" class="btn members-clear">
            検索条件をクリア
          </button>
        </td>
      </tr>
    `;
  }

  return items
    .map(function (item) {
      return renderOtherPayeeRow_(item);
    })
    .join('');
}


/**
 * 会員外の請求先1件分の行を作る。
 * 退会・削除ボタンは表示しない（OtherPayeesには論理削除の概念がないため）。
 *
 * @param {Object} item
 * @return {string}
 */
function renderOtherPayeeRow_(item) {
  const contactName = String(item.contactName || '').trim();
  const phone = String(item.phone || '').trim();
  const email = String(item.email || '').trim();
  const id = String(item.id || '');

  return `
    <tr class="member-row">
      <td data-label="請求先名" class="members-table__name">
        ${esc(item.name || '')}
      </td>

      <td data-label="請求先種別">
        ${
          item.memberType
            ? `<span class="c-badge members-badge">${esc(item.memberType)}</span>`
            : '―'
        }
      </td>

      <td data-label="担当者名">
        ${
          contactName
            ? esc(contactName)
            : '<span class="members-muted">未登録</span>'
        }
      </td>

      <td data-label="電話番号" class="members-table__contact">
        ${
          phone
            ? `<span class="members-contact__phone">${esc(phone)}</span>`
            : '<span class="members-muted">未登録</span>'
        }
      </td>

      <td data-label="メールアドレス" class="members-table__contact">
        ${
          email
            ? `<span class="members-contact__email">${esc(email)}</span>`
            : '<span class="members-muted">未登録</span>'
        }
      </td>

      <td data-label="操作" class="members-table__actions">
        <div class="member-row-actions">
          <button
            type="button"
            class="btn"
            data-member-action="detail"
            data-source-type="other"
            data-id="${escapeAttr_(id)}"
          >
            詳細
          </button>

          <button
            type="button"
            class="btn"
            data-member-action="edit-other"
            data-source-type="other"
            data-id="${escapeAttr_(id)}"
          >
            編集
          </button>
        </div>
      </td>
    </tr>
  `;
}


/**
 * 「会員外の請求先」タブのモバイルカード一覧を作る。
 *
 * @param {Array} items
 * @return {string}
 */
function renderOtherPayeeCards_(items) {
  if (!currentItems.filter(itemMatchesTab_).length) {
    return `
      <div class="members-empty">
        会員外の請求先はまだ登録されていません。
      </div>
    `;
  }

  if (!items.length) {
    return `
      <div class="members-empty">
        <p>条件に一致する会員外の請求先がありません。</p>

        <button type="button" class="btn members-clear">
          検索条件をクリア
        </button>
      </div>
    `;
  }

  return items
    .map(function (item) {
      return renderOtherPayeeCard_(item);
    })
    .join('');
}


/**
 * 会員外の請求先1件分のモバイルカードを作る。
 * 退会・削除ボタンは表示しない。
 *
 * @param {Object} item
 * @return {string}
 */
function renderOtherPayeeCard_(item) {
  const contactName = String(item.contactName || '').trim();
  const phone = String(item.phone || '').trim();
  const email = String(item.email || '').trim();
  const id = String(item.id || '');

  return `
    <div class="member-card">
      <div class="member-card__header">
        <div class="member-card__name">
          ${esc(item.name || '')}
        </div>
      </div>

      <div class="member-card__badges">
        <span class="c-badge members-badge">その他請求先</span>
        ${
          item.memberType
            ? `<span class="c-badge members-badge">${esc(item.memberType)}</span>`
            : ''
        }
      </div>

      <div class="member-card__details">
        <div class="member-card__row">
          <span class="member-card__row-label">担当者</span>
          <span class="member-card__row-value">
            ${
              contactName
                ? esc(contactName)
                : '<span class="members-muted">未登録</span>'
            }
          </span>
        </div>

        <div class="member-card__row">
          <span class="member-card__row-label">電話</span>
          <span class="member-card__row-value">
            ${
              phone
                ? esc(phone)
                : '<span class="members-muted">未登録</span>'
            }
          </span>
        </div>

        <div class="member-card__row">
          <span class="member-card__row-label">メール</span>
          <span class="member-card__row-value">
            ${
              email
                ? esc(email)
                : '<span class="members-muted">未登録</span>'
            }
          </span>
        </div>
      </div>

      <div class="member-card__actions">
        <button
          type="button"
          class="btn"
          data-member-action="detail"
          data-source-type="other"
          data-id="${escapeAttr_(id)}"
        >
          詳細
        </button>

        <button
          type="button"
          class="btn"
          data-member-action="edit-other"
          data-source-type="other"
          data-id="${escapeAttr_(id)}"
        >
          編集
        </button>
      </div>
    </div>
  `;
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

      <div class="member-card__actions">
        ${renderRowActions_(item)}
      </div>
    </div>
  `;
}


/**
 * 一覧行・カード共通の操作ボタン（詳細／編集／退会）を作る。
 * その他請求先(other)は会員・団体ではないため詳細のみとする。
 * 退会済み(inactive)の場合は退会ボタンの代わりに状態ラベルを出す。
 *
 * @param {Object} item
 * @return {string}
 */
function renderRowActions_(item) {
  const sourceType =
    String(item.sourceType || '');

  const id =
    String(item.id || '');

  if (sourceType !== 'member' && sourceType !== 'organization') {
    return `
      <div class="member-row-actions">
        <button
          type="button"
          class="btn"
          data-member-action="detail"
          data-source-type="${escapeAttr_(sourceType)}"
          data-id="${escapeAttr_(id)}"
        >
          詳細
        </button>
      </div>
    `;
  }

  const withdrawn =
    isWithdrawnStatus_(item.status);

  return `
    <div class="member-row-actions">
      <button
        type="button"
        class="btn"
        data-member-action="detail"
        data-source-type="${escapeAttr_(sourceType)}"
        data-id="${escapeAttr_(id)}"
      >
        詳細
      </button>

      <button
        type="button"
        class="btn"
        data-member-action="edit"
        data-source-type="${escapeAttr_(sourceType)}"
        data-id="${escapeAttr_(id)}"
      >
        編集
      </button>

      ${
        withdrawn
          ? '<span class="member-row-withdrawn">退会済み</span>'
          : `
            <button
              type="button"
              class="btn btn--danger"
              data-member-action="withdraw"
              data-source-type="${escapeAttr_(sourceType)}"
              data-id="${escapeAttr_(id)}"
              data-name="${escapeAttr_(item.name || '')}"
            >
              退会
            </button>
          `
      }
    </div>
  `;
}


/**
 * membership_statusが退会済み(inactive)かどうか判定する。
 *
 * @param {*} status
 * @return {boolean}
 */
function isWithdrawnStatus_(status) {
  return (
    String(status || '').trim().toLowerCase() ===
    'inactive'
  );
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

  if (value === 'organization') {
    return '団体';
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
 * membership_statusの正式な値はactive/inactiveのみだが、
 * それ以外の値が入っていても生値を安全に表示する。
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

  if (value.toLowerCase() === 'inactive') {
    return '退会';
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


/* ==========================================================================
   バナー表示（一覧上部の成功／エラーメッセージ）
   ========================================================================== */

/**
 * 一覧上部のバナーを表示する。type/textを省略すると消去する。
 *
 * @param {string} type 'success' | 'danger'
 * @param {string} text
 */
function showBanner_(type, text) {
  const el =
    document.querySelector('#members-banner');

  if (!el) {
    return;
  }

  if (!type || !text) {
    el.innerHTML = '';
    return;
  }

  const cssClass =
    type === 'success'
      ? 'c-alert--success'
      : 'c-alert--danger';

  el.innerHTML = `
    <div class="c-alert ${cssClass} members-banner">
      ${esc(text)}
    </div>
  `;
}


function clearBanner_() {
  showBanner_(null, null);
}


/* ==========================================================================
   共通モーダル基盤
   ========================================================================== */

/**
 * モーダルの外枠（オーバーレイ・ヘッダー・本文・フッター）を描画する。
 * bodyHtmlとoptions.footerの中身の後付けイベント登録は呼び出し側で行う。
 *
 * @param {string} bodyHtml
 * @param {{title:string, subtitle?:string, footer?:string, wide?:boolean, ariaLabel?:string}} options
 * @return {HTMLElement|null} .c-modal要素
 */
function openModalShell_(bodyHtml, options) {
  const root =
    document.querySelector('#member-modal-root');

  if (!root) {
    return null;
  }

  const opts = options || {};
  const wideClass = opts.wide ? ' c-modal--wide' : '';

  root.innerHTML = `
    <div class="c-modal-overlay" id="member-modal-overlay">
      <div
        class="c-modal${wideClass}"
        role="dialog"
        aria-modal="true"
        aria-label="${escapeAttr_(opts.ariaLabel || opts.title || '')}"
      >
        <div class="c-modal__header">
          <div class="c-modal__heading">
            <div class="c-modal__title">${esc(opts.title || '')}</div>
            ${
              opts.subtitle
                ? `<div class="c-modal__subtitle">${esc(opts.subtitle)}</div>`
                : ''
            }
          </div>

          <button
            type="button"
            class="c-modal__close"
            id="member-modal-close"
            aria-label="閉じる"
          >
            ×
          </button>
        </div>

        <div class="c-modal__body">
          ${bodyHtml}
        </div>

        ${
          opts.footer
            ? `<div class="c-modal__footer">${opts.footer}</div>`
            : ''
        }
      </div>
    </div>
  `;

  const overlay =
    document.querySelector('#member-modal-overlay');

  const closeButton =
    document.querySelector('#member-modal-close');

  if (overlay) {
    overlay.addEventListener(
      'click',
      function (event) {
        if (event.target === overlay) {
          closeModal_();
        }
      }
    );
  }

  if (closeButton) {
    closeButton.addEventListener(
      'click',
      function () {
        closeModal_();
      }
    );
  }

  return document.querySelector('#member-modal-root .c-modal');
}


/**
 * 開いているモーダルを閉じる。モーダルが無い場合は何もしない。
 */
function closeModal_() {
  const root =
    document.querySelector('#member-modal-root');

  if (root) {
    root.innerHTML = '';
  }

  organizationCountState_ = null;
}


/**
 * モーダル本文をエラー表示に差し替える（詳細モーダルの読み込み失敗時用）。
 *
 * @param {string} message
 */
function renderModalBodyError_(message) {
  const bodyEl =
    document.querySelector(
      '#member-modal-root .c-modal__body'
    );

  if (bodyEl) {
    bodyEl.innerHTML = `
      <div class="c-alert c-alert--danger">
        ${esc(message)}
      </div>
    `;
  }
}


/* ==========================================================================
   新規登録・編集モーダル
   ========================================================================== */

/**
 * 会員・団体の詳細を取得し、編集モーダルを開く。
 *
 * @param {string} sourceType 'member' | 'organization'
 * @param {string} id
 */
async function openEditModal_(sourceType, id) {
  let record;

  try {
    record = await api(
      'getPayeeDetail',
      { sourceType, sourceId: id }
    );

  } catch (error) {
    showBanner_(
      'danger',
      (error && error.message) ||
        'データの取得に失敗しました。'
    );
    return;
  }

  if (!record) {
    showBanner_(
      'danger',
      '対象のデータが見つかりませんでした。'
    );
    return;
  }

  let otherPayeeRecord = null;

  if (
    String(record.billing_source_type) === 'other' &&
    record.billing_source_id
  ) {
    try {
      otherPayeeRecord = await api(
        'getPayeeDetail',
        {
          sourceType: 'other',
          sourceId: record.billing_source_id
        }
      );
    } catch (error) {
      otherPayeeRecord = null;
    }
  }

  organizationCountState_ = null;

  if (sourceType === 'organization') {
    let memberCountsData = null;

    try {
      memberCountsData = await api(
        'getOrganizationMemberCounts',
        {
          organizationId: id,
          fiscalYear:
            (masterData && masterData.fiscalYear) ||
            new Date().getFullYear()
        }
      );
    } catch (error) {
      memberCountsData = null;
    }

    organizationCountState_ = {
      organizationId: id,
      data: memberCountsData
    };
  }

  openMemberForm_(sourceType, record, otherPayeeRecord);
}


/**
 * 登録・編集フォームのモーダルを開く。
 *
 * @param {string} initialType 'member' | 'organization'
 * @param {Object|null} record 編集対象（新規時はnull）
 * @param {Object|null} otherPayeeRecord 既存の別請求先（あれば）
 */
function openMemberForm_(initialType, record, otherPayeeRecord) {
  const isEdit = Boolean(record);

  const title =
    isEdit
      ? (
        initialType === 'organization'
          ? '法人・団体会員を編集'
          : '個人会員を編集'
      )
      : '会員を追加';

  const bodyHtml = `
    <div id="member-form-message"></div>

    <form id="member-form" novalidate>
      ${
        isEdit
          ? ''
          : `
            <div
              class="member-form-type"
              id="member-form-type"
              role="radiogroup"
              aria-label="登録種別"
            >
              <label class="member-form-type__option${initialType === 'member' ? ' is-selected' : ''}">
                <input
                  type="radio"
                  name="member-form-entity-type"
                  value="member"
                  ${initialType === 'member' ? 'checked' : ''}
                >
                個人会員
              </label>

              <label class="member-form-type__option${initialType === 'organization' ? ' is-selected' : ''}">
                <input
                  type="radio"
                  name="member-form-entity-type"
                  value="organization"
                  ${initialType === 'organization' ? 'checked' : ''}
                >
                法人・団体会員
              </label>
            </div>
          `
      }

      <div id="member-form-fields"></div>
    </form>
  `;

  const footerHtml = `
    <button type="button" class="btn" id="member-form-cancel">
      キャンセル
    </button>

    <button
      type="submit"
      form="member-form"
      class="btn primary"
      id="member-form-submit"
    >
      保存する
    </button>
  `;

  openModalShell_(
    bodyHtml,
    {
      title,
      ariaLabel: title,
      footer: footerHtml
    }
  );

  const cancelButton =
    document.querySelector('#member-form-cancel');

  if (cancelButton) {
    cancelButton.addEventListener(
      'click',
      function () {
        closeModal_();
      }
    );
  }

  const fieldsContainer =
    document.querySelector('#member-form-fields');

  let currentType = initialType;

  function renderFields(type) {
    if (!fieldsContainer) {
      return;
    }

    fieldsContainer.innerHTML =
      renderMemberFormFields_(
        type,
        record,
        otherPayeeRecord
      );

    bindBillingToggle_(fieldsContainer);
    bindOrganizationMemberCountSection_(fieldsContainer);
  }

  renderFields(currentType);

  if (!isEdit) {
    const typeRadios =
      document.querySelectorAll(
        'input[name="member-form-entity-type"]'
      );

    typeRadios.forEach(function (radio) {
      radio.addEventListener(
        'change',
        function () {
          currentType = radio.value;

          document
            .querySelectorAll('.member-form-type__option')
            .forEach(function (option) {
              const optionInput =
                option.querySelector('input');

              option.classList.toggle(
                'is-selected',
                Boolean(optionInput) &&
                  optionInput.value === currentType
              );
            });

          renderFields(currentType);
        }
      );
    });
  }

  const form =
    document.querySelector('#member-form');

  if (form) {
    form.addEventListener(
      'submit',
      async function (event) {
        event.preventDefault();
        await submitMemberForm_(
          currentType,
          record,
          otherPayeeRecord
        );
      }
    );
  }
}


/**
 * 種別に応じたフォーム項目一式（基本情報＋所属先情報＋請求先）を作る。
 *
 * @param {string} type
 * @param {Object|null} record
 * @param {Object|null} otherPayeeRecord
 * @return {string}
 */
function renderMemberFormFields_(type, record, otherPayeeRecord) {
  if (type === 'organization') {
    return renderOrganizationFields_(record, otherPayeeRecord);
  }

  return renderMemberFields_(record, otherPayeeRecord);
}


/**
 * 個人会員フォームの項目一式を作る。
 *
 * @param {Object|null} record
 * @param {Object|null} otherPayeeRecord
 * @return {string}
 */
function renderMemberFields_(record, otherPayeeRecord) {
  const r = record || {};
  const isEdit = Boolean(record);
  const feeTypeOptions = getMemberTypeOptions_();

  return `
    <div class="member-form-section">
      <div class="member-form-section__title">基本情報</div>

      <div class="member-form-grid">
        <div class="member-form-field">
          <label class="member-form-field__label">
            会員番号
          </label>
          ${
            isEdit
              ? `
                <div class="member-form-static">${esc(r.member_number || '')}</div>
                <p class="member-form-field__hint">会員番号は変更できません</p>
              `
              : `<div class="member-form-static">保存時に自動発行されます</div>`
          }
        </div>

        <div class="member-form-field">
          <label class="member-form-field__label" for="mf-member-type">
            会員区分<span class="member-required">必須</span>
          </label>
          <select id="mf-member-type" class="c-select">
            <option value="">選択してください</option>
            ${
              feeTypeOptions
                .map(function (option) {
                  return `
                    <option
                      value="${escapeAttr_(option.code)}"
                      ${String(r.member_type || '') === String(option.code) ? 'selected' : ''}
                    >
                      ${esc(option.label)}
                    </option>
                  `;
                })
                .join('')
            }
          </select>
        </div>

        <div class="member-form-field member-form-field--wide">
          <label class="member-form-field__label" for="mf-name">
            氏名<span class="member-required">必須</span>
          </label>
          <input id="mf-name" class="c-input" value="${escapeAttr_(r.name || '')}">
        </div>

        <div class="member-form-field">
          <label class="member-form-field__label" for="mf-postal-code">
            郵便番号
          </label>
          <input id="mf-postal-code" type="text" inputmode="numeric" class="c-input" value="${escapeAttr_(String(r.postal_code || ''))}">
        </div>

        <div class="member-form-field">
          <label class="member-form-field__label" for="mf-phone">
            電話番号
          </label>
          <input id="mf-phone" type="tel" inputmode="tel" class="c-input" value="${escapeAttr_(String(r.phone || ''))}">
        </div>

        <div class="member-form-field member-form-field--wide">
          <label class="member-form-field__label" for="mf-address">
            住所
          </label>
          <input id="mf-address" class="c-input" value="${escapeAttr_(r.address || '')}">
        </div>

        <div class="member-form-field">
          <label class="member-form-field__label" for="mf-email">
            メール
          </label>
          <input id="mf-email" type="email" class="c-input" value="${escapeAttr_(r.email || '')}">
        </div>

        <div class="member-form-field">
          <label class="member-form-field__label" for="mf-joined-at">
            入会日
          </label>
          <input id="mf-joined-at" type="date" class="c-input" value="${escapeAttr_(toDateInputValue_(r.joined_at))}">
        </div>

        <div class="member-form-field">
          <label class="member-form-field__label" for="mf-invoice-target">
            年会費請求対象
          </label>
          ${boolSelectHtml_('mf-invoice-target', r.invoice_target, '対象', '対象外', true)}
        </div>

        <div class="member-form-field">
          <label class="member-form-field__label" for="mf-fee-exempt">
            会費免除
          </label>
          ${boolSelectHtml_('mf-fee-exempt', r.fee_exempt, '免除する', '免除しない', false)}
        </div>

        <div class="member-form-field member-form-field--wide">
          <label class="member-form-field__label" for="mf-remarks">
            備考
          </label>
          <textarea id="mf-remarks" class="c-textarea" rows="3">${esc(r.remarks || '')}</textarea>
        </div>
      </div>
    </div>

    <div class="member-form-section">
      <div class="member-form-section__title">所属先情報</div>
      <div class="member-form-section__description">
        勤務先など、会員の所属先がある場合に入力します（任意）
      </div>

      <div class="member-form-grid">
        <div class="member-form-field">
          <label class="member-form-field__label" for="mf-company-name">
            会社名
          </label>
          <input id="mf-company-name" class="c-input" value="${escapeAttr_(r.company_name || '')}">
        </div>

        <div class="member-form-field">
          <label class="member-form-field__label" for="mf-department">
            部署
          </label>
          <input id="mf-department" class="c-input" value="${escapeAttr_(r.department || '')}">
        </div>

        <div class="member-form-field">
          <label class="member-form-field__label" for="mf-position">
            役職
          </label>
          <input id="mf-position" class="c-input" value="${escapeAttr_(r.position || '')}">
        </div>

        <div class="member-form-field">
          <label class="member-form-field__label" for="mf-company-postal-code">
            会社郵便番号
          </label>
          <input id="mf-company-postal-code" type="text" inputmode="numeric" class="c-input" value="${escapeAttr_(String(r.company_postal_code || ''))}">
        </div>

        <div class="member-form-field member-form-field--wide">
          <label class="member-form-field__label" for="mf-company-address">
            会社住所
          </label>
          <input id="mf-company-address" class="c-input" value="${escapeAttr_(r.company_address || '')}">
        </div>

        <div class="member-form-field">
          <label class="member-form-field__label" for="mf-company-phone">
            会社電話番号
          </label>
          <input id="mf-company-phone" type="tel" inputmode="tel" class="c-input" value="${escapeAttr_(String(r.company_phone || ''))}">
        </div>

        <div class="member-form-field">
          <label class="member-form-field__label" for="mf-company-email">
            会社メール
          </label>
          <input id="mf-company-email" type="email" class="c-input" value="${escapeAttr_(r.company_email || '')}">
        </div>
      </div>
    </div>

    ${renderBillingSection_(r, otherPayeeRecord)}
  `;
}


/**
 * 法人・団体会員フォームの項目一式を作る。
 * 団体構成員数は今回のフォームには含めない（既存機能に影響を与えないため）。
 *
 * @param {Object|null} record
 * @param {Object|null} otherPayeeRecord
 * @return {string}
 */
function renderOrganizationFields_(record, otherPayeeRecord) {
  const r = record || {};
  const isEdit = Boolean(record);

  return `
    <div class="member-form-section">
      <div class="member-form-section__title">基本情報</div>

      <div class="member-form-grid">
        <div class="member-form-field">
          <label class="member-form-field__label">
            団体番号
          </label>
          ${
            isEdit
              ? `
                <div class="member-form-static">${esc(r.organization_number || '')}</div>
                <p class="member-form-field__hint">会員番号は変更できません</p>
              `
              : `<div class="member-form-static">保存時に自動発行されます</div>`
          }
        </div>

        <div class="member-form-field">
          <label class="member-form-field__label">
            会員区分
          </label>
          <div class="member-form-static">団体会員</div>
        </div>

        <div class="member-form-field member-form-field--wide">
          <label class="member-form-field__label" for="mf-name">
            会社名・団体名<span class="member-required">必須</span>
          </label>
          <input id="mf-name" class="c-input" value="${escapeAttr_(r.organization_name || '')}">
        </div>

        <div class="member-form-field">
          <label class="member-form-field__label" for="mf-corporate-number">
            法人番号
          </label>
          <input id="mf-corporate-number" class="c-input" value="${escapeAttr_(r.corporate_number || '')}">
        </div>

        <div class="member-form-field">
          <label class="member-form-field__label" for="mf-representative-name">
            代表者名
          </label>
          <input id="mf-representative-name" class="c-input" value="${escapeAttr_(r.representative_name || '')}">
        </div>

        <div class="member-form-field">
          <label class="member-form-field__label" for="mf-contact-name">
            担当者名
          </label>
          <input id="mf-contact-name" class="c-input" value="${escapeAttr_(r.contact_name || '')}">
        </div>

        <div class="member-form-field">
          <label class="member-form-field__label" for="mf-contact-department">
            担当部署
          </label>
          <input id="mf-contact-department" class="c-input" value="${escapeAttr_(r.contact_department || '')}">
        </div>

        <div class="member-form-field">
          <label class="member-form-field__label" for="mf-contact-position">
            担当者役職
          </label>
          <input id="mf-contact-position" class="c-input" value="${escapeAttr_(r.contact_position || '')}">
        </div>

        <div class="member-form-field">
          <label class="member-form-field__label" for="mf-postal-code">
            郵便番号
          </label>
          <input id="mf-postal-code" type="text" inputmode="numeric" class="c-input" value="${escapeAttr_(String(r.postal_code || ''))}">
        </div>

        <div class="member-form-field">
          <label class="member-form-field__label" for="mf-phone">
            電話番号
          </label>
          <input id="mf-phone" type="tel" inputmode="tel" class="c-input" value="${escapeAttr_(String(r.phone || ''))}">
        </div>

        <div class="member-form-field member-form-field--wide">
          <label class="member-form-field__label" for="mf-address">
            住所
          </label>
          <input id="mf-address" class="c-input" value="${escapeAttr_(r.address || '')}">
        </div>

        <div class="member-form-field">
          <label class="member-form-field__label" for="mf-email">
            メール
          </label>
          <input id="mf-email" type="email" class="c-input" value="${escapeAttr_(r.email || '')}">
        </div>

        <div class="member-form-field">
          <label class="member-form-field__label" for="mf-joined-at">
            入会日
          </label>
          <input id="mf-joined-at" type="date" class="c-input" value="${escapeAttr_(toDateInputValue_(r.joined_at))}">
        </div>

        <div class="member-form-field">
          <label class="member-form-field__label" for="mf-invoice-target">
            年会費請求対象
          </label>
          ${boolSelectHtml_('mf-invoice-target', r.invoice_target, '対象', '対象外', true)}
        </div>

        <div class="member-form-field member-form-field--wide">
          <label class="member-form-field__label" for="mf-remarks">
            備考
          </label>
          <textarea id="mf-remarks" class="c-textarea" rows="3">${esc(r.remarks || '')}</textarea>
        </div>
      </div>
    </div>

    ${renderBillingSection_(r, otherPayeeRecord)}

    ${isEdit ? renderOrganizationMemberCountSection_() : ''}
  `;
}


/**
 * 請求先セクション（登録住所と同じ／別の請求先を指定）を作る。
 * 個人・法人共通。
 *
 * @param {Object} record
 * @param {Object|null} otherPayeeRecord
 * @return {string}
 */
function renderBillingSection_(record, otherPayeeRecord) {
  const billingType =
    String(record.billing_source_type || 'self') === 'other'
      ? 'other'
      : 'self';

  const op = otherPayeeRecord || {};

  return `
    <div class="member-form-section">
      <div class="member-form-section__title">請求先</div>
      <div class="member-form-section__description">
        請求書の送付先を選択します
      </div>

      <div
        class="member-form-billing"
        id="member-form-billing"
        role="radiogroup"
        aria-label="請求先"
      >
        <label class="member-form-billing__option${billingType === 'self' ? ' is-selected' : ''}">
          <input
            type="radio"
            name="mf-billing-type"
            value="self"
            ${billingType === 'self' ? 'checked' : ''}
          >
          <span>登録住所と同じ</span>
        </label>

        <label class="member-form-billing__option${billingType === 'other' ? ' is-selected' : ''}">
          <input
            type="radio"
            name="mf-billing-type"
            value="other"
            ${billingType === 'other' ? 'checked' : ''}
          >
          <span>別の請求先を指定</span>
        </label>
      </div>

      <div
        class="member-form-other-payee"
        id="member-form-other-payee"
        style="${billingType === 'other' ? '' : 'display:none;'}"
      >
        <div class="member-form-grid">
          <div class="member-form-field member-form-field--wide">
            <label class="member-form-field__label" for="mf-op-name">
              請求先名<span class="member-required">必須</span>
            </label>
            <input id="mf-op-name" class="c-input" value="${escapeAttr_(op.name || '')}">
          </div>

          <div class="member-form-field">
            <label class="member-form-field__label" for="mf-op-type">
              請求先種別
            </label>
            <input
              id="mf-op-type"
              class="c-input"
              value="${escapeAttr_(op.payee_type || '')}"
              placeholder="例：法人／個人"
            >
          </div>

          <div class="member-form-field">
            <label class="member-form-field__label" for="mf-op-contact-name">
              担当者名
            </label>
            <input id="mf-op-contact-name" class="c-input" value="${escapeAttr_(op.contact_name || '')}">
          </div>

          <div class="member-form-field">
            <label class="member-form-field__label" for="mf-op-postal-code">
              郵便番号
            </label>
            <input id="mf-op-postal-code" type="text" inputmode="numeric" class="c-input" value="${escapeAttr_(String(op.postal_code || ''))}">
          </div>

          <div class="member-form-field">
            <label class="member-form-field__label" for="mf-op-phone">
              電話番号
            </label>
            <input id="mf-op-phone" type="tel" inputmode="tel" class="c-input" value="${escapeAttr_(String(op.phone || ''))}">
          </div>

          <div class="member-form-field member-form-field--wide">
            <label class="member-form-field__label" for="mf-op-address">
              住所
            </label>
            <input id="mf-op-address" class="c-input" value="${escapeAttr_(op.address || '')}">
          </div>

          <div class="member-form-field">
            <label class="member-form-field__label" for="mf-op-email">
              メール
            </label>
            <input id="mf-op-email" type="email" class="c-input" value="${escapeAttr_(op.email || '')}">
          </div>

          <div class="member-form-field">
            <label class="member-form-field__label" for="mf-op-line">
              LINE送付可否
            </label>
            ${boolSelectHtml_('mf-op-line', op.line_send_allowed, '可', '不可', false)}
          </div>

          <div class="member-form-field member-form-field--wide">
            <label class="member-form-field__label" for="mf-op-remarks">
              備考
            </label>
            <textarea id="mf-op-remarks" class="c-textarea" rows="2">${esc(op.remarks || '')}</textarea>
          </div>
        </div>
      </div>
    </div>
  `;
}


/**
 * 団体編集モーダルの「年度別会員数」セクションを作る。
 * organizationCountState_（openEditModal_で設定）を元に描画するため引数は取らない。
 * 会員（member）編集時・団体の新規登録時は呼び出し元でスキップされる。
 *
 * @return {string}
 */
function renderOrganizationMemberCountSection_() {
  const state = organizationCountState_;

  if (!state || !state.organizationId) {
    return '';
  }

  if (!state.data) {
    return `
      <div class="member-form-section" id="organization-count-section">
        <div class="member-form-section__title">年度別会員数</div>
        <div id="organization-count-message"></div>
        <div class="c-alert c-alert--danger">
          年度別会員数の取得に失敗しました。モーダルを開き直してお試しください。
        </div>
      </div>
    `;
  }

  const history = state.data.history || [];

  const defaultFiscalYear =
    state.data.fiscalYear ||
    (masterData && masterData.fiscalYear) ||
    new Date().getFullYear();

  const yearOptions =
    buildOrganizationCountYearOptions_(defaultFiscalYear, history);

  const previousRecord =
    findOrganizationCountByYear_(history, defaultFiscalYear - 1);

  return `
    <div class="member-form-section" id="organization-count-section">
      <div class="member-form-section__title">年度別会員数</div>
      <div class="member-form-section__description">
        年会費一括作成で使用する、団体の年度別会員数を年度ごとに登録します。
      </div>

      <div id="organization-count-message"></div>

      <div class="member-form-grid">
        <div class="member-form-field">
          <label class="member-form-field__label" for="mf-count-fiscal-year">
            対象年度
          </label>
          <select id="mf-count-fiscal-year" class="c-select">
            ${
              yearOptions
                .map(function (year) {
                  return `
                    <option value="${year}" ${year === defaultFiscalYear ? 'selected' : ''}>
                      ${year}年度
                    </option>
                  `;
                })
                .join('')
            }
          </select>
        </div>

        <div class="member-form-field">
          <label class="member-form-field__label">
            前年度人数
          </label>
          <div class="member-form-static" id="mf-count-previous">
            ${formatCountValue_(previousRecord ? previousRecord.currentCount : null)}
          </div>
        </div>

        <div class="member-form-field">
          <label class="member-form-field__label" for="mf-count-current">
            当年度人数<span class="member-required">必須</span>
          </label>
          <input
            id="mf-count-current"
            type="number"
            min="0"
            step="1"
            inputmode="numeric"
            class="c-input"
            value="${escapeAttr_(currentCountInputValue_(history, defaultFiscalYear))}"
          >
        </div>

        <div class="member-form-field">
          <label class="member-form-field__label" for="mf-count-confirmed-at">
            確認日<span class="member-required">必須</span>
          </label>
          <input
            id="mf-count-confirmed-at"
            type="date"
            class="c-input"
            value="${escapeAttr_(confirmedAtInputValue_(history, defaultFiscalYear))}"
          >
        </div>

        <div class="member-form-field">
          <label class="member-form-field__label">
            確認者
          </label>
          <div class="member-form-static">
            ${esc(currentLoggedInUserName_())}
          </div>
        </div>

        <div class="member-form-field member-form-field--wide">
          <label class="member-form-field__label" for="mf-count-remarks">
            備考
          </label>
          <textarea id="mf-count-remarks" class="c-textarea" rows="2">${esc(remarksInputValue_(history, defaultFiscalYear))}</textarea>
        </div>
      </div>

      <div class="organization-count-actions">
        <button type="button" class="btn primary" id="organization-count-save">
          人数を保存
        </button>
      </div>

      <div class="member-form-section__title organization-count-history-title">
        年度別履歴
      </div>

      ${renderOrganizationCountHistory_(history)}
    </div>
  `;
}


/**
 * 年度別会員数の履歴一覧を作る（PCはテーブル、900px以下はCSSでカード表示）。
 *
 * @param {Array} history
 * @return {string}
 */
function renderOrganizationCountHistory_(history) {
  if (!history.length) {
    return `
      <p class="member-form-field__hint">
        登録された年度別会員数はまだありません。
      </p>
    `;
  }

  const rows = history
    .slice()
    .sort(function (a, b) {
      return b.fiscalYear - a.fiscalYear;
    })
    .map(function (row) {
      return `
        <tr class="organization-count-history__row">
          <td data-label="年度">${esc(row.fiscalYear)}年度</td>
          <td data-label="前年度人数">${formatCountValue_(row.previousCount)}</td>
          <td data-label="当年度人数">${formatCountValue_(row.currentCount)}</td>
          <td data-label="確認日">${esc(formatDate_(row.confirmedAt))}</td>
          <td data-label="確認者">${esc(row.confirmedBy)}</td>
          <td data-label="備考">${esc(row.remarks)}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <div class="table-wrap organization-count-history">
      <table class="table">
        <thead>
          <tr>
            <th>年度</th>
            <th>前年度人数</th>
            <th>当年度人数</th>
            <th>確認日</th>
            <th>確認者</th>
            <th>備考</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}


/**
 * 対象年度セレクトの選択肢を作る。中心年度の前後数年に加え、
 * 履歴に含まれる年度（範囲外の古いデータ等）も必ず含める。
 *
 * @param {number} centerYear
 * @param {Array} history
 * @return {Array<number>}
 */
function buildOrganizationCountYearOptions_(centerYear, history) {
  const years = new Set();

  for (let offset = -5; offset <= 1; offset++) {
    years.add(centerYear + offset);
  }

  history.forEach(function (row) {
    years.add(row.fiscalYear);
  });

  return Array.from(years).sort(function (a, b) {
    return b - a;
  });
}


/**
 * 履歴から指定年度のレコードを探す。
 *
 * @param {Array} history
 * @param {number} year
 * @return {Object|null}
 */
function findOrganizationCountByYear_(history, year) {
  return history.find(function (row) {
    return row.fiscalYear === year;
  }) || null;
}


/**
 * 会員数表示用の文字列を作る。未登録（null）と0名を区別する。
 *
 * @param {number|null} value
 * @return {string}
 */
function formatCountValue_(value) {
  return value === null || typeof value === 'undefined'
    ? '―'
    : esc(value) + '名';
}


/**
 * 「当年度人数」入力欄の初期値。未登録の場合は空欄にする（0名との混同を避ける）。
 *
 * @param {Array} history
 * @param {number} year
 * @return {string}
 */
function currentCountInputValue_(history, year) {
  const record = findOrganizationCountByYear_(history, year);
  return record && record.currentCount !== null
    ? String(record.currentCount)
    : '';
}


/**
 * 「確認日」入力欄の初期値。既存データがなければ当日を初期値にする。
 *
 * @param {Array} history
 * @param {number} year
 * @return {string}
 */
function confirmedAtInputValue_(history, year) {
  const record = findOrganizationCountByYear_(history, year);
  return record && record.confirmedAt
    ? toDateInputValue_(record.confirmedAt)
    : getTodayString_();
}


/**
 * 「備考」入力欄の初期値。
 *
 * @param {Array} history
 * @param {number} year
 * @return {string}
 */
function remarksInputValue_(history, year) {
  const record = findOrganizationCountByYear_(history, year);
  return record ? (record.remarks || '') : '';
}


/**
 * ログイン中ユーザーの表示名。サイドバーに既に描画されている値を再利用し、
 * API呼び出しを追加しない。
 *
 * @return {string}
 */
function currentLoggedInUserName_() {
  const el = document.querySelector('.sidebar-user__name');
  return el ? el.textContent.trim() : '';
}


/**
 * 「年度別会員数」セクションのイベントを登録する。
 * フォーム項目を再描画するたびに呼び直す。セクションが無い場合は何もしない。
 *
 * @param {HTMLElement} container
 */
function bindOrganizationMemberCountSection_(container) {
  if (!container) {
    return;
  }

  const section =
    container.querySelector('#organization-count-section');

  if (!section) {
    return;
  }

  const yearSelect =
    section.querySelector('#mf-count-fiscal-year');

  if (yearSelect) {
    yearSelect.addEventListener(
      'change',
      function () {
        updateOrganizationCountFormForYear_(
          Number(yearSelect.value)
        );
      }
    );
  }

  const saveButton =
    section.querySelector('#organization-count-save');

  if (saveButton) {
    saveButton.addEventListener(
      'click',
      function () {
        submitOrganizationMemberCount_();
      }
    );
  }
}


/**
 * 対象年度セレクトの変更に合わせて、前年度人数・当年度人数・確認日・備考を
 * キャッシュ済みの履歴（organizationCountState_.data.history）から再表示する。
 * APIは呼び直さない。
 *
 * @param {number} year
 */
function updateOrganizationCountFormForYear_(year) {
  const state = organizationCountState_;

  if (!state || !state.data) {
    return;
  }

  const history = state.data.history || [];

  const previousEl =
    document.querySelector('#mf-count-previous');

  if (previousEl) {
    const previousRecord =
      findOrganizationCountByYear_(history, year - 1);

    previousEl.textContent =
      formatCountValue_(
        previousRecord ? previousRecord.currentCount : null
      );
  }

  const currentInput =
    document.querySelector('#mf-count-current');

  if (currentInput) {
    currentInput.value =
      currentCountInputValue_(history, year);
  }

  const confirmedAtInput =
    document.querySelector('#mf-count-confirmed-at');

  if (confirmedAtInput) {
    confirmedAtInput.value =
      confirmedAtInputValue_(history, year);
  }

  const remarksInput =
    document.querySelector('#mf-count-remarks');

  if (remarksInput) {
    remarksInput.value =
      remarksInputValue_(history, year);
  }
}


/**
 * 「年度別会員数」セクションのメッセージ表示を更新する。
 *
 * @param {HTMLElement} el
 * @param {string} text
 * @param {string} [type] 'success' | 省略時はエラー扱い
 */
function setOrganizationCountMessage_(el, text, type) {
  if (!el) {
    return;
  }

  if (!text) {
    el.innerHTML = '';
    return;
  }

  const cssClass =
    type === 'success'
      ? 'c-alert--success'
      : 'c-alert--danger';

  el.innerHTML = `
    <div class="c-alert ${cssClass}">
      ${esc(text)}
    </div>
  `;
}


/**
 * 「年度別会員数」セクションを検証し、保存する。
 * 保存後は履歴を再取得し、セクションのみを再描画する
 * （モーダルは閉じず、ページ全体の再読み込みもしない）。
 */
async function submitOrganizationMemberCount_() {
  const state = organizationCountState_;

  if (!state || !state.organizationId) {
    return;
  }

  const messageEl =
    document.querySelector('#organization-count-message');

  const saveButton =
    document.querySelector('#organization-count-save');

  if (messageEl) {
    messageEl.innerHTML = '';
  }

  const yearSelect =
    document.querySelector('#mf-count-fiscal-year');

  const fiscalYear =
    yearSelect ? Number(yearSelect.value) : NaN;

  const currentCountRaw =
    getInputValue_('#mf-count-current');

  const confirmedAt =
    getInputValue_('#mf-count-confirmed-at');

  const remarks =
    getInputValue_('#mf-count-remarks');

  if (!Number.isInteger(fiscalYear) || fiscalYear < 2000) {
    setOrganizationCountMessage_(messageEl, '対象年度が不正です。');
    return;
  }

  if (currentCountRaw === '' || !/^\d+$/.test(currentCountRaw)) {
    setOrganizationCountMessage_(
      messageEl,
      '団体会員数は0以上の整数で入力してください。'
    );
    return;
  }

  if (!confirmedAt) {
    setOrganizationCountMessage_(messageEl, '確認日を入力してください。');
    return;
  }

  if (saveButton) {
    saveButton.disabled = true;
    saveButton.textContent = '保存中...';
  }

  try {
    await api(
      'saveOrganizationMemberCount',
      {
        organization_id: state.organizationId,
        fiscal_year: fiscalYear,
        current_count: Number(currentCountRaw),
        confirmed_at: confirmedAt,
        remarks: remarks
      }
    );

    let refreshed = null;

    try {
      refreshed = await api(
        'getOrganizationMemberCounts',
        {
          organizationId: state.organizationId,
          fiscalYear: fiscalYear
        }
      );
    } catch (error) {
      refreshed = null;
    }

    organizationCountState_ = {
      organizationId: state.organizationId,
      data: refreshed
    };

    const section =
      document.querySelector('#organization-count-section');

    if (section) {
      section.outerHTML = renderOrganizationMemberCountSection_();

      bindOrganizationMemberCountSection_(
        document.querySelector('#member-form-fields')
      );
    }

    setOrganizationCountMessage_(
      document.querySelector('#organization-count-message'),
      `${fiscalYear}年度の団体会員数を保存しました。`,
      'success'
    );

  } catch (error) {
    setOrganizationCountMessage_(
      messageEl,
      (error && error.message) || '団体会員数の保存に失敗しました。'
    );

    if (saveButton) {
      saveButton.disabled = false;
      saveButton.textContent = '人数を保存';
    }
  }
}


/**
 * 請求先ラジオボタンの切り替えイベントを登録する。
 * フォーム項目を再描画するたびに呼び直す。
 *
 * @param {HTMLElement} container
 */
function bindBillingToggle_(container) {
  if (!container) {
    return;
  }

  const radios =
    container.querySelectorAll(
      'input[name="mf-billing-type"]'
    );

  const panel =
    container.querySelector(
      '#member-form-other-payee'
    );

  radios.forEach(function (radio) {
    radio.addEventListener(
      'change',
      function () {
        container
          .querySelectorAll('.member-form-billing__option')
          .forEach(function (option) {
            const optionInput =
              option.querySelector('input');

            option.classList.toggle(
              'is-selected',
              Boolean(optionInput) &&
                optionInput.value === radio.value
            );
          });

        if (panel) {
          panel.style.display =
            radio.value === 'other' ? '' : 'none';
        }
      }
    );
  });
}


/**
 * 登録・編集フォームを検証し、保存する。
 *
 * 「別の請求先を指定」の場合はsaveOtherPayeeを先に呼び、
 * その戻り値のpayee_idを使ってsaveMember/saveOrganizationを呼ぶ。
 * 前半が成功し後半が失敗した場合、別請求先だけが保存された
 * 中途半端な状態になり得るため、その旨をエラーメッセージで明示する。
 *
 * @param {string} type 'member' | 'organization'
 * @param {Object|null} existingRecord
 * @param {Object|null} existingOtherPayeeRecord
 */
async function submitMemberForm_(
  type,
  existingRecord,
  existingOtherPayeeRecord
) {
  const messageEl =
    document.querySelector('#member-form-message');

  const submitButton =
    document.querySelector('#member-form-submit');

  const cancelButton =
    document.querySelector('#member-form-cancel');

  if (messageEl) {
    messageEl.innerHTML = '';
  }

  const name = getInputValue_('#mf-name');

  if (!name) {
    setFormMessage_(
      messageEl,
      type === 'organization'
        ? '会社名・団体名は必須です。'
        : '氏名は必須です。'
    );
    scrollMemberModalToError_();
    return;
  }

  if (type === 'member') {
    const memberType = getSelectValue_('#mf-member-type');

    if (!memberType) {
      setFormMessage_(messageEl, '会員区分は必須です。');
      scrollMemberModalToError_();
      return;
    }
  }

  const billingTypeInput =
    document.querySelector(
      'input[name="mf-billing-type"]:checked'
    );

  const billingType =
    billingTypeInput ? billingTypeInput.value : 'self';

  if (billingType === 'other') {
    const otherPayeeName = getInputValue_('#mf-op-name');

    if (!otherPayeeName) {
      setFormMessage_(
        messageEl,
        '別の請求先を指定する場合、請求先名は必須です。'
      );
      scrollMemberModalToError_();
      return;
    }
  }

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = '保存中...';
  }

  if (cancelButton) {
    cancelButton.disabled = true;
  }

  try {
    let billingSourceType = 'self';
    let billingSourceId = '';

    if (billingType === 'other') {
      const otherPayeePayload =
        buildOtherPayeePayload_(existingOtherPayeeRecord);

      let savedOtherPayee;

      try {
        savedOtherPayee =
          await api('saveOtherPayee', otherPayeePayload);

      } catch (error) {
        setFormMessage_(
          messageEl,
          '別請求先の保存に失敗しました。' +
            (type === 'organization' ? '団体' : '会員') +
            '情報はまだ保存されていません。（' +
            ((error && error.message) || 'エラーが発生しました') +
            '）'
        );
        scrollMemberModalToError_();
        return;
      }

      billingSourceType = 'other';
      billingSourceId = String(savedOtherPayee.payee_id || '');

      try {
        const mainPayload =
          type === 'organization'
            ? buildOrganizationPayload_(
                existingRecord,
                billingSourceType,
                billingSourceId
              )
            : buildMemberPayload_(
                existingRecord,
                billingSourceType,
                billingSourceId
              );

        await api(
          type === 'organization' ? 'saveOrganization' : 'saveMember',
          mainPayload
        );

      } catch (error) {
        setFormMessage_(
          messageEl,
          '別請求先の保存は完了しましたが、' +
            (type === 'organization' ? '団体' : '会員') +
            '情報の保存に失敗しました。データが中途半端な状態になっている' +
            '可能性があります。内容をご確認のうえ、もう一度保存してください。（' +
            ((error && error.message) || 'エラーが発生しました') +
            '）'
        );
        scrollMemberModalToError_();
        return;
      }

    } else {
      const mainPayload =
        type === 'organization'
          ? buildOrganizationPayload_(existingRecord, 'self', '')
          : buildMemberPayload_(existingRecord, 'self', '');

      await api(
        type === 'organization' ? 'saveOrganization' : 'saveMember',
        mainPayload
      );
    }

    closeModal_();

    const successText =
      existingRecord ? '保存しました。' : '登録しました。';

    showBanner_('success', successText);

    await reloadItems_();

  } catch (error) {
    setFormMessage_(
      messageEl,
      (error && error.message) || '保存に失敗しました。'
    );
    scrollMemberModalToError_();

  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = '保存する';
    }

    if (cancelButton) {
      cancelButton.disabled = false;
    }
  }
}


/**
 * saveMemberへ送るpayloadを作る。
 * フォームに項目のない既存値（line_send_allowed/membership_status/
 * resigned_at/annual_fee_override）は、既存レコードの値をそのまま
 * 引き継ぎ、消えないようにする。
 *
 * @param {Object|null} existingRecord
 * @param {string} billingSourceType
 * @param {string} billingSourceId
 * @return {Object}
 */
function buildMemberPayload_(
  existingRecord,
  billingSourceType,
  billingSourceId
) {
  const r = existingRecord || {};

  return {
    member_id: r.member_id || '',
    name: getInputValue_('#mf-name'),
    member_type: getSelectValue_('#mf-member-type'),
    postal_code: getInputValue_('#mf-postal-code'),
    address: getInputValue_('#mf-address'),
    phone: getInputValue_('#mf-phone'),
    email: getInputValue_('#mf-email'),
    joined_at: getInputValue_('#mf-joined-at'),
    invoice_target: getSelectValue_('#mf-invoice-target') === 'true',
    fee_exempt: getSelectValue_('#mf-fee-exempt') === 'true',
    remarks: getInputValue_('#mf-remarks'),
    company_name: getInputValue_('#mf-company-name'),
    department: getInputValue_('#mf-department'),
    position: getInputValue_('#mf-position'),
    company_postal_code: getInputValue_('#mf-company-postal-code'),
    company_address: getInputValue_('#mf-company-address'),
    company_phone: getInputValue_('#mf-company-phone'),
    company_email: getInputValue_('#mf-company-email'),
    billing_source_type: billingSourceType,
    billing_source_id: billingSourceId,
    line_send_allowed:
      r.line_send_allowed === 'true' || r.line_send_allowed === true,
    resigned_at: r.resigned_at || '',
    membership_status: r.membership_status || 'active',
    annual_fee_override:
      r.annual_fee_override === '' ||
      r.annual_fee_override === null ||
      typeof r.annual_fee_override === 'undefined'
        ? ''
        : r.annual_fee_override
  };
}


/**
 * saveOrganizationへ送るpayloadを作る。
 * フォームに項目のない既存値（line_send_allowed/membership_status/
 * resigned_at）は、既存レコードの値をそのまま引き継ぐ。
 *
 * @param {Object|null} existingRecord
 * @param {string} billingSourceType
 * @param {string} billingSourceId
 * @return {Object}
 */
function buildOrganizationPayload_(
  existingRecord,
  billingSourceType,
  billingSourceId
) {
  const r = existingRecord || {};

  return {
    organization_id: r.organization_id || '',
    organization_name: getInputValue_('#mf-name'),
    corporate_number: getInputValue_('#mf-corporate-number'),
    representative_name: getInputValue_('#mf-representative-name'),
    contact_name: getInputValue_('#mf-contact-name'),
    contact_department: getInputValue_('#mf-contact-department'),
    contact_position: getInputValue_('#mf-contact-position'),
    postal_code: getInputValue_('#mf-postal-code'),
    address: getInputValue_('#mf-address'),
    phone: getInputValue_('#mf-phone'),
    email: getInputValue_('#mf-email'),
    joined_at: getInputValue_('#mf-joined-at'),
    invoice_target: getSelectValue_('#mf-invoice-target') === 'true',
    remarks: getInputValue_('#mf-remarks'),
    billing_source_type: billingSourceType,
    billing_source_id: billingSourceId,
    line_send_allowed:
      r.line_send_allowed === 'true' || r.line_send_allowed === true,
    membership_status: r.membership_status || 'active',
    resigned_at: r.resigned_at || ''
  };
}


/**
 * saveOtherPayeeへ送るpayloadを作る。
 *
 * @param {Object|null} existingOtherPayeeRecord
 * @return {Object}
 */
function buildOtherPayeePayload_(existingOtherPayeeRecord) {
  const op = existingOtherPayeeRecord || {};

  return {
    payee_id: op.payee_id || '',
    payee_type: getInputValue_('#mf-op-type') || 'other',
    name: getInputValue_('#mf-op-name'),
    contact_name: getInputValue_('#mf-op-contact-name'),
    postal_code: getInputValue_('#mf-op-postal-code'),
    address: getInputValue_('#mf-op-address'),
    phone: getInputValue_('#mf-op-phone'),
    email: getInputValue_('#mf-op-email'),
    line_send_allowed: getSelectValue_('#mf-op-line') === 'true',
    remarks: getInputValue_('#mf-op-remarks')
  };
}


/**
 * masterData.feeTypesから、個人会員フォームで選択可能な会員区分を返す。
 * 'organization'（団体会員）はOrganizations側の概念のため除外する。
 *
 * @return {Array}
 */
function getMemberTypeOptions_() {
  const feeTypes =
    (masterData && masterData.feeTypes) || [];

  return feeTypes.filter(function (item) {
    return item.code !== 'organization';
  });
}


/* ==========================================================================
   詳細モーダル（変更履歴を含む）
   ========================================================================== */

/**
 * 詳細モーダルを開き、getPayeeDetail・listEntityAuditLogsを取得して表示する。
 *
 * @param {string} sourceType
 * @param {string} id
 */
async function openDetailModal_(sourceType, id) {
  const title =
    sourceType === 'organization'
      ? '法人・団体会員 詳細'
      : sourceType === 'member'
        ? '個人会員 詳細'
        : '会員外の請求先 詳細';

  openModalShell_(
    '<div class="loading">読み込み中…</div>',
    {
      title,
      ariaLabel: title,
      wide: true,
      footer: '<button type="button" class="btn" id="member-detail-close">閉じる</button>'
    }
  );

  const closeButton =
    document.querySelector('#member-detail-close');

  if (closeButton) {
    closeButton.addEventListener(
      'click',
      function () {
        closeModal_();
      }
    );
  }

  let record;

  try {
    record = await api(
      'getPayeeDetail',
      { sourceType, sourceId: id }
    );

  } catch (error) {
    renderModalBodyError_(
      (error && error.message) ||
        'データの取得に失敗しました。'
    );
    return;
  }

  if (!record) {
    renderModalBodyError_(
      '対象のデータが見つかりませんでした。'
    );
    return;
  }

  let otherPayeeRecord = null;

  if (
    String(record.billing_source_type) === 'other' &&
    record.billing_source_id
  ) {
    try {
      otherPayeeRecord = await api(
        'getPayeeDetail',
        {
          sourceType: 'other',
          sourceId: record.billing_source_id
        }
      );
    } catch (error) {
      otherPayeeRecord = null;
    }
  }

  let historyItems = [];

  const historyEntityType =
    sourceType === 'organization'
      ? 'organization'
      : sourceType === 'member'
        ? 'member'
        : 'other_payee';

  try {
    const historyData = await api(
      'listEntityAuditLogs',
      {
        entityType: historyEntityType,
        entityId: id
      }
    );

    historyItems = (historyData && historyData.items) || [];

  } catch (error) {
    historyItems = null;
  }

  const bodyEl =
    document.querySelector(
      '#member-modal-root .c-modal__body'
    );

  if (bodyEl) {
    bodyEl.innerHTML =
      renderDetailBody_(
        sourceType,
        record,
        otherPayeeRecord,
        historyItems
      );
  }
}


/**
 * 詳細モーダルの本文（基本情報／所属先情報／請求先設定／会員状態／備考／変更履歴）を作る。
 *
 * @param {string} sourceType
 * @param {Object} record
 * @param {Object|null} otherPayeeRecord
 * @param {Array|null} historyItems nullは取得失敗を表す
 * @return {string}
 */
function renderDetailBody_(sourceType, record, otherPayeeRecord, historyItems) {
  const isOrganization = sourceType === 'organization';
  const isMember = sourceType === 'member';

  if (!isOrganization && !isMember) {
    return renderOtherPayeeDetailBody_(record, historyItems);
  }

  const basicItems =
    isOrganization
      ? [
          renderDetailItem_('団体番号', record.organization_number),
          renderDetailItem_('会員区分', '団体会員'),
          renderDetailItem_('会社名・団体名', record.organization_name),
          renderDetailItem_('法人番号', record.corporate_number),
          renderDetailItem_('代表者名', record.representative_name),
          renderDetailItem_('担当者名', record.contact_name),
          renderDetailItem_('担当部署', record.contact_department),
          renderDetailItem_('担当者役職', record.contact_position),
          renderDetailItem_('郵便番号', record.postal_code),
          renderDetailItem_('住所', record.address, true),
          renderDetailItem_('電話番号', record.phone),
          renderDetailItem_('メール', record.email)
        ]
      : [
          renderDetailItem_('会員番号', record.member_number),
          renderDetailItem_('会員区分', formatMemberType_(record.member_type)),
          renderDetailItem_('氏名', record.name),
          renderDetailItem_('郵便番号', record.postal_code),
          renderDetailItem_('住所', record.address, true),
          renderDetailItem_('電話番号', record.phone),
          renderDetailItem_('メール', record.email)
        ];

  const affiliationSection =
    isMember
      ? `
        <div class="member-detail-section">
          <div class="member-detail-section__title">所属先情報</div>
          <div class="member-detail-grid">
            ${
              [
                renderDetailItem_('会社名', record.company_name),
                renderDetailItem_('部署', record.department),
                renderDetailItem_('役職', record.position),
                renderDetailItem_('会社郵便番号', record.company_postal_code),
                renderDetailItem_('会社住所', record.company_address, true),
                renderDetailItem_('会社電話番号', record.company_phone),
                renderDetailItem_('会社メール', record.company_email)
              ].join('')
            }
          </div>
        </div>
      `
      : '';

  const billingType =
    String(record.billing_source_type || 'self') === 'other'
      ? 'other'
      : 'self';

  const billingItems = [
    renderDetailItem_(
      '請求先',
      billingType === 'other' ? '別の請求先を指定' : '登録住所と同じ'
    )
  ];

  if (billingType === 'other') {
    if (otherPayeeRecord) {
      billingItems.push(
        renderDetailItem_('請求先名', otherPayeeRecord.name)
      );

      billingItems.push(
        renderDetailItem_(
          '請求先住所',
          [
            otherPayeeRecord.postal_code
              ? '〒' + otherPayeeRecord.postal_code
              : '',
            otherPayeeRecord.address || ''
          ]
            .filter(Boolean)
            .join(' '),
          true
        )
      );

      billingItems.push(
        renderDetailItem_('請求先電話番号', otherPayeeRecord.phone)
      );

      billingItems.push(
        renderDetailItem_('請求先メール', otherPayeeRecord.email)
      );

    } else {
      billingItems.push(`
        <div class="member-detail-item member-detail-item--wide">
          <div class="member-detail-item__value">
            <span class="members-muted">請求先情報を取得できませんでした。</span>
          </div>
        </div>
      `);
    }
  }

  const statusItems =
    isOrganization
      ? [
          renderDetailItem_('会員状態', getStatusLabel_(record.membership_status)),
          renderDetailItem_('入会日', formatDate_(record.joined_at)),
          renderDetailItem_('退会日', formatDate_(record.resigned_at)),
          renderDetailItem_(
            '年会費請求対象',
            formatBoolean_(record.invoice_target, '対象', '対象外')
          )
        ]
      : [
          renderDetailItem_('会員状態', getStatusLabel_(record.membership_status)),
          renderDetailItem_('入会日', formatDate_(record.joined_at)),
          renderDetailItem_('退会日', formatDate_(record.resigned_at)),
          renderDetailItem_(
            '年会費請求対象',
            formatBoolean_(record.invoice_target, '対象', '対象外')
          ),
          renderDetailItem_(
            '会費免除',
            formatBoolean_(record.fee_exempt, '免除', '免除なし')
          )
        ];

  const remarks = String(record.remarks || '').trim();

  return `
    <div class="member-detail-section">
      <div class="member-detail-section__title">基本情報</div>
      <div class="member-detail-grid">
        ${basicItems.join('')}
      </div>
    </div>

    ${affiliationSection}

    <div class="member-detail-section">
      <div class="member-detail-section__title">請求先設定</div>
      <div class="member-detail-grid">
        ${billingItems.join('')}
      </div>
    </div>

    <div class="member-detail-section">
      <div class="member-detail-section__title">会員状態</div>
      <div class="member-detail-grid">
        ${statusItems.join('')}
      </div>
    </div>

    <div class="member-detail-section">
      <div class="member-detail-section__title">備考</div>
      <div class="member-detail-item__value">
        ${remarks ? esc(remarks) : '<span class="members-muted">未登録</span>'}
      </div>
    </div>

    <div class="member-detail-section">
      <div class="member-detail-section__title">変更履歴</div>
      ${renderHistorySection_(historyItems)}
    </div>
  `;
}


/**
 * 会員外の請求先(OtherPayees)専用の詳細表示を作る。
 * 会員番号・会員区分・入会日・退会日・会費免除などmember/organization固有の
 * 項目はOtherPayeesに存在しないため表示しない。
 *
 * @param {Object} record
 * @param {Array|null} historyItems
 * @return {string}
 */
function renderOtherPayeeDetailBody_(record, historyItems) {
  const basicItems = [
    renderDetailItem_('請求先ID', record.payee_id),
    renderDetailItem_('請求先種別', record.payee_type),
    renderDetailItem_('請求先名', record.name),
    renderDetailItem_('担当者名', record.contact_name),
    renderDetailItem_('郵便番号', record.postal_code),
    renderDetailItem_('住所', record.address, true),
    renderDetailItem_('電話番号', record.phone),
    renderDetailItem_('メールアドレス', record.email),
    renderDetailItem_(
      'LINE送付可否',
      formatBoolean_(record.line_send_allowed, '可', '不可')
    )
  ];

  const remarks = String(record.remarks || '').trim();

  return `
    <div class="member-detail-section">
      <div class="member-detail-section__title">基本情報</div>
      <div class="member-detail-grid">
        ${basicItems.join('')}
      </div>
    </div>

    <div class="member-detail-section">
      <div class="member-detail-section__title">備考</div>
      <div class="member-detail-item__value">
        ${remarks ? esc(remarks) : '<span class="members-muted">未登録</span>'}
      </div>
    </div>

    <div class="member-detail-section">
      <div class="member-detail-section__title">登録情報</div>
      <div class="member-detail-grid">
        ${renderDetailItem_('登録日時', formatDateTime_(record.created_at))}
        ${renderDetailItem_('更新日時', formatDateTime_(record.updated_at))}
      </div>
    </div>

    <div class="member-detail-section">
      <div class="member-detail-section__title">変更履歴</div>
      ${renderHistorySection_(historyItems)}
    </div>
  `;
}


/**
 * 詳細グリッドの1項目を作る。値が空の場合は「未登録」を表示する。
 *
 * @param {string} label
 * @param {*} value
 * @param {boolean=} wide
 * @return {string}
 */
function renderDetailItem_(label, value, wide) {
  const text = String(value == null ? '' : value).trim();

  return `
    <div class="member-detail-item${wide ? ' member-detail-item--wide' : ''}">
      <div class="member-detail-item__label">${esc(label)}</div>
      <div class="member-detail-item__value">
        ${text ? esc(text) : '<span class="members-muted">未登録</span>'}
      </div>
    </div>
  `;
}


/**
 * 変更履歴一覧を作る。historyItemsがnullの場合は取得失敗として表示する。
 *
 * @param {Array|null} historyItems
 * @return {string}
 */
function renderHistorySection_(historyItems) {
  if (historyItems === null) {
    return '<div class="member-history-empty">変更履歴の取得に失敗しました。</div>';
  }

  if (!historyItems || !historyItems.length) {
    return '<div class="member-history-empty">変更履歴はまだありません。</div>';
  }

  return `
    <div class="member-history-list">
      ${historyItems.map(renderHistoryItem_).join('')}
    </div>
  `;
}


/**
 * 変更履歴1件分を作る。before_json/after_jsonはJSON文字列のまま表示せず、
 * 変更のあった項目だけを「ラベル：before → after」の形式に変換する。
 *
 * @param {Object} item
 * @return {string}
 */
function renderHistoryItem_(item) {
  const actionLabel =
    ACTION_LABELS_[item.action] || item.action || '―';

  const when = formatDateTime_(item.timestamp);
  const userLabel = item.user_name || item.user_email || '';

  const changes =
    computeHistoryChanges_(item.before_json, item.after_json);

  const detail = String(item.detail || '').trim();

  let changesHtml = '';

  if (changes.length) {
    changesHtml = `
      <div class="member-history-changes">
        ${
          changes
            .map(function (change) {
              return `
                <div class="member-history-change">
                  <span class="member-history-change__label">${esc(change.label)}</span>
                  <span class="member-history-change__diff">${esc(change.before)} → ${esc(change.after)}</span>
                </div>
              `;
            })
            .join('')
        }
      </div>
    `;

  } else if (!item.before_json) {
    changesHtml = '<div class="member-history-change">新規登録されました。</div>';
  }

  return `
    <div class="member-history-item">
      <div class="member-history-item__meta">
        <span class="member-history-item__action">${esc(actionLabel)}</span>
        <span class="member-history-item__when">${esc(when)}</span>
        ${userLabel ? `<span class="member-history-item__user">${esc(userLabel)}</span>` : ''}
      </div>

      ${changesHtml}

      ${detail ? `<div class="member-history-reason">${esc(detail)}</div>` : ''}
    </div>
  `;
}


/**
 * before_json/after_jsonを比較し、変更のあったフィールドのみを返す。
 * created_at/updated_at等の内部的に毎回変わる項目は除外する。
 *
 * @param {string} beforeJsonStr
 * @param {string} afterJsonStr
 * @return {Array<{label:string, before:string, after:string}>}
 */
function computeHistoryChanges_(beforeJsonStr, afterJsonStr) {
  const before = parseJsonSafe_(beforeJsonStr);
  const after = parseJsonSafe_(afterJsonStr);

  if (!before || !after) {
    return [];
  }

  const keys =
    Array.from(
      new Set(
        Object.keys(before).concat(Object.keys(after))
      )
    );

  return keys
    .filter(function (key) {
      return HISTORY_IGNORE_KEYS_.indexOf(key) === -1;
    })
    .filter(function (key) {
      const beforeValue = before[key] == null ? '' : before[key];
      const afterValue = after[key] == null ? '' : after[key];
      return String(beforeValue) !== String(afterValue);
    })
    .map(function (key) {
      return {
        label: FIELD_LABELS_[key] || key,
        before: formatHistoryValue_(key, before[key]),
        after: formatHistoryValue_(key, after[key])
      };
    });
}


/**
 * JSON文字列を安全にパースする。失敗した場合はnullを返す。
 *
 * @param {*} value
 * @return {Object|null}
 */
function parseJsonSafe_(value) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : null;

  } catch (error) {
    return null;
  }
}


/**
 * 変更履歴の差分表示用に、フィールドごとの値を人が読める形式に変換する。
 *
 * @param {string} key
 * @param {*} value
 * @return {string}
 */
function formatHistoryValue_(key, value) {
  const text = String(value == null ? '' : value).trim();

  if (key === 'invoice_target') {
    return formatBoolean_(value, '対象', '対象外');
  }

  if (key === 'fee_exempt') {
    return formatBoolean_(value, '免除', '免除なし');
  }

  if (key === 'line_send_allowed') {
    return formatBoolean_(value, '可', '不可');
  }

  if (key === 'membership_status') {
    return getStatusLabel_(value);
  }

  if (key === 'billing_source_type') {
    return value === 'other' ? '別の請求先' : '登録住所と同じ';
  }

  if (key === 'member_type') {
    return formatMemberType_(value) || '（未設定）';
  }

  return text || '（未設定）';
}


/**
 * 会員区分コードを表示名に変換する。masterData.feeTypesにあればそちらを優先し、
 * なければ固定の対応表（MEMBER_TYPE_LABELS_）を使う。
 *
 * @param {*} code
 * @return {string}
 */
function formatMemberType_(code) {
  const value = String(code || '').trim();

  if (!value) {
    return '';
  }

  const fromMaster =
    ((masterData && masterData.feeTypes) || []).find(function (item) {
      return String(item.code) === value;
    });

  if (fromMaster) {
    return fromMaster.label;
  }

  return MEMBER_TYPE_LABELS_[value] || value;
}


/**
 * 真偽値らしき値（true/false文字列 or 真偽値）をラベルに変換する。
 *
 * @param {*} value
 * @param {string} trueLabel
 * @param {string} falseLabel
 * @return {string}
 */
function formatBoolean_(value, trueLabel, falseLabel) {
  const isTrue = value === true || String(value).toLowerCase() === 'true';
  return isTrue ? trueLabel : falseLabel;
}


/* ==========================================================================
   退会確認モーダル
   ========================================================================== */

/**
 * 退会確認モーダルを開く。
 *
 * @param {string} sourceType 'member' | 'organization'
 * @param {string} id
 * @param {string} name
 */
function openWithdrawModal_(sourceType, id, name) {
  const title = '退会処理';

  const bodyHtml = `
    <div id="member-withdraw-message"></div>

    <div class="member-withdraw-target">
      対象：<strong>${esc(name || '')}</strong>
    </div>

    <div class="c-alert c-alert--warning member-withdraw-notice">
      退会処理を行うと、次のようになります。
      <ul>
        <li>会員データは削除されません</li>
        <li>過去の請求書・入金履歴は保持されます</li>
        <li>年会費一括作成の対象外になります</li>
      </ul>
    </div>

    <form id="member-withdraw-form">
      <div class="member-form-grid">
        <div class="member-form-field">
          <label class="member-form-field__label" for="mw-resigned-at">
            退会日<span class="member-required">必須</span>
          </label>
          <input id="mw-resigned-at" type="date" class="c-input" value="${escapeAttr_(getTodayString_())}">
        </div>
      </div>

      <div class="member-form-field">
        <label class="member-form-field__label" for="mw-reason">
          退会理由
        </label>
        <textarea id="mw-reason" class="c-textarea" rows="2"></textarea>
      </div>

      <div class="member-form-field">
        <label class="member-form-field__label" for="mw-remarks">
          備考
        </label>
        <textarea id="mw-remarks" class="c-textarea" rows="2"></textarea>
      </div>
    </form>
  `;

  const footerHtml = `
    <button type="button" class="btn" id="member-withdraw-cancel">
      キャンセル
    </button>

    <button
      type="submit"
      form="member-withdraw-form"
      class="btn btn--danger"
      id="member-withdraw-submit"
    >
      退会させる
    </button>
  `;

  openModalShell_(
    bodyHtml,
    {
      title,
      ariaLabel: title,
      footer: footerHtml
    }
  );

  const cancelButton =
    document.querySelector('#member-withdraw-cancel');

  if (cancelButton) {
    cancelButton.addEventListener(
      'click',
      function () {
        closeModal_();
      }
    );
  }

  const form =
    document.querySelector('#member-withdraw-form');

  if (form) {
    form.addEventListener(
      'submit',
      async function (event) {
        event.preventDefault();
        await submitWithdraw_(sourceType, id);
      }
    );
  }
}


/**
 * 退会処理を実行する。
 *
 * 退会理由・備考は、backendのwithdrawMember/withdrawOrganizationが
 * reason（AuditLogのdetail）1項目しか受け付けないため、
 * 「退会理由：〜」「備考：〜」の形式で結合して送る。
 *
 * @param {string} sourceType
 * @param {string} id
 */
async function submitWithdraw_(sourceType, id) {
  const messageEl =
    document.querySelector('#member-withdraw-message');

  const submitButton =
    document.querySelector('#member-withdraw-submit');

  const cancelButton =
    document.querySelector('#member-withdraw-cancel');

  if (messageEl) {
    messageEl.innerHTML = '';
  }

  const resignedAt = getInputValue_('#mw-resigned-at');

  if (!resignedAt) {
    setFormMessage_(messageEl, '退会日は必須です。');
    return;
  }

  const reasonText = getInputValue_('#mw-reason');
  const remarksText = getInputValue_('#mw-remarks');

  const reason = [
    reasonText ? '退会理由：' + reasonText : '',
    remarksText ? '備考：' + remarksText : ''
  ]
    .filter(Boolean)
    .join('\n');

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = '処理中...';
  }

  if (cancelButton) {
    cancelButton.disabled = true;
  }

  try {
    const action =
      sourceType === 'organization'
        ? 'withdrawOrganization'
        : 'withdrawMember';

    const payload =
      sourceType === 'organization'
        ? { organizationId: id, resignedAt, reason }
        : { memberId: id, resignedAt, reason };

    await api(action, payload);

    closeModal_();
    showBanner_('success', '退会処理を完了しました。');
    await reloadItems_();

  } catch (error) {
    setFormMessage_(
      messageEl,
      (error && error.message) || '退会処理に失敗しました。'
    );

    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = '退会させる';
    }

    if (cancelButton) {
      cancelButton.disabled = false;
    }
  }
}


/* ==========================================================================
   会員外の請求先: 単独の新規登録・編集モーダル
   請求先別住所（renderBillingSection_/buildOtherPayeePayload_）とは
   別のDOM ID・別の関数を使い、既存の請求先別住所設定には影響しない。
   ========================================================================== */

/**
 * 会員外の請求先(OtherPayees)の新規登録・編集モーダルを開く。
 *
 * @param {string|null} id 編集対象のpayee_id。新規登録時はnull。
 */
async function openOtherPayeeForm_(id) {
  let record = null;

  if (id) {
    try {
      record = await api(
        'getPayeeDetail',
        { sourceType: 'other', sourceId: id }
      );

    } catch (error) {
      showBanner_(
        'danger',
        (error && error.message) ||
          'データの取得に失敗しました。'
      );
      return;
    }

    if (!record) {
      showBanner_(
        'danger',
        '対象のデータが見つかりませんでした。'
      );
      return;
    }
  }

  const isEdit = Boolean(record);
  const r = record || {};
  const title = isEdit ? '会員外の請求先を編集' : '会員外の請求先を登録';

  const bodyHtml = `
    <div id="other-payee-form-message"></div>

    <form id="other-payee-form" novalidate>
      <div class="member-form-section">
        <div class="member-form-grid">
          <div class="member-form-field member-form-field--wide">
            <label class="member-form-field__label" for="op-name">
              請求先名<span class="member-required">必須</span>
            </label>
            <input id="op-name" class="c-input" value="${escapeAttr_(r.name || '')}">
          </div>

          <div class="member-form-field">
            <label class="member-form-field__label" for="op-type">
              請求先種別
            </label>
            <input
              id="op-type"
              class="c-input"
              value="${escapeAttr_(r.payee_type || '')}"
              placeholder="例：法人／個人"
            >
          </div>

          <div class="member-form-field">
            <label class="member-form-field__label" for="op-contact-name">
              担当者名
            </label>
            <input id="op-contact-name" class="c-input" value="${escapeAttr_(r.contact_name || '')}">
          </div>

          <div class="member-form-field">
            <label class="member-form-field__label" for="op-postal-code">
              郵便番号
            </label>
            <input id="op-postal-code" type="text" inputmode="numeric" class="c-input" value="${escapeAttr_(String(r.postal_code || ''))}">
          </div>

          <div class="member-form-field">
            <label class="member-form-field__label" for="op-phone">
              電話番号
            </label>
            <input id="op-phone" type="tel" inputmode="tel" class="c-input" value="${escapeAttr_(String(r.phone || ''))}">
          </div>

          <div class="member-form-field member-form-field--wide">
            <label class="member-form-field__label" for="op-address">
              住所
            </label>
            <input id="op-address" class="c-input" value="${escapeAttr_(r.address || '')}">
          </div>

          <div class="member-form-field">
            <label class="member-form-field__label" for="op-email">
              メールアドレス
            </label>
            <input id="op-email" type="email" class="c-input" value="${escapeAttr_(r.email || '')}">
          </div>

          <div class="member-form-field">
            <label class="member-form-field__label" for="op-line">
              LINE送付可否
            </label>
            ${boolSelectHtml_('op-line', r.line_send_allowed, '可', '不可', false)}
          </div>

          <div class="member-form-field member-form-field--wide">
            <label class="member-form-field__label" for="op-remarks">
              備考
            </label>
            <textarea id="op-remarks" class="c-textarea" rows="3">${esc(r.remarks || '')}</textarea>
          </div>
        </div>
      </div>
    </form>
  `;

  const footerHtml = `
    <button type="button" class="btn" id="other-payee-form-cancel">
      キャンセル
    </button>

    <button
      type="submit"
      form="other-payee-form"
      class="btn primary"
      id="other-payee-form-submit"
    >
      保存する
    </button>
  `;

  openModalShell_(
    bodyHtml,
    {
      title,
      ariaLabel: title,
      footer: footerHtml
    }
  );

  const cancelButton =
    document.querySelector('#other-payee-form-cancel');

  if (cancelButton) {
    cancelButton.addEventListener(
      'click',
      function () {
        closeModal_();
      }
    );
  }

  const form =
    document.querySelector('#other-payee-form');

  if (form) {
    form.addEventListener(
      'submit',
      async function (event) {
        event.preventDefault();
        await submitOtherPayeeForm_(record);
      }
    );
  }
}


/**
 * 会員外の請求先フォームを検証し、既存のsaveOtherPayeeで保存する。
 * 新規actionは使わない。
 *
 * @param {Object|null} existingRecord 編集対象（新規登録時はnull）
 */
async function submitOtherPayeeForm_(existingRecord) {
  const messageEl =
    document.querySelector('#other-payee-form-message');

  const submitButton =
    document.querySelector('#other-payee-form-submit');

  const cancelButton =
    document.querySelector('#other-payee-form-cancel');

  if (messageEl) {
    messageEl.innerHTML = '';
  }

  const name = getInputValue_('#op-name');

  if (!name) {
    setFormMessage_(messageEl, '請求先名は必須です。');
    scrollMemberModalToError_();
    return;
  }

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = '保存中...';
  }

  if (cancelButton) {
    cancelButton.disabled = true;
  }

  try {
    const payload = buildStandaloneOtherPayeePayload_(existingRecord);

    await api('saveOtherPayee', payload);

    closeModal_();
    activeTab = 'other';

    showBanner_(
      'success',
      existingRecord
        ? '会員外の請求先を保存しました。'
        : '会員外の請求先を登録しました。'
    );

    await reloadItems_();

  } catch (error) {
    setFormMessage_(
      messageEl,
      (error && error.message) || '保存に失敗しました。'
    );
    scrollMemberModalToError_();

  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = '保存する';
    }

    if (cancelButton) {
      cancelButton.disabled = false;
    }
  }
}


/**
 * saveOtherPayeeへ送るpayloadを作る（単独の新規登録・編集モーダル用）。
 * 編集時はpayee_idを含め、新規登録時は既存のbuildOtherPayeePayload_と同様
 * 空文字を送る（既存仕様に合わせる）。
 * 電話番号・郵便番号は<input type="text">/<input type="tel">の値を
 * そのまま文字列として使うため、数値変換や先頭0の欠落は発生しない。
 *
 * @param {Object|null} existingRecord
 * @return {Object}
 */
function buildStandaloneOtherPayeePayload_(existingRecord) {
  const r = existingRecord || {};

  return {
    payee_id: r.payee_id || '',
    payee_type: getInputValue_('#op-type') || 'other',
    name: getInputValue_('#op-name'),
    contact_name: getInputValue_('#op-contact-name'),
    postal_code: getInputValue_('#op-postal-code'),
    address: getInputValue_('#op-address'),
    phone: getInputValue_('#op-phone'),
    email: getInputValue_('#op-email'),
    line_send_allowed: getSelectValue_('#op-line') === 'true',
    remarks: getInputValue_('#op-remarks')
  };
}


/* ==========================================================================
   フォーム共通ユーティリティ
   ========================================================================== */

/**
 * モーダル内の要素からトリム済み文字列値を取得する。
 *
 * @param {string} selector
 * @return {string}
 */
function getInputValue_(selector) {
  const el = document.querySelector(selector);
  return el ? String(el.value || '').trim() : '';
}


/**
 * モーダル内のselect要素から値を取得する。
 *
 * @param {string} selector
 * @return {string}
 */
function getSelectValue_(selector) {
  const el = document.querySelector(selector);
  return el ? el.value : '';
}


/**
 * 真偽値セレクトのHTMLを作る。
 *
 * @param {string} id
 * @param {*} rawValue
 * @param {string} trueLabel
 * @param {string} falseLabel
 * @param {boolean} defaultTrue rawValueが未設定（新規登録）の場合の初期値
 * @return {string}
 */
function boolSelectHtml_(id, rawValue, trueLabel, falseLabel, defaultTrue) {
  const hasValue =
    rawValue !== undefined && rawValue !== null && rawValue !== '';

  const isTrue =
    hasValue
      ? (rawValue === true || String(rawValue).toLowerCase() === 'true')
      : Boolean(defaultTrue);

  return `
    <select id="${id}" class="c-select">
      <option value="true" ${isTrue ? 'selected' : ''}>${esc(trueLabel)}</option>
      <option value="false" ${!isTrue ? 'selected' : ''}>${esc(falseLabel)}</option>
    </select>
  `;
}


/**
 * 日付文字列を<input type="date">用のyyyy-MM-dd形式に整える。
 *
 * @param {*} value
 * @return {string}
 */
function toDateInputValue_(value) {
  const s = String(value || '').trim();

  if (!s) {
    return '';
  }

  return s.slice(0, 10);
}


/**
 * 今日の日付をyyyy-MM-dd形式で返す。
 *
 * @return {string}
 */
function getTodayString_() {
  const date = new Date();
  const year = date.getFullYear();

  const month =
    String(date.getMonth() + 1).padStart(2, '0');

  const day =
    String(date.getDate()).padStart(2, '0');

  return [year, month, day].join('-');
}


/**
 * 日付をyyyy/MM/dd形式にする。
 *
 * @param {*} value
 * @return {string}
 */
function formatDate_(value) {
  const s = String(value || '').trim();

  if (!s) {
    return '';
  }

  const date = new Date(s);

  if (isNaN(date.getTime())) {
    return s;
  }

  const year = date.getFullYear();

  const month =
    String(date.getMonth() + 1).padStart(2, '0');

  const day =
    String(date.getDate()).padStart(2, '0');

  return [year, month, day].join('/');
}


/**
 * 日時をyyyy/MM/dd HH:mm形式にする。
 *
 * @param {*} value
 * @return {string}
 */
function formatDateTime_(value) {
  const s = String(value || '').trim();

  if (!s) {
    return '';
  }

  const date = new Date(s);

  if (isNaN(date.getTime())) {
    return s;
  }

  const year = date.getFullYear();

  const month =
    String(date.getMonth() + 1).padStart(2, '0');

  const day =
    String(date.getDate()).padStart(2, '0');

  const hours =
    String(date.getHours()).padStart(2, '0');

  const minutes =
    String(date.getMinutes()).padStart(2, '0');

  return year + '/' + month + '/' + day + ' ' + hours + ':' + minutes;
}


/**
 * フォームのエラーメッセージ表示を作る。
 *
 * @param {HTMLElement|null} el
 * @param {string} text
 */
function setFormMessage_(el, text) {
  if (!el) {
    return;
  }

  el.innerHTML = `
    <div class="c-alert c-alert--danger member-form-error" tabindex="-1">
      ${esc(text)}
    </div>
  `;
}


/**
 * 会員追加・編集モーダルでエラーが表示された際、モーダル上部へスクロールし
 * エラーアラートへフォーカスする。
 *
 * setFormMessage_でエラーをDOMへ反映した直後に呼ぶ想定。反映直後はまだ
 * レイアウトが確定していないことがあるため、requestAnimationFrameを2回
 * 挟んでから位置を計算する。
 */
function scrollMemberModalToError_() {
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      const errorEl =
        document.querySelector(
          '#member-modal-root .member-form-error'
        );

      if (!errorEl) {
        return;
      }

      const modalBody =
        document.querySelector(
          '#member-modal-root .c-modal__body'
        );

      const prefersReducedMotion =
        window.matchMedia &&
        window.matchMedia(
          '(prefers-reduced-motion: reduce)'
        ).matches;

      const behavior =
        prefersReducedMotion ? 'auto' : 'smooth';

      if (
        modalBody &&
        modalBody.scrollHeight > modalBody.clientHeight
      ) {
        if (typeof modalBody.scrollTo === 'function') {
          modalBody.scrollTo({ top: 0, behavior });
        } else {
          modalBody.scrollTop = 0;
        }
      } else if (typeof window.scrollTo === 'function') {
        window.scrollTo({ top: 0, behavior });
      }

      errorEl.focus({ preventScroll: true });
    });
  });
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
