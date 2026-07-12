import{getToken,clearToken}from'./auth.js';
export async function api(action,payload={}){
 const url=window.NFO_CONFIG?.GAS_API_URL;if(!url||url.includes('REPLACE_'))throw new Error('GAS_API_URLを設定してください。');
 const res=await fetch(url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action,payload,idToken:getToken()}),redirect:'follow'});
 const text=await res.text();let json;try{json=JSON.parse(text)}catch{throw new Error('API応答を読み取れません。GASの公開設定またはCORSを確認してください。')}
 if(!json.ok){if(/ログイン|有効期限/.test(json.error||''))clearToken();throw new Error(json.error||'APIエラー')}
 return json.data;
}
