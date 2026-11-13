/* Ghost Discipline: simplified Log Trade (Executed / Live / Pending) + smart trade import.
 *
 * Sources: screenshots (AI vision), pasted text (regex first, AI fallback),
 * CSV and MT4/MT5 HTML statements (deterministic, no AI cost).
 * After import the trader only has to supply SL and TP for each trade; anything
 * the screenshot didn't show is matched against existing orders first.
 *
 * Loaded by app.html after the main script. Relies on app globals:
 * state, sb, currentUser, userTier, isDemoMode, closingOrderId, submitTrade,
 * proceedToTrade, closeOrder, saveState, renderAll, showToast, escapeHtml, todayStr.
 */
(function(){
'use strict';

var gdStatus = 'executed';
/* Screenshots allowed per upload (one screenshot can hold many trades).
   Pro = 2, Elite and above = 10, Free = no image import. */
function imageLimit(){
  if(isDemoMode) return 0;
  if(typeof tierAtLeast==='function' && tierAtLeast('elite')) return 10;
  if(typeof tierAtLeast==='function' && tierAtLeast('pro')) return 2;
  return 0;
}
function tierName(){ return userTier==='premium' ? 'Premium' : (userTier==='elite' ? 'Elite' : (userTier==='pro' ? 'Pro' : 'Free')); }
/* ---------- accounts: the same list the Log Trade form offers ---------- */
function acctList(){
  var list = [{ id:'personal', label:'Personal' }];
  if(isDemoMode) return list;
  var pfs = (typeof activePropFirmAccounts==='function') ? activePropFirmAccounts() : (state.propFirms||[]);
  pfs.forEach(function(pf){ list.push({ id:pf.id, label:'Prop Firm \u2014 ' + (pf.firmName || 'Unnamed account') }); });
  return list;
}
function acctLabel(id){ var a = acctList().filter(function(x){ return x.id===id; })[0]; return a ? a.label : 'Personal'; }
function acctOptionsHtml(selected){
  var list = acctList();
  var html = list.length>1 ? '<option value=""' + (selected ? '' : ' selected') + '>Choose account\u2026</option>' : '';
  return html + list.map(function(a){ return '<option value="' + escapeHtml(String(a.id)) + '"' + (a.id===selected ? ' selected' : '') + '>' + escapeHtml(a.label) + '</option>'; }).join('');
}
function fillAccountSelects(){
  ['gdImpAccount','gdRevAccount'].forEach(function(id){ var el = document.getElementById(id); if(el) el.innerHTML = acctOptionsHtml(imp.account); });
  var hint = document.getElementById('gdImpAcctHint');
  if(hint) hint.textContent = acctList().length>1 ? 'Trades, orders, drawdown and discipline all update on the account you pick.' : '';
}
window.gdSetAccount = function(v){
  imp.account = acctList().some(function(a){ return a.id===v; }) ? v : '';
  fillAccountSelects();
  var m = $('gdImpMsg'); if(m && imp.account) m.textContent = '';
  if(imp.rows && imp.rows.length){ imp.rows.forEach(function(r,i){ refreshRow(i); }); refreshCommit(); }
};
window.gdUpgrade = function(){ if(typeof packageUpgradeUrl==='function') window.location.assign(packageUpgradeUrl('pro')); };
var FREE_IMPORTS_PER_DAY = 3;
var imp = { images:[], rows:[], tab:'photos', text:'', fileName:'', keepShots:true, busy:false };

/* ---------- small helpers ---------- */
function $(id){ return document.getElementById(id); }
function num(v){
  if(v==null || v==='') return null;
  if(typeof v==='number') return isFinite(v) ? v : null;
  var s = String(v).trim(); var neg = /^\(.*\)$/.test(s);
  s = s.replace(/[^0-9.\-]/g,'');
  if(!s || s==='-' || s==='.') return null;
  var n = parseFloat(s); if(!isFinite(n)) return null;
  return neg ? -Math.abs(n) : n;
}
function normPair(p){
  if(!p) return '';
  var s = String(p).toUpperCase().trim();
  if(/^(GOLD|XAU)$/.test(s)) return 'XAUUSD';
  if(/^(SILVER|XAG)$/.test(s)) return 'XAGUSD';
  s = s.replace(/^[A-Z]+:/,'').replace(/[^A-Z0-9]/g,'');
  return s.slice(0,12);
}
function normDir(d){
  var s = String(d||'').toLowerCase();
  if(/buy|long/.test(s)) return 'buy';
  if(/sell|short/.test(s)) return 'sell';
  return '';
}
function fmt(n){ return n==null ? '' : String(+(+n).toFixed(5)); }
function utcKey(){ var d=new Date(); return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0')+'-'+String(d.getUTCDate()).padStart(2,'0'); }
function validDate(s){ return /^\d{4}-\d{2}-\d{2}$/.test(s||'') && s <= todayStr(); }
function sideError(dir, entry, sl, tp, strictSL){
  // Checks each level on its own, so a half-filled order is still validated.
  // A closed trade's SL may have been trailed past entry, so only live / pending orders get the SL side check.
  if(entry==null) return null;
  if(dir==='buy'){
    if(strictSL && sl!=null && !(sl<entry)) return 'Buy: SL must be below entry';
    if(tp!=null && !(tp>entry)) return 'Buy: TP must be above entry';
  }
  if(dir==='sell'){
    if(strictSL && sl!=null && !(sl>entry)) return 'Sell: SL must be above entry';
    if(tp!=null && !(tp<entry)) return 'Sell: TP must be below entry';
  }
  return null;
}
function plannedRR(entry, sl, tp){
  if(entry==null||sl==null||tp==null||entry===sl) return null;
  return Math.abs(tp-entry)/Math.abs(entry-sl);
}

/* ---------- styles ---------- */
function injectCss(){
  if($('gdImportCss')) return;
  var st = document.createElement('style'); st.id='gdImportCss';
  st.textContent = [
  '.gd-status-seg{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:12px 0 10px;padding:4px;border:1px solid var(--steel);border-radius:14px}',
  '.gd-status-seg button{border:0;background:transparent;color:var(--slate);font:600 12.5px inherit;padding:9px 6px;border-radius:10px;cursor:pointer}',
  '.gd-status-seg button.on{background:rgba(255,255,255,.08);color:var(--platinum);box-shadow:inset 0 0 0 1px var(--steel)}',
  '.gd-import-btn{margin-bottom:12px}',
  '.gd-more-link{background:none;border:0;color:var(--slate);font-size:12px;cursor:pointer;padding:2px 0 10px;text-decoration:underline}',
  '#tradeOverlay .modal[data-gd-status="live"] .gd-exec-only,#tradeOverlay .modal[data-gd-status="pending"] .gd-exec-only{display:none!important}',
  '#tradeOverlay .modal:not([data-gd-status="executed"]) .gd-exec-field{display:none!important}',
  '#tradeOverlay .modal:not([data-gd-status="pending"]) .gd-pending-field{display:none!important}',
  '#tradeOverlay .modal[data-gd-closing="1"] .gd-trade-fields,#tradeOverlay .modal[data-gd-closing="1"] .gd-status-seg,#tradeOverlay .modal[data-gd-closing="1"] .gd-import-btn{display:none!important}',
  '#tradeOverlay .modal label[for="t_quickMode"],#tradeOverlay .modal #t_quickMode{display:none}',
  '#tradeOverlay .modal > div:first-child > label{display:none!important}',
  '.gd-live-chip{margin-left:6px;font-size:9.5px;letter-spacing:.06em;color:var(--win-bright);border:1px solid rgba(52,211,153,.4);padding:1px 6px;border-radius:999px}',
  '.gd-fill-btn{background:rgba(255,255,255,.06)}',
  /* import sheet */
  '#gdImportOverlay .modal{max-width:640px;width:100%;max-height:92vh;overflow:auto}',
  '.gd-tabs{display:flex;gap:6px;margin:10px 0 12px}',
  '.gd-tabs button{flex:1;border:1px solid var(--steel);background:transparent;color:var(--slate);border-radius:10px;padding:8px;font-size:12.5px;cursor:pointer}',
  '.gd-tabs button.on{color:var(--platinum);background:rgba(255,255,255,.08)}',
  '.gd-drop{border:1.5px dashed var(--steel);border-radius:14px;padding:22px 14px;text-align:center;color:var(--slate);font-size:13px;cursor:pointer}',
  '.gd-drop.over{border-color:var(--platinum);color:var(--platinum)}',
  '.gd-thumbs{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}',
  '.gd-thumb{position:relative;width:74px;height:74px;border-radius:10px;overflow:hidden;border:1px solid var(--steel)}',
  '.gd-thumb img{width:100%;height:100%;object-fit:cover}',
  '.gd-thumb button{position:absolute;top:2px;right:2px;border:0;background:rgba(0,0,0,.65);color:#fff;border-radius:50%;width:20px;height:20px;cursor:pointer;font-size:11px}',
  '.gd-row{border:1px solid var(--steel);border-radius:14px;padding:12px;margin:10px 0}',
  '.gd-row.skip{opacity:.5}',
  '.gd-row.ok{border-color:rgba(52,211,153,.45)}',
  '.gd-row-head{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px;font-size:13px;flex-wrap:wrap}',
  '.gd-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}',
  '.gd-grid label,.gd-sltp label{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--slate);margin-bottom:3px}',
  '.gd-grid input,.gd-grid select,.gd-sltp input{width:100%;box-sizing:border-box}',
  '.gd-sltp{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}',
  '.gd-sltp input.gd-need{border-color:var(--gold-bright,#e6c36a);box-shadow:0 0 0 1px var(--gold-bright,#e6c36a)}',
  '.gd-sltp input.gd-bad{border-color:var(--loss-bright);box-shadow:0 0 0 1px var(--loss-bright)}',
  '.gd-low{border-color:var(--gold-bright,#e6c36a)!important}',
  '.gd-meta{margin-top:8px;font-size:11.5px;color:var(--slate)}',
  '.gd-meta .err{color:var(--loss-bright)}',
  '.gd-src{font-size:10px;color:var(--slate);margin-top:2px;text-transform:none;letter-spacing:0}',
  '.gd-row[data-status="live"] .gd-exec,.gd-row[data-status="pending"] .gd-exec{display:none}',
  '.gd-note{font-size:12px;color:var(--slate);margin:6px 0}',
  '.gd-penalty{font-size:11.5px;color:var(--gold-bright,#e6c36a);margin:-2px 0 10px}',
  '.gd-penalty:empty{display:none}',
  '.gd-row.warn{border-color:rgba(230,195,106,.5)}',
  '.gd-meta .warn{color:var(--gold-bright,#e6c36a)}',
  '.gd-lock{border:1px solid var(--steel);border-radius:14px;padding:18px 14px;text-align:center;color:var(--slate);font-size:13px;line-height:1.5}',
  '.gd-lock b{display:block;color:var(--platinum);margin-bottom:6px;font-size:14px}',
  '#gdDashOrders .gd-dash-drop{margin-top:12px}',
  '#gdDashOrders .gd-dash-meta{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;font-size:11.5px;color:var(--slate)}',
  '#gdDashOrders .gd-pill{border:1px solid var(--steel);border-radius:999px;padding:3px 10px}',
  '#gdDashOrders .gd-pill.hot{color:var(--gold-bright,#e6c36a);border-color:rgba(230,195,106,.45)}',
  '@media(max-width:560px){.gd-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}'
  ].join('\n');
  document.head.appendChild(st);
}

/* =====================================================================
   PART 1: unified Log Trade modal (Executed / Live / Pending)
   ===================================================================== */
window.gdTradeExtra = function(){
  var g = function(id){ var e=$(id); return e ? e.value : ''; };
  return { pair: normPair(g('gd_pair')) || null, direction: g('gd_dir') || null,
    entry: num(g('gd_entry')), sl: num(g('gd_sl')), tp: num(g('gd_tp')), lot: num(g('gd_lot')), exit: num(g('gd_exit')) };
};
window.gdSetTradeStatus = function(st){
  gdStatus = st;
  var modal = document.querySelector('#tradeOverlay .modal'); if(modal) modal.setAttribute('data-gd-status', st);
  document.querySelectorAll('#gd_statusSeg button').forEach(function(b){ b.classList.toggle('on', b.getAttribute('data-status')===st); });
  var save = $('t_saveBtn'); if(save) save.textContent = st==='executed' ? 'Save Trade' : (st==='live' ? 'Save Live Trade' : 'Place Order');
};
window.gdToggleMore = function(){
  var cb = $('t_quickMode'); if(!cb) return;
  cb.checked = !cb.checked; if(typeof toggleQuickLogMode==='function') toggleQuickLogMode();
  gdMoreLabel();
};
function gdMoreLabel(){
  var cb = $('t_quickMode'), b = $('gd_moreBtn'); if(!cb||!b) return;
  b.textContent = cb.checked ? 'More details ▾' : 'Fewer details ▴';
}
function resetModalFields(){
  ['gd_pair','gd_entry','gd_sl','gd_tp','gd_lot','gd_exit'].forEach(function(id){ var e=$(id); if(e) e.value=''; });
  var d=$('gd_dir'); if(d) d.value='buy'; var ot=$('gd_orderType'); if(ot) ot.value='limit';
  penaltyHintFor('gd_entry','gd_sl','gd_tp','gd_penalty');
}
function modalValidate(x, needLevels){
  if(needLevels && (!x.pair || x.entry==null)) return 'Add the pair and entry price';
  var se = sideError(x.direction, x.entry, x.sl, x.tp, !!needLevels);
  return se;
}

async function submitOrderFromModal(st){
  var x = window.gdTradeExtra();
  var err = modalValidate(x, true);
  if(err){ showToast(err); return; }
  var strategy = ($('t_strategy') && $('t_strategy').value) || null;
  var stratObj = (state.psychology.strategies||[]).find(function(s){ return s.id===strategy; });
  var now = new Date();
  var rr = plannedRR(x.entry, x.sl, x.tp);
  var miss = gdMissingLevelViolations(x.sl, x.tp);
  state.psychology.orders.push({
    id:'ord_'+Date.now(), date:todayStr(), time:now.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}),
    trader: $('t_trader').value, strategy: strategy, strategyType: stratObj ? stratObj.type : null,
    style:'intraday', logics: (typeof getCheckedLogics==='function') ? getCheckedLogics('tradeLogicChoices') : [],
    pair:x.pair, direction:x.direction, entry:x.entry, sl:x.sl, tp:x.tp, lot:x.lot,
    rrPlanned: rr!=null ? rr.toFixed(2) : null, notes: ($('t_notes')||{}).value || '',
    status: st, orderType: st==='pending' ? ($('gd_orderType').value||'limit') : 'market',
    account: ($('t_account') && $('t_account').value) || 'personal',
    ruleViolations: miss.codes, ruleViolationLabels: miss.labels
  });
  if(miss.codes.length) gdApplyRuleBreak();
  closeModal('tradeOverlay');
  resetModalFields();
  await saveState(); renderAll();
  showToast((st==='live' ? 'Live trade saved. Close it out when it finishes.' : 'Order placed.') + (miss.codes.length ? ' No ' + miss.codes.map(function(c){ return c==='noSL' ? 'SL' : 'TP'; }).join(' or ') + ' logged: discipline score ' + computeDisciplineScore() + '.' : ''));
}

window.gdMarkFilled = async function(id){
  var o = (state.psychology.orders||[]).find(function(x){ return x.id===id; });
  if(!o) return;
  o.status = 'live'; o.filledAt = new Date().toISOString();
  await saveState(); renderAll();
  showToast('Marked as live');
};

function wireModal(){
  if(typeof submitTrade==='function' && !submitTrade.__gd){
    var origSubmit = submitTrade;
    var wrapped = async function(){
      if(closingOrderId || gdStatus==='executed'){
        var x = window.gdTradeExtra();
        var err = modalValidate(x, false);
        if(err){ showToast(err); return; }
        // Auto R:R from entry / SL / exit when the trader left it blank.
        var rrEl = $('t_rr');
        if(rrEl && !rrEl.value && x.entry!=null && x.sl!=null && x.entry!==x.sl){
          var res = $('t_result').value;
          var r = (res==='win' && x.exit!=null) ? Math.abs(x.exit-x.entry)/Math.abs(x.entry-x.sl) : plannedRR(x.entry,x.sl,x.tp);
          if(res==='win' && r!=null) rrEl.value = r.toFixed(2);
        }
        var out = await origSubmit.apply(this, arguments);
        resetModalFields();
        return out;
      }
      return submitOrderFromModal(gdStatus);
    };
    wrapped.__gd = true; submitTrade = wrapped;
  }
  if(typeof proceedToTrade==='function' && !proceedToTrade.__gd){
    var origProceed = proceedToTrade;
    var wp = function(){
      try{ if(localStorage.getItem('gd_quicklog')===null) localStorage.setItem('gd_quicklog','1'); }catch(e){}
      var modal = document.querySelector('#tradeOverlay .modal'); if(modal) modal.removeAttribute('data-gd-closing');
      resetModalFields(); window.gdSetTradeStatus('executed');
      var out = origProceed.apply(this, arguments); gdMoreLabel(); return out;
    };
    wp.__gd = true; proceedToTrade = wp;
  }
  if(typeof closeOrder==='function' && !closeOrder.__gd){
    var origClose = closeOrder;
    var wc = function(id, result){
      var out = origClose.apply(this, arguments);
      var modal = document.querySelector('#tradeOverlay .modal');
      if(modal) modal.setAttribute('data-gd-closing','1');
      window.gdSetTradeStatus('executed');
      var o = (state.psychology.orders||[]).find(function(x){ return x.id===id; });
      if(o){ // carry the order's levels onto the closed trade
        var set = function(i,v){ var e=$(i); if(e) e.value = v==null ? '' : v; };
        set('gd_pair',o.pair); set('gd_dir',o.direction||'buy'); set('gd_entry',o.entry); set('gd_sl',o.sl); set('gd_tp',o.tp); set('gd_lot',o.lot);
      }
      return out;
    };
    wc.__gd = true; closeOrder = wc;
  }
}

function injectModalFields(){
  var modal = document.querySelector('#tradeOverlay .modal');
  if(!modal || $('gd_statusSeg')) return;
  var head = modal.firstElementChild; // header row with title + Quick Log checkbox
  var wrap = document.createElement('div');
  wrap.innerHTML =
    '<div class="gd-status-seg" id="gd_statusSeg" role="tablist" aria-label="Trade status">' +
      '<button type="button" class="on" data-status="executed" onclick="gdSetTradeStatus(\'executed\')">Executed</button>' +
      '<button type="button" data-status="live" onclick="gdSetTradeStatus(\'live\')">Live</button>' +
      '<button type="button" data-status="pending" onclick="gdSetTradeStatus(\'pending\')">Pending</button>' +
    '</div>' +
    '<button type="button" class="btn btn-ghost btn-block gd-import-btn" onclick="gdOpenImport()">Import today\u2019s trades from screenshots</button>' +
    '<div class="gd-trade-fields">' +
      '<div class="row2"><div class="field"><label>Pair</label><input type="text" id="gd_pair" list="pairSuggestions" placeholder="e.g. XAUUSD"></div>' +
      '<div class="field"><label>Direction</label><select id="gd_dir"><option value="buy">Buy</option><option value="sell">Sell</option></select></div></div>' +
      '<div class="row2"><div class="field"><label>Entry</label><input type="number" step="any" id="gd_entry" placeholder="e.g. 1.0850"></div>' +
      '<div class="field"><label>Lot size</label><input type="number" step="0.01" min="0" id="gd_lot" placeholder="e.g. 0.10"></div></div>' +
      '<div class="row2"><div class="field"><label>Stop loss</label><input type="number" step="any" id="gd_sl" placeholder="SL"></div>' +
      '<div class="field"><label>Take profit</label><input type="number" step="any" id="gd_tp" placeholder="TP"></div></div>' +
      '<div class="gd-penalty" id="gd_penalty"></div>' +
      '<div class="row2"><div class="field gd-exec-field"><label>Exit price <span class="hint-inline">optional</span></label><input type="number" step="any" id="gd_exit" placeholder="Close price"></div>' +
      '<div class="field gd-pending-field"><label>Order type</label><select id="gd_orderType"><option value="limit">Limit</option><option value="stop">Stop</option></select></div></div>' +
    '</div>' +
    '<button type="button" class="gd-more-link" id="gd_moreBtn" onclick="gdToggleMore()">More details \u25be</button>';
  var anchor = head.nextElementSibling; // first .row2 (Trader / Account)
  while(wrap.firstChild) modal.insertBefore(wrap.firstChild, anchor);
  // Mark the executed-only fields so Live / Pending hide them.
  var res = $('t_result'); if(res && res.parentElement) res.parentElement.classList.add('gd-exec-only');
  var rrEl = $('t_rr'); if(rrEl){ var row = rrEl.closest('.row2'); if(row) row.classList.add('gd-exec-only'); }
  var prev = $('tradeRiskPreview'); if(prev) prev.classList.add('gd-exec-only');
  modal.setAttribute('data-gd-status','executed');
  gdMoreLabel();
}

/* =====================================================================
   PART 2: import sheet
   ===================================================================== */
function buildOverlay(){
  if($('gdImportOverlay')) return;
  var ov = document.createElement('div'); ov.className='overlay'; ov.id='gdImportOverlay';
  ov.innerHTML =
    '<div class="modal">' +
      '<div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">' +
        '<div><h3 style="margin-bottom:2px">Import trades</h3><div class="sub" style="margin-bottom:0">We read the details. You only add SL and TP.</div></div>' +
        '<button class="btn btn-sm btn-ghost" onclick="gdCloseImport()" aria-label="Close">\u2715</button>' +
      '</div>' +
      '<div id="gdImpInput">' +
        '<div class="field" style="margin-top:12px"><label>Import into which account?</label><select id="gdImpAccount" onchange="gdSetAccount(this.value)"></select><div class="gd-note" id="gdImpAcctHint" style="margin-top:4px"></div></div>' +
        '<div class="gd-tabs">' +
          '<button type="button" data-tab="photos" class="on" onclick="gdImpTab(\'photos\')">Photos</button>' +
          '<button type="button" data-tab="text" onclick="gdImpTab(\'text\')">Paste text</button>' +
          '<button type="button" data-tab="file" onclick="gdImpTab(\'file\')">CSV / MT report</button>' +
        '</div>' +
        '<div id="gdTabPhotos">' +
          '<div id="gdPhotoLock" class="gd-lock" style="display:none"><b>Screenshot import is on Pro and above</b>Upload screenshots of your orders and we read the trades for you. Pro: 2 screenshots per upload. Elite and above: 10.<div class="btn-row" style="margin-top:12px"><button class="btn btn-primary" style="flex:1" onclick="gdUpgrade()">See plans</button></div></div>' +
          '<div id="gdPhotoBody">' +
            '<div class="gd-drop" id="gdDrop" onclick="$gdPick()">Tap to add screenshots of your orders or trade history<br><small id="gdDropHint"></small></div>' +
            '<input type="file" id="gdImgInput" accept="image/*" multiple style="display:none">' +
            '<div class="gd-thumbs" id="gdThumbs"></div>' +
          '</div>' +
        '</div>' +
        '<div id="gdTabText" style="display:none">' +
          '<div class="field"><textarea id="gdPasteText" rows="7" placeholder="Paste broker history, a Telegram/email trade message, or a signal. e.g. BUY XAUUSD @ 2650.5 SL 2645 TP 2662 0.10 lots"></textarea></div>' +
        '</div>' +
        '<div id="gdTabFile" style="display:none">' +
          '<div class="gd-drop" onclick="$gdPickFile()">Choose a CSV or an MT4 / MT5 HTML statement<br><small>Parsed in your browser. No AI needed.</small></div>' +
          '<input type="file" id="gdFileInput" accept=".csv,.txt,.htm,.html,text/csv,text/html" style="display:none">' +
          '<div class="gd-note" id="gdFileName"></div>' +
        '</div>' +
        '<label class="gd-note" style="display:flex;gap:8px;align-items:center;margin-top:10px"><input type="checkbox" id="gdKeepShots" checked> Keep screenshots with these trades</label>' +
        '<div class="btn-row" style="margin-top:10px"><button class="btn btn-ghost" style="flex:1" onclick="gdCloseImport()">Cancel</button>' +
        '<button class="btn btn-primary" style="flex:1" id="gdReadBtn" onclick="gdRunExtract()">Read trades</button></div>' +
        '<div class="gd-note" id="gdImpMsg"></div>' +
      '</div>' +
      '<div id="gdImpReview" style="display:none"></div>' +
    '</div>';
  document.body.appendChild(ov);
  window.$gdPick = function(){ $('gdImgInput').click(); };
  window.$gdPickFile = function(){ $('gdFileInput').click(); };
  $('gdImgInput').addEventListener('change', function(e){ addFiles(e.target.files); e.target.value=''; });
  $('gdFileInput').addEventListener('change', function(e){ readTextFile(e.target.files[0]); e.target.value=''; });
  var drop = $('gdDrop');
  ['dragover','dragenter'].forEach(function(ev){ drop.addEventListener(ev, function(e){ e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave','drop'].forEach(function(ev){ drop.addEventListener(ev, function(e){ e.preventDefault(); drop.classList.remove('over'); }); });
  drop.addEventListener('drop', function(e){ addFiles(e.dataTransfer.files); });
  document.addEventListener('paste', function(e){
    if(!$('gdImportOverlay').classList.contains('show') || imp.tab!=='photos') return;
    var items = (e.clipboardData && e.clipboardData.files) || [];
    if(items.length){ addFiles(items); e.preventDefault(); }
  });
}
window.gdOpenImport = function(files){
  if(isDemoMode){ showToast('Import is not available in demo mode'); return; }
  buildOverlay();
  imp = { images:[], rows:[], tab:'photos', busy:false, date: todayStr(), account: (acctList().length===1 ? 'personal' : '') };
  fillAccountSelects();
  $('gdImpInput').style.display=''; $('gdImpReview').style.display='none'; $('gdImpMsg').textContent='';
  $('gdPasteText').value=''; $('gdFileName').textContent='';
  var lim = imageLimit();
  $('gdPhotoLock').style.display = lim ? 'none' : '';
  $('gdPhotoBody').style.display = lim ? '' : 'none';
  $('gdDropHint').textContent = 'or drop / paste images. Up to ' + lim + ' per upload on ' + tierName() + (lim<10 ? ' (Elite and above: 10)' : '') + '. Each screenshot can show lots of trades. MT4, MT5, cTrader, TradingView and broker apps work.';
  renderThumbs(); window.gdImpTab('photos');
  closingOrderId = null;
  closeModal('tradeOverlay');
  $('gdImportOverlay').classList.add('show');
  if(files && files.length && lim) addFiles(files);
};
window.gdCloseImport = function(){ var o=$('gdImportOverlay'); if(o) o.classList.remove('show'); };
window.gdImpTab = function(t){
  imp.tab = t;
  document.querySelectorAll('#gdImportOverlay .gd-tabs button').forEach(function(b){ b.classList.toggle('on', b.getAttribute('data-tab')===t); });
  $('gdTabPhotos').style.display = t==='photos' ? '' : 'none';
  $('gdTabText').style.display = t==='text' ? '' : 'none';
  $('gdTabFile').style.display = t==='file' ? '' : 'none';
  $('gdKeepShots').parentElement.style.display = t==='photos' ? 'flex' : 'none';
};

function normalizeImage(file){
  return new Promise(function(resolve, reject){
    var reader = new FileReader();
    reader.onload = function(){
      var img = new Image();
      img.onload = function(){
        var MAX = 2200, w = img.width, h = img.height;
        if(w>MAX || h>MAX){ var s = MAX/Math.max(w,h); w=Math.round(w*s); h=Math.round(h*s); }
        var c = document.createElement('canvas'); c.width=w; c.height=h;
        var ctx = c.getContext('2d'); ctx.fillStyle='#fff'; ctx.fillRect(0,0,w,h); ctx.drawImage(img,0,0,w,h);
        var url = c.toDataURL('image/jpeg', 0.9);
        resolve({ mime:'image/jpeg', data:url.slice(url.indexOf(',')+1), previewUrl:url });
      };
      img.onerror = function(){ reject(new Error('Could not read that image')); };
      img.src = reader.result;
    };
    reader.onerror = function(){ reject(new Error('File read failed')); };
    reader.readAsDataURL(file);
  });
}
async function addFiles(list){
  var lim = imageLimit();
  if(!lim){ showToast('Screenshot import is available on Pro and above'); return; }
  for(var i=0;i<list.length;i++){
    var f = list[i];
    if(!f.type || f.type.indexOf('image/')!==0) continue;
    if(imp.images.length>=lim){
      showToast(lim<10 ? 'Your plan allows ' + lim + ' screenshots per upload. Elite and above allow 10.' : 'Maximum ' + lim + ' screenshots per upload');
      break;
    }
    if(f.size > 12*1024*1024){ showToast('Image too large (max 12MB)'); continue; }
    try{ imp.images.push(await normalizeImage(f)); }catch(e){ showToast(e.message); }
  }
  renderThumbs();
}
function renderThumbs(){
  var el = $('gdThumbs'); if(!el) return;
  el.innerHTML = imp.images.map(function(im,i){
    return '<div class="gd-thumb"><img src="'+im.previewUrl+'" alt="Screenshot '+(i+1)+'"><button type="button" onclick="gdRemoveImg('+i+')" aria-label="Remove">\u2715</button></div>';
  }).join('');
}
window.gdRemoveImg = function(i){ imp.images.splice(i,1); renderThumbs(); };
function readTextFile(f){
  if(!f) return;
  if(f.size > 4*1024*1024){ showToast('File too large'); return; }
  var r = new FileReader();
  r.onload = function(){ imp.fileText = String(r.result||''); imp.fileName = f.name; $('gdFileName').textContent = 'Loaded: '+f.name; };
  r.readAsText(f);
}

/* ---------- AI (shared house model via the existing ai-proxy) ---------- */
function extractSystemPrompt(){
  return 'You read screenshots or text of a trader\'s broker / trading-app history (MT4, MT5, cTrader, TradingView, Exness, etc.) and extract every trade or order shown.\n' +
  'Return ONLY one JSON object, no prose and no markdown:\n' +
  '{"date":"YYYY-MM-DD or null","broker":string|null,"account":string|null,"trades":[{"imageIndex":0,"pair":"EURUSD","direction":"buy"|"sell","status":"closed"|"open"|"pending","orderType":"market"|"limit"|"stop"|null,"lot":number|null,"entry":number|null,"exit":number|null,"sl":number|null,"tp":number|null,"profit":number|null,"ticket":string|null,"openTime":string|null,"closeTime":string|null,"confidence":0.0-1.0}]}\n' +
  'Rules: copy only values that are visible. Use null for anything missing or unreadable. Never guess, estimate or calculate SL or TP. Profit is signed (negative = loss) in account currency. ' +
  'Also read TradingView long/short position tool boxes (entry, stop, target). Normalise symbols (Gold -> XAUUSD, US30, NAS100, EURUSD). If screenshots overlap, list each trade once. Ignore balance, deposit and withdrawal rows. ' +
  '"date" is the trading day shown (the most common close date). Today is ' + todayStr() + '. imageIndex is the zero-based index of the image the trade appears in.';
}
async function callAI(userText, images){
  var s = await sb.auth.getSession();
  var session = s && s.data && s.data.session;
  if(!session) throw new Error('Sign in to use AI import');
  var parts = (images||[]).map(function(im){ return { inline_data:{ mime_type:im.mime, data:im.data } }; });
  parts.push({ text:userText });
  var body = {
    model: userTier==='premium' ? 'gemini-3.1-pro-preview' : 'gemini-3.8-flash',
    contents:[{ role:'user', parts:parts }],
    systemInstruction:{ role:'user', parts:[{ text:extractSystemPrompt() }] },
    generationConfig:{ temperature:0.1, maxOutputTokens:4096 }
  };
  var res = await fetch(SUPABASE_URL + '/functions/v1/ai-proxy', {
    method:'POST',
    headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer '+session.access_token, 'apikey':SUPABASE_KEY },
    body: JSON.stringify(body)
  });
  if(!res.ok){
    var err = await res.json().catch(function(){return {};});
    throw new Error((err.error && err.error.message) || ('AI request failed ('+res.status+')'));
  }
  var data = await res.json();
  var cand = data.candidates && data.candidates[0];
  var text = cand && cand.content && cand.content.parts && cand.content.parts.map(function(p){ return p.text||''; }).join('');
  if(!text) throw new Error('The AI returned nothing. Try a clearer screenshot.');
  return text;
}
function parseJsonLoose(text){
  var t = String(text).replace(/```json|```/gi,'').trim();
  var a = t.indexOf('{'), b = t.lastIndexOf('}');
  if(a<0 || b<=a) return null;
  try{ return JSON.parse(t.slice(a,b+1)); }catch(e){ return null; }
}
async function aiExtract(userText, images){
  var raw = await callAI(userText, images), obj = parseJsonLoose(raw);
  if(!obj){ // one strict retry
    raw = await callAI(userText + '\n\nYour previous reply was not valid JSON. Reply with the JSON object only.', images);
    obj = parseJsonLoose(raw);
  }
  if(!obj || !Array.isArray(obj.trades)) throw new Error('Could not read trades from that. Try a clearer image or paste the text.');
  return obj;
}
async function claimImport(){
  // Shares SciFe's daily image allowance (trader_data.scife.usage). One import = one use.
  try{
    var r = await sb.from('trader_data').select('scife').eq('user_id', currentUser.id).maybeSingle();
    var sc = (r.data && r.data.scife) || {}, u = sc.usage || {};
    if(u.isAdmin || userTier==='premium') return true;
    var tk = utcKey(), count = u.imgDayKey===tk ? (u.imgCount||0) : 0;
    if(count >= FREE_IMPORTS_PER_DAY) return false;
    u.imgDayKey = tk; u.imgCount = count+1; sc.usage = u;
    await sb.from('trader_data').update({ scife: sc, updated_at: new Date().toISOString() }).eq('user_id', currentUser.id);
    return true;
  }catch(e){ return true; }
}

/* ---------- deterministic parsers ---------- */
var HEADER_KEYS = {
  pair:/^(symbol|pair|instrument|item|market|asset)$/, dir:/^(type|side|direction|action|order type)$/,
  lot:/^(volume|lots?|size|qty|quantity|lot size)$/, price:/^(price|open price|entry|entry price|open)$/,
  exit:/^(close price|exit|exit price|closing price|close)$/, sl:/^(s\/l|sl|stop loss|stoploss|stop)$/, tp:/^(t\/p|tp|take profit|takeprofit|target)$/,
  profit:/^(profit|p&l|pnl|net profit|net p&l|realized p&l|gain)$/, ticket:/^(ticket|order|position|position id|deal|id|order id)$/,
  openTime:/^(open time|time|date|opened|open date)$/, closeTime:/^(close time|closed|close date)$/
};
function mapTable(headers, rows){
  var idx = {};
  headers.forEach(function(h,i){
    var k = String(h||'').toLowerCase().trim();
    Object.keys(HEADER_KEYS).forEach(function(key){
      if(HEADER_KEYS[key].test(k)){ (idx[key] = idx[key] || []).push(i); }
    });
  });
  if(!idx.pair || !idx.dir) return [];
  var out = [];
  rows.forEach(function(r){
    var dir = normDir(r[idx.dir[0]]); if(!dir) return;
    var g = function(key, n){ var a = idx[key]; return a && a[n||0]!=null ? r[a[n||0]] : null; };
    // MT4 has two "Price" columns: open then close.
    var entry = num(g('price',0)), exit = num(g('exit',0));
    if(exit==null && idx.price && idx.price.length>1) exit = num(g('price',1));
    var dirText = String(r[idx.dir[0]]||'').toLowerCase();
    var closed = exit!=null || (idx.closeTime && g('closeTime')) || num(g('profit'))!=null;
    out.push({
      pair: normPair(g('pair')), direction: dir, lot: num(g('lot')), entry: entry, exit: exit,
      sl: (function(v){ return v===0 ? null : v; })(num(g('sl'))), tp: (function(v){ return v===0 ? null : v; })(num(g('tp'))),
      profit: num(g('profit')), ticket: g('ticket')!=null ? String(g('ticket')).trim() : null,
      openTime: g('openTime'), closeTime: g('closeTime'),
      status: /limit|stop/.test(dirText) ? 'pending' : (closed ? 'closed' : 'open'),
      orderType: /limit/.test(dirText) ? 'limit' : (/stop/.test(dirText) ? 'stop' : 'market'), confidence: 1
    });
  });
  return out;
}
function parseCsv(text){
  var rows = [], row = [], cur = '', q = false, delim = (text.split('\n')[0].split(';').length > text.split('\n')[0].split(',').length) ? ';' : ',';
  for(var i=0;i<text.length;i++){
    var c = text[i];
    if(q){ if(c==='"'){ if(text[i+1]==='"'){ cur+='"'; i++; } else q=false; } else cur+=c; }
    else if(c==='"') q=true;
    else if(c===delim){ row.push(cur); cur=''; }
    else if(c==='\n'){ row.push(cur); rows.push(row); row=[]; cur=''; }
    else if(c!=='\r') cur+=c;
  }
  if(cur.length || row.length){ row.push(cur); rows.push(row); }
  return rows.filter(function(r){ return r.some(function(c){ return String(c).trim(); }); });
}
function parseTableFile(text, name){
  var trades = [];
  if(/<table/i.test(text)){
    var doc = new DOMParser().parseFromString(text, 'text/html');
    doc.querySelectorAll('table').forEach(function(t){
      var rows = Array.prototype.map.call(t.querySelectorAll('tr'), function(tr){
        return Array.prototype.map.call(tr.querySelectorAll('td,th'), function(c){ return c.textContent.trim(); });
      });
      for(var i=0;i<rows.length;i++){
        var low = rows[i].map(function(c){ return c.toLowerCase(); });
        if((low.indexOf('ticket')>=0 || low.indexOf('symbol')>=0 || low.indexOf('item')>=0) && (low.indexOf('type')>=0 || low.indexOf('direction')>=0)){
          trades = trades.concat(mapTable(rows[i], rows.slice(i+1))); break;
        }
      }
    });
    return trades;
  }
  var rowsC = parseCsv(text);
  for(var j=0;j<Math.min(rowsC.length,8);j++){
    var t = mapTable(rowsC[j], rowsC.slice(j+1));
    if(t.length) return t;
  }
  return [];
}
function parseTextTrades(text){
  var chunks = String(text).split(/\n\s*\n|(?=^\s*(?:buy|sell|long|short)\b)/im).filter(function(c){ return c.trim(); });
  var out = [];
  chunks.forEach(function(c){
    var dm = c.match(/\b(buy|sell|long|short)\b/i);
    var ot = c.match(/\b(limit|stop)\b(?!\s*loss)/i);
    var pm = c.match(/\b(XAU\/?USD|XAG\/?USD|GOLD|[A-Z]{3}\/?[A-Z]{3}|US30|US100|US500|NAS100|SPX500|GER40|DAX|BTC\/?USD[T]?|ETH\/?USD[T]?)\b/i);
    var ent = c.match(/(?:@|\bentry\b|\bat\b|\bprice\b)[:\s=]*([0-9][0-9.,]*)/i);
    var sl = c.match(/\b(?:sl|stop(?:\s*loss)?)\b[:\s=@]*([0-9][0-9.,]*)/i);
    var tp = c.match(/\b(?:tp\d?|take\s*profit|target)\b[:\s=@]*([0-9][0-9.,]*)/i);
    var lot = c.match(/([0-9]*\.?[0-9]+)\s*(?:lots?|lot size)\b/i) || c.match(/\b(?:lots?|volume|size)[:\s=]*([0-9]*\.?[0-9]+)/i);
    var pnl = c.match(/\b(?:profit|p&l|pnl|result)[:\s=]*([+\-]?\$?[0-9][0-9.,]*)/i);
    if(!dm || !pm || !ent) return;
    out.push({ pair:normPair(pm[1]), direction:normDir(dm[1]), orderType: ot ? ot[1].toLowerCase() : 'market',
      entry:num(ent[1]), sl: sl ? num(sl[1]) : null, tp: tp ? num(tp[1]) : null, lot: lot ? num(lot[1]) : null,
      profit: pnl ? num(pnl[1]) : null, status: pnl ? 'closed' : (ot ? 'pending' : 'open'), confidence: 0.9 });
  });
  return out;
}

/* ---------- row building, enrichment, dedupe ---------- */
function toRow(t, i){
  var status = t.status==='closed' ? 'executed' : (t.status==='pending' ? 'pending' : (t.status==='open' ? 'live' : 'executed'));
  var conf = typeof t.confidence==='number' ? t.confidence : 0.8;
  return { n:i, status:status, pair:normPair(t.pair), dir:normDir(t.direction)||'buy', lot:num(t.lot), entry:num(t.entry), exit:num(t.exit),
    sl:num(t.sl), tp:num(t.tp), profit:num(t.profit), ticket:t.ticket ? String(t.ticket) : null,
    orderType:t.orderType || 'market', openTime:t.openTime||null, closeTime:t.closeTime||null,
    imageIndex: typeof t.imageIndex==='number' ? t.imageIndex : 0, conf:conf, src:{}, skip:false, note:'', matchedOrderId:null };
}
function priceNear(a,b){ if(a==null||b==null) return false; return Math.abs(a-b) <= Math.max(Math.abs(b)*0.0005, 1e-5); }
function enrich(rows){
  var orders = (state.psychology.orders||[]);
  var trades = (state.trades||[]);
  var seen = {};
  rows.forEach(function(r){
    // 1) duplicates inside this batch (overlapping screenshots)
    var key = r.ticket ? 't'+r.ticket : [r.pair,r.dir,fmt(r.entry),r.openTime||''].join('|');
    if(seen[key]){ r.skip = true; r.note = 'Duplicate of another row'; return; }
    seen[key] = true;
    // 2) already logged?
    var dup = trades.find(function(t){ return (r.ticket && t.ticket && String(t.ticket)===r.ticket) ||
      (!r.ticket && t.pair && normPair(t.pair)===r.pair && priceNear(num(t.entry), r.entry) && t.date===(imp.date)); });
    if(dup){ r.skip = true; r.note = 'Already in your journal'; return; }
    // 3) match an existing order of yours: pull its SL/TP and details
    var m = orders.find(function(o){ return normPair(o.pair)===r.pair && (o.direction||'buy')===r.dir && priceNear(o.entry, r.entry); });
    if(m){
      r.matchedOrderId = m.id;
      if(r.sl==null && m.sl!=null){ r.sl = m.sl; r.src.sl = 'from your order'; }
      if(r.tp==null && m.tp!=null){ r.tp = m.tp; r.src.tp = 'from your order'; }
      if(r.lot==null && m.lot!=null) r.lot = m.lot;
      r.strategy = m.strategy||null; r.strategyType = m.strategyType||null; r.logics = m.logics||[]; r.trader = m.trader; r.matchedAccount = m.account || 'personal'; r.orderNotes = m.notes||'';
      if(r.status!=='executed' && m.status===r.status){ r.skip = true; r.note = 'Already in your orders'; }
    }
    if(r.sl!=null && !r.src.sl) r.src.sl = 'read from image';
    if(r.tp!=null && !r.src.tp) r.src.tp = 'read from image';
  });
  return rows;
}

function dateFromRows(list){
  var count = {}, best = null;
  list.forEach(function(t){
    var m = String(t.closeTime || t.openTime || '').match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
    if(!m) return;
    var d = m[1]+'-'+String(m[2]).padStart(2,'0')+'-'+String(m[3]).padStart(2,'0');
    if(!validDate(d)) return;
    count[d] = (count[d]||0)+1; if(!best || count[d]>count[best]) best = d;
  });
  return best;
}
window.gdRunExtract = async function(){
  if(imp.busy) return;
  var msg = $('gdImpMsg'); msg.textContent = '';
  if(!imp.account){ msg.textContent = 'Choose which account these trades belong to first.'; var as = $('gdImpAccount'); if(as) as.focus(); return; }
  var found = [], date = null;
  try{
    imp.busy = true; $('gdReadBtn').disabled = true; $('gdReadBtn').textContent = 'Reading\u2026';
    imp.keepShots = $('gdKeepShots').checked;
    if(imp.tab==='photos'){
      if(!imageLimit()){ msg.textContent = 'Screenshot import is available on Pro and above.'; return; }
      if(!imp.images.length){ msg.textContent = 'Add at least one screenshot.'; return; }
      if(!(await claimImport())){ msg.textContent = 'Daily import limit reached (resets 00:00 UTC). Paste text or upload a CSV instead, or upgrade.'; return; }
      var obj = await aiExtract('Extract all trades from these ' + imp.images.length + ' screenshot(s).', imp.images);
      found = obj.trades; date = obj.date;
    } else if(imp.tab==='text'){
      var txt = $('gdPasteText').value.trim();
      if(!txt){ msg.textContent = 'Paste some text first.'; return; }
      found = parseTextTrades(txt);
      if(!found.length){
        if(!imageLimit()){ msg.textContent = 'Could not read that text locally. AI reading is available on Pro and above, or upload a CSV / MT report.'; return; }
        if(!(await claimImport())){ msg.textContent = 'Could not parse it locally and the daily AI limit is used up.'; return; }
        var o2 = await aiExtract('Extract all trades from this text:\n\n' + txt, []); found = o2.trades; date = o2.date;
      }
    } else {
      if(!imp.fileText){ msg.textContent = 'Choose a file first.'; return; }
      found = parseTableFile(imp.fileText, imp.fileName);
      if(!found.length){ msg.textContent = 'Could not find a trades table in that file. Try the screenshot or paste options.'; return; }
    }
    if(!found.length){ msg.textContent = 'No trades found. Try a clearer screenshot that shows the full history rows.'; return; }
    imp.date = validDate(date) ? date : (dateFromRows(found) || todayStr());
    imp.rows = enrich(found.slice(0,40).map(toRow));
    showReview();
  }catch(e){
    msg.textContent = (e && e.message) || 'Something went wrong. You can still log trades manually.';
  }finally{
    imp.busy = false; var b = $('gdReadBtn'); if(b){ b.disabled=false; b.textContent='Read trades'; }
  }
};

/* ---------- review sheet ---------- */
function rowCheck(r){
  if(r.skip) return { ok:true, skipped:true };
  if(!r.pair) return { ok:false, msg:'Add the pair' };
  if(r.entry==null) return { ok:false, msg:'Add the entry price' };
  var se = sideError(r.dir, r.entry, r.sl, r.tp, r.status!=='executed'); if(se) return { ok:false, msg:se, badSide:true };
  if(r.status==='executed' && r.profit==null && r.exit==null) return { ok:false, msg:'Add profit or exit price' };
  // SL / TP are no longer blockers: the trader can skip them, but it costs discipline points.
  var miss = gdMissingLevelViolations(r.sl, r.tp);
  return { ok:true, rr:plannedRR(r.entry, r.sl, r.tp), miss:miss.codes };
}
function penaltyText(codes){
  if(!codes || !codes.length) return '';
  var pts = codes.reduce(function(s,c){ return s + ruleWeightFor(c); }, 0);
  return 'No ' + codes.map(function(c){ return c==='noSL' ? 'SL' : 'TP'; }).join(' + ') + ': \u2212' + pts + ' discipline points';
}
function rowHtml(r, i){
  var low = function(k){ return r.conf < 0.6 ? ' gd-low' : ''; };
  var v = function(x){ return x==null ? '' : escapeHtml(String(x)); };
  return '<div class="gd-row" id="gdRow'+i+'" data-status="'+r.status+'">' +
    '<div class="gd-row-head"><b>'+escapeHtml((r.dir||'').toUpperCase())+' '+escapeHtml(r.pair||'?')+(r.note ? ' <span class="gd-src">\u00b7 '+escapeHtml(r.note)+'</span>' : '')+'</b>' +
    '<label style="display:flex;gap:6px;align-items:center;font-size:12px"><input type="checkbox" '+(r.skip?'checked':'')+' onchange="gdRowSkip('+i+',this.checked)"> Skip</label></div>' +
    '<div class="gd-grid">' +
      '<div><label>Status</label><select onchange="gdRowSet('+i+',\'status\',this.value)"><option value="executed"'+(r.status==='executed'?' selected':'')+'>Executed</option><option value="live"'+(r.status==='live'?' selected':'')+'>Live</option><option value="pending"'+(r.status==='pending'?' selected':'')+'>Pending</option></select></div>' +
      '<div><label>Pair</label><input class="'+low()+'" value="'+v(r.pair)+'" oninput="gdRowSet('+i+',\'pair\',this.value)"></div>' +
      '<div><label>Side</label><select onchange="gdRowSet('+i+',\'dir\',this.value)"><option value="buy"'+(r.dir==='buy'?' selected':'')+'>Buy</option><option value="sell"'+(r.dir==='sell'?' selected':'')+'>Sell</option></select></div>' +
      '<div><label>Lot</label><input type="number" step="any" class="'+low()+'" value="'+v(r.lot)+'" oninput="gdRowSet('+i+',\'lot\',this.value)"></div>' +
      '<div><label>Entry</label><input type="number" step="any" class="'+low()+'" value="'+v(r.entry)+'" oninput="gdRowSet('+i+',\'entry\',this.value)"></div>' +
      '<div class="gd-exec"><label>Exit</label><input type="number" step="any" value="'+v(r.exit)+'" oninput="gdRowSet('+i+',\'exit\',this.value)"></div>' +
      '<div class="gd-exec"><label>Profit</label><input type="number" step="any" class="'+low()+'" value="'+v(r.profit)+'" oninput="gdRowSet('+i+',\'profit\',this.value)"></div>' +
    '</div>' +
    '<div class="gd-sltp">' +
      '<div><label>Stop loss</label><input type="number" step="any" id="gdSL'+i+'" value="'+v(r.sl)+'" placeholder="Add SL" oninput="gdRowSet('+i+',\'sl\',this.value)"><div class="gd-src" id="gdSLs'+i+'">'+escapeHtml(r.src.sl||'')+'</div></div>' +
      '<div><label>Take profit</label><input type="number" step="any" id="gdTP'+i+'" value="'+v(r.tp)+'" placeholder="Add TP" oninput="gdRowSet('+i+',\'tp\',this.value)"><div class="gd-src" id="gdTPs'+i+'">'+escapeHtml(r.src.tp||'')+'</div></div>' +
    '</div>' +
    '<div class="gd-meta" id="gdMeta'+i+'"></div></div>';
}
function showReview(){
  $('gdImpInput').style.display='none';
  var el = $('gdImpReview'); el.style.display='';
  var n = imp.rows.length;
  el.innerHTML =
    '<div class="gd-note" style="margin-top:10px">Found <b>'+n+'</b> trade'+(n===1?'':'s')+'. Everything else is filled in. Add <b>SL and TP</b> where highlighted. You can skip them, but that lowers your discipline score. Amber fields were hard to read, so double-check them.</div>' +
    '<div class="field" style="max-width:320px"><label>Importing into</label><select id="gdRevAccount" onchange="gdSetAccount(this.value)"></select></div>' +
    '<div class="field" style="max-width:220px"><label>Trading day</label><input type="date" id="gdImpDate" max="'+todayStr()+'" value="'+imp.date+'" onchange="gdSetDate(this.value)"></div>' +
    '<div id="gdRows">'+imp.rows.map(rowHtml).join('')+'</div>' +
    '<div class="btn-row" style="margin-top:12px"><button class="btn btn-ghost" style="flex:1" onclick="gdBackToInput()">Back</button>' +
    '<button class="btn btn-primary" style="flex:2" id="gdCommitBtn" onclick="gdCommit()" disabled>Add trades</button></div>' +
    '<div class="gd-note" id="gdCommitHint"></div>';
  fillAccountSelects();
  imp.rows.forEach(function(r,i){ refreshRow(i); }); refreshCommit();
}
window.gdBackToInput = function(){ $('gdImpReview').style.display='none'; $('gdImpInput').style.display=''; };
window.gdSetDate = function(d){ if(validDate(d)) imp.date = d; };
window.gdRowSkip = function(i, on){ imp.rows[i].skip = !!on; var e=$('gdRow'+i); if(e) e.classList.toggle('skip', !!on); refreshRow(i); refreshCommit(); };
window.gdRowSet = function(i, k, val){
  var r = imp.rows[i]; if(!r) return;
  if(k==='status' || k==='dir') r[k] = val;
  else if(k==='pair') r.pair = normPair(val);
  else r[k] = num(val);
  if(k==='sl'){ r.src.sl = r.sl!=null ? 'entered by you' : ''; var s=$('gdSLs'+i); if(s) s.textContent = r.src.sl; }
  if(k==='tp'){ r.src.tp = r.tp!=null ? 'entered by you' : ''; var t=$('gdTPs'+i); if(t) t.textContent = r.src.tp; }
  if(k==='status'){ var row=$('gdRow'+i); if(row) row.setAttribute('data-status', val); }
  refreshRow(i); refreshCommit();
};
function refreshRow(i){
  var r = imp.rows[i], c = rowCheck(r);
  var row = $('gdRow'+i); if(!row) return;
  var warn = !!(c.ok && !c.skipped && c.miss && c.miss.length);
  row.classList.toggle('ok', !!c.ok && !c.skipped && !warn);
  row.classList.toggle('warn', warn);
  var sl = $('gdSL'+i), tp = $('gdTP'+i);
  if(sl && tp){
    sl.className = c.badSide ? 'gd-bad' : (r.sl==null ? 'gd-need' : '');
    tp.className = c.badSide ? 'gd-bad' : (r.tp==null ? 'gd-need' : '');
  }
  var meta = $('gdMeta'+i); if(!meta) return;
  if(c.skipped) meta.textContent = r.note || 'Skipped';
  else if(!c.ok) meta.innerHTML = '<span class="err">'+escapeHtml(c.msg)+'</span>';
  else meta.innerHTML = (c.rr!=null ? 'Planned R:R ' + c.rr.toFixed(2) : 'R:R needs SL and TP') + (r.matchedOrderId ? ' \u00b7 will close your matching order' + ((r.matchedAccount && imp.account && r.matchedAccount!==imp.account) ? ' (it was on ' + escapeHtml(acctLabel(r.matchedAccount)) + ', trade logs to ' + escapeHtml(acctLabel(imp.account)) + ')' : '') : '') + (warn ? ' <span class="warn">\u00b7 ' + escapeHtml(penaltyText(c.miss)) + '</span>' : '');
}
function projectedPenalty(active){
  var extra = [];
  active.forEach(function(r){ if(r.sl==null) extra.push('noSL'); if(r.tp==null) extra.push('noTP'); });
  if(!extra.length) return 0;
  return disciplineBreakdown(imp.date, extra).total - disciplineBreakdown(imp.date).total;
}
function refreshCommit(){
  var active = imp.rows.filter(function(r){ return !r.skip; });
  var bad = active.filter(function(r){ return !rowCheck(r).ok; }).length;
  var btn = $('gdCommitBtn'), hint = $('gdCommitHint'); if(!btn) return;
  btn.disabled = !active.length || bad>0 || !imp.account;
  btn.textContent = active.length ? 'Add '+active.length+' trade'+(active.length===1?'':'s') : 'Nothing to add';
  if(!hint) return;
  var pen = bad ? 0 : projectedPenalty(active);
  if(!imp.account) hint.textContent = 'Choose the account to import into.';
  else if(bad) hint.textContent = bad+' trade'+(bad===1?'':'s')+' still need a fix.';
  else if(pen>0) hint.textContent = 'Missing SL / TP will lower the discipline score for ' + imp.date + ' by ' + pen + ' points' + (imp.date===todayStr() ? ' and reset your streak' : '') + '. Add them to avoid it.';
  else hint.textContent = '';
}

/* ---------- commit ---------- */
function violations(t, isToday){
  var rules = state.rules||{}, v = [], rr = parseFloat(t.rr);
  var add = function(code,label){ v.push({code:code,label:label}); };
  if(rules.minRR!=null && !isNaN(rr) && rr < rules.minRR) add('minRR','Below minimum R:R ('+rr+' < '+rules.minRR+')');
  if(t.result==='loss' && rules.maxRiskPerTrade!=null && t.lossAmount > rules.maxRiskPerTrade) add('maxRiskPerTrade','Risk exceeded max per trade');
  if(isToday){
    if(rules.maxTrades!=null && state.day.tradesCount > rules.maxTrades) add('maxTrades','Over daily trade limit ('+state.day.tradesCount+'/'+rules.maxTrades+')');
    if(rules.maxDailyLoss!=null && state.day.lossUsed > rules.maxDailyLoss) add('maxDailyLoss','Over daily loss limit');
    if(rules.maxConsecLosses!=null && state.consecutiveLosses>0 && state.consecutiveLosses >= rules.maxConsecLosses) add('maxConsecLosses','Consecutive losses at limit ('+state.consecutiveLosses+'/'+rules.maxConsecLosses+')');
  }
  var miss = gdMissingLevelViolations(t.sl, t.tp);
  miss.codes.forEach(function(c,i){ add(c, miss.labels[i]); });
  return v;
}
async function uploadShots(){
  if(!imp.keepShots || imp.tab!=='photos' || !imp.images.length || typeof TRADE_SCREENSHOT_BUCKET==='undefined') return {};
  var paths = {};
  for(var i=0;i<imp.images.length;i++){
    try{
      var blob = await (await fetch(imp.images[i].previewUrl)).blob();
      var path = currentUser.id + '/import-' + Date.now() + '-' + i + '.jpg';
      var up = await sb.storage.from(TRADE_SCREENSHOT_BUCKET).upload(path, blob, { contentType:'image/jpeg', upsert:false });
      if(!up.error) paths[i] = path;
    }catch(e){ /* screenshot is optional */ }
  }
  return paths;
}
window.gdCommit = async function(){
  var btn = $('gdCommitBtn'); if(btn){ btn.disabled = true; btn.textContent = 'Saving\u2026'; }
  try{
    rolloverDayIfNeeded();
    if(!imp.account) throw new Error('Choose which account to import into');
    var shots = await uploadShots();
    var tSel = $('t_trader');
    var defTrader = (tSel && tSel.value) || 'me', defAcct = imp.account;
    if(!defAcct) throw new Error('Choose which account to import into');
    if(defAcct!=='personal' && !(typeof getPropFirm==='function' && getPropFirm(defAcct))) throw new Error('That account is no longer available');
    var acctPf = defAcct==='personal' ? null : getPropFirm(defAcct);
    var rows = imp.rows.filter(function(r){ return !r.skip; }).sort(function(a,b){
      return String(a.closeTime||a.openTime||'').localeCompare(String(b.closeTime||b.openTime||'')) || a.n-b.n; });
    var isToday = imp.date === todayStr(), nExec=0, nLive=0, nPend=0, broke=false, newTrades=[];
    rows.forEach(function(r, k){
      var now = new Date();
      var time = now.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
      if(r.matchedOrderId) state.psychology.orders = state.psychology.orders.filter(function(o){ return o.id!==r.matchedOrderId; });
      var rr = plannedRR(r.entry, r.sl, r.tp);
      if(r.status==='executed'){
        var pnl = r.profit;
        if(pnl==null && r.exit!=null) pnl = (r.dir==='buy' ? r.exit-r.entry : r.entry-r.exit);
        var result = pnl < 0 ? 'loss' : 'win', amt = Math.abs(pnl||0);
        var achieved = (result==='win' && r.exit!=null && r.entry!==r.sl) ? Math.abs(r.exit-r.entry)/Math.abs(r.entry-r.sl) : rr;
        var t = { id: Date.now()+k, date: imp.date, time: time, result: result, rr: achieved!=null ? +achieved.toFixed(2) : null,
          notes: (r.orderNotes ? r.orderNotes+' \u00b7 ' : '') + 'Imported',
          lossAmount: result==='loss' ? amt : 0, winAmount: result==='win' ? amt : 0,
          trader: r.trader || defTrader, strategy: r.strategy||null, strategyType: r.strategyType||null, logics: r.logics||[], mood:null,
          screenshotPath: shots[r.imageIndex]!=null ? shots[r.imageIndex] : (shots[0]||null), screenshotUrl:null, tvLink:null, openChartOnCalendar:false,
          pair:r.pair, direction:r.dir, entry:r.entry, exit:r.exit, sl:r.sl, tp:r.tp, lot:r.lot, ticket:r.ticket, style:null,
          account: defAcct, imported:true };
        if(isToday){
          state.day.tradesCount += 1;
          if(result==='loss'){
            // Same currency handling as Log Trade: the daily-loss gate is priced in the personal currency.
            var lossForGate = amt, personalCcy = state.rules.currency || 'USD';
            var lossCcy = acctPf ? (acctPf.currency || personalCcy) : personalCcy;
            if(lossCcy !== personalCcy && typeof getCachedFxRate==='function'){
              var fx = getCachedFxRate(lossCcy, personalCcy);
              if(fx!=null) lossForGate = amt*fx; else if(typeof ensureFxRatesLoaded==='function') ensureFxRatesLoaded();
            }
            state.day.lossUsed = +(state.day.lossUsed + lossForGate).toFixed(2); state.consecutiveLosses += 1; state.psychology.lastLossAt = Date.now();
          } else state.consecutiveLosses = 0;
        }
        var v = violations(t, isToday);
        t.ruleViolations = v.map(function(x){ return x.code; }); t.ruleViolationLabels = v.map(function(x){ return x.label; });
        if(v.length && isToday){ broke = true; state.day.ruleBrokenToday = true; state.streak.count = 0; }
        state.trades.push(t); newTrades.push(t); nExec++;
      } else {
        var om = gdMissingLevelViolations(r.sl, r.tp);
        if(om.codes.length && isToday){ broke = true; state.day.ruleBrokenToday = true; state.streak.count = 0; }
        var money = null;
        if(acctPf && r.lot!=null && r.entry!=null && r.sl!=null && r.tp!=null && typeof computeOrderMoney==='function'){
          try{ money = computeOrderMoney(r.entry, r.sl, r.tp, r.pair, r.lot, state.rules.accountType||'standard', acctPf.currency||state.rules.currency||'USD'); }catch(e){}
        }
        state.psychology.orders.push({ id:'ord_'+(Date.now()+k), date: imp.date,
          riskAmt: money && money.risk!=null ? +Number(money.risk).toFixed(2) : null,
          rewardAmt: money && money.reward!=null ? +Number(money.reward).toFixed(2) : null, time: time, trader: r.trader||defTrader,
          strategy:r.strategy||null, strategyType:r.strategyType||null, style:'intraday', logics:r.logics||[],
          pair:r.pair, direction:r.dir, entry:r.entry, sl:r.sl, tp:r.tp, lot:r.lot, rrPlanned: rr!=null ? rr.toFixed(2) : null,
          notes: r.orderNotes||'Imported', status:r.status, orderType:r.orderType||'market', ticket:r.ticket,
          account: defAcct, imported:true, ruleViolations: om.codes, ruleViolationLabels: om.labels });
        if(r.status==='live') nLive++; else nPend++;
      }
    });
    if(isToday && typeof archiveDisciplineDay==='function') archiveDisciplineDay(state.day.date, computeDisciplineScore());
    if(typeof gdRescoreDate==='function') gdRescoreDate(imp.date);
    if(newTrades.length && typeof refreshTradeScreenshotUrls==='function') { try{ await refreshTradeScreenshotUrls(newTrades); }catch(e){} }
    await saveState(); renderAll();
    gdCloseImport();
    if(!broke && newTrades.some(function(t){ return t.result==='win'; }) && typeof fireConfetti==='function'){ try{ fireConfetti(); }catch(e){} }
    var parts = []; if(nExec) parts.push(nExec+' executed'); if(nLive) parts.push(nLive+' live'); if(nPend) parts.push(nPend+' pending');
    showToast('Imported ' + parts.join(', ') + ' to ' + acctLabel(defAcct) + (broke ? '. Rule break flagged, streak reset.' : '.') + (isToday ? ' Discipline score ' + computeDisciplineScore() + '.' : ''));
  }catch(e){
    showToast('Import failed: ' + ((e && e.message) || 'try again'));
    if(btn){ btn.disabled = false; btn.textContent = 'Add trades'; }
  }
};

window.gdImportState = function(){ return imp; };

/* =====================================================================
   PART 3: SL / TP penalty hints + dashboard order-screenshot card
   ===================================================================== */
function penaltyHintFor(entryId, slId, tpId, outId){
  var out = $(outId); if(!out) return;
  var entry = $(entryId);
  if(!entry || entry.value===''){ out.textContent = ''; return; }   // stay quiet until an order is being filled in
  var m = gdMissingLevelViolations(($(slId)||{}).value, ($(tpId)||{}).value);
  out.textContent = m.codes.length ? penaltyText(m.codes) + '. Add them to protect your score.' : '';
}
function wirePenaltyHints(){
  var oPrev = $('orderRRPreview');
  if(oPrev && !$('o_penalty')) oPrev.insertAdjacentHTML('beforebegin', '<div class="gd-penalty" id="o_penalty"></div>');
  [['gd_entry','gd_sl','gd_tp','gd_penalty'],['o_entry','o_sl','o_tp','o_penalty']].forEach(function(a){
    [a[0],a[1],a[2]].forEach(function(id){
      var e = $(id);
      if(e && !e.__gdPen){ e.__gdPen = true; e.addEventListener('input', function(){ penaltyHintFor(a[0],a[1],a[2],a[3]); }); }
    });
    penaltyHintFor(a[0],a[1],a[2],a[3]);
  });
}

function renderDashCard(){
  /* The Order Screenshots page (gd-order-scans.js) owns this slot now: a slim strip that opens the page. */
  if(typeof window.gdRenderOrderStrip==='function'){ window.gdRenderOrderStrip(); return; }
  var card = $('gdDashOrders'); if(!card) return;
  if(isDemoMode){ card.style.display = 'none'; return; }
  var lim = imageLimit();
  var sig = String(userTier) + '|' + lim;
  if(card.getAttribute('data-sig')===sig && card.innerHTML){ card.style.display = ''; return; }
  card.setAttribute('data-sig', sig);
  var head = '<h2>Order <span class="accent">Screenshots</span><span class="eyebrow">read orders from your broker</span></h2>';
  if(!lim){
    card.innerHTML = head +
      '<div class="gd-lock"><b>Upload a screenshot instead of typing</b>We read the pair, side, entry, lots and result from your broker screenshot. Pro: 2 screenshots per upload. Elite and above: 10. Each one can hold lots of trades.' +
      '<div class="btn-row" style="margin-top:12px"><button class="btn btn-primary btn-sm" style="flex:1" onclick="gdUpgrade()">Unlock with Pro</button></div></div>';
  } else {
    card.innerHTML = head +
      '<div class="gd-drop gd-dash-drop" id="gdDashDrop" role="button" tabindex="0">Drop order screenshots here or tap to choose<br><small>Up to ' + lim + ' per upload on ' + tierName() + '. Each screenshot can hold many orders.</small></div>' +
      '<input type="file" id="gdDashInput" accept="image/*" multiple style="display:none">' +
      '<div class="gd-dash-meta"><span class="gd-pill">' + tierName() + ' \u00b7 ' + lim + ' screenshots per upload</span><span class="gd-pill hot">Skipping SL or TP lowers your discipline score</span></div>' +
      '<div class="gd-note">Orders land as Pending, Live or Executed. You review everything before it is saved, and the discipline score updates when you add them.</div>';
    var drop = $('gdDashDrop'), inp = $('gdDashInput');
    drop.addEventListener('click', function(){ inp.click(); });
    drop.addEventListener('keydown', function(e){ if(e.key==='Enter' || e.key===' '){ e.preventDefault(); inp.click(); } });
    ['dragover','dragenter'].forEach(function(ev){ drop.addEventListener(ev, function(e){ e.preventDefault(); drop.classList.add('over'); }); });
    ['dragleave','drop'].forEach(function(ev){ drop.addEventListener(ev, function(e){ e.preventDefault(); drop.classList.remove('over'); }); });
    drop.addEventListener('drop', function(e){ var fs = Array.prototype.slice.call(e.dataTransfer.files||[]); if(fs.length) window.gdOpenImport(fs); });
    inp.addEventListener('change', function(e){ var fs = Array.prototype.slice.call(e.target.files||[]); e.target.value=''; if(fs.length) window.gdOpenImport(fs); });
  }
  card.style.display = '';
}

/* ---------- boot ---------- */
function boot(){
  injectCss(); injectModalFields(); wireModal(); wirePenaltyHints();
  if(typeof renderAll==='function' && !renderAll.__gd){
    var origRender = renderAll;
    var wr = function(){ var out = origRender.apply(this, arguments); try{ renderDashCard(); wirePenaltyHints(); }catch(e){} return out; };
    wr.__gd = true; renderAll = wr;
  }
  renderDashCard();
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
