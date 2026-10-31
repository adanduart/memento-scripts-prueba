// LIBRERIA: USUARIO (version GitHub)
// Uso en el disparador:  ponerUsuario();
// O con otro campo:      ponerUsuario("CAPTURISTA");

function ponerUsuario(nombreCampo) {
    var e = entry();
    var b = lib();
    var campo = nombreCampo || "USUARIO";
    var nombre = "";

    try {
        if (b.userName) { nombre = b.userName; }
        else if (b.user) { nombre = b.user; }
        else if (typeof(user) === "function") { nombre = user(); }
        else { nombre = currentUser(); }
    } catch (err1) {
        nombre = "";
    }

    if (!nombre || ("" + nombre).trim() === "") {
        try { nombre = b.userEmail; } catch (err2) { nombre = ""; }
    }

    if (!nombre || ("" + nombre).trim() === "") {
        nombre = "SIN IDENTIFICAR";
    }

    try {
        e.set(campo, "" + nombre);
    } catch (err3) {
        log("Usuario - error al escribir en " + campo + ": " + err3);
    }
}
