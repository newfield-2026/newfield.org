const TOKEN_KEY='nfo_id_token';
export function getToken(){return sessionStorage.getItem(TOKEN_KEY)||''}
export function clearToken(){sessionStorage.removeItem(TOKEN_KEY)}
export function initGoogleLogin(container,onLogin){
  const c=window.NFO_CONFIG?.GOOGLE_CLIENT_ID;
  if(!c||c.startsWith('REPLACE_')) throw new Error('GOOGLE_CLIENT_IDを設定してください。');
  google.accounts.id.initialize({client_id:c,callback:r=>{sessionStorage.setItem(TOKEN_KEY,r.credential);onLogin();}});
  google.accounts.id.renderButton(container,{theme:'outline',size:'large',text:'signin_with',locale:'ja'});
}
