const fs = require('fs');

const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const dayData = data.days;

// Compute cumulative lbs
let cumF = 0, cumR = 0;
dayData.forEach(d => {
  cumF += d.defFloor;
  cumR += d.defReal;
  d.lbsF = +(cumF / 3500).toFixed(2);
  d.lbsR = +(cumR / 3500).toFixed(2);
});

const BMR = 1800, NEAT = 250, BASE = BMR + NEAT;
const START = 180.4, ANCHOR_DAY = 5, ANCHOR_WT = 177.0;

// Hero stats
const last = dayData[dayData.length - 1];
const lastWt = dayData.find(d => d.wt)?.wt || ANCHOR_WT;
const lost = (ANCHOR_WT - lastWt).toFixed(1);
const avgCal = Math.round(dayData.reduce((s, d) => s + d.cal, 0) / dayData.length);
const avgPro = Math.round(dayData.reduce((s, d) => s + d.pro, 0) / dayData.length);
const daysDone = dayData.length;
const toJul24 = Math.max(0, Math.round((new Date(2026, 6, 24) - new Date()) / 86400000));

// Weight chart data
let cumFL = 0, cumRL = 0;
const expF = [{ x: ANCHOR_DAY, y: ANCHOR_WT }];
const expR = [{ x: ANCHOR_DAY, y: ANCHOR_WT }];
dayData.filter(d => d.n >= ANCHOR_DAY).forEach(d => {
  cumFL += d.defFloor;
  cumRL += d.defReal;
  expF.push({ x: d.n, y: +(ANCHOR_WT - cumFL / 3500).toFixed(2) });
  expR.push({ x: d.n, y: +(ANCHOR_WT - cumRL / 3500).toFixed(2) });
});

const lastN = dayData[dayData.length - 1].n;
const FCAST = lastN + 5;
const nAnchored = dayData.filter(d => d.n >= ANCHOR_DAY).length;
const avgF = cumFL / nAnchored, avgR = cumRL / nAnchored;
const foreF = [{ x: lastN, y: expF[expF.length - 1].y }, { x: FCAST, y: +(expF[expF.length - 1].y - avgF * 5 / 3500).toFixed(2) }];
const foreR = [{ x: lastN, y: expR[expR.length - 1].y }, { x: FCAST, y: +(expR[expR.length - 1].y - avgR * 5 / 3500).toFixed(2) }];

const actual = dayData.filter(d => d.wt).map(d => ({ x: d.n, y: d.wt }));
const checkpoint = [{ x: ANCHOR_DAY - 1, y: START }];

const xTicks = [ANCHOR_DAY - 1];
dayData.filter(d => d.n >= ANCHOR_DAY).forEach(d => xTicks.push(d.n));
xTicks.push(FCAST);

const xTickLabels = {};
xTickLabels[ANCHOR_DAY - 1] = 'Start';
dayData.filter(d => d.n >= ANCHOR_DAY).forEach(d => xTickLabels[d.n] = 'D' + d.n);
xTickLabels[FCAST] = '+5d';

// Calendar data
const weeks = Math.max(...dayData.map(d => d.week)) + 1;
let calendarHtml = '<div class="cal-weekhead"><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div><div>Sun</div></div>';
for (let w = 0; w < weeks; w++) {
  calendarHtml += '<div class="cal-row">';
  for (let dow = 0; dow < 7; dow++) {
    const d = dayData.find(x => x.week === w && x.dow === dow);
    if (d) {
      calendarHtml += `<div class="cell logged ${d.rest ? 'rest' : 'train'}" onclick="selectDay(${d.n},this)"><div class="dn">Day ${d.n}</div><div class="dd">${d.date.split(' ').slice(1).join(' ')}</div><div class="cw">${(d.cal / 1000).toFixed(2)}k</div><div class="lblb">−${d.lbsF} / −${d.lbsR} lb</div></div>`;
    } else {
      calendarHtml += '<div class="cell empty"></div>';
    }
  }
  calendarHtml += '</div>';
}

// Exercise totals
let liftMin = 0, liftN = 0, runMin = 0, runMi = 0, runN = 0, walkMin = 0, walkMi = 0, walkN = 0, rowMin = 0, rowN = 0, rowM = 0;
const parseDur = (s) => {
  if (!s) return 0;
  let m = 0;
  const h = s.match(/(\d+)\s*h/);
  const mn = s.match(/(\d+)\s*m/);
  if (h) m += parseInt(h[1]) * 60;
  if (mn) m += parseInt(mn[1]);
  return m;
};
const parseMiles = (s) => {
  if (!s) return 0;
  const m = s.match(/([\d.]+)\s*mi/);
  return m ? parseFloat(m[1]) : 0;
};
const fmtH = (min) => {
  const h = Math.floor(min / 60), m = min % 60;
  return h + 'h ' + (m < 10 ? '0' : '') + m + 'm';
};

dayData.forEach(d => d.ex.forEach(e => {
  const n = e.name.toLowerCase();
  if (n.includes('push') || n.includes('pull') || n.includes('legs') || n.includes('strength')) {
    liftMin += parseDur(e.d);
    liftN++;
  } else if (n.includes('run') || n.includes('hiit')) {
    runMin += parseDur(e.d);
    runMi += parseMiles(e.d);
    runN++;
  } else if (n.includes('walk')) {
    walkMin += parseDur(e.d);
    walkMi += parseMiles(e.d);
    walkN++;
  } else if (n.includes('row')) {
    rowMin += parseDur(e.d);
    rowN++;
    const m = e.d.match(/([\d,]+)\s*m\b/);
    if (m) rowM += parseInt(m[1].replace(/,/g, ''));
  }
}));

const totMin = liftMin + runMin + walkMin + rowMin;
const footMi = (runMi + walkMi).toFixed(2);

// Build day details function (inline in HTML)
const buildDetailPanel = () => {
  let html = '';
  dayData.forEach(d => {
    const maintF = BASE + d.exFloor, maintR = BASE + d.exReal;
    const exLines = d.ex.map(e => `<div class="ex-line"><span class="en">${e.name}</span><span class="ed">${e.d}</span></div>`).join('');
    html += `
      <div id="detail_${d.n}" style="display:none;">
        <div class="dpanel">
          <div class="dphead ${d.rest ? 'rest' : ''}">
            <span class="dnum">Day ${d.n}</span><span class="dttl">${d.date}</span>
            <span class="dtrain">${d.ex.map(e => e.name).join(' + ')}</span>
          </div>
          <div class="dpbody">
            <div class="mini-grid">
              <div class="mini"><div class="mv" style="color:#a07d28">${d.cal.toLocaleString()}</div><div class="ml">Calories</div></div>
              <div class="mini"><div class="mv" style="color:#2f8a60">${d.pro}g</div><div class="ml">Protein</div></div>
              <div class="mini"><div class="mv" style="color:#3f6fc4">${d.carb}g</div><div class="ml">Carbs</div></div>
              <div class="mini"><div class="mv" style="color:#cf7a3a">${d.fat}g</div><div class="ml">Fat</div></div>
            </div>
            <div class="lbl2">Exercise</div>
            ${exLines}
            <div class="lbl2">Calorie Balance</div>
            <div class="two-col">
              <div class="balance">
                <div class="bt">Conservative Floor</div>
                <div class="br"><span class="l">BMR</span><span class="v">${BMR.toLocaleString()}</span></div>
                <div class="br"><span class="l">+ NEAT</span><span class="v">${NEAT}</span></div>
                <div class="br"><span class="l">+ Exercise</span><span class="v">${d.exFloor}</span></div>
                <div class="br hl"><span class="l">Maintenance</span><span class="v">${maintF.toLocaleString()}</span></div>
                <div class="br"><span class="l">Eaten</span><span class="v">${d.cal.toLocaleString()}</span></div>
                <div class="br fin"><span class="l">Deficit</span><span class="v">~${d.defFloor}</span></div>
                <div class="br lost"><span class="l">Cum. fat lost</span><span class="v">−${d.lbsF} lb</span></div>
              </div>
              <div class="balance">
                <div class="bt">Real (likely)</div>
                <div class="br"><span class="l">BMR</span><span class="v">${BMR.toLocaleString()}</span></div>
                <div class="br"><span class="l">+ NEAT</span><span class="v">${NEAT}</span></div>
                <div class="br"><span class="l">+ Exercise</span><span class="v">${d.exReal}</span></div>
                <div class="br hl"><span class="l">Maintenance</span><span class="v">${maintR.toLocaleString()}</span></div>
                <div class="br"><span class="l">Eaten</span><span class="v">${d.cal.toLocaleString()}</span></div>
                <div class="br fin"><span class="l">Deficit</span><span class="v">~${d.defReal}</span></div>
                <div class="br lost"><span class="l">Cum. fat lost</span><span class="v">−${d.lbsR} lb</span></div>
              </div>
            </div>
            <div class="chart-note" style="margin-top:10px;">Apple Watch deficit for reference: ~${d.defWatch} cal.</div>
          </div>
        </div>
      </div>`;
  });
  return html;
};

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Project Revenge Body · Dashboard</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>
<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@500&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#eceae4; font-family:'DM Sans',sans-serif; color:#2a2722; padding:22px 12px 60px; line-height:1.5; }
  .wrap { max-width:920px; margin:0 auto; }
  .card { background:#fff; border:1px solid #e2ddd2; border-radius:18px; padding:26px 24px; margin-bottom:20px; box-shadow:0 4px 20px rgba(120,100,60,0.07); }
  .tag { display:inline-block; background:#2f8a60; color:#fff; font-size:12px; font-weight:800; letter-spacing:2px; padding:6px 15px; border-radius:20px; text-transform:uppercase; margin-bottom:12px; }
  h1 { font-size:32px; font-weight:800; letter-spacing:-1px; color:#1c1a16; }
  .sub { color:#867f70; font-size:15px; margin-top:4px; font-weight:500; }
  .section-label { font-size:12px; letter-spacing:2px; color:#a89a78; text-transform:uppercase; font-weight:700; margin:4px 0 16px; padding-bottom:7px; border-bottom:2px solid #efe9dc; }
  .hero { display:grid; grid-template-columns:repeat(6,1fr); gap:12px; margin-top:20px; }
  @media(max-width:760px){ .hero{ grid-template-columns:repeat(3,1fr);} }
  @media(max-width:480px){ .hero{ grid-template-columns:repeat(2,1fr);} }
  .stat { background:#faf8f2; border:1px solid #efe9dc; border-radius:14px; padding:16px 12px; text-align:center; }
  .stat .v { font-size:26px; font-weight:800; font-family:'DM Mono',monospace; color:#1c1a16; }
  .stat .v.green { color:#2f8a60; } .stat .v.gold { color:#a07d28; }
  .stat .l { font-size:10px; color:#9a9484; letter-spacing:1px; margin-top:4px; text-transform:uppercase; font-weight:600; }
  .stat .d { font-size:11px; color:#b3ab98; margin-top:2px; }
  .chart-box { position:relative; height:320px; }
  .chart-note { font-size:13px; color:#867f70; margin-top:12px; } .chart-note b { color:#2a2722; }
  .toggle-row { display:flex; gap:8px; margin-bottom:14px; flex-wrap:wrap; }
  .toggle-row button { font-family:inherit; font-size:12px; font-weight:700; letter-spacing:0.5px; padding:7px 14px; border-radius:20px; border:1.5px solid #d8d2c4; background:#fff; color:#867f70; cursor:pointer; }
  .toggle-row button.active { background:#2f8a60; color:#fff; border-color:#2f8a60; }
  .toggle-row button.win-btn { padding:7px 11px; }
  .toggle-row button.win-btn.active { background:#2a2722; border-color:#2a2722; }
  .dot { width:10px; height:10px; border-radius:3px; display:inline-block; }
  .cal-weekhead { display:grid; grid-template-columns:repeat(7,1fr); gap:8px; margin-bottom:8px; }
  .cal-weekhead div { text-align:center; font-size:10px; letter-spacing:1px; color:#a89a78; font-weight:700; text-transform:uppercase; }
  .cal-row { display:grid; grid-template-columns:repeat(7,1fr); gap:8px; margin-bottom:8px; }
  .cell { aspect-ratio:1/1; border-radius:12px; border:1px solid #efe9dc; background:#faf8f2; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; cursor:pointer; }
  .cell.empty { background:transparent; border:1px dashed #e8e2d4; cursor:auto; }
  .cell.logged.train { background:#eaf4ee; border-color:#bfe0cd; }
  .cell.logged.rest { background:#e8eef4; border-color:#c2d4e4; }
  .cell .dn { font-size:11px; font-weight:800; color:#1c1a16; }
  .cell .dd { font-size:9px; color:#9a9484; }
  .cell .cw { font-family:'DM Mono',monospace; font-size:13px; font-weight:700; color:#b8923a; margin-top:2px; }
  .cell.rest .cw { color:#9bb0c4; }
  .cell .lblb { font-size:10.5px; color:#8a7d5c; font-weight:700; margin-top:2px; font-family:'DM Mono',monospace; }
  .cell.sel { outline:3px solid #b8923a; outline-offset:1px; }
  #detail { margin-top:18px; }
  .dpanel { border:1px solid #e2ddd2; border-radius:14px; overflow:hidden; }
  .dphead { background:#2f8a60; color:#fff; padding:14px 18px; display:flex; align-items:center; gap:12px; }
  .dphead.rest { background:#3f6fc4; }
  .dphead .dnum { background:rgba(255,255,255,0.22); font-size:11px; font-weight:800; letter-spacing:1px; padding:4px 10px; border-radius:12px;}
  .dphead .dttl { font-weight:700; font-size:16px; }
  .dphead .dtrain { margin-left:auto; font-size:13px; opacity:.92; text-align:right;}
  .dpbody { padding:18px; }
  .mini-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; }
  .mini { background:#faf8f2; border:1px solid #efe9dc; border-radius:10px; padding:10px; text-align:center; }
  .mini .mv { font-size:17px; font-weight:800; font-family:'DM Mono',monospace; }
  .mini .ml { font-size:9px; color:#9a9484; letter-spacing:0.5px; text-transform:uppercase; margin-top:2px; }
  @media(max-width:640px){ .mini-grid{grid-template-columns:repeat(2,1fr);} }
  .lbl2 { font-size:11px; letter-spacing:1px; color:#a89a78; text-transform:uppercase; font-weight:700; margin:16px 0 6px; }
  .ex-line { display:flex; justify-content:space-between; padding:7px 0; border-bottom:1px solid #f0ece2; font-size:13px; }
  .ex-line:last-child{border-bottom:none;} .ex-line .en{color:#3a352c; font-weight:600;} .ex-line .ed{color:#867f70;}
  .two-col { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
  @media(max-width:560px){ .two-col{grid-template-columns:1fr;} }
  .balance { background:#faf8f2; border:1px solid #efe9dc; border-radius:12px; padding:4px 14px; }
  .bt { font-size:11px; font-weight:800; letter-spacing:1px; text-transform:uppercase; color:#867f70; padding:10px 0 2px;}
  .br { display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #f0ece2; font-size:13px;}
  .br:last-child{border-bottom:none;} .br .l{color:#867f70;} .br .v{font-weight:600;color:#3a352c;font-family:'DM Mono',monospace;}
  .br.hl .l,.br.hl .v{color:#a07d28;font-weight:800;} .br.fin .l,.br.fin .v{color:#2f8a60;font-weight:800;font-size:15px;}
  .br.lost { border-top:1px solid #e8e2d4; } .br.lost .l{color:#a89a78;font-size:12px;} .br.lost .v{color:#8a7d5c;font-family:'DM Mono',monospace;font-weight:700;}
  .empty-detail { text-align:center; color:#a89a78; font-size:14px; padding:30px; background:#faf8f2; border-radius:14px; border:1px dashed #e2ddd2;}
  .cal-note { font-size:12px; color:#867f70; margin-top:10px; }
  .ex-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
  @media(max-width:640px){ .ex-grid{ grid-template-columns:repeat(2,1fr);} }
  .ex { background:#faf8f2; border:1px solid #efe9dc; border-radius:14px; padding:16px; }
  .ex .icon { font-size:22px; } .ex .name { font-size:13px; font-weight:700; color:#1c1a16; margin-top:6px; }
  .ex .big { font-size:22px; font-weight:800; font-family:'DM Mono',monospace; color:#a07d28; margin-top:6px; }
  .ex .meta { font-size:12px; color:#867f70; margin-top:3px; }
  .ex-total { background:#2a2722; color:#fff; border:none; } .ex-total .name,.ex-total .meta{color:#d8d0c0;} .ex-total .big{color:#fff;}
  .footer { text-align:center; color:#a89a78; font-size:12px; margin-top:6px; }
</style>
</head>
<body>
<div class="wrap">

  <div class="card">
    <div class="tag">Project Revenge Body · Phase 1</div>
    <h1>The Dashboard</h1>
    <div class="sub">Cut to ~15% body fat · Phase 1 ends July 24 (30th birthday)</div>
    <div class="hero">
      <div class="stat"><div class="v green">${lastWt}</div><div class="l">Current (fasted)</div><div class="d">from ${START} start</div></div>
      <div class="stat"><div class="v green">−${lost}</div><div class="l">Pounds Lost</div><div class="d">from ${ANCHOR_WT} (Day 5)</div></div>
      <div class="stat"><div class="v">${daysDone}</div><div class="l">Days Done</div><div class="d">Phase 1</div></div>
      <div class="stat"><div class="v gold">${toJul24}</div><div class="l">Days to 7/24</div><div class="d">Phase 1 end</div></div>
      <div class="stat"><div class="v">${avgCal.toLocaleString()}</div><div class="l">Avg Cal</div><div class="d">~2,300 target</div></div>
      <div class="stat"><div class="v">${avgPro}g</div><div class="l">Avg Protein</div><div class="d">180g target</div></div>
    </div>
  </div>

  <div class="card">
    <div class="section-label">Weight — Actual vs Expected</div>
    <div class="toggle-row" id="wToggles">
      <button class="active wt-tog" data-series="actual" style="--c:#2f8a60" onclick="toggleSeries(this)"><span class="dot" style="background:#2f8a60;"></span>Actual</button>
      <button class="active wt-tog" data-series="cons" style="--c:#b8923a" onclick="toggleSeries(this)"><span class="dot" style="background:#b8923a;"></span>Expected — Conservative</button>
      <button class="active wt-tog" data-series="real" style="--c:#3f6fc4" onclick="toggleSeries(this)"><span class="dot" style="background:#3f6fc4;"></span>Expected — Real</button>
      <button class="active wt-tog" data-series="check" style="--c:#b3ab98" onclick="toggleSeries(this)"><span style="color:#b3ab98;font-size:13px;">▲</span>Start checkpoint</button>
    </div>
    <div class="chart-box"><canvas id="weightChart"></canvas></div>
    <div class="chart-note">Tap the buttons above to show/hide each line. Gray triangle is your start checkpoint (180.4). Tracking begins Day 5 (177.0 fasted). Expected lines project fat loss from logged deficits; dotted tails forecast a few days ahead.</div>
  </div>

  <div class="card">
    <div class="section-label">Nutrition</div>
    <div class="toggle-row" style="justify-content:space-between;">
      <div style="display:flex;gap:8px;">
        <button class="active" onclick="showNutri('cal',this)">Calories</button>
        <button onclick="showNutri('pro',this)">Protein</button>
        <button onclick="showNutri('macro',this)">Carbs / Fat</button>
      </div>
      <div style="display:flex;gap:6px;" id="winToggle">
        <button class="active win-btn" data-win="7" onclick="setWindow(7,this)">7d</button>
        <button class="win-btn" data-win="14" onclick="setWindow(14,this)">14d</button>
        <button class="win-btn" data-win="all" onclick="setWindow('all',this)">All</button>
      </div>
    </div>
    <div class="chart-box"><canvas id="nutriChart"></canvas></div>
    <div class="chart-note" id="nutriNote"><b>Calories</b> against the average target (~2,300). Daily targets flex; rest days show in blue.</div>
  </div>

  <div class="card">
    <div class="section-label">Daily Deficit — Conservative Floor vs Real (likely)</div>
    <div class="chart-box"><canvas id="deficitChart"></canvas></div>
    <div class="chart-note">Conservative floor (diagnostic minimum) vs Real (mid-estimate). Each bar labeled with implied fat loss. Shares the 7d/14d/All window above.</div>
  </div>

  <div class="card">
    <div class="section-label">Calendar — tap a day for full detail</div>
    <div class="cal-weekhead"><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div><div>Sun</div></div>
    ${calendarHtml}
    <div id="detail"><div class="empty-detail">Tap any logged day above to see its macros, exercise, and full calorie-balance math.</div></div>
    <div class="cal-note">Each cell shows calories and <b>cumulative</b> est. fat lost (−conservative / −real lb) through that day.</div>
  </div>

  <div class="card">
    <div class="section-label">Exercise Totals — Phase 1 to date</div>
    <div class="ex-grid">
      <div class="ex"><div class="icon">🏋️</div><div class="name">Weight Training</div><div class="big">${fmtH(liftMin)}</div><div class="meta">${liftN} sessions</div></div>
      <div class="ex"><div class="icon">🏃</div><div class="name">Running</div><div class="big">${runMi.toFixed(2)} mi</div><div class="meta">${runN} · ${fmtH(runMin)}</div></div>
      <div class="ex"><div class="icon">🚶</div><div class="name">Walking</div><div class="big">${walkMi.toFixed(2)} mi</div><div class="meta">${walkN} · ${fmtH(walkMin)}</div></div>
      <div class="ex"><div class="icon">🚣</div><div class="name">Rowing</div><div class="big">${(rowM / 1000).toFixed(0)}k m</div><div class="meta">${rowN} · ${fmtH(rowMin)}</div></div>
      <div class="ex ex-total"><div class="icon">⏱️</div><div class="name">Total Training Time</div><div class="big">${fmtH(totMin)}</div><div class="meta">${liftN + runN + walkN + rowN} sessions · ${footMi} mi on foot</div></div>
    </div>
  </div>

  <div class="footer">Generated from data.json · Updated through Day ${last.n} (${last.date})</div>
</div>

${buildDetailPanel()}

<script>
const dayData = ${JSON.stringify(dayData)};
const gold='#b8923a', green='#2f8a60', blue='#3f6fc4', orange='#cf7a3a', restc='#9bb0c4', gridc='#efe9dc', tickc='#9a9484';
Chart.defaults.font.family="'DM Sans',sans-serif"; Chart.defaults.font.size=12; Chart.defaults.color=tickc;

let winN = 7;
function windowed(arr){ return (winN===null || arr.length<=winN) ? arr : arr.slice(-winN); }
function winDays(){ return windowed(dayData); }
function winLabels(){ return winDays().map(d=>'Day '+d.n); }

// Weight chart
const expF = ${JSON.stringify(expF)}, expR = ${JSON.stringify(expR)};
const foreF = ${JSON.stringify(foreF)}, foreR = ${JSON.stringify(foreR)};
const actual = ${JSON.stringify(actual)}, checkpoint = ${JSON.stringify(checkpoint)};
const xTicks = ${JSON.stringify(xTicks)};
const xTickLabels = ${JSON.stringify(xTickLabels)};

const weightChart=new Chart(document.getElementById('weightChart'),{ type:'line',
  data:{ datasets:[
    { label:'Actual', data:actual, borderColor:green, backgroundColor:green, pointRadius:6, pointHoverRadius:8, borderWidth:3, tension:0.2 },
    { label:'Checkpoint', data:checkpoint, borderColor:'#b3ab98', backgroundColor:'#b3ab98', pointStyle:'triangle', pointRadius:9, showLine:false },
    { label:'Expected — Conservative', data:expF, borderColor:gold, backgroundColor:gold, pointRadius:3, borderWidth:2.5, tension:0.1 },
    { label:'_fF', data:foreF, borderColor:gold, borderDash:[5,5], pointRadius:0, borderWidth:2 },
    { label:'Expected — Real', data:expR, borderColor:blue, backgroundColor:blue, pointRadius:3, borderWidth:2.5, tension:0.1 },
    { label:'_fR', data:foreR, borderColor:blue, borderDash:[5,5], pointRadius:0, borderWidth:2 },
  ]},
  options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false}, tooltip:{ filter:(i)=>!i.dataset.label.startsWith('_'), callbacks:{ title:(items)=>{const x=items[0].parsed.x; return x===4?'Start':x===${FCAST}?'+5d':'Day '+x;}, label:(c)=>c.dataset.label+': '+c.parsed.y+' lb' } } }, scales:{ y:{ min:174, max:181, grid:{color:gridc} }, x:{ type:'linear', min:4, max:${FCAST}+0.5, afterBuildTicks:axis=>{ axis.ticks=xTicks.map(v=>({value:v})); }, ticks:{ callback:v=>xTickLabels[v]??'', maxRotation:0 }, grid:{display:false} } } }
});
const seriesMap={ actual:[0], check:[1], cons:[2,3], real:[4,5] };
function toggleSeries(btn){ btn.classList.toggle('active'); const on=btn.classList.contains('active'); seriesMap[btn.dataset.series].forEach(i=>weightChart.setDatasetVisibility(i,on)); weightChart.update(); }

// Nutrition
let nutriChart, nutriMode='cal';
function buildNutri(mode){ nutriMode=mode; if(nutriChart)nutriChart.destroy(); const dd=winDays(); let datasets,target=null;
  if(mode==='cal'){ datasets=[{label:'Calories',data:dd.map(d=>d.cal),backgroundColor:dd.map(d=>d.rest?restc:gold),borderRadius:6}]; target=2300; }
  else if(mode==='pro'){ datasets=[{label:'Protein',data:dd.map(d=>d.pro),backgroundColor:green,borderRadius:6}]; target=180; }
  else { datasets=[{label:'Carbs',data:dd.map(d=>d.carb),backgroundColor:blue,borderRadius:6},{label:'Fat',data:dd.map(d=>d.fat),backgroundColor:orange,borderRadius:6}]; }
  const ann={id:'t',afterDraw:(ch)=>{ if(!target)return; const {ctx,chartArea:{left,right},scales:{y}}=ch; const yy=y.getPixelForValue(target); ctx.save(); ctx.strokeStyle='#bdb295'; ctx.setLineDash([4,5]); ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(left,yy); ctx.lineTo(right,yy); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle='#a89a78'; ctx.font='600 11px DM Sans'; ctx.fillText((mode==='cal'?'avg target ~':'target ')+target, left+6, yy-6); ctx.restore(); }};
  nutriChart=new Chart(document.getElementById('nutriChart'),{ type:'bar', data:{labels:winLabels(),datasets}, plugins:[ann], options:{responsive:true,maintainAspectRatio:false, plugins:{legend:{display:mode==='macro',position:'top'}}, scales:{ y:(mode==='cal'?{min:1800,max:2600,grid:{color:gridc},ticks:{stepSize:100}}:{beginAtZero:true,grid:{color:gridc}}), x:{grid:{display:false}} } } });
}
function showNutri(mode,btn){ btn.parentNode.querySelectorAll('button').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); buildNutri(mode); const n={cal:'<b>Calories</b> against ~2,300 avg target.',pro:'<b>Protein</b> vs 180g floor.',macro:'<b>Carbs &amp; fat</b> by day.'}; document.getElementById('nutriNote').innerHTML=n[mode]; }
buildNutri('cal');

// Deficit
const lbsLabels={ id:'lbsLabels', afterDatasetsDraw:(ch)=>{ const {ctx}=ch; ch.data.datasets.forEach((ds,di)=>{ ch.getDatasetMeta(di).data.forEach((bar,i)=>{ const cal=ds.data[i]; if(!cal)return; ctx.save(); ctx.fillStyle=di===0?'#8a7d5c':'#236b4c'; ctx.font='700 10px DM Mono'; ctx.textAlign='center'; ctx.fillText('−'+(cal/3500).toFixed(2), bar.x, bar.y-6); ctx.restore(); }); }); }};
let deficitChart;
function buildDeficit(){ if(deficitChart)deficitChart.destroy(); const dd=winDays(); deficitChart=new Chart(document.getElementById('deficitChart'),{ type:'bar', data:{ labels:winLabels(), datasets:[ {label:'Floor',data:dd.map(d=>d.defFloor),backgroundColor:'#cdbd8e',borderRadius:6}, {label:'Real',data:dd.map(d=>d.defReal),backgroundColor:green,borderRadius:6} ]}, plugins:[lbsLabels], options:{responsive:true,maintainAspectRatio:false, plugins:{legend:{position:'top'},tooltip:{callbacks:{label:(c)=>c.dataset.label+': '+c.parsed.y+' cal'}}}, scales:{ y:{beginAtZero:true,max:1200,grid:{color:gridc}}, x:{grid:{display:false}} } } }); }
buildDeficit();
function setWindow(w,btn){ winN=(w==='all')?null:w; document.querySelectorAll('#winToggle .win-btn').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); buildNutri(nutriMode); buildDeficit(); }

// Calendar / Detail
function selectDay(n,cell){ document.querySelectorAll('.cell').forEach(c=>c.classList.remove('sel')); cell.classList.add('sel'); document.querySelectorAll('[id^="detail_"]').forEach(d=>d.style.display='none'); document.getElementById('detail_'+n).style.display='block'; document.getElementById('detail').scrollIntoView({behavior:'smooth',block:'nearest'}); }
</script>
</body>
</html>`;

fs.writeFileSync('index.html', html);
console.log('✓ Dashboard generated');
