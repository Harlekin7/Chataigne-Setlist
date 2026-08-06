/*
 * Setlist Index — Chataigne Custom Module (schlank)
 * ===========================================================================
 * Aufgabe: aus der State Machine die Index-Nummer des AKTUELLEN Songs
 * entgegennehmen und ans Setlist-Dashboard weitermelden.
 *
 * Das Triggern der Resolume-Clips bleibt bei euren bestehenden Action-States
 * (AND aus Startzeit + Endzeit + "LTC Playing"). Dieses Modul haengt sich nur
 * zusaetzlich als Consequence an jeden State.
 *
 * VERDRAHTUNG IN DER STATE MACHINE
 *   Consequence-Typ:  Command
 *   Ziel:             Setlist Index  ->  Set Current Song
 *   Parameter Index:  die feste Index-Nummer dieses Songs
 *
 * Alternativ (falls lieber "Set Value"): den Parameter "Current Index Param"
 * setzen -> wird ebenfalls gemeldet.
 *
 * AUSGANG (OSC an das Dashboard, Default 127.0.0.1:8000)
 *   /song/index  <int>   aktueller Song-Index (0 / -1 = keiner)
 *   /song/reset  1        "gespielt"-Markierungen zuruecksetzen
 * ===========================================================================
 */

function init() {
  script.log("[Setlist Index] bereit. Sendet /song/index an das Dashboard.");
}

// Command-Consequence aus der State Machine: Set Current Song (Index)
function setCurrentSong(index) {
  local.values.currentIndex.set(index);
  local.send("/song/index", index);
  script.log("[Setlist Index] aktueller Song -> " + index);
}

// Optional: aktuellen Song "leeren" (nichts aktiv)
function clearCurrent() {
  local.values.currentIndex.set(-1);
  local.send("/song/index", -1);
  script.log("[Setlist Index] Current geleert");
}

// "Gespielt"-Markierungen im Dashboard zuruecksetzen (auch per Chataigne moeglich)
function resetPlayed() {
  local.send("/song/reset", 1);
  script.log("[Setlist Index] Reset Played gesendet");
}

// Alternativer Weg: Parameter "Current Index Param" per Set-Value gesetzt
function moduleParameterChanged(param) {
  if (param.is(local.parameters.currentIndexParam)) {
    setCurrentSong(local.parameters.currentIndexParam.get());
  }
}
