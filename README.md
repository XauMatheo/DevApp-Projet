Wealth OS est une application web interactive de gestion et de simulation de patrimoine. Elle permet aux utilisateurs de piloter leurs finances personnelles avec précision grâce à des outils de simulation en temps réel, des analyses de portefeuille et des projections de retraite.


--------------------------------------------------
Structure du Projet :

.
├── README.md
├── index.html
├── script.js
└── style.css


--------------------------------------------------
Fonctionnalités principales


L'application est divisée en plusieurs modules spécialisés accessibles via une barre de navigation latérale :

Tableau de bord (Vue globale) : Un résumé visuel de votre situation avec des indicateurs clés (KPI) comme le capital projeté et les gains générés.

Simulateur d'Investissement : Calculez l'évolution de votre capital en fonction de vos versements mensuels, du taux de rendement et de l'inflation.

Planification Retraite : Projetez le capital nécessaire pour vos vieux jours.

Bilan Patrimonial : Analysez vos actifs et passifs pour obtenir votre valeur nette.

Gestion de Budget : Suivez vos revenus et dépenses mensuelles pour calculer votre "reste à vivre".

Optimisation fiscale : Comparaison des enveloppes fiscales françaises (PEA, Assurance-vie, CTO, PER) avec application automatique des fiscalités respectives sur les gains.

Académie : Un espace de formation pour comprendre les concepts financiers comme les intérêts composés ou le Ratio de Sharpe.


--------------------------------------------------
Outils et Technologies utilisés


HTML5 / CSS3 : Structure et design moderne utilisant les variables CSS pour un thème basé sur le Glassmorphism (effets de transparence et de flou).

JavaScript : Logique métier, calculs financiers complexes et gestion de l'état de l'application.

Chart.js : Bibliothèque utilisée pour générer tous les graphiques interactifs (évolution du capital, multi-taux, allocation d'actifs).

Google Fonts : Utilisation des polices Outfit, Syne, DM Mono et Inter pour une typographie soignée.


--------------------------------------------------
Prérequis

Pour lancer cette application localement, vous avez simplement besoin de :


Un navigateur web moderne (Chrome, Firefox, Edge ou Safari).

Le projet ne nécessite aucun serveur spécifique (Node.js ou autre) car il repose sur des technologies "Client-Side" pures.


--------------------------------------------------
Comment lancer l'application


Téléchargez ou clonez le dossier du projet contenant les fichiers index.html, style.css et script.js.

Assurez-vous que les trois fichiers sont dans le même répertoire.

Ouvrez le fichier index.html dans votre navigateur (double-clic ou glisser-déposer).


--------------------------------------------------
Utilisation de l'application


Navigation : Utilisez la barre latérale pour basculer entre les différents modules (Investissement, Budget, etc.).

Saisie de données : Dans chaque simulateur, modifiez les valeurs dans les champs numériques (ex: Capital initial, Versement mensuel). Les calculs et les graphiques se mettent à jour automatiquement dès que vous changez une valeur.

Visualisation : Survolez les graphiques pour voir le détail des données année par année. Les résultats financiers (Net de fiscalité, Capital réel ajusté de l'inflation) s'affichent instantanément dans les encadrés de résultats.

Sauvegarde : L'application utilise le localStorage de votre navigateur pour mémoriser certains réglages, comme l'état (réduit ou ouvert) de la barre latérale.













