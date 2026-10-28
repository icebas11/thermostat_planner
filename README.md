# Thermostat Planner

Planning de chauffage pour Home Assistant, dans l'esprit d'une application de thermostat :
plages horaires colorées par température, modes **Maison** / **Absent**, et trois façons de programmer les jours.

- **Carte + intégration** : la consigne est envoyée au thermostat **côté serveur**, même dashboard fermé.
- **Deux profils** (Maison, Absent), chacun avec son propre planning.
- **Programmation des jours** : tous les jours · semaine + week-end · chaque jour indépendamment.
- **Plages** : ajouter, modifier (début, fin, température), supprimer, copier/coller un jour.
- **Passage en Absent** : manuel (interrupteur sur la carte) et/ou automatique via une entité de ton choix.

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
4. Ajoute la carte à un dashboard (la ressource est chargée automatiquement) :

```yaml
type: custom:thermostat-planner-card
title: Planning chauffage   # facultatif
```

## Fonctionnement
- Une journée est une suite de plages qui couvre **0h → 24h** ; chaque plage dure jusqu'au début de la suivante.
- Le mode effectif est **Absent** si l'interrupteur manuel est activé **ou** si l'entité choisie est dans l'état « absent ».
- La consigne est envoyée au thermostat **uniquement quand elle change** (début de plage, changement de mode, modification du planning). Un réglage manuel sur le thermostat reste donc en place jusqu'à la prochaine plage.
- Le planning est enregistré dans `.storage/thermostat_planner.data`.

## Entités et services
- `sensor.thermostat_planner_mode` : `home` ou `away`. Attributs : `manual_mode`, `forced_by_entity`, `target_temperature`, `next_change`, `enabled`.
- Service `thermostat_planner.set_mode` (`mode: home | away`) pour tes automatisations.

## Limites de cette première version
- Un seul thermostat.
- Pas de gestion des jours fériés ni de planning été/hiver.
- Température au pas de 0,5 °C, de 5 à 35 °C.
- Le thermostat doit accepter `climate.set_temperature` avec une consigne unique.

## Développement
```bash
python3 tests/test_schedule.py      # logique de planning
```
