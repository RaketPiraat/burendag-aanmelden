// Bedrag, betaalstatus en betaallink. Alleen function/var op het hoogste niveau (draait in Apps Script, browser en Node).
// Vereist bepaalGroep uit leeftijd.js.

// Berekent het bedrag per persoon en in totaal. Wie niet mee-eet betaalt 0 als instellingen.evenement.nietMeeEtenGratis aan staat.
// aantallen telt elke persoon per groepnaam, ook wie niet mee-eet.
function berekenBedrag(personen, instellingen) {
  var regels = [];
  var aantallen = {};
  var totaal = 0;
  for (var i = 0; i < personen.length; i++) {
    var persoon = personen[i];
    var groep = bepaalGroep(persoon, instellingen);
    var gratis = persoon.eetMee === false && instellingen.evenement.nietMeeEtenGratis === true;
    var prijs = gratis ? 0 : groep.prijs;
    regels.push({ voornaam: persoon.voornaam, groep: groep.naam, prijs: prijs });
    aantallen[groep.naam] = (aantallen[groep.naam] || 0) + 1;
    totaal += prijs;
  }
  return { totaal: totaal, regels: regels, aantallen: aantallen };
}

// 'vrijgesteld' | 'open' | 'betaald' | 'te weinig' | 'terug te betalen'
function bepaalBetaalstatus(bedrag, betaald) {
  var verschuldigd = Math.round(Number(bedrag) * 100);
  var ontvangen = Math.round(Number(betaald) * 100);
  if (verschuldigd === 0) return ontvangen > 0 ? 'terug te betalen' : 'vrijgesteld';
  if (ontvangen === 0) return 'open';
  if (ontvangen === verschuldigd) return 'betaald';
  return ontvangen < verschuldigd ? 'te weinig' : 'terug te betalen';
}

// De url van de betaallink met precies dit bedrag (numerieke gelijkheid), anders null.
function zoekBetaallink(bedrag, betaallinks) {
  var gezocht = Number(bedrag);
  for (var i = 0; i < (betaallinks || []).length; i++) {
    if (Number(betaallinks[i].bedrag) === gezocht) return betaallinks[i].url;
  }
  return null;
}
