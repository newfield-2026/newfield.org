import { api } from '../assets/js/api.js';

import {
  esc,
  yen
} from '../assets/js/components.js';

import { go } from '../assets/js/router.js';


let currentDetail = null;


/**
 * 請求書詳細画面を表示する。
 *
 * @param {Object} ctx
 * @return {Promise<string>}
 */
export async function render(ctx) {
  const invoiceId =
    String(
      ctx.invoiceId || ''
    ).trim();

  if (!invoiceId) {
    return `
      <div class="error">
        請求書IDが指定されていません。
      </div>

      <div class="toolbar">
        <button
          type="button"
          class="btn"
          data-go="invoices"
        >
          請求書一覧へ戻る
        </button>
      </div>
    `;
  }

  currentDetail = await api(
    'getInvoiceDetail',
    {
      invoiceId: invoiceId
    }
  );

  const invoice =
    currentDetail.invoice || {};

  const items =
    currentDetail.items || [];

  const payments =
    currentDetail.payments || [];

  return `
    <div class="toolbar">
      <button
        type="button"
        class="btn invoice-detail-back"
      >
        請求書一覧へ戻る
      </button>

      ${
        invoice.pdf_file_url
          ? `
            <a
              class="btn primary"
              href="${escapeAttr_(
                invoice.pdf_file_url
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

    <div class="panel">
      <h2>
        ${esc(
          invoice.invoice_number ||
          '請求書詳細'
        )}
      </h2>

      <div
        style="
          display:grid;
          grid-template-columns:
            repeat(
              auto-fit,
              minmax(220px, 1fr)
            );
          gap:16px;
          margin-top:20px;
        "
      >
        ${renderInfo_(
          '請求先',
          invoice.payee_name_snapshot
        )}

        ${renderInfo_(
          '件名',
          invoice.subject
        )}

        ${renderInfo_(
          '発行日',
          formatDate_(
            invoice.issue_date
          )
        )}

        ${renderInfo_(
          '支払期限',
          formatDate_(
            invoice.due_date
          )
        )}

        ${renderInfo_(
          '状態',
          getStatusLabel_(
            invoice.status,
            invoice.payment_status
          )
        )}

        ${renderInfo_(
          '請求区分',
          getInvoiceTypeLabel_(
            invoice.invoice_type
          )
        )}
      </div>
    </div>

    <div class="panel">
      <h2>請求金額</h2>

      <div
        style="
          display:grid;
          grid-template-columns:
            repeat(
              auto-fit,
              minmax(180px, 1fr)
            );
          gap:16px;
          margin-top:20px;
        "
      >
        ${renderAmount_(
          '請求額',
          invoice.total_incl_tax
        )}

        ${renderAmount_(
          '入金済額',
          invoice.payment_total
        )}

        ${renderAmount_(
          '残額',
          invoice.balance
        )}
      </div>
    </div>

    <div class="panel table-wrap">
      <h2>請求明細</h2>

      <table class="table">
        <thead>
          <tr>
            <th>品目</th>
            <th>数量</th>
            <th>単位</th>
            <th>税込単価</th>
            <th>金額</th>
            <th>備考</th>
          </tr>
        </thead>

        <tbody>
          ${renderItemRows_(items)}
        </tbody>
      </table>
    </div>

    <div class="panel table-wrap">
      <h2>入金履歴</h2>

      <table class="table">
        <thead>
          <tr>
            <th>入金日</th>
            <th>入金額</th>
            <th>入金方法</th>
            <th>入金者名</th>
            <th>備考</th>
          </tr>
        </thead>

        <tbody>
          ${renderPaymentRows_(
            payments
          )}
        </tbody>
      </table>
    </div>

    ${
      invoice.public_remarks
        ? `
          <div class="panel">
            <h2>請求書備考</h2>

            <p>
              ${esc(
                invoice.public_remarks
              )}
            </p>
          </div>
        `
        : ''
    }

    ${
      invoice.internal_note
        ? `
          <div class="panel">
            <h2>内部メモ</h2>

            <p>
              ${esc(
                invoice.internal_note
              )}
            </p>
          </div>
        `
        : ''
    }
  `;
}


/**
 * 画面イベントを設定する。
 */
export function bind() {
  const backButton =
    document.querySelector(
      '.invoice-detail-back'
    );

  if (backButton) {
    backButton.addEventListener(
      'click',
      function () {
        go('invoices');
      }
    );
  }
}


/**
 * 基本情報を表示する。
 *
 * @param {string} label
 * @param {*} value
 * @return {string}
 */
function renderInfo_(
  label,
  value
) {
  return `
    <div>
      <div class="muted">
        ${esc(label)}
      </div>

      <div
        style="
          margin-top:6px;
          font-weight:600;
        "
      >
        ${esc(
          value || '―'
        )}
      </div>
    </div>
  `;
}


/**
 * 金額情報を表示する。
 *
 * @param {string} label
 * @param {*} value
 * @return {string}
 */
function renderAmount_(
  label,
  value
) {
  return `
    <div>
      <div class="muted">
        ${esc(label)}
      </div>

      <div
        style="
          margin-top:6px;
          font-size:1.4rem;
          font-weight:700;
        "
      >
        ${yen(value)}
      </div>
    </div>
  `;
}


/**
 * 請求明細行を表示する。
 *
 * @param {Array} items
 * @return {string}
 */
function renderItemRows_(items) {
  if (!items.length) {
    return `
      <tr>
        <td
          colspan="6"
          class="muted"
        >
          請求明細はありません。
        </td>
      </tr>
    `;
  }

  return items
    .map(function (item) {
      return `
        <tr>
          <td>
            ${esc(
              item.item_name || ''
            )}
          </td>

          <td>
            ${esc(
              item.quantity || ''
            )}
          </td>

          <td>
            ${esc(
              item.unit || ''
            )}
          </td>

          <td>
            ${yen(
              item.unit_price_incl_tax
            )}
          </td>

          <td>
            ${yen(
              item.line_total_incl_tax
            )}
          </td>

          <td>
            ${esc(
              item.remarks || ''
            )}
          </td>
        </tr>
      `;
    })
    .join('');
}


/**
 * 入金履歴行を表示する。
 *
 * @param {Array} payments
 * @return {string}
 */
function renderPaymentRows_(
  payments
) {
  if (!payments.length) {
    return `
      <tr>
        <td
          colspan="5"
          class="muted"
        >
          入金履歴はありません。
        </td>
      </tr>
    `;
  }

  return payments
    .sort(function (a, b) {
      const dateA =
        new Date(
          a.payment_date || 0
        ).getTime();

      const dateB =
        new Date(
          b.payment_date || 0
        ).getTime();

      return dateB - dateA;
    })
    .map(function (payment) {
      return `
        <tr>
          <td>
            ${esc(
              formatDate_(
                payment.payment_date
              )
            )}
          </td>

          <td>
            ${yen(
              payment.amount
            )}
          </td>

          <td>
            ${esc(
              payment.payment_method ||
              ''
            )}
          </td>

          <td>
            ${esc(
              payment.payer_name ||
              ''
            )}
          </td>

          <td>
            ${esc(
              payment.remarks ||
              ''
            )}
          </td>
        </tr>
      `;
    })
    .join('');
}


/**
 * 請求書の状態表示を作る。
 *
 * @param {*} status
 * @param {*} paymentStatus
 * @return {string}
 */
function getStatusLabel_(
  status,
  paymentStatus
) {
  const normalizedStatus =
    String(
      status || ''
    ).toLowerCase();

  const normalizedPaymentStatus =
    String(
      paymentStatus || ''
    ).toLowerCase();

  let invoiceLabel =
    normalizedStatus;

  if (
    normalizedStatus === 'draft'
  ) {
    invoiceLabel = '下書き';

  } else if (
    normalizedStatus === 'issued'
  ) {
    invoiceLabel = '発行済み';

  } else if (
    normalizedStatus === 'void' ||
    normalizedStatus === 'voided'
  ) {
    invoiceLabel = '取消';
  }

  let paymentLabel = '';

  if (
    normalizedPaymentStatus ===
    'paid'
  ) {
    paymentLabel = '・入金済み';

  } else if (
    normalizedPaymentStatus ===
      'partially_paid' ||
    normalizedPaymentStatus ===
      'partial'
  ) {
    paymentLabel = '・一部入金';

  } else if (
    normalizedPaymentStatus ===
    'overpaid'
  ) {
    paymentLabel = '・過入金';

  } else if (
    normalizedPaymentStatus ===
    'unpaid'
  ) {
    paymentLabel = '・未入金';
  }

  return invoiceLabel + paymentLabel;
}


/**
 * 請求区分の表示名を返す。
 *
 * @param {*} invoiceType
 * @return {string}
 */
function getInvoiceTypeLabel_(
  invoiceType
) {
  const labels = {
    annual_fee:
      '年会費',

    sponsorship:
      '協賛金',

    event_fee:
      'イベント参加料',

    booth_fee:
      '出店料',

    other:
      'その他'
  };

  const normalized =
    String(
      invoiceType || ''
    );

  return (
    labels[normalized] ||
    normalized ||
    '―'
  );
}


/**
 * 日付をyyyy/MM/dd形式にする。
 *
 * @param {*} value
 * @return {string}
 */
function formatDate_(value) {
  if (!value) {
    return '';
  }

  const date =
    new Date(value);

  if (
    isNaN(
      date.getTime()
    )
  ) {
    return String(value);
  }

  const year =
    date.getFullYear();

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
