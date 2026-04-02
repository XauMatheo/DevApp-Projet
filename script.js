/* ══ STATE ══ */
let csvData = [], csvHeaders = [], charts = {};
let budgetItems = { revenus: [], depenses: [] };

/* ══ NAVIGATION ══ */
const pageTitles = {
  home:'Vue d\'ensemble', csv:'Import de données CSV', analyse:'Analyse statistique',
  graphiques:'Visualisation graphique', invest:'Simulateur d\'investissement',
  budget:'Simulateur de budget', compare:'Comparaison de scénarios',
  marche:'Marchés financiers — Temps réel'
};

function goPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(id + '-page').classList.add('active');
  document.querySelector(`[data-page="${id}"]`).classList.add('active');
  document.getElementById('page-title').textContent = pageTitles[id];
  if (id === 'analyse') initAnalysePage();
  if (id === 'graphiques') initGraphPage();
  if (id === 'invest') updateInvest();
  if (id === 'compare') updateCompare();
  if (id === 'home') refreshHome();
  if (id === 'marche') initMarcheChart();
}

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => goPage(item.dataset.page));
});

/* Clock */
function updateClock() { document.getElementById('clock').textContent = new Date().toLocaleTimeString('fr-FR'); }
setInterval(updateClock, 1000); updateClock();

/* ══ CHART HELPERS ══
   FIX: use functions instead of spread to avoid shared reference mutation */
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
  if (Math.abs(n) >= 1000) return (n/1000).toFixed(1)+'k€';
  return n.toFixed(0)+'€';
}
function formatNum(n) { return new Intl.NumberFormat('fr-FR').format(Math.round(n))+' €'; }

function generateColors(n) {
  const p = ['#6378ff','#06d6a0','#f0b429','#ff4d6d','#4895ef','#c77dff','#ff9f1c','#06b6d4','#84cc16','#f97316'];
  return Array.from({length:n},(_,i)=>p[i%p.length]);
}

/* ══ CSV ══ */
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error('Le fichier doit contenir au moins 2 lignes.');
  const sep = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(sep).map(h=>h.trim().replace(/^"|"$/g,''));
  const rows = [];
  for (let i=1;i<lines.length;i++) {
    if (!lines[i].trim()) continue;
    const vals = lines[i].split(sep).map(v=>v.trim().replace(/^"|"$/g,''));
    const obj = {}; headers.forEach((h,j)=>obj[h]=vals[j]??''); rows.push(obj);
  }
  return {headers,rows};
}

function loadCSV(text) {
  try {
    const {headers,rows} = parseCSV(text);
    csvHeaders = headers; csvData = rows;
    showAlert('csv-success',`${rows.length} lignes importées, ${headers.length} colonnes.`);
    hideAlert('csv-error');
    renderCSVTable();
    saveLocal('csvData',{headers,rows});
    document.getElementById('home-rows').textContent = rows.length;
  } catch(e) { showAlert('csv-error',e.message); hideAlert('csv-success'); }
}

function renderCSVTable() {
  const card = document.getElementById('csv-table-card');
  const thead = document.querySelector('#csv-table thead');
  const tbody = document.querySelector('#csv-table tbody');
  card.style.display = 'block';
  document.getElementById('btn-see-graphs').style.display = 'inline-flex';
  document.getElementById('csv-info').textContent = `${csvData.length} lignes · ${csvHeaders.length} col.`;
  thead.innerHTML = '<tr>'+csvHeaders.map(h=>`<th>${h}</th>`).join('')+'</tr>';
  tbody.innerHTML = csvData.slice(0,100).map(row=>'<tr>'+csvHeaders.map(h=>`<td>${row[h]}</td>`).join('')+'</tr>').join('');
}

document.getElementById('file-input').addEventListener('change',e=>{
  const file=e.target.files[0]; if(!file) return;
  if(!file.name.endsWith('.csv')){showAlert('csv-error','Sélectionnez un fichier .csv');return;}
  const r=new FileReader(); r.onload=ev=>loadCSV(ev.target.result); r.readAsText(file,'UTF-8');
});

const dz = document.getElementById('drop-zone');
dz.addEventListener('dragover',e=>{e.preventDefault();dz.classList.add('dragover');});
dz.addEventListener('dragleave',()=>dz.classList.remove('dragover'));
dz.addEventListener('drop',e=>{
  e.preventDefault(); dz.classList.remove('dragover');
  const file=e.dataTransfer.files[0];
  if(!file||!file.name.endsWith('.csv')){showAlert('csv-error','Déposez un fichier .csv');return;}
  const r=new FileReader(); r.onload=ev=>loadCSV(ev.target.result); r.readAsText(file,'UTF-8');
});

function clearCSVData() {
  csvData=[]; csvHeaders=[];
  document.getElementById('csv-table-card').style.display='none';
  document.getElementById('btn-see-graphs').style.display='none';
  hideAlert('csv-error'); hideAlert('csv-success');
  localStorage.removeItem('csvData');
  document.getElementById('home-rows').textContent='—';
}

function loadSampleData() {
  loadCSV(`Mois,Ventes,Dépenses,Bénéfice,Clients
Janvier,12500,8200,4300,142
Février,14200,9100,5100,158
Mars,11800,7800,4000,131
Avril,16500,10200,6300,187
Mai,18200,11500,6700,204
Juin,15600,9800,5800,175
Juillet,13400,8900,4500,152
Août,12100,8100,4000,138
Septembre,17800,11000,6800,196
Octobre,19500,12200,7300,218
Novembre,21200,13100,8100,241
Décembre,23800,14500,9300,267`);
}

/* ══ ANALYSE ══ */
function initAnalysePage() {
  const has = csvData.length>0;
  document.getElementById('no-data-msg').style.display = has?'none':'block';
  document.getElementById('analyse-content').style.display = has?'block':'none';
  if(!has) return;
  const numCols = csvHeaders.filter(h=>csvData.map(r=>parseFloat(r[h])).filter(v=>!isNaN(v)).length>0);
  const sel = document.getElementById('analyse-col');
  sel.innerHTML = numCols.map(h=>`<option value="${h}">${h}</option>`).join('');
  runAnalyse();
}

function runAnalyse() {
  const col = document.getElementById('analyse-col').value; if(!col) return;
  const vals = csvData.map(r=>parseFloat(r[col])).filter(v=>!isNaN(v)); if(!vals.length) return;
  const avg=vals.reduce((a,b)=>a+b,0)/vals.length, sum=vals.reduce((a,b)=>a+b,0);
  document.getElementById('stat-avg').textContent=avg%1?avg.toFixed(2):avg.toFixed(0);
  document.getElementById('stat-sum').textContent=sum%1?sum.toFixed(2):sum.toFixed(0);
  document.getElementById('stat-min').textContent=Math.min(...vals);
  document.getElementById('stat-max').textContent=Math.max(...vals);
  destroyChart('analyse');
  const d = getChartDefaults();
  d.plugins.legend.display = false;
  charts.analyse = new Chart(document.getElementById('analyse-chart').getContext('2d'),{
    type:'bar',
    data:{labels:csvData.map((_,i)=>`#${i+1}`),datasets:[{label:col,data:csvData.map(r=>parseFloat(r[col])||0),backgroundColor:'rgba(99,120,255,0.35)',borderColor:'#6378ff',borderWidth:1.5,borderRadius:4}]},
    options:d
  });
}

/* ══ GRAPHIQUES ══
   FIX: each chart gets its own deep-cloned options object so they don't share state */
function initGraphPage() {
  const has = csvData.length>0;
  document.getElementById('no-data-msg2').style.display = has?'none':'block';
  document.getElementById('graphiques-content').style.display = has?'block':'none';
  if(!has) return;
  const numCols = csvHeaders.filter(h=>csvData.map(r=>parseFloat(r[h])).filter(v=>!isNaN(v)).length>0);
  const textCols = csvHeaders.filter(h=>!numCols.includes(h));
  document.getElementById('graph-col').innerHTML = numCols.map(h=>`<option value="${h}">${h}</option>`).join('');
  document.getElementById('graph-label-col').innerHTML = ['(aucun)',...csvHeaders].map(h=>`<option value="${h}">${h}</option>`).join('');
  if(textCols.length>0) document.getElementById('graph-label-col').value=textCols[0];
  renderGraphs();
}

function renderGraphs() {
  const col = document.getElementById('graph-col').value; if(!col) return;
  const lblCol = document.getElementById('graph-label-col').value;
  const vals = csvData.map(r=>parseFloat(r[col])||0);
  const maxPie = 12;
  const pieData = csvData.slice(0,maxPie);
  const pieVals = pieData.map(r=>parseFloat(r[col])||0);
  const labels = lblCol==='(aucun)'?csvData.map((_,i)=>`#${i+1}`):csvData.map(r=>r[lblCol]||'?');
  const pieLabels = lblCol==='(aucun)'?pieData.map((_,i)=>`#${i+1}`):pieData.map(r=>r[lblCol]||'?');
  const colors = generateColors(pieData.length);

  ['bar-chart','line-chart','pie-chart'].forEach(id=>destroyChart(id));

  /* ── BAR ── fresh options object */
  const barOpts = getChartDefaults();
  barOpts.plugins.legend = { display: false };
  charts['bar-chart'] = new Chart(document.getElementById('bar-chart').getContext('2d'),{
    type:'bar',
    data:{labels,datasets:[{label:col,data:vals,backgroundColor:'rgba(99,120,255,0.4)',borderColor:'#6378ff',borderWidth:1.5,borderRadius:4}]},
    options:barOpts
  });

  /* ── LINE ── fresh options object */
  const lineOpts = getChartDefaults();
  lineOpts.plugins.legend = { display: false };
  charts['line-chart'] = new Chart(document.getElementById('line-chart').getContext('2d'),{
    type:'line',
    data:{labels,datasets:[{label:col,data:vals,borderColor:'#06d6a0',backgroundColor:'rgba(6,214,160,0.1)',borderWidth:2,fill:true,tension:0.4,pointBackgroundColor:'#06d6a0',pointRadius:3}]},
    options:lineOpts
  });

  /* ── PIE ── completely separate options (no scales) */
  charts['pie-chart'] = new Chart(document.getElementById('pie-chart').getContext('2d'),{
    type:'doughnut',
    data:{labels:pieLabels,datasets:[{data:pieVals,backgroundColor:colors.map(c=>c+'cc'),borderColor:colors,borderWidth:1.5}]},
    options:{
      responsive:true,maintainAspectRatio:false,cutout:'55%',
      plugins:{
        legend:{labels:{color:'#8b8fa8',font:{family:'Space Grotesk',size:10},boxWidth:10}},
        tooltip:{backgroundColor:'#0f1220',borderColor:'rgba(99,120,255,0.35)',borderWidth:1,titleColor:'#8b9dff',bodyColor:'#8b8fa8',padding:10}
      }
    }
  });
}

/* ══ INVESTISSEMENT ══ */
function calcInvest(capital,monthly,rate,years) {
  const r=rate/100/12, n=years*12;
  let data=[],current=capital;
  for(let m=0;m<=n;m++){if(m>0)current=current*(1+r)+monthly;if(m%12===0)data.push({year:m/12,value:current});}
  const final=current,versed=capital+monthly*n,gains=final-versed;
  return {final,versed,gains,data};
}

function updateInvest() {
  const capital=parseFloat(document.getElementById('r-capital').value);
  const monthly=parseFloat(document.getElementById('r-monthly').value);
  const rate=parseFloat(document.getElementById('r-rate').value);
  const years=parseInt(document.getElementById('r-years').value);
  document.getElementById('v-capital').textContent=formatNum(capital);
  document.getElementById('v-monthly').textContent=formatNum(monthly);
  document.getElementById('v-rate').textContent=rate.toFixed(1);
  document.getElementById('v-years').textContent=years;
  const {final,versed,gains,data}=calcInvest(capital,monthly,rate,years);
  document.getElementById('res-final').textContent=formatNum(final);
  document.getElementById('res-gains').textContent=formatNum(gains);
  document.getElementById('res-versed').textContent=formatNum(versed);
  document.getElementById('res-ratio').textContent=(final/versed).toFixed(2)+'×';
  const pctV=Math.round(versed/final*100),pctG=100-pctV;
  document.getElementById('bar-versed').style.width=pctV+'%';
  document.getElementById('bar-gains2').style.width=pctG+'%';
  document.getElementById('pct-versed').textContent=pctV+'%';
  document.getElementById('pct-gains').textContent=pctG+'%';

  destroyChart('invest');
  const versedLine=data.map((d,i)=>capital+monthly*12*i);
  const opts=getChartDefaults();
  opts.plugins.tooltip.callbacks={label:c=>`${c.dataset.label}: ${formatNum(c.raw)}`};
  charts.invest=new Chart(document.getElementById('invest-chart').getContext('2d'),{
    type:'line',
    data:{
      labels:data.map(d=>`An ${d.year}`),
      datasets:[
        {label:'Capital total',data:data.map(d=>d.value),borderColor:'#6378ff',backgroundColor:'rgba(99,120,255,0.08)',borderWidth:2.5,fill:true,tension:0.4,pointRadius:2},
        {label:'Capital versé',data:versedLine,borderColor:'#4895ef',borderDash:[5,5],borderWidth:1.5,fill:false,tension:0,pointRadius:0}
      ]
    },
    options:opts
  });
  saveLocal('investResult',{final,gains});
  document.getElementById('home-capital').textContent=fmt(final);
  document.getElementById('home-gains').textContent=fmt(gains);
  updateHomeChart(data,versedLine.map((v,i)=>({year:data[i]?.year||i,value:v})));
}

function updateHomeChart(investData,versedData) {
  destroyChart('home');
  const opts=getChartDefaults();
  opts.plugins.tooltip.callbacks={label:c=>`${c.dataset.label}: ${formatNum(c.raw)}`};
  charts.home=new Chart(document.getElementById('home-chart').getContext('2d'),{
    type:'line',
    data:{
      labels:investData.map(d=>`An ${d.year}`),
      datasets:[
        {label:'Capital',data:investData.map(d=>d.value),borderColor:'#6378ff',backgroundColor:'rgba(99,120,255,0.08)',fill:true,tension:0.4,borderWidth:2,pointRadius:0},
        {label:'Versé',data:versedData.map(d=>d.value),borderColor:'#4895ef',borderDash:[4,4],fill:false,tension:0,borderWidth:1.5,pointRadius:0}
      ]
    },
    options:opts
  });
}

/* ══ BUDGET ══
   FIX: inputs use onchange (blur) instead of oninput to avoid losing focus mid-edit.
   Values are committed when the user leaves the field or presses Enter. */
function addRevenu(label='Salaire',montant=2000){budgetItems.revenus.push({label,montant});renderBudget();}
function addDepense(label='Loyer',montant=800){budgetItems.depenses.push({label,montant});renderBudget();}

function renderBudget() {
  renderBudgetList('revenus-list','revenus');
  renderBudgetList('depenses-list','depenses');
  updateBudgetSummary();
}

function renderBudgetList(containerId, type) {
  const el = document.getElementById(containerId);
  el.innerHTML = budgetItems[type].map((item,i)=>budgetRow(item,i,type)).join('');
}

function budgetRow(item,i,type) {
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

function escHtml(s){return s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');}

function updateBudgetSummary() {
  const totalR=budgetItems.revenus.reduce((s,x)=>s+(parseFloat(x.montant)||0),0);
  const totalD=budgetItems.depenses.reduce((s,x)=>s+(parseFloat(x.montant)||0),0);
  const ral=totalR-totalD;
  document.getElementById('b-revenus').textContent=formatNum(totalR);
  document.getElementById('b-depenses').textContent=formatNum(totalD);
  const ralEl=document.getElementById('b-ral');
  ralEl.textContent=formatNum(ral);
  ralEl.style.color=ral>=0?'var(--green)':'var(--red)';
  document.getElementById('home-ral').textContent=fmt(ral);

  const colors=generateColors(budgetItems.depenses.length);
  destroyChart('budget-pie');
  if(budgetItems.depenses.length){
    charts['budget-pie']=new Chart(document.getElementById('budget-pie').getContext('2d'),{
      type:'doughnut',
      data:{labels:budgetItems.depenses.map(x=>x.label),datasets:[{data:budgetItems.depenses.map(x=>parseFloat(x.montant)||0),backgroundColor:colors.map(c=>c+'cc'),borderColor:colors,borderWidth:1.5}]},
      options:{responsive:true,maintainAspectRatio:false,cutout:'55%',
        plugins:{legend:{labels:{color:'#8b8fa8',font:{family:'Space Grotesk',size:10},boxWidth:10}},tooltip:{backgroundColor:'#0f1220',borderColor:'rgba(99,120,255,0.35)',borderWidth:1,titleColor:'#8b9dff',bodyColor:'#8b8fa8',padding:10}}}
    });
  }

  document.getElementById('budget-bars').innerHTML=budgetItems.depenses.map((item,i)=>{
    const pct=totalR>0?Math.min(100,(parseFloat(item.montant)||0)/totalR*100):0;
    return `<div>
      <div style="display:flex;justify-content:space-between;font-size:0.72rem;color:var(--text-2);margin-bottom:4px">
        <span>${escHtml(String(item.label))}</span><span style="color:${colors[i]};font-weight:600">${formatNum(parseFloat(item.montant)||0)}</span>
      </div>
      <div class="budget-bar-wrap"><div class="budget-bar" style="width:${pct}%;background:${colors[i]}"></div></div>
    </div>`;
  }).join('');

  saveLocal('budget',budgetItems);
}

function initBudget() {
  const saved=loadLocal('budget');
  if(saved) budgetItems=saved;
  else {
    budgetItems.revenus=[{label:'Salaire',montant:2500}];
    budgetItems.depenses=[{label:'Loyer',montant:800},{label:'Courses',montant:300},{label:'Transport',montant:150},{label:'Abonnements',montant:50}];
  }
  renderBudget();
}

/* ══ COMPARAISON ══ */
function updateCompare() {
  const g=id=>parseFloat(document.getElementById(id).value)||0;
  const A=calcInvest(g('ca-capital'),g('ca-monthly'),g('ca-rate'),g('ca-years'));
  const B=calcInvest(g('cb-capital'),g('cb-monthly'),g('cb-rate'),g('cb-years'));
  document.getElementById('ca-result').textContent=formatNum(A.final);
  document.getElementById('cb-result').textContent=formatNum(B.final);
  const maxYears=Math.max(g('ca-years'),g('cb-years'));
  const yearsArr=Array.from({length:Math.floor(maxYears)+1},(_,i)=>i);
  const cy=(cap,mo,rate,yr)=>{const r=rate/100/12;let v=cap;for(let m=0;m<yr*12;m++)v=v*(1+r)+mo;return v;};
  destroyChart('compare');
  const opts=getChartDefaults();
  opts.plugins.tooltip.callbacks={label:c=>`${c.dataset.label}: ${formatNum(c.raw)}`};
  charts.compare=new Chart(document.getElementById('compare-chart').getContext('2d'),{
    type:'line',
    data:{
      labels:yearsArr.map(y=>`An ${y}`),
      datasets:[
        {label:'Scénario A',data:yearsArr.map(y=>cy(g('ca-capital'),g('ca-monthly'),g('ca-rate'),y)),borderColor:'#4895ef',backgroundColor:'rgba(72,149,239,0.06)',fill:true,tension:0.4,borderWidth:2.5,pointRadius:0},
        {label:'Scénario B',data:yearsArr.map(y=>cy(g('cb-capital'),g('cb-monthly'),g('cb-rate'),y)),borderColor:'#c77dff',backgroundColor:'rgba(199,125,255,0.06)',fill:true,tension:0.4,borderWidth:2.5,pointRadius:0}
      ]
    },
    options:opts
  });
}

/* ══ LOCAL STORAGE ══ */
function saveLocal(key,val){try{localStorage.setItem('datainvest_'+key,JSON.stringify(val));}catch(e){}}
function loadLocal(key){try{const v=localStorage.getItem('datainvest_'+key);return v?JSON.parse(v):null;}catch(e){return null;}}

/* ══ HOME ══ */
function refreshHome(){
  const inv=loadLocal('investResult');
  if(inv){document.getElementById('home-capital').textContent=fmt(inv.final);document.getElementById('home-gains').textContent=fmt(inv.gains);}
  const c=loadLocal('csvData');
  if(c) document.getElementById('home-rows').textContent=c.rows.length;
}

/* ══ ALERTS ══ */
function showAlert(id,msg){const el=document.getElementById(id);const mid=id+'-msg';if(document.getElementById(mid))document.getElementById(mid).textContent=msg;el.classList.add('show');}
function hideAlert(id){document.getElementById(id).classList.remove('show');}

/* ══ MARCHÉS ══ */
let tvCurrentSymbol='FOREXCOM:SPXUSD', tvReady=false;

function initMarcheChart(){
  if(tvReady) return; tvReady=true;
  if(window.TradingView){renderTVChart(tvCurrentSymbol);}
  else{const s=document.createElement('script');s.src='https://s3.tradingview.com/tv.js';s.onload=()=>renderTVChart(tvCurrentSymbol);document.head.appendChild(s);}
}

function renderTVChart(symbol){
  const c=document.getElementById('tv-chart-container');
  c.innerHTML='<div id="tv_inner" style="height:100%"></div>';
  new TradingView.widget({autosize:true,symbol,interval:'D',timezone:'Europe/Paris',theme:'dark',style:'1',locale:'fr',toolbar_bg:'#0a0d16',enable_publishing:false,withdateranges:true,hide_side_toolbar:false,allow_symbol_change:true,save_image:false,container_id:'tv_inner'});
}

function setSymbol(symbol){tvCurrentSymbol=symbol;tvReady=true;if(window.TradingView)renderTVChart(symbol);}

/* ══ INIT ══ */
function init(){
  const c=loadLocal('csvData');
  if(c){csvHeaders=c.headers;csvData=c.rows;renderCSVTable();showAlert('csv-success',`${csvData.length} lignes restaurées.`);document.getElementById('home-rows').textContent=csvData.length;}
  initBudget();
  updateInvest();
  refreshHome();
}
init();