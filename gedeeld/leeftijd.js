// Leeftijd en leeftijdsgroepen. Alleen function/var op het hoogste niveau (draait in Apps Script, browser en Node).

// Leeftijd in hele jaren op de peildatum (JJJJ-MM-DD), uit alleen geboortemaand en -jaar.
// Valt de geboortemaand in of na de maand van de peildatum, dan telt de persoon als nog niet jarig.
function leeftijdOpPeildatum(geboortejaar, geboortemaand, peildatum) {
  var delen = String(peildatum).split('-');
  var peilJaar = Number(delen[0]);
  var peilMaand = Number(delen[1]);
  var leeftijd = peilJaar - Number(geboortejaar);
  if (Number(geboortemaand) >= peilMaand) leeftijd -= 1;
  return leeftijd;
}

function leeftijdsgroepGeboortedatumFout_() {
  return new Error('Ongeldige geboortedatum');
}

function heeftWaarde_(w) {
  return w !== undefined && w !== null && w !== '';
}

// Bepaalt de leeftijdsgroep uit de geboortegegevens. Zonder geboortegegevens: de groep zonder bovengrens.
// Een geboortedatum na de peildatum (of maar half ingevuld) geeft een Error met 'geboortedatum' in de melding.
function bepaalGroep(persoon, instellingen) {
  var groepen = instellingen.leeftijdsgroepen;
  var heeftJaar = heeftWaarde_(persoon.geboortejaar);
  var heeftMaand = heeftWaarde_(persoon.geboortemaand);

  if (!heeftJaar && !heeftMaand) {
    for (var i = 0; i < groepen.length; i++) {
      if (groepen[i].tm === null) return groepen[i];
    }
    throw new Error('Geen leeftijdsgroep zonder bovengrens ingesteld');
  }
  if (heeftJaar !== heeftMaand) throw leeftijdsgroepGeboortedatumFout_();

  var jaar = Number(persoon.geboortejaar);
  var maand = Number(persoon.geboortemaand);
  if (!isFinite(jaar) || !isFinite(maand) || maand < 1 || maand > 12) throw leeftijdsgroepGeboortedatumFout_();

  var peil = String(instellingen.evenement.datum).split('-');
  var peilJaar = Number(peil[0]);
  var peilMaand = Number(peil[1]);
  if (jaar > peilJaar || (jaar === peilJaar && maand > peilMaand)) {
    throw new Error('De geboortedatum ligt na de datum van het evenement');
  }

  var leeftijd = Math.max(0, leeftijdOpPeildatum(jaar, maand, instellingen.evenement.datum));
  for (var j = 0; j < groepen.length; j++) {
    var g = groepen[j];
    if (leeftijd >= g.van && (g.tm === null || leeftijd <= g.tm)) return g;
  }
  throw new Error('Geen leeftijdsgroep gevonden voor deze geboortedatum');
}
