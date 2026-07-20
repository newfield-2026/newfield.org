import { api } from '../assets/js/api.js';

import {
  esc,
  yen
} from '../assets/js/components.js';


let currentData = null;


/**
 * 年会費一括作成画面を表示する。
 *
 * @param {Object} ctx
 * @return {Promise<string>}
 */
export async function render(ctx) {
  currentData = await api(
    'getAnnualFeeBatchMaster',
    {
      fiscalYear: ctx.fiscalYear
    }
  );

  return buildAnnualFeesViewHtml_(currentData);
}


/**
 * 画面本体のHTMLを作る。renderからの初回表示と、
 * 「人数を登録」保存後の部分更新（refreshCandidates_）の両方から使う。
 *
 * @param {Object} data getAnnualFeeBatchMaster/refreshAnnualFeeCandidatesの戻り値
 * @return {string}
 */
function buildAnnualFeesViewHtml_(data) {
  const candidates =
    data.candidates || [];

  const summary =
    summarizeCandidates_(candidates);

  return `
    <div class="annual-fees-view">
      <div class="annual-fees-intro">
        <p class="annual-fees-intro__text">
          対象年度の年会費請求書を会員区分ごとに一括作成します。
        </p>
      </div>

      <div class="c-alert c-alert--warning annual-fees-notice">
        ${esc(data.fiscalYear || '')}年度の対象会員へ、年会費請求書をまとめて下書き作成します。
        既に請求書がある会員は自動的に対象から除外されます。
        作成される請求書は下書きとして登録され、発行は別途行います。
      </div>

      <div id="annual-fees-result"></div>

      <div class="annual-fees-section">
        <div class="annual-fees-section__header">
          <div class="annual-fees-section__title">対象年度</div>
        </div>

        <div class="annual-fees-grid">
          ${renderInfo_(
            '対象年度',
            data.fiscalYear
          )}

          ${renderInfo_(
            '対象期間',
            data.fiscalPeriod
          )}

          ${renderInfo_(
            '発行予定日',
            data.issueDate
          )}

          ${renderInfo_(
            '支払期限',
            data.dueDate
          )}

          ${renderInfo_(
            '件名',
            data.subject
          )}
        </div>
      </div>

      <div class="annual-fees-section">
        <div class="annual-fees-section__header">
          <div class="annual-fees-section__title">対象会員の確認</div>
          <div class="annual-fees-section__description">
            対象${summary.readyCount}件・既存請求により除外${summary.duplicateCount}件・その他対象外${summary.otherCount}件（全${candidates.length}件）
          </div>
        </div>

        <div class="annual-fees-members table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>選択</th>
                <th>種別</th>
                <th>番号</th>
                <th>請求先</th>
                <th>会員区分</th>
                <th>算定内容</th>
                <th>金額</th>
                <th>状態</th>
              </tr>
            </thead>

            <tbody>
              ${renderCandidateRows_(
                candidates
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div class="annual-fees-section">
        <div class="annual-fees-section__header">
          <div class="annual-fees-section__title">作成見込みサマリー</div>
        </div>

        <div class="annual-fees-summary">
          ${renderSummaryCard_(
            '作成予定件数',
            summary.readyCount + '件',
            '「作成可能」の対象会員数'
          )}

          ${renderSummaryCard_(
            '請求予定総額',
            yen(summary.readyAmount),
            '作成予定件数の合計見込額'
          )}

          ${renderSummaryCard_(
            '既存請求により除外',
            summary.duplicateCount + '件',
            'すでに請求書がある会員'
          )}

          ${renderSummaryCard_(
            'その他対象外',
            summary.otherCount + '件',
            `内訳：免除${summary.exemptCount}件・対象外${summary.excludedCount}件・要確認${summary.needsCountCount}件・エラー${summary.errorCount}件`
          )}
        </div>
      </div>

      <div class="annual-fees-actions">
        <div class="annual-fees-actions__group">
          <button
            type="button"
            class="btn"
            data-go="invoices"
          >
            請求書一覧へ戻る
          </button>
        </div>

        <div class="annual-fees-actions__group">
          <button
            type="button"
            class="btn primary annual-fee-create"
            ${summary.readyCount ? '' : 'disabled'}
          >
            選択した対象を下書き作成
          </button>
        </div>
      </div>

      <div id="annual-fee-count-modal-root"></div>
    </div>
  `;
}


/**
 * 候補データを再取得し、画面を部分更新する
 * （ページ全体のリロードはしない）。
 *
 * @return {Promise<void>}
 */
async function refreshCandidates_() {
  const container =
    document.querySelector('.annual-fees-view');

  if (!container) {
    return;
  }

  currentData = await api(
    'getAnnualFeeBatchMaster',
    {
      fiscalYear: currentData.fiscalYear
    }
  );

  container.outerHTML =
    buildAnnualFeesViewHtml_(currentData);

  bind();
}


/**
 * イベントを設定する。
 */
export function bind() {
  bindCreateButton_();
  bindRegisterCountButtons_();
}


/**
 * 「選択した対象を下書き作成」ボタンのイベントを設定する。
 */
function bindCreateButton_() {
  const button =
    document.querySelector(
      '.annual-fee-create'
    );

  if (!button) {
    return;
  }

  button.addEventListener(
    'click',
    async function () {
      clearResult_();

      const checked =
        Array.from(
          document.querySelectorAll(
            '.annual-fee-select:checked'
          )
        );

      if (!checked.length) {
        alert(
          '下書きを作成する対象を選択してください。'
        );
        return;
      }

      const candidates =
        checked.map(
          function (checkbox) {
            return {
              source_type:
                checkbox.dataset.sourceType,

              source_id:
                checkbox.dataset.sourceId,

              selected:
                true
            };
          }
        );

      const confirmed =
        window.confirm(
          `${candidates.length}件の年会費請求書を下書き作成します。\nよろしいですか？`
        );

      if (!confirmed) {
        return;
      }

      const originalText =
        button.textContent;

      button.disabled = true;
      button.textContent =
        '下書きを作成しています…';

      try {
        const result =
          await api(
            'createAnnualFeeDrafts',
            {
              fiscal_year:
                currentData.fiscalYear,

              issue_date:
                currentData.issueDate,

              due_date:
                currentData.dueDate,

              subject:
                currentData.subject,

              public_remarks:
                currentData.publicRemarks,

              candidates:
                candidates
            }
          );

        const successCount =
          Array.isArray(result.success)
            ? result.success.length
            : 0;

        const skippedCount =
          Array.isArray(result.skipped)
            ? result.skipped.length
            : 0;

        const errorCount =
          Array.isArray(result.errors)
            ? result.errors.length
            : 0;

        let message =
          '年会費請求書の一括処理が完了しました。' +
          `\n\n作成成功：${successCount}件` +
          `\nスキップ：${skippedCount}件` +
          `\nエラー：${errorCount}件`;

        if (errorCount > 0) {
          const errorDetails =
            result.errors
              .map(
                function (row) {
                  return (
                    '・' +
                    (row.name || '名称不明') +
                    '：' +
                    (row.error || 'エラー')
                  );
                }
              )
              .join('\n');

          message +=
            '\n\nエラー内容\n' +
            errorDetails;
        }

        alert(message);

        window.location.reload();

      } catch (error) {
        console.error(
          '年会費一括作成エラー',
          error
        );

        const errorMessage =
          error &&
          error.message
            ? error.message
            : '年会費請求書の一括作成に失敗しました。';

        showResultError_(errorMessage);

        alert(errorMessage);

        button.disabled = false;
        button.textContent =
          originalText;
      }
    }
  );
}


/**
 * 「人数を登録」ボタンのイベントを設定する。
 * 候補一覧を再描画するたびに呼び直す。
 */
function bindRegisterCountButtons_() {
  document
    .querySelectorAll('.annual-fee-register-count')
    .forEach(function (button) {
      button.addEventListener(
        'click',
        function () {
          openRegisterCountModal_(
            button.dataset.organizationId,
            button.dataset.organizationName
          );
        }
      );
    });
}


/**
 * 実行結果表示をクリアする。
 */
function clearResult_() {
  const target =
    document.querySelector(
      '#annual-fees-result'
    );

  if (target) {
    target.innerHTML = '';
  }
}


/**
 * 実行結果エリアへエラーを表示する
 * （既存のalert()による通知は維持したまま、画面内にも残す）。
 *
 * @param {string} message
 */
function showResultError_(message) {
  const target =
    document.querySelector(
      '#annual-fees-result'
    );

  if (!target) {
    return;
  }

  target.innerHTML = `
    <div class="c-alert c-alert--danger annual-fees-error">
      ${esc(message)}
    </div>
  `;
}


/**
 * 実行結果エリアへ成功メッセージを表示する。
 *
 * @param {string} message
 */
function showResultSuccess_(message) {
  const target =
    document.querySelector(
      '#annual-fees-result'
    );

  if (!target) {
    return;
  }

  target.innerHTML = `
    <div class="c-alert c-alert--success annual-fees-success">
      ${esc(message)}
    </div>
  `;
}


/**
 * 候補一覧から作成見込みサマリーを集計する
 * （フロント側の軽微な集計のみ、API呼び出しは追加しない）。
 *
 * @param {Array} candidates
 * @return {Object}
 */
function summarizeCandidates_(candidates) {
  let readyCount = 0;
  let readyAmount = 0;
  let duplicateCount = 0;
  let exemptCount = 0;
  let excludedCount = 0;
  let needsCountCount = 0;
  let errorCount = 0;

  candidates.forEach(function (candidate) {
    const status = candidate.status;

    if (status === 'ready') {
      readyCount += 1;

      readyAmount += Number(
        candidate.finalAmount ??
        candidate.standardAmount ??
        0
      );

    } else if (status === 'duplicate') {
      duplicateCount += 1;

    } else if (status === 'exempt') {
      exemptCount += 1;

    } else if (status === 'excluded') {
      excludedCount += 1;

    } else if (status === 'needs_count') {
      needsCountCount += 1;

    } else if (status === 'error') {
      errorCount += 1;
    }
  });

  const otherCount =
    exemptCount +
    excludedCount +
    needsCountCount +
    errorCount;

  return {
    readyCount: readyCount,
    readyAmount: readyAmount,
    duplicateCount: duplicateCount,
    exemptCount: exemptCount,
    excludedCount: excludedCount,
    needsCountCount: needsCountCount,
    errorCount: errorCount,
    otherCount: otherCount
  };
}


/**
 * サマリーカードを1枚作る。
 *
 * @param {string} label
 * @param {string} value
 * @param {string} note
 * @return {string}
 */
function renderSummaryCard_(
  label,
  value,
  note
) {
  return `
    <div class="annual-fees-summary-card">
      <div class="annual-fees-summary-card__label">
        ${esc(label)}
      </div>

      <div class="annual-fees-summary-card__value">
        ${esc(value)}
      </div>

      ${
        note
          ? `
            <div class="annual-fees-summary-card__note">
              ${esc(note)}
            </div>
          `
          : ''
      }
    </div>
  `;
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
    <div class="annual-fees-field">
      <div class="annual-fees-field__label">
        ${esc(label)}
      </div>

      <div class="annual-fees-field__value">
        ${esc(
          value || '―'
        )}
      </div>
    </div>
  `;
}


/**
 * 候補一覧のテーブル行を表示する。
 * 900px以下ではCSSでこの<tr>/<td>自体をカード風に変形するため、
 * PC/モバイルで入力要素（チェックボックス）を複製していない。
 *
 * @param {Array} candidates
 * @return {string}
 */
function renderCandidateRows_(
  candidates
) {
  if (!candidates.length) {
    return `
      <tr>
        <td
          colspan="8"
          class="annual-fees-empty"
        >
          年会費請求の候補はありません。
        </td>
      </tr>
    `;
  }

  return candidates
    .map(function (candidate) {
      const selectable =
        candidate.status === 'ready';

      const statusClass =
        getStatusClass_(candidate.status);

      return `
        <tr class="annual-fees-member">
          <td data-label="選択">
            ${
              selectable
                ? `
                  <input
                    type="checkbox"
                    class="annual-fee-select"
                    data-source-type="${escapeAttr_(
                      candidate.sourceType
                    )}"
                    data-source-id="${escapeAttr_(
                      candidate.sourceId
                    )}"
                    checked
                  >
                `
                : ''
            }
          </td>

          <td data-label="種別">
            ${esc(
              getSourceTypeLabel_(
                candidate.sourceType
              )
            )}
          </td>

          <td data-label="番号">
            ${esc(
              candidate.number || ''
            )}
          </td>

          <td data-label="請求先">
            ${esc(
              candidate.name || ''
            )}
          </td>

          <td data-label="会員区分">
            ${esc(
              candidate.memberType || ''
            )}
          </td>

          <td data-label="算定内容">
            ${esc(
              candidate.calculation ||
              candidate.message ||
              ''
            )}
            ${
              candidate.status === 'needs_count' &&
              candidate.sourceType === 'organization'
                ? `
                  <button
                    type="button"
                    class="btn annual-fee-register-count"
                    data-organization-id="${escapeAttr_(candidate.sourceId)}"
                    data-organization-name="${escapeAttr_(candidate.name)}"
                  >
                    人数を登録
                  </button>
                `
                : ''
            }
          </td>

          <td data-label="金額" class="annual-fees-amount">
            ${yen(
              candidate.finalAmount ||
              candidate.standardAmount ||
              0
            )}
          </td>

          <td data-label="状態">
            <span class="annual-fees-member__status ${statusClass}">
              ${esc(
                getStatusLabel_(
                  candidate.status
                )
              )}
            </span>
          </td>
        </tr>
      `;
    })
    .join('');
}


/**
 * 請求先種別の表示名。
 *
 * @param {*} sourceType
 * @return {string}
 */
function getSourceTypeLabel_(
  sourceType
) {
  const value =
    String(
      sourceType || ''
    );

  if (value === 'member') {
    return '個人';
  }

  if (value === 'organization') {
    return '団体';
  }

  return value;
}


/**
 * 状態の表示名。
 *
 * @param {*} status
 * @return {string}
 */
function getStatusLabel_(
  status
) {
  const labels = {
    ready: '作成可能',
    duplicate: '作成済み',
    exempt: '会費免除',
    excluded: '対象外',
    needs_count: '会員数未確認',
    error: 'エラー'
  };

  const value =
    String(
      status || ''
    );

  return (
    labels[value] ||
    value
  );
}


/**
 * 状態バッジの見た目クラス
 * （getStatusLabel_のラベル文言・判定条件は変更していない）。
 *
 * @param {*} status
 * @return {string}
 */
function getStatusClass_(status) {
  const classes = {
    ready: 'annual-fees-member__status--ready',
    duplicate: 'annual-fees-member__status--duplicate',
    exempt: 'annual-fees-member__status--exempt',
    excluded: 'annual-fees-member__status--excluded',
    needs_count: 'annual-fees-member__status--needs-count',
    error: 'annual-fees-member__status--error'
  };

  return (
    classes[String(status || '')] ||
    'annual-fees-member__status--excluded'
  );
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


/* ==========================================================================
   「人数を登録」モーダル（会員数未確認の団体を、この画面から確定させる）
   ========================================================================== */

/**
 * 今日の日付をyyyy-MM-dd形式で返す。
 *
 * @return {string}
 */
function getTodayString_() {
  const date = new Date();
  const year = date.getFullYear();

  const month =
    String(date.getMonth() + 1).padStart(2, '0');

  const day =
    String(date.getDate()).padStart(2, '0');

  return [year, month, day].join('-');
}


/**
 * 団体の年度別会員数を取得し、「人数を登録」モーダルを開く。
 *
 * @param {string} organizationId
 * @param {string} organizationName
 */
async function openRegisterCountModal_(
  organizationId,
  organizationName
) {
  const fiscalYear = currentData.fiscalYear;

  let data;

  try {
    data = await api(
      'getOrganizationMemberCounts',
      {
        organizationId: organizationId,
        fiscalYear: fiscalYear
      }
    );
  } catch (error) {
    alert(
      (error && error.message) ||
      '年度別会員数の取得に失敗しました。'
    );
    return;
  }

  const history = data.history || [];

  const previousRecord =
    history.find(function (row) {
      return row.fiscalYear === fiscalYear - 1;
    }) || null;

  const previousCount =
    previousRecord ? previousRecord.currentCount : null;

  renderRegisterCountModal_(
    organizationId,
    organizationName,
    fiscalYear,
    previousCount,
    data.current || null
  );
}


/**
 * 「人数を登録」モーダルを描画する。
 *
 * @param {string} organizationId
 * @param {string} organizationName
 * @param {number} fiscalYear
 * @param {number|null} previousCount
 * @param {Object|null} current
 */
function renderRegisterCountModal_(
  organizationId,
  organizationName,
  fiscalYear,
  previousCount,
  current
) {
  const currentCountValue =
    current && current.currentCount !== null
      ? String(current.currentCount)
      : '';

  const confirmedAtValue =
    current && current.confirmedAt
      ? current.confirmedAt.slice(0, 10)
      : getTodayString_();

  const remarksValue =
    current ? (current.remarks || '') : '';

  const bodyHtml = `
    <div id="annual-fee-count-message"></div>

    <div class="member-form-grid">
      <div class="member-form-field member-form-field--wide">
        <label class="member-form-field__label">団体名</label>
        <div class="member-form-static">${esc(organizationName)}</div>
      </div>

      <div class="member-form-field">
        <label class="member-form-field__label">対象年度</label>
        <div class="member-form-static">${esc(fiscalYear)}年度</div>
      </div>

      <div class="member-form-field">
        <label class="member-form-field__label">前年度人数</label>
        <div class="member-form-static">
          ${previousCount === null ? '―' : esc(previousCount) + '名'}
        </div>
      </div>

      <div class="member-form-field">
        <label class="member-form-field__label" for="afc-current">
          当年度人数<span class="member-required">必須</span>
        </label>
        <input
          id="afc-current"
          type="number"
          min="0"
          step="1"
          inputmode="numeric"
          class="c-input"
          value="${escapeAttr_(currentCountValue)}"
        >
      </div>

      <div class="member-form-field">
        <label class="member-form-field__label" for="afc-confirmed-at">
          確認日<span class="member-required">必須</span>
        </label>
        <input
          id="afc-confirmed-at"
          type="date"
          class="c-input"
          value="${escapeAttr_(confirmedAtValue)}"
        >
      </div>

      <div class="member-form-field member-form-field--wide">
        <label class="member-form-field__label" for="afc-remarks">備考</label>
        <textarea id="afc-remarks" class="c-textarea" rows="2">${esc(remarksValue)}</textarea>
      </div>
    </div>
  `;

  const footerHtml = `
    <button type="button" class="btn" id="annual-fee-count-cancel">
      キャンセル
    </button>

    <button type="button" class="btn primary" id="annual-fee-count-save">
      保存
    </button>
  `;

  openCountModalShell_(
    bodyHtml,
    {
      title: '人数を登録',
      ariaLabel: `${organizationName}の年度別会員数を登録`,
      footer: footerHtml
    }
  );

  const cancelButton =
    document.querySelector('#annual-fee-count-cancel');

  if (cancelButton) {
    cancelButton.addEventListener(
      'click',
      function () {
        closeCountModal_();
      }
    );
  }

  const saveButton =
    document.querySelector('#annual-fee-count-save');

  if (saveButton) {
    saveButton.addEventListener(
      'click',
      function () {
        submitRegisterCount_(
          organizationId,
          fiscalYear,
          saveButton,
          cancelButton
        );
      }
    );
  }
}


/**
 * モーダルの入力内容を検証し、団体の年度別会員数を保存する。
 * 保存後はモーダルを閉じ、候補一覧を再取得して部分更新する
 * （ページ全体のリロードはしない）。
 *
 * @param {string} organizationId
 * @param {number} fiscalYear
 * @param {HTMLButtonElement} saveButton
 * @param {HTMLButtonElement} cancelButton
 */
async function submitRegisterCount_(
  organizationId,
  fiscalYear,
  saveButton,
  cancelButton
) {
  const messageEl =
    document.querySelector('#annual-fee-count-message');

  if (messageEl) {
    messageEl.innerHTML = '';
  }

  const currentCountRaw =
    getModalInputValue_('#afc-current');

  const confirmedAt =
    getModalInputValue_('#afc-confirmed-at');

  const remarks =
    getModalInputValue_('#afc-remarks');

  if (
    currentCountRaw === '' ||
    !/^\d+$/.test(currentCountRaw)
  ) {
    setCountModalMessage_(
      messageEl,
      '団体会員数は0以上の整数で入力してください。'
    );
    return;
  }

  if (!confirmedAt) {
    setCountModalMessage_(messageEl, '確認日を入力してください。');
    return;
  }

  if (saveButton) {
    saveButton.disabled = true;
    saveButton.textContent = '保存中...';
  }

  if (cancelButton) {
    cancelButton.disabled = true;
  }

  try {
    await api(
      'saveOrganizationMemberCount',
      {
        organization_id: organizationId,
        fiscal_year: fiscalYear,
        current_count: Number(currentCountRaw),
        confirmed_at: confirmedAt,
        remarks: remarks
      }
    );

    closeCountModal_();

    await refreshCandidates_();

    showResultSuccess_(
      `${fiscalYear}年度の団体会員数を登録しました。`
    );

  } catch (error) {
    setCountModalMessage_(
      messageEl,
      (error && error.message) ||
      '団体会員数の保存に失敗しました。'
    );

    if (saveButton) {
      saveButton.disabled = false;
      saveButton.textContent = '保存';
    }

    if (cancelButton) {
      cancelButton.disabled = false;
    }
  }
}


/**
 * モーダル内の入力要素から値を取得する。
 *
 * @param {string} selector
 * @return {string}
 */
function getModalInputValue_(selector) {
  const el = document.querySelector(selector);
  return el ? String(el.value || '').trim() : '';
}


/**
 * 「人数を登録」モーダルのメッセージ表示を更新する。
 *
 * @param {HTMLElement} el
 * @param {string} text
 */
function setCountModalMessage_(el, text) {
  if (!el) {
    return;
  }

  el.innerHTML = text
    ? `
      <div class="c-alert c-alert--danger">
        ${esc(text)}
      </div>
    `
    : '';
}


/**
 * 「人数を登録」モーダルの外枠を描画する。
 * members.jsのopenModalShell_と同じ見た目（c-modal-overlay/c-modal）を
 * この画面専用のモーダルルート（#annual-fee-count-modal-root）に描画する。
 *
 * @param {string} bodyHtml
 * @param {{title:string, ariaLabel?:string, footer?:string}} options
 */
function openCountModalShell_(bodyHtml, options) {
  const root =
    document.querySelector('#annual-fee-count-modal-root');

  if (!root) {
    return;
  }

  const opts = options || {};

  root.innerHTML = `
    <div class="c-modal-overlay" id="annual-fee-count-modal-overlay">
      <div
        class="c-modal"
        role="dialog"
        aria-modal="true"
        aria-label="${escapeAttr_(opts.ariaLabel || opts.title || '')}"
      >
        <div class="c-modal__header">
          <div class="c-modal__heading">
            <div class="c-modal__title">${esc(opts.title || '')}</div>
          </div>

          <button
            type="button"
            class="c-modal__close"
            id="annual-fee-count-modal-close"
            aria-label="閉じる"
          >
            ×
          </button>
        </div>

        <div class="c-modal__body">
          ${bodyHtml}
        </div>

        ${
          opts.footer
            ? `<div class="c-modal__footer">${opts.footer}</div>`
            : ''
        }
      </div>
    </div>
  `;

  const overlay =
    document.querySelector('#annual-fee-count-modal-overlay');

  const closeButton =
    document.querySelector('#annual-fee-count-modal-close');

  if (overlay) {
    overlay.addEventListener(
      'click',
      function (event) {
        if (event.target === overlay) {
          closeCountModal_();
        }
      }
    );
  }

  if (closeButton) {
    closeButton.addEventListener(
      'click',
      function () {
        closeCountModal_();
      }
    );
  }
}


/**
 * 開いている「人数を登録」モーダルを閉じる。
 */
function closeCountModal_() {
  const root =
    document.querySelector('#annual-fee-count-modal-root');

  if (root) {
    root.innerHTML = '';
  }
}
