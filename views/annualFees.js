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

  const candidates =
    currentData.candidates || [];

  const summary =
    summarizeCandidates_(candidates);

  const settingGroups =
    summarizeByMemberType_(candidates);

  return `
    <div class="annual-fees-view">
      <div class="annual-fees-intro">
        <p class="annual-fees-intro__text">
          対象年度の年会費請求書を会員区分ごとに一括作成します。
        </p>
      </div>

      <div class="c-alert c-alert--warning annual-fees-notice">
        ${esc(currentData.fiscalYear || '')}年度の対象会員へ、年会費請求書をまとめて下書き作成します。
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
            currentData.fiscalYear
          )}

          ${renderInfo_(
            '対象期間',
            currentData.fiscalPeriod
          )}

          ${renderInfo_(
            '発行予定日',
            currentData.issueDate
          )}

          ${renderInfo_(
            '支払期限',
            currentData.dueDate
          )}

          ${renderInfo_(
            '件名',
            currentData.subject
          )}
        </div>
      </div>

      ${renderSettingsSection_(settingGroups)}

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
    </div>
  `;
}


/**
 * イベントを設定する。
 */
export function bind() {
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
 * 候補一覧を会員区分ごとに集計する
 * （年会費の設定値そのものではなく、対象会員から確認できる内容の集計）。
 *
 * @param {Array} candidates
 * @return {Array<Object>}
 */
function summarizeByMemberType_(candidates) {
  const order = [];
  const groups = new Map();

  candidates.forEach(function (candidate) {
    const key =
      candidate.memberType ||
      '区分不明';

    if (!groups.has(key)) {
      groups.set(key, {
        memberType: key,
        count: 0,
        exemptCount: 0,
        amounts: new Set(),
        calculation: ''
      });

      order.push(key);
    }

    const group = groups.get(key);

    group.count += 1;

    if (candidate.status === 'exempt') {
      group.exemptCount += 1;
    }

    const amount =
      candidate.finalAmount ??
      candidate.standardAmount;

    if (typeof amount === 'number') {
      group.amounts.add(amount);
    }

    if (
      !group.calculation &&
      (candidate.calculation || candidate.message)
    ) {
      group.calculation =
        candidate.calculation ||
        candidate.message ||
        '';
    }
  });

  return order.map(function (key) {
    return groups.get(key);
  });
}


/**
 * 年会費設定の確認セクションを作る。
 * 集計対象がない場合はセクション自体を作らない。
 *
 * @param {Array<Object>} settingGroups
 * @return {string}
 */
function renderSettingsSection_(settingGroups) {
  if (!settingGroups.length) {
    return '';
  }

  return `
    <div class="annual-fees-section">
      <div class="annual-fees-section__header">
        <div class="annual-fees-section__title">年会費設定の確認</div>
        <div class="annual-fees-section__description">
          対象会員から確認できる、会員区分ごとの内容です
        </div>
      </div>

      <div class="annual-fees-settings">
        ${
          settingGroups
            .map(function (group) {
              return renderSettingItem_(group);
            })
            .join('')
        }
      </div>
    </div>
  `;
}


/**
 * 年会費設定1区分分のカードを作る。
 *
 * @param {Object} group
 * @return {string}
 */
function renderSettingItem_(group) {
  const isFullyExempt =
    group.exemptCount === group.count;

  let amountText;

  if (isFullyExempt) {
    amountText = '免除';

  } else if (group.amounts.size === 1) {
    amountText = yen(
      Array.from(group.amounts)[0]
    );

  } else if (group.amounts.size > 1) {
    const values =
      Array.from(group.amounts).sort(
        function (a, b) {
          return a - b;
        }
      );

    amountText =
      yen(values[0]) +
      '〜' +
      yen(values[values.length - 1]);

  } else {
    amountText = '―';
  }

  return `
    <div class="annual-fees-setting-item">
      <div class="annual-fees-setting-item__type">
        ${esc(group.memberType)}
      </div>

      <div class="annual-fees-setting-item__amount${
        isFullyExempt
          ? ' annual-fees-setting-item__amount--exempt'
          : ''
      }">
        ${amountText}
      </div>

      <div class="annual-fees-setting-item__note">
        対象${group.count}件
        ${
          group.calculation
            ? '・' + esc(group.calculation)
            : ''
        }
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
