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
      <div class="invoice-detail-view">
        <div class="c-alert c-alert--danger invoice-detail-error">
          請求書IDが指定されていません。
        </div>

        <div class="invoice-detail-toolbar">
          <button
            type="button"
            class="btn"
            data-go="invoices"
          >
            請求書一覧へ戻る
          </button>
        </div>
      </div>
    `;
  }

  try {
    currentDetail = await api(
      'getInvoiceDetail',
      {
        invoiceId: invoiceId
      }
    );

  } catch (error) {
    return renderError_(error);
  }

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

  const paymentStatus =
    String(
      invoice.payment_status || ''
    ).toLowerCase();

  const paymentTotal =
    Number(
      invoice.payment_total || 0
    );

  const isDraft =
    status === 'draft';

  const canVoid =
    status === 'issued' &&
    paymentTotal <= 0;

  const canSend =
    status === 'issued';

  const dueDateOverdue =
    isOverdue_(
      status,
      paymentStatus,
      invoice.due_date
    );

  const invoiceStatusBadge =
    getInvoiceStatusBadge_(status);

  const paymentStatusBadge =
    getPaymentStatusBadge_(paymentStatus);

  const invoiceNumberLabel =
    invoice.invoice_number ||
    (isDraft ? '下書き' : '請求書詳細');

  const primaryAction =
    isDraft
      ? 'edit'
      : canSend
        ? 'send'
        : (invoice.pdf_file_url ? 'pdf' : '');

  return `
    <div class="invoice-detail-view">
      <div class="invoice-detail-toolbar">
        <div class="invoice-detail-toolbar__back">
          <button
            type="button"
            class="btn invoice-detail-back"
          >
            請求書一覧へ戻る
          </button>
        </div>

        <div class="invoice-detail-toolbar__actions">
          ${
            invoice.pdf_file_url
              ? `
                <a
                  class="btn${
                    primaryAction === 'pdf'
                      ? ' primary'
                      : ''
                  }"
                  href="${escapeAttr_(
                    invoice.pdf_file_url
                  )}"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  PDFを新しいタブで開く
                </a>
              `
              : ''
          }

          ${
            isDraft && invoice.invoice_id
              ? `
                <button
                  type="button"
                  class="btn${
                    primaryAction === 'edit'
                      ? ' primary'
                      : ''
                  } invoice-detail-edit"
                >
                  編集
                </button>
              `
              : ''
          }

          ${
            canSend
              ? `
                <button
                  type="button"
                  class="btn${
                    primaryAction === 'send'
                      ? ' primary'
                      : ''
                  } invoice-send"
                >
                  送付登録
                </button>
              `
              : ''
          }
        </div>
      </div>

      ${
        currentSendMessage
          ? `
            <div class="c-alert c-alert--success invoice-detail-message">
              ${esc(currentSendMessage)}
            </div>
          `
          : ''
      }

      <div class="invoice-detail-summary">
        <div class="invoice-detail-summary__main">
          <div class="invoice-detail-summary__payee">
            ${esc(
              invoice.payee_name_snapshot ||
              '―'
            )}
          </div>

          <div class="invoice-detail-summary__number">
            ${esc(invoiceNumberLabel)}
          </div>
        </div>

        <div class="invoice-detail-summary__amount">
          ${yen(invoice.total_incl_tax)}
        </div>

        <div class="invoice-detail-summary__statuses">
          <span class="c-badge ${invoiceStatusBadge.className}">
            ${esc(invoiceStatusBadge.label)}
          </span>

          <span class="c-badge ${paymentStatusBadge.className}">
            ${esc(paymentStatusBadge.label)}
          </span>

          ${renderSendStatusBadge_(invoice.send_status)}
        </div>

        <div class="invoice-detail-summary__dates">
          <div class="invoice-detail-summary__date">
            <span class="invoice-detail-summary__date-label">発行日</span>
            <span class="invoice-detail-summary__date-value">
              ${esc(formatDate_(invoice.issue_date))}
            </span>
          </div>

          <div class="invoice-detail-summary__date">
            <span class="invoice-detail-summary__date-label">支払期限</span>
            <span class="invoice-detail-summary__date-value${
              dueDateOverdue
                ? ' invoice-detail-summary__date-value--overdue'
                : ''
            }">
              ${esc(formatDate_(invoice.due_date))}
              ${
                dueDateOverdue
                  ? '<span class="invoice-overdue-flag">期限超過</span>'
                  : ''
              }
            </span>
          </div>
        </div>
      </div>

      ${renderInvoiceInfoSection_(invoice)}

      <div class="invoice-detail-section">
        <div class="invoice-detail-section__header">
          <div class="invoice-detail-section__title">請求明細</div>
        </div>

        <div class="item-list-desktop table-wrap">
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

        <div class="item-list-mobile">
          <div class="history-card-list">
            ${renderItemCards_(items)}
          </div>
        </div>
      </div>

      <div class="invoice-detail-section">
        <div class="invoice-detail-section__header">
          <div class="invoice-detail-section__title">入金状況</div>
        </div>

        <div class="invoice-detail-amount-summary">
          ${renderAmount_(
            '請求額',
            invoice.total_incl_tax
          )}

          ${renderAmount_(
            '入金済み額',
            invoice.payment_total
          )}

          ${renderAmount_(
            '未入金額',
            invoice.balance
          )}
        </div>

        <div class="invoice-detail-section__subheader">入金履歴</div>

        <div class="payment-list-desktop table-wrap">
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

        <div class="payment-list-mobile">
          <div class="history-card-list">
            ${renderPaymentCards_(payments)}
          </div>
        </div>
      </div>

      <div class="invoice-detail-section">
        <div class="invoice-detail-section__header">
          <div class="invoice-detail-section__title">送付状況</div>
        </div>

        ${
          canSend
            ? `
              <div
                id="invoice-send-panel"
                class="send-panel"
                style="display:none;"
              >
                <h3>送付登録</h3>

                <form id="invoice-send-form">
                  <div class="form-grid">
                    <div>
                      <label class="muted" for="invoice-send-method">
                        送付方法
                      </label>
                      <select
                        id="invoice-send-method"
                        name="send_method"
                        class="c-select invoice-send-method"
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
                        class="c-input invoice-send-date"
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
                        class="c-input invoice-send-destination"
                        value="${escapeAttr_(
                          invoice.payee_name_snapshot || ''
                        )}"
                        required
                      />
                    </div>
                  </div>

                  <div class="form-field">
                    <label class="muted" for="invoice-send-remarks">
                      備考
                    </label>
                    <textarea
                      id="invoice-send-remarks"
                      name="remarks"
                      class="c-textarea invoice-send-remarks"
                      rows="3"
                    ></textarea>
                  </div>

                  <div class="form-field form-actions">
                    <button
                      type="submit"
                      class="btn primary invoice-send-submit"
                    >
                      登録する
                    </button>

                    <button
                      type="button"
                      class="btn invoice-send-cancel"
                    >
                      キャンセル
                    </button>
                  </div>
                </form>
              </div>
            `
            : ''
        }

        <div class="invoice-detail-section__subheader">送付履歴</div>

        <div class="send-history-desktop table-wrap">
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

        <div class="send-history-mobile">
          <div class="history-card-list">
            ${renderSendHistoryCards_(sendLogs)}
          </div>
        </div>
      </div>

      ${renderAdminSection_(invoice)}

      ${renderDangerSection_(canVoid)}
    </div>
  `;
}


/**
 * 請求先・請求情報セクションを作る。
 * 請求先名・金額・発行日・支払期限はサマリーで既に表示しているため、
 * ここでは重複しない項目のみ表示する。
 *
 * @param {Object} invoice
 * @return {string}
 */
function renderInvoiceInfoSection_(invoice) {
  const items = [
    renderInfo_(
      '件名',
      invoice.subject
    ),
    renderInfo_(
      '請求区分',
      getInvoiceTypeLabel_(
        invoice.invoice_type
      )
    ),
    renderInfo_(
      '請求書備考',
      invoice.public_remarks
    )
  ]
    .filter(Boolean)
    .join('');

  if (!items) {
    return '';
  }

  return `
    <div class="invoice-detail-section">
      <div class="invoice-detail-section__header">
        <div class="invoice-detail-section__title">請求情報</div>
      </div>

      <div class="invoice-detail-info-grid">
        ${items}
      </div>
    </div>
  `;
}


/**
 * 管理情報セクションを作る。
 * created_at/updated_at/internal_noteが1つも存在しない場合は
 * セクション自体を作らない。
 *
 * @param {Object} invoice
 * @return {string}
 */
function renderAdminSection_(invoice) {
  const infoItems = [
    renderInfo_(
      '作成日時',
      formatDate_(invoice.created_at)
    ),
    renderInfo_(
      '更新日時',
      formatDate_(invoice.updated_at)
    )
  ]
    .filter(Boolean)
    .join('');

  const internalNote =
    String(
      invoice.internal_note || ''
    ).trim();

  if (!infoItems && !internalNote) {
    return '';
  }

  return `
    <div class="invoice-detail-section invoice-detail-section--admin">
      <div class="invoice-detail-section__header">
        <div class="invoice-detail-section__title">管理情報</div>
      </div>

      ${
        infoItems
          ? `
            <div class="invoice-detail-info-grid">
              ${infoItems}
            </div>
          `
          : ''
      }

      ${
        internalNote
          ? `
            <div class="invoice-detail-info-item">
              <div class="invoice-detail-info-item__label">内部メモ</div>
              <div class="invoice-detail-info-item__value">
                ${esc(internalNote)}
              </div>
            </div>
          `
          : ''
      }
    </div>
  `;
}


/**
 * 危険な操作セクションを作る。
 * 取消可能な条件(canVoid)は既存のまま変更しない。
 *
 * @param {boolean} canVoid
 * @return {string}
 */
function renderDangerSection_(canVoid) {
  if (!canVoid) {
    return '';
  }

  return `
    <div class="invoice-detail-danger">
      <div class="invoice-detail-section__header">
        <div class="invoice-detail-section__title">請求書の取消</div>
      </div>

      <p class="invoice-detail-danger__text">
        取り消した請求書は元に戻せません。内容に誤りがある場合のみ実行してください。
      </p>

      <button
        type="button"
        class="btn invoice-void"
      >
        請求書を取り消す
      </button>
    </div>
  `;
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
    '請求書詳細の読み込みに失敗しました。';

  return `
    <div class="invoice-detail-view">
      <div class="c-alert c-alert--danger invoice-detail-error">
        ${esc(message)}
      </div>

      <div class="invoice-detail-toolbar">
        <button
          type="button"
          class="btn"
          data-go="invoices"
        >
          請求書一覧へ戻る
        </button>
      </div>
    </div>
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

  const editButton =
    document.querySelector(
      '.invoice-detail-edit'
    );

  if (editButton) {
    editButton.addEventListener(
      'click',
      function () {
        const invoice =
          currentDetail?.invoice || {};

        const invoiceId =
          String(
            invoice.invoice_id || ''
          ).trim();

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

  const cancelButton =
    document.querySelector(
      '.invoice-send-cancel'
    );

  if (
    !sendButton ||
    !formWrapper ||
    !form
  ) {
    return;
  }

  if (cancelButton) {
    cancelButton.addEventListener(
      'click',
      function (event) {
        event.preventDefault();
        formWrapper.style.display = 'none';
      }
    );
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

        requestAnimationFrame(
          function () {
            requestAnimationFrame(
              function () {
                scrollToSendPanel_(
                  formWrapper
                );
              }
            );
          }
        );
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
 * 送付登録フォームの実際のスクロールコンテナを判定し、
 * ヘッダー分(80px)を差し引いた位置までスクロールする。
 * .contentが独自にスクロールしていればそちらを、
 * そうでなければwindowをスクロールする。
 *
 * @param {HTMLElement} formWrapper
 */
function scrollToSendPanel_(formWrapper) {
  const prefersReducedMotion =
    window.matchMedia &&
    window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

  const behavior =
    prefersReducedMotion ? 'auto' : 'smooth';

  const scrollContainer =
    document.querySelector('.content');

  if (
    scrollContainer &&
    scrollContainer.scrollHeight >
      scrollContainer.clientHeight
  ) {
    const containerRect =
      scrollContainer.getBoundingClientRect();

    const panelRect =
      formWrapper.getBoundingClientRect();

    const targetTop =
      scrollContainer.scrollTop +
      panelRect.top -
      containerRect.top -
      80;

    scrollContainer.scrollTo({
      top: Math.max(0, targetTop),
      behavior: behavior
    });

  } else {
    const targetTop =
      window.scrollY +
      formWrapper.getBoundingClientRect().top -
      80;

    window.scrollTo({
      top: Math.max(0, targetTop),
      behavior: behavior
    });
  }
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
 * モバイル用の送付履歴カード一覧を作る（sendLogsを複製取得せず共用）。
 *
 * @param {Array} sendLogs
 * @return {string}
 */
function renderSendHistoryCards_(sendLogs) {
  if (!sendLogs.length) {
    return `
      <div class="muted">
        送付履歴はありません。
      </div>
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
      return renderSendHistoryCard_(log);
    })
    .join('');
}


/**
 * 送付履歴1件のモバイルカードを作る。
 *
 * @param {Object} log
 * @return {string}
 */
function renderSendHistoryCard_(log) {
  const resendCount =
    Number(
      log.resend_count || 0
    );

  const remarks =
    String(
      log.remarks || ''
    ).trim();

  return `
    <div class="history-card">
      <div class="history-card__row">
        <span class="history-card__label">送付日</span>
        <span class="history-card__value history-card__value--nowrap">
          ${esc(
            formatDate_(
              log.sent_at
            )
          )}
        </span>
      </div>

      <div class="history-card__row">
        <span class="history-card__label">送付方法</span>
        <span class="history-card__value history-card__value--nowrap">
          ${esc(
            getSendMethodLabel_(
              log.send_method
            )
          )}
        </span>
      </div>

      <div class="history-card__row">
        <span class="history-card__label">送付先</span>
        <span class="history-card__value">
          ${esc(
            log.destination_name || ''
          )}
        </span>
      </div>

      ${
        resendCount >= 1
          ? `
            <div class="history-card__row">
              <span class="history-card__label">再送</span>
              <span class="history-card__value history-card__value--nowrap history-card__value--resend">
                再送${resendCount}回
              </span>
            </div>
          `
          : ''
      }

      <div class="history-card__row">
        <span class="history-card__label">登録者</span>
        <span class="history-card__value">
          ${esc(
            log.sent_by || ''
          )}
        </span>
      </div>

      ${
        remarks
          ? `
            <div class="history-card__row">
              <span class="history-card__label">備考</span>
              <span class="history-card__value">
                ${esc(remarks)}
              </span>
            </div>
          `
          : ''
      }
    </div>
  `;
}


/**
 * 請求状態バッジ（.c-badge系）を返す。
 * invoices.jsのgetInvoiceStatusBadge_と同じ判定基準。
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
 * invoices.jsのgetPaymentStatusBadge_と同じ判定基準。
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
 * 支払期限を過ぎているか判定する
 * （invoices.jsのisOverdue_と同じ条件：発行済み・未入金・支払期限が本日より前）。
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

  return sendStatus || '未送付';
}

/**
 * 送付状態を.c-badgeで表示する。
 * ラベル文言はgetSendStatusLabel_をそのまま利用する。
 *
 * @param {*} sendStatus
 * @return {string}
 */
function renderSendStatusBadge_(sendStatus) {
  const normalized =
    String(sendStatus || '')
      .trim()
      .toLowerCase();

  let badgeClass = 'c-badge--unsent';

  if (normalized === 'resent') {
    badgeClass = 'c-badge--resent';
  } else if (
    normalized === 'sent_postal' ||
    normalized === 'sent_line'
  ) {
    badgeClass = 'c-badge--sent';
  }

  return `
    <span class="c-badge ${badgeClass}">
      ${esc(getSendStatusLabel_(sendStatus))}
    </span>
  `;
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
 * 情報グリッドの1項目を作る。値が空の場合は何も返さない
 * （空欄を無理に「―」で埋めない）。
 *
 * @param {string} label
 * @param {*} value
 * @return {string}
 */
function renderInfo_(
  label,
  value
) {
  const text =
    String(
      value ?? ''
    ).trim();

  if (!text) {
    return '';
  }

  return `
    <div class="invoice-detail-info-item">
      <div class="invoice-detail-info-item__label">
        ${esc(label)}
      </div>

      <div class="invoice-detail-info-item__value">
        ${esc(text)}
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
    <div class="invoice-detail-info-item">
      <div class="invoice-detail-info-item__label">
        ${esc(label)}
      </div>

      <div class="invoice-detail-info-item__value invoice-detail-info-item__value--amount">
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
 * モバイル用の請求明細カード一覧を作る（itemsを複製取得せず共用）。
 *
 * @param {Array} items
 * @return {string}
 */
function renderItemCards_(items) {
  if (!items.length) {
    return `
      <div class="muted">
        請求明細はありません。
      </div>
    `;
  }

  return items
    .map(function (item) {
      return renderItemCard_(item);
    })
    .join('');
}


/**
 * 請求明細1件のモバイルカードを作る。
 *
 * @param {Object} item
 * @return {string}
 */
function renderItemCard_(item) {
  const remarks =
    String(
      item.remarks || ''
    ).trim();

  return `
    <div class="history-card">
      <div class="history-card__row">
        <span class="history-card__label">品目</span>
        <span class="history-card__value">
          ${esc(
            item.item_name || ''
          )}
        </span>
      </div>

      <div class="history-card__row">
        <span class="history-card__label">数量</span>
        <span class="history-card__value history-card__value--nowrap">
          ${esc(
            item.quantity || ''
          )}
        </span>
      </div>

      <div class="history-card__row">
        <span class="history-card__label">単位</span>
        <span class="history-card__value history-card__value--nowrap">
          ${esc(
            item.unit || ''
          )}
        </span>
      </div>

      <div class="history-card__row">
        <span class="history-card__label">税込単価</span>
        <span class="history-card__value history-card__value--nowrap">
          ${yen(
            item.unit_price_incl_tax
          )}
        </span>
      </div>

      <div class="history-card__row">
        <span class="history-card__label">金額</span>
        <span class="history-card__value history-card__value--nowrap history-card__value--strong">
          ${yen(
            item.line_total_incl_tax
          )}
        </span>
      </div>

      ${
        remarks
          ? `
            <div class="history-card__row">
              <span class="history-card__label">備考</span>
              <span class="history-card__value">
                ${esc(remarks)}
              </span>
            </div>
          `
          : ''
      }
    </div>
  `;
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
 * モバイル用の入金履歴カード一覧を作る（paymentsを複製取得せず共用）。
 *
 * @param {Array} payments
 * @return {string}
 */
function renderPaymentCards_(payments) {
  if (!payments.length) {
    return `
      <div class="muted">
        入金履歴はありません。
      </div>
    `;
  }

  return payments
    .slice()
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
      return renderPaymentCard_(payment);
    })
    .join('');
}


/**
 * 入金履歴1件のモバイルカードを作る。
 *
 * @param {Object} payment
 * @return {string}
 */
function renderPaymentCard_(payment) {
  const remarks =
    String(
      payment.remarks || ''
    ).trim();

  return `
    <div class="history-card">
      <div class="history-card__row">
        <span class="history-card__label">入金日</span>
        <span class="history-card__value history-card__value--nowrap">
          ${esc(
            formatDate_(
              payment.payment_date
            )
          )}
        </span>
      </div>

      <div class="history-card__row">
        <span class="history-card__label">入金額</span>
        <span class="history-card__value history-card__value--nowrap history-card__value--strong">
          ${yen(
            payment.amount
          )}
        </span>
      </div>

      <div class="history-card__row">
        <span class="history-card__label">入金方法</span>
        <span class="history-card__value history-card__value--nowrap">
          ${esc(
            payment.payment_method || ''
          )}
        </span>
      </div>

      <div class="history-card__row">
        <span class="history-card__label">入金者名</span>
        <span class="history-card__value">
          ${esc(
            payment.payer_name || ''
          )}
        </span>
      </div>

      ${
        remarks
          ? `
            <div class="history-card__row">
              <span class="history-card__label">備考</span>
              <span class="history-card__value">
                ${esc(remarks)}
              </span>
            </div>
          `
          : ''
      }
    </div>
  `;
}


/**
 * 請求書の状態表示を作る（現在は個別バッジ表示に置き換えたため未使用だが、
 * 既存の関数名を変更しない方針のため残している）。
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
    ''
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
