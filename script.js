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
  allocation: 'Allocation'
};

function goPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(id + '-page').classList.add('active');
  document.querySelector(`[data-page="${id}"]`).classList.add('active');
  document.getElementById('page-title').textContent = pageTitles[id];
  requestAnimationFrame(() => {
    if (id === 'home')       refreshHome();
    if (id === 'invest')     updateInvest();
    if (id === 'retraite')   updateRetraite();
    if (id === 'analyse')    initPatrimoine();
    if (id === 'compare')    updateCompare();
    if (id === 'allocation') updateAllocation();
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
  return Math.round(n) + '€';
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

/* ══ CHART DEFAULTS ══ */
function chartDefaults() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        labels: {
          color: '#a8b0d0',
          font: { family: 'DM Mono, monospace', size: 11 },
          boxWidth: 10, padding: 16, usePointStyle: true, pointStyleWidth: 8,
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
        caretSize: 6, cornerRadius: 8, boxPadding: 6,
        callbacks: {
          label: function(context) {
            let val = context.raw;
            if (typeof val === 'number') return '  ' + context.dataset.label + ' : ' + fmtN(val);
            return '  ' + context.dataset.label + ' : ' + val;
          }
        }
      }
    },
    scales: {
      x: {
        ticks: { color: '#5e6685', font: { family: 'DM Mono, monospace', size: 10 }, maxRotation: 0, maxTicksLimit: 12 },
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
   ══════════════════════════════════════════ */
const ENVELOPES = {
  pea: {
    name: 'PEA', label: 'PEA — Plan d\'Épargne en Actions', color: 'teal', icon: '◉',
    description: 'Exonération totale d\'impôt après 5 ans (hors prélèvements sociaux 17,2 %). Plafond : 150 000 €.',
    tauxImpot: 0, tauxPS: 0.172, plafond: 150000, avantageDeduction: false,
    note: 'Idéal pour les actions européennes long terme.'
  },
  av: {
    name: 'AV', label: 'Assurance-vie', color: 'gold', icon: '◎',
    description: 'Abattement annuel de 4 600 € (9 200 € couple) sur les gains après 8 ans. Fiscalité 7,5% + PS 17,2% après 8 ans (< 150k€).',
    tauxImpot: 0.075, tauxPS: 0.172, plafond: Infinity, avantageDeduction: false, abattementAnnuel: 4600,
    note: 'Enveloppe très souple, transmission hors succession.'
  },
  cto: {
    name: 'CTO', label: 'Compte-Titres Ordinaire', color: 'red', icon: '◌',
    description: 'PFU (Flat Tax) de 30% = 12,8% IR + 17,2% PS. Pas de plafond, pas d\'avantage fiscal.',
    tauxImpot: 0.128, tauxPS: 0.172, plafond: Infinity, avantageDeduction: false,
    note: 'Flexible mais fiscalement le moins avantageux.'
  },
  per: {
    name: 'PER', label: 'Plan d\'Épargne Retraite', color: 'purple', icon: '◈',
    description: 'Versements déductibles du revenu imposable (jusqu\'à 10% revenus, max ~35 000€/an). Fiscalité à la sortie : IR sur capital + gains.',
    tauxImpot: 0.30, tauxPS: 0.172, plafond: Infinity, avantageDeduction: true,
    note: 'Optimal si TMI élevé aujourd\'hui et plus faible à la retraite.'
  }
};

function applyEnvelopeFiscality(capitalBrut, totalVerse, envelopeId, tmi, years) {
  const env = ENVELOPES[envelopeId] || ENVELOPES.cto;
  const gainsBruts = Math.max(0, capitalBrut - totalVerse);
  if (envelopeId === 'pea') {
    return capitalBrut - gainsBruts * env.tauxPS;
  }
  if (envelopeId === 'av') {
    const abattementTotal = (env.abattementAnnuel || 4600) * years;
    const gainsImposables = Math.max(0, gainsBruts - abattementTotal);
    const impot = gainsImposables * (env.tauxImpot + env.tauxPS);
    const psMinimaux = Math.min(gainsBruts, abattementTotal) * env.tauxPS;
    return capitalBrut - impot - psMinimaux;
  }
  if (envelopeId === 'cto') {
    return capitalBrut - gainsBruts * (env.tauxImpot + env.tauxPS);
  }
  if (envelopeId === 'per') {
    const avantageEntree = totalVerse * (tmi || 0.30);
    const impotSortie = capitalBrut * ((tmi || 0.30) + env.tauxPS);
    return capitalBrut - impotSortie + avantageEntree;
  }
  return capitalBrut * 0.70;
}

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
  let current = capital, currentMonthly = monthly;
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
  const tmi       = fv('r-tmi');
  const revalor   = fv('r-revalor');
  const envelopeId= sv('r-envelope') || 'pea';

  const rateNet   = Math.max(0, rate - frais);
  const data      = calcCapital(capital, monthly, rateNet, years, revalor);
  const versData  = calcVersementsCumul(capital, monthly, years, revalor);
  const finalBrut  = data[data.length-1]?.value || 0;
  const totalVerse = versData[versData.length-1]?.value || 0;
  const gainsBruts = Math.max(0, finalBrut - totalVerse);
  const capitalNet  = applyEnvelopeFiscality(finalBrut, totalVerse, envelopeId, tmi, years);
  const capitalReel = finalBrut / Math.pow(1 + inflation/100, years);
  const rente4      = finalBrut * 0.04 / 12;

  const setText = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
  setText('res-final',  fmtN(finalBrut));
  setText('res-net',    fmtN(capitalNet));
  setText('res-reel',   fmtN(capitalReel));
  setText('res-versed', fmtN(totalVerse));
  setText('res-gains',  fmtN(gainsBruts));
  setText('res-ratio',  finalBrut > 0 && totalVerse > 0 ? (finalBrut/totalVerse).toFixed(2)+'×' : '—');
  setText('res-rente',  fmtN(rente4)+'/m');

  updateEnvelopeInfo(envelopeId, 'envelope-info-box');

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

  const data    = calcCapital(capital, monthly, rateNet, years, revalor);
  const versData= calcVersementsCumul(capital, monthly, years, revalor);
  const labels  = data.map(d => `An ${d.year}`);
  const opts    = chartDefaults();

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
  const taux_list = [3,5,7,10,12], col_list = ['#4aa3e8','#00c9a7','#5b6fff','#d4af37','#f24463'];
  charts['rend-multi'] = new Chart(document.getElementById('rend-multi-chart').getContext('2d'), {
    type:'line',
    data: {
      labels,
      datasets: taux_list.map((t,i) => {
        const d = calcCapital(capital, monthly, Math.max(0,t-frais), years, revalor);
        return { label:`${t}%`, data:d.map(x=>x.value), borderColor:col_list[i], backgroundColor:col_list[i]+'10', borderWidth:2, fill:true, tension:0.4, pointRadius:0, pointHoverRadius:4 };
      })
    },
    options: chartDefaults()
  });

  // Composition
  destroyChart('rend-compo');
  const vers = versData[versData.length-1]?.value || 0;
  const coOpts = chartDefaults();
  charts['rend-compo'] = new Chart(document.getElementById('rend-compo-chart').getContext('2d'), {
    type:'bar',
    data:{
      labels:['3%','5%','7%','10%'],
      datasets:[
        { label:'Versements', data:[3,5,7,10].map(()=>vers), backgroundColor:'rgba(74,163,232,0.55)', borderColor:'#4aa3e8', borderWidth:1.5, borderRadius:4 },
        { label:'Intérêts', data:[3,5,7,10].map(t=>Math.max(0,calcCapAt(capital,monthly,Math.max(0,t-frais),years)-vers)), backgroundColor:'rgba(91,111,255,0.55)', borderColor:'#5b6fff', borderWidth:1.5, borderRadius:4 }
      ]
    },
    options:{...coOpts, scales:{x:{stacked:true,ticks:{color:'#5e6685',font:{family:'DM Mono, monospace',size:10}},grid:{color:'rgba(91,111,255,0.05)'}},y:{stacked:true,ticks:{color:'#5e6685',font:{family:'DM Mono, monospace',size:10},callback:v=>Math.abs(v)>=1e6?(v/1e6).toFixed(1)+'M€':Math.abs(v)>=1e3?(v/1e3).toFixed(0)+'k€':v+'€'},grid:{color:'rgba(91,111,255,0.05)'}}}}
  });

  // Inflation
  destroyChart('rend-inflation');
  charts['rend-inflation'] = new Chart(document.getElementById('rend-inflation-chart').getContext('2d'), {
    type:'line',
    data:{labels,datasets:[
      {label:'Valeur nominale', data:data.map(d=>d.value), borderColor:'#5b6fff', backgroundColor:'rgba(91,111,255,0.07)', borderWidth:2, fill:true, tension:0.4, pointRadius:0, pointHoverRadius:5},
      {label:'Valeur réelle', data:data.map((d,i)=>d.value/Math.pow(1+inflation/100,i)), borderColor:'#d4af37', backgroundColor:'rgba(212,175,55,0.06)', borderWidth:2, fill:true, tension:0.4, pointRadius:0, pointHoverRadius:5, borderDash:[4,3]}
    ]},
    options: chartDefaults()
  });

  // Tableau d'amortissement
  renderAmortTable(capital, monthly, rateNet, years, revalor);

  renderRendDetail();
}

/* ══ TABLEAU D'AMORTISSEMENT ══ */
function renderAmortTable(capital, monthly, rateNet, years, revalor) {
  const container = document.getElementById('amort-table-container');
  if (!container) return;
  if (years <= 0 || rateNet <= 0) {
    container.innerHTML = '<p style="color:var(--t2);font-size:0.78rem;padding:12px">Renseignez un taux et une durée pour afficher le tableau.</p>';
    return;
  }

  let rows = '';
  let current = capital;
  let m = monthly;
  let totalVerse = capital;
  let totalInterets = 0;

  for (let y = 1; y <= Math.min(years, 50); y++) {
    const debut = current;
    const r = rateNet / 100 / 12;
    let interetsAnnee = 0;
    for (let mo = 0; mo < 12; mo++) {
      interetsAnnee += current * r;
      current = current * (1+r) + m;
    }
    const versementsAnnee = m * 12;
    totalVerse += versementsAnnee;
    totalInterets += interetsAnnee;
    m *= (1 + 0/100); // revalor handled in main calc
    const pctInterets = (current > 0) ? (interetsAnnee / current * 100).toFixed(1) : '0.0';

    rows += `<tr>
      <td style="color:var(--t2)">${y}</td>
      <td>${fmtN(debut)}</td>
      <td style="color:var(--blue)">${fmtN(versementsAnnee)}</td>
      <td style="color:var(--teal)">${fmtN(interetsAnnee)}</td>
      <td style="color:var(--acc-l)">${fmtN(current)}</td>
      <td style="color:var(--gold)">${pctInterets}%</td>
    </tr>`;
  }

  container.innerHTML = `
    <table class="amort-table">
      <thead>
        <tr>
          <th>Année</th>
          <th>Capital début</th>
          <th style="color:var(--blue)">Versements</th>
          <th style="color:var(--teal)">Intérêts générés</th>
          <th style="color:var(--acc-l)">Capital fin</th>
          <th style="color:var(--gold)">% intérêts</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr style="border-top:1px solid var(--border-h)">
          <td colspan="2" style="color:var(--t2);font-weight:600">Total</td>
          <td style="color:var(--blue);font-weight:700">${fmtN(totalVerse)}</td>
          <td style="color:var(--teal);font-weight:700">${fmtN(totalInterets)}</td>
          <td style="color:var(--acc-l);font-weight:700">${fmtN(current)}</td>
          <td></td>
        </tr>
      </tfoot>
    </table>`;
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
    data:{labels,datasets:[
      { label:'Versements cumulés', data:versD.map(d=>d.value), backgroundColor:'rgba(74,163,232,0.5)', borderColor:'#4aa3e8', borderWidth:0, borderRadius:2 },
      { label:'Intérêts générés', data:data.map((d,i)=>Math.max(0,d.value-versD[i].value)), backgroundColor:'rgba(91,111,255,0.55)', borderColor:'#5b6fff', borderWidth:0, borderRadius:2 }
    ]},
    options:{...dOpts,scales:{x:{stacked:true,ticks:{color:'#5e6685',font:{family:'DM Mono, monospace',size:10},maxTicksLimit:12},grid:{color:'rgba(91,111,255,0.05)'}},y:{stacked:true,ticks:{color:'#5e6685',font:{family:'DM Mono, monospace',size:10},callback:v=>Math.abs(v)>=1e6?(v/1e6).toFixed(1)+'M€':Math.abs(v)>=1e3?(v/1e3).toFixed(0)+'k€':v+'€'},grid:{color:'rgba(91,111,255,0.05)'}}}}
  });

  const final  = data[data.length-1].value;
  const versed = versD[versD.length-1].value;
  const inter  = Math.max(0, final-versed);
  document.getElementById('rend-detail-kpis').innerHTML = [
    { val:fmt(final), lbl:'Capital final', color:'var(--acc-l)' },
    { val:fmt(versed), lbl:'Total versé', color:'var(--blue)' },
    { val:fmt(inter), lbl:'Intérêts', color:'var(--teal)' },
    { val:(final>0&&versed>0?(final/versed).toFixed(2)+'×':'—'), lbl:'Multiplicateur', color:'var(--gold)' }
  ].map(k=>`<div class="dk-item"><div class="dk-val" style="color:${k.color}">${k.val}</div><div class="dk-lbl">${k.lbl}</div></div>`).join('');
}

/* ══ HOME CHART ══ */
function updateHomeChart(data, versData) {
  destroyChart('home');
  charts.home = new Chart(document.getElementById('home-chart').getContext('2d'), {
    type:'line',
    data:{
      labels: data.map(d=>`An ${d.year}`),
      datasets:[
        { data:data.map(d=>d.value), borderColor:'#5b6fff', backgroundColor:'rgba(91,111,255,0.12)', fill:true, tension:0.4, borderWidth:2.5, pointRadius:0, pointHoverRadius:5 },
        { data:versData.map(d=>d.value), borderColor:'#4aa3e8', borderDash:[4,4], fill:false, tension:0, borderWidth:1.5, pointRadius:0, pointHoverRadius:4 }
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      interaction:{ mode:'index', intersect:false },
      plugins:{
        legend:{display:false},
        tooltip:{backgroundColor:'#0b0d17',borderColor:'rgba(91,111,255,0.4)',borderWidth:1,titleColor:'#8a9bff',bodyColor:'#a8b0d0',padding:{top:10,bottom:10,left:14,right:14},titleFont:{family:'DM Mono, monospace',size:11},bodyFont:{family:'DM Mono, monospace',size:12},cornerRadius:8,callbacks:{label:c=>'  '+fmtN(c.raw)}}
      },
      scales:{x:{display:false},y:{display:false}}
    }
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
  setText('v-age-actuel', ageActuel + ' ans');
  setText('v-age-retraite', ageRetraite + ' ans');
  setText('v-esperance', esperance + ' ans');
  setText('v-capital-actuel', fmtN(capital));
  setText('v-epargne-mensuelle', fmtN(epargne));
  setText('v-taux-ret', taux.toFixed(1) + ' %');
  setText('v-inflation', inflation.toFixed(1) + ' %');
  setText('v-revalor-ret', revalor.toFixed(1) + ' %');
  setText('v-objectif', fmtN(objectif));

  const anneesEpargne  = Math.max(0, ageRetraite - ageActuel);
  const anneesRetraite = Math.max(0, esperance - ageRetraite);
  const tauxRetrait    = 4;

  const { data, final, versements } = calcRetraite(capital, epargne, taux, anneesEpargne, revalor);
  const capitalReel     = final / Math.pow(1+inflation/100, anneesEpargne);
  const renteNominale   = calcRente(final, tauxRetrait, anneesRetraite);
  const renteReelle     = renteNominale / Math.pow(1+inflation/100, anneesEpargne);

  setText('ret-capital-final', fmt(final));
  setText('ret-rente', fmt(renteNominale)+'/m');
  setText('ret-annees', anneesEpargne + ' ans');
  setText('ret-effort', fmt(versements));
  setText('ret-res-capital', fmtN(final));
  setText('ret-res-capital-reel', fmtN(capitalReel));
  setText('ret-res-rente-nominale', fmtN(renteNominale));
  setText('ret-res-rente-reelle', fmtN(renteReelle));

  const pct = objectif > 0 ? Math.min(100, Math.round(renteNominale/objectif*100)) : 0;
  document.getElementById('ret-progress-bar').style.width = pct + '%';
  setText('ret-progress-pct', pct + '%');
  const diff = renteNominale - objectif;
  const msgEl = document.getElementById('ret-objectif-msg');
  if (diff >= 0)
    msgEl.innerHTML = `<span style="color:var(--teal)">✓ Objectif atteint</span> — surplus de <strong style="color:var(--teal)">${fmtN(diff)}/mois</strong>`;
  else
    msgEl.innerHTML = `<span style="color:var(--red)">✗ Objectif non atteint</span> — manque de <strong style="color:var(--red)">${fmtN(Math.abs(diff))}/mois</strong>`;

  const scens = [
    { label:'Pessimiste', taux:Math.max(0.5, taux-2), color:'#f24463' },
    { label:'Base', taux, color:'#5b6fff' },
    { label:'Optimiste', taux:taux+2, color:'#00c9a7' },
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

  destroyChart('retraite');
  const versLine = data.map(d => capital + epargne * d.year * 12);
  charts.retraite = new Chart(document.getElementById('retraite-chart').getContext('2d'), {
    type:'line',
    data:{labels: data.map(d => `${ageActuel+d.year} ans`),datasets:[
      {label:'Capital accumulé', data:data.map(d=>d.value), borderColor:'#5b6fff', backgroundColor:'rgba(91,111,255,0.08)', borderWidth:2.5, fill:true, tension:0.4, pointRadius:0, pointHoverRadius:5},
      {label:'Versements cumulés', data:versLine, borderColor:'#4aa3e8', borderDash:[5,5], borderWidth:1.5, fill:false, tension:0, pointRadius:0, pointHoverRadius:4},
      {label:'Capital réel', data:data.map((d,i)=>d.value/Math.pow(1+inflation/100,i)), borderColor:'#00c9a7', borderDash:[3,3], borderWidth:1.5, fill:false, tension:0.4, pointRadius:0, pointHoverRadius:4}
    ]},
    options: chartDefaults()
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
  return Array.from(document.querySelectorAll(`#patri-${type}-list .patri-row`)).map(r => {
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
  setText('patri-net', fmt(net), net>=0 ? 'var(--teal)' : 'var(--red)');
  setText('patri-actifs-total', fmt(totalA));
  setText('patri-passifs-total', fmt(totalP));
  setText('patri-taux-dette', txDette.toFixed(1)+'%');

  const maxRef = Math.max(totalA, totalP, 1);
  document.getElementById('patri-bar-actifs').style.width  = Math.min(100,totalA/maxRef*100)+'%';
  document.getElementById('patri-bar-passifs').style.width = Math.min(100,totalP/maxRef*100)+'%';
  setText('patri-bar-actifs-lbl', fmtN(totalA));
  setText('patri-bar-passifs-lbl', fmtN(totalP));

  const msg = document.getElementById('patri-health-msg');
  if (txDette===0)      msg.innerHTML=`<span style="color:var(--teal)">✓ Aucune dette — patrimoine sain.</span>`;
  else if (txDette<30)  msg.innerHTML=`<span style="color:var(--teal)">✓ Endettement faible (${txDette.toFixed(1)}%) — situation confortable.</span>`;
  else if (txDette<60)  msg.innerHTML=`<span style="color:var(--gold)">⚠ Endettement modéré (${txDette.toFixed(1)}%) — à surveiller.</span>`;
  else                  msg.innerHTML=`<span style="color:var(--red)">✗ Endettement élevé (${txDette.toFixed(1)}%) — rééquilibrage conseillé.</span>`;

  const colors = generateColors(Math.max(actifs.length, passifs.length, 2));
  const pieOpts = () => ({
    responsive:true, maintainAspectRatio:false, cutout:'52%',
    plugins:{
      legend:{labels:{color:'#a8b0d0',font:{family:'DM Mono',size:10},boxWidth:8,padding:8,usePointStyle:true}},
      tooltip:{backgroundColor:'#0b0d17',borderColor:'rgba(91,111,255,0.4)',borderWidth:1,titleColor:'#8a9bff',bodyColor:'#a8b0d0',padding:12,cornerRadius:8,bodyFont:{family:'DM Mono, monospace',size:12},callbacks:{label:c=>'  '+c.label+' : '+fmtN(c.raw)}}
    }
  });

  destroyChart('patri-actifs');
  if (actifs.length) charts['patri-actifs'] = new Chart(document.getElementById('patri-actifs-chart').getContext('2d'),{type:'doughnut',data:{labels:actifs.map(x=>x.label),datasets:[{data:actifs.map(x=>x.value),backgroundColor:colors.slice(0,actifs.length).map(c=>c+'cc'),borderColor:colors.slice(0,actifs.length),borderWidth:1.5}]},options:pieOpts()});

  destroyChart('patri-passifs');
  const reds=['#f24463','#ff6b6b','#e63946','#c9184a'];
  if (passifs.length) charts['patri-passifs'] = new Chart(document.getElementById('patri-passifs-chart').getContext('2d'),{type:'doughnut',data:{labels:passifs.map(x=>x.label),datasets:[{data:passifs.map(x=>x.value),backgroundColor:reds.slice(0,passifs.length).map(c=>c+'cc'),borderColor:reds.slice(0,passifs.length),borderWidth:1.5}]},options:pieOpts()});

  destroyChart('patri-compare');
  charts['patri-compare'] = new Chart(document.getElementById('patri-compare-chart').getContext('2d'),{type:'bar',data:{labels:['Actifs','Passifs','Net'],datasets:[{data:[totalA,totalP,Math.max(0,net)],backgroundColor:['rgba(0,201,167,0.4)','rgba(242,68,99,0.4)','rgba(91,111,255,0.4)'],borderColor:['#00c9a7','#f24463','#5b6fff'],borderWidth:1.5,borderRadius:6}]},options:{...chartDefaults(),plugins:{...chartDefaults().plugins,legend:{display:false}}}});
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
  setText('b-revenus', fmtN(totalR));
  setText('b-depenses', fmtN(totalD));
  const ralEl = document.getElementById('b-ral');
  if (ralEl) { ralEl.textContent = fmtN(ral); ralEl.style.color = ral>=0?'var(--teal)':'var(--red)'; }
  document.getElementById('home-ral').textContent = fmt(ral);

  // Pie dépenses
  const colors = generateColors(budgetItems.depenses.length);
  destroyChart('budget-pie');
  if (budgetItems.depenses.length) {
    charts['budget-pie'] = new Chart(document.getElementById('budget-pie').getContext('2d'),{type:'doughnut',data:{labels:budgetItems.depenses.map(x=>x.label),datasets:[{data:budgetItems.depenses.map(x=>parseFloat(x.montant)||0),backgroundColor:colors.map(c=>c+'cc'),borderColor:colors,borderWidth:1.5}]},options:{responsive:true,maintainAspectRatio:false,cutout:'55%',plugins:{legend:{labels:{color:'#a8b0d0',font:{family:'DM Mono',size:10},boxWidth:8,usePointStyle:true}},tooltip:{backgroundColor:'#0b0d17',borderColor:'rgba(91,111,255,0.4)',borderWidth:1,titleColor:'#8a9bff',bodyColor:'#a8b0d0',padding:12,cornerRadius:8,bodyFont:{family:'DM Mono, monospace',size:12},callbacks:{label:c=>'  '+c.label+' : '+fmtN(c.raw)}}}}});
  }

  document.getElementById('budget-bars').innerHTML = budgetItems.depenses.map((item,i)=>{
    const pct = totalR>0 ? Math.min(100,(parseFloat(item.montant)||0)/totalR*100) : 0;
    return `<div class="bb-row">
      <div class="bb-head"><span>${escHtml(String(item.label))}</span><span style="color:${colors[i]};font-weight:600;font-family:var(--font-mono)">${fmtN(parseFloat(item.montant)||0)}</span></div>
      <div class="bb-track"><div class="bb-fill" style="width:${pct}%;background:${colors[i]}"></div></div>
    </div>`;
  }).join('');

  // Règle 50/30/20
  renderBudget503020(totalR, totalD, ral);

  // Projection épargne
  renderBudgetProjection(ral);

  saveLocal('budget', budgetItems);
}

/* ══ RÈGLE 50/30/20 ══ */
function renderBudget503020(totalR, totalD, ral) {
  const container = document.getElementById('budget-503020');
  if (!container) return;

  const cibles = [
    { label:'Besoins essentiels', pct:50, actual: totalR>0?(totalD/totalR*100):0, color:'#4aa3e8', desc:'Logement, alimentation, transport' },
    { label:'Loisirs & envies', pct:30, actual: totalR>0?(Math.max(0,totalD-totalR*0.5)/totalR*100):0, color:'#b06cf8', desc:'Sorties, voyages, abonnements' },
    { label:'Épargne & investissement', pct:20, actual: totalR>0?(Math.max(0,ral)/totalR*100):0, color:'#00c9a7', desc:'PEA, AV, épargne de précaution' }
  ];

  container.innerHTML = cibles.map(c => {
    const diff = c.actual - c.pct;
    const status = Math.abs(diff) < 3 ? `<span style="color:var(--teal)">✓ Dans la cible</span>` :
      diff > 0 ? `<span style="color:var(--red)">↑ +${diff.toFixed(1)}% vs cible</span>` :
                 `<span style="color:var(--gold)">↓ ${diff.toFixed(1)}% vs cible</span>`;
    return `<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r-sm);padding:14px">
      <div style="font-size:0.7rem;color:var(--t2);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">${c.label}</div>
      <div style="font-family:var(--font-head);font-size:1.3rem;font-weight:800;color:${c.color}">${c.actual.toFixed(1)}%</div>
      <div style="font-size:0.68rem;color:var(--t2);margin:2px 0 8px">Cible : ${c.pct}%</div>
      <div style="height:5px;background:var(--bg4);border-radius:3px;overflow:hidden;margin-bottom:6px">
        <div style="height:100%;width:${Math.min(100,c.actual/c.pct*100).toFixed(1)}%;background:${c.color};border-radius:3px;transition:width 0.4s"></div>
      </div>
      <div style="font-size:0.68rem">${status}</div>
    </div>`;
  }).join('');

  // Chart radar-style bar horizontal
  destroyChart('budget-503020-chart');
  const canvas = document.getElementById('budget-503020-chart');
  if (!canvas) return;
  charts['budget-503020-chart'] = new Chart(canvas.getContext('2d'), {
    type:'bar',
    data:{
      labels: cibles.map(c=>c.label),
      datasets:[
        { label:'Actuel (%)', data:cibles.map(c=>parseFloat(c.actual.toFixed(1))), backgroundColor:cibles.map(c=>c.color+'88'), borderColor:cibles.map(c=>c.color), borderWidth:1.5, borderRadius:4 },
        { label:'Cible (%)', data:cibles.map(c=>c.pct), backgroundColor:'rgba(255,255,255,0.04)', borderColor:'rgba(255,255,255,0.25)', borderWidth:1.5, borderDash:[4,4], borderRadius:4, type:'bar' }
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      interaction:{ mode:'index', intersect:false },
      plugins:{
        legend:{labels:{color:'#a8b0d0',font:{family:'DM Mono, monospace',size:11},boxWidth:10,padding:12,usePointStyle:true}},
        tooltip:{backgroundColor:'#0b0d17',borderColor:'rgba(91,111,255,0.4)',borderWidth:1,titleColor:'#8a9bff',bodyColor:'#a8b0d0',padding:12,cornerRadius:8,bodyFont:{family:'DM Mono, monospace',size:12},callbacks:{label:c=>'  '+c.dataset.label+' : '+c.raw.toFixed(1)+'%'}}
      },
      scales:{
        x:{ticks:{color:'#5e6685',font:{family:'DM Mono, monospace',size:10}},grid:{color:'rgba(91,111,255,0.05)'}},
        y:{ticks:{color:'#5e6685',font:{family:'DM Mono, monospace',size:10},callback:v=>v+'%'},grid:{color:'rgba(91,111,255,0.05)'},max:80}
      }
    }
  });
}

/* ══ PROJECTION ÉPARGNE BUDGET ══ */
function renderBudgetProjection(epargne) {
  const canvas = document.getElementById('budget-projection-chart');
  if (!canvas) return;
  if (epargne <= 0) {
    destroyChart('budget-proj');
    return;
  }

  const years = 10;
  const taux = [0, 3, 6, 9];
  const colors = ['#5e6685','#4aa3e8','#5b6fff','#00c9a7'];
  const labels = Array.from({length: years+1}, (_,i) => `An ${i}`);

  const datasets = taux.map((t,i) => {
    const data = [];
    let capital = 0;
    for (let y = 0; y <= years; y++) {
      if (y > 0) {
        const r = t/100/12;
        for (let m = 0; m < 12; m++) capital = capital*(1+r)+epargne;
      }
      data.push(capital);
    }
    return { label:`Taux ${t}%`, data, borderColor:colors[i], backgroundColor:colors[i]+'15', borderWidth:t===0?1.5:2, fill:false, tension:0.4, pointRadius:0, pointHoverRadius:4, borderDash:t===0?[4,4]:[] };
  });

  destroyChart('budget-proj');
  charts['budget-proj'] = new Chart(canvas.getContext('2d'), {
    type:'line',
    data:{ labels, datasets },
    options: chartDefaults()
  });
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
  let totalVerse = capital, mv = monthly;
  for (let y=0; y<years; y++) { totalVerse += mv*12; mv *= (1+revalor/100); }
  const gainsBruts = Math.max(0, final - totalVerse);
  const capitalNet = applyEnvelopeFiscality(final, totalVerse, envelopeId || 'cto', tmi, years);
  const gainsNets  = Math.max(0, capitalNet - totalVerse);
  const capitalReel = final / Math.pow(1+inflation/100, years);
  const rente = final * 0.04 / 12;
  return { data, final, totalVerse, gainsBruts, gainsNets, capitalNet, capitalReel, rente };
}

function updateCompare() {
  const g  = (id) => parseFloat(document.getElementById(id)?.value) || 0;
  const gi = (id) => parseInt(document.getElementById(id)?.value) || 0;

  const envA = document.getElementById('ca-env')?.value || 'pea';
  const envB = document.getElementById('cb-env')?.value || 'pea';
  const A = calcScenario(g('ca-capital'), g('ca-monthly'), g('ca-rate'), gi('ca-years')||0, g('ca-inflation'), g('ca-frais'), g('ca-tmi'), g('ca-revalor'), envA);
  const B = calcScenario(g('cb-capital'), g('cb-monthly'), g('cb-rate'), gi('cb-years')||0, g('cb-inflation'), g('cb-frais'), g('cb-tmi'), g('cb-revalor'), envB);

  const setT = (id,val) => { const el=document.getElementById(id); if(el) el.textContent=val; };
  [['ca',A],['cb',B]].forEach(([p,S]) => {
    setT(p+'-result', fmtN(S.final));
    setT(p+'-net',    fmtN(S.capitalNet));
    setT(p+'-reel',   fmtN(S.capitalReel));
    setT(p+'-rente',  fmtN(S.rente)+'/m');
    setT(p+'-versed', fmtN(S.totalVerse));
    setT(p+'-gains',  fmtN(S.gainsNets));
    setT(p+'-multi',  S.totalVerse>0?(S.final/S.totalVerse).toFixed(2)+'×':'—');
  });

  const maxYears = Math.max(gi('ca-years')||0, gi('cb-years')||0);
  if (maxYears <= 0) return;

  const labA = sv('ca-name') || 'Scénario A';
  const labB = sv('cb-name') || 'Scénario B';
  const labels = Array.from({length: maxYears+1}, (_,i)=>`An ${i}`);

  destroyChart('compare');
  charts.compare = new Chart(document.getElementById('compare-chart').getContext('2d'),{type:'line',data:{labels,datasets:[
    {label:labA, data:A.data.slice(0,maxYears+1).map(d=>d.value), borderColor:'#4aa3e8', backgroundColor:'rgba(74,163,232,0.06)', fill:true, tension:0.4, borderWidth:2.5, pointRadius:0, pointHoverRadius:5},
    {label:labB, data:B.data.slice(0,maxYears+1).map(d=>d.value), borderColor:'#b06cf8', backgroundColor:'rgba(176,108,248,0.06)', fill:true, tension:0.4, borderWidth:2.5, pointRadius:0, pointHoverRadius:5}
  ]},options:chartDefaults()});

  destroyChart('compare-reel');
  charts['compare-reel'] = new Chart(document.getElementById('compare-reel-chart').getContext('2d'),{type:'line',data:{labels,datasets:[
    {label:labA+' réel', data:A.data.slice(0,maxYears+1).map((d,i)=>d.value/Math.pow(1+g('ca-inflation')/100,i)), borderColor:'#4aa3e8', borderDash:[4,3], fill:true, tension:0.4, borderWidth:2, backgroundColor:'rgba(74,163,232,0.04)', pointRadius:0, pointHoverRadius:5},
    {label:labB+' réel', data:B.data.slice(0,maxYears+1).map((d,i)=>d.value/Math.pow(1+g('cb-inflation')/100,i)), borderColor:'#b06cf8', borderDash:[4,3], fill:true, tension:0.4, borderWidth:2, backgroundColor:'rgba(176,108,248,0.04)', pointRadius:0, pointHoverRadius:5}
  ]},options:chartDefaults()});

  destroyChart('compare-compo');
  const coOpts = chartDefaults();
  charts['compare-compo'] = new Chart(document.getElementById('compare-compo-chart').getContext('2d'),{type:'bar',data:{labels:[labA,labB],datasets:[
    {label:'Versements', data:[A.totalVerse, B.totalVerse], backgroundColor:'rgba(74,163,232,0.55)', borderColor:'#4aa3e8', borderWidth:1.5, borderRadius:4},
    {label:'Gains nets', data:[A.gainsNets, B.gainsNets], backgroundColor:'rgba(91,111,255,0.55)', borderColor:'#5b6fff', borderWidth:1.5, borderRadius:4}
  ]},options:{...coOpts,scales:{x:{stacked:true,...coOpts.scales.x},y:{stacked:true,...coOpts.scales.y}}}});

  destroyChart('compare-rente');
  charts['compare-rente'] = new Chart(document.getElementById('compare-rente-chart').getContext('2d'),{type:'bar',data:{labels:[labA,labB],datasets:[
    {data:[A.rente, B.rente], backgroundColor:['rgba(74,163,232,0.5)','rgba(176,108,248,0.5)'], borderColor:['#4aa3e8','#b06cf8'], borderWidth:2, borderRadius:8}
  ]},options:{...chartDefaults(),plugins:{...chartDefaults().plugins,legend:{display:false}}}});

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

/* ══════════════════════════════════════════
   ALLOCATION DE PORTEFEUILLE
   ══════════════════════════════════════════ */

// Données historiques estimées par classe d'actif
const ASSET_DATA = {
  actions: { label:'Actions', rendement: 9.5, volatilite: 18, color: '#5b6fff', icon:'◆' },
  oblig:   { label:'Obligations', rendement: 3.5, volatilite: 6, color: '#4aa3e8', icon:'◈' },
  immo:    { label:'Immobilier', rendement: 6.0, volatilite: 10, color: '#d4af37', icon:'▣' },
  crypto:  { label:'Crypto', rendement: 25, volatilite: 75, color: '#f24463', icon:'◎' },
  cash:    { label:'Liquidités', rendement: 2.5, volatilite: 0.5, color: '#00c9a7', icon:'○' }
};

function getWeights() {
  const raw = {
    actions: fv('alloc-actions'),
    oblig:   fv('alloc-oblig'),
    immo:    fv('alloc-immo'),
    crypto:  fv('alloc-crypto'),
    cash:    fv('alloc-cash')
  };
  const total = Object.values(raw).reduce((s,v)=>s+v,0);
  return { weights: raw, total };
}

function applyProfile(name) {
  const profiles = {
    prudent:   { actions:20, oblig:50, immo:15, crypto:0,  cash:15 },
    equilibre: { actions:40, oblig:20, immo:20, crypto:5,  cash:15 },
    dynamique: { actions:65, oblig:10, immo:15, crypto:10, cash:0  },
    agressif:  { actions:75, oblig:0,  immo:10, crypto:15, cash:0  }
  };
  const p = profiles[name];
  if (!p) return;
  Object.entries(p).forEach(([k,v]) => {
    const el = document.getElementById('alloc-'+k);
    if (el) el.value = v;
  });
  updateAllocation();
}

function calcPortfolioStats(weights) {
  const total = Object.values(weights).reduce((s,v)=>s+v,0);
  if (total === 0) return { rendement: 0, volatilite: 0, sharpe: 0, maxDD: 0 };

  // Rendement pondéré
  const rendement = Object.entries(weights).reduce((s,[k,v]) => s + (ASSET_DATA[k].rendement * v / total), 0);

  // Volatilité approx pondérée (simplifiée, sans corrélations complètes)
  const vol2 = Object.entries(weights).reduce((s,[k,v]) => s + Math.pow(ASSET_DATA[k].volatilite * v / total, 2), 0);
  const volatilite = Math.sqrt(vol2);

  const rfree = fv('alloc-rfree') || 3;
  const sharpe = volatilite > 0 ? (rendement - rfree) / volatilite : 0;

  // Drawdown max estimé (approximation empirique)
  const maxDD = volatilite * 2.5;

  return { rendement, volatilite, sharpe, maxDD };
}

function updateAllocation() {
  const { weights, total } = getWeights();

  // Update labels
  Object.entries(weights).forEach(([k,v]) => {
    const el = document.getElementById('v-alloc-'+k);
    if (el) el.textContent = v + ' %';
  });

  // Total check
  const totalEl = document.getElementById('alloc-total');
  const checkEl = document.getElementById('alloc-total-check');
  if (totalEl) totalEl.textContent = total + ' %';
  if (checkEl) {
    checkEl.style.borderLeft = total === 100 ? '3px solid var(--teal)' : '3px solid var(--red)';
    totalEl.style.color = total === 100 ? 'var(--teal)' : 'var(--red)';
  }

  const stats = calcPortfolioStats(weights);

  const setText = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
  setText('alloc-rendement', stats.rendement.toFixed(1) + ' %/an');
  setText('alloc-risque',    stats.volatilite.toFixed(1) + ' %');
  setText('alloc-sharpe',    stats.sharpe.toFixed(2));
  setText('alloc-max-dd',    '-' + stats.maxDD.toFixed(0) + ' %');

  // Donut
  const activeAssets = Object.entries(weights).filter(([,v])=>v>0);
  destroyChart('alloc-pie');
  if (activeAssets.length) {
    charts['alloc-pie'] = new Chart(document.getElementById('alloc-pie-chart').getContext('2d'), {
      type:'doughnut',
      data:{
        labels: activeAssets.map(([k])=>ASSET_DATA[k].label),
        datasets:[{
          data: activeAssets.map(([,v])=>v),
          backgroundColor: activeAssets.map(([k])=>ASSET_DATA[k].color+'cc'),
          borderColor: activeAssets.map(([k])=>ASSET_DATA[k].color),
          borderWidth: 1.5
        }]
      },
      options:{responsive:true,maintainAspectRatio:false,cutout:'55%',plugins:{legend:{labels:{color:'#a8b0d0',font:{family:'DM Mono',size:10},boxWidth:8,padding:8,usePointStyle:true}},tooltip:{backgroundColor:'#0b0d17',borderColor:'rgba(91,111,255,0.4)',borderWidth:1,titleColor:'#8a9bff',bodyColor:'#a8b0d0',padding:12,cornerRadius:8,bodyFont:{family:'DM Mono, monospace',size:12},callbacks:{label:c=>'  '+c.label+' : '+c.raw+'%'}}}}
    });
  }

  // Projection (pessimiste / base / optimiste)
  renderAllocProjection(stats.rendement, stats.volatilite);

  // Scatter risque/rendement
  renderAllocScatter(weights, total);

  // Tableau détaillé
  renderAllocDetailTable(weights, total, stats);
}

function renderAllocProjection(rendement, volatilite) {
  const capital  = fv('alloc-capital') || 10000;
  const monthly  = fv('alloc-monthly') || 300;
  const years    = iv('alloc-years') || 20;
  const labels   = Array.from({length: years+1}, (_,i) => `An ${i}`);

  const scenarios = [
    { label:'Pessimiste', taux: Math.max(0.5, rendement - volatilite*0.5), color:'#f24463', dash:[4,4] },
    { label:'Base',       taux: rendement,                                  color:'#5b6fff', dash:[] },
    { label:'Optimiste',  taux: rendement + volatilite*0.3,                 color:'#00c9a7', dash:[2,2] }
  ];

  const datasets = scenarios.map(sc => {
    const data = [];
    let cur = capital;
    for (let y = 0; y <= years; y++) {
      if (y > 0) {
        const r = sc.taux/100/12;
        for (let m=0; m<12; m++) cur = cur*(1+r)+monthly;
      }
      data.push(cur);
    }
    return { label:sc.label+` (${sc.taux.toFixed(1)}%)`, data, borderColor:sc.color, backgroundColor:sc.color+'10', borderWidth:2, fill:sc.label==='Base', tension:0.4, pointRadius:0, pointHoverRadius:5, borderDash:sc.dash };
  });

  // Versements ligne
  const versData = [];
  let v = capital;
  for (let y = 0; y <= years; y++) { versData.push(v); if(y<years) v += monthly*12; }
  datasets.push({ label:'Versements', data:versData, borderColor:'#5e6685', borderDash:[5,5], borderWidth:1.2, fill:false, tension:0, pointRadius:0, pointHoverRadius:3 });

  destroyChart('alloc-proj');
  charts['alloc-proj'] = new Chart(document.getElementById('alloc-proj-chart').getContext('2d'), {
    type:'line',
    data:{ labels, datasets },
    options: chartDefaults()
  });
}

function renderAllocScatter(weights, total) {
  const allPoints = Object.entries(ASSET_DATA).map(([k,d]) => ({
    x: parseFloat(d.volatilite.toFixed(1)),
    y: parseFloat(d.rendement.toFixed(1)),
    label: d.label,
    color: d.color,
    allocated: weights[k] > 0,
    weight: weights[k]
  }));

  // Portefeuille global
  const stats = calcPortfolioStats(weights);
  const portfolioPoint = {
    x: parseFloat(stats.volatilite.toFixed(1)),
    y: parseFloat(stats.rendement.toFixed(1)),
    label: 'Mon portefeuille',
    color: '#d4af37'
  };

  destroyChart('alloc-scatter');
  charts['alloc-scatter'] = new Chart(document.getElementById('alloc-scatter-chart').getContext('2d'), {
    type:'bubble',
    data:{
      datasets: [
        ...allPoints.map(p => ({
          label: p.label + (p.weight > 0 ? ` (${p.weight}%)` : ''),
          data: [{ x: p.x, y: p.y, r: p.weight > 0 ? Math.max(6, p.weight/4) : 5 }],
          backgroundColor: p.allocated ? p.color+'88' : p.color+'33',
          borderColor: p.color,
          borderWidth: p.allocated ? 2 : 1
        })),
        {
          label: portfolioPoint.label,
          data: [{ x: portfolioPoint.x, y: portfolioPoint.y, r: 12 }],
          backgroundColor: portfolioPoint.color+'88',
          borderColor: portfolioPoint.color,
          borderWidth: 2.5
        }
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{labels:{color:'#a8b0d0',font:{family:'DM Mono',size:10},boxWidth:8,usePointStyle:true,padding:10}},
        tooltip:{backgroundColor:'#0b0d17',borderColor:'rgba(91,111,255,0.4)',borderWidth:1,titleColor:'#8a9bff',bodyColor:'#a8b0d0',padding:12,cornerRadius:8,bodyFont:{family:'DM Mono, monospace',size:12},callbacks:{
          label:c=>`  ${c.dataset.label} — Vol: ${c.raw.x}% | Rend: ${c.raw.y}%`
        }}
      },
      scales:{
        x:{title:{display:true,text:'Volatilité (%)',color:'#5e6685',font:{family:'DM Mono, monospace',size:10}},ticks:{color:'#5e6685',font:{family:'DM Mono, monospace',size:10},callback:v=>v+'%'},grid:{color:'rgba(91,111,255,0.05)'}},
        y:{title:{display:true,text:'Rendement annuel (%)',color:'#5e6685',font:{family:'DM Mono, monospace',size:10}},ticks:{color:'#5e6685',font:{family:'DM Mono, monospace',size:10},callback:v=>v+'%'},grid:{color:'rgba(91,111,255,0.05)'}}
      }
    }
  });
}

function renderAllocDetailTable(weights, total, stats) {
  const container = document.getElementById('alloc-detail-table');
  if (!container) return;

  const rows = Object.entries(ASSET_DATA).map(([k,d]) => {
    const w = weights[k] || 0;
    const contrib_r = total > 0 ? (d.rendement * w / total).toFixed(2) : '0.00';
    const contrib_v = total > 0 ? (d.volatilite * w / total).toFixed(2) : '0.00';
    return `<tr style="${w>0?'':'opacity:0.4'}">
      <td><span style="color:${d.color}">${d.icon}</span> ${d.label}</td>
      <td style="text-align:center;font-family:var(--font-mono);color:${w>0?'var(--t1)':'var(--t2)'};font-weight:${w>0?700:400}">${w}%</td>
      <td style="text-align:center;font-family:var(--font-mono);color:var(--teal)">${d.rendement}%</td>
      <td style="text-align:center;font-family:var(--font-mono);color:var(--red)">${d.volatilite}%</td>
      <td style="text-align:center;font-family:var(--font-mono);color:var(--acc-l)">${contrib_r}%</td>
      <td style="text-align:center;font-family:var(--font-mono);color:var(--gold)">${contrib_v}%</td>
    </tr>`;
  }).join('');

  container.innerHTML = `<table class="amort-table">
    <thead>
      <tr>
        <th>Classe d'actif</th>
        <th style="text-align:center">Poids</th>
        <th style="text-align:center;color:var(--teal)">Rend. historique</th>
        <th style="text-align:center;color:var(--red)">Volatilité</th>
        <th style="text-align:center;color:var(--acc-l)">Contrib. rendement</th>
        <th style="text-align:center;color:var(--gold)">Contrib. risque</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr style="border-top:1px solid var(--border-h)">
        <td style="font-weight:700;color:var(--t1)">Portefeuille total</td>
        <td style="text-align:center;font-family:var(--font-mono);font-weight:700;color:${total===100?'var(--teal)':'var(--red)'}">${total}%</td>
        <td style="text-align:center;font-family:var(--font-mono);font-weight:700;color:var(--teal)">${stats.rendement.toFixed(1)}%</td>
        <td style="text-align:center;font-family:var(--font-mono);font-weight:700;color:var(--red)">${stats.volatilite.toFixed(1)}%</td>
        <td style="text-align:center;font-family:var(--font-mono);font-weight:700;color:var(--acc-l)">—</td>
        <td style="text-align:center;font-family:var(--font-mono);font-weight:700;color:var(--gold)">Sharpe: ${stats.sharpe.toFixed(2)}</td>
      </tr>
    </tfoot>
  </table>`;
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

/* ══ INIT ══ */
function init() {
  initBudget();
  refreshHome();
  updateRetraite();
  updateEnvelopeInfo('pea', 'envelope-info-box');
}
init();