import { api } from '../assets/js/api.js';
import { esc, yen } from '../assets/js/components.js';
import { go } from '../assets/js/router.js';

let currentItems = [];


/**
 * 請求書一覧を表示する。
 *
 * @param {Object} ctx
 * @return {Promise<string>}
 */
export async function render(ctx) {
  const data = await api('listInvoices', {
    fiscalYear: ctx.fiscalYear
  });

  currentItems =
    data.items ||
    data.invoices ||
    [];

  return `
    <div class="toolbar">
      <button
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
            <th></th>
          </tr>
        </thead>

        <tbody>
          ${
            currentItems.length
              ? currentItems
                  .map(function (invoice) {
                    const invoiceId =
                      invoice.invoice_id || '';

                    const isDraft =
                      String(
                        invoice.status || ''
                      ).toLowerCase() === 'draft';

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
                          ${esc(
                            invoice.payment_status ||
                            invoice.status ||
                            ''
                          )}
                        </td>

                        <td>
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
                        </td>
                      </tr>
                    `;
                  })
                  .join('')
              : `
                <tr>
                  <td
                    colspan="6"
                    class="muted"
                  >
                    請求書はまだありません。
                  </td>
                </tr>
              `
          }
        </tbody>
      </table>
    </div>
  `;
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

          go('invoiceCreate', {
            invoiceId: invoiceId
          });
        }
      );
    });
}


/**
 * 属性値用エスケープ。
 *
 * @param {*} value
 * @return {string}
 */
function escapeAttr_(value) {
  return esc(value)
    .replace(/`/g, '&#96;');
}
