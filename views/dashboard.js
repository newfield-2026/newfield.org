import { api } from '../assets/js/api.js';
import {
  esc,
  yen
} from '../assets/js/components.js';
import { go } from '../assets/js/router.js';


/**
 * ダッシュボード画面を表示する。
 *
 * @param {Object} ctx
 * @return {Promise<string>}
 */
export async function render(ctx) {
  let data;

  try {
    data = await api(
      'dashboard',
      {
        fiscalYear: ctx.fiscalYear
      }
    );

  } catch (error) {
    return renderError_(error);
  }

  const attentionRows =
    Array.isArray(
      data.attentionRows
    )
      ? data.attentionRows
      : [];

  const updatedAtLabel =
    getUpdatedAtLabel_();

  return `
    <div class="dashboard-view">
      <div class="dashboard-intro">
        <div class="dashboard-intro__text">
          請求・入金状況を確認できます。
        </div>

        <div class="dashboard-updated">
          最終更新 ${esc(updatedAtLabel)}
        </div>
      </div>

      <div class="toolbar">
        <button
          type="button"
          class="btn primary"
          data-go="invoiceCreate"
        >
          請求書を新規作成
        </button>

        <button
          type="button"
          class="btn"
          data-go="annualFees"
        >
          年会費を一括作成
        </button>
      </div>

      <div class="dashboard-summary">
        ${renderSummaryCard_(
          '未入金額',
          yen(data.unpaidAmount),
          '未回収の請求があります',
          false
        )}

        ${renderOverdueCard_(
          data.overdueAmount
        )}

        ${renderSummaryCard_(
          '当年度請求額',
          yen(data.totalInvoiceAmount),
          '',
          false
        )}

        ${renderSummaryCard_(
          '当年度入金額',
          yen(data.totalPaymentAmount),
          '',
          false
        )}
      </div>

      <div class="dashboard-section">
        <div class="dashboard-section__header">
          <div class="dashboard-section__title">
            対応が必要な項目${
              attentionRows.length
                ? `（${attentionRows.length}件）`
                : ''
            }
          </div>

          <button
            type="button"
            class="dashboard-section__action"
            data-go="invoices"
          >
            請求書一覧で確認
          </button>
        </div>

        ${renderAttentionSection_(attentionRows)}
      </div>
    </div>
  `;
}


/**
 * サマリーカードを1枚作る。
 *
 * @param {string} label
 * @param {string} value
 * @param {string} note
 * @param {boolean} isDanger
 * @return {string}
 */
function renderSummaryCard_(
  label,
  value,
  note,
  isDanger
) {
  return `
    <div class="dashboard-summary-card${
      isDanger
        ? ' dashboard-summary-card--danger'
        : ''
    }">
      <div class="dashboard-summary-card__label">
        ${esc(label)}
      </div>

      <div class="dashboard-summary-card__value">
        ${value}
      </div>

      ${
        note
          ? `
            <div class="dashboard-summary-card__note">
              ${esc(note)}
            </div>
          `
          : ''
      }
    </div>
  `;
}


/**
 * 期限超過カードを作る。
 *
 * 件数(overdueCount)はAPIレスポンスに存在しないため、
 * 金額(overdueAmount)が1円以上かどうかで強調要否を判定する。
 *
 * @param {*} overdueAmount
 * @return {string}
 */
function renderOverdueCard_(overdueAmount) {
  const amount =
    Number(
      overdueAmount || 0
    );

  const hasOverdue =
    amount > 0;

  return renderSummaryCard_(
    '期限超過',
    yen(amount),
    hasOverdue
      ? '確認が必要です'
      : '期限超過なし',
    hasOverdue
  );
}


/**
 * 「対応が必要な項目」セクションの中身を作る。
 *
 * @param {Array} attentionRows
 * @return {string}
 */
function renderAttentionSection_(attentionRows) {
  if (!attentionRows.length) {
    return `
      <p class="dashboard-empty">
        現在、対応が必要な請求書はありません。
      </p>
    `;
  }

  const visibleRows =
    attentionRows.slice(0, 8);

  return `
    <ul class="dashboard-task-list">
      ${
        visibleRows
          .map(function (row) {
            return renderAttentionItem_(row);
          })
          .join('')
      }
    </ul>
  `;
}


/**
 * 対応が必要な項目1件分を作る。
 *
 * APIレスポンスの形式が確定していない項目
 * （invoiceId/amount/dueDate等）は、存在する場合のみ表示する。
 *
 * @param {Object} row
 * @return {string}
 */
function renderAttentionItem_(row) {
  const kind =
    String(
      row.type ||
      row.kind ||
      ''
    ).trim();

  const name =
    String(
      row.name ||
      row.target ||
      ''
    ).trim();

  const message =
    String(
      row.message ||
      row.detail ||
      ''
    ).trim();

  const invoiceId =
    String(
      row.invoiceId ||
      row.invoice_id ||
      ''
    ).trim();

  const amount =
    row.amount != null
      ? row.amount
      : row.total != null
        ? row.total
        : row.total_incl_tax;

  const dueDate =
    row.dueDate ||
    row.due_date ||
    '';

  return `
    <li class="dashboard-task-item">
      <div class="dashboard-task-item__main">
        ${
          kind
            ? `
              <span class="dashboard-task-item__kind">
                ${esc(kind)}
              </span>
            `
            : ''
        }

        <span class="dashboard-task-item__name">
          ${esc(name || '―')}
        </span>
      </div>

      ${
        message
          ? `
            <div class="dashboard-task-item__message">
              ${esc(message)}
            </div>
          `
          : ''
      }

      ${
        amount != null ||
        dueDate
          ? `
            <div class="dashboard-task-item__meta">
              ${
                amount != null
                  ? `
                    <span class="dashboard-task-item__amount">
                      ${yen(amount)}
                    </span>
                  `
                  : ''
              }

              ${
                dueDate
                  ? `
                    <span class="dashboard-task-item__due">
                      ${esc(String(dueDate))}
                    </span>
                  `
                  : ''
              }
            </div>
          `
          : ''
      }

      ${
        invoiceId
          ? `
            <button
              type="button"
              class="btn dashboard-task-item__action"
              data-invoice-id="${escapeAttr_(invoiceId)}"
            >
              詳細
            </button>
          `
          : ''
      }
    </li>
  `;
}


/**
 * データ取得完了時刻(HH:mm)を返す。
 *
 * 業務データの更新日時ではなく、画面がこの内容を取得した時刻。
 *
 * @return {string}
 */
function getUpdatedAtLabel_() {
  const now = new Date();

  const hours =
    String(
      now.getHours()
    ).padStart(2, '0');

  const minutes =
    String(
      now.getMinutes()
    ).padStart(2, '0');

  return hours + ':' + minutes;
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
    'ダッシュボードの読み込みに失敗しました。';

  return `
    <div class="dashboard-view">
      <div class="c-alert c-alert--danger dashboard-error">
        ${esc(message)}
      </div>
    </div>
  `;
}


/**
 * 画面イベントを設定する。
 */
export function bind() {
  document
    .querySelectorAll('.dashboard-task-item__action')
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
