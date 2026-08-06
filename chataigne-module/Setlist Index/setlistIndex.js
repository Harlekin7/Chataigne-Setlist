/*
 * Setlist Index — Chataigne custom module (slim)
 * ===========================================================================
 * Its job: take the index number of the CURRENT song from the state machine
 * and pass it on to the Setlist Dashboard.
 *
 * Triggering the clips stays with your existing action states. This module
 * only attaches itself to each state as one extra consequence.
 *
 * WIRING IT UP IN THE STATE MACHINE
 *   Consequence type: Command
 *   Target:           Setlist Index  ->  Set Current Song
 *   Index parameter:  this song's fixed index number
 *
 * Alternatively, if you prefer "Set Value": set the parameter
 * "Current Index Param" and it will be reported too.
 *
 * OUTPUT (OSC to the dashboard, default 127.0.0.1:8000)
 *   /song/index  <int>   current song index (0 / -1 = none)
 *   /song/reset  1       clear the "played" marks
 * ===========================================================================
 */

function init() {
  script.log("[Setlist Index] ready. Sending /song/index to the dashboard.");
}

// Command consequence from the state machine: Set Current Song (Index)
function setCurrentSong(index) {
  local.values.currentIndex.set(index);
  local.send("/song/index", index);
  script.log("[Setlist Index] current song -> " + index);
}

// Optional: clear the current song (nothing active)
function clearCurrent() {
  local.values.currentIndex.set(-1);
  local.send("/song/index", -1);
  script.log("[Setlist Index] current cleared");
}

// Clear the "played" marks in the dashboard (also possible from Chataigne)
function resetPlayed() {
  local.send("/song/reset", 1);
  script.log("[Setlist Index] reset played sent");
}

// Alternative route: parameter "Current Index Param" was set via Set Value
function moduleParameterChanged(param) {
  if (param.is(local.parameters.currentIndexParam)) {
    setCurrentSong(local.parameters.currentIndexParam.get());
  }
}
