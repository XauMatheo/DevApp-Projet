/* ══ STATE ══ */
// ✏️ SUPPRIMÉ : csvData, csvHeaders (import CSV/Excel supprimé)
let charts = {};
let budgetItems = { revenus: [], depenses: [] };

/* ══ NAVIGATION ══ */
const pageTitles = {
  home:      'Vue d\'ensemble',
  retraite:  'Calculateur de retraite',
  analyse:   'Bilan patrimonial',
  graphiques:'Tableau de bord rendement',
  invest:    'Simulateur d\'investissement',
  budget:    'Simulateur de budget',
  compare:   'Comparaison de scénarios',
  marche:    'Marchés financiers — Temps réel'
};

function goPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(id + '-page').classList.add('active');
  document.querySelector(`[data-page="${id}"]`).classList.add('active');
  document.getElementById('page-title').textContent = pageTitles[id];
  // Defer chart drawing by one frame so the canvas is visible/sized
  requestAnimationFrame(() => {
    if (id === 'analyse')    initPatrimoine();
    if (id === 'graphiques') initRendement();
    if (id === 'invest')     updateInvest();
    if (id === 'compare')    updateCompare();
    if (id === 'home')       refreshHome();
    if (id === 'marche')     initMarcheChart();
    if (id === 'retraite')   updateRetraite();
  });
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


/* ══════════════════════════════════════════
   ONGLET ANALYSE → BILAN PATRIMONIAL
   ══════════════════════════════════════════ */

function addPatriRow(type) {
  const list = document.getElementById(`patri-${type}-list`);
  const div = document.createElement('div');
  div.className = 'patri-row';
  div.innerHTML = `
    <input class="form-input" style="flex:2" placeholder="Libellé" oninput="updatePatrimoine()">
    <input class="form-input" type="number" style="flex:1" placeholder="0" value="0" oninput="updatePatrimoine()">
    <button class="btn btn-outline" style="padding:8px 10px;flex-shrink:0" onclick="this.parentElement.remove();updatePatrimoine()">✕</button>`;
  list.appendChild(div);
  updatePatrimoine();
}

function getPatriRows(type) {
  const rows = document.querySelectorAll(`#patri-${type}-list .patri-row`);
  return Array.from(rows).map(r => {
    const inputs = r.querySelectorAll('input');
    return { label: inputs[0].value || 'Sans nom', value: parseFloat(inputs[1].value) || 0 };
  }).filter(r => r.value > 0);
}

function initPatrimoine() {
  if (!document.getElementById('patri-actifs-chart')) return;
  if (!document.getElementById('patri-row-style')) {
    const st = document.createElement('style');
    st.id = 'patri-row-style';
    st.textContent = `.patri-row{display:flex;gap:8px;align-items:center}`;
    document.head.appendChild(st);
  }
  updatePatrimoine();
}

function updatePatrimoine() {
  const actifs  = getPatriRows('actifs');
  const passifs = getPatriRows('passifs');
  const totalA  = actifs.reduce((s, x) => s + x.value, 0);
  const totalP  = passifs.reduce((s, x) => s + x.value, 0);
  const net     = totalA - totalP;
  const tauxDette = totalA > 0 ? (totalP / totalA * 100) : 0;

  document.getElementById('patri-net').textContent          = fmt(net);
  document.getElementById('patri-actifs-total').textContent = fmt(totalA);
  document.getElementById('patri-passifs-total').textContent= fmt(totalP);
  document.getElementById('patri-taux-dette').textContent   = tauxDette.toFixed(1) + '%';
  document.getElementById('patri-net').style.color          = net >= 0 ? 'var(--teal)' : 'var(--red)';

  // Jauges santé
  const maxRef = Math.max(totalA, totalP, 1);
  document.getElementById('patri-bar-actifs').style.width   = Math.min(100, totalA / maxRef * 100) + '%';
  document.getElementById('patri-bar-passifs').style.width  = Math.min(100, totalP / maxRef * 100) + '%';
  document.getElementById('patri-bar-actifs-lbl').textContent  = formatNum(totalA);
  document.getElementById('patri-bar-passifs-lbl').textContent = formatNum(totalP);

  const msg = document.getElementById('patri-health-msg');
  if (tauxDette === 0)        msg.innerHTML = `<span style="color:var(--teal)">✓ Aucune dette — patrimoine sain.</span>`;
  else if (tauxDette < 30)    msg.innerHTML = `<span style="color:var(--teal)">✓ Taux d'endettement faible (${tauxDette.toFixed(1)}%) — situation confortable.</span>`;
  else if (tauxDette < 60)    msg.innerHTML = `<span style="color:var(--gold)">⚠ Taux d'endettement modéré (${tauxDette.toFixed(1)}%) — à surveiller.</span>`;
  else                        msg.innerHTML = `<span style="color:var(--red)">✗ Taux d'endettement élevé (${tauxDette.toFixed(1)}%) — rééquilibrage conseillé.</span>`;

  const colors = generateColors(Math.max(actifs.length, passifs.length, 2));
  const pieOpts = (title) => ({
    responsive:true, maintainAspectRatio:false, cutout:'52%',
    plugins:{
      legend:{ labels:{ color:'#8b8fa8', font:{family:'Space Grotesk',size:10}, boxWidth:10, padding:10 } },
      tooltip:{ backgroundColor:'#0f1220', borderColor:'rgba(99,120,255,0.35)', borderWidth:1, titleColor:'#8b9dff', bodyColor:'#8b8fa8', padding:10,
        callbacks:{ label: c => ` ${c.label} : ${formatNum(c.raw)}` } }
    }
  });

  // Donut actifs
  destroyChart('patri-actifs');
  if (actifs.length) {
    charts['patri-actifs'] = new Chart(document.getElementById('patri-actifs-chart').getContext('2d'), {
      type:'doughnut',
      data:{ labels: actifs.map(x=>x.label), datasets:[{ data: actifs.map(x=>x.value), backgroundColor: colors.slice(0,actifs.length).map(c=>c+'cc'), borderColor: colors.slice(0,actifs.length), borderWidth:1.5 }] },
      options: pieOpts('Actifs')
    });
  }

  // Donut passifs
  destroyChart('patri-passifs');
  if (passifs.length) {
    const reds = ['#ff4d6d','#ff6b6b','#e63946','#c9184a','#ff0054'];
    charts['patri-passifs'] = new Chart(document.getElementById('patri-passifs-chart').getContext('2d'), {
      type:'doughnut',
      data:{ labels: passifs.map(x=>x.label), datasets:[{ data: passifs.map(x=>x.value), backgroundColor: reds.slice(0,passifs.length).map(c=>c+'cc'), borderColor: reds.slice(0,passifs.length), borderWidth:1.5 }] },
      options: pieOpts('Passifs')
    });
  }

  // Bar actifs vs passifs
  destroyChart('patri-compare');
  charts['patri-compare'] = new Chart(document.getElementById('patri-compare-chart').getContext('2d'), {
    type:'bar',
    data:{
      labels:['Actifs','Passifs','Patrimoine net'],
      datasets:[{ data:[totalA, totalP, Math.max(0,net)], backgroundColor:['rgba(6,214,160,0.4)','rgba(255,77,109,0.4)','rgba(99,120,255,0.4)'], borderColor:['#06d6a0','#ff4d6d','#6378ff'], borderWidth:1.5, borderRadius:6 }]
    },
    options:{ ...getChartDefaults(), plugins:{ ...getChartDefaults().plugins, legend:{display:false},
      tooltip:{ ...getChartDefaults().plugins.tooltip, callbacks:{ label: c => ` ${formatNum(c.raw)}` } } } }
  });
}

/* ══════════════════════════════════════════
   ONGLET GRAPHIQUES → TABLEAU RENDEMENT
   ══════════════════════════════════════════ */

let _rendTaux = 7;

function setRendTaux(t) { _rendTaux = t; renderRendDetail(); }

function initRendement() {
  if (!document.getElementById('rend-multi-chart')) return;
  updateRendement();
}

function updateRendement() {
  const capital   = parseFloat(document.getElementById('rend-capital').value);
  const mensuel   = parseFloat(document.getElementById('rend-mensuel').value);
  const duree     = parseInt(document.getElementById('rend-duree').value);
  const inflation = parseFloat(document.getElementById('rend-inflation').value);

  document.getElementById('rend-v-capital').textContent   = formatNum(capital);
  document.getElementById('rend-v-mensuel').textContent   = formatNum(mensuel);
  document.getElementById('rend-v-duree').textContent     = duree + ' ans';
  document.getElementById('rend-v-inflation').textContent = inflation.toFixed(1) + ' %';

  const years = Array.from({length: duree + 1}, (_, i) => i);

  // Helper : capital at year Y
  function capAt(y, taux) {
    const r = taux / 100 / 12, n = y * 12;
    let v = capital;
    for (let m = 0; m < n; m++) v = v * (1 + r) + mensuel;
    return v;
  }

  // ── Graphique 1 : multi-taux ──
  const taux_list = [3, 5, 7, 10, 12];
  const col_list  = ['#4895ef','#06d6a0','#6378ff','#f0b429','#ff4d6d'];
  destroyChart('rend-multi');
  const multiOpts = getChartDefaults();
  multiOpts.plugins.tooltip.callbacks = { label: c => ` ${c.dataset.label} : ${formatNum(c.raw)}` };
  charts['rend-multi'] = new Chart(document.getElementById('rend-multi-chart').getContext('2d'), {
    type: 'line',
    data: {
      labels: years.map(y => `An ${y}`),
      datasets: taux_list.map((t, i) => ({
        label: `${t} %`,
        data: years.map(y => capAt(y, t)),
        borderColor: col_list[i],
        backgroundColor: col_list[i] + '12',
        borderWidth: 2, fill: true, tension: 0.4, pointRadius: 0
      }))
    },
    options: multiOpts
  });

  // ── Graphique 2 : inflation ──
  destroyChart('rend-inflation');
  const infOpts = getChartDefaults();
  infOpts.plugins.tooltip.callbacks = { label: c => ` ${c.dataset.label} : ${formatNum(c.raw)}` };
  charts['rend-inflation'] = new Chart(document.getElementById('rend-inflation-chart').getContext('2d'), {
    type: 'line',
    data: {
      labels: years.map(y => `An ${y}`),
      datasets: [
        { label:'Valeur nominale', data: years.map(y => capAt(y, 7)), borderColor:'#6378ff', backgroundColor:'rgba(99,120,255,0.08)', borderWidth:2, fill:true, tension:0.4, pointRadius:0 },
        { label:'Valeur réelle',   data: years.map(y => capAt(y, 7) / Math.pow(1 + inflation/100, y)), borderColor:'#f0b429', backgroundColor:'rgba(240,180,41,0.06)', borderWidth:2, fill:true, tension:0.4, pointRadius:0, borderDash:[4,3] }
      ]
    },
    options: infOpts
  });

  // ── Graphique 3 : composition (bar groupé) ──
  destroyChart('rend-compo');
  const versements = capital + mensuel * duree * 12;
  const compoOpts  = getChartDefaults();
  compoOpts.plugins.tooltip.callbacks = { label: c => ` ${c.dataset.label} : ${formatNum(c.raw)}` };
  charts['rend-compo'] = new Chart(document.getElementById('rend-compo-chart').getContext('2d'), {
    type:'bar',
    data:{
      labels:['3 %','5 %','7 %'],
      datasets:[
        { label:'Versements', data:[versements, versements, versements], backgroundColor:'rgba(72,149,239,0.55)', borderColor:'#4895ef', borderWidth:1.5, borderRadius:4 },
        { label:'Intérêts',   data:[3,5,7].map(t => Math.max(0, capAt(duree,t) - versements)), backgroundColor:'rgba(99,120,255,0.55)', borderColor:'#6378ff', borderWidth:1.5, borderRadius:4 }
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:compoOpts.plugins.legend, tooltip:compoOpts.plugins.tooltip },
      scales:{ x:{ stacked:true, ticks:compoOpts.scales.x.ticks, grid:compoOpts.scales.x.grid }, y:{ stacked:true, ticks:compoOpts.scales.y.ticks, grid:compoOpts.scales.y.grid } }
    }
  });

  renderRendDetail();
}

function renderRendDetail() {
  const capital   = parseFloat(document.getElementById('rend-capital').value);
  const mensuel   = parseFloat(document.getElementById('rend-mensuel').value);
  const duree     = parseInt(document.getElementById('rend-duree').value);
  const years     = Array.from({length: duree + 1}, (_, i) => i);

  function capAt(y, taux) {
    const r = taux / 100 / 12, n = y * 12;
    let v = capital;
    for (let m = 0; m < n; m++) v = v * (1 + r) + mensuel;
    return v;
  }

  // Annual breakdown : capital, cumulative interest, cumulative versements
  const data = years.map(y => {
    const total    = capAt(y, _rendTaux);
    const versed   = capital + mensuel * y * 12;
    const interest = total - versed;
    return { y, total, versed, interest: Math.max(0, interest) };
  });

  destroyChart('rend-detail');
  const detOpts = getChartDefaults();
  detOpts.plugins.tooltip.callbacks = { label: c => ` ${c.dataset.label} : ${formatNum(c.raw)}` };
  charts['rend-detail'] = new Chart(document.getElementById('rend-detail-chart').getContext('2d'), {
    type:'bar',
    data:{
      labels: years.map(y => `An ${y}`),
      datasets:[
        { label:'Versements cumulés', data: data.map(d => d.versed),    backgroundColor:'rgba(72,149,239,0.5)',  borderColor:'#4895ef', borderWidth:0, borderRadius:2 },
        { label:'Intérêts générés',   data: data.map(d => d.interest),  backgroundColor:'rgba(99,120,255,0.55)', borderColor:'#6378ff', borderWidth:0, borderRadius:2 }
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:detOpts.plugins.legend, tooltip:detOpts.plugins.tooltip },
      scales:{ x:{ stacked:true, ticks:detOpts.scales.x.ticks, grid:detOpts.scales.x.grid }, y:{ stacked:true, ticks:detOpts.scales.y.ticks, grid:detOpts.scales.y.grid } }
    }
  });

  const final    = data[data.length-1].total;
  const versed   = data[data.length-1].versed;
  const interest = data[data.length-1].interest;
  document.getElementById('rend-detail-kpis').innerHTML = [
    { label:'Capital final',       val: fmt(final),                           color:'var(--accent-light)' },
    { label:'Total versé',         val: fmt(versed),                          color:'var(--blue)' },
    { label:'Intérêts générés',    val: fmt(interest),                        color:'var(--teal)' },
    { label:'Multiplicateur',      val: (final/Math.max(1,versed)).toFixed(2)+'×', color:'var(--gold)' },
  ].map(k => `<div class="result-box"><div class="result-num" style="color:${k.color}">${k.val}</div><div class="result-lbl">${k.label}</div></div>`).join('');
}

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
  updateRetraite();
  refreshHome();
}
init();