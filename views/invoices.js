import { api } from '../assets/js/api.js';
import {
  esc,
  yen
} from '../assets/js/components.js';
import { go } from '../assets/js/router.js';

let currentItems = [];


/**
 * 請求書一覧を表示する。
 *
 * @param {Object} ctx
 * @return {Promise<string>}
 */
export async function render(ctx) {
  const data = await api(
    'listInvoices',
    {
      fiscalYear: ctx.fiscalYear
    }
  );

  currentItems =
    data.items ||
    data.invoices ||
    [];

  return `
    <div class="toolbar">
      <button
        type="button"
        class="btn primary"
        data-go="invoiceCreate"
      >
        新規作成
      </button>
    </div>

    <div class="panel table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>番号</th>
            <th>請求先</th>
            <th>件名</th>
            <th>金額</th>
            <th>状態</th>
            <th>操作</th>
          </tr>
        </thead>

        <tbody>
          ${renderRows_()}
        </tbody>
      </table>
    </div>
  `;
}


/**
 * 請求書一覧の行を作る。
 *
 * @return {string}
 */
function renderRows_() {
  if (!currentItems.length) {
    return `
      <tr>
        <td
          colspan="6"
          class="muted"
        >
          請求書はまだありません。
        </td>
      </tr>
    `;
  }

  return currentItems
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

  const statusLabel =
    getStatusLabel_(
      status,
      paymentStatus
    );

  return `
    <tr>
      <td>
        ${esc(
          invoice.invoice_number ||
          '下書き'
        )}
      </td>

      <td>
        ${esc(
          invoice.payee_name_snapshot ||
          ''
        )}
      </td>

      <td>
        ${esc(
          invoice.subject ||
          ''
        )}
      </td>

      <td>
        ${yen(
          invoice.total_incl_tax
        )}
      </td>

      <td>
        ${esc(statusLabel)}
      </td>

      <td>
        <div
          style="
            display:flex;
            gap:8px;
            flex-wrap:wrap;
          "
        >
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
 * 状態表示を作る。
 *
 * @param {string} status
 * @param {string} paymentStatus
 * @return {string}
 */
function getStatusLabel_(
  status,
  paymentStatus
) {
  let invoiceLabel = status;

  if (status === 'draft') {
    invoiceLabel = '下書き';
  } else if (status === 'issued') {
    invoiceLabel = '発行済み';
  } else if (
    status === 'void' ||
    status === 'voided'
  ) {
    invoiceLabel = '取消';
  }

  let paymentLabel = '';

  if (paymentStatus === 'paid') {
    paymentLabel = '・入金済み';
  } else if (
    paymentStatus === 'partial'
  ) {
    paymentLabel = '・一部入金';
  } else if (
    paymentStatus === 'unpaid'
  ) {
    paymentLabel = '・未入金';
  }

  return invoiceLabel + paymentLabel;
}


/**
 * 一覧画面のイベントを設定する。
 */
export function bind() {
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
 * HTML属性値用エスケープ。
 *
 * @param {*} value
 * @return {string}
 */
function escapeAttr_(value) {
  return esc(value)
    .replace(/`/g, '&#96;');
}
