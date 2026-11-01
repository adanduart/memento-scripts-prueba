// LIBRERIA: MARCAR TIRAJE - SC TIENDAS CAPP (version GitHub)
// Uso en el disparador:  marcarTiraje();
// Mismo script para dos triggers (Despues de guardar):
//   - Crear entrada
//   - Actualizar entrada (cubre lotes que consumieron el final del rango)
// Si todas las placas del tiraje activo DEL USUARIO, de la misma familia
// que la placa guardada (numerica o TCC), ya estan capturadas,
// lo marca como TIRAJE USADO.
// Requiere el permiso "Bibliotecas" para escribir en SC - TIRAJE.

function marcarTiraje() {
    var e = entry();
    var b = lib();

    // ================= CONFIGURACION =================
    var LIB_TIRAJE = "SC - TIRAJE";
    var EST_ACTIVO = "TIRAJE ACTIVO";
    var EST_USADO = "TIRAJE USADO";
    // =================================================

    function txt(v) { return (v === null || v === undefined) ? "" : ("" + v).trim(); }
    function up(v) { return txt(v).toUpperCase(); }

    // "tcc 85" -> {pref:"TCC", num:85, ancho:2}
    // "026050" -> {pref:"",    num:26050, ancho:6}
    function leerPlaca(t) {
        var s = up(t).replace(/\s/g, "");
        var m = s.match(/^([A-Z]*)(\d+)$/);
        if (!m) return null;
        return { pref: m[1], num: parseInt(m[2], 10), ancho: m[2].length };
    }

    function armar(pref, num, ancho) {
        var s = "" + num;
        while (s.length < ancho) s = "0" + s;
        return pref + s;
    }

    function clave(pref, num) { return pref + "|" + num; }

    // Misma forma que el widget de tiraje (que escribe USUARIO en SC - TIRAJE)
    function obtenerUsuario() {
        var n = "";
        try { n = txt(system().user); } catch (err1) { n = ""; }
        if (n === "") {
            try {
                var u = user();
                if (u) n = u.username ? txt(u.username) : txt(u);
            } catch (err2) { n = ""; }
        }
        if (n === "" || n.toLowerCase() === "null" || n.toLowerCase() === "undefined") {
            n = txt(e.field("USUARIO"));
        }
        return n;
    }

    // ---- ¿Lleva placa? ----
    var placaOpc = up(e.field("PLACA?"));
    if (placaOpc !== "SI" && placaOpc !== "SIN FOTO") return;

    var p = leerPlaca(e.field("PLACA"));
    if (!p) return;

    var yo = up(obtenerUsuario());
    if (yo === "") {
        log("Marcar tiraje - no se pudo identificar al usuario");
        return;
    }

    var controlLib = null;
    try { controlLib = libByName(LIB_TIRAJE); } catch (errLib) { controlLib = null; }
    if (!controlLib) {
        log("Marcar tiraje - no se encontró la biblioteca '" + LIB_TIRAJE + "'");
        return;
    }

    // ---- Tiraje activo del usuario que contiene esta placa ----
    var controles = controlLib.entries() || [];
    var activo = null;
    var rango = null;
    for (var k = 0; k < controles.length; k++) {
        var c = controles[k];
        if (!c) continue;
        if (up(c.field("ESTADO TIRAJE")) !== EST_ACTIVO) continue;
        if (up(c.field("USUARIO")) !== yo) continue;
        var a = leerPlaca(c.field("ETIQUETA INICIAL"));
        var z = leerPlaca(c.field("ETIQUETA FINAL"));
        if (!a || !z || a.pref !== z.pref || z.num < a.num) continue;
        if (p.pref === a.pref && p.num >= a.num && p.num <= z.num) {
            activo = c;
            rango = { pref: a.pref, ini: a.num, fin: z.num, ancho: a.ancho };
            break;
        }
    }
    // Placa del cliente, no reconocida o fuera de mis tirajes: no se hace nada
    if (!activo) return;

    // ---- Placas usadas en esta biblioteca ----
    var usadas = {};
    usadas[clave(p.pref, p.num)] = true;   // la entrada actual cuenta siempre

    var todas = b.entries() || [];
    for (var i = 0; i < todas.length; i++) {
        var o = todas[i];
        if (!o) continue;
        var op = leerPlaca(o.field("PLACA"));
        if (op) usadas[clave(op.pref, op.num)] = true;
    }

    // ---- Revisar si el rango esta completo ----
    for (var n = rango.ini; n <= rango.fin; n++) {
        if (!usadas[clave(rango.pref, n)]) return; // falta al menos una
    }

    // ---- Completo: marcar como usado ----
    var tirajeIni = armar(rango.pref, rango.ini, rango.ancho);
    var tirajeFin = armar(rango.pref, rango.fin, rango.ancho);

    try {
        activo.set("ESTADO TIRAJE", EST_USADO);
    } catch (errSet) {
        log("Marcar tiraje - no se pudo cambiar el estado: " + errSet);
        return;
    }

    try {
        notification()
            .id(9001)
            .title("✅ Tiraje completado")
            .text("Rango " + tirajeIni + " a " + tirajeFin + " completado")
            .bigText("El tiraje de placas " + tirajeIni + " a " + tirajeFin +
                     " se completó. Se marcó como TIRAJE USADO, sin borrar el histórico.")
            .show();
    } catch (errNot) {
        log("Marcar tiraje - notificación no disponible: " + errNot);
    }
}
