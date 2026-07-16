import { api } from '../assets/js/api.js';
import {
  esc,
  yen
} from '../assets/js/components.js';
import { go } from '../assets/js/router.js';

let currentItems = [];
let searchTerm = '';
let statusFilter = 'all';

const STATUS_FILTERS = [
  { value: 'all', label: 'すべて' },
  { value: 'draft', label: '下書き' },
  { value: 'issued', label: '発行済み' },
  { value: 'unpaid', label: '未入金' },
  { value: 'paid', label: '入金済み' },
  { value: 'overdue', label: '期限超過' },
  { value: 'unsent', label: '未送付' },
  { value: 'sent', label: '送付済み' }
];


/**
 * 請求書一覧を表示する。
 *
 * @param {Object} ctx
 * @return {Promise<string>}
 */
export async function render(ctx) {
  searchTerm = '';
  statusFilter = 'all';

  let data;

  try {
    data = await api(
      'listInvoices',
      {
        fiscalYear: ctx.fiscalYear
      }
    );

  } catch (error) {
    return renderError_(error);
  }

 currentItems =
  (
    data.items ||
    data.invoices ||
    []
  ).slice().sort(
    function (a, b) {
      const numberA =
        String(
          a.invoice_number ||
          ''
        );

      const numberB =
        String(
          b.invoice_number ||
          ''
        );

      const isDraftA =
        !numberA;

      const isDraftB =
        !numberB;

      if (
        isDraftA &&
        !isDraftB
      ) {
        return 1;
      }

      if (
        !isDraftA &&
        isDraftB
      ) {
        return -1;
      }

      if (
        isDraftA &&
        isDraftB
      ) {
        const dateA =
          new Date(
            a.updated_at ||
            a.created_at ||
            0
          ).getTime();

        const dateB =
          new Date(
            b.updated_at ||
            b.created_at ||
            0
          ).getTime();

        return dateB - dateA;
      }

      return numberB.localeCompare(
        numberA,
        'ja',
        {
          numeric: true
        }
      );
    }
  );

  const filteredItems =
    getFilteredItems_();

  return `
    <div class="invoice-list-view">
      <div class="invoice-list-intro">
        請求書の発行・入金・送付状況を確認できます。
      </div>

      <div class="invoice-list-toolbar">
        <div class="invoice-list-toolbar__filters">
          <input
            type="search"
            class="c-input invoice-list-search"
            placeholder="請求書番号・請求先・件名で検索"
            value="${escapeAttr_(searchTerm)}"
          />

          <select class="c-select invoice-list-filter">
            ${
              STATUS_FILTERS
                .map(function (option) {
                  return `
                    <option value="${escapeAttr_(option.value)}">
                      ${esc(option.label)}
                    </option>
                  `;
                })
                .join('')
            }
          </select>
        </div>

        <div class="invoice-list-toolbar__actions">
          <button
            type="button"
            class="btn primary"
            data-go="invoiceCreate"
          >
            請求書を作成
          </button>

          <button
            type="button"
            class="btn"
            data-go="annualFees"
          >
            年会費を一括作成
          </button>
        </div>
      </div>

      <div
        class="invoice-list-count"
        id="invoice-list-count"
      >
        ${esc(getCountLabel_(filteredItems))}
      </div>

      <div class="invoice-list-desktop panel table-wrap">
        <table class="table invoice-table">
          <thead>
            <tr>
              <th>請求先</th>
              <th>請求書番号</th>
              <th>件名</th>
              <th>金額</th>
              <th>発行日</th>
              <th>支払期限</th>
              <th>請求状態</th>
              <th>入金状態</th>
              <th>送付状態</th>
              <th>操作</th>
            </tr>
          </thead>

          <tbody id="invoice-table-body">
            ${renderRows_(filteredItems)}
          </tbody>
        </table>
      </div>

      <div class="invoice-list-mobile">
        <div id="invoice-card-list">
          ${renderCards_(filteredItems)}
        </div>
      </div>
    </div>
  `;
}


/**
 * 検索語・状態フィルターを適用したcurrentItemsを返す。
 * currentItems自体は変更しない。
 *
 * @return {Array}
 */
function getFilteredItems_() {
  const term =
    searchTerm.trim().toLowerCase();

  return currentItems.filter(function (invoice) {
    return (
      invoiceMatchesSearch_(invoice, term) &&
      invoiceMatchesFilter_(invoice, statusFilter)
    );
  });
}


/**
 * 検索語に一致するか判定する（請求書番号・請求先・件名が対象）。
 *
 * @param {Object} invoice
 * @param {string} term
 * @return {boolean}
 */
function invoiceMatchesSearch_(invoice, term) {
  if (!term) {
    return true;
  }

  const haystack =
    [
      invoice.invoice_number,
      invoice.payee_name_snapshot,
      invoice.subject
    ]
      .map(function (value) {
        return String(value || '').toLowerCase();
      })
      .join(' ');

  return haystack.indexOf(term) >= 0;
}


/**
 * 状態フィルターに一致するか判定する。
 *
 * @param {Object} invoice
 * @param {string} filterValue
 * @return {boolean}
 */
function invoiceMatchesFilter_(invoice, filterValue) {
  if (filterValue === 'all') {
    return true;
  }

  const status =
    String(
      invoice.status || ''
    ).toLowerCase();

  const paymentStatus =
    String(
      invoice.payment_status || ''
    ).toLowerCase();

  const sendStatus =
    String(
      invoice.send_status || ''
    ).trim().toLowerCase();

  if (filterValue === 'draft') {
    return status === 'draft';
  }

  if (filterValue === 'issued') {
    return status === 'issued';
  }

  if (filterValue === 'paid') {
    return (
      paymentStatus === 'paid' ||
      paymentStatus === 'overpaid'
    );
  }

  if (filterValue === 'unpaid') {
    return (
      status === 'issued' &&
      paymentStatus !== 'paid' &&
      paymentStatus !== 'overpaid'
    );
  }

  if (filterValue === 'overdue') {
    return isOverdue_(
      status,
      paymentStatus,
      invoice.due_date
    );
  }

  if (filterValue === 'unsent') {
    return (
      sendStatus !== 'resent' &&
      sendStatus !== 'sent_postal' &&
      sendStatus !== 'sent_line'
    );
  }

  if (filterValue === 'sent') {
    return (
      sendStatus === 'resent' ||
      sendStatus === 'sent_postal' ||
      sendStatus === 'sent_line'
    );
  }

  return true;
}


/**
 * 支払期限を過ぎているか判定する
 * （発行済み・未入金・支払期限が今日より前）。
 *
 * @param {string} status
 * @param {string} paymentStatus
 * @param {*} dueDate
 * @return {boolean}
 */
function isOverdue_(
  status,
  paymentStatus,
  dueDate
) {
  if (status !== 'issued') {
    return false;
  }

  if (
    paymentStatus === 'paid' ||
    paymentStatus === 'overpaid'
  ) {
    return false;
  }

  if (!dueDate) {
    return false;
  }

  const due = new Date(dueDate);

  if (isNaN(due.getTime())) {
    return false;
  }

  const today = new Date();

  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  return due.getTime() < today.getTime();
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
 * ページ全体の再描画は行わない。
 */
function refreshList_() {
  const filteredItems =
    getFilteredItems_();

  const tbody =
    document.querySelector('#invoice-table-body');

  if (tbody) {
    tbody.innerHTML =
      renderRows_(filteredItems);
  }

  const cardList =
    document.querySelector('#invoice-card-list');

  if (cardList) {
    cardList.innerHTML =
      renderCards_(filteredItems);
  }

  const countEl =
    document.querySelector('#invoice-list-count');

  if (countEl) {
    countEl.textContent =
      getCountLabel_(filteredItems);
  }

  bindDetailButtons_();
  bindEditButtons_();
  bindPaymentButtons_();
}


/**
 * 請求書一覧の行を作る。
 *
 * @param {Array} items
 * @return {string}
 */
function renderRows_(items) {
  if (!currentItems.length) {
    return `
      <tr>
        <td
          colspan="10"
          class="invoice-list-empty"
        >
          <p>請求書はまだありません。</p>

          <button
            type="button"
            class="btn primary"
            data-go="invoiceCreate"
          >
            請求書を作成
          </button>
        </td>
      </tr>
    `;
  }

  if (!items.length) {
    return `
      <tr>
        <td
          colspan="10"
          class="invoice-list-empty"
        >
          <p>条件に一致する請求書がありません。</p>

          <button
            type="button"
            class="btn invoice-list-clear"
          >
            検索条件をクリア
          </button>
        </td>
      </tr>
    `;
  }

  return items
    .map(function (invoice) {
      return renderRow_(invoice);
    })
    .join('');
}


/**
 * 請求書1件の行を作る。
 *
 * @param {Object} invoice
 * @return {string}
 */
function renderRow_(invoice) {
  const invoiceId =
    String(
      invoice.invoice_id || ''
    );

  const status =
    String(
      invoice.status || ''
    ).toLowerCase();

  const paymentStatus =
    String(
      invoice.payment_status || ''
    ).toLowerCase();

  const pdfUrl =
    String(
      invoice.pdf_file_url || ''
    );

  const isDraft =
    status === 'draft';

  const canRegisterPayment =
    status === 'issued' &&
    paymentStatus !== 'paid' &&
    paymentStatus !== 'overpaid' &&
    Boolean(invoiceId);

  const resendCount =
    Number(
      invoice.resend_count || 0
    );

  const invoiceStatusBadge =
    getInvoiceStatusBadge_(status);

  const paymentStatusBadge =
    getPaymentStatusBadge_(paymentStatus);

  const sendStatusBadge =
    getSendStatusBadge_(
      invoice.send_status
    );

  const dueDateOverdue =
    isOverdue_(
      status,
      paymentStatus,
      invoice.due_date
    );

  return `
    <tr>
      <td>
        <span class="invoice-table__payee">
          ${esc(
            invoice.payee_name_snapshot ||
            ''
          )}
        </span>
      </td>

      <td class="invoice-table__number">
        ${esc(
          invoice.invoice_number ||
          '下書き'
        )}
      </td>

      <td>
        <span class="invoice-table__subject">
          ${esc(
            invoice.subject ||
            ''
          )}
        </span>
      </td>

      <td class="invoice-table__amount">
        ${yen(
          invoice.total_incl_tax
        )}
      </td>

      <td class="invoice-table__date">
        ${esc(
          formatDate_(
            invoice.issue_date
          )
        )}
      </td>

      <td class="invoice-table__date${
        dueDateOverdue
          ? ' invoice-table__date--overdue'
          : ''
      }">
        ${esc(
          formatDate_(
            invoice.due_date
          )
        )}
        ${
          dueDateOverdue
            ? '<span class="invoice-overdue-flag">超過</span>'
            : ''
        }
      </td>

      <td class="invoice-table__status">
        <span class="c-badge ${invoiceStatusBadge.className}">
          ${esc(invoiceStatusBadge.label)}
        </span>
      </td>

      <td class="invoice-table__status">
        <span class="c-badge ${paymentStatusBadge.className}">
          ${esc(paymentStatusBadge.label)}
        </span>
      </td>

      <td class="invoice-table__status">
        <span class="c-badge ${sendStatusBadge.className}">
          ${esc(sendStatusBadge.label)}
        </span>

        ${
          resendCount >= 1
            ? `
              <span class="invoice-table__resend">
                再送${resendCount}回
              </span>
            `
            : ''
        }
      </td>

      <td class="invoice-table__actions">
        <div class="invoice-table__actions-inner">
          ${
            invoiceId
              ? `
                <button
                  type="button"
                  class="btn invoice-detail"
                  data-invoice-id="${escapeAttr_(
                    invoiceId
                  )}"
                >
                  詳細
                </button>
              `
              : ''
          }

          ${
            isDraft && invoiceId
              ? `
                <button
                  type="button"
                  class="btn invoice-edit"
                  data-invoice-id="${escapeAttr_(
                    invoiceId
                  )}"
                >
                  編集
                </button>
              `
              : ''
          }

          ${
            canRegisterPayment
              ? `
                <button
                  type="button"
                  class="btn primary invoice-payment"
                  data-invoice-id="${escapeAttr_(
                    invoiceId
                  )}"
                  data-invoice-number="${escapeAttr_(
                    invoice.invoice_number || ''
                  )}"
                  data-payee-name="${escapeAttr_(
                    invoice.payee_name_snapshot || ''
                  )}"
                  data-total="${escapeAttr_(
                    invoice.total_incl_tax || 0
                  )}"
                >
                  入金登録
                </button>
              `
              : ''
          }

          ${
            pdfUrl
              ? `
                <a
                  class="btn"
                  href="${escapeAttr_(
                    pdfUrl
                  )}"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  PDFを開く
                </a>
              `
              : ''
          }
        </div>
      </td>
    </tr>
  `;
}


/**
 * モバイル用カード一覧を作る（PC版と同じfilteredItemsを使用）。
 *
 * @param {Array} items
 * @return {string}
 */
function renderCards_(items) {
  if (!currentItems.length) {
    return `
      <div class="invoice-list-empty">
        <p>請求書はまだありません。</p>

        <button
          type="button"
          class="btn primary"
          data-go="invoiceCreate"
        >
          請求書を作成
        </button>
      </div>
    `;
  }

  if (!items.length) {
    return `
      <div class="invoice-list-empty">
        <p>条件に一致する請求書がありません。</p>

        <button
          type="button"
          class="btn invoice-list-clear"
        >
          検索条件をクリア
        </button>
      </div>
    `;
  }

  return items
    .map(function (invoice) {
      return renderCard_(invoice);
    })
    .join('');
}


/**
 * 請求書1件のモバイルカードを作る。
 *
 * @param {Object} invoice
 * @return {string}
 */
function renderCard_(invoice) {
  const invoiceId =
    String(
      invoice.invoice_id || ''
    );

  const status =
    String(
      invoice.status || ''
    ).toLowerCase();

  const paymentStatus =
    String(
      invoice.payment_status || ''
    ).toLowerCase();

  const pdfUrl =
    String(
      invoice.pdf_file_url || ''
    );

  const isDraft =
    status === 'draft';

  const resendCount =
    Number(
      invoice.resend_count || 0
    );

  const invoiceStatusBadge =
    getInvoiceStatusBadge_(status);

  const paymentStatusBadge =
    getPaymentStatusBadge_(paymentStatus);

  const sendStatusBadge =
    getSendStatusBadge_(
      invoice.send_status
    );

  const dueDateOverdue =
    isOverdue_(
      status,
      paymentStatus,
      invoice.due_date
    );

  return `
    <div class="invoice-card">
      <div class="invoice-card__top">
        <div class="invoice-card__payee">
          ${esc(
            invoice.payee_name_snapshot ||
            ''
          )}
        </div>

        <div class="invoice-card__amount">
          ${yen(
            invoice.total_incl_tax
          )}
        </div>
      </div>

      <div class="invoice-card__number">
        ${esc(
          invoice.invoice_number ||
          '下書き'
        )}
      </div>

      <div class="invoice-card__subject">
        ${esc(
          invoice.subject ||
          ''
        )}
      </div>

      <div class="invoice-card__badges">
        <span class="c-badge ${invoiceStatusBadge.className}">
          ${esc(invoiceStatusBadge.label)}
        </span>

        <span class="c-badge ${paymentStatusBadge.className}">
          ${esc(paymentStatusBadge.label)}
        </span>

        <span class="c-badge ${sendStatusBadge.className}">
          ${esc(sendStatusBadge.label)}
        </span>

        ${
          resendCount >= 1
            ? `
              <span class="invoice-card__resend">
                再送${resendCount}回
              </span>
            `
            : ''
        }
      </div>

      <div class="invoice-card__meta">
        <div class="invoice-card__meta-row">
          <span class="invoice-card__meta-label">発行日</span>
          <span class="invoice-card__meta-value">
            ${esc(formatDate_(invoice.issue_date))}
          </span>
        </div>

        <div class="invoice-card__meta-row">
          <span class="invoice-card__meta-label">支払期限</span>
          <span class="invoice-card__meta-value${
            dueDateOverdue
              ? ' invoice-card__meta-value--overdue'
              : ''
          }">
            ${esc(formatDate_(invoice.due_date))}
            ${
              dueDateOverdue
                ? '<span class="invoice-overdue-flag">超過</span>'
                : ''
            }
          </span>
        </div>
      </div>

      <div class="invoice-card__actions">
        ${
          invoiceId
            ? `
              <button
                type="button"
                class="btn invoice-detail"
                data-invoice-id="${escapeAttr_(
                  invoiceId
                )}"
              >
                詳細
              </button>
            `
            : ''
        }

        ${
          pdfUrl
            ? `
              <a
                class="btn"
                href="${escapeAttr_(
                  pdfUrl
                )}"
                target="_blank"
                rel="noopener noreferrer"
              >
                PDFを開く
              </a>
            `
            : ''
        }

        ${
          isDraft && invoiceId
            ? `
              <button
                type="button"
                class="btn invoice-edit"
                data-invoice-id="${escapeAttr_(
                  invoiceId
                )}"
              >
                編集
              </button>
            `
            : ''
        }
      </div>
    </div>
  `;
}


/**
 * 請求状態バッジ（.c-badge系）を返す。
 *
 * @param {string} status
 * @return {{className: string, label: string}}
 */
function getInvoiceStatusBadge_(status) {
  if (status === 'draft') {
    return {
      className: 'c-badge--draft',
      label: '下書き'
    };
  }

  if (status === 'issued') {
    return {
      className: 'c-badge--issued',
      label: '発行済み'
    };
  }

  if (
    status === 'void' ||
    status === 'voided'
  ) {
    return {
      className: 'c-badge--cancelled',
      label: '取消'
    };
  }

  return {
    className: 'c-badge--draft',
    label: status || '―'
  };
}


/**
 * 入金状態バッジ（.c-badge系）を返す。
 *
 * @param {string} paymentStatus
 * @return {{className: string, label: string}}
 */
function getPaymentStatusBadge_(paymentStatus) {
  if (paymentStatus === 'paid') {
    return {
      className: 'c-badge--paid',
      label: '入金済み'
    };
  }

  if (
    paymentStatus === 'partially_paid' ||
    paymentStatus === 'partial'
  ) {
    return {
      className: 'c-badge--partial',
      label: '一部入金'
    };
  }

  if (paymentStatus === 'overpaid') {
    return {
      className: 'c-badge--paid',
      label: '過入金'
    };
  }

  return {
    className: 'c-badge--unpaid',
    label: '未入金'
  };
}


/**
 * 送付状態バッジ（.c-badge系）を返す。
 *
 * @param {*} sendStatus
 * @return {{className: string, label: string}}
 */
function getSendStatusBadge_(sendStatus) {
  const normalized =
    String(sendStatus || '')
      .trim()
      .toLowerCase();

  if (normalized === 'resent') {
    return {
      className: 'c-badge--resent',
      label: '再送済み'
    };
  }

  if (normalized === 'sent_postal') {
    return {
      className: 'c-badge--sent',
      label: '郵送済み'
    };
  }

  if (normalized === 'sent_line') {
    return {
      className: 'c-badge--sent',
      label: 'LINE送信済み'
    };
  }

  return {
    className: 'c-badge--unsent',
    label: '未送付'
  };
}


/**
 * 日付をyyyy/MM/dd形式で返す（invoiceDetail.jsのformatDate_と同じ表記）。
 *
 * @param {*} value
 * @return {string}
 */
function formatDate_(value) {
  if (!value) {
    return '―';
  }

  const date = new Date(value);

  if (isNaN(date.getTime())) {
    return String(value);
  }

  const year = date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, '0');

  const day =
    String(
      date.getDate()
    ).padStart(2, '0');

  return [
    year,
    month,
    day
  ].join('/');
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
    '請求書一覧の読み込みに失敗しました。';

  return `
    <div class="invoice-list-view">
      <div class="c-alert c-alert--danger invoice-list-error">
        ${esc(message)}
      </div>
    </div>
  `;
}


/**
 * 一覧画面のイベントを設定する。
 */
export function bind() {
  bindDetailButtons_();
  bindEditButtons_();
  bindPaymentButtons_();
  bindSearchAndFilter_();
}


/**
 * 検索・フィルター・条件クリアのイベントを設定する。
 * bind()は画面遷移ごとに1回だけ呼ばれるため、ここでの登録は重複しない。
 */
function bindSearchAndFilter_() {
  const searchInput =
    document.querySelector('.invoice-list-search');

  const filterSelect =
    document.querySelector('.invoice-list-filter');

  const view =
    document.querySelector('.invoice-list-view');

  if (searchInput) {
    searchInput.addEventListener(
      'input',
      function () {
        searchTerm = searchInput.value || '';
        refreshList_();
      }
    );
  }

  if (filterSelect) {
    filterSelect.value = statusFilter;

    filterSelect.addEventListener(
      'change',
      function () {
        statusFilter = filterSelect.value || 'all';
        refreshList_();
      }
    );
  }

  if (view) {
    view.addEventListener(
      'click',
      function (event) {
        const clearButton =
          event.target.closest(
            '.invoice-list-clear'
          );

        if (!clearButton) {
          return;
        }

        searchTerm = '';
        statusFilter = 'all';

        if (searchInput) {
          searchInput.value = '';
        }

        if (filterSelect) {
          filterSelect.value = 'all';
        }

        refreshList_();
      }
    );
  }
}


/**
 * 請求書詳細ボタンを設定する。
 */
function bindDetailButtons_() {
  document
    .querySelectorAll('.invoice-detail')
    .forEach(function (button) {
      button.addEventListener(
        'click',
        function () {
          const invoiceId =
            button.dataset.invoiceId || '';

          if (!invoiceId) {
            return;
          }

          go(
            'invoiceDetail',
            {
              invoiceId: invoiceId
            }
          );
        }
      );
    });
}

/**
 * 下書き編集ボタンを設定する。
 */
function bindEditButtons_() {
  document
    .querySelectorAll('.invoice-edit')
    .forEach(function (button) {
      button.addEventListener(
        'click',
        function () {
          const invoiceId =
            button.dataset.invoiceId || '';

          if (!invoiceId) {
            return;
          }

          go(
            'invoiceCreate',
            {
              invoiceId: invoiceId
            }
          );
        }
      );
    });
}


/**
 * 入金登録ボタンを設定する。
 */
function bindPaymentButtons_() {
  document
    .querySelectorAll('.invoice-payment')
    .forEach(function (button) {
      button.addEventListener(
        'click',
        async function () {
          await registerPayment_(
            button
          );
        }
      );
    });
}


/**
 * 入金情報を入力して登録する。
 *
 * MVPでは、まず標準入力画面を使用する。
 *
 * @param {HTMLButtonElement} button
 */
async function registerPayment_(button) {
  const invoiceId =
    button.dataset.invoiceId || '';

  const invoiceNumber =
    button.dataset.invoiceNumber || '';

  const payeeName =
    button.dataset.payeeName || '';

  const invoiceTotal =
    Number(
      button.dataset.total || 0
    );

  if (!invoiceId) {
    alert(
      '請求書IDを確認できません。'
    );
    return;
  }

  const today =
    getTodayString_();

  const paymentDate =
    window.prompt(
      [
        '入金日を入力してください。',
        '形式：年-月-日',
        '',
        invoiceNumber,
        payeeName
      ].join('\n'),
      today
    );

  if (paymentDate === null) {
    return;
  }

  const normalizedPaymentDate =
    String(paymentDate).trim();

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      normalizedPaymentDate
    )
  ) {
    alert(
      '入金日は「2026-07-13」の形式で入力してください。'
    );
    return;
  }

  const amountInput =
    window.prompt(
      '入金額を数字で入力してください。',
      String(invoiceTotal)
    );

  if (amountInput === null) {
    return;
  }

  const normalizedAmount =
    String(amountInput)
      .replace(/,/g, '')
      .trim();

  const amount =
    Number(normalizedAmount);

  if (
    !Number.isInteger(amount) ||
    amount <= 0
  ) {
    alert(
      '入金額は1円以上の整数で入力してください。'
    );
    return;
  }

  const paymentMethodInput =
    window.prompt(
      [
        '入金方法を入力してください。',
        '',
        '例：',
        '銀行振込',
        '現金',
        'その他'
      ].join('\n'),
      '銀行振込'
    );

  if (paymentMethodInput === null) {
    return;
  }

  const paymentMethod =
    String(
      paymentMethodInput
    ).trim();

  if (!paymentMethod) {
    alert(
      '入金方法を入力してください。'
    );
    return;
  }

  const payerNameInput =
    window.prompt(
      '振込名義・入金者名を入力してください。',
      payeeName
    );

  if (payerNameInput === null) {
    return;
  }

  const remarksInput =
    window.prompt(
      '備考があれば入力してください。',
      ''
    );

  if (remarksInput === null) {
    return;
  }

  const confirmed =
    window.confirm(
      [
        '次の内容で入金登録します。',
        '',
        '請求書：' +
          (
            invoiceNumber ||
            invoiceId
          ),
        '請求先：' +
          payeeName,
        '入金日：' +
          normalizedPaymentDate,
        '入金額：' +
          amount.toLocaleString(
            'ja-JP'
          ) +
          '円',
        '入金方法：' +
          paymentMethod,
        '',
        '登録してよろしいですか？'
      ].join('\n')
    );

  if (!confirmed) {
    return;
  }

  const originalText =
    button.textContent;

  button.disabled = true;
  button.textContent =
    '登録中...';

  try {
    const result = await api(
      'registerPayment',
      {
        invoiceId:
          invoiceId,

        paymentDate:
          normalizedPaymentDate,

        amount:
          amount,

        paymentMethod:
          paymentMethod,

        payerName:
          String(
            payerNameInput || ''
          ).trim(),

        remarks:
          String(
            remarksInput || ''
          ).trim()
      }
    );

    const paymentStatus =
      result.paymentStatus ||
      result.invoice?.payment_status ||
      '';

    let message =
      '入金を登録しました。';

    if (
      paymentStatus ===
      'partially_paid'
    ) {
      message =
        '一部入金として登録しました。';

    } else if (
      paymentStatus === 'paid'
    ) {
      message =
        '入金済みとして登録しました。';

    } else if (
      paymentStatus === 'overpaid'
    ) {
      message =
        '入金額が請求額を超えています。過入金として登録しました。';
    }

    alert(message);

    window.location.reload();

  } catch (error) {
    console.error(error);

    alert(
      error && error.message
        ? error.message
        : '入金登録に失敗しました。'
    );

    button.disabled = false;
    button.textContent =
      originalText;
  }
}


/**
 * 今日の日付をyyyy-MM-dd形式で返す。
 *
 * @return {string}
 */
function getTodayString_() {
  const now = new Date();

  const year =
    now.getFullYear();

  const month =
    String(
      now.getMonth() + 1
    ).padStart(2, '0');

  const day =
    String(
      now.getDate()
    ).padStart(2, '0');

  return [
    year,
    month,
    day
  ].join('-');
}


/**
 * HTML属性値用エスケープ。
 *
 * @param {*} value
 * @return {string}
 */
function escapeAttr_(value) {
  return esc(value)
    .replace(/`/g, '&#96;');
}
