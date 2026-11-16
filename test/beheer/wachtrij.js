// De wachtrij met uitgaande opdrachten van de beheerpagina. Puur: de opslag wordt meegegeven als
// { lees(sleutel), schrijf(sleutel, waarde) } (in de browser een laagje om localStorage, zie api.js).
// Sleutels: 'wachtrij' (opdrachten die nog verstuurd moeten worden) en 'mislukt' ({ opdracht, melding } die de server weigerde).
// Alleen function/var op het hoogste niveau, zodat de tests het bestand kunnen laden.

// 'O-' en 16 hexadecimale tekens. willekeur(aantal) geeft een lijst bytes; zonder: crypto.getRandomValues van de browser.
function nieuwOpdrachtId(willekeur) {
  var bytes = typeof willekeur === 'function' ? willekeur(8) : crypto.getRandomValues(new Uint8Array(8));
  var tekst = 'O-';
  for (var i = 0; i < 8; i++) tekst += ('0' + (bytes[i] & 255).toString(16)).slice(-2);
  return tekst;
}

function wachtrijLees(opslag) {
  var lijst = opslag.lees('wachtrij');
  return Array.isArray(lijst) ? lijst : [];
}

function mislukteLees(opslag) {
  var lijst = opslag.lees('mislukt');
  return Array.isArray(lijst) ? lijst : [];
}

// Zet de opdracht achteraan; een opdracht met hetzelfde id staat er maar één keer in.
function wachtrijVoegToe(opslag, opdracht) {
  var lijst = wachtrijLees(opslag);
  for (var i = 0; i < lijst.length; i++) if (lijst[i].id === opdracht.id) return lijst.length;
  lijst.push(opdracht);
  opslag.schrijf('wachtrij', lijst);
  return lijst.length;
}

// Zet een geweigerde opdracht bij 'mislukt'; per opdracht-id staat er maar één melding (een dubbele verzending voegt niets toe).
function mislukteVoegToe(opslag, opdracht, melding) {
  var lijst = mislukteLees(opslag);
  for (var i = 0; i < lijst.length; i++) if (lijst[i].opdracht.id === opdracht.id) return lijst.length;
  lijst.push({ opdracht: opdracht, melding: melding || 'Dit lukte niet. Probeer het later opnieuw of vraag het de beheerder.' });
  opslag.schrijf('mislukt', lijst);
  return lijst.length;
}

// Haalt een gemelde mislukking weg (de gebruiker heeft hem gelezen). Zonder id: alles.
function mislukteWis(opslag, id) {
  opslag.schrijf('mislukt', id === undefined ? [] : mislukteLees(opslag).filter(function (m) { return m.opdracht.id !== id; }));
}

// Stuurt de opdrachten één voor één, in volgorde. stuur(opdracht) geeft het antwoord van het achterwerk of gooit bij een netwerkfout.
//  ok:true (ook dubbel:true)  -> uit de wachtrij
//  ONGELDIG of RECHT          -> uit de wachtrij, naar 'mislukt' met de melding
//  SESSIE                     -> blijft; stopt en geeft sessieVerlopen:true
//  FOUT of een netwerkfout    -> blijft; stopt (de volgende volgorde blijft dan kloppen) voor een latere poging
// Geeft { verstuurd, over } (verstuurd = aantal dat de server aannam), plus sessieVerlopen:true bij SESSIE.
function wachtrijVerstuur(opslag, stuur) {
  var verstuurd = 0;
  function klaar(sessieVerlopen) {
    var uit = { verstuurd: verstuurd, over: wachtrijLees(opslag).length };
    if (sessieVerlopen) uit.sessieVerlopen = true;
    return uit;
  }
  function verwijder(opdracht) {
    opslag.schrijf('wachtrij', wachtrijLees(opslag).filter(function (o) { return o.id !== opdracht.id; }));
  }
  // Doet de eerste opdracht in de wachtrij en gaat door met de volgende (een gewone functie, geen async, zoals de rest van het project).
  function volgende() {
    var lijst = wachtrijLees(opslag);
    if (lijst.length === 0) return klaar(false);
    var opdracht = lijst[0];
    var belofte;
    try { belofte = Promise.resolve(stuur(opdracht)); } catch (fout) { return klaar(false); }
    return belofte.then(function (antwoord) {
      if (antwoord && antwoord.ok === true) {
        verwijder(opdracht);
        verstuurd++;
        return volgende();
      }
      if (antwoord && (antwoord.code === 'ONGELDIG' || antwoord.code === 'RECHT')) {
        verwijder(opdracht);
        mislukteVoegToe(opslag, opdracht, antwoord.melding);
        return volgende();
      }
      return klaar(!!antwoord && antwoord.code === 'SESSIE');
    }, function () { return klaar(false); });
  }
  return Promise.resolve().then(volgende);
}

// Een kopie van de momentopname waarin de eigen opdrachten die nog niet bij de server zijn (of nog niet in de lijst staan)
// als status 'onderweg' in mijnOpdrachten staan. Wat de server al kent, blijft zoals de server het meldt.
function samenvoegMetMomentopname(momentopname, wachtrij) {
  if (!momentopname) return momentopname;
  var uit = JSON.parse(JSON.stringify(momentopname));
  var lijst = Array.isArray(uit.mijnOpdrachten) ? uit.mijnOpdrachten : [];
  var bekend = {};
  for (var i = 0; i < lijst.length; i++) bekend[lijst[i].id] = true;
  var nieuw = [];
  for (var j = 0; j < (wachtrij || []).length; j++) {
    var o = wachtrij[j];
    if (bekend[o.id]) continue;
    nieuw.push({ id: o.id, type: o.type, status: 'onderweg', melding: '', ontvangenOp: '', gegevens: o.gegevens });
  }
  uit.mijnOpdrachten = nieuw.concat(lijst);
  return uit;
}
