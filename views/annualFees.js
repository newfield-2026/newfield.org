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

  return `
    <div class="panel">
      <h2>年会費一括作成</h2>

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

    <div class="toolbar">
      <button
        type="button"
        class="btn primary annual-fee-create"
      >
        選択した対象を下書き作成
      </button>
    </div>

    <div class="panel table-wrap">
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

  if (button) {
    button.addEventListener(
      'click',
      function () {
        alert(
          '次のステップで一括下書き作成APIを接続します。'
        );
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
 * 候補一覧を表示する。
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
          class="muted"
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

      return `
        <tr>
          <td>
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

          <td>
            ${esc(
              getSourceTypeLabel_(
                candidate.sourceType
              )
            )}
          </td>

          <td>
            ${esc(
              candidate.number || ''
            )}
          </td>

          <td>
            ${esc(
              candidate.name || ''
            )}
          </td>

          <td>
            ${esc(
              candidate.memberType || ''
            )}
          </td>

          <td>
            ${esc(
              candidate.calculation ||
              candidate.message ||
              ''
            )}
          </td>

          <td>
            ${yen(
              candidate.finalAmount ||
              candidate.standardAmount ||
              0
            )}
          </td>

          <td>
            ${esc(
              getStatusLabel_(
                candidate.status
              )
            )}
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
