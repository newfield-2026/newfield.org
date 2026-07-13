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

  return `
    <div class="toolbar">
      <button class="btn" data-go="invoices">
        請求書一覧へ戻る
      </button>
    </div>

    <div id="invoice-message"></div>

    <div class="panel" style="margin-bottom:16px">
      <h2>請求書新規作成</h2>
      <p class="muted">
        下書き保存では正式な請求書番号は採番されません。
      </p>
    </div>

    <div class="panel" style="margin-bottom:16px">
      <h3>1. 請求区分・請求先</h3>

      <div class="form-grid">
        <div class="field">
          <label for="invoice-type">請求区分 必須</label>
          <select id="invoice-type">
            ${renderInvoiceTypeOptions_()}
          </select>
        </div>

        <div class="field">
          <label for="invoice-payee">請求先 必須</label>
          <select id="invoice-payee">
            <option value="">選択してください</option>
            ${renderPayeeOptions_()}
          </select>
        </div>

        <div class="field">
          <label for="invoice-honorific">敬称</label>
          <select id="invoice-honorific">
            <option value="様">様</option>
            <option value="御中">御中</option>
          </select>
        </div>

        <div class="field">
          <label for="invoice-assigned-to">担当者</label>
          <input
            id="invoice-assigned-to"
            value="${escapeAttr_(master.user?.email || '')}"
          >
        </div>
      </div>

      <div
        id="invoice-payee-info"
        class="muted"
        style="margin-top:12px"
      >
        請求先を選択してください。
      </div>
    </div>

    <div class="panel" style="margin-bottom:16px">
      <h3>2. 請求書情報</h3>

      <div class="form-grid">
        <div class="field field-full">
          <label for="invoice-subject">件名 必須</label>
          <input
            id="invoice-subject"
            value="${escapeAttr_(fiscalYear + '年度 年会費')}"
          >
        </div>

        <div class="field">
          <label for="invoice-issue-date">発行日 必須</label>
          <input
            id="invoice-issue-date"
            type="date"
            value="${escapeAttr_(master.today || '')}"
          >
        </div>

        <div class="field">
          <label for="invoice-due-date">支払期限 必須</label>
          <input
            id="invoice-due-date"
            type="date"
            value="${escapeAttr_(master.defaultDueDate || '')}"
          >
        </div>

        <div class="field">
          <label for="invoice-fiscal-year">会計年度</label>
          <input
            id="invoice-fiscal-year"
            type="number"
            value="${fiscalYear}"
            readonly
          >
        </div>

        <div class="field">
          <label for="invoice-discount">値引き</label>
          <input
            id="invoice-discount"
            type="number"
            min="0"
            step="1"
            value="0"
          >
        </div>
      </div>
    </div>

    <div class="panel" style="margin-bottom:16px">
      <div
        style="
          display:flex;
          justify-content:space-between;
          align-items:center;
          gap:12px;
          margin-bottom:12px;
        "
      >
        <h3 style="margin:0">3. 請求明細</h3>

        <button
          type="button"
          class="btn"
          id="invoice-add-item"
        >
          ＋ 明細を追加
        </button>
      </div>

      <div class="table-wrap">
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

      <div
        style="
          margin-top:16px;
          display:grid;
          grid-template-columns:1fr auto;
          gap:8px 24px;
          justify-content:end;
        "
      >
        <span class="muted">税込小計</span>
        <strong id="invoice-subtotal">0円</strong>

        <span class="muted">値引き</span>
        <strong id="invoice-discount-total">0円</strong>

        <span class="muted">うち消費税</span>
        <strong id="invoice-tax-total">0円</strong>

        <span>合計</span>
        <strong id="invoice-grand-total">0円</strong>
      </div>
    </div>

    <div class="panel" style="margin-bottom:16px">
      <h3>4. 備考</h3>

      <div class="field">
        <label for="invoice-public-remarks">
          請求書に表示する備考
        </label>

        <textarea
          id="invoice-public-remarks"
          rows="3"
        >恐れ入りますが、振込手数料はご負担くださいますようお願いいたします。</textarea>
      </div>

      <div class="field" style="margin-top:12px">
        <label for="invoice-internal-note">
          内部管理メモ
        </label>

        <textarea
          id="invoice-internal-note"
          rows="3"
        ></textarea>
      </div>
    </div>

    <div
      style="
        display:flex;
        justify-content:flex-end;
        gap:10px;
        margin-bottom:24px;
      "
    >
      <button
        type="button"
        class="btn"
        id="invoice-reset"
      >
        入力をリセット
      </button>

      <button
        type="button"
        class="btn primary"
        id="invoice-save"
      >
        下書き保存
      </button>
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

    document.querySelector(
      '#invoice-payee-info'
    ).textContent =
      '請求先を選択してください。';

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
    document.querySelector(
      '#invoice-payee-info'
    ).textContent =
      '請求先情報を取得できませんでした。';

    return;
  }

  const details = [
    selected.name,
    selected.memberType,
    selected.phone,
    selected.email
  ].filter(Boolean);

  document.querySelector(
    '#invoice-payee-info'
  ).textContent = details.join(' / ');
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

  row.innerHTML = `
    <td>
      <input
        class="invoice-item-name"
        value="${escapeAttr_(
          item.item_name || ''
        )}"
        placeholder="品目名"
      >
    </td>

    <td>
      <input
        class="invoice-item-quantity"
        type="number"
        min="0"
        step="1"
        value="${
          typeof item.quantity === 'number'
            ? item.quantity
            : 1
        }"
        style="width:80px"
      >
    </td>

    <td>
      <input
        class="invoice-item-unit"
        value="${escapeAttr_(
          item.unit || '式'
        )}"
        style="width:80px"
      >
    </td>

    <td>
      <input
        class="invoice-item-price"
        type="number"
        min="0"
        step="1"
        value="${
          typeof item.unit_price_incl_tax ===
          'number'
            ? item.unit_price_incl_tax
            : 0
        }"
        style="width:120px"
      >
    </td>

    <td>
      <select class="invoice-item-tax">
        ${renderTaxTypeOptions_(
          item.tax_type ||
          'taxable_10_inclusive'
        )}
      </select>
    </td>

    <td
      class="invoice-item-line"
      style="text-align:right;white-space:nowrap"
    >
      0円
    </td>

    <td>
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
    <div class="error">
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
    <div
      class="panel"
      style="
        margin-bottom:16px;
        border-color:#9bd3ad;
        background:#eef9f1;
      "
    >
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

    showSuccess_(
      '保存済みの下書きを編集中です。'
    );

    recalc_();

  } catch (error) {
    showError_(
      error?.message ||
      '下書きの読み込みに失敗しました。'
    );
  }
}
