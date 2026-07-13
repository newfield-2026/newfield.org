import {
  currentRoute,
  currentParams,
  onRoute,
  go
} from './router.js';
let bootstrap=null;const root=document.querySelector('#app');
async function start(){if(!getToken())return login();try{bootstrap=await api('bootstrap');await render()}catch(e){if(/ログイン|登録|有効期限/.test(e.message)){clearToken();login(e.message)}else root.innerHTML=`<div class="error">${esc(e.message)}</div>`}}
function login(msg=''){root.innerHTML=`<div class="login"><div class="login-box"><h1>NFO 管理者サイト</h1><p class="muted">登録済みGoogleアカウントでログインしてください。</p>${msg?`<p class="error">${esc(msg)}</p>`:''}<div id="google-login"></div></div></div>`;const wait=()=>window.google?.accounts?.id?initGoogleLogin(document.querySelector('#google-login'),start):setTimeout(wait,100);wait()}
async function render(){root.innerHTML='<div class="loading">読み込み中…</div>';const route=currentRoute();let mod;try{mod=await import(`../../views/${route}.js`)}catch{mod=await import('../../views/placeholder.js')}const params = currentParams();

const body = await mod.render({
  user: bootstrap.user,
  fiscalYear: bootstrap.fiscalYear,
  invoiceId: params.get('invoiceId') || ''
});root.innerHTML=layout(bootstrap.user,body);mod.bind?.();document.querySelectorAll('[data-go]').forEach(x=>x.onclick=()=>go(x.dataset.go))}
onRoute(()=>bootstrap&&render());start();
