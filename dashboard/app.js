(() => {
  'use strict';
  const D = window.RADAR;
  const rows = D.rows || [], live = D.live || [];
  const snap = D.as_of;
  const $ = id => document.getElementById(id);
  const money = n => n == null ? '—' : '$' + Math.round(n).toLocaleString('en-US');
  const pct = n => n == null ? '—' : (n > 0 ? '+' : '') + n.toFixed(1) + '%';
  const age = n => n == null ? '365*' : n.toLocaleString('en-US');
  const protocols = new Map(rows.map(r => [r.slug, r]));
  const watchSlugs = new Set();
  // Membership is watchlist-first; every other board row is below the floor.
  // Consequently the above-floor rows reproduce the sealed watchlist exactly.
  rows.forEach(r => { if (r.tvl_usd >= D.floor_usd) watchSlugs.add(r.slug); });
  const categories = [...new Set(rows.map(r => r.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  const chains = [...new Set(rows.flatMap(r => r.chains || []))].sort((a,b)=>a.localeCompare(b));
  categories.forEach(v => $('category').insertAdjacentHTML('beforeend', `<option value="${esc(v)}">${esc(v)}</option>`));
  chains.forEach(v => $('chain').insertAdjacentHTML('beforeend', `<option value="${esc(v)}">${esc(v)}</option>`));
  $('date').textContent = snap;
  $('counts').innerHTML = `<div><strong>${D.board_size}</strong><small>RANKED</small></div><div><strong>${D.watchlist_size}</strong><small>WATCHLIST</small></div><div><strong>${D.live_size}</strong><small>LIVE TOKEN</small></div>`;
  function esc(v) { return String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function recompute(r) {
    const m = D.model, growth = Math.min(m.growth_cap, Math.max(m.growth_floor, r.change_7d ?? 0));
    const gm = 1 + growth / 100 * m.growth_weight;
    const mm = m.maturity_floor + Math.min(r.age_days ?? m.unknown_age_days, m.maturity_days) / m.maturity_days * m.maturity_range;
    const bm = 1 + m.breadth_step * Math.min((r.chains || []).length - 1, m.breadth_cap);
    return { base: r.tvl_usd * m.base_multiple, growth, gm, mm, bm, implied: Math.max(1, Math.round(r.tvl_usd * m.base_multiple * gm * mm * bm)) };
  }
  function isWatch(r) { return watchSlugs.has(r.slug); }
  function render() {
    const q = $('search').value.trim().toLowerCase(), cat = $('category').value, chain = $('chain').value, only = $('watchlist').checked;
    let out = rows.filter(r => (!q || `${r.name} ${r.slug}`.toLowerCase().includes(q)) && (!cat || r.category === cat) && (!chain || r.chains.includes(chain)) && (!only || isWatch(r)));
    const key = $('sort').value;
    out.sort((a,b) => key === 'rank' ? a.rank-b.rank : key === 'tvl' ? b.tvl_usd-a.tvl_usd || a.rank-b.rank : key === 'implied' ? b.implied_value_usd-a.implied_value_usd || a.rank-b.rank : key === 'change' ? (b.change_7d ?? -Infinity)-(a.change_7d ?? -Infinity) || a.rank-b.rank : (b.age_days ?? 365)-(a.age_days ?? 365) || a.rank-b.rank);
    $('results').textContent = `${out.length} PROTOCOL${out.length === 1 ? '' : 'S'} · ${only ? 'WATCHLIST' : 'ALL ELIGIBLE'}`;
    $('empty').hidden = out.length > 0;
    $('board-body').innerHTML = out.map(r => `<tr data-slug="${esc(r.slug)}"><td class="rank">${r.rank.toString().padStart(2,'0')}</td><td class="protocol-cell"><a class="protocol-link" href="?slug=${encodeURIComponent(r.slug)}">${esc(r.name)}${isWatch(r) ? '<span class="watch-badge">W</span>' : ''}</a><span class="slug">${esc(r.slug)}</span></td><td class="category-text">${esc(r.category || 'Uncategorised')}</td><td><span class="chain-text">${esc((r.chains || []).join(' · '))}</span></td><td class="num">${money(r.tvl_usd)}</td><td class="num ${r.change_7d > 0 ? 'up' : r.change_7d < 0 ? 'down' : ''}">${pct(r.change_7d)}</td><td class="num">${age(r.age_days)}</td><td class="num implied">${money(r.implied_value_usd)}</td></tr>`).join('');
    $('board-body').querySelectorAll('tr').forEach(tr => tr.addEventListener('click', e => { if (e.target.closest('a')) return; location.href = `?slug=${encodeURIComponent(tr.dataset.slug)}`; }));
  }
  function renderLive() {
    $('live-body').innerHTML = live.map(r => `<tr><td class="protocol-cell"><b>${esc(r.name)}</b><span class="slug">${esc(r.slug)}</span></td><td class="category-text">${esc(r.category || 'Uncategorised')}</td><td><span class="chain-text">${esc((r.chains || []).join(' · '))}</span></td><td class="num implied">${money(r.mcap_usd)}</td><td class="num">${money(r.tvl_usd)}</td><td class="num ${r.change_7d > 0 ? 'up' : r.change_7d < 0 ? 'down' : ''}">${pct(r.change_7d)}</td></tr>`).join('');
  }
function cap(p){return p.tvl_usd>=5e9?250:p.tvl_usd>=1e9?150:p.tvl_usd>=1e8?100:50}
function gas(c){const x=c.toLowerCase(); return x==='ethereum'?'3-8':x==='solana'?'0.01':(x==='base'||x==='arbitrum'||x==='optimism')?'0.10-0.50':'0.50-2'}
function action(p,amt,ch){const c=(p.category||'').toLowerCase(), n=p.name;if(c.includes('lend'))return `Supply $${amt} USDC on ${n} at ${ch}.`;if(c.includes('dex'))return `Provide $${amt} liquidity in ${n} on ${ch}.`;if(c.includes('bridge'))return `Bridge $${amt} through ${n} to ${ch}.`;if(c.includes('staking')||c.includes('restak'))return `Stake $${amt} via ${n} on ${ch}.`;if(c.includes('perpetual')||c.includes('derivative'))return `Deposit $${amt} margin on ${n} at ${ch}.`;if(c.includes('prediction'))return `Fund $${amt} and trade one market on ${n}.`;if(c.includes('vault')||c.includes('curator'))return `Deposit $${amt} into a ${n} vault on ${ch}.`;if(c.includes('stable'))return `Mint or deposit $${amt} stable assets via ${n} on ${ch}.`;if(c.includes('rwa'))return `Acquire $${amt} of ${n}'s yield asset on ${ch}.`;if(c.includes('insurance'))return `Buy $${amt} cover from ${n} on ${ch}.`;return `Deposit $${amt} USDC into ${n} on ${ch}.`}
function secondAction(p) {
  const category=(p.category??'').toLowerCase();
  if(category.includes('lend')) return 'Borrow a small amount against the supplied collateral, keeping loan-to-value below 20%, then repay it';
  if(category.includes('dex')) return 'Make a small swap in a different supported pair while keeping the liquidity position open';
  if(category.includes('bridge')) return 'Swap a small part of the received asset on the destination chain';
  if(category.includes('staking')||category.includes('restak')) return 'Provide a small amount of liquidity with the received staking receipt where supported';
  if(category.includes('perpetual')||category.includes('derivative')) return 'Open and close a minimum-size perpetual trade at 1x leverage after checking fees';
  if(category.includes('prediction')) return 'Provide a small amount of liquidity to a supported prediction market';
  if(category.includes('vault')||category.includes('curator')) return 'Vote on an available vault allocation proposal using the deposited position where supported';
  if(category.includes('stable')) return 'Swap a small part of the minted or deposited stable asset in a supported pool';
  if(category.includes('rwa')) return 'Vote on an available asset-allocation proposal where the position grants voting rights';
  if(category.includes('insurance')) return 'Provide a small amount of liquidity to a supported underwriting pool';
  return 'Make a small swap in a supported pool, separate from the initial deposit';
}
function farmSteps(p,age){const ch=p.chains[0]||'its primary chain', amt=cap(p), hold=age<180?60:age<365?45:30, g=gas(ch); return [
`Create a fresh wallet for ${p.name}; keep the seed phrase offline. Cost: $0. Time: 5 minutes.`,
`${action(p,amt,ch)} Cost: $${amt} capital plus about $${g} gas. Time: 15 minutes.`,
`${secondAction(p)} via ${p.name} on ${ch}; confirm it qualifies on the official rewards page first. Cost: up to $10 of the $${amt} budget plus about $${g} gas. Time: 15 minutes.`,
`Repeat one qualifying ${p.category||'protocol'} action every week on ${ch}. Cost: about $${g} weekly gas. Time: 10 minutes weekly.`,
`Keep the position open for at least ${hold} days while ${p.name} activity accrues. Cost: $${amt} remains deployed. Time: ${hold} days.`,
`Check ${p.name}'s own points or rewards page and claim only from links it publishes; never pay to claim. Cost: $0. Time: 10 minutes.`,
`Monitor ${p.name} weekly for TVL, announcements, and points; top up if below the $${amt} tier. Cost: $0 to review; restore up to $${amt} capital plus about $${g} gas if needed. Time: 10 minutes weekly.`,
`Keep a farm log with wallet, dates, transactions, and an exit plan for ${p.name}. Cost: $0. Time: 5 minutes.`]}

  function detail(r) {
    const x = recompute(r);
    $('detail-content').innerHTML = `<div class="detail-top"><div><div class="eyebrow">RANK ${String(r.rank).padStart(2,'0')} · ${isWatch(r) ? 'WATCHLIST' : 'EARLY RADAR'}</div><h2 id="detail-name">${esc(r.name)}</h2><p class="detail-meta">${esc(r.slug)} · ${esc(r.category || 'Uncategorised')} · ${(r.chains || []).map(esc).join(' · ')} · Listed ${esc(r.listed_at || 'unknown; model uses 365 days')}</p></div><button class="close-detail" aria-label="Close detail">Close ×</button></div><div class="detail-facts"><div><small>TVL</small><strong>${money(r.tvl_usd)}</strong></div><div><small>7D CHANGE</small><strong>${pct(r.change_7d)}</strong></div><div><small>AGE / DAYS</small><strong>${age(r.age_days)}</strong></div><div><small>CHAINS</small><strong>${(r.chains || []).length}</strong></div><div><small>STATUS</small><strong>PRE-TOKEN</strong></div><div><small>IMPLIED VALUE</small><strong>${money(x.implied)}</strong></div></div><div class="detail-section-title">MODEL BREAKDOWN <span>Recomputed from this row · radar-2</span></div><div class="breakdown"><div><b>BASE</b><strong>× 0.25</strong><p>${money(r.tvl_usd)} TVL<br>=$${Math.round(x.base).toLocaleString('en-US')}</p></div><div><b>GROWTH</b><strong>× ${x.gm.toFixed(3)}</strong><p>${pct(r.change_7d)} 7-day change<br>1 + ${x.growth}% / 100 × 0.5</p></div><div><b>MATURITY</b><strong>× ${x.mm.toFixed(3)}</strong><p>${age(r.age_days)} tracked days<br>0.6 + min(age,1095)/1095 × 0.4</p></div><div><b>BREADTH</b><strong>× ${x.bm.toFixed(2)}</strong><p>${(r.chains || []).length} chains<br>1 + 0.05 × min(chains−1,4)</p></div></div><div class="equation">${money(r.tvl_usd)} × 0.25 × ${x.gm.toFixed(3)} × ${x.mm.toFixed(3)} × ${x.bm.toFixed(2)} = <b>${money(x.implied)}</b></div><div class="detail-section-title">FARM PLAN <span>8 actions · generated from category, chain, TVL and age</span></div><ol class="farm-list">${farmSteps(r,r.age_days ?? 365).map(s => `<li>${esc(s)}</li>`).join('')}</ol><p class="detail-foot">Recorded absence is not proof of no token. The plan describes qualifying activity and costs; verify current protocol terms before acting.</p>`;
    $('detail-content').querySelector('.close-detail').onclick = () => { $('detail').close(); if (location.search) history.pushState({},'',location.pathname); };
    $('detail').showModal();
  }
  function openFromUrl() {
    const p = new URLSearchParams(location.search), slug = p.get('slug');
    $('category').value = p.get('category') || '';
    $('watchlist').checked = p.get('watchlist') === '1';
    if (slug && protocols.has(slug)) detail(protocols.get(slug));
  }
  ['search','category','chain','sort','watchlist'].forEach(id => $(id).addEventListener('input', render));
  $('reset').onclick = () => { $('search').value=''; $('category').value=''; $('chain').value=''; $('sort').value='rank'; $('watchlist').checked=false; render(); history.pushState({},'',location.pathname); };
  $('board-tab').onclick = () => { $('board-tab').classList.add('active'); $('live-tab').classList.remove('active'); $('board-view').hidden=false; $('live-view').hidden=true; };
  $('live-tab').onclick = () => { $('live-tab').classList.add('active'); $('board-tab').classList.remove('active'); $('board-view').hidden=true; $('live-view').hidden=false; };
  renderLive(); openFromUrl(); render();
  if (new URLSearchParams(location.search).get("view") === "live") $("live-tab").click();
})();
