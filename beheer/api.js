// Praat met het koppelscript en bewaart wat de pagina op het apparaat houdt. API_URL en BEHEER_OMGEVING komen uit config.js.
// POST gaat als text/plain, zodat de browser geen extra CORS-vooraanvraag doet (Apps Script kan die niet beantwoorden), net als site/api.js.
// Test en prod staan op dezelfde plek (zelfde adres), dus de sleutels in localStorage dragen de omgeving in hun naam.

var BEHEER_TIJDSLIMIET_MS = 45000;

function beheerSleutel(naam) {
  return 'beheer.' + (typeof BEHEER_OMGEVING === 'string' ? BEHEER_OMGEVING : 'prod') + '.' + naam;
}

// Opslag in de vorm die wachtrij.js verwacht: { lees(sleutel), schrijf(sleutel, waarde) }. Waarden zijn JSON.
var beheerOpslag = {
  lees: function (naam) {
    try {
      var tekst = localStorage.getItem(beheerSleutel(naam));
      return tekst === null ? null : JSON.parse(tekst);
    } catch (e) { return null; }
  },
  schrijf: function (naam, waarde) {
    try { localStorage.setItem(beheerSleutel(naam), JSON.stringify(waarde)); return true; } catch (e) { return false; }
  },
  wis: function (naam) {
    try { localStorage.removeItem(beheerSleutel(naam)); } catch (e) { /* opslag niet beschikbaar */ }
  }
};

// Eén verzoek aan het koppelscript, met de sessie uit de opslag. Geeft het antwoord ({ok, ...}) of gooit bij geen verbinding,
// een tijdsoverschrijding of een onleesbaar antwoord.
function beheerVerzoek(actie, gegevens) {
  var verzoek = Object.assign({}, gegevens || {}, { actie: actie });
  var sessie = beheerOpslag.lees('sessie');
  if (actie !== 'beheerInloggen' && sessie && sessie.sessie) verzoek.sessie = sessie.sessie;
  var stop = typeof AbortController === 'function' ? new AbortController() : null;
  var timer = stop ? setTimeout(function () { stop.abort(); }, BEHEER_TIJDSLIMIET_MS) : null;
  return fetch(API_URL, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(verzoek),
    signal: stop ? stop.signal : undefined
  }).then(function (antwoord) {
    if (!antwoord.ok) throw new Error('Server gaf status ' + antwoord.status);
    return antwoord.json();
  }).then(function (uit) {
    if (timer) clearTimeout(timer);
    return uit;
  }, function (fout) {
    if (timer) clearTimeout(timer);
    throw fout;
  });
}
