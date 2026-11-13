/* Ghost Discipline: Order Import page.
 *
 * A dedicated page (#view-orderscans) for reading orders from broker screenshots.
 * It replaces the cramped dashboard card: drop zone, how the import works, plan
 * allowance, and the latest imported orders, all in one place.
 *
 * It does not duplicate the importer. Files are handed to window.gdOpenImport()
 * from gd-trade-import.js, which owns reading, review and saving.
 *
 * Loaded by app.html after gd-trade-import.js. Relies on app globals:
 * state, userTier, isDemoMode, tierAtLeast, showToast, escapeHtml, todayStr.
 * All class names use the os- prefix so nothing clashes with the rest of the app.
 */
(function(){
'use strict';

var VIEW_ID = 'view-orderscans';
var built = false;
var dragDepth = 0;

/* ---------- helpers ---------- */
function $(id){ return document.getElementById(id); }
function esc(s){ return typeof escapeHtml==='function' ? escapeHtml(String(s==null?'':s)) : String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
function limit(){
  if(typeof isDemoMode!=='undefined' && isDemoMode) return 0;
  if(typeof tierAtLeast==='function' && tierAtLeast('elite')) return 10;
  if(typeof tierAtLeast==='function' && tierAtLeast('pro')) return 2;
  return 0;
}
function tierLabel(){
  var t = typeof userTier!=='undefined' ? userTier : 'free';
  return t==='premium' ? 'Premium' : t==='elite' ? 'Elite' : t==='pro' ? 'Pro' : 'Free';
}
function viewActive(){ var v = $(VIEW_ID); return !!(v && v.classList.contains('active')); }
function fmtPrice(n){ return (n==null || n==='' || isNaN(+n)) ? '\u2013' : String(+(+n).toFixed(5)); }
function fmtDate(d){
  if(!d) return '';
  var p = String(d).split('-'); if(p.length!==3) return esc(d);
  var dt = new Date(+p[0], +p[1]-1, +p[2]);
  return dt.toLocaleDateString(undefined, { day:'numeric', month:'short' });
}
function imageFiles(list){
  return Array.prototype.slice.call(list||[]).filter(function(f){ return f && /^image\//.test(f.type||''); });
}

/* ---------- styles ---------- */
var CSS = [
'#view-orderscans .os-wrap{display:flex;flex-direction:column;gap:22px;max-width:1180px}',
'#view-orderscans .os-top{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(0,1fr);gap:22px;align-items:stretch}',

/* scanner */
'.os-scan{position:relative;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;gap:16px;min-height:380px;padding:44px 32px;border-radius:26px;cursor:pointer;outline:none;overflow:hidden;isolation:isolate;',
 'border:1px solid var(--steel-hi);',
 'background:radial-gradient(120% 90% at 50% 0%,color-mix(in srgb,var(--bronze-bright,#10b981) 11%,transparent),transparent 62%),',
 'linear-gradient(color-mix(in srgb,var(--platinum,#fff) 4.5%,transparent) 1px,transparent 1px) 0 0/100% 28px,',
 'linear-gradient(90deg,color-mix(in srgb,var(--platinum,#fff) 4.5%,transparent) 1px,transparent 1px) 0 0/28px 100%,',
 'color-mix(in srgb,var(--panel-solid,#10151c) 88%,transparent);',
 'transition:border-color .3s ease,box-shadow .3s ease}',
'.os-scan:hover{border-color:color-mix(in srgb,var(--bronze-bright,#10b981) 55%,var(--steel-hi))}',
'.os-scan:focus-visible{box-shadow:0 0 0 2px var(--panel-solid,#000),0 0 0 4px var(--bronze-bright,#10b981)}',
'.os-scan.over{border-color:var(--bronze-bright,#10b981);box-shadow:0 0 0 1px var(--bronze-bright,#10b981),0 28px 60px -30px color-mix(in srgb,var(--bronze-bright,#10b981) 60%,transparent)}',
'.os-scan .os-c{position:absolute;width:26px;height:26px;border:2px solid var(--bronze-bright,#10b981);opacity:.55;transition:transform .35s cubic-bezier(.16,1,.3,1),opacity .3s ease;z-index:1;pointer-events:none}',
'.os-c.tl{top:18px;left:18px;border-right:0;border-bottom:0;border-top-left-radius:9px}',
'.os-c.tr{top:18px;right:18px;border-left:0;border-bottom:0;border-top-right-radius:9px}',
'.os-c.bl{bottom:18px;left:18px;border-right:0;border-top:0;border-bottom-left-radius:9px}',
'.os-c.br{bottom:18px;right:18px;border-left:0;border-top:0;border-bottom-right-radius:9px}',
'.os-scan.over .os-c{opacity:1}',
'.os-scan.over .os-c.tl{transform:translate(10px,10px)}.os-scan.over .os-c.tr{transform:translate(-10px,10px)}',
'.os-scan.over .os-c.bl{transform:translate(10px,-10px)}.os-scan.over .os-c.br{transform:translate(-10px,-10px)}',
'.os-beam{position:absolute;left:0;right:0;top:0;height:90px;z-index:0;pointer-events:none;opacity:0;',
 'background:linear-gradient(180deg,transparent,color-mix(in srgb,var(--bronze-bright,#10b981) 26%,transparent) 88%,var(--bronze-bright,#10b981) 100%);border-bottom:1px solid var(--bronze-bright,#10b981)}',
'.os-scan.over .os-beam{opacity:1;animation:osBeam 1.9s cubic-bezier(.45,.05,.35,1) infinite}',
'@keyframes osBeam{0%{transform:translateY(-90px)}100%{transform:translateY(470px)}}',
'.os-doc{position:relative;z-index:2;width:74px;height:90px;border-radius:12px;border:1.5px solid var(--steel-hi);background:color-mix(in srgb,var(--panel-solid,#10151c) 92%,transparent);display:grid;align-content:center;gap:7px;padding:0 13px;transition:transform .35s cubic-bezier(.16,1,.3,1)}',
'.os-doc i{display:block;height:5px;border-radius:3px;background:color-mix(in srgb,var(--slate,#8a9491) 55%,transparent)}',
'.os-doc i:nth-child(1){width:60%;background:var(--bronze-bright,#10b981)}.os-doc i:nth-child(3){width:78%}.os-doc i:nth-child(4){width:46%}',
'.os-scan:hover .os-doc,.os-scan.over .os-doc{transform:translateY(-4px) rotate(-2deg)}',
'.os-scan h3{position:relative;z-index:2;margin:6px 0 0;font-family:var(--j-serif,"Fraunces",serif);font-weight:500;font-size:clamp(26px,2.6vw,34px);letter-spacing:-.02em;line-height:1.12;color:var(--platinum)}',
'.os-scan p{position:relative;z-index:2;margin:0;max-width:44ch;font-size:14px;line-height:1.55;color:var(--slate)}',
'.os-actions{position:relative;z-index:2;display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-top:4px}',
'.os-brokers{position:relative;z-index:2;display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-top:6px}',
'.os-brokers span{font-size:12px;color:var(--slate);border:1px solid var(--steel);border-radius:999px;padding:4px 11px;background:color-mix(in srgb,var(--panel-solid,#10151c) 60%,transparent)}',
'.os-photo{display:none}',
'@media (pointer:coarse){.os-photo{display:inline-flex}}',

/* locked scanner */
'.os-scan.locked{cursor:default;border-style:dashed}',
'.os-scan.locked:hover{border-color:var(--steel-hi)}',
'.os-scan.locked .os-doc{opacity:.7}',

/* sequence */
'.os-steps{position:relative;display:flex;flex-direction:column;gap:0;padding:30px 28px;border:1px solid var(--steel);border-radius:26px;background:color-mix(in srgb,var(--panel-solid,#10151c) 84%,transparent)}',
'.os-steps h3{margin:0 0 20px;font-family:var(--j-serif,"Fraunces",serif);font-weight:500;font-size:21px;letter-spacing:-.01em;color:var(--platinum)}',
'.os-step{position:relative;display:grid;grid-template-columns:34px 1fr;gap:14px;padding-bottom:24px}',
'.os-step:last-child{padding-bottom:0}',
'.os-step:not(:last-child)::before{content:"";position:absolute;left:16.5px;top:36px;bottom:4px;width:1px;background:linear-gradient(var(--steel-hi),var(--steel))}',
'.os-n{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;font-family:var(--j-mono,"IBM Plex Mono",monospace);font-size:13px;color:var(--bronze-bright,#10b981);border:1px solid color-mix(in srgb,var(--bronze-bright,#10b981) 55%,var(--steel));background:color-mix(in srgb,var(--bronze-bright,#10b981) 9%,transparent)}',
'.os-step b{display:block;font-size:15px;font-weight:600;color:var(--platinum);margin:5px 0 4px}',
'.os-step span.t{display:block;font-size:13.5px;line-height:1.55;color:var(--slate)}',
'.os-fields{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}',
'.os-fields em{font-style:normal;font-size:12px;padding:3px 10px;border-radius:999px;border:1px solid var(--steel);color:var(--platinum)}',
'.os-fields em.you{color:var(--gold-bright,#e6c36a);border-color:color-mix(in srgb,var(--gold-bright,#e6c36a) 55%,transparent);background:color-mix(in srgb,var(--gold-bright,#e6c36a) 9%,transparent)}',

/* allowance */
'.os-plan{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:22px 34px;align-items:center;padding:20px 26px;border:1px solid var(--steel);border-radius:20px;background:color-mix(in srgb,var(--panel-solid,#10151c) 78%,transparent)}',
'.os-plan-lead{font-size:14px;color:var(--slate);line-height:1.5}',
'.os-plan-lead strong{color:var(--platinum);font-weight:600}',
'.os-tiers{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-top:12px}',
'.os-tier{padding:10px 12px;border-radius:12px;border:1px solid var(--steel);font-size:12.5px;color:var(--slate);line-height:1.35}',
'.os-tier b{display:block;font-size:13.5px;color:var(--platinum);font-weight:600;margin-bottom:2px}',
'.os-tier.me{border-color:var(--bronze-bright,#10b981);background:color-mix(in srgb,var(--bronze-bright,#10b981) 10%,transparent)}',
'.os-tier.me b::after{content:" \\00b7  you";font-weight:500;color:var(--bronze-bright,#10b981)}',
'.os-warn{max-width:260px;font-size:13px;line-height:1.5;color:var(--gold-bright,#e6c36a);padding-left:18px;border-left:2px solid color-mix(in srgb,var(--gold-bright,#e6c36a) 60%,transparent)}',

/* recent */
'.os-recent{border:1px solid var(--steel);border-radius:22px;background:color-mix(in srgb,var(--panel-solid,#10151c) 84%,transparent);overflow:hidden}',
'.os-recent-head{display:flex;align-items:baseline;justify-content:space-between;gap:14px;flex-wrap:wrap;padding:22px 26px 14px}',
'.os-recent-head h3{margin:0;font-family:var(--j-serif,"Fraunces",serif);font-weight:500;font-size:21px;letter-spacing:-.01em;color:var(--platinum)}',
'.os-recent-head small{font-size:13px;color:var(--slate)}',
'.os-recent-head small b{color:var(--platinum);font-weight:600}',
'.os-table{width:100%;overflow-x:auto}',
'.os-row{display:grid;grid-template-columns:76px minmax(92px,1.1fr) 70px minmax(0,1fr) minmax(0,1fr) 108px;gap:12px;align-items:center;padding:13px 26px;border-top:1px solid var(--steel);font-size:13.5px;color:var(--platinum);min-width:640px}',
'.os-row.hd{padding-top:9px;padding-bottom:9px;font-size:12px;color:var(--slate);border-top:1px solid var(--steel)}',
'.os-row .pair{font-weight:600;letter-spacing:.01em}',
'.os-row .num{font-family:var(--j-mono,"IBM Plex Mono",monospace);font-size:13px}',
'.os-row .dim{color:var(--slate)}',
'.os-row .buy{color:var(--win-bright,#34d399)}.os-row .sell{color:var(--loss-bright,#fb7185)}',
'.os-row .miss{color:var(--gold-bright,#e6c36a)}',
'.os-chip{display:inline-block;justify-self:start;padding:3px 10px;border-radius:999px;font-size:12px;border:1px solid var(--steel-hi);color:var(--slate)}',
'.os-chip.live{color:var(--bronze-bright,#10b981);border-color:color-mix(in srgb,var(--bronze-bright,#10b981) 55%,transparent)}',
'.os-chip.pending{color:var(--gold-bright,#e6c36a);border-color:color-mix(in srgb,var(--gold-bright,#e6c36a) 55%,transparent)}',
'.os-chip.win{color:var(--win-bright,#34d399);border-color:color-mix(in srgb,var(--win-bright,#34d399) 55%,transparent)}',
'.os-chip.loss{color:var(--loss-bright,#fb7185);border-color:color-mix(in srgb,var(--loss-bright,#fb7185) 55%,transparent)}',
'.os-empty{padding:34px 26px 38px;border-top:1px solid var(--steel);text-align:left}',
'.os-empty b{display:block;font-size:15px;color:var(--platinum);margin-bottom:6px;font-weight:600}',
'.os-empty span{display:block;max-width:56ch;font-size:13.5px;line-height:1.55;color:var(--slate)}',

/* responsive */
'@media (max-width:640px){.os-row{min-width:0;grid-template-columns:auto auto 1fr;grid-template-areas:"pair pair status" "side entry date" "sltp sltp sltp";row-gap:6px;column-gap:14px}.os-row.hd{display:none}.os-row .c-pair{grid-area:pair;font-size:15px}.os-row .c-status{grid-area:status;justify-self:end}.os-row .c-side{grid-area:side}.os-row .c-entry{grid-area:entry}.os-row .c-date{grid-area:date;justify-self:end;font-size:12.5px}.os-row .c-sltp{grid-area:sltp;font-size:12.5px}}',
'@media (max-width:980px){#view-orderscans .os-top{grid-template-columns:1fr}.os-scan{min-height:340px}.os-plan{grid-template-columns:1fr}.os-warn{max-width:none}}',
'@media (max-width:560px){.os-scan{padding:36px 18px;min-height:320px;border-radius:22px}.os-steps{padding:24px 20px;border-radius:22px}.os-tiers{grid-template-columns:1fr}.os-plan{padding:18px}.os-recent-head,.os-empty{padding-left:18px;padding-right:18px}.os-row{padding-left:18px;padding-right:18px}}',
'@media (prefers-reduced-motion:reduce){.os-scan.over .os-beam{animation:none;opacity:.5;top:40%}.os-scan,.os-scan .os-c,.os-doc{transition:none}.os-scan:hover .os-doc,.os-scan.over .os-doc{transform:none}}',

/* dashboard entry strip (replaces the old narrow card) */
'#view-dashboard > #gdDashOrders{grid-column:1/-1;order:3;align-self:stretch;min-width:0;box-sizing:border-box;margin:0!important;padding:0!important}',
'#gdDashOrders .os-strip{display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding:16px 22px}',
'#gdDashOrders .os-strip-ic{flex:none;width:40px;height:40px;border-radius:12px;display:grid;place-items:center;color:var(--bronze-bright,#10b981);border:1px solid color-mix(in srgb,var(--bronze-bright,#10b981) 45%,var(--steel));background:color-mix(in srgb,var(--bronze-bright,#10b981) 9%,transparent)}',
'#gdDashOrders .os-strip-ic svg{width:20px;height:20px}',
'#gdDashOrders .os-strip-tx{flex:1 1 260px;min-width:0}',
'#gdDashOrders .os-strip-tx b{display:block;font-size:15px;font-weight:600;color:var(--platinum)}',
'#gdDashOrders .os-strip-tx span{display:block;margin-top:2px;font-size:13px;color:var(--slate);line-height:1.45}'
].join('\n');

function injectCss(){
  if($('osCss')) return;
  var st = document.createElement('style'); st.id = 'osCss'; st.textContent = CSS; document.head.appendChild(st);
}

/* ---------- markup ---------- */
var ICON_SCAN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8V6a2 2 0 012-2h2M16 4h2a2 2 0 012 2v2M20 16v2a2 2 0 01-2 2h-2M8 20H6a2 2 0 01-2-2v-2"/><path d="M7 12h10"/></svg>';

function scannerHtml(lim){
  var bits = '<span class="os-c tl"></span><span class="os-c tr"></span><span class="os-c bl"></span><span class="os-c br"></span><span class="os-beam"></span>' +
             '<div class="os-doc" aria-hidden="true"><i></i><i></i><i></i><i></i></div>';
  if(typeof isDemoMode!=='undefined' && isDemoMode){
    return '<div class="os-scan locked">' + bits +
      '<h3>Not available in demo mode</h3>' +
      '<p>Create a free account to import your own orders from broker screenshots.</p></div>';
  }
  if(!lim){
    return '<div class="os-scan locked">' + bits +
      '<h3>Read your orders from a screenshot</h3>' +
      '<p>Screenshot import is on Pro and above. On Free you can still paste text or import a CSV or MT4/MT5 statement.</p>' +
      '<div class="os-actions">' +
        '<button type="button" class="btn btn-primary" id="osUpgrade">Unlock with Pro</button>' +
        '<button type="button" class="btn btn-ghost" id="osText">Paste text or CSV</button>' +
      '</div></div>';
  }
  return '<div class="os-scan" id="osDrop" role="button" tabindex="0" aria-label="Add order screenshots. Drop files here, press Enter to choose, or paste an image.">' + bits +
    '<h3>Drop your broker screenshots here</h3>' +
    '<p>Up to ' + lim + ' per upload. Each screenshot can hold many orders. You can also paste an image with Ctrl+V.</p>' +
    '<div class="os-actions">' +
      '<button type="button" class="btn btn-primary" id="osPick">Choose screenshots</button>' +
      '<button type="button" class="btn btn-ghost os-photo" id="osCam">Take a photo</button>' +
      '<button type="button" class="btn btn-ghost" id="osText">Paste text or CSV</button>' +
    '</div>' +
    '<div class="os-brokers" aria-label="Works with"><span>MT4</span><span>MT5</span><span>cTrader</span><span>TradingView</span><span>Broker apps</span></div>' +
    '<input type="file" id="osFile" accept="image/*" multiple hidden>' +
    '<input type="file" id="osCamFile" accept="image/*" capture="environment" hidden>' +
  '</div>';
}

function stepsHtml(){
  return '<aside class="os-steps" aria-label="How the import works">' +
    '<h3>From screenshot to journal</h3>' +
    '<div class="os-step"><div class="os-n">1</div><div><b>Upload</b><span class="t">Add screenshots of your open orders, pending orders or trade history.</span></div></div>' +
    '<div class="os-step"><div class="os-n">2</div><div><b>Review</b><span class="t">We fill in what the screenshot shows. You check every row and add what it does not.</span>' +
      '<div class="os-fields"><em>Pair</em><em>Side</em><em>Entry</em><em>Lots</em><em>Result</em><em class="you">You add SL</em><em class="you">You add TP</em></div></div></div>' +
    '<div class="os-step"><div class="os-n">3</div><div><b>Save</b><span class="t">Orders land as Pending, Live or Executed, and your discipline score updates.</span></div></div>' +
  '</aside>';
}

function planHtml(lim){
  var me = lim>=10 ? 'elite' : lim>=2 ? 'pro' : 'free';
  function t(id, name, line){ return '<div class="os-tier' + (me===id ? ' me' : '') + '"><b>' + name + '</b>' + line + '</div>'; }
  var lead = lim
    ? '<strong>' + esc(tierLabel()) + ' plan.</strong> You can add ' + lim + ' screenshots in one upload.'
    : '<strong>Free plan.</strong> Screenshot import starts on Pro.';
  return '<section class="os-plan" aria-label="Your screenshot allowance">' +
    '<div><div class="os-plan-lead">' + lead + '</div>' +
    '<div class="os-tiers">' +
      t('free','Free','Paste text or CSV') +
      t('pro','Pro','2 screenshots per upload') +
      t('elite','Elite and above','10 screenshots per upload') +
    '</div></div>' +
    '<div class="os-warn">Orders saved without a stop loss or take profit lower your discipline score.</div>' +
  '</section>';
}

/* ---------- recent imports ---------- */
function importedRows(){
  var rows = [];
  try{
    (state.trades||[]).forEach(function(t){ if(t && t.imported) rows.push({ kind:'trade', id:t.id, date:t.date, pair:t.pair, dir:t.direction, entry:t.entry, sl:t.sl, tp:t.tp, status:t.result==='loss' ? 'loss' : 'win' }); });
    ((state.psychology||{}).orders||[]).forEach(function(o){ if(o && o.imported) rows.push({ kind:'order', id:o.id, date:o.date, pair:o.pair, dir:o.direction, entry:o.entry, sl:o.sl, tp:o.tp, status:o.status==='live' ? 'live' : 'pending' }); });
  }catch(e){}
  function key(r){ var n = parseInt(String(r.id).replace(/\D/g,''),10); return isNaN(n) ? 0 : n; }
  rows.sort(function(a,b){ return String(b.date||'').localeCompare(String(a.date||'')) || key(b)-key(a); });
  return rows;
}
var STATUS_TEXT = { live:'Live', pending:'Pending', win:'Won', loss:'Lost' };

function recentHtml(){
  var rows = importedRows();
  if(!rows.length){
    return '<section class="os-recent" aria-label="Imported orders"><div class="os-recent-head"><h3>Imported orders</h3></div>' +
      '<div class="os-empty"><b>Nothing imported yet</b><span>Once you add your first screenshot, the orders we read appear here with their stop loss and take profit status.</span></div></section>';
  }
  var protectedN = rows.filter(function(r){ return r.sl!=null && r.sl!=='' && r.tp!=null && r.tp!==''; }).length;
  var head = '<div class="os-row hd" role="row" aria-hidden="false"><span>Date</span><span>Pair</span><span>Side</span><span>Entry</span><span>SL / TP</span><span>Status</span></div>';
  var body = rows.slice(0,8).map(function(r){
    var has = r.sl!=null && r.sl!=='' && r.tp!=null && r.tp!=='';
    var d = String(r.dir||'').toLowerCase();
    return '<div class="os-row" role="row">' +
      '<span class="dim c-date">' + fmtDate(r.date) + '</span>' +
      '<span class="pair c-pair">' + esc(r.pair||'\u2013') + '</span>' +
      '<span class="c-side ' + (d==='buy'?'buy':d==='sell'?'sell':'dim') + '">' + (d==='buy'?'Buy':d==='sell'?'Sell':'\u2013') + '</span>' +
      '<span class="num c-entry">' + fmtPrice(r.entry) + '</span>' +
      (has ? '<span class="num dim c-sltp">' + fmtPrice(r.sl) + ' / ' + fmtPrice(r.tp) + '</span>' : '<span class="miss c-sltp">Missing ' + ((r.sl==null||r.sl==='') && (r.tp==null||r.tp==='') ? 'SL and TP' : (r.sl==null||r.sl==='') ? 'SL' : 'TP') + '</span>') +
      '<span class="os-chip c-status ' + r.status + '">' + STATUS_TEXT[r.status] + '</span>' +
    '</div>';
  }).join('');
  return '<section class="os-recent" aria-label="Imported orders">' +
    '<div class="os-recent-head"><h3>Imported orders</h3><small><b>' + protectedN + ' of ' + rows.length + '</b> have both a stop loss and a take profit</small></div>' +
    '<div class="os-table" role="table">' + head + body + '</div></section>';
}

/* ---------- page ---------- */
function ensureView(){
  var v = $(VIEW_ID); if(!v) return null;
  if(!built){
    built = true;
    v.innerHTML = '<div class="topbar-row"><div><h2 class="page-title">Order Import</h2>' +
      '<div class="page-sub">Bring orders in from your broker statement or platform. Every row is reviewed before it posts.</div></div></div>' +
      '<div class="os-wrap" id="osBody"></div>';
  }
  return v;
}

function bind(lim){
  var drop = $('osDrop'), file = $('osFile'), cam = $('osCamFile');
  if(lim && drop && file){
    var open = function(){ file.click(); };
    drop.addEventListener('click', function(e){ if(e.target.closest('button')) return; open(); });
    drop.addEventListener('keydown', function(e){ if(e.target===drop && (e.key==='Enter' || e.key===' ')){ e.preventDefault(); open(); } });
    var pick = $('osPick'); if(pick) pick.addEventListener('click', function(e){ e.stopPropagation(); open(); });
    var camBtn = $('osCam'); if(camBtn && cam) camBtn.addEventListener('click', function(e){ e.stopPropagation(); cam.click(); });
    ['dragenter','dragover'].forEach(function(ev){ drop.addEventListener(ev, function(e){ e.preventDefault(); if(ev==='dragenter') dragDepth++; drop.classList.add('over'); }); });
    drop.addEventListener('dragleave', function(e){ e.preventDefault(); dragDepth = Math.max(0, dragDepth-1); if(!dragDepth) drop.classList.remove('over'); });
    drop.addEventListener('drop', function(e){ e.preventDefault(); dragDepth = 0; drop.classList.remove('over'); handle(e.dataTransfer && e.dataTransfer.files); });
    file.addEventListener('change', function(e){ var fs = e.target.files; handle(fs); e.target.value = ''; });
    if(cam) cam.addEventListener('change', function(e){ var fs = e.target.files; handle(fs); e.target.value = ''; });
  }
  var up = $('osUpgrade'); if(up) up.addEventListener('click', function(){ if(typeof gdUpgrade==='function') gdUpgrade(); });
  var tx = $('osText'); if(tx) tx.addEventListener('click', function(e){ e.stopPropagation(); if(typeof window.gdOpenImport==='function'){ window.gdOpenImport(); if(typeof window.gdImpTab==='function') window.gdImpTab('text'); } });
}

function handle(list){
  var imgs = imageFiles(list);
  if(!imgs.length){ if(typeof showToast==='function') showToast('Add an image file (PNG, JPG or WebP).'); return; }
  if(typeof window.gdOpenImport==='function') window.gdOpenImport(imgs);
}

window.renderOrderScans = function(){
  injectCss();
  var v = ensureView(); if(!v) return;
  var lim = limit();
  var body = $('osBody'); if(!body) return;
  body.innerHTML = '<div class="os-top">' + scannerHtml(lim) + stepsHtml() + '</div>' + planHtml(lim) + recentHtml();
  bind(lim);
};

/* paste an image anywhere on the page */
document.addEventListener('paste', function(e){
  if(!viewActive() || limit()===0) return;
  var t = e.target; if(t && (t.tagName==='INPUT' || t.tagName==='TEXTAREA' || t.isContentEditable)) return;
  var files = [];
  var items = (e.clipboardData && e.clipboardData.items) || [];
  for(var i=0;i<items.length;i++){ if(items[i].kind==='file' && /^image\//.test(items[i].type)){ var f = items[i].getAsFile(); if(f) files.push(f); } }
  if(files.length){ e.preventDefault(); handle(files); }
});

/* ---------- dashboard entry strip ---------- */
function renderStrip(){
  var card = $('gdDashOrders'); if(!card) return;
  if(typeof isDemoMode!=='undefined' && isDemoMode){ card.style.display = 'none'; return; }
  injectCss();
  var lim = limit();
  var sig = String(lim);
  if(card.getAttribute('data-os')===sig && card.innerHTML){ card.style.display = ''; return; }
  card.setAttribute('data-os', sig);
  card.innerHTML = '<div class="os-strip"><div class="os-strip-ic">' + ICON_SCAN + '</div>' +
    '<div class="os-strip-tx"><b>Order import</b><span>' + (lim ? 'Import orders from a broker screenshot. Up to ' + lim + ' per upload.' : 'Import orders from a broker screenshot. Available on Pro and above.') + '</span></div>' +
    '<button type="button" class="btn btn-primary btn-sm" id="osStripGo">' + (lim ? 'Import orders' : 'See how it works') + '</button></div>';
  var go = $('osStripGo'); if(go) go.addEventListener('click', function(){ var b = document.querySelector('.side-navbtn[data-view="orderscans"]'); if(b) b.click(); });
  card.style.display = '';
}

window.gdRenderOrderStrip = renderStrip;
/* gd-trade-import.js calls window.gdRenderOrderStrip() from its own render; this file loads after it and takes the card over on first boot */
function boot(){
  injectCss();
  if(typeof renderAll==='function' && !renderAll.__gdos){
    var prev = renderAll;
    var wr = function(){ var out = prev.apply(this, arguments); try{ renderStrip(); if(viewActive()) window.renderOrderScans(); }catch(e){} return out; };
    wr.__gdos = true; renderAll = wr;
  }
  renderStrip();
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
