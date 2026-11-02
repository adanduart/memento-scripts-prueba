// LIBRERIA: QUITAR CANDADO FOTO PLACA (version GitHub)
// Uso en el disparador:  quitarCandadoFotoPlaca();
// Si FALTA FOTO PLACA = PENDIENTE y ya existe foto en PLACA FOTO,
// libera el candado vaciando FALTA FOTO PLACA.

function quitarCandadoFotoPlaca() {
    var e = entry();

    // Devuelve true solo si el campo imagen tiene al menos una foto real
    function tieneImagen(val) {
        if (val === null || val === undefined) return false;

        // Lista de Java (size) o arreglo de JavaScript (length)
        try {
            if (typeof val.size === "function") return val.size() > 0;
        } catch (err1) {}
        try {
            if (val.length !== undefined && typeof val !== "string") return val.length > 0;
        } catch (err2) {}

        // Respaldo por texto
        var s = ("" + val).trim();
        if (s === "" || s === "[]" || s.toLowerCase() === "null") return false;
        return true;
    }

    var faltaFoto = ("" + e.field("FALTA FOTO PLACA")).trim().toUpperCase();

    if (faltaFoto === "PENDIENTE" && tieneImagen(e.field("PLACA FOTO"))) {
        try {
            e.set("FALTA FOTO PLACA", null);
        } catch (err3) {
            try {
                e.set("FALTA FOTO PLACA", "");
            } catch (err4) {
                log("Quitar candado - no se pudo vaciar FALTA FOTO PLACA: " + err4);
            }
        }
    }
}
