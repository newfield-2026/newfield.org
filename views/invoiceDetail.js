import { api } from '../assets/js/api.js';

import {
  esc,
  yen
} from '../assets/js/components.js';

import { go } from '../assets/js/router.js';


let currentDetail = null;
let currentSendMessage = '';
let lastRenderedInvoiceId = '';


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

  if (lastRenderedInvoiceId && lastRenderedInvoiceId !== invoiceId) {
    currentSendMessage = '';
  }

  lastRenderedInvoiceId = invoiceId;

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

  const sendLogs =
    Array.isArray(
      currentDetail.sendLogs
    )
      ? currentDetail.sendLogs
      : [];
  
  const status =
  String(
    invoice.status || ''
  ).toLowerCase();

  const paymentTotal =
  Number(
    invoice.payment_total || 0
  );

  const canVoid =
  status === 'issued' &&
  paymentTotal <= 0;

  const canSend =
  status === 'issued';

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

      ${
        canSend
          ? `
            <button
              type="button"
              class="btn primary invoice-send"
            >
              送付登録
            </button>
          `
          : ''
      }
      ${
  canVoid
    ? `
      <button
        type="button"
        class="btn invoice-void"
      >
        請求書を取り消す
      </button>
    `
    : ''
}
    </div>

    ${
      currentSendMessage
        ? `
          <div class="success" style="margin-bottom:12px;">
            ${esc(currentSendMessage)}
          </div>
        `
        : ''
    }

    ${
      canSend
        ? `
          <div
            id="invoice-send-panel"
            class="panel"
            style="display:none; margin-bottom:16px;"
          >
            <h2>送付登録</h2>

            <form id="invoice-send-form">
              <div
                style="
                  display:grid;
                  grid-template-columns:
                    repeat(auto-fit, minmax(220px, 1fr));
                  gap:16px;
                  margin-top:12px;
                "
              >
                <div>
                  <label class="muted" for="invoice-send-method">
                    送付方法
                  </label>
                  <select
                    id="invoice-send-method"
                    name="send_method"
                    class="invoice-send-method"
                    required
                  >
                    <option value="postal">郵送</option>
                    <option value="line">LINE</option>
                  </select>
                </div>

                <div>
                  <label class="muted" for="invoice-send-date">
                    送付日
                  </label>
                  <input
                    id="invoice-send-date"
                    name="sent_at"
                    type="date"
                    class="invoice-send-date"
                    value="${escapeAttr_(getTodayString_())}"
                    required
                  />
                </div>

                <div>
                  <label class="muted" for="invoice-send-destination">
                    送付先名
                  </label>
                  <input
                    id="invoice-send-destination"
                    name="destination_name"
                    type="text"
                    class="invoice-send-destination"
                    value="${escapeAttr_(
                      invoice.payee_name_snapshot || ''
                    )}"
                    required
                  />
                </div>
              </div>

              <div style="margin-top:16px;">
                <label class="muted" for="invoice-send-remarks">
                  備考
                </label>
                <textarea
                  id="invoice-send-remarks"
                  name="remarks"
                  class="invoice-send-remarks"
                  rows="3"
                  style="width:100%; margin-top:6px;"
                ></textarea>
              </div>

              <div style="margin-top:16px;">
                <button
                  type="submit"
                  class="btn primary invoice-send-submit"
                >
                  登録する
                </button>
              </div>
            </form>
          </div>
        `
        : ''
    }

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
          '送付状態',
          getSendStatusLabel_(
            invoice.send_status
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

    <div class="panel table-wrap">
      <h2>送付履歴</h2>

      <table class="table">
        <thead>
          <tr>
            <th>送付方法</th>
            <th>送付日</th>
            <th>送付先名</th>
            <th>再送回数</th>
            <th>備考</th>
            <th>登録者</th>
            <th>登録日時</th>
          </tr>
        </thead>

        <tbody>
          ${renderSendLogRows_(sendLogs)}
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

  const voidButton =
    document.querySelector(
      '.invoice-void'
    );

  if (voidButton) {
    voidButton.addEventListener(
      'click',
      async function () {
        await voidInvoice_(
          voidButton
        );
      }
    );
  }

  bindSendRegistration_();
}

/**
 * 送付登録のイベントを設定する。
 */
function bindSendRegistration_() {
  const sendButton =
    document.querySelector(
      '.invoice-send'
    );

  const formWrapper =
    document.querySelector(
      '#invoice-send-panel'
    );

  const form =
    document.querySelector(
      '#invoice-send-form'
    );

  if (
    !sendButton ||
    !formWrapper ||
    !form
  ) {
    return;
  }

  sendButton.addEventListener(
    'click',
    function (event) {
      event.preventDefault();

      const isVisible =
        formWrapper.style.display !==
        'none';

      formWrapper.style.display =
        isVisible ? 'none' : 'block';

      if (!isVisible) {
        const invoice =
          currentDetail?.invoice || {};

        const destinationInput =
          document.querySelector(
            '#invoice-send-destination'
          );

        const dateInput =
          document.querySelector(
            '#invoice-send-date'
          );

        const methodSelect =
          document.querySelector(
            '#invoice-send-method'
          );

        const remarksInput =
          document.querySelector(
            '#invoice-send-remarks'
          );

        if (destinationInput) {
          destinationInput.value =
            String(
              invoice.payee_name_snapshot ||
                ''
            ).trim();
        }

        if (dateInput) {
          dateInput.value =
            getTodayString_();
        }

        if (methodSelect) {
          methodSelect.value =
            'postal';
        }

        if (remarksInput) {
          remarksInput.value = '';
        }
      }
    }
  );

  form.addEventListener(
    'submit',
    async function (event) {
      event.preventDefault();

      const invoice =
        currentDetail?.invoice || {};

      const invoiceId =
        String(
          invoice.invoice_id || ''
        ).trim();

      const submitButton =
        document.querySelector(
          '.invoice-send-submit'
        );

      if (!invoiceId) {
        alert('請求書IDを確認できません。');
        return;
      }

      const originalText =
        sendButton.textContent;

      sendButton.disabled = true;
      sendButton.textContent =
        '登録中...';

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent =
          '登録中...';
      }

      try {
        const formData =
          new FormData(form);

        const payload = {
          invoice_id: invoiceId,
          send_method:
            formData.get('send_method') ||
            'postal',
          sent_at:
            formData.get('sent_at') ||
            getTodayString_(),
          destination_name:
            String(
              formData.get('destination_name') ||
                ''
            ).trim(),
          remarks:
            String(
              formData.get('remarks') || ''
            ).trim()
        };

        await api(
          'registerInvoiceSend',
          payload
        );

        currentSendMessage =
          '送付登録を完了しました。';

        go('invoiceDetail', {
          invoiceId: invoiceId,
          _ts: Date.now()
        });
      } catch (error) {
        console.error(error);

        alert(
          error && error.message
            ? error.message
            : '送付登録に失敗しました。'
        );

        sendButton.disabled = false;
        sendButton.textContent =
          originalText;

        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent =
            '登録する';
        }
      }
    }
  );
}
/**
 * 請求書を取り消す。
 *
 * @param {HTMLButtonElement} button
 */
async function voidInvoice_(button) {
  const invoice =
    currentDetail?.invoice || {};

  const invoiceId =
    String(
      invoice.invoice_id || ''
    ).trim();

  if (!invoiceId) {
    alert(
      '請求書IDを確認できません。'
    );
    return;
  }

  const reasonInput =
    window.prompt(
      [
        '取消理由を入力してください。',
        '',
        '例：請求内容を誤って発行したため'
      ].join('\n'),
      ''
    );

  if (reasonInput === null) {
    return;
  }

  const reason =
    String(
      reasonInput
    ).trim();

  if (!reason) {
    alert(
      '取消理由を入力してください。'
    );
    return;
  }

  const confirmed =
    window.confirm(
      [
        'この請求書を取り消します。',
        '',
        '請求書番号：' +
          (
            invoice.invoice_number ||
            invoiceId
          ),
        '請求先：' +
          (
            invoice.payee_name_snapshot ||
            ''
          ),
        '取消理由：' +
          reason,
        '',
        '取り消した請求書は元に戻せません。',
        '実行してよろしいですか？'
      ].join('\n')
    );

  if (!confirmed) {
    return;
  }

  const originalText =
    button.textContent;

  button.disabled = true;
  button.textContent =
    '取消処理中...';

  try {
    await api(
      'voidInvoice',
      {
        invoiceId:
          invoiceId,

        reason:
          reason
      }
    );

    alert(
      '請求書を取り消しました。'
    );

    go('invoices');

  } catch (error) {
    console.error(error);

    alert(
      error && error.message
        ? error.message
        : '請求書の取消に失敗しました。'
    );

    button.disabled = false;
    button.textContent =
      originalText;
  }
}

/**
 * 送付履歴行を表示する。
 *
 * @param {Array} sendLogs
 * @return {string}
 */
function renderSendLogRows_(sendLogs) {
  if (!sendLogs.length) {
    return `
      <tr>
        <td
          colspan="7"
          class="muted"
        >
          送付履歴はありません。
        </td>
      </tr>
    `;
  }

  return sendLogs
    .slice()
    .sort(function (a, b) {
      const dateA =
        new Date(
          a.created_at || 0
        ).getTime();

      const dateB =
        new Date(
          b.created_at || 0
        ).getTime();

      return dateB - dateA;
    })
    .map(function (log) {
      return `
        <tr>
          <td>
            ${esc(
              getSendMethodLabel_(
                log.send_method
              )
            )}
          </td>

          <td>
            ${esc(
              formatDate_(
                log.sent_at
              )
            )}
          </td>

          <td>
            ${esc(
              log.destination_name || ''
            )}
          </td>

          <td>
            ${esc(
              log.resend_count || 0
            )}
          </td>

          <td>
            ${esc(
              log.remarks || ''
            )}
          </td>

          <td>
            ${esc(
              log.sent_by || ''
            )}
          </td>

          <td>
            ${esc(
              formatDate_(
                log.created_at
              )
            )}
          </td>
        </tr>
      `;
    })
    .join('');
}

/**
 * 送付状態の表示名を返す。
 *
 * @param {*} sendStatus
 * @return {string}
 */
function getSendStatusLabel_(sendStatus) {
  const normalized =
    String(sendStatus || '')
      .trim()
      .toLowerCase();

  if (normalized === 'sent_postal') {
    return '郵送済み';
  }

  if (normalized === 'sent_line') {
    return 'LINE送信済み';
  }

  if (normalized === 'resent') {
    return '再送済み';
  }

  return sendStatus || '未登録';
}

/**
 * 送付方法の表示名を返す。
 *
 * @param {*} sendMethod
 * @return {string}
 */
function getSendMethodLabel_(sendMethod) {
  const normalized =
    String(sendMethod || '')
      .trim()
      .toLowerCase();

  if (normalized === 'postal') {
    return '郵送';
  }

  if (normalized === 'line') {
    return 'LINE';
  }

  return sendMethod || '―';
}

/**
 * 今日の日付をyyyy-MM-dd形式で返す。
 *
 * @return {string}
 */
function getTodayString_() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(
    date.getMonth() + 1
  ).padStart(2, '0');
  const day = String(
    date.getDate()
  ).padStart(2, '0');

  return [year, month, day].join('-');
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
