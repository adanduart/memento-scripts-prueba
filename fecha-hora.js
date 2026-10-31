// LIBRERIA: ACTUALIZAR FECHA Y HORA (version GitHub)
// Uso en el disparador:  actualizarFechaHora();
// O con otros campos:    actualizarFechaHora("F CAPTURA", "H CAPTURA");

function actualizarFechaHora(campoFecha, campoHora) {
    var e = entry();
    var ahora = new Date();
    var cFecha = campoFecha || "FECHA";
    var cHora = campoHora || "HORA";

    try {
        e.set(cFecha, ahora);
    } catch (err1) {
        log("Error actualizando " + cFecha + ": " + err1);
    }

    try {
        e.set(cHora, ahora);
    } catch (err2) {
        log("Error actualizando " + cHora + ": " + err2);
    }
}
