/* ══ STATE ══ */
// ✏️ SUPPRIMÉ : csvData, csvHeaders (import CSV/Excel supprimé)
let charts = {};
let budgetItems = { revenus: [], depenses: [] };

/* ══ NAVIGATION ══ */
const pageTitles = {
  home:     'Vue d\'ensemble',
  // ✏️ MODIFIÉ : 'csv' → 'retraite'
  retraite: 'Calculateur de retraite',
  analyse:  'Analyse statistique',
  graphiques:'Visualisation graphique',
  invest:   'Simulateur d\'investissement',
  budget:   'Simulateur de budget',
  compare:  'Comparaison de scénarios',
  marche:   'Marchés financiers — Temps réel'
};

function goPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(id + '-page').classList.add('active');
  document.querySelector(`[data-page="${id}"]`).classList.add('active');
  document.getElementById('page-title').textContent = pageTitles[id];
  if (id === 'analyse')   initAnalysePage();
  if (id === 'graphiques') initGraphPage();
  if (id === 'invest')    updateInvest();
  if (id === 'compare')   updateCompare();
  if (id === 'home')      refreshHome();
  if (id === 'marche')    initMarcheChart();
  // ✏️ AJOUTÉ : init retraite à la navigation
  if (id === 'retraite')  updateRetraite();
}

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => goPage(item.dataset.page));
});

/* Clock */
function updateClock() { document.getElementById('clock').textContent = new Date().toLocaleTimeString('fr-FR'); }
setInterval(updateClock, 1000); updateClock();

/* ══ CHART HELPERS ══ */
function getChartDefaults() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: '#8b8fa8', font: { family: 'Space Grotesk', size: 11 }, boxWidth: 12, padding: 16 } },
      tooltip: {
        backgroundColor: '#0f1220',
        borderColor: 'rgba(99,120,255,0.35)',
        borderWidth: 1,
        titleColor: '#8b9dff',
        bodyColor: '#8b8fa8',
        padding: 10
      }
    },
    scales: {
      x: { ticks: { color: '#4a4d63', font: { family: 'Space Grotesk', size: 10 } }, grid: { color: 'rgba(99,120,255,0.06)' } },
      y: { ticks: { color: '#4a4d63', font: { family: 'Space Grotesk', size: 10 } }, grid: { color: 'rgba(99,120,255,0.06)' } }
    }
  };
}

function destroyChart(id) { if (charts[id]) { charts[id].destroy(); delete charts[id]; } }

function fmt(n) {
  if (Math.abs(n) >= 1000000) return (n/1000000).toFixed(2)+'M€';
  if (Math.abs(n) >= 1000)    return (n/1000).toFixed(1)+'k€';
  return n.toFixed(0)+'€';
}
function formatNum(n) { return new Intl.NumberFormat('fr-FR').format(Math.round(n))+' €'; }

function generateColors(n) {
  const p = ['#6378ff','#06d6a0','#f0b429','#ff4d6d','#4895ef','#c77dff','#ff9f1c','#06b6d4','#84cc16','#f97316'];
  return Array.from({length:n},(_,i)=>p[i%p.length]);
}

function escHtml(s){ return s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }

/* ══════════════════════════════════════════
   ✏️ NOUVEAU : CALCULATEUR DE RETRAITE
   ══════════════════════════════════════════ */

/**
 * Calcule l'épargne accumulée à la retraite (intérêts composés mensuels).
 * @param {number} capitalActuel  - Capital déjà épargné
 * @param {number} epargne        - Versement mensuel
 * @param {number} tauxAnnuel     - Taux de rendement annuel (%)
 * @param {number} annees         - Durée en années
 * @returns {{ data: Array, final: number, versements: number }}
 */
function calcRetraite(capitalActuel, epargne, tauxAnnuel, annees) {
  const r = tauxAnnuel / 100 / 12;
  const n = annees * 12;
  const data = [];
  let current = capitalActuel;

  for (let m = 0; m <= n; m++) {
    if (m > 0) current = current * (1 + r) + epargne;
    if (m % 12 === 0) data.push({ year: m / 12, value: current });
  }

  const versements = capitalActuel + epargne * n;
  return { data, final: current, versements };
}

/**
 * Convertit un capital nominal en capital réel (corrigé inflation).
 */
function valeurReelle(nominal, inflation, annees) {
  return nominal / Math.pow(1 + inflation / 100, annees);
}

/**
 * Estime la rente mensuelle à partir d'un capital et d'une durée de retraite.
 * Formule de rente viagère simple (taux de retrait constant).
 */
function calcRente(capital, tauxAnnuel, dureeRetraiteAns) {
  if (dureeRetraiteAns <= 0) return 0;
  const r = tauxAnnuel / 100 / 12;
  const n = dureeRetraiteAns * 12;
  if (r === 0) return capital / n;
  // Formule annuité : PMT = PV × r / (1 − (1+r)^−n)
  return capital * r / (1 - Math.pow(1 + r, -n));
}

function updateRetraite() {
  const ageActuel     = parseInt(document.getElementById('ret-age-actuel').value);
  const ageRetraite   = parseInt(document.getElementById('ret-age-retraite').value);
  const esperance     = parseInt(document.getElementById('ret-esperance').value);
  const capitalActuel = parseFloat(document.getElementById('ret-capital-actuel').value);
  const epargne       = parseFloat(document.getElementById('ret-epargne-mensuelle').value);
  const taux          = parseFloat(document.getElementById('ret-taux').value);
  const inflation     = parseFloat(document.getElementById('ret-inflation').value);
  const objectif      = parseFloat(document.getElementById('ret-objectif').value);

  // Mise à jour labels sliders
  document.getElementById('v-age-actuel').textContent       = ageActuel + ' ans';
  document.getElementById('v-age-retraite').textContent     = ageRetraite + ' ans';
  document.getElementById('v-esperance').textContent        = esperance + ' ans';
  document.getElementById('v-capital-actuel').textContent   = formatNum(capitalActuel);
  document.getElementById('v-epargne-mensuelle').textContent = formatNum(epargne);
  document.getElementById('v-taux-ret').textContent         = taux.toFixed(1);
  document.getElementById('v-inflation').textContent        = inflation.toFixed(1);
  document.getElementById('v-objectif').textContent         = formatNum(objectif);

  const anneesEpargne  = Math.max(0, ageRetraite - ageActuel);
  const anneesRetraite = Math.max(0, esperance - ageRetraite);
  const tauxRetrait    = 4; // taux de retrait prudent pour la rente

  const { data, final, versements } = calcRetraite(capitalActuel, epargne, taux, anneesEpargne);
  const capitalReel    = valeurReelle(final, inflation, anneesEpargne);
  const renteNominale  = calcRente(final, tauxRetrait, anneesRetraite);
  const renteReelle    = valeurReelle(renteNominale, inflation, anneesEpargne);

  // KPIs
  document.getElementById('ret-capital-final').textContent = fmt(final);
  document.getElementById('ret-rente').textContent         = fmt(renteNominale) + '/m';
  document.getElementById('ret-annees').textContent        = anneesEpargne + ' ans';
  document.getElementById('ret-effort').textContent        = fmt(versements);

  // Résultats détaillés
  document.getElementById('ret-res-capital').textContent         = formatNum(final);
  document.getElementById('ret-res-capital-reel').textContent    = formatNum(capitalReel);
  document.getElementById('ret-res-rente-nominale').textContent  = formatNum(renteNominale);
  document.getElementById('ret-res-rente-reelle').textContent    = formatNum(renteReelle);

  // Progression objectif
  const pct = Math.min(100, Math.round(renteNominale / objectif * 100));
  document.getElementById('ret-progress-bar').style.width = pct + '%';
  document.getElementById('ret-progress-pct').textContent = pct + '%';
  const diff = renteNominale - objectif;
  const msgEl = document.getElementById('ret-objectif-msg');
  if (diff >= 0) {
    msgEl.innerHTML = `<span style="color:var(--teal)">✓ Objectif atteint</span> — surplus estimé de <strong style="color:var(--teal)">${formatNum(diff)}/mois</strong>`;
  } else {
    msgEl.innerHTML = `<span style="color:var(--red)">✗ Objectif non atteint</span> — manque estimé de <strong style="color:var(--red)">${formatNum(Math.abs(diff))}/mois</strong>`;
  }

  // Scénarios comparés (pessimiste / actuel / optimiste)
  const scenarios = [
    { label: 'Pessimiste', taux: Math.max(0.5, taux - 2), color: '#ff4d6d' },
    { label: 'Actuel',     taux: taux,                    color: '#6378ff' },
    { label: 'Optimiste',  taux: taux + 2,                color: '#06d6a0' },
  ];
  document.getElementById('ret-scenarios').innerHTML = scenarios.map(sc => {
    const r = calcRetraite(capitalActuel, epargne, sc.taux, anneesEpargne);
    const rente = calcRente(r.final, tauxRetrait, anneesRetraite);
    return `<div style="display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:center;background:var(--bg-3);border-radius:var(--radius-sm);padding:8px 12px">
      <span style="color:${sc.color};font-weight:600">${sc.label} <span style="color:var(--text-3);font-weight:400">(${sc.taux.toFixed(1)}%)</span></span>
      <span style="color:var(--text-1);font-weight:700;text-align:right">${fmt(r.final)}</span>
      <span style="color:var(--text-2);text-align:right">${fmt(rente)}/m</span>
    </div>`;
  }).join('');

  // Graphique
  destroyChart('retraite');
  const versedLine = data.map((d, i) => capitalActuel + epargne * 12 * i);
  const opts = getChartDefaults();
  opts.plugins.tooltip.callbacks = { label: c => `${c.dataset.label} : ${formatNum(c.raw)}` };
  charts.retraite = new Chart(document.getElementById('retraite-chart').getContext('2d'), {
    type: 'line',
    data: {
      labels: data.map(d => `${ageActuel + d.year} ans`),
      datasets: [
        {
          label: 'Capital accumulé',
          data: data.map(d => d.value),
          borderColor: '#6378ff',
          backgroundColor: 'rgba(99,120,255,0.08)',
          borderWidth: 2.5, fill: true, tension: 0.4, pointRadius: 2
        },
        {
          label: 'Versements cumulés',
          data: versedLine,
          borderColor: '#4895ef',
          borderDash: [5, 5],
          borderWidth: 1.5, fill: false, tension: 0, pointRadius: 0
        },
        {
          label: 'Capital réel (inflation)',
          data: data.map((d, i) => valeurReelle(d.value, inflation, i)),
          borderColor: '#06d6a0',
          borderDash: [3, 3],
          borderWidth: 1.5, fill: false, tension: 0.4, pointRadius: 0
        }
      ]
    },
    options: opts
  });

  // Sync home KPI
  document.getElementById('home-retraite').textContent = fmt(final);
  saveLocal('retraiteResult', { final, renteNominale });
}
/* ══ FIN CALCULATEUR RETRAITE ══ */


/* ══ ANALYSE ══ (inchangé, mais redirige vers retraite si pas de données) */
function initAnalysePage() {
  // Sans données CSV, la page affiche le message "aucune donnée"
  document.getElementById('no-data-msg').style.display  = 'block';
  document.getElementById('analyse-content').style.display = 'none';
}

function runAnalyse() { /* conservé pour compatibilité — non utilisé */ }

/* ══ GRAPHIQUES ══ (inchangé) */
function initGraphPage() {
  document.getElementById('no-data-msg2').style.display   = 'block';
  document.getElementById('graphiques-content').style.display = 'none';
}
function renderGraphs() { /* conservé pour compatibilité — non utilisé */ }

/* ══ INVESTISSEMENT ══ (inchangé) */
function calcInvest(capital, monthly, rate, years) {
  const r = rate / 100 / 12, n = years * 12;
  let data = [], current = capital;
  for (let m = 0; m <= n; m++) {
    if (m > 0) current = current * (1 + r) + monthly;
    if (m % 12 === 0) data.push({ year: m / 12, value: current });
  }
  const final = current, versed = capital + monthly * n, gains = final - versed;
  return { final, versed, gains, data };
}

function updateInvest() {
  const capital  = parseFloat(document.getElementById('r-capital').value);
  const monthly  = parseFloat(document.getElementById('r-monthly').value);
  const rate     = parseFloat(document.getElementById('r-rate').value);
  const years    = parseInt(document.getElementById('r-years').value);
  document.getElementById('v-capital').textContent = formatNum(capital);
  document.getElementById('v-monthly').textContent = formatNum(monthly);
  document.getElementById('v-rate').textContent    = rate.toFixed(1);
  document.getElementById('v-years').textContent   = years;
  const { final, versed, gains, data } = calcInvest(capital, monthly, rate, years);
  document.getElementById('res-final').textContent  = formatNum(final);
  document.getElementById('res-gains').textContent  = formatNum(gains);
  document.getElementById('res-versed').textContent = formatNum(versed);
  document.getElementById('res-ratio').textContent  = (final / versed).toFixed(2) + '×';
  const pctV = Math.round(versed / final * 100), pctG = 100 - pctV;
  document.getElementById('bar-versed').style.width  = pctV + '%';
  document.getElementById('bar-gains2').style.width  = pctG + '%';
  document.getElementById('pct-versed').textContent  = pctV + '%';
  document.getElementById('pct-gains').textContent   = pctG + '%';

  destroyChart('invest');
  const versedLine = data.map((d, i) => capital + monthly * 12 * i);
  const opts = getChartDefaults();
  opts.plugins.tooltip.callbacks = { label: c => `${c.dataset.label}: ${formatNum(c.raw)}` };
  charts.invest = new Chart(document.getElementById('invest-chart').getContext('2d'), {
    type: 'line',
    data: {
      labels: data.map(d => `An ${d.year}`),
      datasets: [
        { label: 'Capital total',  data: data.map(d => d.value), borderColor: '#6378ff', backgroundColor: 'rgba(99,120,255,0.08)', borderWidth: 2.5, fill: true,  tension: 0.4, pointRadius: 2 },
        { label: 'Capital versé',  data: versedLine,              borderColor: '#4895ef', borderDash: [5,5],                         borderWidth: 1.5, fill: false, tension: 0,   pointRadius: 0 }
      ]
    },
    options: opts
  });
  saveLocal('investResult', { final, gains });
  document.getElementById('home-capital').textContent = fmt(final);
  document.getElementById('home-gains').textContent   = fmt(gains);
  updateHomeChart(data, versedLine.map((v, i) => ({ year: data[i]?.year || i, value: v })));
}

function updateHomeChart(investData, versedData) {
  destroyChart('home');
  const opts = getChartDefaults();
  opts.plugins.tooltip.callbacks = { label: c => `${c.dataset.label}: ${formatNum(c.raw)}` };
  charts.home = new Chart(document.getElementById('home-chart').getContext('2d'), {
    type: 'line',
    data: {
      labels: investData.map(d => `An ${d.year}`),
      datasets: [
        { label: 'Capital',  data: investData.map(d => d.value), borderColor: '#6378ff', backgroundColor: 'rgba(99,120,255,0.08)', fill: true,  tension: 0.4, borderWidth: 2,   pointRadius: 0 },
        { label: 'Versé',    data: versedData.map(d => d.value), borderColor: '#4895ef', borderDash: [4,4],                         fill: false, tension: 0,   borderWidth: 1.5, pointRadius: 0 }
      ]
    },
    options: opts
  });
}

/* ══ BUDGET ══ (inchangé) */
function addRevenu(label='Salaire', montant=2000)  { budgetItems.revenus.push({label,montant});   renderBudget(); }
function addDepense(label='Loyer',  montant=800)   { budgetItems.depenses.push({label,montant});  renderBudget(); }

function renderBudget() {
  renderBudgetList('revenus-list',  'revenus');
  renderBudgetList('depenses-list', 'depenses');
  updateBudgetSummary();
}

function renderBudgetList(containerId, type) {
  document.getElementById(containerId).innerHTML = budgetItems[type].map((item,i) => budgetRow(item,i,type)).join('');
}

function budgetRow(item, i, type) {
  return `<div class="budget-row-item">
    <input class="form-input" style="flex:2" value="${escHtml(String(item.label))}"
      onchange="budgetItems['${type}'][${i}].label=this.value;updateBudgetSummary()"
      onkeydown="if(event.key==='Enter')this.blur()">
    <input class="form-input" type="number" style="flex:1" value="${item.montant}"
      onchange="budgetItems['${type}'][${i}].montant=parseFloat(this.value)||0;updateBudgetSummary()"
      onkeydown="if(event.key==='Enter')this.blur()">
    <button class="btn btn-outline" style="padding:8px 10px;flex-shrink:0" onclick="budgetItems['${type}'].splice(${i},1);renderBudget()">✕</button>
  </div>`;
}

function updateBudgetSummary() {
  const totalR = budgetItems.revenus.reduce((s,x)  => s+(parseFloat(x.montant)||0), 0);
  const totalD = budgetItems.depenses.reduce((s,x) => s+(parseFloat(x.montant)||0), 0);
  const ral = totalR - totalD;
  document.getElementById('b-revenus').textContent  = formatNum(totalR);
  document.getElementById('b-depenses').textContent = formatNum(totalD);
  const ralEl = document.getElementById('b-ral');
  ralEl.textContent  = formatNum(ral);
  ralEl.style.color  = ral >= 0 ? 'var(--green)' : 'var(--red)';
  document.getElementById('home-ral').textContent = fmt(ral);

  const colors = generateColors(budgetItems.depenses.length);
  destroyChart('budget-pie');
  if (budgetItems.depenses.length) {
    charts['budget-pie'] = new Chart(document.getElementById('budget-pie').getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: budgetItems.depenses.map(x => x.label),
        datasets: [{ data: budgetItems.depenses.map(x => parseFloat(x.montant)||0), backgroundColor: colors.map(c=>c+'cc'), borderColor: colors, borderWidth: 1.5 }]
      },
      options: {
        responsive:true, maintainAspectRatio:false, cutout:'55%',
        plugins: {
          legend:  { labels: { color:'#8b8fa8', font:{family:'Space Grotesk',size:10}, boxWidth:10 } },
          tooltip: { backgroundColor:'#0f1220', borderColor:'rgba(99,120,255,0.35)', borderWidth:1, titleColor:'#8b9dff', bodyColor:'#8b8fa8', padding:10 }
        }
      }
    });
  }

  document.getElementById('budget-bars').innerHTML = budgetItems.depenses.map((item,i) => {
    const pct = totalR > 0 ? Math.min(100, (parseFloat(item.montant)||0) / totalR * 100) : 0;
    return `<div>
      <div style="display:flex;justify-content:space-between;font-size:0.72rem;color:var(--text-2);margin-bottom:4px">
        <span>${escHtml(String(item.label))}</span><span style="color:${colors[i]};font-weight:600">${formatNum(parseFloat(item.montant)||0)}</span>
      </div>
      <div class="budget-bar-wrap"><div class="budget-bar" style="width:${pct}%;background:${colors[i]}"></div></div>
    </div>`;
  }).join('');

  saveLocal('budget', budgetItems);
}

function initBudget() {
  const saved = loadLocal('budget');
  if (saved) budgetItems = saved;
  else {
    budgetItems.revenus  = [{ label:'Salaire',      montant:2500 }];
    budgetItems.depenses = [
      { label:'Loyer',        montant:800  },
      { label:'Courses',      montant:300  },
      { label:'Transport',    montant:150  },
      { label:'Abonnements',  montant:50   }
    ];
  }
  renderBudget();
}

/* ══ COMPARAISON ══ (inchangé) */
function updateCompare() {
  const g = id => parseFloat(document.getElementById(id).value) || 0;
  const A = calcInvest(g('ca-capital'), g('ca-monthly'), g('ca-rate'), g('ca-years'));
  const B = calcInvest(g('cb-capital'), g('cb-monthly'), g('cb-rate'), g('cb-years'));
  document.getElementById('ca-result').textContent = formatNum(A.final);
  document.getElementById('cb-result').textContent = formatNum(B.final);
  const maxYears = Math.max(g('ca-years'), g('cb-years'));
  const yearsArr = Array.from({ length: Math.floor(maxYears) + 1 }, (_, i) => i);
  const cy = (cap, mo, rate, yr) => { const r = rate/100/12; let v=cap; for(let m=0;m<yr*12;m++) v=v*(1+r)+mo; return v; };
  destroyChart('compare');
  const opts = getChartDefaults();
  opts.plugins.tooltip.callbacks = { label: c => `${c.dataset.label}: ${formatNum(c.raw)}` };
  charts.compare = new Chart(document.getElementById('compare-chart').getContext('2d'), {
    type: 'line',
    data: {
      labels: yearsArr.map(y => `An ${y}`),
      datasets: [
        { label:'Scénario A', data:yearsArr.map(y=>cy(g('ca-capital'),g('ca-monthly'),g('ca-rate'),y)), borderColor:'#4895ef', backgroundColor:'rgba(72,149,239,0.06)', fill:true, tension:0.4, borderWidth:2.5, pointRadius:0 },
        { label:'Scénario B', data:yearsArr.map(y=>cy(g('cb-capital'),g('cb-monthly'),g('cb-rate'),y)), borderColor:'#c77dff', backgroundColor:'rgba(199,125,255,0.06)', fill:true, tension:0.4, borderWidth:2.5, pointRadius:0 }
      ]
    },
    options: opts
  });
}

/* ══ LOCAL STORAGE ══ */
function saveLocal(key, val) { try { localStorage.setItem('datainvest_' + key, JSON.stringify(val)); } catch(e) {} }
function loadLocal(key)       { try { const v = localStorage.getItem('datainvest_' + key); return v ? JSON.parse(v) : null; } catch(e) { return null; } }

/* ══ HOME ══ */
function refreshHome() {
  const inv = loadLocal('investResult');
  if (inv) {
    document.getElementById('home-capital').textContent = fmt(inv.final);
    document.getElementById('home-gains').textContent   = fmt(inv.gains);
  }
  // ✏️ MODIFIÉ : remplace les lignes CSV par le capital retraite
  const ret = loadLocal('retraiteResult');
  if (ret) {
    document.getElementById('home-retraite').textContent = fmt(ret.final);
  }
}

/* ══ ALERTS ══ */
function showAlert(id, msg) { const el=document.getElementById(id); const mid=id+'-msg'; if(document.getElementById(mid)) document.getElementById(mid).textContent=msg; el.classList.add('show'); }
function hideAlert(id)       { const el=document.getElementById(id); if(el) el.classList.remove('show'); }

/* ══ MARCHÉS ══ (inchangé) */
let tvCurrentSymbol = 'FOREXCOM:SPXUSD', tvReady = false;

function initMarcheChart() {
  if (tvReady) return; tvReady = true;
  if (window.TradingView) { renderTVChart(tvCurrentSymbol); }
  else {
    const s = document.createElement('script');
    s.src = 'https://s3.tradingview.com/tv.js';
    s.onload = () => renderTVChart(tvCurrentSymbol);
    document.head.appendChild(s);
  }
}

function renderTVChart(symbol) {
  const c = document.getElementById('tv-chart-container');
  c.innerHTML = '<div id="tv_inner" style="height:100%"></div>';
  new TradingView.widget({ autosize:true, symbol, interval:'D', timezone:'Europe/Paris', theme:'dark', style:'1', locale:'fr', toolbar_bg:'#0a0d16', enable_publishing:false, withdateranges:true, hide_side_toolbar:false, allow_symbol_change:true, save_image:false, container_id:'tv_inner' });
}

function setSymbol(symbol) { tvCurrentSymbol=symbol; tvReady=true; if(window.TradingView) renderTVChart(symbol); }

/* ══ INIT ══ */
function init() {
  initBudget();
  updateInvest();
  // ✏️ AJOUTÉ : initialise les valeurs de la page retraite dès le démarrage
  updateRetraite();
  refreshHome();
}
init();