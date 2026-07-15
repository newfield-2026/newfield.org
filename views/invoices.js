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
