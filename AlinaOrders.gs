/**
 * AlinaOrders.gs — вставить в существующий проект Apps Script.
 * Для включения: в существующем doGet(e) добавить первой строкой:
 * if (e && e.parameter && e.parameter.action === 'owner_orders') return handleOwnerOrdersGet_(e);
 * Затем развернуть новую версию веб-приложения. Не менять doPost/Payment.gs.
 */
function handleOwnerOrdersGet_(e) {
  const p = e.parameter || {};
  const callback = String(p.callback || '');
  if (!/^__alinaOrdersCallback[0-9]{1,12}$/.test(callback)) {
    return ContentService.createTextOutput('Invalid callback');
  }
  let result;
  try {
    if (p.op === 'owner_login_request') {
      result = requestAlinaLogin_();
      return alinaJsonp_(callback, result);
    }
    if (p.op === 'owner_login_verify') {
      result = verifyAlinaLoginCode_(String(p.code || ''));
      return alinaJsonp_(callback, result);
    }
    if (p.action !== 'owner_orders') throw new Error('Неизвестная операция');
    if (p.session) {
      const active = CacheService.getScriptCache().get('alina_session_' + String(p.session));
      if (active !== 'yes') throw new Error('Сессия истекла');
    } else {
      verifyAlinaInitData_(String(p.initData || ''));
    }
    const sh = getOrdersSheet_();
    const rows = sh.getDataRange().getValues();
    const orders = rows.slice(1).reverse().slice(0, 150).map(function(row) {
      let data = {};
      try { data = JSON.parse(String(row[3] || '{}')); } catch (_) {}
      return {
        id: String(row[0] || ''),
        date: row[1] instanceof Date ? Utilities.formatDate(row[1], Session.getScriptTimeZone(), 'dd.MM.yyyy HH:mm') : String(row[1] || ''),
        status: String(row[2] || ''),
        name: String(data.name || ''),
        phone: String(data.phone || ''),
        delivery: String(data.delivery || ''),
        address: String(data.address || ''),
        total: Number(data.total || 0),
        items: Array.isArray(data.items) ? data.items.map(function(item) {
          return {id:String(item.id||''),name:String(item.name||''),qty:Number(item.qty||1),price:Number(item.price||0)};
        }) : []
      };
    });
    result = {ok:true,orders:orders};
  } catch (err) {
    result = {ok:false,error:'Доступ не подтверждён или данные устарели'};
    console.error('owner_orders: ' + String(err));
  }
  return alinaJsonp_(callback, result);
}
function verifyAlinaInitData_(initData) {
  if (!initData) throw new Error('Нет initData Telegram');
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('BOT_TOKEN');
  const alinaId = props.getProperty('ALINA_CHAT_ID');
  if (!token || !alinaId) throw new Error('Не заданы настройки');
  const pairs = initData.split('&').map(function(part) {
    const pos = part.indexOf('=');
    return [decodeURIComponent(part.slice(0,pos).replace(/\+/g,' ')), decodeURIComponent(part.slice(pos+1).replace(/\+/g,' '))];
  });
  const map = {};
  pairs.forEach(function(p){map[p[0]]=p[1];});
  const hash = String(map.hash || '').toLowerCase();
  const authDate = Number(map.auth_date || 0);
  const now = Math.floor(Date.now()/1000);
  if (!/^[a-f0-9]{64}$/.test(hash) || !authDate || authDate > now+60 || now-authDate > 600) throw new Error('Устаревшая подпись');
  const check = pairs.filter(function(p){return p[0]!=='hash';})
    .sort(function(a,b){return a[0]<b[0]?-1:a[0]>b[0]?1:0;})
    .map(function(p){return p[0]+'='+p[1];}).join('\n');
  const secret = Utilities.computeHmacSha256Signature(token, 'WebAppData');
  const expected = Utilities.computeHmacSha256Signature(check, secret)
    .map(function(b){return ('0'+(b&255).toString(16)).slice(-2);}).join('');
  let diff=0;for(let i=0;i<64;i++)diff|=hash.charCodeAt(i)^expected.charCodeAt(i);
  if (diff!==0) throw new Error('Неверная подпись');
  const user = JSON.parse(map.user || '{}');
  if (String(user.id)!==String(alinaId)) throw new Error('Не Алина');
}

/* Вход через одноразовый код из Telegram. Токен бота остаётся в Script Properties. */
function alinaJsonp_(callback, result) {
  return ContentService.createTextOutput(callback + '(' +
    JSON.stringify(result).replace(/</g, '\\u003c') + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}
function requestAlinaLogin_() {
  const cache = CacheService.getScriptCache();
  if (cache.get('alina_login_cooldown')) {
    return {ok:false,error:'Код уже отправлен. Подождите минуту.'};
  }
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('BOT_TOKEN');
  const id = props.getProperty('ALINA_CHAT_ID');
  if (!token || !id) throw new Error('Настройки бота отсутствуют');
  const code = String(Math.floor(Math.random()*90000000)+10000000);
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, code)
    .map(function(b){return ('0'+(b&255).toString(16)).slice(-2);}).join('');
  cache.put('alina_login_code', digest, 300);
  cache.put('alina_login_tries', '0', 300);
  cache.put('alina_login_cooldown', 'yes', 60);
  const resp = UrlFetchApp.fetch('https://api.telegram.org/bot'+token+'/sendMessage', {
    method:'post',contentType:'application/json',
    payload:JSON.stringify({chat_id:id,text:'🔐 Код входа в «Мои заказы»: '+code+'\\nДействует 5 минут. Никому не сообщайте.'}),
    muteHttpExceptions:true
  });
  if (resp.getResponseCode() !== 200) throw new Error('Не удалось отправить код Алине');
  return {ok:true,message:'Код отправлен Алине в Telegram. Действует 5 минут.'};
}
function verifyAlinaLoginCode_(code) {
  if (!/^[0-9]{8}$/.test(code)) throw new Error('Введите 8 цифр');
  const cache=CacheService.getScriptCache();
  const expected=cache.get('alina_login_code');
  const tries=Number(cache.get('alina_login_tries')||0);
  if (!expected || tries>=5) throw new Error('Код истёк или заблокирован. Запросите новый.');
  cache.put('alina_login_tries',String(tries+1),300);
  const digest=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,code)
    .map(function(b){return ('0'+(b&255).toString(16)).slice(-2);}).join('');
  if (digest!==expected) throw new Error('Неверный код');
  cache.remove('alina_login_code');
  const session=Utilities.getUuid().replace(/-/g,'')+Utilities.getUuid().replace(/-/g,'');
  cache.put('alina_session_'+session,'yes',3600);
  return {ok:true,session:session,expiresIn:3600};
}
