/* ══════════════════════════════════════════
   WEALTH OS — script.js
   Version commentée pour débutants
   
   Ce fichier contient toute la logique JavaScript
   de l'application : navigation, calculs financiers,
   graphiques, formulaires.
══════════════════════════════════════════ */


/* ══ VARIABLES GLOBALES ══
   Ces variables sont accessibles partout dans le fichier.
   On les déclare ici pour les partager entre toutes les fonctions.
*/
let charts = {};            // Stocke tous les graphiques Chart.js créés (pour pouvoir les détruire)
let budgetItems = {         // Stocke les lignes du budget (revenus + dépenses)
  revenus: [],
  depenses: []
};
let _rendTaux = 7;          // Taux actif dans l'onglet "Détail annuel" (7% par défaut)
let _investTabActive = 'evolution'; // Onglet de graphique actif dans la page Investissement


/* ══ TITRES DES PAGES ══
   Objet associant chaque identifiant de page à son titre affiché.
   Exemple : pageTitles['home'] vaut 'Tableau de bord'
*/
const pageTitles = {
  home:       'Tableau de bord',
  invest:     'Investissement',
  retraite:   'Planification retraite',
  analyse:    'Bilan patrimonial',
  budget:     'Budget mensuel',
  compare:    'Comparaison A/B',
  allocation: 'Allocation de portefeuille',
  academie:   "Académie de l'investissement"
};

/* Même principe pour les badges affichés en haut à droite */
const pageBadges = {
  home:       'Vue globale',
  invest:     'Simulateur',
  retraite:   'Projection',
  analyse:    'Patrimoine',
  budget:     'Cash flow',
  compare:    'Scénarios',
  allocation: 'Portefeuille',
  academie:   'Formation'
};


/* ══ NAVIGATION ══ */

/*
  goPage(id) — navigue vers une page de l'application.
  Paramètre : id = identifiant de la page (ex: 'home', 'invest', 'budget'…)
  
  Principe :
  1. On cache toutes les pages (.page) en retirant la classe "active"
  2. On désactive tous les items de navigation
  3. On affiche uniquement la page demandée
  4. On met à jour les textes dans la topbar
  5. On appelle la fonction d'initialisation propre à la page
*/
function goPage(id) {
  // 1. Cacher toutes les pages — on récupère tous les éléments .page et on retire la classe "active"
  var toutesLesPages = document.querySelectorAll('.page');
  for (var i = 0; i < toutesLesPages.length; i++) {
    toutesLesPages[i].classList.remove('active');
  }

  // 2. Désactiver tous les items de navigation (sidebar)
  var tousLesNavItems = document.querySelectorAll('.nav-item');
  for (var j = 0; j < tousLesNavItems.length; j++) {
    tousLesNavItems[j].classList.remove('active');
  }

  // 3. Afficher la page correspondant à l'id demandé
  //    La page a pour id HTML : id + '-page' (ex: 'invest-page')
  document.getElementById(id + '-page').classList.add('active');

  // 4. Marquer le bon item de navigation comme actif
  var navItemActif = document.querySelector('[data-page="' + id + '"]');
  if (navItemActif) {
    navItemActif.classList.add('active');
  }

  // 5. Mettre à jour le titre et le badge dans la topbar
  document.getElementById('page-title').textContent = pageTitles[id] || id;
  var badge = document.getElementById('topbar-badge');
  if (badge) {
    badge.textContent = pageBadges[id] || '';
  }

  // 6. Lancer la fonction d'initialisation de la page
  //    requestAnimationFrame attend que le navigateur ait terminé d'afficher
  //    avant d'appeler la fonction (évite des problèmes avec les graphiques)
  requestAnimationFrame(function() {
    if (id === 'home')       refreshHome();
    if (id === 'invest')     updateInvest();
    if (id === 'retraite')   updateRetraite();
    if (id === 'analyse')    initPatrimoine();
    if (id === 'compare')    updateCompare();
    if (id === 'allocation') updateAllocation();
    if (id === 'budget')     initBudget();
    if (id === 'academie')   initAcademie();
  });
}

/* Ajoute un écouteur de clic sur chaque item de navigation.
   Quand on clique sur un item, on navigue vers la page correspondante.
   data-page est un attribut HTML personnalisé qu'on a défini dans index.html.
*/
var navItems = document.querySelectorAll('.nav-item');
for (var i = 0; i < navItems.length; i++) {
  navItems[i].addEventListener('click', function() {
    // "this" est l'élément sur lequel on a cliqué
    goPage(this.dataset.page);
  });
}


/* ══ HORLOGE ══
   Met à jour l'heure affichée dans la sidebar et dans la topbar.
   Appelée toutes les secondes via setInterval.
*/
function updateClock() {
  // Formate l'heure au format HH:MM:SS en français
  var heureFormatee = new Date().toLocaleTimeString('fr-FR', {
    hour:   '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  var elementSidebar = document.getElementById('clock');
  var elementTopbar  = document.getElementById('topbar-clock');

  if (elementSidebar) elementSidebar.textContent = heureFormatee;
  if (elementTopbar)  elementTopbar.textContent  = heureFormatee;
}

/* Met à jour l'horloge toutes les 1000ms (1 seconde) */
setInterval(updateClock, 1000);
updateClock(); // Premier appel immédiat pour éviter un délai d'1 seconde au démarrage


/* ══ SIDEBAR RÉDUCTIBLE ══ */

/*
  toggleSidebar() — réduit ou agrandit la sidebar.
  On alterne la classe CSS "collapsed" sur l'élément sidebar.
  On sauvegarde la préférence dans localStorage pour la retrouver au rechargement.
*/
function toggleSidebar() {
  var sidebar = document.getElementById('sidebar');
  sidebar.classList.toggle('collapsed');

  // Sauvegarde : '1' = réduit, '0' = agrandi
  var estReduit = sidebar.classList.contains('collapsed');
  localStorage.setItem('wos_sidebar', estReduit ? '1' : '0');
}

/* Au chargement de la page, on restaure l'état précédent de la sidebar */
if (localStorage.getItem('wos_sidebar') === '1') {
  document.getElementById('sidebar').classList.add('collapsed');
}


/* ══════════════════════════════════════════
   FONCTIONS UTILITAIRES (HELPERS)
   Ces fonctions sont utilisées partout dans le code
   pour éviter de répéter les mêmes opérations.
══════════════════════════════════════════ */

/*
  fmt(n) — formate un nombre en chaîne lisible avec unité €.
  Exemples :
    fmt(1500000) → "1.50M€"
    fmt(25000)   → "25.0k€"
    fmt(950)     → "950€"
    fmt(NaN)     → "—"
*/
function fmt(n) {
  // Si la valeur est invalide ou manquante, on affiche un tiret
  if (n === null || n === undefined || isNaN(n)) return '—';

  var valeurAbsolue = Math.abs(n);

  if (valeurAbsolue >= 1000000) {
    // Plus d'un million : on affiche en M€
    return (n / 1000000).toFixed(2) + 'M€';
  }
  if (valeurAbsolue >= 1000) {
    // Plus d'un millier : on affiche en k€
    return (n / 1000).toFixed(1) + 'k€';
  }
  // Sinon : on arrondit à l'entier
  return Math.round(n) + '€';
}

/*
  fmtN(n) — formate un nombre avec séparateur de milliers et "€".
  Utilise Intl.NumberFormat pour la localisation française.
  Exemple : fmtN(12500) → "12 500 €"
*/
function fmtN(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' €';
}

/*
  fv(id) — lit la valeur d'un champ <input> et la convertit en nombre décimal.
  Retourne 0 si le champ est vide ou introuvable.
  Ex : fv('r-capital') lit le champ dont l'id HTML est "r-capital"
*/
function fv(id) {
  var element = document.getElementById(id);
  if (!element) return 0;
  return parseFloat(element.value) || 0;
}

/*
  iv(id) — comme fv() mais retourne un entier (parseInt).
  Utile pour les durées en années, les âges, etc.
*/
function iv(id) {
  var element = document.getElementById(id);
  if (!element) return 0;
  return parseInt(element.value) || 0;
}

/*
  sv(id) — lit la valeur textuelle d'un champ (select ou input texte).
  Retourne '' si introuvable.
*/
function sv(id) {
  var element = document.getElementById(id);
  if (!element) return '';
  return element.value || '';
}

/*
  generateColors(n) — génère un tableau de n couleurs pour les graphiques.
  On tourne en boucle dans une palette prédéfinie.
  Ex : generateColors(3) → ['#818cf8', '#2dd4bf', '#fcd34d']
*/
function generateColors(n) {
  var palette = ['#818cf8', '#2dd4bf', '#fcd34d', '#fb7185', '#38bdf8', '#c084fc', '#f472b6', '#34d399'];
  var resultat = [];
  for (var i = 0; i < n; i++) {
    resultat.push(palette[i % palette.length]); // % = modulo : repart au début quand on dépasse
  }
  return resultat;
}


/* ══ CONFIGURATION PAR DÉFAUT DES GRAPHIQUES ══
   Retourne un objet d'options Chart.js commun à tous les graphiques.
   Cela évite de répéter la même configuration partout.
*/
function chartDefaults() {
  return {
    responsive:          true,   // S'adapte à la taille du conteneur
    maintainAspectRatio: false,  // Permet de contrôler la hauteur via CSS
    interaction: {
      mode:      'index',    // Au survol : affiche toutes les valeurs pour cet axe X
      intersect: false
    },
    plugins: {
      legend: {
        labels: {
          color:           '#a5b4fc',
          font:            { family: 'DM Mono, monospace', size: 11 },
          boxWidth:        10,
          padding:         16,
          usePointStyle:   true,
          pointStyleWidth: 8
        }
      },
      tooltip: {
        enabled:         true,
        backgroundColor: 'rgba(10, 12, 24, 0.85)',
        borderColor:     'rgba(129, 140, 248, 0.4)',
        borderWidth:     1,
        titleColor:      '#c7d2fe',
        bodyColor:       '#e0e7ff',
        padding:         { top: 12, bottom: 12, left: 16, right: 16 },
        titleFont:       { family: 'Outfit, sans-serif', size: 13, weight: '700' },
        bodyFont:        { family: 'DM Mono, monospace', size: 12 },
        caretSize:       6,
        cornerRadius:    10,
        boxPadding:      8,
        callbacks: {
          /* Personnalise le texte affiché dans la bulle de survol */
          label: function(context) {
            var valeur = context.raw;
            if (typeof valeur === 'number') {
              return '  ' + context.dataset.label + ' : ' + fmtN(valeur);
            }
            return '  ' + context.dataset.label + ' : ' + valeur;
          }
        }
      }
    },
    scales: {
      x: {
        ticks: {
          color:         '#5c6692',
          font:          { family: 'DM Mono, monospace', size: 10 },
          maxRotation:   0,
          maxTicksLimit: 12
        },
        grid: { color: 'rgba(255,255,255,0.03)' }
      },
      y: {
        ticks: {
          color: '#5c6692',
          font:  { family: 'DM Mono, monospace', size: 10 },
          /* Formate les valeurs de l'axe Y (ex: 1500000 → "1.5M€") */
          callback: function(value) {
            if (Math.abs(value) >= 1000000) return (value / 1000000).toFixed(1) + 'M€';
            if (Math.abs(value) >= 1000)    return (value / 1000).toFixed(0) + 'k€';
            return value + '€';
          }
        },
        grid: { color: 'rgba(255,255,255,0.03)' }
      }
    }
  };
}

/*
  destroyChart(id) — détruit un graphique existant pour pouvoir le recréer.
  Chart.js exige qu'on détruise un graphique avant d'en créer un nouveau
  sur le même canvas, sinon il se superpose.
*/
function destroyChart(id) {
  if (charts[id]) {
    charts[id].destroy();
    delete charts[id];
  }
}

/*
  escHtml(s) — sécurise une chaîne avant de l'insérer en HTML.
  Remplace les caractères spéciaux pour éviter les injections HTML.
  Ex : escHtml('<script>') → '&lt;script&gt;'
*/
function escHtml(s) {
  return String(s)
    .replace(/&/g,  '&amp;')
    .replace(/"/g,  '&quot;')
    .replace(/</g,  '&lt;');
}


/* ══ STOCKAGE LOCAL ══
   Sauvegarde et récupère des données dans le navigateur (localStorage).
   Les données persistent même après fermeture de l'onglet.
*/

/* saveLocal(key, val) — sauvegarde une valeur (objet JSON) sous la clé 'wos_' + key */
function saveLocal(key, val) {
  try {
    localStorage.setItem('wos_' + key, JSON.stringify(val));
  } catch(e) {
    // Si localStorage est indisponible (mode privé, quota dépassé), on ignore silencieusement
  }
}

/* loadLocal(key) — récupère la valeur sauvegardée, ou null si absente */
function loadLocal(key) {
  try {
    var valeur = localStorage.getItem('wos_' + key);
    return valeur ? JSON.parse(valeur) : null;
  } catch(e) {
    return null;
  }
}


/* ══════════════════════════════════════════
   ENVELOPPES FISCALES
   Données et calculs liés aux différents types
   de comptes d'investissement français.
══════════════════════════════════════════ */

/*
  ENVELOPES — objet contenant les caractéristiques fiscales
  de chaque type d'enveloppe (PEA, AV, CTO, PER).
  
  Pour chaque enveloppe :
  - tauxImpot : taux d'impôt sur le revenu applicable aux gains
  - tauxPS    : taux de prélèvements sociaux (17,2%)
  - plafond   : montant max de versements autorisé
*/
const ENVELOPES = {
  pea: {
    name: 'PEA',
    label: "PEA — Plan d'Épargne en Actions",
    color: 'teal',
    icon: '◉',
    description: "Exonération totale d'impôt après 5 ans (hors prélèvements sociaux 17,2 %). Plafond : 150 000 €.",
    tauxImpot:         0,      // 0% d'IR (exonération après 5 ans)
    tauxPS:            0.172,  // 17,2% de prélèvements sociaux toujours dus
    plafond:           150000,
    avantageDeduction: false,
    note: 'Idéal pour les actions européennes long terme.'
  },
  av: {
    name: 'AV',
    label: 'Assurance-vie',
    color: 'gold',
    icon: '◎',
    description: "Abattement annuel de 4 600 € (9 200 € couple) sur les gains après 8 ans. Fiscalité 7,5% + PS 17,2% après 8 ans (< 150k€).",
    tauxImpot:         0.075, // 7,5% d'IR après 8 ans (sur la part imposable)
    tauxPS:            0.172,
    plafond:           Infinity, // Pas de plafond
    avantageDeduction: false,
    abattementAnnuel:  4600,     // Abattement annuel sur les gains
    note: 'Enveloppe très souple, transmission hors succession.'
  },
  cto: {
    name: 'CTO',
    label: 'Compte-Titres Ordinaire',
    color: 'red',
    icon: '◌',
    description: "PFU (Flat Tax) de 30% = 12,8% IR + 17,2% PS. Pas de plafond, pas d'avantage fiscal.",
    tauxImpot:         0.128, // 12,8% d'IR (flat tax)
    tauxPS:            0.172,
    plafond:           Infinity,
    avantageDeduction: false,
    note: 'Flexible mais fiscalement le moins avantageux.'
  },
  per: {
    name: 'PER',
    label: "Plan d'Épargne Retraite",
    color: 'purple',
    icon: '◈',
    description: "Versements déductibles du revenu imposable (jusqu'à 10% revenus, max ~35 000€/an). Fiscalité à la sortie : IR sur capital + gains.",
    tauxImpot:         0.30,  // 30% d'IR à la sortie (par défaut)
    tauxPS:            0.172,
    plafond:           Infinity,
    avantageDeduction: true,  // Avantage : les versements réduisent l'impôt aujourd'hui
    note: "Optimal si TMI élevé aujourd'hui et plus faible à la retraite."
  }
};

/*
  applyEnvelopeFiscality(...) — calcule le capital net d'impôts
  selon l'enveloppe fiscale choisie.
  
  Paramètres :
  - capitalBrut  : capital final avant impôts
  - totalVerse   : somme totale versée (capital initial + versements mensuels)
  - envelopeId   : identifiant de l'enveloppe ('pea', 'av', 'cto', 'per')
  - tmi          : taux marginal d'imposition du contribuable
  - years        : durée de l'investissement en années
  
  Retourne : capital net après application de la fiscalité
*/
function applyEnvelopeFiscality(capitalBrut, totalVerse, envelopeId, tmi, years) {
  var env = ENVELOPES[envelopeId] || ENVELOPES.cto;

  // Les gains sont la différence entre le capital final et les sommes versées
  var gainsBruts = Math.max(0, capitalBrut - totalVerse);

  if (envelopeId === 'pea') {
    /* PEA : seuls les prélèvements sociaux (17,2%) s'appliquent sur les gains */
    return capitalBrut - gainsBruts * env.tauxPS;
  }

  if (envelopeId === 'av') {
    /* Assurance-vie : abattement annuel de 4 600€ sur les gains
       La part au-delà de l'abattement est taxée à 7,5% + 17,2% PS
       La part dans l'abattement n'est taxée qu'aux PS (17,2%) */
    var abattementTotal  = (env.abattementAnnuel || 4600) * years;
    var gainsImposables  = Math.max(0, gainsBruts - abattementTotal);
    var impot            = gainsImposables * (env.tauxImpot + env.tauxPS);
    var psMinimaux       = Math.min(gainsBruts, abattementTotal) * env.tauxPS;
    return capitalBrut - impot - psMinimaux;
  }

  if (envelopeId === 'cto') {
    /* CTO : Flat Tax de 30% (12,8% IR + 17,2% PS) sur tous les gains */
    return capitalBrut - gainsBruts * (env.tauxImpot + env.tauxPS);
  }

  if (envelopeId === 'per') {
    /* PER : avantage fiscal à l'entrée (déduction des versements du revenu imposable)
       mais impôt sur la totalité du capital + gains à la sortie */
    var avantageEntree = totalVerse * (tmi || 0.30);
    var impotSortie    = capitalBrut * ((tmi || 0.30) + env.tauxPS);
    return capitalBrut - impotSortie + avantageEntree;
  }

  // Cas par défaut : on retient 70% du capital
  return capitalBrut * 0.70;
}

/*
  updateEnvelopeInfo(envelopeId, containerId) — affiche les infos
  de l'enveloppe fiscale sélectionnée dans un bloc HTML.
*/
function updateEnvelopeInfo(envelopeId, containerId) {
  var element = document.getElementById(containerId);
  if (!element) return;

  var env = ENVELOPES[envelopeId] || ENVELOPES.cto;

  element.innerHTML =
    '<span class="envelope-badge ' + env.color + '">' + env.icon + ' ' + env.name + '</span>' +
    '<div>' + env.description + '</div>' +
    '<div style="margin-top:5px;color:var(--t3);font-size:0.68rem">' + env.note + '</div>';
}


/* ══════════════════════════════════════════
   PAGE INVESTISSEMENT
   Simulateur de croissance de capital
   avec intérêts composés.
══════════════════════════════════════════ */

/*
  switchInvestTab(tab, btn) — change l'onglet de graphique affiché.
  Paramètres :
  - tab : nom de l'onglet ('evolution', 'multitaux', 'compo', etc.)
  - btn : l'élément bouton sur lequel on a cliqué
*/
function switchInvestTab(tab, btn) {
  _investTabActive = tab;

  // Désactiver tous les onglets et panneaux
  var tousLesOnglets  = document.querySelectorAll('.ct-tab');
  var tousPanneaux    = document.querySelectorAll('.chart-pane');

  for (var i = 0; i < tousLesOnglets.length; i++) {
    tousLesOnglets[i].classList.remove('active');
  }
  for (var j = 0; j < tousPanneaux.length; j++) {
    tousPanneaux[j].classList.remove('active');
  }

  // Activer l'onglet cliqué et son panneau correspondant
  btn.classList.add('active');
  document.getElementById('pane-' + tab).classList.add('active');

  // Rendu spécial pour Monte Carlo (calcul plus long)
  if (tab === 'montecarlo') {
    renderMonteCarlo();
  } else {
    renderInvestCharts();
  }
}

/*
  calcCapital(capital, monthly, rateNet, years, revalor) — calcule l'évolution
  du capital année par année avec intérêts composés.
  
  Paramètres :
  - capital  : capital initial (€)
  - monthly  : versement mensuel (€)
  - rateNet  : taux annuel NET (après frais) en %
  - years    : durée en années
  - revalor  : revalorisation annuelle du versement mensuel en %
  
  Retourne : tableau d'objets { year: N, value: montantEnEuros }
  
  Formule mensuelle : capital = capital * (1 + tauxMensuel) + versementMensuel
  Le taux mensuel = taux annuel / 12
*/
function calcCapital(capital, monthly, rateNet, years, revalor) {
  var donnees = [];
  var capitalActuel    = capital;    // Capital courant (mis à jour chaque année)
  var versementActuel  = monthly;    // Versement mensuel (peut évoluer chaque année)

  for (var annee = 0; annee <= years; annee++) {
    if (annee > 0) {
      // On calcule les 12 mois de l'année
      var tauxMensuel = rateNet / 100 / 12;
      for (var mois = 0; mois < 12; mois++) {
        capitalActuel = capitalActuel * (1 + tauxMensuel) + versementActuel;
      }
      // Le versement mensuel augmente chaque année selon la revalorisation
      versementActuel = versementActuel * (1 + revalor / 100);
    }
    // On enregistre la valeur en début d'année (année 0 = capital initial)
    donnees.push({ year: annee, value: capitalActuel });
  }

  return donnees;
}

/*
  calcVersementsCumul(capital, monthly, years, revalor) — calcule le cumul
  des sommes versées (capital initial + versements mensuels) année par année.
  
  Important : cela ne tient PAS compte des intérêts, uniquement de ce qu'on verse.
  Cela permet de comparer "ce qu'on a investi" vs "ce que ça vaut".
*/
function calcVersementsCumul(capital, monthly, years, revalor) {
  var totalVerse      = capital;    // On commence avec le capital initial
  var versementActuel = monthly;
  var donnees = [{ year: 0, value: capital }]; // Année 0 = capital de départ

  for (var annee = 1; annee <= years; annee++) {
    totalVerse      += versementActuel * 12;       // 12 mois de versements
    versementActuel *= (1 + revalor / 100);        // Revalorisation annuelle
    donnees.push({ year: annee, value: totalVerse });
  }

  return donnees;
}

/*
  calcCapAt(capital, monthly, rateNet, years) — calcule le capital final
  à l'issue de la durée indiquée.
  
  Version simplifiée de calcCapital : retourne un seul nombre (pas un tableau).
  Utile pour comparer plusieurs scénarios sans stocker toute la courbe.
*/
function calcCapAt(capital, monthly, rateNet, years) {
  var tauxMensuel  = rateNet / 100 / 12;
  var nbMois       = years * 12;
  var valeur       = capital;

  for (var mois = 0; mois < nbMois; mois++) {
    valeur = valeur * (1 + tauxMensuel) + monthly;
  }
  return valeur;
}

/*
  updateInvest() — fonction principale du simulateur d'investissement.
  
  Appelée à chaque modification d'un champ de formulaire (oninput).
  1. Lit tous les paramètres du formulaire
  2. Calcule les résultats
  3. Met à jour les KPIs affichés
  4. Déclenche le rendu des graphiques
*/
function updateInvest() {
  // Lecture des paramètres du formulaire
  var capital    = fv('r-capital');
  var monthly    = fv('r-monthly');
  var rate       = fv('r-rate');
  var years      = iv('r-years') || 0;
  var inflation  = fv('r-inflation');
  var frais      = fv('r-frais');
  var tmi        = fv('r-tmi');
  var revalor    = fv('r-revalor');
  var envelopeId = sv('r-envelope') || 'pea';

  // Taux net = taux brut moins les frais de gestion annuels
  var rateNet = Math.max(0, rate - frais);

  // Calcul de l'évolution du capital et des versements cumulés
  var donnees    = calcCapital(capital, monthly, rateNet, years, revalor);
  var versData   = calcVersementsCumul(capital, monthly, years, revalor);

  // Extraction des valeurs finales (dernier point du tableau)
  var finalBrut  = donnees[donnees.length - 1] ? donnees[donnees.length - 1].value : 0;
  var totalVerse = versData[versData.length - 1] ? versData[versData.length - 1].value : 0;

  // Gains = différence entre capital final et sommes versées
  var gainsBruts = Math.max(0, finalBrut - totalVerse);

  // Calcul du capital net (après impôts selon l'enveloppe fiscale)
  var capitalNet  = applyEnvelopeFiscality(finalBrut, totalVerse, envelopeId, tmi, years);

  // Calcul du capital réel (corrigé de l'inflation)
  var capitalReel = finalBrut / Math.pow(1 + inflation / 100, years);

  // Rente mensuelle selon la règle des 4% (retraite anticipée)
  var rente4 = finalBrut * 0.04 / 12;

  /* Mise à jour de l'affichage des résultats
     On utilise une petite fonction interne pour éviter de répéter
     le même code de recherche + assignation */
  function mettreAJourTexte(id, valeur) {
    var el = document.getElementById(id);
    if (el) el.textContent = valeur;
  }

  mettreAJourTexte('res-final',   fmtN(finalBrut));
  mettreAJourTexte('res-net',     fmtN(capitalNet));
  mettreAJourTexte('res-reel',    fmtN(capitalReel));
  mettreAJourTexte('res-versed',  fmtN(totalVerse));
  mettreAJourTexte('res-gains',   fmtN(gainsBruts));
  mettreAJourTexte('res-rente',   fmtN(rente4) + '/m');

  // Multiplicateur = combien de fois on a multiplié son investissement
  if (finalBrut > 0 && totalVerse > 0) {
    mettreAJourTexte('res-ratio', (finalBrut / totalVerse).toFixed(2) + '×');
  } else {
    mettreAJourTexte('res-ratio', '—');
  }

  // Affichage des infos de l'enveloppe fiscale choisie
  updateEnvelopeInfo(envelopeId, 'envelope-info-box');

  // Mise à jour des KPIs sur la page d'accueil
  document.getElementById('home-capital').textContent = fmt(finalBrut);
  document.getElementById('home-gains').textContent   = fmt(gainsBruts);

  // Sauvegarde des résultats en local (pour la page d'accueil)
  saveLocal('investResult', { final: finalBrut, gains: gainsBruts });

  // Rendu des graphiques
  renderInvestCharts();
  updateHomeChart(donnees, versData);
}

/*
  renderInvestCharts() — dessine tous les graphiques de la page Investissement.
  
  Lit les paramètres et crée/met à jour 4 graphiques :
  1. Évolution du capital
  2. Multi-taux (comparaison de différents taux)
  3. Composition (versements vs intérêts)
  4. Inflation (valeur nominale vs réelle)
  + Tableau d'amortissement + Détail annuel
*/
function renderInvestCharts() {
  var capital   = fv('r-capital');
  var monthly   = fv('r-monthly');
  var rate      = fv('r-rate');
  var years     = iv('r-years') || 0;
  var inflation = fv('r-inflation');
  var frais     = fv('r-frais');
  var revalor   = fv('r-revalor');
  var rateNet   = Math.max(0, rate - frais);

  if (years <= 0) return; // Rien à afficher sans durée

  var donnees  = calcCapital(capital, monthly, rateNet, years, revalor);
  var versData = calcVersementsCumul(capital, monthly, years, revalor);

  // Labels pour l'axe X : "An 0", "An 1", …, "An N"
  var labels = [];
  for (var i = 0; i < donnees.length; i++) {
    labels.push('An ' + donnees[i].year);
  }

  var opts = chartDefaults();

  /* ── Graphique 1 : Évolution du capital ── */
  destroyChart('invest');
  charts.invest = new Chart(
    document.getElementById('invest-chart').getContext('2d'),
    {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label:           'Capital total',
            data:            donnees.map(function(d) { return d.value; }),
            borderColor:     '#5b6fff',
            backgroundColor: 'rgba(91,111,255,0.07)',
            borderWidth:     2.5,
            fill:            true,
            tension:         0.4,
            pointRadius:     0,
            pointHoverRadius: 5
          },
          {
            label:           'Versements cumulés',
            data:            versData.map(function(d) { return d.value; }),
            borderColor:     '#4aa3e8',
            borderDash:      [5, 5],
            borderWidth:     1.5,
            fill:            false,
            tension:         0,
            pointRadius:     0,
            pointHoverRadius: 4
          },
          {
            label:           'Capital réel (inflation)',
            /* On divise chaque valeur par le facteur d'inflation accumulé */
            data:            donnees.map(function(d, i) {
                               return d.value / Math.pow(1 + inflation / 100, i);
                             }),
            borderColor:     '#00c9a7',
            borderDash:      [3, 3],
            borderWidth:     1.5,
            fill:            false,
            tension:         0.4,
            pointRadius:     0,
            pointHoverRadius: 4
          }
        ]
      },
      options: opts
    }
  );

  /* ── Graphique 2 : Multi-taux ── */
  destroyChart('rend-multi');
  var tauxListe   = [3, 5, 7, 10, 12];
  var couleurs    = ['#4aa3e8', '#00c9a7', '#5b6fff', '#d4af37', '#f24463'];
  var datasetsMultiTaux = [];

  for (var t = 0; t < tauxListe.length; t++) {
    var taux      = tauxListe[t];
    var couleur   = couleurs[t];
    var tauxNetT  = Math.max(0, taux - frais);
    var donneesT  = calcCapital(capital, monthly, tauxNetT, years, revalor);

    datasetsMultiTaux.push({
      label:           taux + '%',
      data:            donneesT.map(function(x) { return x.value; }),
      borderColor:     couleur,
      backgroundColor: couleur + '10',
      borderWidth:     2,
      fill:            true,
      tension:         0.4,
      pointRadius:     0,
      pointHoverRadius: 4
    });
  }

  charts['rend-multi'] = new Chart(
    document.getElementById('rend-multi-chart').getContext('2d'),
    { type: 'line', data: { labels: labels, datasets: datasetsMultiTaux }, options: chartDefaults() }
  );

  /* ── Graphique 3 : Composition (versements vs intérêts) ── */
  destroyChart('rend-compo');
  var versementsFinal = versData[versData.length - 1] ? versData[versData.length - 1].value : 0;

  // Pour chaque taux, on calcule les intérêts générés = capital final - versements
  var tauxCompo     = [3, 5, 7, 10];
  var interetsCompo = [];
  for (var tc = 0; tc < tauxCompo.length; tc++) {
    var tauxNetC   = Math.max(0, tauxCompo[tc] - frais);
    var capitalFin = calcCapAt(capital, monthly, tauxNetC, years);
    interetsCompo.push(Math.max(0, capitalFin - versementsFinal));
  }

  var optsCompo = chartDefaults();
  // Options de l'axe Y pour les barres empilées
  var axeYCompo = {
    stacked: true,
    ticks: {
      color:  '#5e6685',
      font:   { family: 'DM Mono, monospace', size: 10 },
      callback: function(v) {
        if (Math.abs(v) >= 1000000) return (v / 1000000).toFixed(1) + 'M€';
        if (Math.abs(v) >= 1000)    return (v / 1000).toFixed(0) + 'k€';
        return v + '€';
      }
    },
    grid: { color: 'rgba(91,111,255,0.05)' }
  };
  var axeXCompo = {
    stacked: true,
    ticks:   { color: '#5e6685', font: { family: 'DM Mono, monospace', size: 10 } },
    grid:    { color: 'rgba(91,111,255,0.05)' }
  };

  charts['rend-compo'] = new Chart(
    document.getElementById('rend-compo-chart').getContext('2d'),
    {
      type: 'bar',
      data: {
        labels: ['3%', '5%', '7%', '10%'],
        datasets: [
          {
            label:           'Versements',
            data:            [versementsFinal, versementsFinal, versementsFinal, versementsFinal],
            backgroundColor: 'rgba(74,163,232,0.55)',
            borderColor:     '#4aa3e8',
            borderWidth:     1.5,
            borderRadius:    4
          },
          {
            label:           'Intérêts',
            data:            interetsCompo,
            backgroundColor: 'rgba(91,111,255,0.55)',
            borderColor:     '#5b6fff',
            borderWidth:     1.5,
            borderRadius:    4
          }
        ]
      },
      options: Object.assign({}, optsCompo, { scales: { x: axeXCompo, y: axeYCompo } })
    }
  );

  /* ── Graphique 4 : Inflation (valeur nominale vs réelle) ── */
  destroyChart('rend-inflation');
  charts['rend-inflation'] = new Chart(
    document.getElementById('rend-inflation-chart').getContext('2d'),
    {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label:           'Valeur nominale',
            data:            donnees.map(function(d) { return d.value; }),
            borderColor:     '#5b6fff',
            backgroundColor: 'rgba(91,111,255,0.07)',
            borderWidth:     2,
            fill:            true,
            tension:         0.4,
            pointRadius:     0,
            pointHoverRadius: 5
          },
          {
            label:           'Valeur réelle',
            data:            donnees.map(function(d, i) {
                               return d.value / Math.pow(1 + inflation / 100, i);
                             }),
            borderColor:     '#d4af37',
            backgroundColor: 'rgba(212,175,55,0.06)',
            borderWidth:     2,
            fill:            true,
            tension:         0.4,
            pointRadius:     0,
            pointHoverRadius: 5,
            borderDash:      [4, 3]
          }
        ]
      },
      options: chartDefaults()
    }
  );

  // Tableau d'amortissement détaillé
  renderAmortTable(capital, monthly, rateNet, years, revalor);

  // Graphique du détail annuel (onglet séparé)
  renderRendDetail();
}


/* ══ TABLEAU D'AMORTISSEMENT ══
   Affiche année par année : capital de départ, versements, intérêts, capital de fin.
*/
function renderAmortTable(capital, monthly, rateNet, years, revalor) {
  var container = document.getElementById('amort-table-container');
  if (!container) return;

  if (years <= 0 || rateNet <= 0) {
    container.innerHTML = '<p style="color:var(--t2);font-size:0.78rem;padding:12px">Renseignez un taux et une durée pour afficher le tableau.</p>';
    return;
  }

  var lignesHTML      = '';
  var capitalCourant  = capital;
  var versementMensuel= monthly;
  var totalVerse      = capital;    // On comptabilise le capital initial
  var totalInterets   = 0;

  // On limite à 50 ans pour ne pas avoir un tableau trop long
  var dureeMax = Math.min(years, 50);

  for (var annee = 1; annee <= dureeMax; annee++) {
    var capitalDebut    = capitalCourant;
    var tauxMensuel     = rateNet / 100 / 12;
    var interetsAnnee   = 0;

    // Calcul des 12 mois : on accumule les intérêts générés
    for (var mois = 0; mois < 12; mois++) {
      interetsAnnee  += capitalCourant * tauxMensuel;
      capitalCourant  = capitalCourant * (1 + tauxMensuel) + versementMensuel;
    }

    var versementsAnnee = versementMensuel * 12;
    totalVerse         += versementsAnnee;
    totalInterets      += interetsAnnee;

    // Pourcentage que représentent les intérêts dans le capital de fin d'année
    var pctInterets = capitalCourant > 0
      ? (interetsAnnee / capitalCourant * 100).toFixed(1)
      : '0.0';

    lignesHTML +=
      '<tr>' +
        '<td style="color:var(--t2)">' + annee + '</td>' +
        '<td>' + fmtN(capitalDebut) + '</td>' +
        '<td style="color:var(--blue)">' + fmtN(versementsAnnee) + '</td>' +
        '<td style="color:var(--teal)">' + fmtN(interetsAnnee) + '</td>' +
        '<td style="color:var(--acc-l)">' + fmtN(capitalCourant) + '</td>' +
        '<td style="color:var(--gold)">' + pctInterets + '%</td>' +
      '</tr>';
  }

  container.innerHTML =
    '<table class="amort-table">' +
      '<thead>' +
        '<tr>' +
          '<th>Année</th>' +
          '<th>Capital début</th>' +
          '<th style="color:var(--blue)">Versements</th>' +
          '<th style="color:var(--teal)">Intérêts générés</th>' +
          '<th style="color:var(--acc-l)">Capital fin</th>' +
          '<th style="color:var(--gold)">% intérêts</th>' +
        '</tr>' +
      '</thead>' +
      '<tbody>' + lignesHTML + '</tbody>' +
      '<tfoot>' +
        '<tr style="border-top:1px solid var(--border-h)">' +
          '<td colspan="2" style="color:var(--t2);font-weight:600">Total</td>' +
          '<td style="color:var(--blue);font-weight:700">' + fmtN(totalVerse) + '</td>' +
          '<td style="color:var(--teal);font-weight:700">' + fmtN(totalInterets) + '</td>' +
          '<td style="color:var(--acc-l);font-weight:700">' + fmtN(capitalCourant) + '</td>' +
          '<td></td>' +
        '</tr>' +
      '</tfoot>' +
    '</table>';
}

/*
  setRendTaux(t, btn) — change le taux du graphique "Détail annuel".
  Paramètres :
  - t   : le taux à appliquer (5, 7 ou 10)
  - btn : le bouton cliqué (pour le style actif)
*/
function setRendTaux(t, btn) {
  _rendTaux = t;

  // Retirer le style actif de tous les boutons
  var tousBoutons = document.querySelectorAll('.tb');
  for (var i = 0; i < tousBoutons.length; i++) {
    tousBoutons[i].classList.remove('active');
  }
  if (btn) btn.classList.add('active');

  renderRendDetail();
}

/*
  renderRendDetail() — dessine le graphique "Détail annuel — versements & intérêts"
  avec le taux _rendTaux actuellement sélectionné.
*/
function renderRendDetail() {
  var capital  = fv('r-capital');
  var monthly  = fv('r-monthly');
  var frais    = fv('r-frais');
  var years    = iv('r-years') || 0;
  var revalor  = fv('r-revalor');
  if (years <= 0) return;

  var rateNet = Math.max(0, _rendTaux - frais);
  var donnees = calcCapital(capital, monthly, rateNet, years, revalor);
  var versD   = calcVersementsCumul(capital, monthly, years, revalor);

  var labels = [];
  for (var i = 0; i < donnees.length; i++) {
    labels.push('An ' + donnees[i].year);
  }

  var dOpts = chartDefaults();
  var axeY  = {
    stacked: true,
    ticks: {
      color: '#5e6685',
      font:  { family: 'DM Mono, monospace', size: 10 },
      callback: function(v) {
        if (Math.abs(v) >= 1000000) return (v / 1000000).toFixed(1) + 'M€';
        if (Math.abs(v) >= 1000)    return (v / 1000).toFixed(0) + 'k€';
        return v + '€';
      }
    },
    grid: { color: 'rgba(91,111,255,0.05)' }
  };
  var axeX = {
    stacked:       true,
    ticks:         { color: '#5e6685', font: { family: 'DM Mono, monospace', size: 10 }, maxTicksLimit: 12 },
    grid:          { color: 'rgba(91,111,255,0.05)' }
  };

  destroyChart('rend-detail');
  charts['rend-detail'] = new Chart(
    document.getElementById('rend-detail-chart').getContext('2d'),
    {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label:           'Versements cumulés',
            data:            versD.map(function(d) { return d.value; }),
            backgroundColor: 'rgba(74,163,232,0.5)',
            borderColor:     '#4aa3e8',
            borderWidth:     0,
            borderRadius:    2
          },
          {
            label:           'Intérêts générés',
            /* Intérêts = différence entre capital total et versements */
            data:            donnees.map(function(d, i) {
                               return Math.max(0, d.value - versD[i].value);
                             }),
            backgroundColor: 'rgba(91,111,255,0.55)',
            borderColor:     '#5b6fff',
            borderWidth:     0,
            borderRadius:    2
          }
        ]
      },
      options: Object.assign({}, dOpts, { scales: { x: axeX, y: axeY } })
    }
  );

  /* Mise à jour des KPIs sous le graphique */
  var capitalFinal  = donnees[donnees.length - 1].value;
  var versedFinal   = versD[versD.length - 1].value;
  var interetsFinal = Math.max(0, capitalFinal - versedFinal);

  var multiplicateur;
  if (capitalFinal > 0 && versedFinal > 0) {
    multiplicateur = (capitalFinal / versedFinal).toFixed(2) + '×';
  } else {
    multiplicateur = '—';
  }

  var kpis = [
    { val: fmt(capitalFinal),   lbl: 'Capital final',   color: 'var(--acc-l)' },
    { val: fmt(versedFinal),    lbl: 'Total versé',      color: 'var(--blue)'  },
    { val: fmt(interetsFinal),  lbl: 'Intérêts',         color: 'var(--teal)'  },
    { val: multiplicateur,      lbl: 'Multiplicateur',   color: 'var(--gold)'  }
  ];

  var htmlKpis = '';
  for (var k = 0; k < kpis.length; k++) {
    htmlKpis +=
      '<div class="dk-item">' +
        '<div class="dk-val" style="color:' + kpis[k].color + '">' + kpis[k].val + '</div>' +
        '<div class="dk-lbl">' + kpis[k].lbl + '</div>' +
      '</div>';
  }
  document.getElementById('rend-detail-kpis').innerHTML = htmlKpis;
}


/* ══ MONTE CARLO ══
   Simule 200 trajectoires aléatoires pour visualiser
   l'incertitude sur le capital final.
   
   Principe : on tire des chocs aléatoires chaque mois
   autour du rendement attendu, selon une distribution normale.
*/
function renderMonteCarlo() {
  var canvas = document.getElementById('invest-mc-chart');
  if (!canvas) return;

  var capital  = fv('r-capital');
  var monthly  = fv('r-monthly');
  var rate     = fv('r-rate');
  var years    = iv('r-years') || 0;
  var frais    = fv('r-frais');
  var rateNet  = Math.max(0, rate - frais);

  if (years <= 0) return;

  // Forcer la taille du canvas pour que Chart.js fonctionne sur un panneau caché
  var parent = canvas.parentElement;
  if (parent.offsetWidth > 0) {
    canvas.width  = parent.offsetWidth;
    canvas.height = parent.offsetHeight || 260;
  }

  var NB_SIMULATIONS = 200;
  var volatiliteAnnuelle = rateNet * 0.6; // Volatilité estimée ≈ 60% du taux annuel

  var labels = [];
  for (var i = 0; i <= years; i++) {
    labels.push('An ' + i);
  }

  // On stocke toutes les simulations et les valeurs finales
  var toutesSimulations = [];
  var toutesFinals      = [];

  // Données pour les percentiles (valeurs classées par quantile)
  var percentilesData = { p10: [], p25: [], p50: [], p75: [], p90: [] };

  /* Boucle principale : on simule NB_SIMULATIONS trajectoires */
  for (var s = 0; s < NB_SIMULATIONS; s++) {
    var capitalCourant = capital;
    var trajectoire    = [capitalCourant]; // Démarre avec le capital initial

    var volMensuelle   = volatiliteAnnuelle / 100 / Math.sqrt(12); // Volatilité ramenée au mois
    var tauxMensuel    = rateNet / 100 / 12;

    for (var annee = 0; annee < years; annee++) {
      for (var mois = 0; mois < 12; mois++) {
        /* Génération d'un choc aléatoire selon une distribution normale
           via la méthode de Box-Muller :
           - u1 = nombre aléatoire entre 0 et 1
           - choc = volMensuelle × √(-2 ln(u1)) × cos(2π × rand)
           Cela donne un choc qui suit une courbe en cloche (gaussienne)
        */
        var u1   = Math.random() || 1e-10; // On évite 0 pour le log
        var choc = volMensuelle * (Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * Math.random()));

        capitalCourant = capitalCourant * (1 + tauxMensuel + choc) + monthly;
      }
      trajectoire.push(capitalCourant);
    }

    toutesSimulations.push(trajectoire);
    toutesFinals.push(capitalCourant);
  }

  /* Calcul des percentiles pour chaque année
     On trie les valeurs et on prend : P10 (pessimiste), P25, P50 (médiane), P75, P90 (optimiste) */
  for (var annee = 0; annee <= years; annee++) {
    // On extrait la valeur de cette année dans chaque simulation
    var valeursCetteAnnee = [];
    for (var s2 = 0; s2 < toutesSimulations.length; s2++) {
      valeursCetteAnnee.push(toutesSimulations[s2][annee]);
    }
    // On trie du plus petit au plus grand
    valeursCetteAnnee.sort(function(a, b) { return a - b; });

    // Fonction pour extraire un percentile (p = 10, 25, 50, 75, ou 90)
    function extrairePercentile(p) {
      var index = Math.floor(p / 100 * valeursCetteAnnee.length);
      return valeursCetteAnnee[index] || 0;
    }

    percentilesData.p10.push(extrairePercentile(10));
    percentilesData.p25.push(extrairePercentile(25));
    percentilesData.p50.push(extrairePercentile(50));
    percentilesData.p75.push(extrairePercentile(75));
    percentilesData.p90.push(extrairePercentile(90));
  }

  /* On prend 10 trajectoires échantillonnées pour l'affichage en fond */
  var echantillonTrajectoires = [];
  for (var idx = 0; idx < toutesSimulations.length; idx++) {
    if (idx % 20 === 0 && echantillonTrajectoires.length < 10) {
      echantillonTrajectoires.push(toutesSimulations[idx]);
    }
  }

  destroyChart('invest-mc');

  /* Construction des datasets pour Chart.js */
  var datasets = [];

  // Trajectoires individuelles (en fond, semi-transparentes)
  for (var tj = 0; tj < echantillonTrajectoires.length; tj++) {
    datasets.push({
      data:             echantillonTrajectoires[tj],
      borderColor:      'rgba(91,111,255,0.12)',
      borderWidth:      1,
      fill:             false,
      tension:          0.3,
      pointRadius:      0,
      pointHoverRadius: 0,
      label:            '' // Pas de label = pas dans la légende
    });
  }

  // Courbes des percentiles
  datasets.push({ label: 'P90 (optimiste)',  data: percentilesData.p90, borderColor: '#00c9a7', borderWidth: 2,   fill: false, tension: 0.4, pointRadius: 0, pointHoverRadius: 4, borderDash: [4,3] });
  datasets.push({ label: 'P75',              data: percentilesData.p75, borderColor: 'rgba(0,201,167,0.45)', borderWidth: 1.5, fill: false, tension: 0.4, pointRadius: 0, pointHoverRadius: 3 });
  datasets.push({ label: 'Médiane (P50)',    data: percentilesData.p50, borderColor: '#5b6fff', borderWidth: 2.5, fill: false, tension: 0.4, pointRadius: 0, pointHoverRadius: 5 });
  datasets.push({ label: 'P25',              data: percentilesData.p25, borderColor: 'rgba(242,68,99,0.45)', borderWidth: 1.5, fill: false, tension: 0.4, pointRadius: 0, pointHoverRadius: 3 });
  datasets.push({ label: 'P10 (pessimiste)', data: percentilesData.p10, borderColor: '#f24463', borderWidth: 2,   fill: false, tension: 0.4, pointRadius: 0, pointHoverRadius: 4, borderDash: [4,3] });

  var optsMC = Object.assign({}, chartDefaults(), {
    responsive:          true,
    maintainAspectRatio: false
  });
  // On ne montre dans le tooltip que les datasets avec un label (pas les trajectoires grises)
  optsMC.plugins = Object.assign({}, chartDefaults().plugins);
  optsMC.plugins.tooltip = Object.assign({}, chartDefaults().plugins.tooltip, {
    filter: function(item) {
      return item.dataset.label !== '';
    },
    callbacks: {
      label: function(context) {
        if (!context.dataset.label) return null;
        return '  ' + context.dataset.label + ' : ' + fmtN(context.raw);
      }
    }
  });

  charts['invest-mc'] = new Chart(
    canvas.getContext('2d'),
    { type: 'line', data: { labels: labels, datasets: datasets }, options: optsMC }
  );

  /* KPIs du Monte Carlo : médiane, pessimiste, optimiste, probabilité de gain */
  toutesFinals.sort(function(a, b) { return a - b; });

  function percentileFinal(p) {
    return toutesFinals[Math.floor(p / 100 * toutesFinals.length)];
  }

  var totalVerse  = capital + monthly * years * 12;
  var nbPositifs  = 0;
  for (var f = 0; f < toutesFinals.length; f++) {
    if (toutesFinals[f] > totalVerse) nbPositifs++;
  }
  var probPositif = nbPositifs / NB_SIMULATIONS * 100;

  var kpisEl = document.getElementById('mc-kpis');
  if (kpisEl) {
    var kpis = [
      { val: fmt(percentileFinal(50)), lbl: 'Médiane finale',    color: 'var(--acc-l)' },
      { val: fmt(percentileFinal(10)), lbl: 'Pessimiste (P10)', color: 'var(--red)'   },
      { val: fmt(percentileFinal(90)), lbl: 'Optimiste (P90)',  color: 'var(--teal)'  },
      { val: probPositif.toFixed(0) + '%', lbl: 'Prob. de gain', color: 'var(--gold)' }
    ];
    var htmlKpis = '';
    for (var k = 0; k < kpis.length; k++) {
      htmlKpis +=
        '<div class="dk-item">' +
          '<div class="dk-val" style="color:' + kpis[k].color + '">' + kpis[k].val + '</div>' +
          '<div class="dk-lbl">' + kpis[k].lbl + '</div>' +
        '</div>';
    }
    kpisEl.innerHTML = htmlKpis;
  }
}


/* ══ GRAPHIQUE D'ACCUEIL ══
   Mini-graphique affiché dans le bandeau hero de la page d'accueil.
*/
function updateHomeChart(donnees, versData) {
  destroyChart('home');
  charts.home = new Chart(
    document.getElementById('home-chart').getContext('2d'),
    {
      type: 'line',
      data: {
        labels: donnees.map(function(d) { return 'An ' + d.year; }),
        datasets: [
          {
            data:             donnees.map(function(d) { return d.value; }),
            borderColor:      '#5b6fff',
            backgroundColor:  'rgba(91,111,255,0.12)',
            fill:             true,
            tension:          0.4,
            borderWidth:      2.5,
            pointRadius:      0,
            pointHoverRadius: 5
          },
          {
            data:             versData.map(function(d) { return d.value; }),
            borderColor:      '#4aa3e8',
            borderDash:       [4, 4],
            fill:             false,
            tension:          0,
            borderWidth:      1.5,
            pointRadius:      0,
            pointHoverRadius: 4
          }
        ]
      },
      options: {
        responsive:          true,
        maintainAspectRatio: false,
        interaction:         { mode: 'index', intersect: false },
        plugins: {
          legend:  { display: false }, // Pas de légende sur le mini graphique
          tooltip: {
            backgroundColor: '#0b0d17',
            borderColor:     'rgba(91,111,255,0.4)',
            borderWidth:     1,
            titleColor:      '#8a9bff',
            bodyColor:       '#a8b0d0',
            padding:         { top: 10, bottom: 10, left: 14, right: 14 },
            titleFont:       { family: 'DM Mono, monospace', size: 11 },
            bodyFont:        { family: 'DM Mono, monospace', size: 12 },
            cornerRadius:    8,
            callbacks: {
              label: function(c) { return '  ' + fmtN(c.raw); }
            }
          }
        },
        scales: {
          x: { display: false }, // Axes cachés sur le mini graphique
          y: { display: false }
        }
      }
    }
  );
}


/* ══════════════════════════════════════════
   PAGE RETRAITE
   Simulateur de capitalisation pour la retraite.
══════════════════════════════════════════ */

/*
  calcRetraite(capitalActuel, epargne, tauxAnnuel, annees, revalor) —
  simule l'accumulation d'un capital retraite pendant la phase d'épargne.
  
  Même principe que calcCapital() mais adapté à la retraite.
  Retourne : { data: tableau, final: valeur finale, versements: total versé }
*/
function calcRetraite(capitalActuel, epargne, tauxAnnuel, annees, revalor) {
  var donnees          = [];
  var capitalCourant   = capitalActuel;
  var epargneActuelle  = epargne;

  for (var annee = 0; annee <= annees; annee++) {
    if (annee > 0) {
      var tauxMensuel = tauxAnnuel / 100 / 12;
      for (var mois = 0; mois < 12; mois++) {
        capitalCourant = capitalCourant * (1 + tauxMensuel) + epargneActuelle;
      }
      epargneActuelle = epargneActuelle * (1 + revalor / 100);
    }
    donnees.push({ year: annee, value: capitalCourant });
  }

  // Total versé = capital initial + (épargne × 12 mois × nombre d'années)
  var totalVersements = capitalActuel + epargne * annees * 12;

  return {
    data:       donnees,
    final:      capitalCourant,
    versements: totalVersements
  };
}

/*
  calcRente(capital, tauxAnnuel, dureeAns) — calcule la rente mensuelle
  qu'on peut tirer d'un capital pendant une durée donnée.
  
  On utilise la formule de l'annuité (rente viagère avec rendement) :
  rente = capital × r / (1 - (1+r)^-n)
  où r = taux mensuel et n = nombre de mois
  
  Si taux = 0 : rente = capital / nombre de mois (division simple)
*/
function calcRente(capital, tauxAnnuel, dureeAns) {
  if (dureeAns <= 0 || capital <= 0) return 0;

  var tauxMensuel = tauxAnnuel / 100 / 12;
  var nbMois      = dureeAns * 12;

  if (tauxMensuel === 0) {
    return capital / nbMois; // Cas simple sans rendement
  }

  return capital * tauxMensuel / (1 - Math.pow(1 + tauxMensuel, -nbMois));
}

/*
  updateRetraite() — fonction principale de la page Retraite.
  Lit les sliders, calcule les résultats et met à jour l'affichage.
*/
function updateRetraite() {
  // Lecture des sliders
  var ageActuel    = iv('ret-age-actuel')    || 35;
  var ageRetraite  = iv('ret-age-retraite')  || 65;
  var esperance    = iv('ret-esperance')     || 85;
  var capital      = fv('ret-capital-actuel');
  var epargne      = fv('ret-epargne-mensuelle');
  var taux         = fv('ret-taux')          || 5;
  var inflation    = fv('ret-inflation')     || 2;
  var revalor      = fv('ret-revalor')       || 0;
  var objectif     = fv('ret-objectif')      || 2000;

  /* Petite fonction interne pour mettre à jour un texte */
  function setText(id, texte) {
    var el = document.getElementById(id);
    if (el) el.textContent = texte;
  }

  // Mise à jour des labels des sliders
  setText('v-age-actuel',        ageActuel + ' ans');
  setText('v-age-retraite',      ageRetraite + ' ans');
  setText('v-esperance',         esperance + ' ans');
  setText('v-capital-actuel',    fmtN(capital));
  setText('v-epargne-mensuelle', fmtN(epargne));
  setText('v-taux-ret',          taux.toFixed(1) + ' %');
  setText('v-inflation',         inflation.toFixed(1) + ' %');
  setText('v-revalor-ret',       revalor.toFixed(1) + ' %');
  setText('v-objectif',          fmtN(objectif));

  // Calcul des durées
  var anneesEpargne  = Math.max(0, ageRetraite - ageActuel);  // Nombre d'années à épargner
  var anneesRetraite = Math.max(0, esperance - ageRetraite);   // Nombre d'années à la retraite
  var tauxRetrait    = 4; // Taux de retrait (règle des 4%)

  // Calcul du capital à la retraite
  var resultat     = calcRetraite(capital, epargne, taux, anneesEpargne, revalor);
  var capitalFinal = resultat.final;
  var versements   = resultat.versements;
  var donnees      = resultat.data;

  // Capital corrigé de l'inflation
  var capitalReel = capitalFinal / Math.pow(1 + inflation / 100, anneesEpargne);

  // Rente mensuelle (nominale et réelle)
  var renteNominale = calcRente(capitalFinal, tauxRetrait, anneesRetraite);
  var renteReelle   = renteNominale / Math.pow(1 + inflation / 100, anneesEpargne);

  // Mise à jour des KPIs
  setText('ret-capital-final', fmt(capitalFinal));
  setText('ret-rente',         fmt(renteNominale) + '/m');
  setText('ret-annees',        anneesEpargne + ' ans');
  setText('ret-effort',        fmt(versements));
  setText('ret-res-capital',          fmtN(capitalFinal));
  setText('ret-res-capital-reel',     fmtN(capitalReel));
  setText('ret-res-rente-nominale',   fmtN(renteNominale));
  setText('ret-res-rente-reelle',     fmtN(renteReelle));

  /* Barre de progression vers l'objectif de rente */
  var pourcentage = objectif > 0 ? Math.min(100, Math.round(renteNominale / objectif * 100)) : 0;
  document.getElementById('ret-progress-bar').style.width = pourcentage + '%';
  setText('ret-progress-pct', pourcentage + '%');

  // Message d'atteinte de l'objectif
  var difference = renteNominale - objectif;
  var msgElement  = document.getElementById('ret-objectif-msg');
  if (difference >= 0) {
    msgElement.innerHTML =
      '<span style="color:var(--teal)">✓ Objectif atteint</span>' +
      ' — surplus de <strong style="color:var(--teal)">' + fmtN(difference) + '/mois</strong>';
  } else {
    msgElement.innerHTML =
      '<span style="color:var(--red)">✗ Objectif non atteint</span>' +
      ' — manque de <strong style="color:var(--red)">' + fmtN(Math.abs(difference)) + '/mois</strong>';
  }

  /* Scénarios comparés (pessimiste, base, optimiste) */
  var scenarios = [
    { label: 'Pessimiste', taux: Math.max(0.5, taux - 2), color: '#f24463' },
    { label: 'Base',       taux: taux,                    color: '#5b6fff' },
    { label: 'Optimiste',  taux: taux + 2,                color: '#00c9a7' }
  ];

  var htmlScenarios = '';
  for (var s = 0; s < scenarios.length; s++) {
    var sc   = scenarios[s];
    var res  = calcRetraite(capital, epargne, sc.taux, anneesEpargne, revalor);
    var rente = calcRente(res.final, tauxRetrait, anneesRetraite);

    htmlScenarios +=
      '<div style="display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:center;' +
        'background:var(--bg3);border-radius:var(--r-sm);padding:9px 12px;margin-bottom:6px">' +
        '<span style="color:' + sc.color + ';font-weight:600;font-size:0.82rem">' +
          sc.label +
          ' <span style="color:var(--t2);font-weight:400">(' + sc.taux.toFixed(1) + '%)</span>' +
        '</span>' +
        '<span style="color:var(--t1);font-weight:700;font-family:var(--font-mono);font-size:0.82rem;text-align:right">' +
          fmt(res.final) +
        '</span>' +
        '<span style="color:var(--t2);font-family:var(--font-mono);font-size:0.82rem;text-align:right">' +
          fmt(rente) + '/m' +
        '</span>' +
      '</div>';
  }
  document.getElementById('ret-scenarios').innerHTML = htmlScenarios;

  /* Graphique d'évolution de l'épargne */
  destroyChart('retraite');

  // Versements cumulés (simple : capital + épargne × mois)
  var ligneVersements = [];
  for (var annee = 0; annee < donnees.length; annee++) {
    ligneVersements.push(capital + epargne * donnees[annee].year * 12);
  }

  charts.retraite = new Chart(
    document.getElementById('retraite-chart').getContext('2d'),
    {
      type: 'line',
      data: {
        labels: donnees.map(function(d) { return (ageActuel + d.year) + ' ans'; }),
        datasets: [
          {
            label:            'Capital accumulé',
            data:             donnees.map(function(d) { return d.value; }),
            borderColor:      '#5b6fff',
            backgroundColor:  'rgba(91,111,255,0.08)',
            borderWidth:      2.5,
            fill:             true,
            tension:          0.4,
            pointRadius:      0,
            pointHoverRadius: 5
          },
          {
            label:            'Versements cumulés',
            data:             ligneVersements,
            borderColor:      '#4aa3e8',
            borderDash:       [5, 5],
            borderWidth:      1.5,
            fill:             false,
            tension:          0,
            pointRadius:      0,
            pointHoverRadius: 4
          },
          {
            label:            'Capital réel',
            data:             donnees.map(function(d, i) {
                                return d.value / Math.pow(1 + inflation / 100, i);
                              }),
            borderColor:      '#00c9a7',
            borderDash:       [3, 3],
            borderWidth:      1.5,
            fill:             false,
            tension:          0.4,
            pointRadius:      0,
            pointHoverRadius: 4
          }
        ]
      },
      options: chartDefaults()
    }
  );

  // KPI sur la page d'accueil
  document.getElementById('home-retraite').textContent = fmt(capitalFinal);

  // Graphique de décaissement à la retraite
  renderDecaissement(capitalFinal, taux, anneesRetraite);

  // Sauvegarde locale
  saveLocal('retraiteResult', { final: capitalFinal, renteNominale: renteNominale });
}

/*
  renderDecaissement(capital, tauxPlacement, dureeAns) — simule
  le décaissement du capital pendant la phase de retraite.
  
  Affiche 4 courbes selon différents taux de retrait (3%, 4%, 5%, 6%).
*/
function renderDecaissement(capital, tauxPlacement, dureeAns) {
  var canvas = document.getElementById('retraite-decaissement-chart');
  if (!canvas || capital <= 0 || dureeAns <= 0) return;

  var tauxRetrait = [3, 4, 5, 6];
  var couleurs    = ['#00c9a7', '#5b6fff', '#d4af37', '#f24463'];

  var labels = [];
  for (var i = 0; i <= dureeAns; i++) {
    labels.push('Année ' + i);
  }

  var datasets = [];

  for (var t = 0; t < tauxRetrait.length; t++) {
    var tauxR       = tauxRetrait[t];
    var couleur     = couleurs[t];
    var donnees     = [capital];
    var cur         = capital;
    var renteM      = capital * (tauxR / 100) / 12; // Rente mensuelle fixe
    var tauxMensuel = tauxPlacement / 100 / 12;

    // Chaque année : le capital génère des intérêts mais diminue des retraits
    for (var annee = 0; annee < dureeAns; annee++) {
      for (var mois = 0; mois < 12; mois++) {
        cur = cur * (1 + tauxMensuel) - renteM;
      }
      donnees.push(Math.max(0, cur)); // Le capital ne peut pas être négatif
    }

    datasets.push({
      label:            'Retrait ' + tauxR + '% (' + fmt(capital * tauxR / 100 / 12) + '/m)',
      data:             donnees,
      borderColor:      couleur,
      backgroundColor:  couleur + '0a',
      borderWidth:      2,
      fill:             true,
      tension:          0.4,
      pointRadius:      0,
      pointHoverRadius: 5
    });
  }

  destroyChart('retraite-decaissement');
  charts['retraite-decaissement'] = new Chart(
    canvas.getContext('2d'),
    { type: 'line', data: { labels: labels, datasets: datasets }, options: chartDefaults() }
  );
}


/* ══════════════════════════════════════════
   PAGE PATRIMOINE
   Bilan actifs / passifs.
══════════════════════════════════════════ */

/*
  addPatriRow(type) — ajoute une ligne dans le tableau actifs ou passifs.
  Paramètre : type = 'actifs' ou 'passifs'
*/
function addPatriRow(type) {
  var liste  = document.getElementById('patri-' + type + '-list');
  var div    = document.createElement('div');
  div.className = 'patri-row';

  div.innerHTML =
    '<input class="field-input flex2" placeholder="Libellé" oninput="updatePatrimoine()">' +
    '<input class="field-input flex1" type="number" placeholder="0" value="0" oninput="updatePatrimoine()" style="padding-right:12px">' +
    '<button class="del-btn" onclick="this.parentElement.remove();updatePatrimoine()">✕</button>';

  liste.appendChild(div);
  updatePatrimoine();
}

/*
  getPatriRows(type) — lit toutes les lignes du tableau actifs ou passifs.
  Retourne un tableau d'objets { label, value } avec uniquement les lignes > 0.
*/
function getPatriRows(type) {
  var lignes    = document.querySelectorAll('#patri-' + type + '-list .patri-row');
  var resultats = [];

  for (var i = 0; i < lignes.length; i++) {
    var inputs  = lignes[i].querySelectorAll('input');
    var libelle = inputs[0].value || 'Sans nom';
    var valeur  = parseFloat(inputs[1].value) || 0;

    // On ne garde que les lignes avec une valeur positive
    if (valeur > 0) {
      resultats.push({ label: libelle, value: valeur });
    }
  }
  return resultats;
}

/* initPatrimoine() — initialise la page Patrimoine */
function initPatrimoine() {
  if (!document.getElementById('patri-actifs-chart')) return;
  updatePatrimoine();
}

/*
  updatePatrimoine() — recalcule et affiche le bilan patrimonial.
*/
function updatePatrimoine() {
  var actifs  = getPatriRows('actifs');
  var passifs = getPatriRows('passifs');

  // Calcul des totaux par addition de toutes les valeurs
  var totalA = 0;
  for (var i = 0; i < actifs.length; i++) totalA += actifs[i].value;

  var totalP = 0;
  for (var j = 0; j < passifs.length; j++) totalP += passifs[j].value;

  var patrimoineNet = totalA - totalP;

  // Taux d'endettement = passifs / actifs × 100
  var tauxDette = totalA > 0 ? (totalP / totalA * 100) : 0;

  /* Fonction interne pour mettre à jour texte + couleur optionnelle */
  function setText(id, texte, couleur) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = texte;
    if (couleur) el.style.color = couleur;
  }

  var couleurNet = patrimoineNet >= 0 ? 'var(--teal)' : 'var(--red)';
  setText('patri-net',            fmt(patrimoineNet), couleurNet);
  setText('patri-actifs-total',   fmt(totalA));
  setText('patri-passifs-total',  fmt(totalP));
  setText('patri-taux-dette',     tauxDette.toFixed(1) + '%');

  /* Barres de santé financière (proportions relatives) */
  var reference = Math.max(totalA, totalP, 1); // On évite la division par 0
  var largeurActifs  = Math.min(100, totalA / reference * 100);
  var largeurPassifs = Math.min(100, totalP / reference * 100);

  document.getElementById('patri-bar-actifs').style.width  = largeurActifs + '%';
  document.getElementById('patri-bar-passifs').style.width = largeurPassifs + '%';
  setText('patri-bar-actifs-lbl',  fmtN(totalA));
  setText('patri-bar-passifs-lbl', fmtN(totalP));

  /* Message de santé financière selon le taux d'endettement */
  var msg = document.getElementById('patri-health-msg');
  if (tauxDette === 0) {
    msg.innerHTML = '<span style="color:var(--teal)">✓ Aucune dette — patrimoine sain.</span>';
  } else if (tauxDette < 30) {
    msg.innerHTML = '<span style="color:var(--teal)">✓ Endettement faible (' + tauxDette.toFixed(1) + '%) — situation confortable.</span>';
  } else if (tauxDette < 60) {
    msg.innerHTML = '<span style="color:var(--gold)">⚠ Endettement modéré (' + tauxDette.toFixed(1) + '%) — à surveiller.</span>';
  } else {
    msg.innerHTML = '<span style="color:var(--red)">✗ Endettement élevé (' + tauxDette.toFixed(1) + '%) — rééquilibrage conseillé.</span>';
  }

  /* Options communes aux graphiques en donut (camembert) */
  var couleurs = generateColors(Math.max(actifs.length, passifs.length, 2));

  function optsDonut() {
    return {
      responsive:          true,
      maintainAspectRatio: false,
      cutout:              '52%', // Épaisseur de l'anneau
      plugins: {
        legend: {
          labels: {
            color:         '#a8b0d0',
            font:          { family: 'DM Mono', size: 10 },
            boxWidth:      8,
            padding:       8,
            usePointStyle: true
          }
        },
        tooltip: {
          backgroundColor: '#0b0d17',
          borderColor:     'rgba(91,111,255,0.4)',
          borderWidth:     1,
          titleColor:      '#8a9bff',
          bodyColor:       '#a8b0d0',
          padding:         12,
          cornerRadius:    8,
          bodyFont:        { family: 'DM Mono, monospace', size: 12 },
          callbacks: {
            label: function(c) { return '  ' + c.label + ' : ' + fmtN(c.raw); }
          }
        }
      }
    };
  }

  /* Graphique donut — Actifs */
  destroyChart('patri-actifs');
  if (actifs.length > 0) {
    var labelsActifs    = actifs.map(function(x) { return x.label; });
    var valeursActifs   = actifs.map(function(x) { return x.value; });
    var bgActifs        = couleurs.slice(0, actifs.length).map(function(c) { return c + 'cc'; });

    charts['patri-actifs'] = new Chart(
      document.getElementById('patri-actifs-chart').getContext('2d'),
      {
        type: 'doughnut',
        data: {
          labels:   labelsActifs,
          datasets: [{ data: valeursActifs, backgroundColor: bgActifs, borderColor: couleurs.slice(0, actifs.length), borderWidth: 1.5 }]
        },
        options: optsDonut()
      }
    );
  }

  /* Graphique donut — Passifs */
  destroyChart('patri-passifs');
  var rouges = ['#f24463', '#ff6b6b', '#e63946', '#c9184a'];
  if (passifs.length > 0) {
    var labelsPassifs   = passifs.map(function(x) { return x.label; });
    var valeursPassifs  = passifs.map(function(x) { return x.value; });
    var bgPassifs       = rouges.slice(0, passifs.length).map(function(c) { return c + 'cc'; });

    charts['patri-passifs'] = new Chart(
      document.getElementById('patri-passifs-chart').getContext('2d'),
      {
        type: 'doughnut',
        data: {
          labels:   labelsPassifs,
          datasets: [{ data: valeursPassifs, backgroundColor: bgPassifs, borderColor: rouges.slice(0, passifs.length), borderWidth: 1.5 }]
        },
        options: optsDonut()
      }
    );
  }

  /* Graphique à barres — Comparaison Actifs / Passifs / Net */
  destroyChart('patri-compare');
  var optsCompare = Object.assign({}, chartDefaults());
  optsCompare.plugins = Object.assign({}, chartDefaults().plugins, {
    legend: { display: false }
  });

  charts['patri-compare'] = new Chart(
    document.getElementById('patri-compare-chart').getContext('2d'),
    {
      type: 'bar',
      data: {
        labels: ['Actifs', 'Passifs', 'Net'],
        datasets: [{
          data:            [totalA, totalP, Math.max(0, patrimoineNet)],
          backgroundColor: ['rgba(0,201,167,0.4)', 'rgba(242,68,99,0.4)', 'rgba(91,111,255,0.4)'],
          borderColor:     ['#00c9a7', '#f24463', '#5b6fff'],
          borderWidth:     1.5,
          borderRadius:    6
        }]
      },
      options: optsCompare
    }
  );
}


/* ══════════════════════════════════════════
   PAGE BUDGET
   Gestion des revenus et dépenses.
══════════════════════════════════════════ */

/* Ajoute un revenu dans la liste (avec valeurs par défaut optionnelles) */
function addRevenu(label, montant) {
  label   = label   || 'Salaire';
  montant = montant || '';
  budgetItems.revenus.push({ label: label, montant: montant });
  renderBudget();
}

/* Ajoute une dépense dans la liste */
function addDepense(label, montant) {
  label   = label   || 'Dépense';
  montant = montant || '';
  budgetItems.depenses.push({ label: label, montant: montant });
  renderBudget();
}

/* renderBudget() — redessine toute la page budget */
function renderBudget() {
  renderBudgetList('revenus-list',  'revenus');
  renderBudgetList('depenses-list', 'depenses');
  updateBudgetSummary();
}

/*
  renderBudgetList(containerId, type) — génère le HTML des lignes de budget.
  Chaque ligne a un champ libellé, un champ montant, et un bouton supprimer.
*/
function renderBudgetList(containerId, type) {
  var html = '';
  for (var i = 0; i < budgetItems[type].length; i++) {
    html += budgetRow(budgetItems[type][i], i, type);
  }
  document.getElementById(containerId).innerHTML = html;
}

/*
  budgetRow(item, i, type) — génère le HTML d'une ligne de budget.
  
  Note sur les oninput : on utilise des chaînes JavaScript directement dans le HTML
  car ces éléments sont recréés dynamiquement (pas de addEventListener possible).
*/
function budgetRow(item, i, type) {
  return (
    '<div class="budget-row-item">' +
      /* Champ libellé : met à jour le label dans budgetItems */
      '<input class="field-input" style="flex:2" value="' + escHtml(String(item.label)) + '"' +
        ' oninput="budgetItems[\'' + type + '\'][' + i + '].label=this.value;updateBudgetSummary()"' +
        ' onkeydown="if(event.key===\'Enter\')this.blur()">' +
      /* Champ montant : met à jour le montant (converti en nombre) */
      '<input class="field-input" type="number" style="flex:1;padding-right:12px"' +
        ' value="' + item.montant + '" placeholder="0"' +
        ' oninput="budgetItems[\'' + type + '\'][' + i + '].montant=parseFloat(this.value)||0;updateBudgetSummary()"' +
        ' onkeydown="if(event.key===\'Enter\')this.blur()">' +
      /* Bouton supprimer : retire l'élément du tableau et redessine */
      '<button class="del-btn"' +
        ' onclick="budgetItems[\'' + type + '\'].splice(' + i + ',1);renderBudget()">✕</button>' +
    '</div>'
  );
}

/*
  updateBudgetSummary() — calcule les totaux et met à jour l'affichage.
*/
function updateBudgetSummary() {
  // Calcul du total revenus
  var totalRevenus = 0;
  for (var i = 0; i < budgetItems.revenus.length; i++) {
    totalRevenus += parseFloat(budgetItems.revenus[i].montant) || 0;
  }

  // Calcul du total dépenses
  var totalDepenses = 0;
  for (var j = 0; j < budgetItems.depenses.length; j++) {
    totalDepenses += parseFloat(budgetItems.depenses[j].montant) || 0;
  }

  var resteAVivre = totalRevenus - totalDepenses;

  // Mise à jour des totaux affichés
  function setText(id, texte) {
    var el = document.getElementById(id);
    if (el) el.textContent = texte;
  }

  setText('b-revenus',  fmtN(totalRevenus));
  setText('b-depenses', fmtN(totalDepenses));

  var elRAL = document.getElementById('b-ral');
  if (elRAL) {
    elRAL.textContent  = fmtN(resteAVivre);
    elRAL.style.color  = resteAVivre >= 0 ? 'var(--teal)' : 'var(--red)';
  }

  // KPI reste à vivre sur la page d'accueil
  document.getElementById('home-ral').textContent = fmt(resteAVivre);

  /* Graphique donut des dépenses */
  var couleurs = generateColors(budgetItems.depenses.length);
  destroyChart('budget-pie');

  if (budgetItems.depenses.length > 0) {
    var labelsDep   = budgetItems.depenses.map(function(x) { return x.label; });
    var montantsDep = budgetItems.depenses.map(function(x) { return parseFloat(x.montant) || 0; });
    var bgDep       = couleurs.map(function(c) { return c + 'cc'; });

    charts['budget-pie'] = new Chart(
      document.getElementById('budget-pie').getContext('2d'),
      {
        type: 'doughnut',
        data: {
          labels:   labelsDep,
          datasets: [{ data: montantsDep, backgroundColor: bgDep, borderColor: couleurs, borderWidth: 1.5 }]
        },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: '55%',
          plugins: {
            legend:  { labels: { color: '#a8b0d0', font: { family: 'DM Mono', size: 10 }, boxWidth: 8, usePointStyle: true } },
            tooltip: {
              backgroundColor: '#0b0d17', borderColor: 'rgba(91,111,255,0.4)', borderWidth: 1,
              titleColor: '#8a9bff', bodyColor: '#a8b0d0', padding: 12, cornerRadius: 8,
              bodyFont: { family: 'DM Mono, monospace', size: 12 },
              callbacks: { label: function(c) { return '  ' + c.label + ' : ' + fmtN(c.raw); } }
            }
          }
        }
      }
    );
  }

  /* Barres de progression par dépense */
  var htmlBarres = '';
  for (var k = 0; k < budgetItems.depenses.length; k++) {
    var dep     = budgetItems.depenses[k];
    var montant = parseFloat(dep.montant) || 0;
    // Pourcentage de cette dépense par rapport au total des revenus
    var pct     = totalRevenus > 0 ? Math.min(100, montant / totalRevenus * 100) : 0;

    htmlBarres +=
      '<div class="bb-row">' +
        '<div class="bb-head">' +
          '<span>' + escHtml(String(dep.label)) + '</span>' +
          '<span style="color:' + couleurs[k] + ';font-weight:600;font-family:var(--font-mono)">' + fmtN(montant) + '</span>' +
        '</div>' +
        '<div class="bb-track">' +
          '<div class="bb-fill" style="width:' + pct + '%;background:' + couleurs[k] + '"></div>' +
        '</div>' +
      '</div>';
  }
  document.getElementById('budget-bars').innerHTML = htmlBarres;

  // Règle 50/30/20
  renderBudget503020(totalRevenus, totalDepenses, resteAVivre);

  // Projection épargne sur 10 ans
  renderBudgetProjection(resteAVivre);

  // Sauvegarde
  saveLocal('budget', budgetItems);
}

/*
  renderBudget503020(totalR, totalD, ral) — affiche l'analyse budgétaire
  selon la règle 50/30/20 (besoins essentiels / loisirs / épargne).
*/
function renderBudget503020(totalR, totalD, ral) {
  var container = document.getElementById('budget-503020');
  if (!container) return;

  /* Cibles : ce que chaque catégorie devrait représenter en % des revenus */
  var cibles = [
    {
      label:  'Besoins essentiels',
      pct:    50, // Cible : 50% des revenus
      actual: totalR > 0 ? (totalD / totalR * 100) : 0, // Réel : % des dépenses
      color:  '#4aa3e8',
      desc:   'Logement, alimentation, transport'
    },
    {
      label:  'Loisirs & envies',
      pct:    30,
      actual: totalR > 0 ? (totalD / totalR * 100) * (30 / 80) : 0,
      color:  '#b06cf8',
      desc:   'Sorties, voyages, abonnements'
    },
    {
      label:  'Épargne & investissement',
      pct:    20,
      actual: totalR > 0 ? (Math.max(0, ral) / totalR * 100) : 0, // Réel : reste à vivre / revenus
      color:  '#00c9a7',
      desc:   'PEA, AV, épargne de précaution'
    }
  ];

  var htmlCibles = '';
  for (var i = 0; i < cibles.length; i++) {
    var c    = cibles[i];
    var diff = c.actual - c.pct;

    // Message selon l'écart par rapport à la cible
    var statut;
    if (Math.abs(diff) < 3) {
      statut = '<span style="color:var(--teal)">✓ Dans la cible</span>';
    } else if (diff > 0) {
      statut = '<span style="color:var(--red)">↑ +' + diff.toFixed(1) + '% vs cible</span>';
    } else {
      statut = '<span style="color:var(--gold)">↓ ' + diff.toFixed(1) + '% vs cible</span>';
    }

    // Largeur de la mini-barre de progression
    var largeurBarre = Math.min(100, c.actual / c.pct * 100).toFixed(1);

    htmlCibles +=
      '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r-sm);padding:14px">' +
        '<div style="font-size:0.7rem;color:var(--t2);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">' + c.label + '</div>' +
        '<div style="font-family:var(--font-head);font-size:1.3rem;font-weight:800;color:' + c.color + '">' + c.actual.toFixed(1) + '%</div>' +
        '<div style="font-size:0.68rem;color:var(--t2);margin:2px 0 8px">Cible : ' + c.pct + '%</div>' +
        '<div style="height:5px;background:var(--bg4);border-radius:3px;overflow:hidden;margin-bottom:6px">' +
          '<div style="height:100%;width:' + largeurBarre + '%;background:' + c.color + ';border-radius:3px;transition:width 0.4s"></div>' +
        '</div>' +
        '<div style="font-size:0.68rem">' + statut + '</div>' +
      '</div>';
  }
  container.innerHTML = htmlCibles;

  /* Graphique à barres comparant réel vs cible */
  destroyChart('budget-503020-chart');
  var canvas = document.getElementById('budget-503020-chart');
  if (!canvas) return;

  // Réinitialise le canvas pour éviter les artefacts visuels après destroy
  canvas.width = canvas.width;

  var labelsC       = cibles.map(function(c) { return c.label; });
  var valeursActuel = cibles.map(function(c) { return parseFloat(c.actual.toFixed(1)); });
  var valeursCible  = cibles.map(function(c) { return c.pct; });
  var bgCouleurs    = cibles.map(function(c) { return c.color + '88'; });
  var bordersCoul   = cibles.map(function(c) { return c.color; });

  charts['budget-503020-chart'] = new Chart(
    canvas.getContext('2d'),
    {
      type: 'bar',
      data: {
        labels: labelsC,
        datasets: [
          {
            label:           'Actuel (%)',
            data:            valeursActuel,
            backgroundColor: bgCouleurs,
            borderColor:     bordersCoul,
            borderWidth:     1.5,
            borderRadius:    4
          },
          {
            label:           'Cible (%)',
            data:            valeursCible,
            backgroundColor: 'rgba(255,255,255,0.04)',
            borderColor:     'rgba(255,255,255,0.25)',
            borderWidth:     1.5,
            borderRadius:    4
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { labels: { color: '#a8b0d0', font: { family: 'DM Mono, monospace', size: 11 }, boxWidth: 10, padding: 12, usePointStyle: true } },
          tooltip: {
            backgroundColor: '#0b0d17', borderColor: 'rgba(91,111,255,0.4)', borderWidth: 1,
            titleColor: '#8a9bff', bodyColor: '#a8b0d0', padding: 12, cornerRadius: 8,
            bodyFont: { family: 'DM Mono, monospace', size: 12 },
            callbacks: { label: function(c) { return '  ' + c.dataset.label + ' : ' + c.raw.toFixed(1) + '%'; } }
          }
        },
        scales: {
          x: { ticks: { color: '#5e6685', font: { family: 'DM Mono, monospace', size: 10 } }, grid: { color: 'rgba(91,111,255,0.05)' } },
          y: { ticks: { color: '#5e6685', font: { family: 'DM Mono, monospace', size: 10 }, callback: function(v) { return v + '%'; } }, grid: { color: 'rgba(91,111,255,0.05)' }, max: 80 }
        }
      }
    }
  );
}

/*
  renderBudgetProjection(epargne) — simule la croissance du reste à vivre
  investi chaque mois à différents taux sur 10 ans.
*/
function renderBudgetProjection(epargne) {
  var canvas = document.getElementById('budget-projection-chart');
  if (!canvas) return;

  if (epargne <= 0) {
    destroyChart('budget-proj');
    return;
  }

  var nbAnnees = 10;
  var taux     = [0, 3, 6, 9];
  var couleurs = ['#5e6685', '#4aa3e8', '#5b6fff', '#00c9a7'];

  var labels = [];
  for (var i = 0; i <= nbAnnees; i++) labels.push('An ' + i);

  var datasets = [];

  for (var t = 0; t < taux.length; t++) {
    var tauxAnnuel = taux[t];
    var couleur    = couleurs[t];
    var donnees    = [];
    var cap        = 0;

    for (var annee = 0; annee <= nbAnnees; annee++) {
      if (annee > 0) {
        var tauxMensuel = tauxAnnuel / 100 / 12;
        for (var mois = 0; mois < 12; mois++) {
          cap = cap * (1 + tauxMensuel) + epargne;
        }
      }
      donnees.push(cap);
    }

    datasets.push({
      label:            'Taux ' + tauxAnnuel + '%',
      data:             donnees,
      borderColor:      couleur,
      backgroundColor:  couleur + '15',
      borderWidth:      tauxAnnuel === 0 ? 1.5 : 2,
      fill:             false,
      tension:          0.4,
      pointRadius:      0,
      pointHoverRadius: 4,
      borderDash:       tauxAnnuel === 0 ? [4, 4] : [] // Ligne pointillée pour le taux 0
    });
  }

  destroyChart('budget-proj');
  charts['budget-proj'] = new Chart(
    canvas.getContext('2d'),
    { type: 'line', data: { labels: labels, datasets: datasets }, options: chartDefaults() }
  );
}

/* initBudget() — réinitialise la page budget */
function initBudget() {
  budgetItems = { revenus: [], depenses: [] };
  renderBudget();
}


/* ══════════════════════════════════════════
   PAGE COMPARAISON (Scénario A vs B)
   Compare deux stratégies d'investissement.
══════════════════════════════════════════ */

/*
  calcScenario(...) — calcule tous les indicateurs d'un scénario d'investissement.
  Retourne un objet avec : données, capital final, versements, gains, capital net, rente.
*/
function calcScenario(capital, monthly, rate, years, inflation, frais, tmiPct, revalor, envelopeId) {
  var rateNet = Math.max(0, rate - frais);
  var tmi     = tmiPct / 100;

  // Construction de la courbe d'évolution année par année
  var capitalCourant   = capital;
  var versementActuel  = monthly;
  var donnees          = [{ year: 0, value: capital }];

  for (var annee = 1; annee <= years; annee++) {
    var tauxMensuel = rateNet / 100 / 12;
    for (var mois = 0; mois < 12; mois++) {
      capitalCourant = capitalCourant * (1 + tauxMensuel) + versementActuel;
    }
    versementActuel = versementActuel * (1 + revalor / 100);
    donnees.push({ year: annee, value: capitalCourant });
  }

  var capitalFinal = capitalCourant;

  // Calcul du total versé (avec revalorisation)
  var totalVerse   = capital;
  var mv           = monthly;
  for (var y = 0; y < years; y++) {
    totalVerse += mv * 12;
    mv *= (1 + revalor / 100);
  }

  var gainsBruts  = Math.max(0, capitalFinal - totalVerse);
  var capitalNet  = applyEnvelopeFiscality(capitalFinal, totalVerse, envelopeId || 'cto', tmi, years);
  var gainsNets   = Math.max(0, capitalNet - totalVerse);
  var capitalReel = capitalFinal / Math.pow(1 + inflation / 100, years);
  var rente       = capitalFinal * 0.04 / 12; // Règle des 4%

  return {
    data: donnees, final: capitalFinal, totalVerse: totalVerse,
    gainsBruts: gainsBruts, gainsNets: gainsNets,
    capitalNet: capitalNet, capitalReel: capitalReel, rente: rente
  };
}

/*
  updateCompare() — calcule les deux scénarios et met à jour l'affichage.
*/
function updateCompare() {
  /* Fonctions raccourcies pour lire les valeurs des champs A et B */
  function g(id)  { return parseFloat(document.getElementById(id) ? document.getElementById(id).value : 0) || 0; }
  function gi(id) { return parseInt(document.getElementById(id)   ? document.getElementById(id).value : 0) || 0; }

  var enveloppeA = document.getElementById('ca-env') ? document.getElementById('ca-env').value : 'pea';
  var enveloppeB = document.getElementById('cb-env') ? document.getElementById('cb-env').value : 'pea';

  // Calcul des deux scénarios
  var A = calcScenario(g('ca-capital'), g('ca-monthly'), g('ca-rate'), gi('ca-years'), g('ca-inflation'), g('ca-frais'), g('ca-tmi'), g('ca-revalor'), enveloppeA);
  var B = calcScenario(g('cb-capital'), g('cb-monthly'), g('cb-rate'), gi('cb-years'), g('cb-inflation'), g('cb-frais'), g('cb-tmi'), g('cb-revalor'), enveloppeB);

  /* Mise à jour des résultats pour chaque scénario */
  function setT(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  // Scénario A
  setT('ca-result', fmtN(A.final));
  setT('ca-net',    fmtN(A.capitalNet));
  setT('ca-reel',   fmtN(A.capitalReel));
  setT('ca-rente',  fmtN(A.rente) + '/m');
  setT('ca-versed', fmtN(A.totalVerse));
  setT('ca-gains',  fmtN(A.gainsNets));
  setT('ca-multi',  A.totalVerse > 0 ? (A.final / A.totalVerse).toFixed(2) + '×' : '—');

  // Scénario B
  setT('cb-result', fmtN(B.final));
  setT('cb-net',    fmtN(B.capitalNet));
  setT('cb-reel',   fmtN(B.capitalReel));
  setT('cb-rente',  fmtN(B.rente) + '/m');
  setT('cb-versed', fmtN(B.totalVerse));
  setT('cb-gains',  fmtN(B.gainsNets));
  setT('cb-multi',  B.totalVerse > 0 ? (B.final / B.totalVerse).toFixed(2) + '×' : '—');

  var dureeMax = Math.max(gi('ca-years'), gi('cb-years'));
  if (dureeMax <= 0) return;

  var labA   = sv('ca-name') || 'Scénario A';
  var labB   = sv('cb-name') || 'Scénario B';
  var labels = [];
  for (var i = 0; i <= dureeMax; i++) labels.push('An ' + i);

  /* Graphique 1 : Évolution des capitaux nominaux */
  destroyChart('compare');
  charts.compare = new Chart(
    document.getElementById('compare-chart').getContext('2d'),
    {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label:            labA,
            data:             A.data.slice(0, dureeMax + 1).map(function(d) { return d.value; }),
            borderColor:      '#4aa3e8',
            backgroundColor:  'rgba(74,163,232,0.06)',
            fill:             true, tension: 0.4, borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 5
          },
          {
            label:            labB,
            data:             B.data.slice(0, dureeMax + 1).map(function(d) { return d.value; }),
            borderColor:      '#b06cf8',
            backgroundColor:  'rgba(176,108,248,0.06)',
            fill:             true, tension: 0.4, borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 5
          }
        ]
      },
      options: chartDefaults()
    }
  );

  /* Graphique 2 : Capitaux réels (corrigés de l'inflation) */
  destroyChart('compare-reel');
  charts['compare-reel'] = new Chart(
    document.getElementById('compare-reel-chart').getContext('2d'),
    {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label:            labA + ' réel',
            data:             A.data.slice(0, dureeMax + 1).map(function(d, i) {
                                return d.value / Math.pow(1 + g('ca-inflation') / 100, i);
                              }),
            borderColor: '#4aa3e8', borderDash: [4,3], fill: true, tension: 0.4, borderWidth: 2,
            backgroundColor: 'rgba(74,163,232,0.04)', pointRadius: 0, pointHoverRadius: 5
          },
          {
            label:            labB + ' réel',
            data:             B.data.slice(0, dureeMax + 1).map(function(d, i) {
                                return d.value / Math.pow(1 + g('cb-inflation') / 100, i);
                              }),
            borderColor: '#b06cf8', borderDash: [4,3], fill: true, tension: 0.4, borderWidth: 2,
            backgroundColor: 'rgba(176,108,248,0.04)', pointRadius: 0, pointHoverRadius: 5
          }
        ]
      },
      options: chartDefaults()
    }
  );

  /* Graphique 3 : Composition finale (barres empilées versements + gains nets) */
  destroyChart('compare-compo');
  var optsCompo = chartDefaults();
  charts['compare-compo'] = new Chart(
    document.getElementById('compare-compo-chart').getContext('2d'),
    {
      type: 'bar',
      data: {
        labels: [labA, labB],
        datasets: [
          {
            label: 'Versements',
            data:  [A.totalVerse, B.totalVerse],
            backgroundColor: 'rgba(74,163,232,0.55)', borderColor: '#4aa3e8', borderWidth: 1.5, borderRadius: 4
          },
          {
            label: 'Gains nets',
            data:  [A.gainsNets, B.gainsNets],
            backgroundColor: 'rgba(91,111,255,0.55)', borderColor: '#5b6fff', borderWidth: 1.5, borderRadius: 4
          }
        ]
      },
      options: Object.assign({}, optsCompo, { scales: { x: Object.assign({}, optsCompo.scales.x, { stacked: true }), y: Object.assign({}, optsCompo.scales.y, { stacked: true }) } })
    }
  );

  /* Graphique 4 : Rentes mensuelles projetées */
  destroyChart('compare-rente');
  var optsRente = Object.assign({}, chartDefaults());
  optsRente.plugins = Object.assign({}, chartDefaults().plugins, { legend: { display: false } });

  charts['compare-rente'] = new Chart(
    document.getElementById('compare-rente-chart').getContext('2d'),
    {
      type: 'bar',
      data: {
        labels: [labA, labB],
        datasets: [{
          data:            [A.rente, B.rente],
          backgroundColor: ['rgba(74,163,232,0.5)', 'rgba(176,108,248,0.5)'],
          borderColor:     ['#4aa3e8', '#b06cf8'],
          borderWidth:     2,
          borderRadius:    8
        }]
      },
      options: optsRente
    }
  );

  /* Analyse différentielle : pour chaque indicateur, affiche l'écart et le vainqueur */
  function determinateVainqueur(valA, valB) {
    if (valA === valB) return '—';
    var vainqueur = valA > valB ? labA : labB;
    var couleur   = valA > valB ? '#4aa3e8' : '#b06cf8';
    return '<span style="color:' + couleur + '">▲ ' + vainqueur + '</span>';
  }

  var comparaisons = [
    { label: 'Capital brut',    a: A.final,       b: B.final       },
    { label: 'Capital net',     a: A.capitalNet,  b: B.capitalNet  },
    { label: 'Capital réel',    a: A.capitalReel, b: B.capitalReel },
    { label: 'Gains nets',      a: A.gainsNets,   b: B.gainsNets   },
    { label: 'Rente/m (4%)',    a: A.rente,       b: B.rente       },
    {
      label:   'Multiplicateur',
      a:       A.totalVerse > 0 ? A.final / A.totalVerse : 0,
      b:       B.totalVerse > 0 ? B.final / B.totalVerse : 0,
      isMult:  true // Indicateur pour formater différemment (× au lieu de €)
    }
  ];

  var htmlDelta = '';
  for (var c = 0; c < comparaisons.length; c++) {
    var comp      = comparaisons[c];
    var couleurA  = comp.a >= comp.b ? '#4aa3e8' : '#b06cf8';
    var ecart     = comp.isMult
      ? (comp.a - comp.b).toFixed(2) + '×'
      : fmtN(Math.abs(comp.a - comp.b));

    htmlDelta +=
      '<div class="delta-item">' +
        '<div class="delta-label">' + comp.label + '</div>' +
        '<div class="delta-val" style="color:' + couleurA + '">' + ecart + '</div>' +
        '<div class="delta-winner">Avantage ' + determinateVainqueur(comp.a, comp.b) + '</div>' +
      '</div>';
  }
  document.getElementById('compare-delta').innerHTML = htmlDelta;
}


/* ══════════════════════════════════════════
   PAGE ALLOCATION DE PORTEFEUILLE
   Analyse et simulation d'un portefeuille d'actifs.
══════════════════════════════════════════ */

/*
  ASSET_DATA — caractéristiques historiques estimées de chaque classe d'actif.
  Ces données sont utilisées pour calculer le rendement et la volatilité du portefeuille.
*/
const ASSET_DATA = {
  actions: { label: 'Actions',     rendement: 9.5,  volatilite: 18,   color: '#5b6fff', icon: '◆' },
  oblig:   { label: 'Obligations', rendement: 3.5,  volatilite: 6,    color: '#4aa3e8', icon: '◈' },
  immo:    { label: 'Immobilier',  rendement: 6.0,  volatilite: 10,   color: '#d4af37', icon: '▣' },
  crypto:  { label: 'Crypto',      rendement: 25,   volatilite: 75,   color: '#f24463', icon: '◎' },
  cash:    { label: 'Liquidités',  rendement: 2.5,  volatilite: 0.5,  color: '#00c9a7', icon: '○' }
};

/*
  getWeights() — lit les pourcentages d'allocation de chaque curseur.
  Retourne { weights: { actions: X, oblig: Y, … }, total: somme }
*/
function getWeights() {
  var poids = {
    actions: fv('alloc-actions'),
    oblig:   fv('alloc-oblig'),
    immo:    fv('alloc-immo'),
    crypto:  fv('alloc-crypto'),
    cash:    fv('alloc-cash')
  };

  var total = 0;
  var cles  = Object.keys(poids);
  for (var i = 0; i < cles.length; i++) {
    total += poids[cles[i]];
  }

  return { weights: poids, total: total };
}

/*
  applyProfile(name) — applique un profil prédéfini (prudent, équilibré, etc.)
  en réglant les curseurs aux valeurs correspondantes.
*/
function applyProfile(name) {
  var profils = {
    prudent:   { actions: 20, oblig: 50, immo: 15, crypto:  0, cash: 15 },
    equilibre: { actions: 40, oblig: 20, immo: 20, crypto:  5, cash: 15 },
    dynamique: { actions: 65, oblig: 10, immo: 15, crypto: 10, cash:  0 },
    agressif:  { actions: 75, oblig:  0, immo: 10, crypto: 15, cash:  0 }
  };

  var profil = profils[name];
  if (!profil) return;

  // On applique chaque valeur du profil au curseur correspondant
  var cles = Object.keys(profil);
  for (var i = 0; i < cles.length; i++) {
    var cle     = cles[i];
    var element = document.getElementById('alloc-' + cle);
    if (element) element.value = profil[cle];
  }

  updateAllocation();
}

/*
  calcPortfolioStats(weights) — calcule les statistiques du portefeuille :
  rendement pondéré, volatilité, ratio de Sharpe, drawdown max estimé.
  
  Formules :
  - Rendement pondéré = Σ (rendement_actif × poids / total)
  - Volatilité ≈ √ Σ (volatilité_actif × poids / total)²  (simplifiée, sans corrélations)
  - Sharpe = (rendement - taux sans risque) / volatilité
  - Drawdown max ≈ volatilité × 2.5 (approximation empirique)
*/
function calcPortfolioStats(weights) {
  var total = 0;
  var cles  = Object.keys(weights);
  for (var i = 0; i < cles.length; i++) total += weights[cles[i]];

  if (total === 0) return { rendement: 0, volatilite: 0, sharpe: 0, maxDD: 0 };

  // Calcul du rendement annuel moyen pondéré
  var rendement = 0;
  for (var i = 0; i < cles.length; i++) {
    var cle = cles[i];
    rendement += ASSET_DATA[cle].rendement * weights[cle] / total;
  }

  // Calcul de la variance (somme des volatilités² pondérées) puis on prend la racine
  var variance = 0;
  for (var j = 0; j < cles.length; j++) {
    var cle2    = cles[j];
    var volPonderee = ASSET_DATA[cle2].volatilite * weights[cle2] / total;
    variance += volPonderee * volPonderee;
  }
  var volatilite = Math.sqrt(variance);

  var tauxSansRisque = fv('alloc-rfree') || 3;
  var sharpe  = volatilite > 0 ? (rendement - tauxSansRisque) / volatilite : 0;
  var maxDD   = volatilite * 2.5; // Approximation du drawdown max

  return { rendement: rendement, volatilite: volatilite, sharpe: sharpe, maxDD: maxDD };
}

/*
  updateAllocation() — fonction principale de la page Allocation.
  Met à jour tous les KPIs, graphiques et tableau.
*/
function updateAllocation() {
  var resultat = getWeights();
  var weights  = resultat.weights;
  var total    = resultat.total;

  // Mise à jour des labels des curseurs
  var cles = Object.keys(weights);
  for (var i = 0; i < cles.length; i++) {
    var cle = cles[i];
    var el  = document.getElementById('v-alloc-' + cle);
    if (el) el.textContent = weights[cle] + ' %';
  }

  // Indicateur de total (doit être 100%)
  var elTotal = document.getElementById('alloc-total');
  var elCheck = document.getElementById('alloc-total-check');
  if (elTotal) elTotal.textContent = total + ' %';
  if (elCheck) {
    var couleurTotal = total === 100 ? 'var(--teal)' : 'var(--red)';
    elCheck.style.borderLeft = '3px solid ' + couleurTotal;
    if (elTotal) elTotal.style.color = couleurTotal;
  }

  var stats = calcPortfolioStats(weights);

  function setText(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; }
  setText('alloc-rendement', stats.rendement.toFixed(1) + ' %/an');
  setText('alloc-risque',    stats.volatilite.toFixed(1) + ' %');
  setText('alloc-sharpe',    stats.sharpe.toFixed(2));
  setText('alloc-max-dd',    '-' + stats.maxDD.toFixed(0) + ' %');

  /* Graphique donut — répartition du portefeuille */
  var actifsActifs = []; // Uniquement les actifs avec un poids > 0
  for (var k = 0; k < cles.length; k++) {
    if (weights[cles[k]] > 0) {
      actifsActifs.push(cles[k]);
    }
  }

  destroyChart('alloc-pie');
  if (actifsActifs.length > 0) {
    charts['alloc-pie'] = new Chart(
      document.getElementById('alloc-pie-chart').getContext('2d'),
      {
        type: 'doughnut',
        data: {
          labels:   actifsActifs.map(function(k) { return ASSET_DATA[k].label; }),
          datasets: [{
            data:            actifsActifs.map(function(k) { return weights[k]; }),
            backgroundColor: actifsActifs.map(function(k) { return ASSET_DATA[k].color + 'cc'; }),
            borderColor:     actifsActifs.map(function(k) { return ASSET_DATA[k].color; }),
            borderWidth:     1.5
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: '55%',
          plugins: {
            legend:  { labels: { color: '#a8b0d0', font: { family: 'DM Mono', size: 10 }, boxWidth: 8, padding: 8, usePointStyle: true } },
            tooltip: {
              backgroundColor: '#0b0d17', borderColor: 'rgba(91,111,255,0.4)', borderWidth: 1,
              titleColor: '#8a9bff', bodyColor: '#a8b0d0', padding: 12, cornerRadius: 8,
              bodyFont: { family: 'DM Mono, monospace', size: 12 },
              callbacks: { label: function(c) { return '  ' + c.label + ' : ' + c.raw + '%'; } }
            }
          }
        }
      }
    );
  }

  // Projection selon scénarios
  renderAllocProjection(stats.rendement, stats.volatilite);

  // Graphique scatter risque/rendement
  renderAllocScatter(weights, total);

  // Tableau détaillé par classe d'actif
  renderAllocDetailTable(weights, total, stats);
}

/*
  renderAllocProjection(rendement, volatilite) — affiche 3 scénarios de projection
  (pessimiste, base, optimiste) selon le rendement et la volatilité du portefeuille.
*/
function renderAllocProjection(rendement, volatilite) {
  var capital  = fv('alloc-capital') || 10000;
  var monthly  = fv('alloc-monthly') || 300;
  var years    = iv('alloc-years')   || 20;

  var labels = [];
  for (var i = 0; i <= years; i++) labels.push('An ' + i);

  /* 3 scénarios basés sur la volatilité du portefeuille */
  var scenarios = [
    { label: 'Pessimiste', taux: Math.max(0.5, rendement - volatilite * 0.5), color: '#f24463', dash: [4, 4] },
    { label: 'Base',       taux: rendement,                                    color: '#5b6fff', dash: []     },
    { label: 'Optimiste',  taux: rendement + volatilite * 0.3,                color: '#00c9a7', dash: [2, 2] }
  ];

  var datasets = [];

  for (var s = 0; s < scenarios.length; s++) {
    var sc      = scenarios[s];
    var donnees = [];
    var cur     = capital;

    for (var annee = 0; annee <= years; annee++) {
      if (annee > 0) {
        var tauxMensuel = sc.taux / 100 / 12;
        for (var mois = 0; mois < 12; mois++) {
          cur = cur * (1 + tauxMensuel) + monthly;
        }
      }
      donnees.push(cur);
    }

    datasets.push({
      label:            sc.label + ' (' + sc.taux.toFixed(1) + '%)',
      data:             donnees,
      borderColor:      sc.color,
      backgroundColor:  sc.color + '10',
      borderWidth:      2,
      fill:             sc.label === 'Base', // Remplissage uniquement pour le scénario base
      tension:          0.4,
      pointRadius:      0,
      pointHoverRadius: 5,
      borderDash:       sc.dash
    });
  }

  // Ligne des versements cumulés (pour comparaison)
  var versData = [capital];
  var v        = capital;
  for (var annee2 = 1; annee2 <= years; annee2++) {
    v += monthly * 12;
    versData.push(v);
  }
  datasets.push({
    label:            'Versements',
    data:             versData,
    borderColor:      '#5e6685',
    borderDash:       [5, 5],
    borderWidth:      1.2,
    fill:             false,
    tension:          0,
    pointRadius:      0,
    pointHoverRadius: 3
  });

  destroyChart('alloc-proj');
  charts['alloc-proj'] = new Chart(
    document.getElementById('alloc-proj-chart').getContext('2d'),
    { type: 'line', data: { labels: labels, datasets: datasets }, options: chartDefaults() }
  );
}

/*
  renderAllocScatter(weights, total) — graphique "bubble" (nuage de points)
  affichant chaque classe d'actif selon sa volatilité (axe X) et son rendement (axe Y).
  La taille de la bulle représente le poids dans le portefeuille.
*/
function renderAllocScatter(weights, total) {
  var cles     = Object.keys(ASSET_DATA);
  var datasets = [];

  // Un dataset par classe d'actif
  for (var i = 0; i < cles.length; i++) {
    var cle      = cles[i];
    var d        = ASSET_DATA[cle];
    var poids    = weights[cle] || 0;
    var estActif = poids > 0;
    var rayon    = estActif ? Math.max(6, poids / 4) : 5; // Taille proportionnelle au poids

    datasets.push({
      label:           d.label + (poids > 0 ? ' (' + poids + '%)' : ''),
      data:            [{ x: parseFloat(d.volatilite.toFixed(1)), y: parseFloat(d.rendement.toFixed(1)), r: rayon }],
      backgroundColor: estActif ? d.color + '88' : d.color + '33',
      borderColor:     d.color,
      borderWidth:     estActif ? 2 : 1
    });
  }

  // Point représentant le portefeuille global
  var stats = calcPortfolioStats(weights);
  datasets.push({
    label:           'Mon portefeuille',
    data:            [{ x: parseFloat(stats.volatilite.toFixed(1)), y: parseFloat(stats.rendement.toFixed(1)), r: 12 }],
    backgroundColor: '#d4af37' + '88',
    borderColor:     '#d4af37',
    borderWidth:     2.5
  });

  destroyChart('alloc-scatter');
  charts['alloc-scatter'] = new Chart(
    document.getElementById('alloc-scatter-chart').getContext('2d'),
    {
      type: 'bubble',
      data: { datasets: datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#a8b0d0', font: { family: 'DM Mono', size: 10 }, boxWidth: 8, usePointStyle: true, padding: 10 } },
          tooltip: {
            backgroundColor: '#0b0d17', borderColor: 'rgba(91,111,255,0.4)', borderWidth: 1,
            titleColor: '#8a9bff', bodyColor: '#a8b0d0', padding: 12, cornerRadius: 8,
            bodyFont: { family: 'DM Mono, monospace', size: 12 },
            callbacks: {
              label: function(c) { return '  ' + c.dataset.label + ' — Vol: ' + c.raw.x + '% | Rend: ' + c.raw.y + '%'; }
            }
          }
        },
        scales: {
          x: {
            title: { display: true, text: 'Volatilité (%)', color: '#5e6685', font: { family: 'DM Mono, monospace', size: 10 } },
            ticks: { color: '#5e6685', font: { family: 'DM Mono, monospace', size: 10 }, callback: function(v) { return v + '%'; } },
            grid:  { color: 'rgba(91,111,255,0.05)' }
          },
          y: {
            title: { display: true, text: 'Rendement annuel (%)', color: '#5e6685', font: { family: 'DM Mono, monospace', size: 10 } },
            ticks: { color: '#5e6685', font: { family: 'DM Mono, monospace', size: 10 }, callback: function(v) { return v + '%'; } },
            grid:  { color: 'rgba(91,111,255,0.05)' }
          }
        }
      }
    }
  );
}

/*
  renderAllocDetailTable(weights, total, stats) — génère le tableau HTML
  détaillant la contribution de chaque classe d'actif au rendement et au risque.
*/
function renderAllocDetailTable(weights, total, stats) {
  var container = document.getElementById('alloc-detail-table');
  if (!container) return;

  var cles       = Object.keys(ASSET_DATA);
  var lignesHTML = '';

  for (var i = 0; i < cles.length; i++) {
    var cle  = cles[i];
    var d    = ASSET_DATA[cle];
    var w    = weights[cle] || 0;

    // Contribution au rendement et au risque (poids × valeur de la classe / total)
    var contribR = total > 0 ? (d.rendement  * w / total).toFixed(2) : '0.00';
    var contribV = total > 0 ? (d.volatilite * w / total).toFixed(2) : '0.00';

    var opacite = w > 0 ? '' : 'opacity:0.4'; // On grise les classes non investies

    lignesHTML +=
      '<tr style="' + opacite + '">' +
        '<td><span style="color:' + d.color + '">' + d.icon + '</span> ' + d.label + '</td>' +
        '<td style="text-align:center;font-family:var(--font-mono);color:' + (w > 0 ? 'var(--t1)' : 'var(--t2)') + ';font-weight:' + (w > 0 ? 700 : 400) + '">' + w + '%</td>' +
        '<td style="text-align:center;font-family:var(--font-mono);color:var(--teal)">'   + d.rendement  + '%</td>' +
        '<td style="text-align:center;font-family:var(--font-mono);color:var(--red)">'    + d.volatilite + '%</td>' +
        '<td style="text-align:center;font-family:var(--font-mono);color:var(--acc-l)">'  + contribR     + '%</td>' +
        '<td style="text-align:center;font-family:var(--font-mono);color:var(--gold)">'   + contribV     + '%</td>' +
      '</tr>';
  }

  var couleurTotal = total === 100 ? 'var(--teal)' : 'var(--red)';

  container.innerHTML =
    '<table class="amort-table">' +
      '<thead>' +
        '<tr>' +
          "<th>Classe d'actif</th>" +
          '<th style="text-align:center">Poids</th>' +
          '<th style="text-align:center;color:var(--teal)">Rend. historique</th>' +
          '<th style="text-align:center;color:var(--red)">Volatilité</th>' +
          '<th style="text-align:center;color:var(--acc-l)">Contrib. rendement</th>' +
          '<th style="text-align:center;color:var(--gold)">Contrib. risque</th>' +
        '</tr>' +
      '</thead>' +
      '<tbody>' + lignesHTML + '</tbody>' +
      '<tfoot>' +
        '<tr style="border-top:1px solid var(--border-h)">' +
          '<td style="font-weight:700;color:var(--t1)">Portefeuille total</td>' +
          '<td style="text-align:center;font-family:var(--font-mono);font-weight:700;color:' + couleurTotal + '">' + total + '%</td>' +
          '<td style="text-align:center;font-family:var(--font-mono);font-weight:700;color:var(--teal)">'   + stats.rendement.toFixed(1)  + '%</td>' +
          '<td style="text-align:center;font-family:var(--font-mono);font-weight:700;color:var(--red)">'    + stats.volatilite.toFixed(1) + '%</td>' +
          '<td style="text-align:center;font-family:var(--font-mono);font-weight:700;color:var(--acc-l)">—</td>' +
          '<td style="text-align:center;font-family:var(--font-mono);font-weight:700;color:var(--gold)">Sharpe: ' + stats.sharpe.toFixed(2) + '</td>' +
        '</tr>' +
      '</tfoot>' +
    '</table>';
}


/* ══ ACCUEIL — RAFRAÎCHISSEMENT ══ */
function refreshHome() {
  /* Les KPIs de la page d'accueil se mettent à jour via les simulateurs.
     Cette fonction est intentionnellement vide : les valeurs
     sont poussées depuis updateInvest(), updateRetraite(), updateBudgetSummary(). */
}


/* ══ INITIALISATION ══
   Appelée au chargement de la page.
*/
function init() {
  // On vide le localStorage pour repartir à zéro
  try { localStorage.clear(); } catch(e) {}

  initBudget();

  // Affiche les infos de l'enveloppe par défaut (PEA) dans le simulateur d'investissement
  updateEnvelopeInfo('pea', 'envelope-info-box');
}

init(); // Appel immédiat au chargement du script


/* ══════════════════════════════════════════
   ACADÉMIE — DONNÉES & LOGIQUE
   Liste des termes financiers avec définitions,
   exemples et formules.
══════════════════════════════════════════ */

/*
  ACAD_TERMS — tableau de tous les termes financiers affichés dans l'académie.
  Chaque terme a :
  - id          : identifiant unique (pour le ciblage HTML)
  - titre       : nom du terme
  - categorie   : 'base', 'rendement', 'risque', 'fiscalite', 'strategie', 'micro', 'macro'
  - icon        : symbole décoratif
  - def         : définition claire
  - exemple     : exemple concret et chiffré
  - formule     : formule mathématique clé (null si aucune)
  - couleurEx   : couleur de l'encart exemple ('teal', 'gold', 'red', 'purple', ou null)
*/
const ACAD_TERMS = [
  // ── BASES ──
  {
    id: 'capital', titre: 'Capital', categorie: 'base', icon: '◆',
    def: "Somme d'argent que vous investissez ou possédez. C'est la base de toute stratégie d'investissement.",
    exemple: "Vous avez 5 000 € d'économies sur votre livret A. Ces 5 000 € constituent votre capital de départ.",
    formule: 'Capital final = Capital initial × (1 + r)^n', couleurEx: 'teal'
  },
  {
    id: 'ic', titre: 'Intérêts composés', categorie: 'base', icon: '◈',
    def: "Les intérêts que vous gagnez génèrent eux-mêmes des intérêts. C'est l'effet \"boule de neige\" : plus le temps passe, plus la croissance s'accélère.",
    exemple: "1 000 € à 7%/an pendant 10 ans donnent 1 967 € (et non 1 700 €). Les 967 € de gains incluent des intérêts sur les intérêts.",
    formule: 'Capital = Capital × (1 + r/12)^(12×n) + mensualité × [(1+r/12)^(12×n) - 1]/(r/12)', couleurEx: 'teal'
  },
  {
    id: 'dividende', titre: 'Dividende', categorie: 'base', icon: '○',
    def: "Part des bénéfices d'une entreprise versée à ses actionnaires. C'est un revenu passif régulier issu de vos actions.",
    exemple: "Vous détenez 100 actions Total à 50 €. Total verse 3 €/action de dividende annuel → vous recevez 300 € sans rien vendre.",
    formule: "Rendement dividende = Dividende annuel / Prix de l'action × 100", couleurEx: 'gold'
  },
  {
    id: 'action', titre: 'Action', categorie: 'base', icon: '▲',
    def: "Part de propriété dans une entreprise. En achetant une action, vous devenez actionnaire (propriétaire d'une fraction de la société).",
    exemple: "Apple a environ 15 milliards d'actions en circulation. Si vous en achetez 1 à 180 $, vous possédez 0,0000000067% d'Apple.",
    formule: null, couleurEx: null
  },
  {
    id: 'obligation', titre: 'Obligation', categorie: 'base', icon: '◇',
    def: "Titre de créance : vous prêtez de l'argent à une entreprise ou un État, qui vous rembourse avec des intérêts (le \"coupon\"). Moins risqué que l'action mais rendement plus faible.",
    exemple: "OAT France à 10 ans : l'État vous emprunte 1 000 €, vous verse 3%/an (30 €/an) et vous rembourse 1 000 € au bout de 10 ans.",
    formule: 'Prix obligation ≈ Coupon / Taux marché (relation inverse)', couleurEx: 'teal'
  },
  {
    id: 'etf', titre: 'ETF (Tracker)', categorie: 'base', icon: '◉',
    def: "Fonds indiciel coté en bourse qui réplique un indice (CAC 40, S&P 500…). Permet de diversifier en achetant un seul produit à faible coût.",
    exemple: "En achetant 1 part du Lyxor CAC 40 pour ~75 €, vous investissez indirectement dans les 40 plus grandes entreprises françaises simultanément.",
    formule: null, couleurEx: 'teal'
  },

  // ── RENDEMENT ──
  {
    id: 'taux-rendement', titre: 'Taux de rendement', categorie: 'rendement', icon: '◈',
    def: "Gain ou perte d'un investissement exprimé en pourcentage du capital investi sur une période donnée.",
    exemple: "Vous investissez 1 000 €, qui deviennent 1 080 € en un an. Votre taux de rendement est de +8%.",
    formule: 'Rendement = (Valeur finale - Valeur initiale) / Valeur initiale × 100', couleurEx: 'teal'
  },
  {
    id: 'plus-value', titre: 'Plus-value', categorie: 'rendement', icon: '◆',
    def: "Gain réalisé lors de la vente d'un actif à un prix supérieur à son prix d'achat. C'est la différence entre le prix de cession et le prix de revient.",
    exemple: "Vous achetez une action LVMH à 700 € et la revendez à 850 €. Votre plus-value est de 150 € (21,4%). Elle est soumise à l'impôt.",
    formule: "Plus-value = Prix de vente - Prix d'achat (- frais)", couleurEx: 'gold'
  },
  {
    id: 'cagr', titre: 'CAGR (Taux annualisé)', categorie: 'rendement', icon: '◇',
    def: "Taux de croissance annuel composé : le taux constant qui explique l'évolution d'un placement sur plusieurs années. Permet de comparer des placements sur des durées différentes.",
    exemple: "Votre portefeuille passe de 10 000 € à 19 487 € en 7 ans. Le CAGR est de 10%/an — même si certaines années étaient à +30% et d'autres à -15%.",
    formule: 'CAGR = (Valeur finale / Valeur initiale)^(1/n) - 1', couleurEx: 'teal'
  },
  {
    id: 'rendement-reel', titre: 'Rendement réel', categorie: 'rendement', icon: '○',
    def: "Rendement nominal corrigé de l'inflation. Ce qui compte vraiment : ce que vous pouvez acheter avec votre argent, pas juste les chiffres.",
    exemple: "Votre livret rapporte 3%/an mais l'inflation est à 4%. Votre rendement réel est de -1% : vous perdez du pouvoir d'achat malgré les intérêts.",
    formule: "Rendement réel ≈ Rendement nominal - Inflation (approximation de Fisher)", couleurEx: 'red'
  },
  {
    id: 'regle72', titre: 'Règle des 72', categorie: 'rendement', icon: '▣',
    def: "Astuce de calcul mental pour estimer le temps de doublement de votre capital : divisez 72 par le taux de rendement annuel.",
    exemple: "À 6%/an → 72 / 6 = 12 ans pour doubler votre argent. À 9%/an → 72 / 9 = 8 ans. À 12%/an → 72 / 12 = 6 ans.",
    formule: 'Durée doublement (ans) ≈ 72 / Taux annuel (%)', couleurEx: 'gold'
  },
  {
    id: 'rente', titre: 'Rente (règle des 4%)', categorie: 'rendement', icon: '◈',
    def: "Revenu régulier tiré de votre capital. La règle des 4% stipule que vous pouvez retirer 4% de votre capital chaque année sans l'épuiser sur 30 ans.",
    exemple: "Avec un capital de 500 000 €, la règle des 4% vous permet de retirer 20 000 €/an (1 667 €/mois) indéfiniment — selon l'étude Trinity.",
    formule: 'Rente annuelle = Capital × 4% | Capital nécessaire = Dépenses × 25', couleurEx: 'teal'
  },

  // ── RISQUE ──
  {
    id: 'volatilite', titre: 'Volatilité', categorie: 'risque', icon: '▲',
    def: "Mesure des variations du prix d'un actif. Une forte volatilité signifie des hausses et baisses importantes. C'est le principal indicateur de risque d'un placement.",
    exemple: "Le Bitcoin a une volatilité de ~70% : il peut perdre ou gagner 70% en un an. Le fonds euros d'une AV a ~0% de volatilité.",
    formule: 'Volatilité = Écart-type des rendements annuels', couleurEx: 'red'
  },
  {
    id: 'drawdown', titre: 'Drawdown (chute max)', categorie: 'risque', icon: '◌',
    def: "Baisse maximale d'un portefeuille depuis son sommet jusqu'à son point le plus bas. Mesure le pire scénario historique que vous auriez subi.",
    exemple: "Le S&P 500 a subi un drawdown de -57% en 2008-2009. Un portefeuille de 100 000 € serait descendu à 43 000 €. Il a fallu 5 ans pour récupérer.",
    formule: 'Drawdown = (Pic - Creux) / Pic × 100', couleurEx: 'red'
  },
  {
    id: 'diversification', titre: 'Diversification', categorie: 'risque', icon: '⊞',
    def: "Répartir ses investissements sur plusieurs actifs, secteurs ou zones géographiques pour réduire le risque global sans sacrifier le rendement.",
    exemple: "Si vous avez tout misé sur Nokia en 2000, vous perdez 95%. Avec 50 entreprises tech mondiales (via ETF), le risque est dilué et la performance préservée.",
    formule: null, couleurEx: 'teal'
  },
  {
    id: 'correlation', titre: 'Corrélation', categorie: 'risque', icon: '◎',
    def: "Mesure entre -1 et +1 qui indique si deux actifs évoluent ensemble (+1 = identique) ou en sens contraire (-1 = parfaitement opposés). La diversification fonctionne mieux avec des actifs peu corrélés.",
    exemple: "Actions et obligations ont souvent une corrélation négative : quand la bourse chute, les obligations montent. C'est pourquoi un portefeuille 60/40 est moins volatil.",
    formule: 'ρ = -1 (oppose) → 0 (indépendant) → +1 (identique)', couleurEx: 'teal'
  },
  {
    id: 'sharpe', titre: 'Ratio de Sharpe', categorie: 'risque', icon: '◉',
    def: "Mesure la performance d'un investissement en tenant compte du risque pris. Plus le ratio est élevé, meilleure est la performance ajustée au risque.",
    exemple: "Portefeuille A : 12% de rendement, 20% de volatilité → Sharpe = (12-3)/20 = 0,45. Portefeuille B : 9% de rendement, 8% de volatilité → Sharpe = (9-3)/8 = 0,75. B est meilleur.",
    formule: 'Sharpe = (Rp - Rf) / σp | Rp=rendement, Rf=sans risque, σ=volatilité', couleurEx: 'gold'
  },
  {
    id: 'beta', titre: 'Bêta (β)', categorie: 'risque', icon: 'β',
    def: "Mesure la sensibilité d'un actif aux mouvements du marché. β=1 : évolue comme le marché. β>1 : amplifie les mouvements. β<1 : moins sensible.",
    exemple: "Une action avec β=1,5 monte de 15% si le marché monte de 10% — mais perd aussi 15% si le marché perd 10%. β=0,5 → mouvement deux fois moins fort.",
    formule: 'β > 1 : agressif | β = 1 : neutre | β < 1 : défensif | β < 0 : inverse', couleurEx: 'red'
  },

  // ── FISCALITÉ ──
  {
    id: 'pfu', titre: 'PFU / Flat Tax (30%)', categorie: 'fiscalite', icon: '○',
    def: "Prélèvement Forfaitaire Unique de 30% sur les revenus du capital (12,8% d'impôt + 17,2% de prélèvements sociaux). S'applique aux dividendes et plus-values du CTO.",
    exemple: "Vous réalisez 5 000 € de plus-values sur un CTO. Vous payez 30% = 1 500 € d'impôt. Il vous reste 3 500 €.",
    formule: 'PFU = Gains × 30% (12,8% IR + 17,2% PS)', couleurEx: 'gold'
  },
  {
    id: 'pea', titre: 'PEA — avantage fiscal', categorie: 'fiscalite', icon: '◉',
    def: "Après 5 ans de détention, les gains du PEA sont exonérés d'impôt sur le revenu (seuls les 17,2% de prélèvements sociaux restent dus). Plafond de versements : 150 000 €.",
    exemple: "Vous investissez 50 000 € dans un PEA qui devient 120 000 €. Gains = 70 000 €. Au CTO : 21 000 € d'impôt. Au PEA après 5 ans : 12 040 € seulement (PS uniquement).",
    formule: 'Impôt PEA (après 5 ans) = Gains × 17,2% (PS seulement)', couleurEx: 'teal'
  },
  {
    id: 'av-fiscalite', titre: 'Assurance-vie — fiscalité', categorie: 'fiscalite', icon: '◎',
    def: "Après 8 ans, bénéficiez d'un abattement annuel de 4 600 € (9 200 € pour un couple) sur les gains. Au-delà : 7,5% d'IR + 17,2% PS (si encours < 150k€).",
    exemple: "Votre AV génère 10 000 € de gains. Après 8 ans : les premiers 4 600 € sont totalement exonérés. Le reste (5 400 €) est taxé à 24,7% = 1 334 €.",
    formule: 'Gains imposables = Gains totaux - Abattement 4 600 € | Taux : 7,5% + 17,2%', couleurEx: 'gold'
  },
  {
    id: 'per-deductible', titre: 'PER — déductibilité', categorie: 'fiscalite', icon: '◈',
    def: "Les versements sur un PER sont déductibles de votre revenu imposable (jusqu'à 10% du revenu, max ~35 000 €/an). Avantage fiscal immédiat, mais impôt reporté à la sortie.",
    exemple: "TMI 30%, vous versez 5 000 € dans un PER → 1 500 € d'impôt économisé cette année. À la retraite avec TMI 11%, l'imposition sera plus légère.",
    formule: 'Économie impôt = Versement × TMI actuel | Gain = si TMI retraite < TMI actuel', couleurEx: 'purple'
  },
  {
    id: 'tmi', titre: 'TMI — Tranche Marginale', categorie: 'fiscalite', icon: '▣',
    def: "Taux d'imposition applicable à votre dernière tranche de revenus. En France : 0%, 11%, 30%, 41%, 45%. Seuls les revenus au-delà du seuil sont taxés à ce taux.",
    exemple: "Revenus imposables : 40 000 €. TMI = 30%. Mais seuls les revenus entre 27 479 € et 40 000 € (soit 12 521 €) sont taxés à 30%. Les premiers 27 479 € sont taxés à des taux inférieurs.",
    formule: 'Tranches 2024 : 0% (< 10 778€) / 11% / 30% / 41% / 45% (> 168 994€)', couleurEx: 'red'
  },

  // ── STRATÉGIE ──
  {
    id: 'dca', titre: 'DCA — Investissement régulier', categorie: 'strategie', icon: '◇',
    def: "Dollar-Cost Averaging : investir un montant fixe à intervalle régulier (chaque mois), quelle que soit l'évolution des marchés. Réduit l'impact du \"mauvais timing\".",
    exemple: "Plutôt que d'investir 12 000 € en une fois, vous investissez 1 000 €/mois. Les mois où le marché est bas, vous achetez plus de parts. Votre prix moyen s'optimise.",
    formule: 'Prix moyen = Σ(Montant investi) / Σ(Parts achetées)', couleurEx: 'teal'
  },
  {
    id: 'horizon', titre: 'Horizon de placement', categorie: 'strategie', icon: '▲',
    def: "Durée pendant laquelle vous comptez laisser votre argent investi. Plus l'horizon est long, plus vous pouvez prendre de risques (et espérer de meilleurs rendements).",
    exemple: "Court terme (<3 ans) → Livret A, fonds euros. Moyen terme (3-10 ans) → Mix obligations/actions. Long terme (>10 ans) → ETF actions mondiales, immobilier.",
    formule: null, couleurEx: 'teal'
  },
  {
    id: 'reequilibrage', titre: 'Rééquilibrage', categorie: 'strategie', icon: '⊞',
    def: "Ajustement périodique de votre portefeuille pour revenir à l'allocation cible. On vend ce qui a surperformé, on achète ce qui a sous-performé.",
    exemple: "Cible : 70% actions / 30% obligations. Après une bonne année boursière : 80% / 20%. Vous vendez 10% d'actions et achetez 10% d'obligations pour revenir à 70/30.",
    formule: null, couleurEx: 'gold'
  },
  {
    id: 'investissement-passif', titre: 'Gestion passive vs active', categorie: 'strategie', icon: '◉',
    def: "Passive : suivre un indice via ETF (faibles frais, performance proche du marché). Active : chercher à \"battre le marché\" via sélection de titres (frais élevés, moins de 20% des fonds actifs surperforment sur 15 ans).",
    exemple: "Fonds actif : 1,5%/an de frais, 7% de performance = 5,5% nets. ETF passif : 0,1% de frais, 7% de performance = 6,9% nets. Sur 30 ans sur 10 000 € : +31 000 € d'écart.",
    formule: "Impact frais sur 30 ans : 10 000 € × [(1+0,069)^30 - (1+0,055)^30] ≈ 31 000€", couleurEx: 'purple'
  },
  {
    id: 'levier', titre: 'Effet de levier', categorie: 'strategie', icon: '▣',
    def: "Utiliser de la dette pour augmenter la mise investie et potentiellement amplifier les gains. Amplifie aussi les pertes : outil à double tranchant.",
    exemple: "Vous avez 50 000 € et empruntez 50 000 € pour investir 100 000 €. +10% de performance → vous gagnez 10 000 € (20% sur votre mise). -10% → vous perdez 10 000 € (20% de perte sur votre mise).",
    formule: 'Rendement avec levier = Rendement actif × Levier - Coût dette × (Levier-1)', couleurEx: 'red'
  },
  {
    id: 'valeur-intrinsèque', titre: 'Valeur intrinsèque & PER', categorie: 'strategie', icon: '◌',
    def: "Le Price-Earning Ratio (PER ou P/E) compare le cours d'une action à ses bénéfices. Il indique combien les investisseurs paient pour 1 € de bénéfice. Aide à évaluer si une action est chère ou bon marché.",
    exemple: "Action à 100 €, bénéfice par action = 5 €. PER = 100/5 = 20. Cela signifie que vous payez 20 fois les bénéfices annuels. PER moyen historique S&P 500 : ~16-17.",
    formule: "PER = Prix de l'action / Bénéfice par action (BPA)", couleurEx: 'gold'
  },

  // ── MICROÉCONOMIE ──
  {
    id: 'offre-demande', titre: 'Offre & Demande', categorie: 'micro', icon: '◆',
    def: "La loi fondamentale de l'économie : quand la demande dépasse l'offre, les prix montent. Quand l'offre dépasse la demande, les prix baissent. Tout marché (actions, immobilier, matières premières) obéit à cette loi.",
    exemple: "En 2020-2021, la pénurie de puces électroniques (offre faible) face à une demande explosive a multiplié le prix des voitures neuves par 1,3 en moyenne.",
    formule: "Prix d'équilibre = point où Quantité offerte = Quantité demandée", couleurEx: 'teal'
  },
  {
    id: 'elasticite', titre: 'Élasticité-prix', categorie: 'micro', icon: '◈',
    def: "Mesure la sensibilité de la demande à une variation de prix. Un produit \"inélastique\" se vend autant même si le prix monte (essence, médicaments). Un produit \"élastique\" voit sa demande chuter si le prix augmente.",
    exemple: "L'essence est inélastique : +20% de prix → -5% de consommation. Un voyage en avion low-cost est élastique : +20% de prix → -40% de réservations.",
    formule: 'Élasticité = % variation quantité demandée / % variation prix', couleurEx: 'gold'
  },
  {
    id: 'cout-opportunite', titre: "Coût d'opportunité", categorie: 'micro', icon: '◇',
    def: "Ce que vous sacrifiez en choisissant une option plutôt qu'une autre. Le \"vrai\" coût d'un choix inclut toujours ce à quoi vous renoncez.",
    exemple: "Laisser 50 000 € sur un livret A à 3% plutôt que dans un ETF à 8% = coût d'opportunité de 5%/an, soit 2 500 €/an de manque à gagner.",
    formule: "Coût d'opportunité = Valeur de la meilleure alternative non choisie", couleurEx: 'purple'
  },
  {
    id: 'rendements-echelle', titre: 'Rendements décroissants', categorie: 'micro', icon: '▣',
    def: "Loi économique : au-delà d'un certain seuil, chaque unité supplémentaire d'un facteur produit de moins en moins de résultat.",
    exemple: "Un agriculteur avec 1 employé double sa production. Avec 10 employés, il la multiplie par 6 (pas par 10). Chaque travailleur supplémentaire apporte moins que le précédent.",
    formule: 'Productivité marginale diminue à mesure que le facteur augmente', couleurEx: 'red'
  },
  {
    id: 'externalites', titre: 'Externalités', categorie: 'micro', icon: '○',
    def: "Effets d'une activité économique sur des tiers non impliqués dans la transaction. Positives (recherche, éducation) ou négatives (pollution).",
    exemple: "Une usine qui pollue une rivière transfère son coût de production à la société. C'est une externalité négative — le prix de ses produits ne reflète pas le vrai coût social.",
    formule: null, couleurEx: 'teal'
  },

  // ── MACROÉCONOMIE ──
  {
    id: 'pib', titre: 'PIB — Produit Intérieur Brut', categorie: 'macro', icon: '◉',
    def: "Mesure de la richesse produite par un pays en un an. C'est l'indicateur macroéconomique le plus suivi. Sa croissance indique la santé de l'économie ; sa contraction (deux trimestres consécutifs) définit une récession.",
    exemple: "France 2023 : PIB ≈ 2 800 Mds€. Croissance de +0,9%. USA : 27 000 Mds$, soit ~10× la France. Un PIB/habitant élevé traduit un niveau de vie plus élevé.",
    formule: 'PIB = Consommation + Investissement + Dépenses publiques + (Exports - Imports)', couleurEx: 'teal'
  },
  {
    id: 'inflation-macro', titre: 'Inflation & Déflation', categorie: 'macro', icon: '▲',
    def: "L'inflation est la hausse générale et durable des prix, qui érode le pouvoir d'achat. La déflation (baisse des prix) paraît positive mais est dangereuse : elle pousse les consommateurs à reporter leurs achats.",
    exemple: "Zone euro 2022 : inflation à 8,4% (choc énergétique post-Ukraine). Un panier de 1 000 € en 2021 coûtait 1 084 € en 2022. Les banques centrales visent 2% d'inflation.",
    formule: 'IPC = (Panier année N / Panier année N-1 - 1) × 100', couleurEx: 'red'
  },
  {
    id: 'taux-directeur', titre: 'Taux directeur (BCE / Fed)', categorie: 'macro', icon: '◎',
    def: "Taux d'intérêt fixé par la banque centrale pour piloter l'économie. Hausse des taux → crédit plus cher → moins d'emprunts → moins d'inflation.",
    exemple: "La Fed est passée de 0,25% en 2022 à 5,5% en 2023 pour combattre l'inflation. Résultat : les crédits immobiliers US sont passés de 3% à 7,5%.",
    formule: 'Taux crédit bancaire ≈ Taux directeur + marge de risque', couleurEx: 'gold'
  },
  {
    id: 'politique-monetaire', titre: 'Politique monétaire', categorie: 'macro', icon: '◈',
    def: "Actions de la banque centrale sur la masse monétaire et les taux d'intérêt. Deux outils : taux directeurs et création monétaire (QE).",
    exemple: "QE (Quantitative Easing) : la BCE a acheté 3 000 Mds€ d'obligations entre 2015 et 2022. Effet secondaire : inflation des actifs (immobilier, actions).",
    formule: null, couleurEx: 'purple'
  },
  {
    id: 'politique-budgetaire', titre: 'Politique budgétaire', categorie: 'macro', icon: '▣',
    def: "Utilisation des dépenses publiques et de la fiscalité par l'État pour influencer l'économie. Politique expansive (déficit) en récession. Politique restrictive (austérité) pour réduire la dette.",
    exemple: "France 2020 (Covid) : déficit public à -9% du PIB avec le \"quoi qu'il en coûte\". L'État a injecté ~170 Mds€ pour sauver l'économie.",
    formule: 'Solde budgétaire = Recettes fiscales - Dépenses publiques', couleurEx: 'gold'
  },
  {
    id: 'cycle-economique', titre: 'Cycle économique', categorie: 'macro', icon: '◌',
    def: "L'économie traverse des phases régulières : expansion, pic, contraction, creux. Comprendre la phase du cycle aide à orienter ses investissements.",
    exemple: "En expansion → actions et immobilier surperforment. En récession → obligations d'État et or se défendent mieux. En reprise → valeurs cycliques (auto, luxe) rebondissent fort.",
    formule: 'Expansion → Pic → Contraction → Creux → Reprise → Expansion…', couleurEx: 'teal'
  },
  {
    id: 'chomage', titre: 'Chômage & Courbe de Phillips', categorie: 'macro', icon: '◆',
    def: "La courbe de Phillips décrit la relation inverse historique entre chômage et inflation : moins de chômage = plus d'inflation.",
    exemple: "USA 2022 : chômage à 3,5% (quasi plein emploi) et inflation à 9%. La Fed a relevé ses taux pour créer du chômage et casser l'inflation.",
    formule: 'π = πe - α(u - u*) | π=inflation, u=chômage, u*=chômage naturel', couleurEx: 'red'
  },
  {
    id: 'balance-commerciale', titre: 'Balance commerciale', categorie: 'macro', icon: '⊞',
    def: "Différence entre les exportations et importations d'un pays. Un excédent (exports > imports) renforce la monnaie nationale. Un déficit l'affaiblit.",
    exemple: "Allemagne : excédent commercial record de +250 Mds€/an grâce à ses exportations industrielles. France : déficit de -100 Mds€/an.",
    formule: 'Balance commerciale = Valeur exports - Valeur imports', couleurEx: 'teal'
  },
  {
    id: 'taux-change', titre: 'Taux de change', categorie: 'macro', icon: '◎',
    def: "Prix d'une devise exprimé en une autre. Il impacte directement vos investissements internationaux. Un euro fort réduit vos gains sur des actifs en dollars.",
    exemple: "EUR/USD = 1,10 → 1 € = 1,10 $. Si vous investissez dans un ETF S&P 500 et que l'euro monte à 1,20, vos gains en dollars sont amputés de ~8% lors de la conversion.",
    formule: 'Rendement réel = Rendement actif + Variation taux de change', couleurEx: 'gold'
  }
];

/*
  ACAD_LEXIQUE_DATA — tableau des abréviations financières courantes.
  Affiché dans la section "Lexique express" de l'académie.
*/
const ACAD_LEXIQUE_DATA = [
  { abbr: 'ETF',    full: 'Exchange-Traded Fund',                              desc: 'Fonds indiciel coté en bourse' },
  { abbr: 'AV',     full: 'Assurance-Vie',                                     desc: 'Enveloppe fiscale française' },
  { abbr: 'PEA',    full: "Plan d'Épargne en Actions",                         desc: 'Enveloppe fiscale — plafond 150k€' },
  { abbr: 'PER',    full: "Plan d'Épargne Retraite",                           desc: 'Épargne retraite déductible' },
  { abbr: 'CTO',    full: 'Compte-Titres Ordinaire',                           desc: 'Sans avantage fiscal (PFU 30%)' },
  { abbr: 'SCPI',   full: 'Société Civile de Placement Immobilier',            desc: 'Immobilier locatif mutualisé' },
  { abbr: 'REIT',   full: 'Real Estate Investment Trust',                      desc: 'Foncière cotée (version US des SCPI)' },
  { abbr: 'TRI',    full: 'Taux de Rendement Interne',                         desc: "Rendement annualisé réel d'un projet" },
  { abbr: 'VAN',    full: 'Valeur Actuelle Nette',                             desc: 'Valeur actuelle de flux futurs actualisés' },
  { abbr: 'CAC 40', full: 'Cotation Assistée en Continu',                      desc: '40 plus grandes capitalisations françaises' },
  { abbr: 'S&P 500',full: "Standard & Poor's 500",                            desc: '500 plus grandes capitalisations US' },
  { abbr: 'BPA',    full: 'Bénéfice Par Action',                               desc: "Bénéfice net / nombre d'actions" },
  { abbr: 'OAT',    full: 'Obligation Assimilable du Trésor',                  desc: "Emprunt d'État français" },
  { abbr: 'OPCVM',  full: 'Organisme de Placement Collectif en Valeurs Mobilières', desc: "Fonds d'investissement collectif" },
  { abbr: 'TMI',    full: "Tranche Marginale d'Imposition",                    desc: "Taux d'impôt sur la dernière tranche" },
  { abbr: 'PS',     full: 'Prélèvements Sociaux',                              desc: '17,2% sur les revenus du capital' },
  { abbr: 'DCA',    full: 'Dollar-Cost Averaging',                             desc: 'Investissement régulier programmé' },
  { abbr: 'CAGR',   full: 'Compound Annual Growth Rate',                       desc: 'Taux de croissance annuel composé' }
];

/* Variables pour filtrer et rechercher dans l'académie */
let _acadFilter = 'tous'; // Catégorie active ('tous', 'base', 'rendement', etc.)
let _acadSearch = '';     // Texte de recherche en cours

/*
  initAcademie() — initialise la page Académie :
  affiche la grille de termes, le lexique et les calculettes.
*/
function initAcademie() {
  renderAcadGrid();
  renderLexique();
  calcIC();
  calcR72();
  calcInf();
  calcSharpe();
}

/*
  filterAcad(cat, btn) — filtre les termes par catégorie.
  Paramètres :
  - cat : identifiant de la catégorie ('tous', 'base', 'rendement', etc.)
  - btn : bouton cliqué (pour le style actif)
*/
function filterAcad(cat, btn) {
  _acadFilter = cat;

  // Désactiver tous les boutons de filtre puis activer le bon
  var tousLesFiltres = document.querySelectorAll('.acad-filter');
  for (var i = 0; i < tousLesFiltres.length; i++) {
    tousLesFiltres[i].classList.remove('active');
  }
  if (btn) btn.classList.add('active');

  renderAcadGrid();
}

/*
  searchAcad(texteRecherche) — filtre les termes selon le texte tapé.
  Cherche dans le titre, la définition et la catégorie.
*/
function searchAcad(texteRecherche) {
  _acadSearch = texteRecherche.toLowerCase().trim();
  renderAcadGrid();
}

/*
  renderAcadGrid() — affiche les cartes de termes filtrées.
*/
function renderAcadGrid() {
  var grid = document.getElementById('acad-grid');
  if (!grid) return;

  // On part de tous les termes
  var termes = ACAD_TERMS;

  // Filtrage par catégorie
  if (_acadFilter !== 'tous') {
    var termesFiltres = [];
    for (var i = 0; i < termes.length; i++) {
      if (termes[i].categorie === _acadFilter) {
        termesFiltres.push(termes[i]);
      }
    }
    termes = termesFiltres;
  }

  // Filtrage par recherche textuelle
  if (_acadSearch) {
    var termesRecherche = [];
    for (var j = 0; j < termes.length; j++) {
      var t = termes[j];
      if (
        t.titre.toLowerCase().includes(_acadSearch)     ||
        t.def.toLowerCase().includes(_acadSearch)       ||
        t.categorie.toLowerCase().includes(_acadSearch)
      ) {
        termesRecherche.push(t);
      }
    }
    termes = termesRecherche;
  }

  // Mise à jour du compteur
  var compteur = document.getElementById('acad-count');
  if (compteur) {
    var s = termes.length > 1 ? 's' : '';
    compteur.textContent = termes.length + ' terme' + s + ' affiché' + s;
  }

  // Génération des cartes HTML
  var html = '';
  for (var k = 0; k < termes.length; k++) {
    html += acadCard(termes[k]);
  }
  grid.innerHTML = html;
}

/*
  acadCard(t) — génère le HTML d'une carte de terme financier.
  
  La carte est repliée par défaut et s'agrandit au clic (via toggleAcadCard).
  Elle affiche : icône, titre, tag catégorie, définition.
  En déroulant : exemple concret + formule clé.
*/
function acadCard(t) {
  /* Correspondance catégorie → libellé affiché */
  var tagLabels = {
    base:       'Bases',
    rendement:  'Rendement',
    risque:     'Risque',
    fiscalite:  'Fiscalité',
    strategie:  'Stratégie',
    micro:      'Microéconomie',
    macro:      'Macroéconomie'
  };

  /* HTML de la formule (affiché seulement si elle existe) */
  var htmlFormule = '';
  if (t.formule) {
    htmlFormule =
      '<div class="acad-example-label" style="margin-top:10px">Formule clé</div>' +
      '<div class="acad-formula">' + t.formule + '</div>';
  }

  return (
    '<div class="acad-card" id="card-' + t.id + '" onclick="toggleAcadCard(\'' + t.id + '\')">' +
      '<div class="acad-toggle-icon">▾</div>' +
      '<div class="acad-card-top">' +
        '<div class="acad-card-icon ' + t.categorie + '">' + t.icon + '</div>' +
        '<div class="acad-card-head">' +
          '<div class="acad-card-titre">' + t.titre + '</div>' +
          '<span class="acad-card-tag ' + t.categorie + '">' + (tagLabels[t.categorie] || t.categorie) + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="acad-card-def">' + t.def + '</div>' +
      '<div class="acad-card-expand">' +
        '<div class="acad-card-expand-inner">' +
          '<div class="acad-example-label">Exemple concret</div>' +
          '<div class="acad-example ' + (t.couleurEx || '') + '">' + t.exemple + '</div>' +
          htmlFormule +
        '</div>' +
      '</div>' +
    '</div>'
  );
}

/*
  toggleAcadCard(id) — ouvre ou ferme une carte de l'académie.
  Alterne la classe CSS "expanded" qui contrôle la hauteur via CSS.
*/
function toggleAcadCard(id) {
  var carte = document.getElementById('card-' + id);
  if (!carte) return;
  carte.classList.toggle('expanded');
}

/*
  renderLexique() — affiche le lexique des abréviations financières.
*/
function renderLexique() {
  var el = document.getElementById('acad-lexique');
  if (!el) return;

  var html = '';
  for (var i = 0; i < ACAD_LEXIQUE_DATA.length; i++) {
    var l = ACAD_LEXIQUE_DATA[i];
    html +=
      '<div class="lex-item">' +
        '<div class="lex-abbr">'  + l.abbr + '</div>' +
        '<div class="lex-full">'  + l.full + '</div>' +
        '<div class="lex-desc">'  + l.desc + '</div>' +
      '</div>';
  }
  el.innerHTML = html;
}


/* ══ CALCULETTES DE L'ACADÉMIE ══ */

/*
  switchCalcTab(tab, btn) — change l'onglet actif de la calculette.
  Paramètres :
  - tab : identifiant de l'onglet ('ic', 'rr', 'inf', 'sr')
  - btn : bouton cliqué
*/
function switchCalcTab(tab, btn) {
  // Désactiver tous les onglets et panneaux
  var tousOnglets  = document.querySelectorAll('.acad-ctab');
  var tousPanneaux = document.querySelectorAll('.acad-calc-pane');

  for (var i = 0; i < tousOnglets.length; i++)  tousOnglets[i].classList.remove('active');
  for (var j = 0; j < tousPanneaux.length; j++) tousPanneaux[j].classList.remove('active');

  if (btn) btn.classList.add('active');

  var panneau = document.getElementById('calc-' + tab);
  if (panneau) panneau.classList.add('active');
}

/* fmtAcad(n) — formate un nombre pour l'académie (même logique que fmtN) */
function fmtAcad(n) {
  if (!isFinite(n)) return '—';
  return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' €';
}

/*
  setAcadResults(id, items) — affiche les résultats d'une calculette.
  
  Paramètre items : tableau d'objets de deux types :
  - { lbl, val, col } → ligne de résultat standard (libellé + valeur colorée)
  - { type: 'verdict', html } → bloc de conclusion en bas
*/
function setAcadResults(id, items) {
  var el = document.getElementById(id);
  if (!el) return;

  var html = '';
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    if (item.type === 'verdict') {
      html += '<div class="acad-verdict">' + item.html + '</div>';
    } else {
      html +=
        '<div class="acr-item">' +
          '<span>' + item.lbl + '</span>' +
          '<span class="acr-val ' + (item.col || '') + '">' + item.val + '</span>' +
        '</div>';
    }
  }
  el.innerHTML = html;
}

/*
  calcIC() — calculette des Intérêts Composés.
  Calcule le capital final avec versements mensuels.
*/
function calcIC() {
  var capital  = parseFloat(document.getElementById('ic-capital')  ? document.getElementById('ic-capital').value  : 0) || 0;
  var monthly  = parseFloat(document.getElementById('ic-monthly')  ? document.getElementById('ic-monthly').value  : 0) || 0;
  var rate     = parseFloat(document.getElementById('ic-rate')     ? document.getElementById('ic-rate').value     : 0) || 0;
  var years    = parseInt(  document.getElementById('ic-years')    ? document.getElementById('ic-years').value    : 0) || 0;

  if (years <= 0) return;

  /* Calcul : on simule mois par mois
     Formule : capital_final = capital × (1 + r/12)^n + versement × [(1+r/12)^n - 1] / (r/12) */
  var tauxMensuel  = rate / 100 / 12;
  var nbMois       = years * 12;
  var valeur       = capital;
  for (var m = 0; m < nbMois; m++) {
    valeur = valeur * (1 + tauxMensuel) + monthly;
  }

  var totalVerse   = capital + monthly * nbMois;
  var interets     = valeur - totalVerse;
  var multiplicateur;
  if (totalVerse > 0) {
    multiplicateur = (valeur / totalVerse).toFixed(2);
  } else {
    multiplicateur = '—';
  }

  /* Message de conclusion : on compare les intérêts aux versements */
  var htmlVerdict;
  if (interets > totalVerse) {
    htmlVerdict =
      '<span style="color:var(--teal)">✓ Les intérêts (' + fmtAcad(interets) +
      ') dépassent vos versements (' + fmtAcad(totalVerse) +
      ') — la magie des intérêts composés est pleinement active !</span>';
  } else {
    htmlVerdict =
      'Les intérêts composés représentent <strong>' +
      (interets / valeur * 100).toFixed(0) +
      '%</strong> de votre capital final. Augmentez la durée pour décupler l\'effet.';
  }

  setAcadResults('ic-results', [
    { lbl: 'Capital final',     val: fmtAcad(valeur),      col: 'teal'   },
    { lbl: 'Total versé',       val: fmtAcad(totalVerse),  col: ''       },
    { lbl: 'Intérêts générés',  val: fmtAcad(interets),    col: 'gold'   },
    { lbl: 'Multiplicateur',    val: multiplicateur + '×', col: 'purple' },
    { type: 'verdict',          html: htmlVerdict                         }
  ]);
}

/*
  calcR72() — calculette de la Règle des 72.
  Estime le temps de doublement d'un capital selon son taux de rendement.
*/
function calcR72() {
  var rate    = parseFloat(document.getElementById('r72-rate')    ? document.getElementById('r72-rate').value    : 0) || 0;
  var capital = parseFloat(document.getElementById('r72-capital') ? document.getElementById('r72-capital').value : 0) || 0;

  if (rate <= 0) return;

  /* Règle des 72 : approximation du temps de doublement */
  var duree72     = 72 / rate;

  /* Calcul exact : on cherche n tel que (1 + r)^n = 2
     → n = log(2) / log(1 + r) */
  var dureeExacte  = Math.log(2) / Math.log(1 + rate / 100);
  var dureeTriple  = Math.log(3) / Math.log(1 + rate / 100);

  setAcadResults('r72-results', [
    { lbl: 'Doublement (règle 72)', val: duree72.toFixed(1)    + ' ans', col: 'teal'   },
    { lbl: 'Doublement (exact)',    val: dureeExacte.toFixed(1) + ' ans', col: ''       },
    { lbl: 'Capital doublé',        val: fmtAcad(capital * 2),            col: 'gold'   },
    { lbl: 'Triplement en',         val: dureeTriple.toFixed(1) + ' ans', col: 'purple' },
    {
      type: 'verdict',
      html: 'À <strong>' + rate + '%/an</strong>, votre capital double en <strong>' +
            duree72.toFixed(1) + ' ans</strong>. La règle 72 donne une approximation rapide : ' +
            'à 8% → 9 ans, à 10% → 7,2 ans, à 4% → 18 ans.'
    }
  ]);
}

/*
  calcInf() — calculette de l'Inflation.
  Calcule l'érosion du pouvoir d'achat sur une période donnée.
*/
function calcInf() {
  var capital = parseFloat(document.getElementById('inf-capital') ? document.getElementById('inf-capital').value : 0) || 0;
  var rate    = parseFloat(document.getElementById('inf-rate')    ? document.getElementById('inf-rate').value    : 0) || 0;
  var years   = parseInt(  document.getElementById('inf-years')   ? document.getElementById('inf-years').value   : 0) || 0;

  if (years <= 0) return;

  /* Valeur réelle = montant d'aujourd'hui exprimé en pouvoir d'achat futur
     formule : valeurReelle = capital / (1 + inflation)^n */
  var valeurReelle       = capital / Math.pow(1 + rate / 100, years);
  var perte              = capital - valeurReelle;
  var pourcentagePerte   = (perte / capital * 100).toFixed(1);

  /* Pour maintenir le même pouvoir d'achat, il faudrait :
     capitalNecessaire = capital × (1 + inflation)^n */
  var capitalNecessaire = capital * Math.pow(1 + rate / 100, years);

  setAcadResults('inf-results', [
    { lbl: 'Valeur réelle dans ' + years + ' ans', val: fmtAcad(valeurReelle),                    col: 'red' },
    { lbl: "Perte de pouvoir d'achat",             val: fmtAcad(perte) + ' (-' + pourcentagePerte + '%)', col: 'red' },
    { lbl: 'Pour conserver 100% du PA',            val: fmtAcad(capitalNecessaire),                col: 'gold' },
    {
      type: 'verdict',
      html: 'Avec une inflation de <strong>' + rate + '%/an</strong>, vos ' + fmtAcad(capital) +
            " actuels n'auront que le pouvoir d'achat de <strong>" + fmtAcad(valeurReelle) +
            '</strong> dans ' + years + ' ans. Pour maintenir votre niveau de vie, votre capital devra avoir atteint <strong>' +
            fmtAcad(capitalNecessaire) + '</strong>.'
    }
  ]);
}

/*
  calcSharpe() — calculette du Ratio de Sharpe.
  
  Formule : Sharpe = (rendement_portefeuille - taux_sans_risque) / volatilité
  Plus le ratio est élevé, meilleure est la performance ajustée au risque.
*/
function calcSharpe() {
  var rendement  = parseFloat(document.getElementById('sr-rend') ? document.getElementById('sr-rend').value : 0) || 0;
  var tauxSR     = parseFloat(document.getElementById('sr-rf')   ? document.getElementById('sr-rf').value   : 0) || 0;
  var volatilite = parseFloat(document.getElementById('sr-vol')  ? document.getElementById('sr-vol').value  : 0) || 0;

  if (volatilite <= 0) return;

  var sharpe       = (rendement - tauxSR) / volatilite;
  var excesRendement = rendement - tauxSR;

  /* Interprétation qualitative du ratio */
  var qualite;
  var verdict;
  if (sharpe < 0) {
    qualite = 'Négatif';
    verdict = 'Ratio négatif : votre investissement ne compense pas le risque pris. Un livret sans risque serait plus rentable.';
  } else if (sharpe < 0.5) {
    qualite = 'Faible';
    verdict = 'Ratio faible : la performance ne justifie pas bien le risque. Cherchez à réduire la volatilité ou augmenter le rendement.';
  } else if (sharpe < 1) {
    qualite = 'Correct';
    verdict = 'Ratio correct : acceptable mais pas exceptionnel. Un ETF monde tourne souvent autour de 0,5-0,7.';
  } else if (sharpe < 2) {
    qualite = 'Bon';
    verdict = 'Bon ratio : vous êtes bien rémunéré pour le risque pris. Warren Buffett affiche ~0,8 sur 40 ans.';
  } else {
    qualite = 'Excellent';
    verdict = 'Excellent ! Ratio > 2 est rare et souvent signe d\'une stratégie à tester sur le long terme (ou de chance sur une courte période).';
  }

  var couleur = sharpe < 0 ? 'red' : sharpe < 0.5 ? 'gold' : 'teal';

  setAcadResults('sr-results', [
    { lbl: 'Ratio de Sharpe',    val: sharpe.toFixed(2) + ' — ' + qualite, col: couleur },
    { lbl: 'Excès de rendement', val: excesRendement.toFixed(1) + '%',     col: 'teal'  },
    { lbl: 'Risque (vol.)',      val: volatilite.toFixed(1) + '%',         col: 'red'   },
    { type: 'verdict',           html: verdict                                           }
  ]);
}