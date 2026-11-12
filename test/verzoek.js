// Omzetten tussen formuliervelden en het verzoek aan het script. Alleen function/var op het hoogste niveau:
// dit bestand draait via een <script>-tag in de browser en via test/hulp/laad.js in Node.

// Geboortemaand of -jaar van een kind als geheel getal; leeg of onzin wordt NaN, zodat valideerVerzoek
// een fout geeft in plaats van het kind stilletjes als volwassene te tellen.
function verzoekGetal_(w) {
  var t = (w === undefined || w === null) ? '' : String(w).trim();
  return /^\d{1,4}$/.test(t) ? parseInt(t, 10) : NaN;
}

function verzoekTekst_(w) {
  return (w === undefined || w === null) ? '' : String(w);
}

// velden = { straat, huisnummer, voornaam, achternaam, email, telefoon, rekeninghouder,
//   personen: [{ voornaam, kind, maand, jaar, dieet, toelichting, eetMee, ehbo }], hulp, spullen,
//   bewaren, dieetBewaren, activiteiten, website, token, tweedeHuishouden }
function verzoekUitFormulier(velden) {
  var v = velden || {};
  var personen = [];
  var lijst = v.personen || [];
  for (var i = 0; i < lijst.length; i++) {
    var p = lijst[i] || {};
    var persoon = { voornaam: verzoekTekst_(p.voornaam) };
    if (p.kind === true) {
      persoon.geboortemaand = verzoekGetal_(p.maand);
      persoon.geboortejaar = verzoekGetal_(p.jaar);
    }
    persoon.dieet = (p.dieet || []).slice();
    persoon.dieetToelichting = verzoekTekst_(p.toelichting);
    persoon.eetMee = p.eetMee !== false;
    persoon.ehbo = p.ehbo === true;
    personen.push(persoon);
  }
  var verzoek = {
    actie: v.token ? 'wijzigen' : 'aanmelden',
    adres: { straat: verzoekTekst_(v.straat), huisnummer: verzoekTekst_(v.huisnummer), toevoeging: '' },
    contact: {
      voornaam: verzoekTekst_(v.voornaam), achternaam: verzoekTekst_(v.achternaam),
      email: verzoekTekst_(v.email), telefoon: verzoekTekst_(v.telefoon)
    },
    personen: personen,
    hulp: (v.hulp || []).slice(),
    spullen: (v.spullen || []).slice(),
    rekeninghouder: verzoekTekst_(v.rekeninghouder),
    toestemming: { bewaren: v.bewaren === true, dieet: v.dieetBewaren === true, activiteiten: v.activiteiten === true },
    website: verzoekTekst_(v.website)
  };
  if (v.token) verzoek.token = v.token;
  else verzoek.tweedeHuishouden = v.tweedeHuishouden === true;
  return verzoek;
}

// Het omgekeerde: een aanmelding zoals GET ?actie=huishouden die teruggeeft, als formuliervelden.
// De rekeninghouder komt niet terug van de server en blijft dus leeg; bij wijzigen houdt het script dan de opgeslagen naam.
function veldenUitAanmelding(aanmelding, token) {
  var h = aanmelding.huishouden || {};
  var personen = (aanmelding.personen || []).map(function (p) {
    var kind = p.geboortejaar !== null && p.geboortejaar !== undefined && p.geboortejaar !== '';
    return {
      voornaam: verzoekTekst_(p.voornaam), kind: kind,
      maand: kind ? verzoekTekst_(p.geboortemaand) : '', jaar: kind ? verzoekTekst_(p.geboortejaar) : '',
      dieet: (p.dieet || []).slice(), toelichting: verzoekTekst_(p.dieetToelichting),
      eetMee: p.eetMee !== false, ehbo: p.ehbo === true
    };
  });
  return {
    straat: verzoekTekst_(h.straat), huisnummer: verzoekTekst_(h.huisnummer) + verzoekTekst_(h.toevoeging),
    voornaam: verzoekTekst_(h.voornaam), achternaam: verzoekTekst_(h.achternaam),
    email: verzoekTekst_(h.email), telefoon: verzoekTekst_(h.telefoon), rekeninghouder: '',
    personen: personen,
    hulp: (aanmelding.hulp || []).slice(), spullen: (aanmelding.spullen || []).slice(),
    bewaren: h.toestemmingBewaren === true, dieetBewaren: h.toestemmingDieet === true,
    activiteiten: h.toestemmingActiviteiten === true, website: '', token: token
  };
}

// De publieke config (GET ?actie=config) in de vorm die valideerVerzoek en berekenBedrag verwachten.
// De config bevat alleen straatnamen; de afkorting is in de browser niet nodig en krijgt een plaatshouder.
function instellingenUitConfig(config) {
  var e = config.evenement || {};
  return {
    evenement: { naam: e.naam, datum: e.datum, locatie: e.locatie, contactEmail: e.contactEmail, nietMeeEtenGratis: config.nietMeeEtenGratis === true },
    datums: config.datums || {},
    leeftijdsgroepen: config.leeftijdsgroepen || [],
    dieetkeuzes: config.dieetkeuzes || [],
    straten: (config.straten || []).map(function (naam) { return { naam: naam, afkorting: 'XXX' }; }),
    hulpblokken: config.hulpblokken || [],
    spullen: config.spullen || []
  };
}

// Wat de klaarpagina over betalen zegt, met dezelfde betekenis als de betaalregel in de mail (sjabloon.js maakBetaalregel).
// antwoord = het ok-antwoord van het script. -> { soort, openstaand, link }; soort is
// 'betalen' (knop), 'volgt' (link volgt per mail), 'betaald', 'terug' (te veel betaald) of 'geen' (niets tonen).
// De afmeldmail heeft geen betaalregel, dus bij afmelden toont de pagina ook niets.
function betaalWeergave(antwoord, actie) {
  var a = antwoord || {};
  var openstaand = Number(a.openstaand) || 0;
  var link = typeof a.betaallink === 'string' && /^https?:\/\//i.test(a.betaallink) ? a.betaallink : null;
  var soort = 'geen';
  if (actie === 'afmelden') soort = 'geen';
  else if (a.betaalstatus === 'betaald') soort = 'betaald';
  else if (a.betaalstatus === 'terug te betalen') soort = 'terug';
  else if (openstaand > 0) soort = link ? 'betalen' : 'volgt';
  return { soort: soort, openstaand: openstaand, link: soort === 'betalen' ? link : null };
}
