/* ══ STATE ══ */
let charts = {};
let budgetItems = { revenus: [], depenses: [] };
let _rendTaux = 7;
let _investTabActive = 'evolution';

/* ══ NAVIGATION ══ */
const pageTitles = {
  home: 'Tableau de bord',
  invest: 'Investissement',
  retraite: 'Retraite',
  analyse: 'Patrimoine',
  budget: 'Budget',
  compare: 'Comparaison',
  marche: 'Marchés live'
};

function goPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(id + '-page').classList.add('active');
  document.querySelector(`[data-page="${id}"]`).classList.add('active');
  document.getElementById('page-title').textContent = pageTitles[id];
  requestAnimationFrame(() => {
    if (id === 'home')    refreshHome();
    if (id === 'invest')  updateInvest();
    if (id === 'retraite') updateRetraite();
    if (id === 'analyse') initPatrimoine();
    if (id === 'compare') updateCompare();
    if (id === 'marche')  initMarcheChart();
  });
}

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => goPage(item.dataset.page));
});

/* Clock */
function updateClock() {
  const t = new Date().toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit',second:'2-digit'});
  document.getElementById('clock').textContent = t;
}
setInterval(updateClock, 1000); updateClock();

/* ══ HELPERS ══ */
function fmt(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  const a = Math.abs(n);
  if (a >= 1e6) return (n/1e6).toFixed(2) + 'M€';
  if (a >= 1e3) return (n/1e3).toFixed(1) + 'k€';
  return n.toFixed(0) + '€';
}
function fmtN(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' €';
}
function fv(id) { return parseFloat(document.getElementById(id)?.value) || 0; }
function iv(id) { return parseInt(document.getElementById(id)?.value) || 0; }
function sv(id) { return document.getElementById(id)?.value || ''; }

function generateColors(n) {
  const p = ['#5b6fff','#00c9a7','#d4af37','#f24463','#4aa3e8','#b06cf8','#ff9a3c','#06b6d4','#84cc16','#f97316'];
  return Array.from({length:n},(_,i) => p[i%p.length]);
}

/* ══ CHART DEFAULTS ══
   Improved tooltips: larger text, cleaner background, no x/y axis label issues */
function chartDefaults() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',       // show all datasets at that x position
      intersect: false,    // trigger on hover anywhere in column
    },
    plugins: {
      legend: {
        labels: {
          color: '#a8b0d0',
          font: { family: 'DM Mono, monospace', size: 11 },
          boxWidth: 10,
          padding: 16,
          usePointStyle: true,
          pointStyleWidth: 8,
        }
      },
      tooltip: {
        enabled: true,
        backgroundColor: '#0b0d17',
        borderColor: 'rgba(91,111,255,0.4)',
        borderWidth: 1,
        titleColor: '#8a9bff',
        bodyColor: '#a8b0d0',
        padding: { top: 10, bottom: 10, left: 14, right: 14 },
        titleFont: { family: 'DM Mono, monospace', size: 11, weight: '600' },
        bodyFont: { family: 'DM Mono, monospace', size: 12 },
        caretSize: 6,
        cornerRadius: 8,
        boxPadding: 6,
        callbacks: {
          label: function(context) {
            let val = context.raw;
            if (typeof val === 'number') {
              return '  ' + context.dataset.label + ' : ' + fmtN(val);
            }
            return '  ' + context.dataset.label + ' : ' + val;
          }
        }
      }
    },
    scales: {
      x: {
        ticks: {
          color: '#5e6685',
          font: { family: 'DM Mono, monospace', size: 10 },
          maxRotation: 0,
          maxTicksLimit: 12,
        },
        grid: { color: 'rgba(91,111,255,0.05)' }
      },
      y: {
        ticks: {
          color: '#5e6685',
          font: { family: 'DM Mono, monospace', size: 10 },
          callback: function(value) {
            if (Math.abs(value) >= 1e6) return (value/1e6).toFixed(1) + 'M€';
            if (Math.abs(value) >= 1e3) return (value/1e3).toFixed(0) + 'k€';
            return value + '€';
          }
        },
        grid: { color: 'rgba(91,111,255,0.05)' }
      }
    }
  };
}

function destroyChart(id) { if (charts[id]) { charts[id].destroy(); delete charts[id]; } }
function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }

/* ══ LOCAL STORAGE ══ */
function saveLocal(key, val) { try { localStorage.setItem('wos_'+key, JSON.stringify(val)); } catch(e){} }
function loadLocal(key)       { try { const v=localStorage.getItem('wos_'+key); return v?JSON.parse(v):null; } catch(e){return null;} }

/* ══════════════════════════════════════════
   ENVELOPPES FISCALES
   Chaque enveloppe a des règles fiscales spécifiques
   ══════════════════════════════════════════ */
const ENVELOPES = {
  pea: {
    name: 'PEA',
    label: 'PEA — Plan d\'Épargne en Actions',
    color: 'teal',
    icon: '◉',
    description: 'Exonération totale d\'impôt après 5 ans (hors prélèvements sociaux 17,2 %). Plafond : 150 000 €.',
    // Fiscalité sur les gains uniquement
    tauxImpot: 0,        // 0% IR après 5 ans
    tauxPS: 0.172,       // 17,2% prélèvements sociaux toujours dus
    plafond: 150000,     // plafond de versements
    avantageDeduction: false,
    note: 'Idéal pour les actions européennes long terme.'
  },
  av: {
    name: 'AV',
    label: 'Assurance-vie',
    color: 'gold',
    icon: '◎',
    description: 'Abattement annuel de 4 600 € (9 200 € couple) sur les gains après 8 ans. Fiscalité 7,5% + PS 17,2% après 8 ans (< 150k€).',
    tauxImpot: 0.075,    // 7,5% après 8 ans (< 150k€ de versements)
    tauxPS: 0.172,
    plafond: Infinity,
    avantageDeduction: false,
    abattementAnnuel: 4600,
    note: 'Enveloppe très souple, transmission hors succession.'
  },
  cto: {
    name: 'CTO',
    label: 'Compte-Titres Ordinaire',
    color: 'red',
    icon: '◌',
    description: 'PFU (Flat Tax) de 30% = 12,8% IR + 17,2% PS. Pas de plafond, pas d\'avantage fiscal.',
    tauxImpot: 0.128,    // 12,8% IR
    tauxPS: 0.172,       // 17,2% PS
    plafond: Infinity,
    avantageDeduction: false,
    note: 'Flexible mais fiscalement le moins avantageux.'
  },
  per: {
    name: 'PER',
    label: 'Plan d\'Épargne Retraite',
    color: 'purple',
    icon: '◈',
    description: 'Versements déductibles du revenu imposable (jusqu\'à 10% revenus, max ~35 000€/an). Fiscalité à la sortie : IR sur capital + gains.',
    tauxImpot: 0.30,     // imposé à la sortie (TMI estimé)
    tauxPS: 0.172,
    plafond: Infinity,
    avantageDeduction: true,   // déduction à l'entrée
    note: 'Optimal si TMI élevé aujourd\'hui et plus faible à la retraite.'
  }
};

/**
 * Calcule le capital net après fiscalité selon l'enveloppe
 * @param {number} capitalBrut - capital total accumulé
 * @param {number} totalVerse  - total des versements (base)
 * @param {string} envelopeId  - 'pea' | 'av' | 'cto' | 'per'
 * @param {number} tmi         - TMI du PER si applicable (fraction, ex 0.30)
 * @param {number} years       - durée (pour savoir si avantages activés)
 * @returns {number} capital net disponible
 */
function applyEnvelopeFiscality(capitalBrut, totalVerse, envelopeId, tmi, years) {
  const env = ENVELOPES[envelopeId] || ENVELOPES.cto;
  const gainsBruts = Math.max(0, capitalBrut - totalVerse);

  if (envelopeId === 'pea') {
    // Après 5 ans : 0% IR, 17,2% PS sur gains
    const taxePS = gainsBruts * env.tauxPS;
    return capitalBrut - taxePS;
  }

  if (envelopeId === 'av') {
    // 7,5% + 17,2% PS sur gains, avec abattement annuel 4600€
    // On simplifie : abattement global sur toute la durée = 4600 * years (1 fois/an)
    const abattementTotal = (env.abattementAnnuel || 4600) * years;
    const gainsImposables = Math.max(0, gainsBruts - abattementTotal);
    const impot = gainsImposables * (env.tauxImpot + env.tauxPS);
    // Même si gains < abattement : PS reste dus
    const psMinimaux = Math.min(gainsBruts, abattementTotal) * env.tauxPS;
    return capitalBrut - impot - psMinimaux;
  }

  if (envelopeId === 'cto') {
    // PFU 30% = 12,8% + 17,2% sur gains
    const impot = gainsBruts * (env.tauxImpot + env.tauxPS);
    return capitalBrut - impot;
  }

  if (envelopeId === 'per') {
    // Avantage déduction à l'entrée (économie d'impôt sur versements)
    // + fiscalité IR+PS à la sortie sur TOUT le capital (versements + gains)
    const avantageEntree = totalVerse * (tmi || 0.30);
    const impotSortie = capitalBrut * ((tmi || 0.30) + env.tauxPS);
    return capitalBrut - impotSortie + avantageEntree;
  }

  return capitalBrut * (1 - 0.30);
}

/**
 * Affiche l'info de l'enveloppe sélectionnée
 */
function updateEnvelopeInfo(envelopeId, containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const env = ENVELOPES[envelopeId] || ENVELOPES.cto;
  el.innerHTML = `
    <span class="envelope-badge ${env.color}">${env.icon} ${env.name}</span>
    <div>${env.description}</div>
    <div style="margin-top:5px;color:var(--t3);font-size:0.68rem">${env.note}</div>
  `;
}

/* ══════════════════════════════════════════
   INVESTISSEMENT
   ══════════════════════════════════════════ */

function switchInvestTab(tab, btn) {
  _investTabActive = tab;
  document.querySelectorAll('.ct-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.chart-pane').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('pane-'+tab).classList.add('active');
  renderInvestCharts();
}

function calcCapital(capital, monthly, rateNet, years, revalor) {
  const data = [];
  let current = capital;
  let currentMonthly = monthly;
  for (let y = 0; y <= years; y++) {
    if (y > 0) {
      const r = rateNet / 100 / 12;
      for (let m = 0; m < 12; m++) current = current * (1+r) + currentMonthly;
      currentMonthly *= (1 + revalor/100);
    }
    data.push({ year: y, value: current });
  }
  return data;
}

function calcVersementsCumul(capital, monthly, years, revalor) {
  let total = capital, m = monthly;
  const data = [{year:0, value:capital}];
  for (let y = 1; y <= years; y++) {
    total += m * 12;
    m *= (1 + revalor/100);
    data.push({year: y, value: total});
  }
  return data;
}

function calcCapAt(capital, monthly, rateNet, years) {
  const r = rateNet/100/12, n = years*12;
  let v = capital;
  for (let m = 0; m < n; m++) v = v*(1+r)+monthly;
  return v;
}

function updateInvest() {
  const capital   = fv('r-capital');
  const monthly   = fv('r-monthly');
  const rate      = fv('r-rate');
  const years     = iv('r-years') || 0;
  const inflation = fv('r-inflation');
  const frais     = fv('r-frais');
  const tmi       = fv('r-tmi');  // fraction e.g. 0.128
  const revalor   = fv('r-revalor');
  const envelopeId= sv('r-envelope') || 'pea';

  const rateNet = Math.max(0, rate - frais);
  const data = calcCapital(capital, monthly, rateNet, years, revalor);
  const versData = calcVersementsCumul(capital, monthly, years, revalor);
  const finalBrut  = data[data.length-1]?.value || 0;
  const totalVerse = versData[versData.length-1]?.value || 0;
  const gainsBruts = Math.max(0, finalBrut - totalVerse);

  // Apply real envelope fiscality
  const capitalNet  = applyEnvelopeFiscality(finalBrut, totalVerse, envelopeId, tmi, years);
  const capitalReel = finalBrut / Math.pow(1 + inflation/100, years);
  const rente4      = finalBrut * 0.04 / 12;

  // Gains nets = capital net - versements
  const gainsNets = Math.max(0, capitalNet - totalVerse);

  const setText = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
  setText('res-final',  fmtN(finalBrut));
  setText('res-net',    fmtN(capitalNet));
  setText('res-reel',   fmtN(capitalReel));
  setText('res-versed', fmtN(totalVerse));
  setText('res-gains',  fmtN(gainsBruts));
  setText('res-ratio',  finalBrut > 0 && totalVerse > 0 ? (finalBrut/totalVerse).toFixed(2)+'×' : '—');
  setText('res-rente',  fmtN(rente4)+'/m');

  // Update envelope info panel
  updateEnvelopeInfo(envelopeId, 'envelope-info-box');

  // Home sync
  document.getElementById('home-capital').textContent = fmt(finalBrut);
  document.getElementById('home-gains').textContent   = fmt(gainsBruts);
  saveLocal('investResult', { final: finalBrut, gains: gainsBruts });

  renderInvestCharts();
  updateHomeChart(data, versData);
}

function renderInvestCharts() {
  const capital   = fv('r-capital');
  const monthly   = fv('r-monthly');
  const rate      = fv('r-rate');
  const years     = iv('r-years') || 0;
  const inflation = fv('r-inflation');
  const frais     = fv('r-frais');
  const revalor   = fv('r-revalor');
  const rateNet   = Math.max(0, rate - frais);

  if (years <= 0) return;

  const data     = calcCapital(capital, monthly, rateNet, years, revalor);
  const versData = calcVersementsCumul(capital, monthly, years, revalor);
  const labels   = data.map(d => `An ${d.year}`);
  const opts     = chartDefaults();

  // Évolution
  destroyChart('invest');
  charts.invest = new Chart(document.getElementById('invest-chart').getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label:'Capital total', data:data.map(d=>d.value), borderColor:'#5b6fff', backgroundColor:'rgba(91,111,255,0.07)', borderWidth:2.5, fill:true, tension:0.4, pointRadius:0, pointHoverRadius:5 },
        { label:'Versements cumulés', data:versData.map(d=>d.value), borderColor:'#4aa3e8', borderDash:[5,5], borderWidth:1.5, fill:false, tension:0, pointRadius:0, pointHoverRadius:4 },
        { label:'Capital réel (inflation)', data:data.map((d,i)=>d.value/Math.pow(1+inflation/100,i)), borderColor:'#00c9a7', borderDash:[3,3], borderWidth:1.5, fill:false, tension:0.4, pointRadius:0, pointHoverRadius:4 }
      ]
    },
    options: opts
  });

  // Multi-taux
  destroyChart('rend-multi');
  const taux_list  = [3,5,7,10,12];
  const col_list   = ['#4aa3e8','#00c9a7','#5b6fff','#d4af37','#f24463'];
  const multiOpts  = chartDefaults();
  charts['rend-multi'] = new Chart(document.getElementById('rend-multi-chart').getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: taux_list.map((t,i) => {
        const d = calcCapital(capital, monthly, Math.max(0,t-frais), years, revalor);
        return { label:`${t}%`, data:d.map(x=>x.value), borderColor:col_list[i], backgroundColor:col_list[i]+'10', borderWidth:2, fill:true, tension:0.4, pointRadius:0, pointHoverRadius:4 };
      })
    },
    options: multiOpts
  });

  // Composition (bar stacked)
  destroyChart('rend-compo');
  const vers = versData[versData.length-1]?.value || 0;
  const coOpts = chartDefaults();
  coOpts.interaction = { mode:'index', intersect:false };
  coOpts.plugins.tooltip.callbacks = {
    label: c => '  ' + c.dataset.label + ' : ' + fmtN(c.raw)
  };
  charts['rend-compo'] = new Chart(document.getElementById('rend-compo-chart').getContext('2d'), {
    type:'bar',
    data:{
      labels:['3%','5%','7%','10%'],
      datasets:[
        { label:'Versements', data:[3,5,7,10].map(()=>vers), backgroundColor:'rgba(74,163,232,0.55)', borderColor:'#4aa3e8', borderWidth:1.5, borderRadius:4 },
        { label:'Intérêts', data:[3,5,7,10].map(t=>Math.max(0,calcCapAt(capital,monthly,Math.max(0,t-frais),years)-vers)), backgroundColor:'rgba(91,111,255,0.55)', borderColor:'#5b6fff', borderWidth:1.5, borderRadius:4 }
      ]
    },
    options:{
      ...coOpts,
      scales:{
        x:{stacked:true, ticks:{color:'#5e6685',font:{family:'DM Mono, monospace',size:10}}, grid:{color:'rgba(91,111,255,0.05)'}},
        y:{stacked:true,
          ticks:{color:'#5e6685',font:{family:'DM Mono, monospace',size:10},callback:v => Math.abs(v)>=1e6?(v/1e6).toFixed(1)+'M€':Math.abs(v)>=1e3?(v/1e3).toFixed(0)+'k€':v+'€'},
          grid:{color:'rgba(91,111,255,0.05)'}}
      }
    }
  });

  // Inflation
  destroyChart('rend-inflation');
  const infOpts = chartDefaults();
  charts['rend-inflation'] = new Chart(document.getElementById('rend-inflation-chart').getContext('2d'), {
    type:'line',
    data:{
      labels,
      datasets:[
        {label:'Valeur nominale', data:data.map(d=>d.value), borderColor:'#5b6fff', backgroundColor:'rgba(91,111,255,0.07)', borderWidth:2, fill:true, tension:0.4, pointRadius:0, pointHoverRadius:5},
        {label:'Valeur réelle', data:data.map((d,i)=>d.value/Math.pow(1+inflation/100,i)), borderColor:'#d4af37', backgroundColor:'rgba(212,175,55,0.06)', borderWidth:2, fill:true, tension:0.4, pointRadius:0, pointHoverRadius:5, borderDash:[4,3]}
      ]
    },
    options:infOpts
  });

  renderRendDetail();
}

function setRendTaux(t, btn) {
  _rendTaux = t;
  document.querySelectorAll('.tb').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderRendDetail();
}

function renderRendDetail() {
  const capital = fv('r-capital'), monthly = fv('r-monthly'), frais = fv('r-frais');
  const years   = iv('r-years') || 0;
  const revalor = fv('r-revalor');
  if (years <= 0) return;

  const rateNet = Math.max(0, _rendTaux - frais);
  const data    = calcCapital(capital, monthly, rateNet, years, revalor);
  const versD   = calcVersementsCumul(capital, monthly, years, revalor);
  const labels  = data.map(d=>`An ${d.year}`);
  const dOpts   = chartDefaults();

  destroyChart('rend-detail');
  charts['rend-detail'] = new Chart(document.getElementById('rend-detail-chart').getContext('2d'), {
    type:'bar',
    data:{
      labels,
      datasets:[
        { label:'Versements cumulés', data:versD.map(d=>d.value), backgroundColor:'rgba(74,163,232,0.5)', borderColor:'#4aa3e8', borderWidth:0, borderRadius:2 },
        { label:'Intérêts générés', data:data.map((d,i)=>Math.max(0,d.value-versD[i].value)), backgroundColor:'rgba(91,111,255,0.55)', borderColor:'#5b6fff', borderWidth:0, borderRadius:2 }
      ]
    },
    options:{
      ...dOpts,
      scales:{
        x:{stacked:true, ticks:{color:'#5e6685',font:{family:'DM Mono, monospace',size:10},maxTicksLimit:12}, grid:{color:'rgba(91,111,255,0.05)'}},
        y:{stacked:true,
          ticks:{color:'#5e6685',font:{family:'DM Mono, monospace',size:10},callback:v => Math.abs(v)>=1e6?(v/1e6).toFixed(1)+'M€':Math.abs(v)>=1e3?(v/1e3).toFixed(0)+'k€':v+'€'},
          grid:{color:'rgba(91,111,255,0.05)'}}
      }
    }
  });

  const final  = data[data.length-1].value;
  const versed = versD[versD.length-1].value;
  const inter  = Math.max(0, final-versed);
  const kpiData = [
    { val:fmt(final), lbl:'Capital final', color:'var(--acc-l)' },
    { val:fmt(versed), lbl:'Total versé', color:'var(--blue)' },
    { val:fmt(inter), lbl:'Intérêts', color:'var(--teal)' },
    { val:(final>0&&versed>0?(final/versed).toFixed(2)+'×':'—'), lbl:'Multiplicateur', color:'var(--gold)' }
  ];
  document.getElementById('rend-detail-kpis').innerHTML = kpiData.map(k=>`
    <div class="dk-item">
      <div class="dk-val" style="color:${k.color}">${k.val}</div>
      <div class="dk-lbl">${k.lbl}</div>
    </div>`).join('');
}

/* ══ HOME CHART ══ */
function updateHomeChart(data, versData) {
  destroyChart('home');
  const opts = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0b0d17',
        borderColor: 'rgba(91,111,255,0.4)',
        borderWidth: 1,
        titleColor: '#8a9bff',
        bodyColor: '#a8b0d0',
        padding: { top:10, bottom:10, left:14, right:14 },
        titleFont: { family:'DM Mono, monospace', size:11 },
        bodyFont: { family:'DM Mono, monospace', size:12 },
        cornerRadius: 8,
        callbacks: {
          label: c => '  ' + fmtN(c.raw)
        }
      }
    },
    scales: {
      x: { display: false },
      y: { display: false }
    }
  };
  charts.home = new Chart(document.getElementById('home-chart').getContext('2d'), {
    type:'line',
    data:{
      labels: data.map(d=>`An ${d.year}`),
      datasets:[
        { data:data.map(d=>d.value), borderColor:'#5b6fff', backgroundColor:'rgba(91,111,255,0.12)', fill:true, tension:0.4, borderWidth:2.5, pointRadius:0, pointHoverRadius:5 },
        { data:versData.map(d=>d.value), borderColor:'#4aa3e8', borderDash:[4,4], fill:false, tension:0, borderWidth:1.5, pointRadius:0, pointHoverRadius:4 }
      ]
    },
    options: opts
  });
}

/* ══════════════════════════════════════════
   RETRAITE
   ══════════════════════════════════════════ */
function calcRetraite(capitalActuel, epargne, tauxAnnuel, annees, revalor) {
  const data = [];
  let current = capitalActuel, monthly = epargne;
  for (let y = 0; y <= annees; y++) {
    if (y > 0) {
      const r = tauxAnnuel/100/12;
      for (let m=0; m<12; m++) current = current*(1+r)+monthly;
      monthly *= (1+revalor/100);
    }
    data.push({ year: y, value: current });
  }
  const totalVersed = capitalActuel + epargne * annees * 12;
  return { data, final: current, versements: totalVersed };
}

function calcRente(capital, tauxAnnuel, dureeAns) {
  if (dureeAns <= 0 || capital <= 0) return 0;
  const r = tauxAnnuel/100/12, n = dureeAns*12;
  if (r === 0) return capital/n;
  return capital * r / (1 - Math.pow(1+r,-n));
}

function updateRetraite() {
  const ageActuel   = iv('ret-age-actuel') || 35;
  const ageRetraite = iv('ret-age-retraite') || 65;
  const esperance   = iv('ret-esperance') || 85;
  const capital     = fv('ret-capital-actuel');
  const epargne     = fv('ret-epargne-mensuelle');
  const taux        = fv('ret-taux') || 5;
  const inflation   = fv('ret-inflation') || 2;
  const revalor     = fv('ret-revalor') || 0;
  const objectif    = fv('ret-objectif') || 2000;

  const setText = (id, txt) => { const el = document.getElementById(id); if(el) el.textContent = txt; };
  setText('v-age-actuel',        ageActuel + ' ans');
  setText('v-age-retraite',      ageRetraite + ' ans');
  setText('v-esperance',         esperance + ' ans');
  setText('v-capital-actuel',    fmtN(capital));
  setText('v-epargne-mensuelle', fmtN(epargne));
  setText('v-taux-ret',          taux.toFixed(1) + ' %');
  setText('v-inflation',         inflation.toFixed(1) + ' %');
  setText('v-revalor-ret',       revalor.toFixed(1) + ' %');
  setText('v-objectif',          fmtN(objectif));

  const anneesEpargne  = Math.max(0, ageRetraite - ageActuel);
  const anneesRetraite = Math.max(0, esperance - ageRetraite);
  const tauxRetrait    = 4;

  const { data, final, versements } = calcRetraite(capital, epargne, taux, anneesEpargne, revalor);
  const capitalReel     = final / Math.pow(1+inflation/100, anneesEpargne);
  const renteNominale   = calcRente(final, tauxRetrait, anneesRetraite);
  const renteReelle     = renteNominale / Math.pow(1+inflation/100, anneesEpargne);

  setText('ret-capital-final', fmt(final));
  setText('ret-rente',         fmt(renteNominale)+'/m');
  setText('ret-annees',        anneesEpargne + ' ans');
  setText('ret-effort',        fmt(versements));
  setText('ret-res-capital',       fmtN(final));
  setText('ret-res-capital-reel',  fmtN(capitalReel));
  setText('ret-res-rente-nominale',fmtN(renteNominale));
  setText('ret-res-rente-reelle',  fmtN(renteReelle));

  const pct = objectif > 0 ? Math.min(100, Math.round(renteNominale/objectif*100)) : 0;
  document.getElementById('ret-progress-bar').style.width = pct + '%';
  setText('ret-progress-pct', pct + '%');
  const diff = renteNominale - objectif;
  const msgEl = document.getElementById('ret-objectif-msg');
  if (diff >= 0)
    msgEl.innerHTML = `<span style="color:var(--teal)">✓ Objectif atteint</span> — surplus de <strong style="color:var(--teal)">${fmtN(diff)}/mois</strong>`;
  else
    msgEl.innerHTML = `<span style="color:var(--red)">✗ Objectif non atteint</span> — manque de <strong style="color:var(--red)">${fmtN(Math.abs(diff))}/mois</strong>`;

  // Scénarios
  const scens = [
    { label:'Pessimiste', taux:Math.max(0.5, taux-2), color:'#f24463' },
    { label:'Base',       taux,                       color:'#5b6fff' },
    { label:'Optimiste',  taux:taux+2,                color:'#00c9a7' },
  ];
  document.getElementById('ret-scenarios').innerHTML = scens.map(sc => {
    const r = calcRetraite(capital, epargne, sc.taux, anneesEpargne, revalor);
    const rente = calcRente(r.final, tauxRetrait, anneesRetraite);
    return `<div style="display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:center;background:var(--bg3);border-radius:var(--r-sm);padding:9px 12px;margin-bottom:6px">
      <span style="color:${sc.color};font-weight:600;font-size:0.82rem">${sc.label} <span style="color:var(--t2);font-weight:400">(${sc.taux.toFixed(1)}%)</span></span>
      <span style="color:var(--t1);font-weight:700;font-family:var(--font-mono);font-size:0.82rem;text-align:right">${fmt(r.final)}</span>
      <span style="color:var(--t2);font-family:var(--font-mono);font-size:0.82rem;text-align:right">${fmt(rente)}/m</span>
    </div>`;
  }).join('');

  // Graphique
  destroyChart('retraite');
  const versLine = data.map(d => capital + epargne * d.year * 12);
  const opts = chartDefaults();
  charts.retraite = new Chart(document.getElementById('retraite-chart').getContext('2d'), {
    type:'line',
    data:{
      labels: data.map(d => `${ageActuel+d.year} ans`),
      datasets:[
        { label:'Capital accumulé', data:data.map(d=>d.value), borderColor:'#5b6fff', backgroundColor:'rgba(91,111,255,0.08)', borderWidth:2.5, fill:true, tension:0.4, pointRadius:0, pointHoverRadius:5 },
        { label:'Versements cumulés', data:versLine, borderColor:'#4aa3e8', borderDash:[5,5], borderWidth:1.5, fill:false, tension:0, pointRadius:0, pointHoverRadius:4 },
        { label:'Capital réel', data:data.map((d,i)=>d.value/Math.pow(1+inflation/100,i)), borderColor:'#00c9a7', borderDash:[3,3], borderWidth:1.5, fill:false, tension:0.4, pointRadius:0, pointHoverRadius:4 }
      ]
    },
    options: opts
  });

  document.getElementById('home-retraite').textContent = fmt(final);
  saveLocal('retraiteResult', { final, renteNominale });
}

/* ══════════════════════════════════════════
   PATRIMOINE
   ══════════════════════════════════════════ */
function addPatriRow(type) {
  const list = document.getElementById(`patri-${type}-list`);
  const div = document.createElement('div');
  div.className = 'patri-row';
  div.innerHTML = `
    <input class="field-input flex2" placeholder="Libellé" oninput="updatePatrimoine()">
    <input class="field-input flex1" type="number" placeholder="0" value="0" oninput="updatePatrimoine()" style="padding-right:12px">
    <button class="del-btn" onclick="this.parentElement.remove();updatePatrimoine()">✕</button>`;
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
  updatePatrimoine();
}

function updatePatrimoine() {
  const actifs  = getPatriRows('actifs');
  const passifs = getPatriRows('passifs');
  const totalA  = actifs.reduce((s,x)=>s+x.value,0);
  const totalP  = passifs.reduce((s,x)=>s+x.value,0);
  const net     = totalA - totalP;
  const txDette = totalA > 0 ? totalP/totalA*100 : 0;

  const setText = (id, txt, color) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = txt;
    if (color) el.style.color = color;
  };
  setText('patri-net',          fmt(net), net>=0 ? 'var(--teal)' : 'var(--red)');
  setText('patri-actifs-total', fmt(totalA));
  setText('patri-passifs-total',fmt(totalP));
  setText('patri-taux-dette',   txDette.toFixed(1)+'%');

  const maxRef = Math.max(totalA, totalP, 1);
  document.getElementById('patri-bar-actifs').style.width  = Math.min(100,totalA/maxRef*100)+'%';
  document.getElementById('patri-bar-passifs').style.width = Math.min(100,totalP/maxRef*100)+'%';
  setText('patri-bar-actifs-lbl',  fmtN(totalA));
  setText('patri-bar-passifs-lbl', fmtN(totalP));

  const msg = document.getElementById('patri-health-msg');
  if (txDette===0)       msg.innerHTML=`<span style="color:var(--teal)">✓ Aucune dette — patrimoine sain.</span>`;
  else if (txDette<30)   msg.innerHTML=`<span style="color:var(--teal)">✓ Endettement faible (${txDette.toFixed(1)}%) — situation confortable.</span>`;
  else if (txDette<60)   msg.innerHTML=`<span style="color:var(--gold)">⚠ Endettement modéré (${txDette.toFixed(1)}%) — à surveiller.</span>`;
  else                   msg.innerHTML=`<span style="color:var(--red)">✗ Endettement élevé (${txDette.toFixed(1)}%) — rééquilibrage conseillé.</span>`;

  const colors = generateColors(Math.max(actifs.length, passifs.length, 2));
  const pieOpts = () => ({
    responsive:true, maintainAspectRatio:false, cutout:'52%',
    plugins:{
      legend:{ labels:{color:'#a8b0d0',font:{family:'DM Mono',size:10},boxWidth:8,padding:8,usePointStyle:true} },
      tooltip:{backgroundColor:'#0b0d17',borderColor:'rgba(91,111,255,0.4)',borderWidth:1,titleColor:'#8a9bff',bodyColor:'#a8b0d0',padding:12,cornerRadius:8,bodyFont:{family:'DM Mono, monospace',size:12},callbacks:{label:c=>'  '+c.label+' : '+fmtN(c.raw)}}
    }
  });

  destroyChart('patri-actifs');
  if (actifs.length) charts['patri-actifs'] = new Chart(document.getElementById('patri-actifs-chart').getContext('2d'),{type:'doughnut',data:{labels:actifs.map(x=>x.label),datasets:[{data:actifs.map(x=>x.value),backgroundColor:colors.slice(0,actifs.length).map(c=>c+'cc'),borderColor:colors.slice(0,actifs.length),borderWidth:1.5}]},options:pieOpts()});

  destroyChart('patri-passifs');
  const reds=['#f24463','#ff6b6b','#e63946','#c9184a'];
  if (passifs.length) charts['patri-passifs'] = new Chart(document.getElementById('patri-passifs-chart').getContext('2d'),{type:'doughnut',data:{labels:passifs.map(x=>x.label),datasets:[{data:passifs.map(x=>x.value),backgroundColor:reds.slice(0,passifs.length).map(c=>c+'cc'),borderColor:reds.slice(0,passifs.length),borderWidth:1.5}]},options:pieOpts()});

  destroyChart('patri-compare');
  const bOpts = chartDefaults();
  bOpts.plugins.legend = { display: false };
  charts['patri-compare'] = new Chart(document.getElementById('patri-compare-chart').getContext('2d'),{type:'bar',data:{labels:['Actifs','Passifs','Net'],datasets:[{data:[totalA,totalP,Math.max(0,net)],backgroundColor:['rgba(0,201,167,0.4)','rgba(242,68,99,0.4)','rgba(91,111,255,0.4)'],borderColor:['#00c9a7','#f24463','#5b6fff'],borderWidth:1.5,borderRadius:6}]},options:bOpts});
}

/* ══════════════════════════════════════════
   BUDGET
   ══════════════════════════════════════════ */
function addRevenu(label='Salaire', montant='') { budgetItems.revenus.push({label,montant}); renderBudget(); }
function addDepense(label='Dépense', montant='') { budgetItems.depenses.push({label,montant}); renderBudget(); }

function renderBudget() {
  renderBudgetList('revenus-list','revenus');
  renderBudgetList('depenses-list','depenses');
  updateBudgetSummary();
}
function renderBudgetList(cid, type) {
  document.getElementById(cid).innerHTML = budgetItems[type].map((item,i)=>budgetRow(item,i,type)).join('');
}
function budgetRow(item, i, type) {
  return `<div class="budget-row-item">
    <input class="field-input" style="flex:2" value="${escHtml(String(item.label))}"
      onchange="budgetItems['${type}'][${i}].label=this.value;updateBudgetSummary()" onkeydown="if(event.key==='Enter')this.blur()">
    <input class="field-input" type="number" style="flex:1;padding-right:12px" value="${item.montant}"
      placeholder="0"
      onchange="budgetItems['${type}'][${i}].montant=parseFloat(this.value)||0;updateBudgetSummary()" onkeydown="if(event.key==='Enter')this.blur()">
    <button class="del-btn" onclick="budgetItems['${type}'].splice(${i},1);renderBudget()">✕</button>
  </div>`;
}
function updateBudgetSummary() {
  const totalR = budgetItems.revenus.reduce((s,x)=>s+(parseFloat(x.montant)||0),0);
  const totalD = budgetItems.depenses.reduce((s,x)=>s+(parseFloat(x.montant)||0),0);
  const ral = totalR - totalD;
  const setText = (id, txt) => { const el = document.getElementById(id); if(el) el.textContent = txt; };
  setText('b-revenus',  fmtN(totalR));
  setText('b-depenses', fmtN(totalD));
  const ralEl = document.getElementById('b-ral');
  if (ralEl) { ralEl.textContent = fmtN(ral); ralEl.style.color = ral>=0?'var(--teal)':'var(--red)'; }
  document.getElementById('home-ral').textContent = fmt(ral);

  const colors = generateColors(budgetItems.depenses.length);
  destroyChart('budget-pie');
  if (budgetItems.depenses.length) {
    const pieOpts = {
      responsive:true, maintainAspectRatio:false, cutout:'55%',
      plugins:{
        legend:{labels:{color:'#a8b0d0',font:{family:'DM Mono',size:10},boxWidth:8,usePointStyle:true}},
        tooltip:{backgroundColor:'#0b0d17',borderColor:'rgba(91,111,255,0.4)',borderWidth:1,titleColor:'#8a9bff',bodyColor:'#a8b0d0',padding:12,cornerRadius:8,bodyFont:{family:'DM Mono, monospace',size:12},callbacks:{label:c=>'  '+c.label+' : '+fmtN(c.raw)}}
      }
    };
    charts['budget-pie'] = new Chart(document.getElementById('budget-pie').getContext('2d'),{type:'doughnut',data:{labels:budgetItems.depenses.map(x=>x.label),datasets:[{data:budgetItems.depenses.map(x=>parseFloat(x.montant)||0),backgroundColor:colors.map(c=>c+'cc'),borderColor:colors,borderWidth:1.5}]},options:pieOpts});
  }

  document.getElementById('budget-bars').innerHTML = budgetItems.depenses.map((item,i)=>{
    const pct = totalR>0 ? Math.min(100,(parseFloat(item.montant)||0)/totalR*100) : 0;
    return `<div class="bb-row">
      <div class="bb-head"><span>${escHtml(String(item.label))}</span><span style="color:${colors[i]};font-weight:600;font-family:var(--font-mono)">${fmtN(parseFloat(item.montant)||0)}</span></div>
      <div class="bb-track"><div class="bb-fill" style="width:${pct}%;background:${colors[i]}"></div></div>
    </div>`;
  }).join('');

  saveLocal('budget', budgetItems);
}

function initBudget() {
  const saved = loadLocal('budget');
  if (saved) budgetItems = saved;
  renderBudget();
}

/* ══════════════════════════════════════════
   COMPARAISON
   ══════════════════════════════════════════ */
function calcScenario(capital, monthly, rate, years, inflation, frais, tmiPct, revalor, envelopeId) {
  const rateNet = Math.max(0, rate - frais);
  const tmi = tmiPct / 100;

  let current = capital, m = monthly;
  const data = [{ year:0, value:capital }];
  for (let y = 1; y <= years; y++) {
    const r = rateNet/100/12;
    for (let mo=0; mo<12; mo++) current = current*(1+r)+m;
    m *= (1+revalor/100);
    data.push({ year:y, value:current });
  }
  const final = current;

  let totalVerse = capital;
  let mv = monthly;
  for (let y=0; y<years; y++) { totalVerse += mv*12; mv *= (1+revalor/100); }

  const gainsBruts = Math.max(0, final - totalVerse);
  const capitalNet = applyEnvelopeFiscality(final, totalVerse, envelopeId || 'cto', tmi, years);
  const gainsNets  = Math.max(0, capitalNet - totalVerse);
  const capitalReel = final / Math.pow(1+inflation/100, years);
  const rente = final * 0.04 / 12;

  return { data, final, totalVerse, gainsBruts, gainsNets, capitalNet, capitalReel, rente };
}

function updateCompare() {
  const g = (id) => parseFloat(document.getElementById(id)?.value) || 0;
  const gi = (id) => parseInt(document.getElementById(id)?.value) || 0;

  const envA = document.getElementById('ca-env')?.value || 'pea';
  const envB = document.getElementById('cb-env')?.value || 'pea';

  const A = calcScenario(g('ca-capital'), g('ca-monthly'), g('ca-rate'), gi('ca-years')||0, g('ca-inflation'), g('ca-frais'), g('ca-tmi'), g('ca-revalor'), envA);
  const B = calcScenario(g('cb-capital'), g('cb-monthly'), g('cb-rate'), gi('cb-years')||0, g('cb-inflation'), g('cb-frais'), g('cb-tmi'), g('cb-revalor'), envB);

  const setT = (id,val) => { const el=document.getElementById(id); if(el) el.textContent=val; };
  setT('ca-result', fmtN(A.final));
  setT('ca-net',    fmtN(A.capitalNet));
  setT('ca-reel',   fmtN(A.capitalReel));
  setT('ca-rente',  fmtN(A.rente)+'/m');
  setT('ca-versed', fmtN(A.totalVerse));
  setT('ca-gains',  fmtN(A.gainsNets));
  setT('ca-multi',  A.totalVerse>0 ? (A.final/A.totalVerse).toFixed(2)+'×':'—');

  setT('cb-result', fmtN(B.final));
  setT('cb-net',    fmtN(B.capitalNet));
  setT('cb-reel',   fmtN(B.capitalReel));
  setT('cb-rente',  fmtN(B.rente)+'/m');
  setT('cb-versed', fmtN(B.totalVerse));
  setT('cb-gains',  fmtN(B.gainsNets));
  setT('cb-multi',  B.totalVerse>0 ? (B.final/B.totalVerse).toFixed(2)+'×':'—');

  const maxYears = Math.max(gi('ca-years')||0, gi('cb-years')||0);
  if (maxYears <= 0) return;

  const labA = sv('ca-name') || 'Scénario A';
  const labB = sv('cb-name') || 'Scénario B';
  const years = Array.from({length: maxYears+1}, (_,i)=>i);
  const labels = years.map(y=>`An ${y}`);
  const opts = chartDefaults();

  destroyChart('compare');
  charts.compare = new Chart(document.getElementById('compare-chart').getContext('2d'),{type:'line',data:{labels,datasets:[
    {label:labA, data:A.data.slice(0,maxYears+1).map(d=>d.value), borderColor:'#4aa3e8', backgroundColor:'rgba(74,163,232,0.06)', fill:true, tension:0.4, borderWidth:2.5, pointRadius:0, pointHoverRadius:5},
    {label:labB, data:B.data.slice(0,maxYears+1).map(d=>d.value), borderColor:'#b06cf8', backgroundColor:'rgba(176,108,248,0.06)', fill:true, tension:0.4, borderWidth:2.5, pointRadius:0, pointHoverRadius:5}
  ]},options:opts});

  const infA = g('ca-inflation'), infB = g('cb-inflation');
  destroyChart('compare-reel');
  charts['compare-reel'] = new Chart(document.getElementById('compare-reel-chart').getContext('2d'),{type:'line',data:{labels,datasets:[
    {label:labA+' réel', data:A.data.slice(0,maxYears+1).map((d,i)=>d.value/Math.pow(1+infA/100,i)), borderColor:'#4aa3e8', borderDash:[4,3], backgroundColor:'rgba(74,163,232,0.04)', fill:true, tension:0.4, borderWidth:2, pointRadius:0, pointHoverRadius:5},
    {label:labB+' réel', data:B.data.slice(0,maxYears+1).map((d,i)=>d.value/Math.pow(1+infB/100,i)), borderColor:'#b06cf8', borderDash:[4,3], backgroundColor:'rgba(176,108,248,0.04)', fill:true, tension:0.4, borderWidth:2, pointRadius:0, pointHoverRadius:5}
  ]},options:chartDefaults()});

  destroyChart('compare-compo');
  const coOpts = chartDefaults();
  coOpts.scales.x.stacked = true; coOpts.scales.y.stacked = true;
  charts['compare-compo'] = new Chart(document.getElementById('compare-compo-chart').getContext('2d'),{type:'bar',data:{labels:[labA,labB],datasets:[
    {label:'Versements', data:[A.totalVerse, B.totalVerse], backgroundColor:'rgba(74,163,232,0.55)', borderColor:'#4aa3e8', borderWidth:1.5, borderRadius:4},
    {label:'Gains nets', data:[A.gainsNets, B.gainsNets], backgroundColor:'rgba(91,111,255,0.55)', borderColor:'#5b6fff', borderWidth:1.5, borderRadius:4}
  ]},options:{...coOpts,scales:{x:{stacked:true,...coOpts.scales.x},y:{stacked:true,...coOpts.scales.y}}}});

  destroyChart('compare-rente');
  const reOpts = chartDefaults();
  reOpts.plugins.legend = { display: false };
  charts['compare-rente'] = new Chart(document.getElementById('compare-rente-chart').getContext('2d'),{type:'bar',data:{labels:[labA,labB],datasets:[
    {data:[A.rente, B.rente], backgroundColor:['rgba(74,163,232,0.5)','rgba(176,108,248,0.5)'], borderColor:['#4aa3e8','#b06cf8'], borderWidth:2, borderRadius:8}
  ]},options:reOpts});

  const winner = (va, vb) => {
    if (va===vb) return '—';
    const w = va>vb?labA:labB;
    return `<span style="color:${w===labA?'#4aa3e8':'#b06cf8'}">▲ ${w}</span>`;
  };
  const diffs = [
    { label:'Capital brut', a:A.final, b:B.final },
    { label:'Capital net', a:A.capitalNet, b:B.capitalNet },
    { label:'Capital réel', a:A.capitalReel, b:B.capitalReel },
    { label:'Gains nets', a:A.gainsNets, b:B.gainsNets },
    { label:'Rente/m (4%)', a:A.rente, b:B.rente },
    { label:'Multiplicateur', a:A.totalVerse>0?A.final/A.totalVerse:0, b:B.totalVerse>0?B.final/B.totalVerse:0, isMult:true }
  ];
  document.getElementById('compare-delta').innerHTML = diffs.map(d=>`
    <div class="delta-item">
      <div class="delta-label">${d.label}</div>
      <div class="delta-val" style="color:${d.a>=d.b?'#4aa3e8':'#b06cf8'}">${d.isMult?(d.a-d.b).toFixed(2)+'×':fmtN(Math.abs(d.a-d.b))}</div>
      <div class="delta-winner">Avantage ${winner(d.a,d.b)}</div>
    </div>`).join('');
}

/* ══ HOME REFRESH ══ */
function refreshHome() {
  const inv = loadLocal('investResult');
  if (inv) {
    document.getElementById('home-capital').textContent = fmt(inv.final);
    document.getElementById('home-gains').textContent   = fmt(inv.gains);
  }
  const ret = loadLocal('retraiteResult');
  if (ret) document.getElementById('home-retraite').textContent = fmt(ret.final);
}

/* ══ MARCHÉS ══ */
let tvCurrentSymbol = 'FOREXCOM:SPXUSD', tvReady = false;
function initMarcheChart() {
  if (tvReady) return; tvReady = true;
  if (window.TradingView) renderTVChart(tvCurrentSymbol);
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
  new TradingView.widget({autosize:true,symbol,interval:'D',timezone:'Europe/Paris',theme:'dark',style:'1',locale:'fr',toolbar_bg:'#0b0d17',enable_publishing:false,withdateranges:true,hide_side_toolbar:false,allow_symbol_change:true,save_image:false,container_id:'tv_inner'});
}
function setSymbol(symbol, btn) {
  tvCurrentSymbol = symbol; tvReady = true;
  document.querySelectorAll('.mb').forEach(b=>b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  if (window.TradingView) renderTVChart(symbol);
}

/* ══ INIT ══ */
function init() {
  initBudget();
  refreshHome();
  updateRetraite();
  // Show envelope info on load
  updateEnvelopeInfo('pea', 'envelope-info-box');
}
init();