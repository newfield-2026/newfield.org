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

    <div class="invoice-list-desktop panel table-wrap">
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

    <div class="invoice-list-mobile">
      ${renderCards_()}
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

  const canRegisterPayment =
    status === 'issued' &&
    paymentStatus !== 'paid' &&
    paymentStatus !== 'overpaid' &&
    Boolean(invoiceId);

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
 * モバイル用カード一覧を作る（PC版と同じcurrentItemsを使用）。
 *
 * @return {string}
 */
function renderCards_() {
  if (!currentItems.length) {
    return `
      <div class="muted">
        請求書はまだありません。
      </div>
    `;
  }

  return currentItems
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
          <span class="invoice-card__meta-value">
            ${esc(formatDate_(invoice.due_date))}
          </span>
        </div>

        ${
          resendCount >= 1
            ? `
              <div class="invoice-card__meta-row">
                <span class="invoice-card__meta-label">再送回数</span>
                <span class="invoice-card__meta-value">
                  ${resendCount}回
                </span>
              </div>
            `
            : ''
        }
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
    paymentStatus === 'partially_paid' ||
    paymentStatus === 'partial'
  ) {
    paymentLabel = '・一部入金';

  } else if (
    paymentStatus === 'overpaid'
  ) {
    paymentLabel = '・過入金';

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
  bindDetailButtons_();
  bindEditButtons_();
  bindPaymentButtons_();
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
