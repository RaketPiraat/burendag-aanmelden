// CSV-parser (RFC 4180): aanhalingstekens, scheidingsteken en regeleinden binnen een veld. Alleen function/var op het hoogste niveau.

// Geeft een lijst rijen van lijsten velden. Een BOM vooraan wordt genegeerd; een lege slotregel levert geen rij op.
function parseCsv(tekst, scheidingsteken) {
  var sep = scheidingsteken || ',';
  var rijen = [];
  var rij = [];
  var veld = '';
  var tussenQuotes = false;
  var veldBezig = false;
  if (tekst.charAt(0) === '﻿') tekst = tekst.slice(1);
  for (var i = 0; i < tekst.length; i++) {
    var c = tekst.charAt(i);
    if (tussenQuotes) {
      if (c === '"') {
        if (tekst.charAt(i + 1) === '"') { veld += '"'; i++; } else { tussenQuotes = false; }
      } else {
        veld += c;
      }
    } else if (c === '"') {
      tussenQuotes = true; veldBezig = true;
    } else if (c === sep) {
      rij.push(veld); veld = ''; veldBezig = true;
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && tekst.charAt(i + 1) === '\n') i++;
      if (veldBezig || veld !== '' || rij.length > 0) { rij.push(veld); rijen.push(rij); }
      rij = []; veld = ''; veldBezig = false;
    } else {
      veld += c; veldBezig = true;
    }
  }
  if (veldBezig || veld !== '' || rij.length > 0) { rij.push(veld); rijen.push(rij); }
  return rijen;
}
