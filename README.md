# Thermostat Planner

Planning de chauffage pour Home Assistant, dans l'esprit d'une application de thermostat :
plages horaires colorées par température, modes **Maison** / **Absent**, et trois façons de programmer les jours.

- **Carte + intégration** : la consigne est envoyée au thermostat **côté serveur**, même dashboard fermé.
- **Deux profils** (Maison, Absent), chacun avec son propre planning.
- **Programmation des jours** : tous les jours · semaine + week-end · chaque jour indépendamment.
- **Semaine en un coup d'œil** : une grille avec une ligne par jour (ou par groupe de jours) ; touche un jour pour voir et modifier ses plages.
- **Plages** : ajouter, modifier (début, fin, température), supprimer, copier un jour vers plusieurs autres (des deux plannings).
- **Réglage immédiat** : boutons − / + sur la carte pour déroger au planning jusqu'à la prochaine plage.
- **Passage en Absent** : manuel (interrupteur sur la carte) et/ou automatique via une entité de ton choix.
- **Plusieurs thermostats (zones)** : un planning par thermostat, un mode Maison / Absent commun, et la possibilité de mettre une seule zone en Absent.

## Installation

### Avec HACS (dépôt personnalisé)
1. Mets ce dossier dans un dépôt GitHub.
2. HACS › ⋮ › *Dépôts personnalisés* › ajoute l'URL, catégorie **Intégration**.
3. Télécharge **Thermostat Planner**, puis **redémarre** Home Assistant.

### À la main
Copie `custom_components/thermostat_planner/` dans `<config>/custom_components/`, puis redémarre Home Assistant.

## Configuration
1. *Paramètres › Appareils et services › Ajouter une intégration › Thermostat Planner*.
2. Choisis ton thermostat (`climate.thermostat`).
3. *(Facultatif)* Choisis une entité qui force le mode Absent et l'état qui signifie « absent » :
   - `person.moi` → état `not_home`
   - un interrupteur / `input_boolean` → `on`
   - une alarme → `armed_away`

   Ces réglages restent modifiables via *Configurer*.

   *Configurer* propose aussi les **droits de modification** : par défaut, **tous les utilisateurs** peuvent modifier
   le planning. En cochant *Restreindre la modification du planning*, seuls les administrateurs et les utilisateurs
   cochés le peuvent ; les autres voient la carte en lecture seule, mais peuvent toujours utiliser − / + et le mode Absent.
4. Ajoute la carte à un dashboard. La ressource `/thermostat_planner/thermostat-planner-card.js` est ajoutée
   automatiquement dans *Paramètres › Tableaux de bord › Ressources* (en mode YAML de Lovelace, elle est chargée
   globalement à la place) :

```yaml
type: custom:thermostat-planner-card
climate: climate.salon      # obligatoire avec plusieurs thermostats (ou entry_id), voir « Plusieurs thermostats »
title: Planning chauffage   # facultatif
format: full                # facultatif : full (planning complet, par défaut) ou compact (coup d'œil, voir « Carte compacte »)
expand_today: false         # facultatif : ne pas sélectionner aujourd'hui à l'ouverture (true par défaut)
show_controls: true         # facultatif : boutons − / + de réglage immédiat (true par défaut)
show_zone_away: true        # facultatif : interrupteur « Absent pour cette zone uniquement » (masqué par défaut)
override_duration: 120      # facultatif : durée d'une dérogation en minutes (par défaut : jusqu'à la prochaine plage)
colors:                     # facultatif : couleur des plages par paliers de température
  - max: 18
    color: "#3b82f6"
  - max: 22
    color: "#22c55e"
  - color: "#f97316"        # pas de borne = tout le reste
```

### La carte
- **En-tête** : la consigne actuelle en grand, avec les boutons **−** / **+** (voir « Réglage immédiat »). Dessous :
  le mode effectif, la température de la pièce et le prochain changement, par exemple « 20:30 → 20,5° ».
  Pendant une dérogation, un bandeau indique sa fin et le temps restant (« Dérogation jusqu'à 20:30 · encore 1 h 50 »)
  avec **Reprendre le planning**.
- **Passer en mode Absent** : l'interrupteur du mode commun (voir « Plusieurs thermostats »).
- **Planning Maison / Planning Absent** : choisit le planning affiché (et non le mode) ; le badge « actif » marque
  celui qui s'applique.
- **Grille de la semaine** : une ligne par planning du mode de programmation choisi : une seule ligne
  (*Tous les jours*), deux (*Semaine + week-end*) ou sept (*Chaque jour*). La couleur suit la température, un trait
  marque l'heure actuelle sur la ligne d'aujourd'hui. Toucher une ligne la sélectionne, l'agrandit avec ses
  températures et affiche dessous la **liste de ses plages** (touche une plage pour la modifier) ; toucher à nouveau
  la ligne la referme. Par défaut, aujourd'hui est sélectionné à l'ouverture (`expand_today: false` pour ne rien
  sélectionner).
- **Copier vers…** : copie les plages du jour sélectionné vers les jours cochés, dans le même planning ou dans
  l'autre (par exemple *Vendredi* vers *Lundi*, *Mardi* et *Jeudi*, ou vers le planning Absent).
- **Réglages** (replié) : mode de programmation des jours et pause de la planification.
- En **lecture seule**, la carte l'indique au-dessus de la grille : on peut consulter les jours, sans modifier.

### Carte compacte (`format: compact`)
Pour un tableau de bord mobile ou une carte par zone, `format: compact` affiche seulement l'essentiel, sur
environ 300 px de haut :

```yaml
type: custom:thermostat-planner-card
climate: climate.salon
format: compact
```

- le nom de la zone (ou `title`), le mode **Maison / Absent** et l'état de chauffe du thermostat (`hvac_action`) ;
- la **consigne actuelle** en grand, la température de la pièce et le prochain changement
  (« → 20,5° à 20:30, dans 3 h 20 ») ;
- pendant une dérogation, le même bandeau que la carte complète, avec **Reprendre le planning** ;
- un **ruban des 12 prochaines heures** : la dérogation hachurée, puis les plages du planning ;
- les boutons **−** / **+** (masqués avec `show_controls: false`) et **Planning ›**, qui ouvre la carte complète
  à la place de la carte compacte (bouton **Réduire** pour revenir).

On ne modifie pas le planning dans ce format. Les options `climate` / `entry_id`, `show_controls`,
`override_duration` et `colors` s'appliquent ; sans `format`, la carte reste la carte complète.

### Plusieurs thermostats (zones)
Chaque thermostat est une **entrée** de l'intégration, avec son propre planning, ses dérogations et ses entités.

**Ajouter un second thermostat** : *Paramètres › Appareils et services › Thermostat Planner › Ajouter une entrée*.
Choisis le thermostat et, si tu veux, le nom de la zone (par défaut, le nom du thermostat ; il sert de nom à
l'appareil et donc aux `entity_id` des nouvelles entités). L'entité d'absence est pré-remplie avec celle d'une
zone existante. Un thermostat déjà géré par une autre zone est refusé. La nouvelle zone part du planning par défaut.

**Une carte par zone** : indique la zone avec `climate` (le thermostat de la zone) ou avec `entry_id`
(l'identifiant de l'entrée, visible dans l'URL de sa page *Appareils et services*) :

```yaml
type: custom:thermostat-planner-card
climate: climate.chambre    # ou entry_id: 01JC0123456789ABCDEFGHJKMN
```

Avec un seul thermostat, ni `entry_id` ni `climate` ne sont nécessaires : les cartes existantes continuent de
fonctionner. Avec plusieurs, une carte sans l'un ni l'autre affiche un message demandant de préciser la zone. Le
titre par défaut est alors suivi du nom de la zone.

**Mode Absent** :
- le mode **Maison / Absent** est **commun à toutes les zones** : l'interrupteur de n'importe quelle carte, le
  sélecteur de n'importe quelle zone ou le service `set_mode` les basculent toutes ;
- **Absent pour cette zone uniquement** (entité *Zone absente*, service `set_zone_away`, et interrupteur sur la
  carte avec l'option `show_zone_away: true`) force une seule zone en Absent, par exemple une chambre d'amis
  inoccupée ; les autres zones suivent le mode commun. Sans l'option, l'interrupteur n'est pas affiché ; si la
  zone est forcée en Absent, la carte l'indique simplement sous « Passer en mode Absent » ;
- l'**entité d'absence** se règle par zone (*Configurer*) et ne force que sa zone ;
- une zone est donc Absent si le mode commun est Absent, **ou** si son entité d'absence est dans l'état « absent »,
  **ou** si elle est marquée *Zone absente*. Elle n'est jamais Maison quand le mode commun est Absent.

Les droits de modification du planning (*Restreindre la modification du planning*) se règlent par zone.

### Couleurs par paliers
Chaque palier accepte `min` et/ou `max` (bornes **incluses**, en °C), `color` (obligatoire, toute couleur CSS)
et `text_color` (facultatif, sinon noir ou blanc selon le contraste). Le **premier** palier qui correspond
s'applique ; une température qui ne correspond à aucun palier garde le dégradé par défaut (bleu → ambre).

Avec l'exemple ci-dessus : ≤ 18 ° → bleu, 18,5 à 22 ° → vert, ≥ 22,5 ° → orange.

### Réglage immédiat (dérogation)
En haut de la carte, les boutons **−** / **+** modifient la consigne du thermostat, au pas et dans les bornes
du thermostat (`target_temp_step`, `min_temp`, `max_temp`). La consigne est envoyée **1 s après le dernier appui**.
Il s'agit d'une **dérogation** :
- elle dure jusqu'à la **prochaine plage** (ou `override_duration` minutes), puis le planning reprend tout seul ;
- elle est annulée si le mode effectif change (Maison ↔ Absent) ;
- elle est mémorisée et survit à un redémarrage ;
- elle s'applique même planification en pause (dans ce cas, rien n'est renvoyé à son expiration) ;
- **Reprendre le planning** l'annule et renvoie aussitôt la consigne de la plage en cours ; revenir avec − / + à
  la consigne prévue fait de même.

Sans dérogation, si la consigne du thermostat diffère du planning (réglage fait directement sur l'appareil),
la carte affiche « Planning 18° » sous la consigne. L'icône de flamme indique si le thermostat chauffe (`hvac_action`).

### Largeur
Dans la vue **Sections**, la carte prend par défaut toute la largeur de la section, même si elle s'étend sur plusieurs colonnes (minimum 6 colonnes) ;
la taille reste modifiable dans l'onglet *Disposition* de l'éditeur. Le contenu s'adapte à la largeur :
graduations de l'axe plus fines, températures affichées dans les plages courtes de la ligne sélectionnée
quand la place le permet, et liste des plages sur plusieurs colonnes.

## Fonctionnement
- Une journée est une suite de plages qui couvre **0h → 24h** ; chaque plage dure jusqu'au début de la suivante.
- Le mode effectif d'une zone est **Absent** si l'interrupteur manuel (commun à toutes les zones) est activé, **ou** si l'entité choisie pour la zone est dans l'état « absent », **ou** si la zone est marquée *Zone absente*.
- La consigne est envoyée au thermostat **uniquement quand elle change** (début de plage, changement de mode, modification du planning). Un réglage manuel sur le thermostat reste donc en place jusqu'à la prochaine plage.
- La consigne est envoyée **une fois par plage**, et la plage appliquée est mémorisée (`.storage/thermostat_planner.<entry_id>.applied`). Après un redémarrage de Home Assistant ou une coupure du thermostat :
  - si on est toujours dans la même plage, rien n'est renvoyé : un réglage manuel est conservé ;
  - si une nouvelle plage a commencé entre-temps, ou si l'envoi avait échoué, la consigne est envoyée **dès que le thermostat redevient disponible**.
- Une **dérogation** en cours prime sur le planning (voir *Réglage immédiat*). Elle est enregistrée dans `.storage/thermostat_planner.<entry_id>.override`.
- Des plages consécutives à la même température comptent comme une seule (ex. 23:00 → 00:00 à 18 °C : pas de renvoi à minuit).
- Le planning est enregistré dans `.storage/thermostat_planner.<entry_id>.data` (un fichier par zone) ; le mode commun dans `.storage/thermostat_planner.global`.
- **Mise à jour depuis la v0.4 ou avant** : les anciens fichiers `.storage/thermostat_planner.data`, `.applied` et `.override` sont repris une seule fois par le thermostat déjà configuré, puis supprimés une fois la copie relue et vérifiée. Si l'écriture échoue, ils sont conservés et utilisés tels quels, et la reprise est retentée au démarrage suivant. Le planning, le mode, la dérogation en cours et les `entity_id` existants sont conservés.

## Entités et services
Les entités de chaque zone sont rattachées à l'appareil de la zone (nommé **Thermostat Planner** pour un thermostat configuré avant le multi-thermostat, sinon d'après la zone) et utilisables dans les automatisations, les assistants vocaux et l'historique. Les `entity_id` indiqués sont ceux créés par défaut pour le premier thermostat, avec Home Assistant en français (entre parenthèses, en anglais) : Home Assistant les dérive du nom de l'appareil et du nom traduit de l'entité. Pour une autre zone, `thermostat_planner` est remplacé par le nom de la zone (ex. `select.chauffage_sdb_mode_manuel`). Tu peux les renommer.

| Entité | Rôle |
|---|---|
| `select.thermostat_planner_mode_manuel` (`…_manual_mode`) | Mode manuel *Maison* / *Absent* (`home` / `away`), **commun à toutes les zones**, comme le bouton de la carte ou le service `set_mode`. Attributs : `effective_mode` (mode réellement appliqué à la zone, `away` si l'entité d'absence ou *Zone absente* le force), `forced_by_entity`, `zone_away`. |
| `switch.thermostat_planner_zone_absente` (`…_zone_away`) | *Zone absente* : force cette seule zone en Absent. Ouvert à tous, comme le mode. |
| `switch.thermostat_planner_programmation` (`…_scheduling`) | Programmation activée ou en pause. Avec l'option *Restreindre la modification du planning*, seuls les administrateurs et les utilisateurs autorisés peuvent la changer depuis l'interface ; les automatisations le peuvent toujours. |
| `sensor.thermostat_planner_consigne_prevue` (`…_planned_setpoint`) | Consigne prévue maintenant (°C) : celle de la dérogation en cours, sinon celle du planning (même programmation en pause). Attributs : `source` (`override` / `schedule`), `mode`, `enabled`. |
| `sensor.thermostat_planner_prochain_changement` (`…_next_change`) | Horodatage du prochain **changement de consigne** (les plages consécutives à la même température sont fusionnées) ; pendant une dérogation, sa fin. Inconnu si aucun changement n'est prévu (programmation en pause, consigne unique toute la semaine). Attributs : `next_temperature`, `source`. |
| `sensor.thermostat_planner_mode` | Mode effectif `home` ou `away`. Attributs : `manual_mode`, `forced_by_entity`, `zone_away`, `target_temperature` (consigne prévue par le planning), `next_change`, `override_temperature`, `override_until`, `enabled`. |

Exemple : préchauffer la salle de bain 30 min avant chaque changement.
```yaml
triggers:
  - trigger: time
    at:
      entity_id: sensor.thermostat_planner_prochain_changement
      offset: "-00:30:00"
```

- Service `thermostat_planner.set_mode` (`mode: home | away`) pour tes automatisations : mode commun, appliqué à toutes les zones.
- Service `thermostat_planner.set_zone_away` (`away: true | false`) : force une zone en Absent, ou la rend au mode commun.
- Service `thermostat_planner.set_override` (`temperature`, `duration` facultative, ex. `"02:00:00"`) : dérogation jusqu'à la prochaine plage ou pendant la durée donnée.
- Service `thermostat_planner.clear_override` : reprend le planning.

Chaque service accepte `climate` ou `entry_id` pour choisir la zone. Avec un seul thermostat, ils sont facultatifs ;
avec plusieurs, ils sont obligatoires, sauf pour `set_mode` qui agit sur toutes les zones :

```yaml
action: thermostat_planner.set_override
data:
  climate: climate.chambre
  temperature: 21
  duration: "01:00:00"
```

## Limites de cette première version
- Pas de gestion des jours fériés ni de planning été/hiver.
- Température au pas de 0,5 °C, de 5 à 35 °C.
- Le thermostat doit accepter `climate.set_temperature` avec une consigne unique.

## Développement
```bash
python3 tests/test_schedule.py      # logique de planning
node tests/test_card.js             # fonctions pures de la carte
```
