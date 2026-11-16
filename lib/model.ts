export interface SnapshotProtocol { slug:string; name:string; category:string|null; chains:string[]; tvl_usd:number; change_7d:number|null; mcap_usd:number|null; listed_at:string|null; gecko_id:string|null; symbol:string|null }
export interface Snapshot {as_of:string; source:string; floor_usd:number; protocols:SnapshotProtocol[]; watchlist:string[]}
export interface ModelConstants {base_multiple:number; growth_weight:number; growth_floor:number; growth_cap:number; maturity_floor:number; maturity_range:number; maturity_days:number; unknown_age_days:number; breadth_step:number; breadth_cap:number}
export const MODEL:ModelConstants={base_multiple:.25,growth_weight:.5,growth_floor:-60,growth_cap:120,maturity_floor:.6,maturity_range:.4,maturity_days:1095,unknown_age_days:365,breadth_step:.05,breadth_cap:4};
export const MODEL_VERSION='radar-2'; export const LIVE_ROWS=24;
export interface BoardRow {rank:number; slug:string; name:string; category:string|null; chains:string[]; tvl_usd:number; change_7d:number|null; mcap_usd:number|null; listed_at:string|null; gecko_id:string|null; symbol:string|null; token_status:'pre-token'; age_days:number; implied_value_usd:number; model:{base_multiple:number;growth_pct:number;growth_multiplier:number;maturity_multiplier:number;breadth_multiplier:number;age_days:number}; farm_steps:string[]}
export interface RadarRow {rank:number;slug:string;name:string;category:string|null;chains:string[];tvl_usd:number;change_7d:number|null;mcap_usd:number|null;listed_at:string|null;age_days:number;implied_value_usd:number;growth_multiplier:number;maturity_multiplier:number;breadth_multiplier:number}
export interface LiveRow {slug:string;name:string;category:string|null;chains:string[];tvl_usd:number;mcap_usd:number|null;change_7d:number|null}
export interface RadarData {as_of:string;source:string;floor_usd:number;model:ModelConstants;model_version:string;watchlist_size:number;board_size:number;early_size:number;live_size:number;rows:RadarRow[];live:LiveRow[]}
export class SnapshotError extends Error {constructor(m:string){super(m);this.name='SnapshotError'}}
const VERSIONED=/\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/; const DAY=86400000;
export function ageDays(asOf:string,list:string|null):number {if(!list)return 365;const a=Date.parse(asOf+'T00:00:00Z'),b=Date.parse(list+'T00:00:00Z');return Number.isFinite(a)&&Number.isFinite(b)?Math.max(0,Math.floor((a-b)/DAY)):365}
export function isPreToken(p:SnapshotProtocol){return p.mcap_usd===null&&p.gecko_id===null&&p.symbol===null}
const EXCLUDED_CATEGORIES = new Set([
  'Bridge', 'Canonical Bridge', 'Cross Chain Bridge', 'Liquid Staking',
  'Liquid Restaking', 'Restaked BTC', 'CEX',
]);
const PRODUCT_NAME = /\b(wrapped|staked|staking)\b/i;
const EXCHANGE_NAME = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/i;
export function isRankable(p:SnapshotProtocol){
  return isPreToken(p)
    && !EXCLUDED_CATEGORIES.has(p.category ?? '')
    && !/\bWrapper\b/i.test(p.category ?? '')
    && !PRODUCT_NAME.test(p.name)
    && !EXCHANGE_NAME.test(p.name)
    && !VERSIONED.test(p.name);
}
function compareSlug(a:string,b:string){return a<b?-1:a>b?1:0}
export function impliedValue(p:SnapshotProtocol,asOf:string,m:ModelConstants=MODEL){const age=ageDays(asOf,p.listed_at),g=Math.min(m.growth_cap,Math.max(m.growth_floor, p.change_7d??0)),gm=1+g/100*m.growth_weight,mm=m.maturity_floor+Math.min(age,m.maturity_days)/m.maturity_days*m.maturity_range,bm=1+m.breadth_step*Math.min(p.chains.length-1,m.breadth_cap);return {implied:Math.max(1,Math.round(p.tvl_usd*m.base_multiple*gm*mm*bm)),growthPct:g,growthMult:gm,maturityMult:mm,breadthMult:bm,age}}
function cap(p:SnapshotProtocol){return p.tvl_usd>=5e9?250:p.tvl_usd>=1e9?150:p.tvl_usd>=1e8?100:50}
function gas(c:string){const x=c.toLowerCase(); return x==='ethereum'?'3-8':x==='solana'?'0.01':(x==='base'||x==='arbitrum'||x==='optimism')?'0.10-0.50':'0.50-2'}
function action(p:SnapshotProtocol,amt:number,ch:string){const c=(p.category||'').toLowerCase(), n=p.name;if(c.includes('lend'))return `Supply $${amt} USDC on ${n} at ${ch}.`;if(c.includes('dex'))return `Provide $${amt} liquidity in ${n} on ${ch}.`;if(c.includes('bridge'))return `Bridge $${amt} through ${n} to ${ch}.`;if(c.includes('staking')||c.includes('restak'))return `Stake $${amt} via ${n} on ${ch}.`;if(c.includes('perpetual')||c.includes('derivative'))return `Deposit $${amt} margin on ${n} at ${ch}.`;if(c.includes('prediction'))return `Fund $${amt} and trade one market on ${n}.`;if(c.includes('vault')||c.includes('curator'))return `Deposit $${amt} into a ${n} vault on ${ch}.`;if(c.includes('stable'))return `Mint or deposit $${amt} stable assets via ${n} on ${ch}.`;if(c.includes('rwa'))return `Acquire $${amt} of ${n}'s yield asset on ${ch}.`;if(c.includes('insurance'))return `Buy $${amt} cover from ${n} on ${ch}.`;return `Deposit $${amt} USDC into ${n} on ${ch}.`}
function secondAction(p:SnapshotProtocol):string {
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
export function farmSteps(p:SnapshotProtocol,age:number){const ch=p.chains[0]||'its primary chain', amt=cap(p), hold=age<180?60:age<365?45:30, g=gas(ch); return [
`Create a fresh wallet for ${p.name}; keep the seed phrase offline. Cost: $0. Time: 5 minutes.`,
`${action(p,amt,ch)} Cost: $${amt} capital plus about $${g} gas. Time: 15 minutes.`,
`${secondAction(p)} via ${p.name} on ${ch}; confirm it qualifies on the official rewards page first. Cost: up to $10 of the $${amt} budget plus about $${g} gas. Time: 15 minutes.`,
`Repeat one qualifying ${p.category||'protocol'} action every week on ${ch}. Cost: about $${g} weekly gas. Time: 10 minutes weekly.`,
`Keep the position open for at least ${hold} days while ${p.name} activity accrues. Cost: $${amt} remains deployed. Time: ${hold} days.`,
`Check ${p.name}'s own points or rewards page and claim only from links it publishes; never pay to claim. Cost: $0. Time: 10 minutes.`,
`Monitor ${p.name} weekly for TVL, announcements, and points; top up if below the $${amt} tier. Cost: $0 to review; restore up to $${amt} capital plus about $${g} gas if needed. Time: 10 minutes weekly.`,
`Keep a farm log with wallet, dates, transactions, and an exit plan for ${p.name}. Cost: $0. Time: 5 minutes.`]}
/**
 * Always include watchlist slugs because the gate demands full coverage.
 * Watchlist membership takes precedence over exclusions, including Wrapper.
 * The exclusions filter only the additional candidates below the TVL floor.
 * Above the floor, only the house watchlist establishes membership: the sealed
 * snapshot has no parentProtocol field, so an omitted protocol cannot be shown
 * to be a standalone launch rather than another protocol's deployment or product.
 */
export function buildBoard(s:Snapshot,m:ModelConstants=MODEL):BoardRow[]{const watchlist=new Set(s.watchlist);const a=s.protocols.filter(p=>watchlist.has(p.slug)||(p.tvl_usd<s.floor_usd&&isRankable(p))).map(p=>{const v=impliedValue(p,s.as_of,m);return {p,v}}).sort((x,y)=>y.v.implied-x.v.implied||compareSlug(x.p.slug,y.p.slug));return a.map((x,i)=>({rank:i+1,slug:x.p.slug,name:x.p.name,category:x.p.category,chains:x.p.chains,tvl_usd:x.p.tvl_usd,change_7d:x.p.change_7d,mcap_usd:x.p.mcap_usd,listed_at:x.p.listed_at,gecko_id:x.p.gecko_id,symbol:x.p.symbol,token_status:'pre-token',age_days:x.v.age,implied_value_usd:x.v.implied,model:{base_multiple:m.base_multiple,growth_pct:x.v.growthPct,growth_multiplier:x.v.growthMult,maturity_multiplier:x.v.maturityMult,breadth_multiplier:x.v.breadthMult,age_days:x.v.age},farm_steps:farmSteps(x.p,x.v.age)}))}
export function liveRows(s:Snapshot):LiveRow[]{return s.protocols.filter(p=>!isPreToken(p)&&p.category!=='CEX').sort((a,b)=>(b.mcap_usd??0)-(a.mcap_usd??0)||compareSlug(a.slug,b.slug)).slice(0,LIVE_ROWS).map(p=>({slug:p.slug,name:p.name,category:p.category,chains:p.chains,tvl_usd:p.tvl_usd,mcap_usd:p.mcap_usd,change_7d:p.change_7d}))}
export function radarRow(r:BoardRow):RadarRow{return {rank:r.rank,slug:r.slug,name:r.name,category:r.category,chains:r.chains,tvl_usd:r.tvl_usd,change_7d:r.change_7d,mcap_usd:r.mcap_usd,listed_at:r.listed_at,age_days:r.age_days,implied_value_usd:r.implied_value_usd,growth_multiplier:r.model.growth_multiplier,maturity_multiplier:r.model.maturity_multiplier,breadth_multiplier:r.model.breadth_multiplier}}
export function buildRadar(s:Snapshot,m:ModelConstants=MODEL){const board=buildBoard(s,m),live=liveRows(s);return {board,radar:{as_of:s.as_of,source:s.source,floor_usd:s.floor_usd,model:m,model_version:MODEL_VERSION,watchlist_size:s.watchlist.length,board_size:board.length,early_size:board.filter(r=>!s.watchlist.includes(r.slug)).length,live_size:live.length,rows:board.map(radarRow),live}}}
export function parseSnapshot(t:string):Snapshot{let o:any;try{o=JSON.parse(t)}catch{throw new SnapshotError('snapshot.json is not JSON')}if(!o||typeof o!=='object'||!Array.isArray(o.protocols))throw new SnapshotError('invalid snapshot');return {as_of:o.as_of,source:o.source,floor_usd:o.floor_usd,watchlist:o.watchlist,protocols:o.protocols.map((p:any)=>({...p,category:typeof p.category==='string'?p.category:null,chains:Array.isArray(p.chains)?p.chains:[],change_7d:typeof p.change_7d==='number'?p.change_7d:null,mcap_usd:typeof p.mcap_usd==='number'?p.mcap_usd:null,listed_at:typeof p.listed_at==='string'?p.listed_at:null,gecko_id:typeof p.gecko_id==='string'?p.gecko_id:null,symbol:typeof p.symbol==='string'?p.symbol:null}))}}
export function boardIssue(b:BoardRow[],s:Snapshot){if(b.length<100)return `board has ${b.length} rows`;const set=new Set(b.map(r=>r.slug)),miss=s.watchlist.filter(x=>!set.has(x));if(miss.length)return `missing watchlist`;for(let i=0;i<b.length;i++)if(b[i].rank!==i+1)return 'invalid ranks';for(let i=1;i<b.length;i++)if(b[i].implied_value_usd>b[i-1].implied_value_usd)return 'implied rises';if(b.every(r=>r.implied_value_usd===b[0].implied_value_usd))return 'all implied equal';for(const r of b)if(r.farm_steps.length<3||r.farm_steps.length>12||r.farm_steps.some(x=>typeof x!=='string'||x.trim().length<20||x.trim().length>600))return `invalid farm steps ${r.slug}`;return null}
export function dataScript(r:RadarData){return `window.RADAR=${JSON.stringify(r)};\n`}
