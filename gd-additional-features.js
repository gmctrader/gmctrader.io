/* Ghost Discipline — Additional Features page. Explains PipX Ledger (AI macro news desk) and opens it for Premium members only.
   Gating note: this hides the launch link from non-Premium accounts; it is a client-side convenience, not a security boundary. */
(() => {
  const d = document, $ = id => d.getElementById(id), PIPX = 'https://pipx-six.vercel.app/';
  const premium = () => { try { return typeof isPremiumTier === 'function' && isPremiumTier(); } catch (e) { return false; } };
  const st = d.createElement('style');
  st.textContent = `.af-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin-top:14px}.af-tile{padding:18px;border:1px solid rgba(255,255,255,.08);border-radius:16px;background:rgba(255,255,255,.025);transition:.25s}.af-tile:hover{transform:translateY(-3px);border-color:var(--bronze)}
.af-tile b{display:block;margin-bottom:6px;color:var(--bronze-bright)}.af-tile p{margin:0;font-size:13px;line-height:1.65;color:var(--slate,#9fb0a8)}.af-n{display:inline-grid;place-items:center;width:28px;height:28px;margin-bottom:10px;border-radius:50%;background:var(--bronze);color:var(--bronze-ink,#03110c);font-weight:700;font-size:13px}
.af-hero{display:flex;gap:18px;align-items:center;justify-content:space-between;flex-wrap:wrap}.af-hero h3{margin:4px 0 6px}.af-hero p{margin:0;max-width:600px;line-height:1.7;color:var(--slate,#9fb0a8)}.af-card{margin-top:18px}.af-fine{margin-top:18px;font-size:12px;line-height:1.7;color:var(--slate,#8b9c95)}`;
  d.head.appendChild(st);
  const steps = [['Open PipX Ledger', 'Launch it from the button above. It runs as its own desk and never touches your Ghost Discipline journal.'], ['Add two free keys', 'Paste a free Groq key (the AI) and a free Tavily key (live web search) in PipX Settings. Keys stay in your browser.'], ['Choose your markets', 'Enter pairs such as EURUSD, XAUUSD or GBPJPY, or currencies like USD. News briefs rescan these automatically.'], ['Read the brief before the release', 'Around ten minutes before each high-impact U.S. release, PipX writes a sourced brief: a USD call, confidence and scenarios.']];
  const gains = [['Plan around the news', 'Know which releases land in your session before you write the Daily Trade Plan, then set cooling-off and risk caps around them.'], ['One dollar read, every pair', 'The USD call is oriented per pair and checked against live structure, so you see where your watchlist agrees or conflicts.'], ['Hold the AI accountable', 'Prediction vs Reality stores what the AI called beside the real print and the measured DXY reaction. Trust it only as far as the record earns.'], ['Better reviews', 'Compare your own decisions around a release with the saved brief in the Review Room and see whether news timing helps or hurts your edge.']];
  function render() {
    const h = $('addFeaturesRoot'); if (!h) return;
    const ok = premium();
    h.innerHTML = `<div class="card af-hero"><div><div class="ep-kicker">Premium · Included</div><h3>PipX Ledger — AI macro news desk</h3>
<p>Every major U.S. data release, read by AI before it lands. PipX turns consensus, Fed context and the dollar index into a clear USD call, maps it onto your pairs, then shows what really happened so you can judge the AI on evidence.</p></div>
${ok ? `<a class="btn btn-primary" href="${PIPX}" target="_blank" rel="noopener">Open PipX Ledger ↗</a>` : `<button class="btn btn-primary" type="button" onclick="openPackageRequest('premium')">Unlock with Premium →</button>`}</div>
${ok ? '' : '<div class="card af-card"><div class="ep-kicker">Locked</div><p class="page-sub" style="margin:6px 0 0">PipX Ledger is included with Premium only. Upgrade to see the launch link and use it alongside your journal.</p></div>'}
<div class="card af-card"><div class="ep-kicker">How it works</div><h3>From headline to decision in four steps</h3><div class="af-grid">${steps.map((s, i) => `<div class="af-tile"><span class="af-n">${i + 1}</span><b>${s[0]}</b><p>${s[1]}</p></div>`).join('')}</div></div>
<div class="card af-card"><div class="ep-kicker">Why it helps</div><h3>How Premium members benefit</h3><div class="af-grid">${gains.map(g => `<div class="af-tile"><b>${g[0]}</b><p>${g[1]}</p></div>`).join('')}</div></div>
<p class="af-fine">PipX Ledger is a separate research service. Briefs are research context, not financial advice or a promise of results, and market data may be delayed. Ghost Discipline stays a journaling and review tool: nothing here tells you what to trade.</p>`;
  }
  const wrap = () => { if (typeof window.applyTierLocks !== 'function' || window.applyTierLocks.__af) return; const o = window.applyTierLocks; window.applyTierLocks = function () { const r = o.apply(this, arguments); try { if ($('view-addfeatures') && $('view-addfeatures').classList.contains('active')) render(); } catch (e) {} return r; }; window.applyTierLocks.__af = true; };
  window.renderAdditionalFeatures = render; wrap(); d.addEventListener('DOMContentLoaded', wrap); addEventListener('load', wrap);
})();
