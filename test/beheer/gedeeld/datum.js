// Kalenderdatum in Nederland. Alleen function/var op het hoogste niveau (draait in Apps Script, browser en Node).

// Kalenderdatum 'JJJJ-MM-DD' van een moment (Date) in Europe/Amsterdam. Gebruikt formatToParts, zodat de uitvoer
// niet afhangt van hoe een locale een datum opmaakt. Gooit een Error bij een ongeldige datum of onverwachte uitvoer.
function kalenderdatumAmsterdam(date) {
  var delen = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  var w = {};
  for (var i = 0; i < delen.length; i++) w[delen[i].type] = delen[i].value;
  var tekst = w.year + '-' + w.month + '-' + w.day;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tekst)) throw new Error('Kalenderdatum niet te bepalen: ' + tekst);
  return tekst;
}
