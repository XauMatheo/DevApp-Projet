/* ══ STATE ══ */
let charts = {};
let budgetItems = { revenus: [], depenses: [] };
let _rendTaux = 7;
let _investTabActive = 'evolution';

/* ══ NAVIGATION ══ */
const pageTitles = {
  home: 'Tableau de bord',
  invest: 'Investissement',
  retraite: 'Planification retraite',
  analyse: 'Bilan patrimonial',
  budget: 'Budget mensuel',
  compare: 'Comparaison A/B',
  allocation: 'Allocation de portefeuille',
  academie: 'Académie de l\'investissement'
};

const pageBadges = {
  home: 'Vue globale',
  invest: 'Simulateur',
  retraite: 'Projection',
  analyse: 'Patrimoine',
  budget: 'Cash flow',
  compare: 'Scénarios',
  allocation: 'Portefeuille',
  academie: 'Formation'
};

function goPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(id + '-page').classList.add('active');
  const navItem = document.querySelector(`[data-page="${id}"]`);
  if (navItem) navItem.classList.add('active');
  document.getElementById('page-title').textContent = pageTitles[id] || id;
  const badge = document.getElementById('topbar-badge');
  if (badge) badge.textContent = pageBadges[id] || '';
  requestAnimationFrame(() => {
    if (id === 'home') refreshHome();
    if (id === 'invest') updateInvest();
    if (id === 'retraite') updateRetraite();
    if (id === 'analyse') initPatrimoine();
    if (id === 'compare') updateCompare();
    if (id === 'allocation') updateAllocation();
    if (id === 'budget') initBudget();
    if (id === 'academie') initAcademie();
  });
}

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => goPage(item.dataset.page));
});

/* Clock — sidebar + topbar */
function updateClock() {
  const t = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const clockEl = document.getElementById('clock');
  const topbarClock = document.getElementById('topbar-clock');
  if (clockEl) clockEl.textContent = t;
  if (topbarClock) topbarClock.textContent = t;
}


function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.toggle('collapsed');
  localStorage.setItem('wos_sidebar', sidebar.classList.contains('collapsed') ? '1' : '0');
}

// Restaure l'état au chargement
if (localStorage.getItem('wos_sidebar') === '1') {
  document.getElementById('sidebar').classList.add('collapsed');
}


setInterval(updateClock, 1000); updateClock();

/* ══ HELPERS ══ */
function fmt(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  const a = Math.abs(n);
  if (a >= 1e6) return (n / 1e6).toFixed(2) + 'M€';
  if (a >= 1e3) return (n / 1e3).toFixed(1) + 'k€';
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
  const p = ['#818cf8', '#2dd4bf', '#fcd34d', '#fb7185', '#38bdf8', '#c084fc', '#f472b6', '#34d399'];
  return Array.from({ length: n }, (_, i) => p[i % p.length]);
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
          color: '#a5b4fc',
          font: { family: 'DM Mono, monospace', size: 11 },
          boxWidth: 10, padding: 16, usePointStyle: true, pointStyleWidth: 8,
        }
      },
      tooltip: {
        enabled: true,
        backgroundColor: 'rgba(10, 12, 24, 0.85)',
        borderColor: 'rgba(129, 140, 248, 0.4)',
        borderWidth: 1,
        titleColor: '#c7d2fe',
        bodyColor: '#e0e7ff',
        padding: { top: 12, bottom: 12, left: 16, right: 16 },
        titleFont: { family: 'Outfit, sans-serif', size: 13, weight: '700' },
        bodyFont: { family: 'DM Mono, monospace', size: 12 },
        caretSize: 6, cornerRadius: 10, boxPadding: 8,
        callbacks: {
          label: function (context) {
            let val = context.raw;
            if (typeof val === 'number') return '  ' + context.dataset.label + ' : ' + fmtN(val);
            return '  ' + context.dataset.label + ' : ' + val;
          }
        }
      }
    },
    scales: {
      x: {
        ticks: { color: '#5c6692', font: { family: 'DM Mono, monospace', size: 10 }, maxRotation: 0, maxTicksLimit: 12 },
        grid: { color: 'rgba(255,255,255,0.03)' }
      },
      y: {
        ticks: {
          color: '#5c6692',
          font: { family: 'DM Mono, monospace', size: 10 },
          callback: function (value) {
            if (Math.abs(value) >= 1e6) return (value / 1e6).toFixed(1) + 'M€';
            if (Math.abs(value) >= 1e3) return (value / 1e3).toFixed(0) + 'k€';
            return value + '€';
          }
        },
        grid: { color: 'rgba(255,255,255,0.03)' }
      }
    }
  };
}

function destroyChart(id) { if (charts[id]) { charts[id].destroy(); delete charts[id]; } }
function escHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

/* ══ LOCAL STORAGE ══ */
function saveLocal(key, val) { try { localStorage.setItem('wos_' + key, JSON.stringify(val)); } catch (e) { } }
function loadLocal(key) { try { const v = localStorage.getItem('wos_' + key); return v ? JSON.parse(v) : null; } catch (e) { return null; } }

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
// APRÈS
function switchInvestTab(tab, btn) {
  _investTabActive = tab;
  document.querySelectorAll('.ct-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.chart-pane').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('pane-' + tab).classList.add('active');
  if (tab === 'montecarlo') renderMonteCarlo();
  else renderInvestCharts();
}

function calcCapital(capital, monthly, rateNet, years, revalor) {
  const data = [];
  let current = capital, currentMonthly = monthly;
  for (let y = 0; y <= years; y++) {
    if (y > 0) {
      const r = rateNet / 100 / 12;
      for (let m = 0; m < 12; m++) current = current * (1 + r) + currentMonthly;
      currentMonthly *= (1 + revalor / 100);
    }
    data.push({ year: y, value: current });
  }
  return data;
}

function calcVersementsCumul(capital, monthly, years, revalor) {
  let total = capital, m = monthly;
  const data = [{ year: 0, value: capital }];
  for (let y = 1; y <= years; y++) {
    total += m * 12;
    m *= (1 + revalor / 100);
    data.push({ year: y, value: total });
  }
  return data;
}

function calcCapAt(capital, monthly, rateNet, years) {
  const r = rateNet / 100 / 12, n = years * 12;
  let v = capital;
  for (let m = 0; m < n; m++) v = v * (1 + r) + monthly;
  return v;
}

function updateInvest() {
  const capital = fv('r-capital');
  const monthly = fv('r-monthly');
  const rate = fv('r-rate');
  const years = iv('r-years') || 0;
  const inflation = fv('r-inflation');
  const frais = fv('r-frais');
  const tmi = fv('r-tmi');
  const revalor = fv('r-revalor');
  const envelopeId = sv('r-envelope') || 'pea';

  const rateNet = Math.max(0, rate - frais);
  const data = calcCapital(capital, monthly, rateNet, years, revalor);
  const versData = calcVersementsCumul(capital, monthly, years, revalor);
  const finalBrut = data[data.length - 1]?.value || 0;
  const totalVerse = versData[versData.length - 1]?.value || 0;
  const gainsBruts = Math.max(0, finalBrut - totalVerse);
  const capitalNet = applyEnvelopeFiscality(finalBrut, totalVerse, envelopeId, tmi, years);
  const capitalReel = finalBrut / Math.pow(1 + inflation / 100, years);
  const rente4 = finalBrut * 0.04 / 12;

  const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setText('res-final', fmtN(finalBrut));
  setText('res-net', fmtN(capitalNet));
  setText('res-reel', fmtN(capitalReel));
  setText('res-versed', fmtN(totalVerse));
  setText('res-gains', fmtN(gainsBruts));
  setText('res-ratio', finalBrut > 0 && totalVerse > 0 ? (finalBrut / totalVerse).toFixed(2) + '×' : '—');
  setText('res-rente', fmtN(rente4) + '/m');

  updateEnvelopeInfo(envelopeId, 'envelope-info-box');

  document.getElementById('home-capital').textContent = fmt(finalBrut);
  document.getElementById('home-gains').textContent = fmt(gainsBruts);
  saveLocal('investResult', { final: finalBrut, gains: gainsBruts });

  renderInvestCharts();
  updateHomeChart(data, versData);
}

function renderInvestCharts() {
  const capital = fv('r-capital');
  const monthly = fv('r-monthly');
  const rate = fv('r-rate');
  const years = iv('r-years') || 0;
  const inflation = fv('r-inflation');
  const frais = fv('r-frais');
  const revalor = fv('r-revalor');
  const rateNet = Math.max(0, rate - frais);

  if (years <= 0) return;

  const data = calcCapital(capital, monthly, rateNet, years, revalor);
  const versData = calcVersementsCumul(capital, monthly, years, revalor);
  const labels = data.map(d => `An ${d.year}`);
  const opts = chartDefaults();

  // Évolution
  destroyChart('invest');
  charts.invest = new Chart(document.getElementById('invest-chart').getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Capital total', data: data.map(d => d.value), borderColor: '#5b6fff', backgroundColor: 'rgba(91,111,255,0.07)', borderWidth: 2.5, fill: true, tension: 0.4, pointRadius: 0, pointHoverRadius: 5 },
        { label: 'Versements cumulés', data: versData.map(d => d.value), borderColor: '#4aa3e8', borderDash: [5, 5], borderWidth: 1.5, fill: false, tension: 0, pointRadius: 0, pointHoverRadius: 4 },
        { label: 'Capital réel (inflation)', data: data.map((d, i) => d.value / Math.pow(1 + inflation / 100, i)), borderColor: '#00c9a7', borderDash: [3, 3], borderWidth: 1.5, fill: false, tension: 0.4, pointRadius: 0, pointHoverRadius: 4 }
      ]
    },
    options: opts
  });

  // Multi-taux
  destroyChart('rend-multi');
  const taux_list = [3, 5, 7, 10, 12], col_list = ['#4aa3e8', '#00c9a7', '#5b6fff', '#d4af37', '#f24463'];
  charts['rend-multi'] = new Chart(document.getElementById('rend-multi-chart').getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: taux_list.map((t, i) => {
        const d = calcCapital(capital, monthly, Math.max(0, t - frais), years, revalor);
        return { label: `${t}%`, data: d.map(x => x.value), borderColor: col_list[i], backgroundColor: col_list[i] + '10', borderWidth: 2, fill: true, tension: 0.4, pointRadius: 0, pointHoverRadius: 4 };
      })
    },
    options: chartDefaults()
  });

  // Composition
  destroyChart('rend-compo');
  const vers = versData[versData.length - 1]?.value || 0;
  const coOpts = chartDefaults();
  charts['rend-compo'] = new Chart(document.getElementById('rend-compo-chart').getContext('2d'), {
    type: 'bar',
    data: {
      labels: ['3%', '5%', '7%', '10%'],
      datasets: [
        { label: 'Versements', data: [3, 5, 7, 10].map(() => vers), backgroundColor: 'rgba(74,163,232,0.55)', borderColor: '#4aa3e8', borderWidth: 1.5, borderRadius: 4 },
        { label: 'Intérêts', data: [3, 5, 7, 10].map(t => Math.max(0, calcCapAt(capital, monthly, Math.max(0, t - frais), years) - vers)), backgroundColor: 'rgba(91,111,255,0.55)', borderColor: '#5b6fff', borderWidth: 1.5, borderRadius: 4 }
      ]
    },
    options: { ...coOpts, scales: { x: { stacked: true, ticks: { color: '#5e6685', font: { family: 'DM Mono, monospace', size: 10 } }, grid: { color: 'rgba(91,111,255,0.05)' } }, y: { stacked: true, ticks: { color: '#5e6685', font: { family: 'DM Mono, monospace', size: 10 }, callback: v => Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(1) + 'M€' : Math.abs(v) >= 1e3 ? (v / 1e3).toFixed(0) + 'k€' : v + '€' }, grid: { color: 'rgba(91,111,255,0.05)' } } } }
  });

  // Inflation
  destroyChart('rend-inflation');
  charts['rend-inflation'] = new Chart(document.getElementById('rend-inflation-chart').getContext('2d'), {
    type: 'line',
    data: {
      labels, datasets: [
        { label: 'Valeur nominale', data: data.map(d => d.value), borderColor: '#5b6fff', backgroundColor: 'rgba(91,111,255,0.07)', borderWidth: 2, fill: true, tension: 0.4, pointRadius: 0, pointHoverRadius: 5 },
        { label: 'Valeur réelle', data: data.map((d, i) => d.value / Math.pow(1 + inflation / 100, i)), borderColor: '#d4af37', backgroundColor: 'rgba(212,175,55,0.06)', borderWidth: 2, fill: true, tension: 0.4, pointRadius: 0, pointHoverRadius: 5, borderDash: [4, 3] }
      ]
    },
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
      current = current * (1 + r) + m;
    }
    const versementsAnnee = m * 12;
    totalVerse += versementsAnnee;
    totalInterets += interetsAnnee;
    m *= (1 + 0 / 100); // revalor handled in main calc
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
  const years = iv('r-years') || 0;
  const revalor = fv('r-revalor');
  if (years <= 0) return;

  const rateNet = Math.max(0, _rendTaux - frais);
  const data = calcCapital(capital, monthly, rateNet, years, revalor);
  const versD = calcVersementsCumul(capital, monthly, years, revalor);
  const labels = data.map(d => `An ${d.year}`);
  const dOpts = chartDefaults();

  destroyChart('rend-detail');
  charts['rend-detail'] = new Chart(document.getElementById('rend-detail-chart').getContext('2d'), {
    type: 'bar',
    data: {
      labels, datasets: [
        { label: 'Versements cumulés', data: versD.map(d => d.value), backgroundColor: 'rgba(74,163,232,0.5)', borderColor: '#4aa3e8', borderWidth: 0, borderRadius: 2 },
        { label: 'Intérêts générés', data: data.map((d, i) => Math.max(0, d.value - versD[i].value)), backgroundColor: 'rgba(91,111,255,0.55)', borderColor: '#5b6fff', borderWidth: 0, borderRadius: 2 }
      ]
    },
    options: { ...dOpts, scales: { x: { stacked: true, ticks: { color: '#5e6685', font: { family: 'DM Mono, monospace', size: 10 }, maxTicksLimit: 12 }, grid: { color: 'rgba(91,111,255,0.05)' } }, y: { stacked: true, ticks: { color: '#5e6685', font: { family: 'DM Mono, monospace', size: 10 }, callback: v => Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(1) + 'M€' : Math.abs(v) >= 1e3 ? (v / 1e3).toFixed(0) + 'k€' : v + '€' }, grid: { color: 'rgba(91,111,255,0.05)' } } } }
  });

  const final = data[data.length - 1].value;
  const versed = versD[versD.length - 1].value;
  const inter = Math.max(0, final - versed);
  document.getElementById('rend-detail-kpis').innerHTML = [
    { val: fmt(final), lbl: 'Capital final', color: 'var(--acc-l)' },
    { val: fmt(versed), lbl: 'Total versé', color: 'var(--blue)' },
    { val: fmt(inter), lbl: 'Intérêts', color: 'var(--teal)' },
    { val: (final > 0 && versed > 0 ? (final / versed).toFixed(2) + '×' : '—'), lbl: 'Multiplicateur', color: 'var(--gold)' }
  ].map(k => `<div class="dk-item"><div class="dk-val" style="color:${k.color}">${k.val}</div><div class="dk-lbl">${k.lbl}</div></div>`).join('');
}

/* ══ MONTE CARLO ══ */
function renderMonteCarlo() {
  const canvas = document.getElementById('invest-mc-chart');
  if (!canvas) return;

  const capital = fv('r-capital');
  const monthly = fv('r-monthly');
  const rate = fv('r-rate');
  const years = iv('r-years') || 0;
  const frais = fv('r-frais');
  const rateNet = Math.max(0, rate - frais);
  if (years <= 0) return;

  // Force dimensions explicites — sans ça Chart.js échoue sur canvas caché
  const parent = canvas.parentElement;
  if (parent.offsetWidth > 0) {
    canvas.width = parent.offsetWidth;
    canvas.height = parent.offsetHeight || 260;
  }

  const SIM = 200, annualVol = rateNet * 0.6;
  const labels = Array.from({ length: years + 1 }, (_, i) => `An ${i}`);
  const allFinals = [];
  const percentileData = { p10: [], p25: [], p50: [], p75: [], p90: [] };

  const sims = [];
  for (let s = 0; s < SIM; s++) {
    let cur = capital;
    const path = [cur];
    const monthlyVol = annualVol / 100 / Math.sqrt(12);
    const monthlyRate = rateNet / 100 / 12;
    for (let y = 0; y < years; y++) {
      for (let m = 0; m < 12; m++) {
        const u1 = Math.random() || 1e-10;
        const shock = monthlyVol * (Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * Math.random()));
        cur = cur * (1 + monthlyRate + shock) + monthly;
      }
      path.push(cur);
    }
    sims.push(path);
    allFinals.push(cur);
  }

  for (let y = 0; y <= years; y++) {
    const vals = sims.map(p => p[y]).sort((a, b) => a - b);
    const pct = (p) => vals[Math.floor(p / 100 * vals.length)] || 0;
    percentileData.p10.push(pct(10));
    percentileData.p25.push(pct(25));
    percentileData.p50.push(pct(50));
    percentileData.p75.push(pct(75));
    percentileData.p90.push(pct(90));
  }

  const sampledPaths = sims.filter((_, i) => i % 20 === 0).slice(0, 10);

  destroyChart('invest-mc');

  charts['invest-mc'] = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        ...sampledPaths.map(path => ({
          data: path, borderColor: 'rgba(91,111,255,0.12)', borderWidth: 1,
          fill: false, tension: 0.3, pointRadius: 0, pointHoverRadius: 0, label: ''
        })),
        { label: 'P90 (optimiste)', data: percentileData.p90, borderColor: '#00c9a7', borderWidth: 2, fill: false, tension: 0.4, pointRadius: 0, pointHoverRadius: 4, borderDash: [4, 3] },
        { label: 'P75', data: percentileData.p75, borderColor: 'rgba(0,201,167,0.45)', borderWidth: 1.5, fill: false, backgroundColor: 'rgba(0,201,167,0.06)', tension: 0.4, pointRadius: 0, pointHoverRadius: 3 },
        { label: 'Médiane (P50)', data: percentileData.p50, borderColor: '#5b6fff', borderWidth: 2.5, fill: false, tension: 0.4, pointRadius: 0, pointHoverRadius: 5 },
        { label: 'P25', data: percentileData.p25, borderColor: 'rgba(242,68,99,0.45)', borderWidth: 1.5, fill: false, backgroundColor: 'rgba(242,68,99,0.06)', tension: 0.4, pointRadius: 0, pointHoverRadius: 3 },
        { label: 'P10 (pessimiste)', data: percentileData.p10, borderColor: '#f24463', borderWidth: 2, fill: false, tension: 0.4, pointRadius: 0, pointHoverRadius: 4, borderDash: [4, 3] },
      ]
    },
    options: {
      ...chartDefaults(),
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        ...chartDefaults().plugins,
        tooltip: {
          ...chartDefaults().plugins.tooltip,
          filter: function(item) {
            // N'affiche que les datasets nommés (percentiles), pas les courbes individuelles
            return item.dataset.label !== '';
          },
          callbacks: {
            label: function(context) {
              if (!context.dataset.label) return null;
              return '  ' + context.dataset.label + ' : ' + fmtN(context.raw);
            }
          }
        }
      }
    }
  });

  allFinals.sort((a, b) => a - b);
  const pctF = (p) => allFinals[Math.floor(p / 100 * allFinals.length)];
  const totalVerse = capital + monthly * years * 12;
  const probPositif = allFinals.filter(v => v > totalVerse).length / SIM * 100;

  const kpisEl = document.getElementById('mc-kpis');
  if (kpisEl) kpisEl.innerHTML = [
    { val: fmt(pctF(50)), lbl: 'Médiane finale', color: 'var(--acc-l)' },
    { val: fmt(pctF(10)), lbl: 'Pessimiste (P10)', color: 'var(--red)' },
    { val: fmt(pctF(90)), lbl: 'Optimiste (P90)', color: 'var(--teal)' },
    { val: probPositif.toFixed(0) + '%', lbl: 'Prob. de gain', color: 'var(--gold)' }
  ].map(k => `<div class="dk-item"><div class="dk-val" style="color:${k.color}">${k.val}</div><div class="dk-lbl">${k.lbl}</div></div>`).join('');
}

/* ══ HOME CHART ══ */
function updateHomeChart(data, versData) {
  destroyChart('home');
  charts.home = new Chart(document.getElementById('home-chart').getContext('2d'), {
    type: 'line',
    data: {
      labels: data.map(d => `An ${d.year}`),
      datasets: [
        { data: data.map(d => d.value), borderColor: '#5b6fff', backgroundColor: 'rgba(91,111,255,0.12)', fill: true, tension: 0.4, borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 5 },
        { data: versData.map(d => d.value), borderColor: '#4aa3e8', borderDash: [4, 4], fill: false, tension: 0, borderWidth: 1.5, pointRadius: 0, pointHoverRadius: 4 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: '#0b0d17', borderColor: 'rgba(91,111,255,0.4)', borderWidth: 1, titleColor: '#8a9bff', bodyColor: '#a8b0d0', padding: { top: 10, bottom: 10, left: 14, right: 14 }, titleFont: { family: 'DM Mono, monospace', size: 11 }, bodyFont: { family: 'DM Mono, monospace', size: 12 }, cornerRadius: 8, callbacks: { label: c => '  ' + fmtN(c.raw) } }
      },
      scales: { x: { display: false }, y: { display: false } }
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
      const r = tauxAnnuel / 100 / 12;
      for (let m = 0; m < 12; m++) current = current * (1 + r) + monthly;
      monthly *= (1 + revalor / 100);
    }
    data.push({ year: y, value: current });
  }
  const totalVersed = capitalActuel + epargne * annees * 12;
  return { data, final: current, versements: totalVersed };
}

function calcRente(capital, tauxAnnuel, dureeAns) {
  if (dureeAns <= 0 || capital <= 0) return 0;
  const r = tauxAnnuel / 100 / 12, n = dureeAns * 12;
  if (r === 0) return capital / n;
  return capital * r / (1 - Math.pow(1 + r, -n));
}

function updateRetraite() {
  const ageActuel = iv('ret-age-actuel') || 35;
  const ageRetraite = iv('ret-age-retraite') || 65;
  const esperance = iv('ret-esperance') || 85;
  const capital = fv('ret-capital-actuel');
  const epargne = fv('ret-epargne-mensuelle');
  const taux = fv('ret-taux') || 5;
  const inflation = fv('ret-inflation') || 2;
  const revalor = fv('ret-revalor') || 0;
  const objectif = fv('ret-objectif') || 2000;

  const setText = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
  setText('v-age-actuel', ageActuel + ' ans');
  setText('v-age-retraite', ageRetraite + ' ans');
  setText('v-esperance', esperance + ' ans');
  setText('v-capital-actuel', fmtN(capital));
  setText('v-epargne-mensuelle', fmtN(epargne));
  setText('v-taux-ret', taux.toFixed(1) + ' %');
  setText('v-inflation', inflation.toFixed(1) + ' %');
  setText('v-revalor-ret', revalor.toFixed(1) + ' %');
  setText('v-objectif', fmtN(objectif));

  const anneesEpargne = Math.max(0, ageRetraite - ageActuel);
  const anneesRetraite = Math.max(0, esperance - ageRetraite);
  const tauxRetrait = 4;

  const { data, final, versements } = calcRetraite(capital, epargne, taux, anneesEpargne, revalor);
  const capitalReel = final / Math.pow(1 + inflation / 100, anneesEpargne);
  const renteNominale = calcRente(final, tauxRetrait, anneesRetraite);
  const renteReelle = renteNominale / Math.pow(1 + inflation / 100, anneesEpargne);

  setText('ret-capital-final', fmt(final));
  setText('ret-rente', fmt(renteNominale) + '/m');
  setText('ret-annees', anneesEpargne + ' ans');
  setText('ret-effort', fmt(versements));
  setText('ret-res-capital', fmtN(final));
  setText('ret-res-capital-reel', fmtN(capitalReel));
  setText('ret-res-rente-nominale', fmtN(renteNominale));
  setText('ret-res-rente-reelle', fmtN(renteReelle));

  const pct = objectif > 0 ? Math.min(100, Math.round(renteNominale / objectif * 100)) : 0;
  document.getElementById('ret-progress-bar').style.width = pct + '%';
  setText('ret-progress-pct', pct + '%');
  const diff = renteNominale - objectif;
  const msgEl = document.getElementById('ret-objectif-msg');
  if (diff >= 0)
    msgEl.innerHTML = `<span style="color:var(--teal)">✓ Objectif atteint</span> — surplus de <strong style="color:var(--teal)">${fmtN(diff)}/mois</strong>`;
  else
    msgEl.innerHTML = `<span style="color:var(--red)">✗ Objectif non atteint</span> — manque de <strong style="color:var(--red)">${fmtN(Math.abs(diff))}/mois</strong>`;

  const scens = [
    { label: 'Pessimiste', taux: Math.max(0.5, taux - 2), color: '#f24463' },
    { label: 'Base', taux, color: '#5b6fff' },
    { label: 'Optimiste', taux: taux + 2, color: '#00c9a7' },
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
    type: 'line',
    data: {
      labels: data.map(d => `${ageActuel + d.year} ans`), datasets: [
        { label: 'Capital accumulé', data: data.map(d => d.value), borderColor: '#5b6fff', backgroundColor: 'rgba(91,111,255,0.08)', borderWidth: 2.5, fill: true, tension: 0.4, pointRadius: 0, pointHoverRadius: 5 },
        { label: 'Versements cumulés', data: versLine, borderColor: '#4aa3e8', borderDash: [5, 5], borderWidth: 1.5, fill: false, tension: 0, pointRadius: 0, pointHoverRadius: 4 },
        { label: 'Capital réel', data: data.map((d, i) => d.value / Math.pow(1 + inflation / 100, i)), borderColor: '#00c9a7', borderDash: [3, 3], borderWidth: 1.5, fill: false, tension: 0.4, pointRadius: 0, pointHoverRadius: 4 }
      ]
    },
    options: chartDefaults()
  });

  document.getElementById('home-retraite').textContent = fmt(final);
  renderDecaissement(final, taux, anneesRetraite);
  saveLocal('retraiteResult', { final, renteNominale });
}

/* ══ DÉCAISSEMENT RETRAITE ══ */
function renderDecaissement(capital, tauxPlacement, dureeAns) {
  const canvas = document.getElementById('retraite-decaissement-chart');
  if (!canvas || capital <= 0 || dureeAns <= 0) return;

  const taux_retrait = [3, 4, 5, 6];
  const colors = ['#00c9a7', '#5b6fff', '#d4af37', '#f24463'];
  const labels = Array.from({ length: dureeAns + 1 }, (_, i) => `Année ${i}`);

  const datasets = taux_retrait.map((tr, i) => {
    const data = [capital];
    let cur = capital;
    const rente = capital * (tr / 100) / 12;
    const r = tauxPlacement / 100 / 12;
    for (let y = 0; y < dureeAns; y++) {
      for (let m = 0; m < 12; m++) cur = cur * (1 + r) - rente;
      data.push(Math.max(0, cur));
    }
    return {
      label: `Retrait ${tr}% (${fmt(capital * tr / 100 / 12)}/m)`,
      data, borderColor: colors[i],
      backgroundColor: colors[i] + '0a',
      borderWidth: 2, fill: true, tension: 0.4,
      pointRadius: 0, pointHoverRadius: 5
    };
  });

  destroyChart('retraite-decaissement');
  charts['retraite-decaissement'] = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: { labels, datasets },
    options: chartDefaults()
  });
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
  const actifs = getPatriRows('actifs');
  const passifs = getPatriRows('passifs');
  const totalA = actifs.reduce((s, x) => s + x.value, 0);
  const totalP = passifs.reduce((s, x) => s + x.value, 0);
  const net = totalA - totalP;
  const txDette = totalA > 0 ? totalP / totalA * 100 : 0;

  const setText = (id, txt, color) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = txt;
    if (color) el.style.color = color;
  };
  setText('patri-net', fmt(net), net >= 0 ? 'var(--teal)' : 'var(--red)');
  setText('patri-actifs-total', fmt(totalA));
  setText('patri-passifs-total', fmt(totalP));
  setText('patri-taux-dette', txDette.toFixed(1) + '%');

  const maxRef = Math.max(totalA, totalP, 1);
  document.getElementById('patri-bar-actifs').style.width = Math.min(100, totalA / maxRef * 100) + '%';
  document.getElementById('patri-bar-passifs').style.width = Math.min(100, totalP / maxRef * 100) + '%';
  setText('patri-bar-actifs-lbl', fmtN(totalA));
  setText('patri-bar-passifs-lbl', fmtN(totalP));

  const msg = document.getElementById('patri-health-msg');
  if (txDette === 0) msg.innerHTML = `<span style="color:var(--teal)">✓ Aucune dette — patrimoine sain.</span>`;
  else if (txDette < 30) msg.innerHTML = `<span style="color:var(--teal)">✓ Endettement faible (${txDette.toFixed(1)}%) — situation confortable.</span>`;
  else if (txDette < 60) msg.innerHTML = `<span style="color:var(--gold)">⚠ Endettement modéré (${txDette.toFixed(1)}%) — à surveiller.</span>`;
  else msg.innerHTML = `<span style="color:var(--red)">✗ Endettement élevé (${txDette.toFixed(1)}%) — rééquilibrage conseillé.</span>`;

  const colors = generateColors(Math.max(actifs.length, passifs.length, 2));
  const pieOpts = () => ({
    responsive: true, maintainAspectRatio: false, cutout: '52%',
    plugins: {
      legend: { labels: { color: '#a8b0d0', font: { family: 'DM Mono', size: 10 }, boxWidth: 8, padding: 8, usePointStyle: true } },
      tooltip: { backgroundColor: '#0b0d17', borderColor: 'rgba(91,111,255,0.4)', borderWidth: 1, titleColor: '#8a9bff', bodyColor: '#a8b0d0', padding: 12, cornerRadius: 8, bodyFont: { family: 'DM Mono, monospace', size: 12 }, callbacks: { label: c => '  ' + c.label + ' : ' + fmtN(c.raw) } }
    }
  });

  destroyChart('patri-actifs');
  if (actifs.length) charts['patri-actifs'] = new Chart(document.getElementById('patri-actifs-chart').getContext('2d'), { type: 'doughnut', data: { labels: actifs.map(x => x.label), datasets: [{ data: actifs.map(x => x.value), backgroundColor: colors.slice(0, actifs.length).map(c => c + 'cc'), borderColor: colors.slice(0, actifs.length), borderWidth: 1.5 }] }, options: pieOpts() });

  destroyChart('patri-passifs');
  const reds = ['#f24463', '#ff6b6b', '#e63946', '#c9184a'];
  if (passifs.length) charts['patri-passifs'] = new Chart(document.getElementById('patri-passifs-chart').getContext('2d'), { type: 'doughnut', data: { labels: passifs.map(x => x.label), datasets: [{ data: passifs.map(x => x.value), backgroundColor: reds.slice(0, passifs.length).map(c => c + 'cc'), borderColor: reds.slice(0, passifs.length), borderWidth: 1.5 }] }, options: pieOpts() });

  destroyChart('patri-compare');
  charts['patri-compare'] = new Chart(document.getElementById('patri-compare-chart').getContext('2d'), { type: 'bar', data: { labels: ['Actifs', 'Passifs', 'Net'], datasets: [{ data: [totalA, totalP, Math.max(0, net)], backgroundColor: ['rgba(0,201,167,0.4)', 'rgba(242,68,99,0.4)', 'rgba(91,111,255,0.4)'], borderColor: ['#00c9a7', '#f24463', '#5b6fff'], borderWidth: 1.5, borderRadius: 6 }] }, options: { ...chartDefaults(), plugins: { ...chartDefaults().plugins, legend: { display: false } } } });
}

/* ══════════════════════════════════════════
   BUDGET
   ══════════════════════════════════════════ */
function addRevenu(label = 'Salaire', montant = '') { budgetItems.revenus.push({ label, montant }); renderBudget(); }
function addDepense(label = 'Dépense', montant = '') { budgetItems.depenses.push({ label, montant }); renderBudget(); }

function renderBudget() {
  renderBudgetList('revenus-list', 'revenus');
  renderBudgetList('depenses-list', 'depenses');
  updateBudgetSummary();
}
function renderBudgetList(cid, type) {
  document.getElementById(cid).innerHTML = budgetItems[type].map((item, i) => budgetRow(item, i, type)).join('');
}
function budgetRow(item, i, type) {
  return `<div class="budget-row-item">
    <input class="field-input" style="flex:2" value="${escHtml(String(item.label))}"
      oninput="budgetItems['${type}'][${i}].label=this.value;updateBudgetSummary()" onkeydown="if(event.key==='Enter')this.blur()">
    <input class="field-input" type="number" style="flex:1;padding-right:12px" value="${item.montant}"
      placeholder="0"
      oninput="budgetItems['${type}'][${i}].montant=parseFloat(this.value)||0;updateBudgetSummary()" onkeydown="if(event.key==='Enter')this.blur()">
    <button class="del-btn" onclick="budgetItems['${type}'].splice(${i},1);renderBudget()">✕</button>
  </div>`;
}

function updateBudgetSummary() {
  const totalR = budgetItems.revenus.reduce((s, x) => s + (parseFloat(x.montant) || 0), 0);
  const totalD = budgetItems.depenses.reduce((s, x) => s + (parseFloat(x.montant) || 0), 0);
  const ral = totalR - totalD;

  const setText = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
  setText('b-revenus', fmtN(totalR));
  setText('b-depenses', fmtN(totalD));
  const ralEl = document.getElementById('b-ral');
  if (ralEl) { ralEl.textContent = fmtN(ral); ralEl.style.color = ral >= 0 ? 'var(--teal)' : 'var(--red)'; }
  document.getElementById('home-ral').textContent = fmt(ral);

  // Pie dépenses
  const colors = generateColors(budgetItems.depenses.length);
  destroyChart('budget-pie');
  if (budgetItems.depenses.length) {
    charts['budget-pie'] = new Chart(document.getElementById('budget-pie').getContext('2d'), { type: 'doughnut', data: { labels: budgetItems.depenses.map(x => x.label), datasets: [{ data: budgetItems.depenses.map(x => parseFloat(x.montant) || 0), backgroundColor: colors.map(c => c + 'cc'), borderColor: colors, borderWidth: 1.5 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '55%', plugins: { legend: { labels: { color: '#a8b0d0', font: { family: 'DM Mono', size: 10 }, boxWidth: 8, usePointStyle: true } }, tooltip: { backgroundColor: '#0b0d17', borderColor: 'rgba(91,111,255,0.4)', borderWidth: 1, titleColor: '#8a9bff', bodyColor: '#a8b0d0', padding: 12, cornerRadius: 8, bodyFont: { family: 'DM Mono, monospace', size: 12 }, callbacks: { label: c => '  ' + c.label + ' : ' + fmtN(c.raw) } } } } });
  }

  document.getElementById('budget-bars').innerHTML = budgetItems.depenses.map((item, i) => {
    const pct = totalR > 0 ? Math.min(100, (parseFloat(item.montant) || 0) / totalR * 100) : 0;
    return `<div class="bb-row">
      <div class="bb-head"><span>${escHtml(String(item.label))}</span><span style="color:${colors[i]};font-weight:600;font-family:var(--font-mono)">${fmtN(parseFloat(item.montant) || 0)}</span></div>
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
    { label: 'Besoins essentiels', pct: 50, actual: totalR > 0 ? (totalD / totalR * 100) : 0, color: '#4aa3e8', desc: 'Logement, alimentation, transport' },
    { label: 'Loisirs & envies', pct: 30, actual: totalR > 0 ? (totalD / totalR * 100) * (30 / 80) : 0, color: '#b06cf8', desc: 'Sorties, voyages, abonnements' },
    { label: 'Épargne & investissement', pct: 20, actual: totalR > 0 ? (Math.max(0, ral) / totalR * 100) : 0, color: '#00c9a7', desc: 'PEA, AV, épargne de précaution' }
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
        <div style="height:100%;width:${Math.min(100, c.actual / c.pct * 100).toFixed(1)}%;background:${c.color};border-radius:3px;transition:width 0.4s"></div>
      </div>
      <div style="font-size:0.68rem">${status}</div>
    </div>`;
  }).join('');

  // Chart radar-style bar horizontal
  destroyChart('budget-503020-chart');
  const canvas = document.getElementById('budget-503020-chart');
  if (!canvas) return;
  // Réinitialise le canvas pour éviter les artefacts après destroy
  canvas.width = canvas.width;
  charts['budget-503020-chart'] = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: cibles.map(c => c.label),
      datasets: [
        { label: 'Actuel (%)', data: cibles.map(c => parseFloat(c.actual.toFixed(1))), backgroundColor: cibles.map(c => c.color + '88'), borderColor: cibles.map(c => c.color), borderWidth: 1.5, borderRadius: 4 },
        { label: 'Cible (%)', data: cibles.map(c => c.pct), backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.25)', borderWidth: 1.5, borderDash: [4, 4], borderRadius: 4, type: 'bar' }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: '#a8b0d0', font: { family: 'DM Mono, monospace', size: 11 }, boxWidth: 10, padding: 12, usePointStyle: true } },
        tooltip: { backgroundColor: '#0b0d17', borderColor: 'rgba(91,111,255,0.4)', borderWidth: 1, titleColor: '#8a9bff', bodyColor: '#a8b0d0', padding: 12, cornerRadius: 8, bodyFont: { family: 'DM Mono, monospace', size: 12 }, callbacks: { label: c => '  ' + c.dataset.label + ' : ' + c.raw.toFixed(1) + '%' } }
      },
      scales: {
        x: { ticks: { color: '#5e6685', font: { family: 'DM Mono, monospace', size: 10 } }, grid: { color: 'rgba(91,111,255,0.05)' } },
        y: { ticks: { color: '#5e6685', font: { family: 'DM Mono, monospace', size: 10 }, callback: v => v + '%' }, grid: { color: 'rgba(91,111,255,0.05)' }, max: 80 }
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
  const colors = ['#5e6685', '#4aa3e8', '#5b6fff', '#00c9a7'];
  const labels = Array.from({ length: years + 1 }, (_, i) => `An ${i}`);

  const datasets = taux.map((t, i) => {
    const data = [];
    let capital = 0;
    for (let y = 0; y <= years; y++) {
      if (y > 0) {
        const r = t / 100 / 12;
        for (let m = 0; m < 12; m++) capital = capital * (1 + r) + epargne;
      }
      data.push(capital);
    }
    return { label: `Taux ${t}%`, data, borderColor: colors[i], backgroundColor: colors[i] + '15', borderWidth: t === 0 ? 1.5 : 2, fill: false, tension: 0.4, pointRadius: 0, pointHoverRadius: 4, borderDash: t === 0 ? [4, 4] : [] };
  });

  destroyChart('budget-proj');
  charts['budget-proj'] = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: { labels, datasets },
    options: chartDefaults()
  });
}

function initBudget() {
  budgetItems = { revenus: [], depenses: [] };
  renderBudget();
}

/* ══════════════════════════════════════════
   COMPARAISON
   ══════════════════════════════════════════ */
function calcScenario(capital, monthly, rate, years, inflation, frais, tmiPct, revalor, envelopeId) {
  const rateNet = Math.max(0, rate - frais);
  const tmi = tmiPct / 100;
  let current = capital, m = monthly;
  const data = [{ year: 0, value: capital }];
  for (let y = 1; y <= years; y++) {
    const r = rateNet / 100 / 12;
    for (let mo = 0; mo < 12; mo++) current = current * (1 + r) + m;
    m *= (1 + revalor / 100);
    data.push({ year: y, value: current });
  }
  const final = current;
  let totalVerse = capital, mv = monthly;
  for (let y = 0; y < years; y++) { totalVerse += mv * 12; mv *= (1 + revalor / 100); }
  const gainsBruts = Math.max(0, final - totalVerse);
  const capitalNet = applyEnvelopeFiscality(final, totalVerse, envelopeId || 'cto', tmi, years);
  const gainsNets = Math.max(0, capitalNet - totalVerse);
  const capitalReel = final / Math.pow(1 + inflation / 100, years);
  const rente = final * 0.04 / 12;
  return { data, final, totalVerse, gainsBruts, gainsNets, capitalNet, capitalReel, rente };
}

function updateCompare() {
  const g = (id) => parseFloat(document.getElementById(id)?.value) || 0;
  const gi = (id) => parseInt(document.getElementById(id)?.value) || 0;

  const envA = document.getElementById('ca-env')?.value || 'pea';
  const envB = document.getElementById('cb-env')?.value || 'pea';
  const A = calcScenario(g('ca-capital'), g('ca-monthly'), g('ca-rate'), gi('ca-years') || 0, g('ca-inflation'), g('ca-frais'), g('ca-tmi'), g('ca-revalor'), envA);
  const B = calcScenario(g('cb-capital'), g('cb-monthly'), g('cb-rate'), gi('cb-years') || 0, g('cb-inflation'), g('cb-frais'), g('cb-tmi'), g('cb-revalor'), envB);

  const setT = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  [['ca', A], ['cb', B]].forEach(([p, S]) => {
    setT(p + '-result', fmtN(S.final));
    setT(p + '-net', fmtN(S.capitalNet));
    setT(p + '-reel', fmtN(S.capitalReel));
    setT(p + '-rente', fmtN(S.rente) + '/m');
    setT(p + '-versed', fmtN(S.totalVerse));
    setT(p + '-gains', fmtN(S.gainsNets));
    setT(p + '-multi', S.totalVerse > 0 ? (S.final / S.totalVerse).toFixed(2) + '×' : '—');
  });

  const maxYears = Math.max(gi('ca-years') || 0, gi('cb-years') || 0);
  if (maxYears <= 0) return;

  const labA = sv('ca-name') || 'Scénario A';
  const labB = sv('cb-name') || 'Scénario B';
  const labels = Array.from({ length: maxYears + 1 }, (_, i) => `An ${i}`);

  destroyChart('compare');
  charts.compare = new Chart(document.getElementById('compare-chart').getContext('2d'), {
    type: 'line', data: {
      labels, datasets: [
        { label: labA, data: A.data.slice(0, maxYears + 1).map(d => d.value), borderColor: '#4aa3e8', backgroundColor: 'rgba(74,163,232,0.06)', fill: true, tension: 0.4, borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 5 },
        { label: labB, data: B.data.slice(0, maxYears + 1).map(d => d.value), borderColor: '#b06cf8', backgroundColor: 'rgba(176,108,248,0.06)', fill: true, tension: 0.4, borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 5 }
      ]
    }, options: chartDefaults()
  });

  destroyChart('compare-reel');
  charts['compare-reel'] = new Chart(document.getElementById('compare-reel-chart').getContext('2d'), {
    type: 'line', data: {
      labels, datasets: [
        { label: labA + ' réel', data: A.data.slice(0, maxYears + 1).map((d, i) => d.value / Math.pow(1 + g('ca-inflation') / 100, i)), borderColor: '#4aa3e8', borderDash: [4, 3], fill: true, tension: 0.4, borderWidth: 2, backgroundColor: 'rgba(74,163,232,0.04)', pointRadius: 0, pointHoverRadius: 5 },
        { label: labB + ' réel', data: B.data.slice(0, maxYears + 1).map((d, i) => d.value / Math.pow(1 + g('cb-inflation') / 100, i)), borderColor: '#b06cf8', borderDash: [4, 3], fill: true, tension: 0.4, borderWidth: 2, backgroundColor: 'rgba(176,108,248,0.04)', pointRadius: 0, pointHoverRadius: 5 }
      ]
    }, options: chartDefaults()
  });

  destroyChart('compare-compo');
  const coOpts = chartDefaults();
  charts['compare-compo'] = new Chart(document.getElementById('compare-compo-chart').getContext('2d'), {
    type: 'bar', data: {
      labels: [labA, labB], datasets: [
        { label: 'Versements', data: [A.totalVerse, B.totalVerse], backgroundColor: 'rgba(74,163,232,0.55)', borderColor: '#4aa3e8', borderWidth: 1.5, borderRadius: 4 },
        { label: 'Gains nets', data: [A.gainsNets, B.gainsNets], backgroundColor: 'rgba(91,111,255,0.55)', borderColor: '#5b6fff', borderWidth: 1.5, borderRadius: 4 }
      ]
    }, options: { ...coOpts, scales: { x: { stacked: true, ...coOpts.scales.x }, y: { stacked: true, ...coOpts.scales.y } } }
  });

  destroyChart('compare-rente');
  charts['compare-rente'] = new Chart(document.getElementById('compare-rente-chart').getContext('2d'), {
    type: 'bar', data: {
      labels: [labA, labB], datasets: [
        { data: [A.rente, B.rente], backgroundColor: ['rgba(74,163,232,0.5)', 'rgba(176,108,248,0.5)'], borderColor: ['#4aa3e8', '#b06cf8'], borderWidth: 2, borderRadius: 8 }
      ]
    }, options: { ...chartDefaults(), plugins: { ...chartDefaults().plugins, legend: { display: false } } }
  });

  const winner = (va, vb) => {
    if (va === vb) return '—';
    const w = va > vb ? labA : labB;
    return `<span style="color:${w === labA ? '#4aa3e8' : '#b06cf8'}">▲ ${w}</span>`;
  };
  const diffs = [
    { label: 'Capital brut', a: A.final, b: B.final },
    { label: 'Capital net', a: A.capitalNet, b: B.capitalNet },
    { label: 'Capital réel', a: A.capitalReel, b: B.capitalReel },
    { label: 'Gains nets', a: A.gainsNets, b: B.gainsNets },
    { label: 'Rente/m (4%)', a: A.rente, b: B.rente },
    { label: 'Multiplicateur', a: A.totalVerse > 0 ? A.final / A.totalVerse : 0, b: B.totalVerse > 0 ? B.final / B.totalVerse : 0, isMult: true }
  ];
  document.getElementById('compare-delta').innerHTML = diffs.map(d => `
    <div class="delta-item">
      <div class="delta-label">${d.label}</div>
      <div class="delta-val" style="color:${d.a >= d.b ? '#4aa3e8' : '#b06cf8'}">${d.isMult ? (d.a - d.b).toFixed(2) + '×' : fmtN(Math.abs(d.a - d.b))}</div>
      <div class="delta-winner">Avantage ${winner(d.a, d.b)}</div>
    </div>`).join('');
}

/* ══════════════════════════════════════════
   ALLOCATION DE PORTEFEUILLE
   ══════════════════════════════════════════ */

// Données historiques estimées par classe d'actif
const ASSET_DATA = {
  actions: { label: 'Actions', rendement: 9.5, volatilite: 18, color: '#5b6fff', icon: '◆' },
  oblig: { label: 'Obligations', rendement: 3.5, volatilite: 6, color: '#4aa3e8', icon: '◈' },
  immo: { label: 'Immobilier', rendement: 6.0, volatilite: 10, color: '#d4af37', icon: '▣' },
  crypto: { label: 'Crypto', rendement: 25, volatilite: 75, color: '#f24463', icon: '◎' },
  cash: { label: 'Liquidités', rendement: 2.5, volatilite: 0.5, color: '#00c9a7', icon: '○' }
};

function getWeights() {
  const raw = {
    actions: fv('alloc-actions'),
    oblig: fv('alloc-oblig'),
    immo: fv('alloc-immo'),
    crypto: fv('alloc-crypto'),
    cash: fv('alloc-cash')
  };
  const total = Object.values(raw).reduce((s, v) => s + v, 0);
  return { weights: raw, total };
}

function applyProfile(name) {
  const profiles = {
    prudent: { actions: 20, oblig: 50, immo: 15, crypto: 0, cash: 15 },
    equilibre: { actions: 40, oblig: 20, immo: 20, crypto: 5, cash: 15 },
    dynamique: { actions: 65, oblig: 10, immo: 15, crypto: 10, cash: 0 },
    agressif: { actions: 75, oblig: 0, immo: 10, crypto: 15, cash: 0 }
  };
  const p = profiles[name];
  if (!p) return;
  Object.entries(p).forEach(([k, v]) => {
    const el = document.getElementById('alloc-' + k);
    if (el) el.value = v;
  });
  updateAllocation();
}

function calcPortfolioStats(weights) {
  const total = Object.values(weights).reduce((s, v) => s + v, 0);
  if (total === 0) return { rendement: 0, volatilite: 0, sharpe: 0, maxDD: 0 };

  // Rendement pondéré
  const rendement = Object.entries(weights).reduce((s, [k, v]) => s + (ASSET_DATA[k].rendement * v / total), 0);

  // Volatilité approx pondérée (simplifiée, sans corrélations complètes)
  const vol2 = Object.entries(weights).reduce((s, [k, v]) => s + Math.pow(ASSET_DATA[k].volatilite * v / total, 2), 0);
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
  Object.entries(weights).forEach(([k, v]) => {
    const el = document.getElementById('v-alloc-' + k);
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

  const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setText('alloc-rendement', stats.rendement.toFixed(1) + ' %/an');
  setText('alloc-risque', stats.volatilite.toFixed(1) + ' %');
  setText('alloc-sharpe', stats.sharpe.toFixed(2));
  setText('alloc-max-dd', '-' + stats.maxDD.toFixed(0) + ' %');

  // Donut
  const activeAssets = Object.entries(weights).filter(([, v]) => v > 0);
  destroyChart('alloc-pie');
  if (activeAssets.length) {
    charts['alloc-pie'] = new Chart(document.getElementById('alloc-pie-chart').getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: activeAssets.map(([k]) => ASSET_DATA[k].label),
        datasets: [{
          data: activeAssets.map(([, v]) => v),
          backgroundColor: activeAssets.map(([k]) => ASSET_DATA[k].color + 'cc'),
          borderColor: activeAssets.map(([k]) => ASSET_DATA[k].color),
          borderWidth: 1.5
        }]
      },
      options: { responsive: true, maintainAspectRatio: false, cutout: '55%', plugins: { legend: { labels: { color: '#a8b0d0', font: { family: 'DM Mono', size: 10 }, boxWidth: 8, padding: 8, usePointStyle: true } }, tooltip: { backgroundColor: '#0b0d17', borderColor: 'rgba(91,111,255,0.4)', borderWidth: 1, titleColor: '#8a9bff', bodyColor: '#a8b0d0', padding: 12, cornerRadius: 8, bodyFont: { family: 'DM Mono, monospace', size: 12 }, callbacks: { label: c => '  ' + c.label + ' : ' + c.raw + '%' } } } }
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
  const capital = fv('alloc-capital') || 10000;
  const monthly = fv('alloc-monthly') || 300;
  const years = iv('alloc-years') || 20;
  const labels = Array.from({ length: years + 1 }, (_, i) => `An ${i}`);

  const scenarios = [
    { label: 'Pessimiste', taux: Math.max(0.5, rendement - volatilite * 0.5), color: '#f24463', dash: [4, 4] },
    { label: 'Base', taux: rendement, color: '#5b6fff', dash: [] },
    { label: 'Optimiste', taux: rendement + volatilite * 0.3, color: '#00c9a7', dash: [2, 2] }
  ];

  const datasets = scenarios.map(sc => {
    const data = [];
    let cur = capital;
    for (let y = 0; y <= years; y++) {
      if (y > 0) {
        const r = sc.taux / 100 / 12;
        for (let m = 0; m < 12; m++) cur = cur * (1 + r) + monthly;
      }
      data.push(cur);
    }
    return { label: sc.label + ` (${sc.taux.toFixed(1)}%)`, data, borderColor: sc.color, backgroundColor: sc.color + '10', borderWidth: 2, fill: sc.label === 'Base', tension: 0.4, pointRadius: 0, pointHoverRadius: 5, borderDash: sc.dash };
  });

  // Versements ligne
  const versData = [];
  let v = capital;
  for (let y = 0; y <= years; y++) { versData.push(v); if (y < years) v += monthly * 12; }
  datasets.push({ label: 'Versements', data: versData, borderColor: '#5e6685', borderDash: [5, 5], borderWidth: 1.2, fill: false, tension: 0, pointRadius: 0, pointHoverRadius: 3 });

  destroyChart('alloc-proj');
  charts['alloc-proj'] = new Chart(document.getElementById('alloc-proj-chart').getContext('2d'), {
    type: 'line',
    data: { labels, datasets },
    options: chartDefaults()
  });
}

function renderAllocScatter(weights, total) {
  const allPoints = Object.entries(ASSET_DATA).map(([k, d]) => ({
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
    type: 'bubble',
    data: {
      datasets: [
        ...allPoints.map(p => ({
          label: p.label + (p.weight > 0 ? ` (${p.weight}%)` : ''),
          data: [{ x: p.x, y: p.y, r: p.weight > 0 ? Math.max(6, p.weight / 4) : 5 }],
          backgroundColor: p.allocated ? p.color + '88' : p.color + '33',
          borderColor: p.color,
          borderWidth: p.allocated ? 2 : 1
        })),
        {
          label: portfolioPoint.label,
          data: [{ x: portfolioPoint.x, y: portfolioPoint.y, r: 12 }],
          backgroundColor: portfolioPoint.color + '88',
          borderColor: portfolioPoint.color,
          borderWidth: 2.5
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#a8b0d0', font: { family: 'DM Mono', size: 10 }, boxWidth: 8, usePointStyle: true, padding: 10 } },
        tooltip: {
          backgroundColor: '#0b0d17', borderColor: 'rgba(91,111,255,0.4)', borderWidth: 1, titleColor: '#8a9bff', bodyColor: '#a8b0d0', padding: 12, cornerRadius: 8, bodyFont: { family: 'DM Mono, monospace', size: 12 }, callbacks: {
            label: c => `  ${c.dataset.label} — Vol: ${c.raw.x}% | Rend: ${c.raw.y}%`
          }
        }
      },
      scales: {
        x: { title: { display: true, text: 'Volatilité (%)', color: '#5e6685', font: { family: 'DM Mono, monospace', size: 10 } }, ticks: { color: '#5e6685', font: { family: 'DM Mono, monospace', size: 10 }, callback: v => v + '%' }, grid: { color: 'rgba(91,111,255,0.05)' } },
        y: { title: { display: true, text: 'Rendement annuel (%)', color: '#5e6685', font: { family: 'DM Mono, monospace', size: 10 } }, ticks: { color: '#5e6685', font: { family: 'DM Mono, monospace', size: 10 }, callback: v => v + '%' }, grid: { color: 'rgba(91,111,255,0.05)' } }
      }
    }
  });
}

function renderAllocDetailTable(weights, total, stats) {
  const container = document.getElementById('alloc-detail-table');
  if (!container) return;

  const rows = Object.entries(ASSET_DATA).map(([k, d]) => {
    const w = weights[k] || 0;
    const contrib_r = total > 0 ? (d.rendement * w / total).toFixed(2) : '0.00';
    const contrib_v = total > 0 ? (d.volatilite * w / total).toFixed(2) : '0.00';
    return `<tr style="${w > 0 ? '' : 'opacity:0.4'}">
      <td><span style="color:${d.color}">${d.icon}</span> ${d.label}</td>
      <td style="text-align:center;font-family:var(--font-mono);color:${w > 0 ? 'var(--t1)' : 'var(--t2)'};font-weight:${w > 0 ? 700 : 400}">${w}%</td>
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
        <td style="text-align:center;font-family:var(--font-mono);font-weight:700;color:${total === 100 ? 'var(--teal)' : 'var(--red)'}">${total}%</td>
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
  // Les KPIs home se mettent à jour uniquement via les simulateurs, pas depuis le cache
}

/* ══ INIT ══ */
function init() {
  // Vider le localStorage pour repartir à zéro à chaque démarrage
  try { localStorage.clear(); } catch(e) {}
  initBudget();
  updateEnvelopeInfo('pea', 'envelope-info-box');
}
init();



/* ══════════════════════════════════════════
   ACADÉMIE — DONNÉES & LOGIQUE
══════════════════════════════════════════ */

const ACAD_TERMS = [
  // BASES
  {
    id: 'capital',
    titre: 'Capital',
    categorie: 'base',
    icon: '◆',
    def: 'Somme d\'argent que vous investissez ou possédez. C\'est la base de toute stratégie d\'investissement.',
    exemple: 'Vous avez 5 000 € d\'économies sur votre livret A. Ces 5 000 € constituent votre capital de départ.',
    formule: 'Capital final = Capital initial × (1 + r)^n',
    couleurEx: 'teal'
  },
  {
    id: 'ic',
    titre: 'Intérêts composés',
    categorie: 'base',
    icon: '◈',
    def: 'Les intérêts que vous gagnez génèrent eux-mêmes des intérêts. C\'est l\'effet "boule de neige" : plus le temps passe, plus la croissance s\'accélère.',
    exemple: '1 000 € à 7%/an pendant 10 ans donnent 1 967 € (et non 1 700 €). Les 967 € de gains incluent des intérêts sur les intérêts.',
    formule: 'Capital = Capital × (1 + r/12)^(12×n) + mensualité × [(1+r/12)^(12×n) - 1]/(r/12)',
    couleurEx: 'teal'
  },
  {
    id: 'dividende',
    titre: 'Dividende',
    categorie: 'base',
    icon: '○',
    def: 'Part des bénéfices d\'une entreprise versée à ses actionnaires. C\'est un revenu passif régulier issu de vos actions.',
    exemple: 'Vous détenez 100 actions Total à 50 €. Total verse 3 €/action de dividende annuel → vous recevez 300 € sans rien vendre.',
    formule: 'Rendement dividende = Dividende annuel / Prix de l\'action × 100',
    couleurEx: 'gold'
  },
  {
    id: 'action',
    titre: 'Action',
    categorie: 'base',
    icon: '▲',
    def: 'Part de propriété dans une entreprise. En achetant une action, vous devenez actionnaire (propriétaire d\'une fraction de la société).',
    exemple: 'Apple a environ 15 milliards d\'actions en circulation. Si vous en achetez 1 à 180 $, vous possédez 0,0000000067% d\'Apple.',
    formule: null,
    couleurEx: null
  },
  {
    id: 'obligation',
    titre: 'Obligation',
    categorie: 'base',
    icon: '◇',
    def: 'Titre de créance : vous prêtez de l\'argent à une entreprise ou un État, qui vous rembourse avec des intérêts (le "coupon"). Moins risqué que l\'action mais rendement plus faible.',
    exemple: 'OAT France à 10 ans : l\'État vous emprunte 1 000 €, vous verse 3%/an (30 €/an) et vous rembourse 1 000 € au bout de 10 ans.',
    formule: 'Prix obligation ≈ Coupon / Taux marché (relation inverse)',
    couleurEx: 'teal'
  },
  {
    id: 'etf',
    titre: 'ETF (Tracker)',
    categorie: 'base',
    icon: '◉',
    def: 'Fonds indiciel coté en bourse qui réplique un indice (CAC 40, S&P 500…). Permet de diversifier en achetant un seul produit à faible coût.',
    exemple: 'En achetant 1 part du Lyxor CAC 40 pour ~75 €, vous investissez indirectement dans les 40 plus grandes entreprises françaises simultanément.',
    formule: null,
    couleurEx: 'teal'
  },

  // RENDEMENT
  {
    id: 'taux-rendement',
    titre: 'Taux de rendement',
    categorie: 'rendement',
    icon: '◈',
    def: 'Gain ou perte d\'un investissement exprimé en pourcentage du capital investi sur une période donnée.',
    exemple: 'Vous investissez 1 000 €, qui deviennent 1 080 € en un an. Votre taux de rendement est de +8%.',
    formule: 'Rendement = (Valeur finale - Valeur initiale) / Valeur initiale × 100',
    couleurEx: 'teal'
  },
  {
    id: 'plus-value',
    titre: 'Plus-value',
    categorie: 'rendement',
    icon: '◆',
    def: 'Gain réalisé lors de la vente d\'un actif à un prix supérieur à son prix d\'achat. C\'est la différence entre le prix de cession et le prix de revient.',
    exemple: 'Vous achetez une action LVMH à 700 € et la revendez à 850 €. Votre plus-value est de 150 € (21,4%). Elle est soumise à l\'impôt.',
    formule: 'Plus-value = Prix de vente - Prix d\'achat (- frais)',
    couleurEx: 'gold'
  },
  {
    id: 'cagr',
    titre: 'CAGR (Taux annualisé)',
    categorie: 'rendement',
    icon: '◇',
    def: 'Taux de croissance annuel composé : le taux constant qui explique l\'évolution d\'un placement sur plusieurs années. Permet de comparer des placements sur des durées différentes.',
    exemple: 'Votre portefeuille passe de 10 000 € à 19 487 € en 7 ans. Le CAGR est de 10%/an — même si certaines années étaient à +30% et d\'autres à -15%.',
    formule: 'CAGR = (Valeur finale / Valeur initiale)^(1/n) - 1',
    couleurEx: 'teal'
  },
  {
    id: 'rendement-reel',
    titre: 'Rendement réel',
    categorie: 'rendement',
    icon: '○',
    def: 'Rendement nominal corrigé de l\'inflation. Ce qui compte vraiment : ce que vous pouvez acheter avec votre argent, pas juste les chiffres.',
    exemple: 'Votre livret rapporte 3%/an mais l\'inflation est à 4%. Votre rendement réel est de -1% : vous perdez du pouvoir d\'achat malgré les intérêts.',
    formule: 'Rendement réel ≈ Rendement nominal - Inflation (approximation de Fisher)',
    couleurEx: 'red'
  },
  {
    id: 'regle72',
    titre: 'Règle des 72',
    categorie: 'rendement',
    icon: '▣',
    def: 'Astuce de calcul mental pour estimer le temps de doublement de votre capital : divisez 72 par le taux de rendement annuel.',
    exemple: 'À 6%/an → 72 / 6 = 12 ans pour doubler votre argent. À 9%/an → 72 / 9 = 8 ans. À 12%/an → 72 / 12 = 6 ans.',
    formule: 'Durée doublement (ans) ≈ 72 / Taux annuel (%)',
    couleurEx: 'gold'
  },
  {
    id: 'rente',
    titre: 'Rente (règle des 4%)',
    categorie: 'rendement',
    icon: '◈',
    def: 'Revenu régulier tiré de votre capital. La règle des 4% stipule que vous pouvez retirer 4% de votre capital chaque année sans l\'épuiser sur 30 ans.',
    exemple: 'Avec un capital de 500 000 €, la règle des 4% vous permet de retirer 20 000 €/an (1 667 €/mois) indéfiniment — selon l\'étude Trinity.',
    formule: 'Rente annuelle = Capital × 4% | Capital nécessaire = Dépenses × 25',
    couleurEx: 'teal'
  },

  // RISQUE
  {
    id: 'volatilite',
    titre: 'Volatilité',
    categorie: 'risque',
    icon: '▲',
    def: 'Mesure des variations du prix d\'un actif. Une forte volatilité signifie des hausses et baisses importantes. C\'est le principal indicateur de risque d\'un placement.',
    exemple: 'Le Bitcoin a une volatilité de ~70% : il peut perdre ou gagner 70% en un an. Le fonds euros d\'une AV a ~0% de volatilité.',
    formule: 'Volatilité = Écart-type des rendements annuels',
    couleurEx: 'red'
  },
  {
    id: 'drawdown',
    titre: 'Drawdown (chute max)',
    categorie: 'risque',
    icon: '◌',
    def: 'Baisse maximale d\'un portefeuille depuis son sommet jusqu\'à son point le plus bas. Mesure le pire scénario historique que vous auriez subi.',
    exemple: 'Le S&P 500 a subi un drawdown de -57% en 2008-2009. Un portefeuille de 100 000 € serait descendu à 43 000 €. Il a fallu 5 ans pour récupérer.',
    formule: 'Drawdown = (Pic - Creux) / Pic × 100',
    couleurEx: 'red'
  },
  {
    id: 'diversification',
    titre: 'Diversification',
    categorie: 'risque',
    icon: '⊞',
    def: 'Répartir ses investissements sur plusieurs actifs, secteurs ou zones géographiques pour réduire le risque global sans sacrifier le rendement.',
    exemple: 'Si vous avez tout misé sur Nokia en 2000, vous perdez 95%. Avec 50 entreprises tech mondiales (via ETF), le risque est dilué et la performance préservée.',
    formule: null,
    couleurEx: 'teal'
  },
  {
    id: 'correlation',
    titre: 'Corrélation',
    categorie: 'risque',
    icon: '◎',
    def: 'Mesure entre -1 et +1 qui indique si deux actifs évoluent ensemble (+1 = identique) ou en sens contraire (-1 = parfaitement opposés). La diversification fonctionne mieux avec des actifs peu corrélés.',
    exemple: 'Actions et obligations ont souvent une corrélation négative : quand la bourse chute, les obligations montent. C\'est pourquoi un portefeuille 60/40 est moins volatil.',
    formule: 'ρ = -1 (oppose) → 0 (indépendant) → +1 (identique)',
    couleurEx: 'teal'
  },
  {
    id: 'sharpe',
    titre: 'Ratio de Sharpe',
    categorie: 'risque',
    icon: '◉',
    def: 'Mesure la performance d\'un investissement en tenant compte du risque pris. Plus le ratio est élevé, meilleure est la performance ajustée au risque.',
    exemple: 'Portefeuille A : 12% de rendement, 20% de volatilité → Sharpe = (12-3)/20 = 0,45. Portefeuille B : 9% de rendement, 8% de volatilité → Sharpe = (9-3)/8 = 0,75. B est meilleur.',
    formule: 'Sharpe = (Rp - Rf) / σp | Rp=rendement, Rf=sans risque, σ=volatilité',
    couleurEx: 'gold'
  },
  {
    id: 'beta',
    titre: 'Bêta (β)',
    categorie: 'risque',
    icon: 'β',
    def: 'Mesure la sensibilité d\'un actif aux mouvements du marché. β=1 : évolue comme le marché. β>1 : amplifie les mouvements. β<1 : moins sensible.',
    exemple: 'Une action avec β=1,5 monte de 15% si le marché monte de 10% — mais perd aussi 15% si le marché perd 10%. β=0,5 → mouvement deux fois moins fort.',
    formule: 'β > 1 : agressif | β = 1 : neutre | β < 1 : défensif | β < 0 : inverse',
    couleurEx: 'red'
  },

  // FISCALITÉ
  {
    id: 'pfu',
    titre: 'PFU / Flat Tax (30%)',
    categorie: 'fiscalite',
    icon: '○',
    def: 'Prélèvement Forfaitaire Unique de 30% sur les revenus du capital (12,8% d\'impôt + 17,2% de prélèvements sociaux). S\'applique aux dividendes et plus-values du CTO.',
    exemple: 'Vous réalisez 5 000 € de plus-values sur un CTO. Vous payez 30% = 1 500 € d\'impôt. Il vous reste 3 500 €.',
    formule: 'PFU = Gains × 30% (12,8% IR + 17,2% PS)',
    couleurEx: 'gold'
  },
  {
    id: 'pea',
    titre: 'PEA — avantage fiscal',
    categorie: 'fiscalite',
    icon: '◉',
    def: 'Après 5 ans de détention, les gains du PEA sont exonérés d\'impôt sur le revenu (seuls les 17,2% de prélèvements sociaux restent dus). Plafond de versements : 150 000 €.',
    exemple: 'Vous investissez 50 000 € dans un PEA qui devient 120 000 €. Gains = 70 000 €. Au CTO : 21 000 € d\'impôt. Au PEA après 5 ans : 12 040 € seulement (PS uniquement).',
    formule: 'Impôt PEA (après 5 ans) = Gains × 17,2% (PS seulement)',
    couleurEx: 'teal'
  },
  {
    id: 'av-fiscalite',
    titre: 'Assurance-vie — fiscalité',
    categorie: 'fiscalite',
    icon: '◎',
    def: 'Après 8 ans, bénéficiez d\'un abattement annuel de 4 600 € (9 200 € pour un couple) sur les gains. Au-delà : 7,5% d\'IR + 17,2% PS (si encours < 150k€).',
    exemple: 'Votre AV génère 10 000 € de gains. Après 8 ans : les premiers 4 600 € sont totalement exonérés. Le reste (5 400 €) est taxé à 24,7% = 1 334 €.',
    formule: 'Gains imposables = Gains totaux - Abattement 4 600 € | Taux : 7,5% + 17,2%',
    couleurEx: 'gold'
  },
  {
    id: 'per-deductible',
    titre: 'PER — déductibilité',
    categorie: 'fiscalite',
    icon: '◈',
    def: 'Les versements sur un PER sont déductibles de votre revenu imposable (jusqu\'à 10% du revenu, max ~35 000 €/an). Avantage fiscal immédiat, mais impôt reporté à la sortie.',
    exemple: 'TMI 30%, vous versez 5 000 € dans un PER → 1 500 € d\'impôt économisé cette année. À la retraite avec TMI 11%, l\'imposition sera plus légère.',
    formule: 'Économie impôt = Versement × TMI actuel | Gain = si TMI retraite < TMI actuel',
    couleurEx: 'purple'
  },
  {
    id: 'tmi',
    titre: 'TMI — Tranche Marginale',
    categorie: 'fiscalite',
    icon: '▣',
    def: 'Taux d\'imposition applicable à votre dernière tranche de revenus. En France : 0%, 11%, 30%, 41%, 45%. Seuls les revenus au-delà du seuil sont taxés à ce taux.',
    exemple: 'Revenus imposables : 40 000 €. TMI = 30%. Mais seuls les revenus entre 27 479 € et 40 000 € (soit 12 521 €) sont taxés à 30%. Les premiers 27 479 € sont taxés à des taux inférieurs.',
    formule: 'Tranches 2024 : 0% (< 10 778€) / 11% / 30% / 41% / 45% (> 168 994€)',
    couleurEx: 'red'
  },

  // STRATÉGIE
  {
    id: 'dca',
    titre: 'DCA — Investissement régulier',
    categorie: 'strategie',
    icon: '◇',
    def: 'Dollar-Cost Averaging : investir un montant fixe à intervalle régulier (chaque mois), quelle que soit l\'évolution des marchés. Réduit l\'impact du "mauvais timing".',
    exemple: 'Plutôt que d\'investir 12 000 € en une fois, vous investissez 1 000 €/mois. Les mois où le marché est bas, vous achetez plus de parts. Votre prix moyen s\'optimise.',
    formule: 'Prix moyen = Σ(Montant investi) / Σ(Parts achetées)',
    couleurEx: 'teal'
  },
  {
    id: 'horizon',
    titre: 'Horizon de placement',
    categorie: 'strategie',
    icon: '▲',
    def: 'Durée pendant laquelle vous comptez laisser votre argent investi. Plus l\'horizon est long, plus vous pouvez prendre de risques (et espérer de meilleurs rendements).',
    exemple: 'Court terme (<3 ans) → Livret A, fonds euros. Moyen terme (3-10 ans) → Mix obligations/actions. Long terme (>10 ans) → ETF actions mondiales, immobilier.',
    formule: null,
    couleurEx: 'teal'
  },
  {
    id: 'reequilibrage',
    titre: 'Rééquilibrage',
    categorie: 'strategie',
    icon: '⊞',
    def: 'Ajustement périodique de votre portefeuille pour revenir à l\'allocation cible. On vend ce qui a surperformé, on achète ce qui a sous-performé.',
    exemple: 'Cible : 70% actions / 30% obligations. Après une bonne année boursière : 80% / 20%. Vous vendez 10% d\'actions et achetez 10% d\'obligations pour revenir à 70/30.',
    formule: null,
    couleurEx: 'gold'
  },
  {
    id: 'investissement-passif',
    titre: 'Gestion passive vs active',
    categorie: 'strategie',
    icon: '◉',
    def: 'Passive : suivre un indice via ETF (faibles frais, performance proche du marché). Active : chercher à "battre le marché" via sélection de titres (frais élevés, moins de 20% des fonds actifs surperforment sur 15 ans).',
    exemple: 'Fonds actif : 1,5%/an de frais, 7% de performance = 5,5% nets. ETF passif : 0,1% de frais, 7% de performance = 6,9% nets. Sur 30 ans sur 10 000 € : +31 000 € d\'écart.',
    formule: 'Impact frais sur 30 ans : 10 000 € × [(1+0,069)^30 - (1+0,055)^30] ≈ 31 000€',
    couleurEx: 'purple'
  },
  {
    id: 'levier',
    titre: 'Effet de levier',
    categorie: 'strategie',
    icon: '▣',
    def: 'Utiliser de la dette pour augmenter la mise investie et potentiellement amplifier les gains. Amplifie aussi les pertes : outil à double tranchant.',
    exemple: 'Vous avez 50 000 € et empruntez 50 000 € pour investir 100 000 €. +10% de performance → vous gagnez 10 000 € (20% sur votre mise). -10% → vous perdez 10 000 € (20% de perte sur votre mise).',
    formule: 'Rendement avec levier = Rendement actif × Levier - Coût dette × (Levier-1)',
    couleurEx: 'red'
  },
  {
    id: 'valeur-intrinsèque',
    titre: 'Valeur intrinsèque & PER',
    categorie: 'strategie',
    icon: '◌',
    def: 'Le Price-Earning Ratio (PER ou P/E) compare le cours d\'une action à ses bénéfices. Il indique combien les investisseurs paient pour 1 € de bénéfice. Aide à évaluer si une action est chère ou bon marché.',
    exemple: 'Action à 100 €, bénéfice par action = 5 €. PER = 100/5 = 20. Cela signifie que vous payez 20 fois les bénéfices annuels. PER moyen historique S&P 500 : ~16-17.',
    formule: 'PER = Prix de l\'action / Bénéfice par action (BPA)',
    couleurEx: 'gold'
  },

  // MICROÉCONOMIE
  {
    id: 'offre-demande',
    titre: 'Offre & Demande',
    categorie: 'micro',
    icon: '◆',
    def: 'La loi fondamentale de l\'économie : quand la demande dépasse l\'offre, les prix montent. Quand l\'offre dépasse la demande, les prix baissent. Tout marché (actions, immobilier, matières premières) obéit à cette loi.',
    exemple: 'En 2020-2021, la pénurie de puces électroniques (offre faible) face à une demande explosive a multiplié le prix des voitures neuves par 1,3 en moyenne.',
    formule: 'Prix d\'équilibre = point où Quantité offerte = Quantité demandée',
    couleurEx: 'teal'
  },
  {
    id: 'elasticite',
    titre: 'Élasticité-prix',
    categorie: 'micro',
    icon: '◈',
    def: 'Mesure la sensibilité de la demande à une variation de prix. Un produit "inélastique" se vend autant même si le prix monte (essence, médicaments). Un produit "élastique" voit sa demande chuter si le prix augmente.',
    exemple: 'L\'essence est inélastique : +20% de prix → -5% de consommation. Un voyage en avion low-cost est élastique : +20% de prix → -40% de réservations.',
    formule: 'Élasticité = % variation quantité demandée / % variation prix',
    couleurEx: 'gold'
  },
  {
    id: 'cout-opportunite',
    titre: 'Coût d\'opportunité',
    categorie: 'micro',
    icon: '◇',
    def: 'Ce que vous sacrifiez en choisissant une option plutôt qu\'une autre. Le "vrai" coût d\'un choix inclut toujours ce à quoi vous renoncez.',
    exemple: 'Laisser 50 000 € sur un livret A à 3% plutôt que dans un ETF à 8% = coût d\'opportunité de 5%/an, soit 2 500 €/an de manque à gagner.',
    formule: 'Coût d\'opportunité = Valeur de la meilleure alternative non choisie',
    couleurEx: 'purple'
  },
  {
    id: 'rendements-echelle',
    titre: 'Rendements décroissants',
    categorie: 'micro',
    icon: '▣',
    def: 'Loi économique : au-delà d\'un certain seuil, chaque unité supplémentaire d\'un facteur produit de moins en moins de résultat. S\'applique au travail, au capital, et même à l\'épargne (diversification).',
    exemple: 'Un agriculteur avec 1 employé double sa production. Avec 10 employés, il la multiplie par 6 (pas par 10). Chaque travailleur supplémentaire apporte moins que le précédent.',
    formule: 'Productivité marginale diminue à mesure que le facteur augmente',
    couleurEx: 'red'
  },
  {
    id: 'externalites',
    titre: 'Externalités',
    categorie: 'micro',
    icon: '○',
    def: 'Effets d\'une activité économique sur des tiers non impliqués dans la transaction. Positives (recherche, éducation) ou négatives (pollution). Les externalités créent des inefficacités que les marchés seuls ne corrigent pas.',
    exemple: 'Une usine qui pollue une rivière transfère son coût de production à la société. C\'est une externalité négative — le prix de ses produits ne reflète pas le vrai coût social.',
    formule: null,
    couleurEx: 'teal'
  },

  // MACROÉCONOMIE
  {
    id: 'pib',
    titre: 'PIB — Produit Intérieur Brut',
    categorie: 'macro',
    icon: '◉',
    def: 'Mesure de la richesse produite par un pays en un an. C\'est l\'indicateur macroéconomique le plus suivi. Sa croissance indique la santé de l\'économie ; sa contraction (deux trimestres consécutifs) définit une récession.',
    exemple: 'France 2023 : PIB ≈ 2 800 Mds€. Croissance de +0,9%. USA : 27 000 Mds$, soit ~10× la France. Un PIB/habitant élevé traduit un niveau de vie plus élevé.',
    formule: 'PIB = Consommation + Investissement + Dépenses publiques + (Exports - Imports)',
    couleurEx: 'teal'
  },
  {
    id: 'inflation-macro',
    titre: 'Inflation & Déflation',
    categorie: 'macro',
    icon: '▲',
    def: 'L\'inflation est la hausse générale et durable des prix, qui érode le pouvoir d\'achat. La déflation (baisse des prix) paraît positive mais est dangereuse : elle pousse les consommateurs à reporter leurs achats, paralysant l\'économie.',
    exemple: 'Zone euro 2022 : inflation à 8,4% (choc énergétique post-Ukraine). Un panier de 1 000 € en 2021 coûtait 1 084 € en 2022. Les banques centrales visent 2% d\'inflation.',
    formule: 'IPC = (Panier année N / Panier année N-1 - 1) × 100',
    couleurEx: 'red'
  },
  {
    id: 'taux-directeur',
    titre: 'Taux directeur (BCE / Fed)',
    categorie: 'macro',
    icon: '◎',
    def: 'Taux d\'intérêt fixé par la banque centrale pour piloter l\'économie. Hausse des taux → crédit plus cher → moins d\'emprunts → moins d\'inflation. Baisse des taux → crédit moins cher → plus d\'investissement → relance.',
    exemple: 'La Fed est passée de 0,25% en 2022 à 5,5% en 2023 pour combattre l\'inflation. Résultat : les crédits immobiliers US sont passés de 3% à 7,5%, refroidissant le marché.',
    formule: 'Taux crédit bancaire ≈ Taux directeur + marge de risque',
    couleurEx: 'gold'
  },
  {
    id: 'politique-monetaire',
    titre: 'Politique monétaire',
    categorie: 'macro',
    icon: '◈',
    def: 'Actions de la banque centrale sur la masse monétaire et les taux d\'intérêt pour atteindre ses objectifs (stabilité des prix, croissance). Deux outils : taux directeurs et création monétaire (QE).',
    exemple: 'QE (Quantitative Easing) : la BCE a acheté 3 000 Mds€ d\'obligations entre 2015 et 2022, injectant des liquidités pour relancer l\'économie. Effet secondaire : inflation des actifs (immobilier, actions).',
    formule: null,
    couleurEx: 'purple'
  },
  {
    id: 'politique-budgetaire',
    titre: 'Politique budgétaire',
    categorie: 'macro',
    icon: '▣',
    def: 'Utilisation des dépenses publiques et de la fiscalité par l\'État pour influencer l\'économie. Politique expansive (déficit) en récession pour relancer. Politique restrictive (austérité) pour réduire la dette.',
    exemple: 'France 2020 (Covid) : déficit public à -9% du PIB avec le "quoi qu\'il en coûte". L\'État a injecté ~170 Mds€ (chômage partiel, prêts garantis) pour sauver l\'économie.',
    formule: 'Solde budgétaire = Recettes fiscales - Dépenses publiques',
    couleurEx: 'gold'
  },
  {
    id: 'cycle-economique',
    titre: 'Cycle économique',
    categorie: 'macro',
    icon: '◌',
    def: 'L\'économie traverse des phases régulières : expansion (croissance), pic (surchauffe), contraction (ralentissement), creux (récession). Comprendre la phase du cycle aide à orienter ses investissements.',
    exemple: 'En expansion → actions et immobilier surperforment. En récession → obligations d\'État et or se défendent mieux. En reprise → valeurs cycliques (auto, luxe) rebondissent fort.',
    formule: 'Expansion → Pic → Contraction → Creux → Reprise → Expansion…',
    couleurEx: 'teal'
  },
  {
    id: 'chomage',
    titre: 'Chômage & Courbe de Phillips',
    categorie: 'macro',
    icon: '◆',
    def: 'La courbe de Phillips décrit la relation inverse historique entre chômage et inflation : moins de chômage = plus d\'inflation (salaires plus élevés → hausse des prix). Ce trade-off guide les décisions des banques centrales.',
    exemple: 'USA 2022 : chômage à 3,5% (quasi plein emploi) et inflation à 9%. La Fed a relevé ses taux pour créer du chômage et casser l\'inflation — arbitrage douloureux mais classique.',
    formule: 'π = πe - α(u - u*) | π=inflation, u=chômage, u*=chômage naturel',
    couleurEx: 'red'
  },
  {
    id: 'balance-commerciale',
    titre: 'Balance commerciale',
    categorie: 'macro',
    icon: '⊞',
    def: 'Différence entre les exportations et importations d\'un pays. Un excédent (exports > imports) renforce la monnaie nationale. Un déficit (imports > exports) l\'affaiblit et peut indiquer une dépendance extérieure.',
    exemple: 'Allemagne : excédent commercial record de +250 Mds€/an grâce à ses exportations industrielles. France : déficit de -100 Mds€/an, signe d\'une désindustrialisation partielle.',
    formule: 'Balance commerciale = Valeur exports - Valeur imports',
    couleurEx: 'teal'
  },
  {
    id: 'taux-change',
    titre: 'Taux de change',
    categorie: 'macro',
    icon: '◎',
    def: 'Prix d\'une devise exprimé en une autre. Il impacte directement vos investissements internationaux. Un euro fort réduit vos gains sur des actifs en dollars. Un euro faible les amplifie.',
    exemple: 'EUR/USD = 1,10 → 1 € = 1,10 $. Si vous investissez 10 000 € dans un ETF S&P 500 et que l\'euro monte à 1,20, vos gains en dollars sont amputés de ~8% lors de la conversion.',
    formule: 'Rendement réel = Rendement actif + Variation taux de change',
    couleurEx: 'gold'
  },
];

const ACAD_LEXIQUE_DATA = [
  { abbr: 'ETF', full: 'Exchange-Traded Fund', desc: 'Fonds indiciel coté en bourse' },
  { abbr: 'AV', full: 'Assurance-Vie', desc: 'Enveloppe fiscale française' },
  { abbr: 'PEA', full: 'Plan d\'Épargne en Actions', desc: 'Enveloppe fiscale — plafond 150k€' },
  { abbr: 'PER', full: 'Plan d\'Épargne Retraite', desc: 'Épargne retraite déductible' },
  { abbr: 'CTO', full: 'Compte-Titres Ordinaire', desc: 'Sans avantage fiscal (PFU 30%)' },
  { abbr: 'SCPI', full: 'Société Civile de Placement Immobilier', desc: 'Immobilier locatif mutualisé' },
  { abbr: 'REIT', full: 'Real Estate Investment Trust', desc: 'Foncière cotée (version US des SCPI)' },
  { abbr: 'TRI', full: 'Taux de Rendement Interne', desc: 'Rendement annualisé réel d\'un projet' },
  { abbr: 'VAN', full: 'Valeur Actuelle Nette', desc: 'Valeur actuelle de flux futurs actualisés' },
  { abbr: 'CAC 40', full: 'Cotation Assistée en Continu', desc: 'Indice des 40 plus grandes capitalisations françaises' },
  { abbr: 'S&P 500', full: 'Standard & Poor\'s 500', desc: 'Indice des 500 plus grandes capitalisations US' },
  { abbr: 'BPA', full: 'Bénéfice Par Action', desc: 'Bénéfice net / nombre d\'actions' },
  { abbr: 'OAT', full: 'Obligation Assimilable du Trésor', desc: 'Emprunt d\'État français' },
  { abbr: 'OPCVM', full: 'Organisme de Placement Collectif en Valeurs Mobilières', desc: 'Fonds d\'investissement collectif' },
  { abbr: 'TMI', full: 'Tranche Marginale d\'Imposition', desc: 'Taux d\'impôt sur la dernière tranche' },
  { abbr: 'PS', full: 'Prélèvements Sociaux', desc: '17,2% sur les revenus du capital' },
  { abbr: 'DCA', full: 'Dollar-Cost Averaging', desc: 'Investissement régulier programmé' },
  { abbr: 'CAGR', full: 'Compound Annual Growth Rate', desc: 'Taux de croissance annuel composé' },
];

let _acadFilter = 'tous';
let _acadSearch = '';

function initAcademie() {
  renderAcadGrid();
  renderLexique();
  calcIC();
  calcR72();
  calcInf();
  calcSharpe();
}

function filterAcad(cat, btn) {
  _acadFilter = cat;
  document.querySelectorAll('.acad-filter').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderAcadGrid();
}

function searchAcad(q) {
  _acadSearch = q.toLowerCase().trim();
  renderAcadGrid();
}

function renderAcadGrid() {
  const grid = document.getElementById('acad-grid');
  if (!grid) return;
  let terms = ACAD_TERMS;
  if (_acadFilter !== 'tous') terms = terms.filter(t => t.categorie === _acadFilter);
  if (_acadSearch) terms = terms.filter(t =>
    t.titre.toLowerCase().includes(_acadSearch) ||
    t.def.toLowerCase().includes(_acadSearch) ||
    t.categorie.toLowerCase().includes(_acadSearch)
  );
  const countEl = document.getElementById('acad-count');
  if (countEl) countEl.textContent = `${terms.length} terme${terms.length > 1 ? 's' : ''} affiché${terms.length > 1 ? 's' : ''}`;
  grid.innerHTML = terms.map(t => acadCard(t)).join('');
}

function acadCard(t) {
  const tagLabels = { base: 'Bases', rendement: 'Rendement', risque: 'Risque', fiscalite: 'Fiscalité', strategie: 'Stratégie', micro: 'Microéconomie',   
  macro: 'Macroéconomie' };
  return `<div class="acad-card" id="card-${t.id}" onclick="toggleAcadCard('${t.id}')">
    <div class="acad-toggle-icon">▾</div>
    <div class="acad-card-top">
      <div class="acad-card-icon ${t.categorie}">${t.icon}</div>
      <div class="acad-card-head">
        <div class="acad-card-titre">${t.titre}</div>
        <span class="acad-card-tag ${t.categorie}">${tagLabels[t.categorie] || t.categorie}</span>
      </div>
    </div>
    <div class="acad-card-def">${t.def}</div>
    <div class="acad-card-expand">
      <div class="acad-card-expand-inner">
        <div class="acad-example-label">Exemple concret</div>
        <div class="acad-example ${t.couleurEx || ''}">${t.exemple}</div>
        ${t.formule ? `<div class="acad-example-label" style="margin-top:10px">Formule clé</div><div class="acad-formula">${t.formule}</div>` : ''}
      </div>
    </div>
  </div>`;
}

function toggleAcadCard(id) {
  const card = document.getElementById('card-' + id);
  if (!card) return;
  card.classList.toggle('expanded');
}

function renderLexique() {
  const el = document.getElementById('acad-lexique');
  if (!el) return;
  el.innerHTML = ACAD_LEXIQUE_DATA.map(l => `
    <div class="lex-item">
      <div class="lex-abbr">${l.abbr}</div>
      <div class="lex-full">${l.full}</div>
      <div class="lex-desc">${l.desc}</div>
    </div>`).join('');
}

/* ── Calculettes ── */
function switchCalcTab(tab, btn) {
  document.querySelectorAll('.acad-ctab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.acad-calc-pane').forEach(p => p.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const pane = document.getElementById('calc-' + tab);
  if (pane) pane.classList.add('active');
}

function fmtAcad(n) {
  if (!isFinite(n)) return '—';
  return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' €';
}

function setAcadResults(id, items) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = items.map(item => {
    if (item.type === 'verdict') return `<div class="acad-verdict">${item.html}</div>`;
    return `<div class="acr-item"><span>${item.lbl}</span><span class="acr-val ${item.col || ''}">${item.val}</span></div>`;
  }).join('');
}

function calcIC() {
  const capital = parseFloat(document.getElementById('ic-capital')?.value) || 0;
  const monthly = parseFloat(document.getElementById('ic-monthly')?.value) || 0;
  const rate = parseFloat(document.getElementById('ic-rate')?.value) || 0;
  const years = parseInt(document.getElementById('ic-years')?.value) || 0;
  if (years <= 0) return;

  const r = rate / 100 / 12, n = years * 12;
  let v = capital;
  for (let m = 0; m < n; m++) v = v * (1 + r) + monthly;
  const totalVerse = capital + monthly * n;
  const interets = v - totalVerse;
  const multiplicateur = totalVerse > 0 ? (v / totalVerse).toFixed(2) : '—';

  setAcadResults('ic-results', [
    { lbl: 'Capital final', val: fmtAcad(v), col: 'teal' },
    { lbl: 'Total versé', val: fmtAcad(totalVerse), col: '' },
    { lbl: 'Intérêts générés', val: fmtAcad(interets), col: 'gold' },
    { lbl: 'Multiplicateur', val: multiplicateur + '×', col: 'purple' },
    {
      type: 'verdict',
      html: interets > totalVerse
        ? `<span style="color:var(--teal)">✓ Les intérêts (${fmtAcad(interets)}) dépassent vos versements (${fmtAcad(totalVerse)}) — la magie des intérêts composés est pleinement active !</span>`
        : `Les intérêts composés représentent <strong>${(interets / v * 100).toFixed(0)}%</strong> de votre capital final. Augmentez la durée pour décupler l'effet.`
    }
  ]);
}

function calcR72() {
  const rate = parseFloat(document.getElementById('r72-rate')?.value) || 0;
  const capital = parseFloat(document.getElementById('r72-capital')?.value) || 0;
  if (rate <= 0) return;

  const duree72 = 72 / rate;
  const dureeExacte = Math.log(2) / Math.log(1 + rate / 100);
  const capitalDouble = capital * 2;
  const capitalTriple = capital * 3;
  const dureeTriple = Math.log(3) / Math.log(1 + rate / 100);

  setAcadResults('r72-results', [
    { lbl: 'Doublement (règle 72)', val: duree72.toFixed(1) + ' ans', col: 'teal' },
    { lbl: 'Doublement (exact)', val: dureeExacte.toFixed(1) + ' ans', col: '' },
    { lbl: 'Capital doublé', val: fmtAcad(capitalDouble), col: 'gold' },
    { lbl: 'Triplement en', val: dureeTriple.toFixed(1) + ' ans', col: 'purple' },
    {
      type: 'verdict',
      html: `À <strong>${rate}%/an</strong>, votre capital double en <strong>${duree72.toFixed(1)} ans</strong>. La règle 72 donne une approximation rapide : à 8% → 9 ans, à 10% → 7,2 ans, à 4% → 18 ans.`
    }
  ]);
}

function calcInf() {
  const capital = parseFloat(document.getElementById('inf-capital')?.value) || 0;
  const rate = parseFloat(document.getElementById('inf-rate')?.value) || 0;
  const years = parseInt(document.getElementById('inf-years')?.value) || 0;
  if (years <= 0) return;

  const valeurReelle = capital / Math.pow(1 + rate / 100, years);
  const perte = capital - valeurReelle;
  const pctPerte = (perte / capital * 100).toFixed(1);
  const capitalNecessaire = capital * Math.pow(1 + rate / 100, years);

  setAcadResults('inf-results', [
    { lbl: 'Valeur réelle dans ' + years + ' ans', val: fmtAcad(valeurReelle), col: 'red' },
    { lbl: 'Perte de pouvoir d\'achat', val: fmtAcad(perte) + ' (-' + pctPerte + '%)', col: 'red' },
    { lbl: 'Pour conserver 100% du PA', val: fmtAcad(capitalNecessaire), col: 'gold' },
    {
      type: 'verdict',
      html: `Avec une inflation de <strong>${rate}%/an</strong>, vos ${fmtAcad(capital)} actuels n'auront que le pouvoir d'achat de <strong>${fmtAcad(valeurReelle)}</strong> dans ${years} ans. Pour maintenir votre niveau de vie, votre capital devra avoir atteint <strong>${fmtAcad(capitalNecessaire)}</strong>.`
    }
  ]);
}

function calcSharpe() {
  const rend = parseFloat(document.getElementById('sr-rend')?.value) || 0;
  const rf = parseFloat(document.getElementById('sr-rf')?.value) || 0;
  const vol = parseFloat(document.getElementById('sr-vol')?.value) || 0;
  if (vol <= 0) return;

  const sharpe = (rend - rf) / vol;
  const excesRend = rend - rf;
  let verdict = '';
  let qualite = '';
  if (sharpe < 0) { qualite = 'Négatif'; verdict = `Ratio négatif : votre investissement ne compense pas le risque pris. Un livret sans risque serait plus rentable.`; }
  else if (sharpe < 0.5) { qualite = 'Faible'; verdict = `Ratio faible : la performance ne justifie pas bien le risque. Cherchez à réduire la volatilité ou augmenter le rendement.`; }
  else if (sharpe < 1) { qualite = 'Correct'; verdict = `Ratio correct : acceptable mais pas exceptionnel. Un ETF monde tourne souvent autour de 0,5-0,7.`; }
  else if (sharpe < 2) { qualite = 'Bon'; verdict = `Bon ratio : vous êtes bien rémunéré pour le risque pris. Warren Buffett affiche ~0,8 sur 40 ans.`; }
  else { qualite = 'Excellent'; verdict = `Excellent ! Ratio > 2 est rare et souvent signe d'une stratégie à tester sur le long terme (ou de chance sur une courte période).`; }

  const col = sharpe < 0 ? 'red' : sharpe < 0.5 ? 'gold' : 'teal';
  setAcadResults('sr-results', [
    { lbl: 'Ratio de Sharpe', val: sharpe.toFixed(2) + ' — ' + qualite, col },
    { lbl: 'Excès de rendement', val: excesRend.toFixed(1) + '%', col: 'teal' },
    { lbl: 'Risque (vol.)', val: vol.toFixed(1) + '%', col: 'red' },
    { type: 'verdict', html: verdict }
  ]);
}