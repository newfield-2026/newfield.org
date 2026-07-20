import { api } from '../assets/js/api.js';
import { esc, yen } from '../assets/js/components.js';
import { go } from '../assets/js/router.js';

let master = null;
let currentInvoiceId = '';
let currentPayee = null;

/**
 * 下書き保存成功後に内容を変更したかどうか。
 * trueの間は発行を許可しない（古い保存内容のまま発行させないため）。
 */
let isDirty = false;

/**
 * 年会費自動計算のリクエスト通し番号。
 * 短時間に連続して請求先・請求区分・会計年度が変更された場合、
 * 呼び出し時点の番号と現在の番号が一致するレスポンスだけを反映する。
 */
let annualFeeRequestToken = 0;

/**
 * 「入力済みの明細を年会費の内容に置き換えますか？」を一度キャンセルした
 * 組み合わせ（sourceType|sourceId|fiscalYear）。同じ組み合わせのままでは
 * 再度確認しない。
 */
let annualFeeDeclinedKey = '';


/**
 * 請求書新規作成画面
 *
 * @param {Object} ctx
 * @return {Promise<string>}
 */
export async function render(ctx) {
  master = await api('getInvoiceCreateMaster');
  currentInvoiceId = ctx?.invoiceId || '';
  currentPayee = null;

  const fiscalYear =
    Number(master.fiscalYear) ||
    Number(ctx?.fiscalYear) ||
    new Date().getFullYear();

  const isEditMode =
    Boolean(currentInvoiceId);

  return `
    <div class="invoice-create-view">
      <div class="invoice-create-intro">
        <div class="invoice-create-intro__main">
          <div class="invoice-create-mode" id="invoice-create-mode">
            ${
              isEditMode
                ? `
                  <span class="c-badge c-badge--draft">下書き</span>
                  <span class="invoice-create-mode__text">
                    下書きを編集
                  </span>
                `
                : `
                  <span class="invoice-create-mode__text">
                    新しい請求書を作成
                  </span>
                `
            }
          </div>

          <p class="invoice-create-intro__text">
            請求先・請求情報・明細を確認しながら入力します。
          </p>
        </div>

        <div class="invoice-create-intro__actions">
          <button class="btn" data-go="invoices">
            請求書一覧へ戻る
          </button>
        </div>
      </div>

      <div id="invoice-message"></div>

      ${
        !isEditMode
          ? `
            <div class="c-alert c-alert--info invoice-create-note">
              下書き保存では正式な請求書番号は採番されません。発行時に採番されます。
            </div>
          `
          : ''
      }

      <div class="invoice-create-section">
        <div class="invoice-create-section__header">
          <div>
            <div class="invoice-create-section__title">請求先</div>
            <div class="invoice-create-section__description">
              請求書を送付する会員・団体を選択します
            </div>
          </div>
        </div>

        <div class="invoice-create-grid">
          <div class="invoice-create-field">
            <label class="invoice-create-field__label" for="invoice-type">
              請求区分
              <span class="invoice-create-required">必須</span>
            </label>
            <select id="invoice-type" class="c-select">
              ${renderInvoiceTypeOptions_()}
            </select>
          </div>

          <div class="invoice-create-field">
            <label class="invoice-create-field__label" for="invoice-payee">
              請求先
              <span class="invoice-create-required">必須</span>
            </label>
            <select id="invoice-payee" class="c-select">
              <option value="">選択してください</option>
              ${renderPayeeOptions_()}
            </select>
          </div>

          <div class="invoice-create-field">
            <label class="invoice-create-field__label" for="invoice-honorific">
              敬称
            </label>
            <select id="invoice-honorific" class="c-select">
              <option value="様">様</option>
              <option value="御中">御中</option>
            </select>
          </div>

          <div class="invoice-create-field">
            <label class="invoice-create-field__label" for="invoice-assigned-to">
              担当者
            </label>
            <input
              id="invoice-assigned-to"
              class="c-input"
              value="${escapeAttr_(master.user?.email || '')}"
            >
          </div>
        </div>

        <div class="invoice-create-payee-info__label">
          選択した請求先情報
        </div>

        <div
          id="invoice-payee-info"
          class="invoice-create-payee-info invoice-create-payee-info--empty"
        >
          請求先を選択してください。
        </div>
      </div>

      <div class="invoice-create-section">
        <div class="invoice-create-section__header">
          <div>
            <div class="invoice-create-section__title">請求情報</div>
            <div class="invoice-create-section__description">
              件名・発行日・支払期限を設定します
            </div>
          </div>
        </div>

        <div class="invoice-create-grid">
          <div class="invoice-create-field invoice-create-field--wide">
            <label class="invoice-create-field__label" for="invoice-subject">
              件名
              <span class="invoice-create-required">必須</span>
            </label>
            <input
              id="invoice-subject"
              class="c-input"
              value="${escapeAttr_(fiscalYear + '年度 年会費')}"
            >
          </div>

          <div class="invoice-create-field">
            <label class="invoice-create-field__label" for="invoice-issue-date">
              発行日
              <span class="invoice-create-required">必須</span>
            </label>
            <input
              id="invoice-issue-date"
              class="c-input"
              type="date"
              value="${escapeAttr_(master.today || '')}"
            >
          </div>

          <div class="invoice-create-field">
            <label class="invoice-create-field__label" for="invoice-due-date">
              支払期限
              <span class="invoice-create-required">必須</span>
            </label>
            <input
              id="invoice-due-date"
              class="c-input"
              type="date"
              value="${escapeAttr_(master.defaultDueDate || '')}"
            >
          </div>

          <div class="invoice-create-field">
            <label class="invoice-create-field__label" for="invoice-fiscal-year">
              会計年度
            </label>
            <input
              id="invoice-fiscal-year"
              class="c-input"
              type="number"
              value="${fiscalYear}"
              readonly
            >
          </div>
        </div>
      </div>

      <div class="invoice-create-section">
        <div class="invoice-create-items__header">
          <div>
            <div class="invoice-create-section__title">請求明細</div>
            <div class="invoice-create-section__description">
              請求内容と金額を入力します
            </div>
          </div>
        </div>

        <div
          id="invoice-annual-fee-info"
          class="invoice-annual-fee-info"
          hidden
        ></div>

        <div
          id="invoice-annual-fee-duplicate"
          class="invoice-annual-fee-duplicate"
          hidden
        ></div>

        <div class="invoice-create-items table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>品目</th>
                <th>数量</th>
                <th>単位</th>
                <th>税込単価</th>
                <th>税区分</th>
                <th>金額</th>
                <th></th>
              </tr>
            </thead>

            <tbody id="invoice-items"></tbody>
          </table>
        </div>

        <button
          type="button"
          class="btn invoice-create-items__add"
          id="invoice-add-item"
        >
          ＋ 明細を追加
        </button>

        <div class="invoice-create-totals">
          <div class="invoice-create-field invoice-create-totals__discount">
            <label class="invoice-create-field__label" for="invoice-discount">
              値引き
            </label>
            <input
              id="invoice-discount"
              class="c-input"
              type="number"
              min="0"
              step="1"
              value="0"
            >
          </div>

          <div class="invoice-create-total-row">
            <span>税込小計</span>
            <strong id="invoice-subtotal">0円</strong>
          </div>

          <div class="invoice-create-total-row">
            <span>値引き</span>
            <strong id="invoice-discount-total">0円</strong>
          </div>

          <div class="invoice-create-total-row">
            <span>うち消費税</span>
            <strong id="invoice-tax-total">0円</strong>
          </div>

          <div class="invoice-create-total-row invoice-create-total-row--grand">
            <span>合計</span>
            <strong id="invoice-grand-total">0円</strong>
          </div>
        </div>
      </div>

      <div class="invoice-create-section">
        <div class="invoice-create-section__header">
          <div>
            <div class="invoice-create-section__title">備考・内部メモ</div>
            <div class="invoice-create-section__description">
              請求書への表示内容と内部管理用メモを入力します
            </div>
          </div>
        </div>

        <div class="invoice-create-notes">
          <div class="invoice-create-field">
            <label class="invoice-create-field__label" for="invoice-public-remarks">
              請求書に表示する備考
            </label>
            <div class="invoice-create-field__hint">
              請求書PDFに表示されます。
            </div>

            <textarea
              id="invoice-public-remarks"
              class="c-textarea"
              rows="3"
            >恐れ入りますが、振込手数料はご負担くださいますようお願いいたします。</textarea>
          </div>

          <div class="invoice-create-field invoice-create-field--muted">
            <label class="invoice-create-field__label" for="invoice-internal-note">
              内部管理メモ
            </label>
            <div class="invoice-create-field__hint">
              請求書には表示されません。
            </div>

            <textarea
              id="invoice-internal-note"
              class="c-textarea"
              rows="3"
            ></textarea>
          </div>
        </div>
      </div>

      <div class="invoice-create-actions">
        <div class="invoice-create-actions__group">
          <button
            type="button"
            class="btn"
            data-go="invoices"
          >
            請求書一覧へ戻る
          </button>

          <button
            type="button"
            class="btn"
            id="invoice-reset"
          >
            入力をリセット
          </button>
        </div>

        <div class="invoice-create-actions__group">
          <button
            type="button"
            class="btn"
            id="invoice-issue"
            style="display:none"
          >
            請求書を発行
          </button>

          <button
            type="button"
            class="btn primary"
            id="invoice-save"
          >
            下書き保存
          </button>
        </div>
      </div>
    </div>
  `;
}


/**
 * 画面イベントを設定する。
 */
export function bind() {
  isDirty = false;

  const view =
    document.querySelector('.invoice-create-view');

  if (view) {
    // 保存ペイロードに含まれる入力項目全般（請求先・請求区分・発行日・
    // 支払期限・備考・明細の摘要/数量/単価/税区分・割引 等）の変更を
    // まとめて検知する。既存の個別input/changeリスナーとは別に、
    // 最小限の追加として親要素へ委譲する。
    view.addEventListener(
      'input',
      function () {
        isDirty = true;
      }
    );

    view.addEventListener(
      'change',
      function () {
        isDirty = true;
      }
    );

    view.addEventListener(
      'click',
      function (event) {
        if (
          event.target.closest('#invoice-add-item') ||
          event.target.closest('.invoice-item-delete')
        ) {
          isDirty = true;
        }
      }
    );
  }

  const invoiceType =
    document.querySelector('#invoice-type');

  const payee =
    document.querySelector('#invoice-payee');

  const issueDate =
    document.querySelector('#invoice-issue-date');

  const discount =
    document.querySelector('#invoice-discount');

  document
    .querySelector('#invoice-add-item')
    ?.addEventListener('click', function () {
      addItemRow_();
    });

  document
    .querySelector('#invoice-save')
    ?.addEventListener('click', saveDraft_);

  document
    .querySelector('#invoice-issue')
    ?.addEventListener('click', issueInvoice_);

  document
    .querySelector('#invoice-reset')
    ?.addEventListener('click', function () {
      currentInvoiceId = '';
      currentPayee = null;

      const fiscalYear =
        Number(master.fiscalYear) ||
        new Date().getFullYear();

      document.querySelector('#invoice-type').value =
        'annual_fee';

      document.querySelector('#invoice-payee').value =
        '';

      document.querySelector('#invoice-honorific').value =
        '様';

      document.querySelector('#invoice-assigned-to').value =
        master.user?.email || '';

      document.querySelector('#invoice-subject').value =
        fiscalYear + '年度 年会費';

      document.querySelector('#invoice-issue-date').value =
        master.today || '';

      document.querySelector('#invoice-due-date').value =
        master.defaultDueDate || '';

      document.querySelector('#invoice-fiscal-year').value =
        fiscalYear;

      document.querySelector('#invoice-discount').value =
        0;

      document.querySelector('#invoice-public-remarks').value =
        '恐れ入りますが、振込手数料はご負担くださいますようお願いいたします。';

      document.querySelector('#invoice-internal-note').value =
        '';

      document.querySelector('#invoice-payee-info').textContent =
        '請求先を選択してください。';

      document.querySelector('#invoice-items').innerHTML =
        '';

      clearMessage_();
      clearAnnualFeeInfo_();
      addItemRow_();
      recalc_();
    });

  invoiceType?.addEventListener(
    'change',
    onInvoiceTypeChange_
  );

  payee?.addEventListener(
    'change',
    onPayeeChange_
  );

  issueDate?.addEventListener(
    'change',
    setDefaultDueDate_
  );

  discount?.addEventListener(
    'input',
    recalc_
  );

  if (currentInvoiceId) {
  loadDraft_(currentInvoiceId);
} else {
  addItemRow_();
  recalc_();
}
}


/**
 * 請求区分選択肢を作る。
 *
 * @return {string}
 */
function renderInvoiceTypeOptions_() {
  return (master.invoiceTypes || [])
    .map(function (item) {
      return `
        <option
          value="${escapeAttr_(item.code)}"
        >
          ${esc(item.label)}
        </option>
      `;
    })
    .join('');
}


/**
 * 請求先選択肢を作る。
 *
 * @return {string}
 */
function renderPayeeOptions_() {
  return (master.payees || [])
    .map(function (item) {
      const label = item.memberType
        ? item.name + ' / ' + item.memberType
        : item.name;

      return `
        <option
          value="${escapeAttr_(
            item.sourceType + '|' + item.id
          )}"
        >
          ${esc(label)}
        </option>
      `;
    })
    .join('');
}


/**
 * 請求先選択時の処理。
 */
function onPayeeChange_() {
  clearMessage_();

  const select =
    document.querySelector('#invoice-payee');

  const raw = select?.value || '';

  if (!raw) {
    currentPayee = null;

    setPayeeInfo_(
      '請求先を選択してください。',
      true
    );

    maybeUpdateAnnualFee_();
    return;
  }

  const parts = raw.split('|');

  currentPayee = {
    type: parts[0] || '',
    id: parts[1] || ''
  };

  const selected =
    (master.payees || []).find(function (item) {
      return (
        String(item.sourceType) ===
          String(currentPayee.type) &&
        String(item.id) ===
          String(currentPayee.id)
      );
    });

  if (!selected) {
    setPayeeInfo_(
      '請求先情報を取得できませんでした。',
      true
    );

    maybeUpdateAnnualFee_();
    return;
  }

  const details = [
    selected.name,
    selected.memberType,
    selected.phone,
    selected.email
  ].filter(Boolean);

  setPayeeInfo_(
    details.join(' / '),
    false
  );

  maybeUpdateAnnualFee_();
}


/**
 * 請求先情報ボックスのテキストと、未選択時の見た目
 * （--emptyクラス）を切り替える。
 *
 * @param {string} text
 * @param {boolean} isEmpty
 */
function setPayeeInfo_(text, isEmpty) {
  const target =
    document.querySelector(
      '#invoice-payee-info'
    );

  if (!target) {
    return;
  }

  target.textContent = text;

  target.classList.toggle(
    'invoice-create-payee-info--empty',
    Boolean(isEmpty)
  );
}


/**
 * 請求区分に応じて件名を設定する。
 */
function onInvoiceTypeChange_() {
  const type =
    document.querySelector('#invoice-type')?.value ||
    '';

  const fiscalYear =
    document.querySelector(
      '#invoice-fiscal-year'
    )?.value || '';

  const labels = {
    annual_fee: '年会費',
    sponsorship: '協賛金',
    event_fee: 'イベント参加料',
    booth_fee: '出店料',
    other: 'その他'
  };

  const subject =
    type === 'annual_fee'
      ? fiscalYear + '年度 年会費'
      : labels[type] || '';

  document.querySelector(
    '#invoice-subject'
  ).value = subject;

  maybeUpdateAnnualFee_();
}


/**
 * 発行日に合わせて年度と支払期限を更新する。
 */
function setDefaultDueDate_() {
  const issueDateValue =
    document.querySelector(
      '#invoice-issue-date'
    )?.value || '';

  if (!issueDateValue) {
    return;
  }

  const date = new Date(
    issueDateValue + 'T00:00:00'
  );

  if (Number.isNaN(date.getTime())) {
    return;
  }

  const fiscalYear =
    date.getMonth() + 1 >= 7
      ? date.getFullYear()
      : date.getFullYear() - 1;

  const dueDate = new Date(
    date.getFullYear(),
    date.getMonth() + 2,
    0
  );

  document.querySelector(
    '#invoice-fiscal-year'
  ).value = fiscalYear;

  document.querySelector(
    '#invoice-due-date'
  ).value = formatDateInput_(dueDate);

  onInvoiceTypeChange_();
}


/* ==========================================================================
   年会費自動入力
   既存のgetInvoicePayeeSnapshot API（Apps Script側のbuildAnnualFeeProposal_・
   findAnnualFeeDuplicate_をそのまま利用）を呼ぶだけで、金額計算・会費区分の
   判定・免除判定・団体構成員数の扱いはフロントでは一切行わない。
   ========================================================================== */

/**
 * 請求区分・請求先・会計年度の状態に応じて年会費を再計算する。
 * 短時間に連続して呼ばれても、最後に発行したリクエストの結果だけを反映する。
 *
 * @param {{skipItemReplace?: boolean}=} options
 *   skipItemReplaceがtrueの場合、計算根拠・重複警告の表示は更新するが、
 *   明細の自動入力・上書き確認は行わない（下書き読込直後に使う）。
 */
async function maybeUpdateAnnualFee_(options) {
  const opts = options || {};

  const invoiceType =
    document.querySelector('#invoice-type')?.value || '';

  if (invoiceType !== 'annual_fee') {
    clearAnnualFeeInfo_();
    return;
  }

  if (
    !currentPayee ||
    !currentPayee.type ||
    !currentPayee.id ||
    (
      currentPayee.type !== 'member' &&
      currentPayee.type !== 'organization'
    )
  ) {
    clearAnnualFeeInfo_();
    return;
  }

  const fiscalYear = Number(
    document.querySelector('#invoice-fiscal-year')?.value || 0
  );

  if (!fiscalYear) {
    clearAnnualFeeInfo_();
    return;
  }

  const requestKey =
    currentPayee.type + '|' + currentPayee.id + '|' + fiscalYear;

  annualFeeRequestToken += 1;
  const requestId = annualFeeRequestToken;

  showAnnualFeeLoading_();

  let data;

  try {
    data = await api('getInvoicePayeeSnapshot', {
      sourceType: currentPayee.type,
      sourceId: currentPayee.id,
      fiscalYear: fiscalYear,
      excludeInvoiceId: currentInvoiceId || ''
    });

  } catch (error) {
    if (requestId !== annualFeeRequestToken) {
      return;
    }

    showAnnualFeeError_(
      error?.message || '年会費の計算に失敗しました。'
    );
    return;
  }

  if (requestId !== annualFeeRequestToken) {
    return;
  }

  const proposal = data.annualFeeProposal;

  renderAnnualFeeBasis_(proposal);
  renderDuplicateWarning_(data.duplicateInvoice);

  if (opts.skipItemReplace) {
    return;
  }

  if (
    !proposal ||
    proposal.exempt === true ||
    proposal.requiresMemberCount === true
  ) {
    return;
  }

  const proposalItems =
    Array.isArray(proposal.items) ? proposal.items : [];

  if (!proposalItems.length) {
    return;
  }

  const existingItems = collectItems_();

  if (!itemsAreEffectivelyEmpty_(existingItems)) {
    if (annualFeeDeclinedKey === requestKey) {
      return;
    }

    const confirmed = window.confirm(
      '入力済みの明細を年会費の内容に置き換えますか？'
    );

    if (!confirmed) {
      annualFeeDeclinedKey = requestKey;
      return;
    }
  }

  annualFeeDeclinedKey = '';
  replaceItemsWithAnnualFeeProposal_(proposalItems);
}


/**
 * 明細1行が実質的に入力済みかどうかを判定する。
 *
 * @param {Object} item collectItems_の1件
 * @return {boolean}
 */
function itemHasContent_(item) {
  return (
    String(item.item_name || '').trim() !== '' ||
    Number(item.unit_price_incl_tax || 0) !== 0 ||
    Number(item.quantity || 0) !== 1
  );
}


/**
 * 明細全体が「初期の1行だけで実質未入力」の状態かどうかを判定する。
 *
 * @param {Array<Object>} items
 * @return {boolean}
 */
function itemsAreEffectivelyEmpty_(items) {
  if (items.length === 0) {
    return true;
  }

  if (items.length > 1) {
    return false;
  }

  return !itemHasContent_(items[0]);
}


/**
 * annualFeeProposal.itemsで明細行を置き換える。
 * 既存のaddItemRow_・recalc_をそのまま再利用し、新しい金額計算は行わない。
 *
 * @param {Array<Object>} proposalItems
 */
function replaceItemsWithAnnualFeeProposal_(proposalItems) {
  const tbody =
    document.querySelector('#invoice-items');

  if (tbody) {
    tbody.innerHTML = '';
  }

  proposalItems.forEach(function (item) {
    addItemRow_({
      item_name: item.item_name || '',
      quantity: Number(item.quantity || 1),
      unit: item.unit || '式',
      unit_price_incl_tax: Number(item.unit_price_incl_tax || 0),
      tax_type: item.tax_type || 'taxable_10_inclusive'
    });
  });

  if (!proposalItems.length) {
    addItemRow_();
  }

  recalc_();

  isDirty = true;
}


/**
 * 年会費計算結果の表示領域（#invoice-annual-fee-info）を、
 * annualFeeProposalの内容に応じて更新する。
 *
 * @param {Object|null} proposal buildAnnualFeeProposal_の戻り値
 */
function renderAnnualFeeBasis_(proposal) {
  const el =
    document.querySelector('#invoice-annual-fee-info');

  if (!el) {
    return;
  }

  if (!proposal) {
    el.hidden = true;
    el.innerHTML = '';
    el.className = 'invoice-annual-fee-info';
    return;
  }

  el.hidden = false;

  if (proposal.exempt === true) {
    setAnnualFeeState_(
      el,
      'exempt',
      '免除',
      'この会員は年会費免除です。'
    );
    return;
  }

  if (proposal.requiresMemberCount === true) {
    setAnnualFeeState_(
      el,
      'warning',
      '未確認',
      '団体会員数が未確認のため自動計算できません。会員管理画面で人数を登録してください。'
    );
    return;
  }

  const amountText =
    yen(Number(proposal.amount || 0));

  const items =
    Array.isArray(proposal.items) ? proposal.items : [];

  if (Object.prototype.hasOwnProperty.call(proposal, 'currentCount')) {
    const baseItem = items[0];
    const perPersonItem = items[1];

    const bodyText =
      baseItem && perPersonItem
        ? '基本会費' +
          yen(Number(baseItem.unit_price_incl_tax || 0)) +
          '＋構成員' +
          Number(proposal.currentCount || 0) +
          '名×' +
          yen(Number(perPersonItem.unit_price_incl_tax || 0)) +
          '＝' +
          amountText
        : '団体会員の年会費：' + amountText;

    setAnnualFeeState_(el, 'success', '団体会員', bodyText);
    return;
  }

  const isOverride =
    items.some(function (item) {
      return item.calculation_source === 'member_override';
    });

  setAnnualFeeState_(
    el,
    'success',
    '年会費',
    (isOverride ? '個別設定された年会費：' : '標準年会費：') +
      amountText
  );
}


/**
 * #invoice-annual-fee-infoの表示内容をまとめて設定する。
 * 色だけでなく見出し文言・記号・文字ウェイトでも状態を区別する。
 *
 * @param {HTMLElement} el
 * @param {string} state 'loading' | 'success' | 'warning' | 'error' | 'exempt'
 * @param {string} heading
 * @param {string} bodyText
 */
function setAnnualFeeState_(el, state, heading, bodyText) {
  el.className =
    'invoice-annual-fee-info invoice-annual-fee-info--' + state;

  el.innerHTML = `
    <span class="invoice-annual-fee-info__icon" aria-hidden="true">
      ${esc(getAnnualFeeIcon_(state))}
    </span>

    <span class="invoice-annual-fee-info__text">
      <strong class="invoice-annual-fee-info__heading">
        ${esc(heading)}
      </strong>

      <span class="invoice-annual-fee-info__body">
        ${esc(bodyText)}
      </span>
    </span>
  `;
}


/**
 * 状態ごとの記号（アイコン相当）。
 *
 * @param {string} state
 * @return {string}
 */
function getAnnualFeeIcon_(state) {
  const icons = {
    loading: '…',
    success: '✓',
    warning: '！',
    error: '×',
    exempt: '－'
  };

  return icons[state] || '';
}


/**
 * 計算中の表示にする。
 */
function showAnnualFeeLoading_() {
  const el =
    document.querySelector('#invoice-annual-fee-info');

  if (!el) {
    return;
  }

  el.hidden = false;
  setAnnualFeeState_(el, 'loading', '年会費', '計算中…');
}


/**
 * エラー表示にする。既存の明細・フォーム内容には触れない。
 *
 * @param {string} message
 */
function showAnnualFeeError_(message) {
  const el =
    document.querySelector('#invoice-annual-fee-info');

  if (!el) {
    return;
  }

  el.hidden = false;
  setAnnualFeeState_(el, 'error', 'エラー', message);
}


/**
 * 年会費の計算根拠・重複警告表示をどちらも隠す。
 */
function clearAnnualFeeInfo_() {
  const el =
    document.querySelector('#invoice-annual-fee-info');

  if (el) {
    el.hidden = true;
    el.innerHTML = '';
    el.className = 'invoice-annual-fee-info';
  }

  clearDuplicateWarning_();
  annualFeeDeclinedKey = '';
}


/**
 * 同一年度の重複請求警告を更新する。
 * 編集中の下書き自身（currentInvoiceIdと同じinvoice_id）は警告しない。
 *
 * @param {Object|null} duplicate findAnnualFeeDuplicate_の結果
 */
function renderDuplicateWarning_(duplicate) {
  const el =
    document.querySelector('#invoice-annual-fee-duplicate');

  if (!el) {
    return;
  }

  if (
    !duplicate ||
    String(duplicate.invoice_id || '') === String(currentInvoiceId || '')
  ) {
    el.hidden = true;
    el.innerHTML = '';
    return;
  }

  const detailParts = [
    duplicate.invoice_number
      ? '請求書番号：' + duplicate.invoice_number
      : '',
    duplicate.status
      ? '状態：' + duplicate.status
      : ''
  ].filter(Boolean);

  const detailText =
    detailParts.length
      ? '（' + detailParts.join('／') + '）'
      : '';

  el.hidden = false;

  el.innerHTML = `
    <div class="c-alert c-alert--warning">
      同じ年度の年会費請求書が既に存在します。${esc(detailText)}
    </div>
  `;
}


/**
 * 重複請求警告だけを隠す。
 */
function clearDuplicateWarning_() {
  const el =
    document.querySelector('#invoice-annual-fee-duplicate');

  if (el) {
    el.hidden = true;
    el.innerHTML = '';
  }
}


/**
 * 明細行を追加する。
 *
 * @param {Object} item
 */
function addItemRow_(item = {}) {
  const tbody =
    document.querySelector('#invoice-items');

  if (!tbody) {
    return;
  }

  const row =
    document.createElement('tr');

  row.className = 'invoice-create-item';

  row.innerHTML = `
    <td data-label="品目">
      <input
        class="invoice-item-name c-input"
        value="${escapeAttr_(
          item.item_name || ''
        )}"
        placeholder="品目名"
      >
    </td>

    <td data-label="数量">
      <input
        class="invoice-item-quantity c-input"
        type="number"
        min="0"
        step="1"
        value="${
          typeof item.quantity === 'number'
            ? item.quantity
            : 1
        }"
      >
    </td>

    <td data-label="単位">
      <input
        class="invoice-item-unit c-input"
        value="${escapeAttr_(
          item.unit || '式'
        )}"
      >
    </td>

    <td data-label="税込単価">
      <input
        class="invoice-item-price c-input"
        type="number"
        min="0"
        step="1"
        value="${
          typeof item.unit_price_incl_tax ===
          'number'
            ? item.unit_price_incl_tax
            : 0
        }"
      >
    </td>

    <td data-label="税区分">
      <select class="invoice-item-tax c-select">
        ${renderTaxTypeOptions_(
          item.tax_type ||
          'taxable_10_inclusive'
        )}
      </select>
    </td>

    <td
      class="invoice-item-line"
      data-label="金額"
      style="text-align:right;white-space:nowrap"
    >
      0円
    </td>

    <td
      data-label="操作"
      class="invoice-create-item__actions"
    >
      <button
        type="button"
        class="btn invoice-item-delete"
      >
        削除
      </button>
    </td>
  `;

  row
    .querySelectorAll('input, select')
    .forEach(function (element) {
      element.addEventListener(
        'input',
        recalc_
      );

      element.addEventListener(
        'change',
        recalc_
      );
    });

  row
    .querySelector('.invoice-item-delete')
    ?.addEventListener('click', function () {
      row.remove();
      recalc_();
    });

  tbody.appendChild(row);

  recalc_();
}


/**
 * 税区分選択肢を作る。
 *
 * @param {string} selectedCode
 * @return {string}
 */
function renderTaxTypeOptions_(selectedCode) {
  return (master.taxTypes || [])
    .map(function (taxType) {
      const selected =
        String(taxType.code) ===
        String(selectedCode)
          ? 'selected'
          : '';

      return `
        <option
          value="${escapeAttr_(taxType.code)}"
          ${selected}
        >
          ${esc(taxType.label)}
        </option>
      `;
    })
    .join('');
}


/**
 * 明細を配列へ変換する。
 *
 * @return {Array<Object>}
 */
function collectItems_() {
  return [
    ...document.querySelectorAll(
      '#invoice-items tr'
    )
  ].map(function (row) {
    return {
      item_name:
        row.querySelector(
          '.invoice-item-name'
        )?.value || '',

      quantity: Number(
        row.querySelector(
          '.invoice-item-quantity'
        )?.value || 0
      ),

      unit:
        row.querySelector(
          '.invoice-item-unit'
        )?.value || '',

      unit_price_incl_tax: Number(
        row.querySelector(
          '.invoice-item-price'
        )?.value || 0
      ),

      tax_type:
        row.querySelector(
          '.invoice-item-tax'
        )?.value || '',

      calculation_source: 'manual'
    };
  });
}


/**
 * 金額を再計算する。
 */
function recalc_() {
  const rows = [
    ...document.querySelectorAll(
      '#invoice-items tr'
    )
  ];

  rows.forEach(function (row) {
    const quantity = Number(
      row.querySelector(
        '.invoice-item-quantity'
      )?.value || 0
    );

    const price = Number(
      row.querySelector(
        '.invoice-item-price'
      )?.value || 0
    );

    const lineTotal =
      Math.round(quantity * price);

    const lineCell =
      row.querySelector(
        '.invoice-item-line'
      );

    if (lineCell) {
      lineCell.textContent = yen(lineTotal);
    }
  });

  const totals = calculateLocalTotals_(
    collectItems_(),
    Number(
      document.querySelector(
        '#invoice-discount'
      )?.value || 0
    )
  );

  document.querySelector(
    '#invoice-subtotal'
  ).textContent = yen(
    totals.subtotalInclTax
  );

  document.querySelector(
    '#invoice-discount-total'
  ).textContent = yen(
    totals.discountAmount
  );

  document.querySelector(
    '#invoice-tax-total'
  ).textContent = yen(
    totals.taxAmount
  );

  document.querySelector(
    '#invoice-grand-total'
  ).textContent = yen(
    totals.totalInclTax
  );
}


/**
 * 画面表示用の簡易計算。
 *
 * 最終的な金額はGAS側でも再計算する。
 *
 * @param {Array<Object>} items
 * @param {number} discount
 * @return {Object}
 */
function calculateLocalTotals_(
  items,
  discount
) {
  const subtotalInclTax =
    items.reduce(function (total, item) {
      return total + Math.round(
        Number(item.quantity || 0) *
        Number(item.unit_price_incl_tax || 0)
      );
    }, 0);

  const discountAmount =
    Math.max(
      0,
      Math.round(
        Number(discount || 0)
      )
    );

  const totalInclTax =
    Math.max(
      0,
      subtotalInclTax - discountAmount
    );

  const taxableTotal =
    items
      .filter(function (item) {
        return (
          item.tax_type ===
          'taxable_10_inclusive'
        );
      })
      .reduce(function (total, item) {
        return total + Math.round(
          Number(item.quantity || 0) *
          Number(item.unit_price_incl_tax || 0)
        );
      }, 0);

  const taxableAfterDiscount =
    subtotalInclTax > 0
      ? Math.round(
          taxableTotal *
          Math.min(
            1,
            totalInclTax /
            subtotalInclTax
          )
        )
      : 0;

  return {
    subtotalInclTax: subtotalInclTax,
    discountAmount: discountAmount,
    totalInclTax: totalInclTax,
    taxAmount: Math.round(
      taxableAfterDiscount * 10 / 110
    )
  };
}


/**
 * 下書きを保存する。
 */
async function saveDraft_() {
  clearMessage_();

  if (!currentPayee) {
    showError_(
      '請求先を選択してください。'
    );
    return;
  }

  const items = collectItems_();

  if (items.length === 0) {
    showError_(
      '請求明細を1行以上入力してください。'
    );
    return;
  }

  const payload = {
    invoice_id:
      currentInvoiceId || '',

    invoice_type:
      document.querySelector(
        '#invoice-type'
      )?.value || '',

    subject:
      document.querySelector(
        '#invoice-subject'
      )?.value || '',

    payee_source_type:
      currentPayee.type,

    payee_source_id:
      currentPayee.id,

    honorific:
      document.querySelector(
        '#invoice-honorific'
      )?.value || '',

    issue_date:
      document.querySelector(
        '#invoice-issue-date'
      )?.value || '',

    due_date:
      document.querySelector(
        '#invoice-due-date'
      )?.value || '',

    fiscal_year: Number(
      document.querySelector(
        '#invoice-fiscal-year'
      )?.value || 0
    ),

    discount_amount: Number(
      document.querySelector(
        '#invoice-discount'
      )?.value || 0
    ),

    assigned_to:
      document.querySelector(
        '#invoice-assigned-to'
      )?.value || '',

    internal_note:
      document.querySelector(
        '#invoice-internal-note'
      )?.value || '',

    public_remarks:
      document.querySelector(
        '#invoice-public-remarks'
      )?.value || '',

    items: items
  };

  const saveButton =
    document.querySelector(
      '#invoice-save'
    );

  try {
    if (saveButton) {
      saveButton.disabled = true;
      saveButton.textContent =
        '保存中…';
    }

    const result = await api(
      'saveInvoiceDraft',
      payload
    );

    currentInvoiceId =
      result.invoice?.invoice_id || '';

    showSuccess_(
      '下書きを保存しました。'
    );

    if (currentInvoiceId) {
      const issueButtonAfterSave =
        document.querySelector('#invoice-issue');

      if (issueButtonAfterSave) {
        issueButtonAfterSave.style.display = '';
        issueButtonAfterSave.disabled = false;
        issueButtonAfterSave.textContent =
          '請求書を発行';
      }

      updateModeIndicator_(result.invoice || {});
    }

    isDirty = false;

  } catch (error) {
    showError_(
      error?.message ||
      '下書き保存に失敗しました。'
    );

  } finally {
    if (saveButton) {
      saveButton.disabled = false;
      saveButton.textContent =
        '下書き保存';
    }
  }
}


/**
 * メッセージを消す。
 */
function clearMessage_() {
  const message =
    document.querySelector(
      '#invoice-message'
    );

  if (message) {
    message.innerHTML = '';
  }
}


/**
 * エラーを表示する。
 *
 * @param {string} message
 */
function showError_(message) {
  const target =
    document.querySelector(
      '#invoice-message'
    );

  if (!target) {
    return;
  }

  target.innerHTML = `
    <div class="c-alert c-alert--danger invoice-create-message">
      ${esc(message)}
    </div>
  `;

  scrollToInvoiceMessage_();
}


/**
 * 成功メッセージを表示する。
 *
 * @param {string} message
 */
function showSuccess_(message) {
  const target =
    document.querySelector(
      '#invoice-message'
    );

  if (!target) {
    return;
  }

  target.innerHTML = `
    <div class="c-alert c-alert--success invoice-create-message">
      ${esc(message)}
    </div>
  `;

  scrollToInvoiceMessage_();
}


/**
 * #invoice-message内の実際のアラート要素へスクロール・フォーカスする。
 * showSuccess_/showError_の末尾から呼ばれるため、下書き保存・発行・
 * その他このメッセージ領域を使う処理すべてに自動的に効く。
 */
function scrollToInvoiceMessage_() {
  const alertEl =
    document.querySelector(
      '#invoice-message .c-alert'
    );

  if (!alertEl) {
    return;
  }

  alertEl.setAttribute('tabindex', '-1');

  requestAnimationFrame(function () {
    const prefersReducedMotion =
      window.matchMedia &&
      window.matchMedia(
        '(prefers-reduced-motion: reduce)'
      ).matches;

    const behavior =
      prefersReducedMotion ? 'auto' : 'smooth';

    if (typeof alertEl.scrollIntoView === 'function') {
      alertEl.scrollIntoView({
        behavior: behavior,
        block: 'start'
      });
    }

    try {
      alertEl.focus({ preventScroll: true });
    } catch (error) {
      // フォーカスに失敗しても表示・スクロールには影響させない。
    }
  });
}


/**
 * input value用エスケープ。
 *
 * @param {*} value
 * @return {string}
 */
function escapeAttr_(value) {
  return esc(value)
    .replace(/`/g, '&#96;');
}


/**
 * Dateをyyyy-MM-dd形式へ変換する。
 *
 * @param {Date} date
 * @return {string}
 */
function formatDateInput_(date) {
  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, '0');

  const day = String(
    date.getDate()
  ).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * 保存済み下書きを画面へ読み込む。
 *
 * @param {string} invoiceId
 */
async function loadDraft_(invoiceId) {
  try {
    const data = await api(
      'getInvoiceDraft',
      {
        invoiceId: invoiceId
      }
    );

    const invoice = data.invoice || {};
    const items = data.items || [];

    document.querySelector(
      '#invoice-type'
    ).value = invoice.invoice_type || '';

    document.querySelector(
      '#invoice-payee'
    ).value =
      (invoice.payee_source_type || '') +
      '|' +
      (invoice.payee_source_id || '');

    document.querySelector(
      '#invoice-subject'
    ).value = invoice.subject || '';

    document.querySelector(
      '#invoice-honorific'
    ).value =
      invoice.honorific_snapshot || '様';

    document.querySelector(
      '#invoice-assigned-to'
    ).value =
      invoice.assigned_to ||
      master.user?.email ||
      '';

    document.querySelector(
      '#invoice-issue-date'
    ).value = invoice.issue_date || '';

    document.querySelector(
      '#invoice-due-date'
    ).value = invoice.due_date || '';

    document.querySelector(
      '#invoice-fiscal-year'
    ).value =
      invoice.fiscal_year ||
      master.fiscalYear ||
      '';

    document.querySelector(
      '#invoice-discount'
    ).value =
      invoice.discount_amount || 0;

    document.querySelector(
      '#invoice-public-remarks'
    ).value =
      invoice.public_remarks || '';

    document.querySelector(
      '#invoice-internal-note'
    ).value =
      invoice.internal_note || '';

    currentPayee = {
      type: invoice.payee_source_type || '',
      id: invoice.payee_source_id || ''
    };

    const selectedPayee =
      (master.payees || []).find(function (payee) {
        return (
          String(payee.sourceType) ===
            String(currentPayee.type) &&
          String(payee.id) ===
            String(currentPayee.id)
        );
      });

    const payeeInfo = document.querySelector(
      '#invoice-payee-info'
    );

    if (payeeInfo) {
      payeeInfo.textContent = selectedPayee
        ? [
            selectedPayee.name,
            selectedPayee.memberType,
            selectedPayee.phone,
            selectedPayee.email
          ]
            .filter(Boolean)
            .join(' / ')
        : '請求先情報を取得できませんでした。';

      payeeInfo.classList.toggle(
        'invoice-create-payee-info--empty',
        !selectedPayee
      );
    }

    const tbody = document.querySelector(
      '#invoice-items'
    );

    if (tbody) {
      tbody.innerHTML = '';
    }

    if (items.length) {
      items.forEach(function (item) {
        addItemRow_(item);
      });
    } else {
      addItemRow_();
    }

    recalc_();

    updateModeIndicator_(invoice);

    maybeUpdateAnnualFee_({ skipItemReplace: true });

const issueButton =
  document.querySelector('#invoice-issue');

if (issueButton) {
  issueButton.style.display = '';
}

showSuccess_(
  '保存済みの下書きを編集中です。'
);

isDirty = false;

  } catch (error) {
    showError_(
      error?.message ||
      '下書きの読み込みに失敗しました。'
    );
  }
}


/**
 * 編集モードのモード表示へ、下書き読み込み後の情報
 * （請求書番号が存在する場合のみ）を反映する。
 *
 * @param {Object} invoice
 */
function updateModeIndicator_(invoice) {
  const textEl =
    document.querySelector(
      '.invoice-create-mode__text'
    );

  if (!textEl) {
    return;
  }

  const invoiceNumber =
    String(
      invoice.invoice_number || ''
    ).trim();

  textEl.textContent =
    invoiceNumber
      ? '下書きを編集（' + invoiceNumber + '）'
      : '下書きを編集';
}

/**
 * 請求書を発行する。
 */
async function issueInvoice_() {
  clearMessage_();

  if (!currentInvoiceId) {
    showError_(
      '先に下書きを保存してください。'
    );
    return;
  }

  if (isDirty) {
    showError_(
      '保存されていない変更があります。先に下書きを保存してください。'
    );
    return;
  }

  const confirmed = window.confirm(
    'この請求書を発行しますか？\n' +
    '発行後は請求書番号が採番され、下書き編集はできなくなります。'
  );

  if (!confirmed) {
    return;
  }

  const issueButton =
    document.querySelector('#invoice-issue');

  try {
    if (issueButton) {
      issueButton.disabled = true;
      issueButton.textContent = '発行中…';
    }

    const result = await api(
      'issueInvoice',
      {
        invoiceId: currentInvoiceId
      }
    );

    const invoiceNumber =
      result.invoice?.invoice_number || '';

    const issuedInvoiceId =
      result.invoice?.invoice_id || '';

    const warning =
      result.warning || '';

    showSuccess_(
      warning
        ? '請求書を発行しました。' +
          invoiceNumber +
          '／' +
          warning
        : '請求書を発行しました。' +
          (
            invoiceNumber
              ? ' 請求書番号：' +
                invoiceNumber
              : ''
          )
    );

    if (issueButton) {
      issueButton.style.display = 'none';
    }

    const saveButton =
      document.querySelector('#invoice-save');

    if (saveButton) {
      saveButton.style.display = 'none';
    }

    if (issuedInvoiceId) {
      go('invoiceDetail', { invoiceId: issuedInvoiceId });
    }

  } catch (error) {
    showError_(
      error?.message ||
      '請求書の発行に失敗しました。'
    );

    if (issueButton) {
      issueButton.disabled = false;
      issueButton.textContent =
        '請求書を発行';
    }
  }
}
