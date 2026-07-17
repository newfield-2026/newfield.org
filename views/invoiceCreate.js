import { api } from '../assets/js/api.js';
import { esc, yen } from '../assets/js/components.js';

let master = null;
let currentInvoiceId = '';
let currentPayee = null;


/**
 * 請求書新規作成画面
 *
 * @param {Object} ctx
 * @return {Promise<string>}
 */
export async function render(ctx) {
  master = await api('getInvoiceCreateMaster');
  currentInvoiceId = ctx?.invoiceId || '';

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

const issueButton =
  document.querySelector('#invoice-issue');

if (issueButton) {
  issueButton.style.display = '';
}

showSuccess_(
  '保存済みの下書きを編集中です。'
);

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
