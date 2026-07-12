export const routes={dashboard:'ダッシュボード',members:'会員・請求先',invoices:'請求書一覧',invoiceCreate:'請求書新規作成',annualFees:'年会費一括作成',payments:'入金管理',invoiceSettings:'請求書設定',feeSettings:'会費設定',accounts:'アカウント管理'};
export function currentRoute(){return(location.hash.replace(/^#\/?/,'').split('?')[0]||'dashboard')}
export function go(route){location.hash='#/'+route}
export function onRoute(cb){addEventListener('hashchange',cb)}
