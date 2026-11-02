// LIBRERIA: PLACA PROXIMA - SC TIENDAS CAPP (version GitHub)
// Uso en el disparador:  calcularPlacaProxima();
// Al abrir la tarjeta de una entrada nueva (o copia), escribe en
// PLACA PROXIMA la siguiente placa libre del tiraje activo DEL USUARIO.
// Misma logica que el WIDGET de tiraje y el LOTE: primera placa del rango
// que no exista en la biblioteca.
// - Si el usuario tiene tiraje numerico y TCC activos, usa el TIPO de tienda:
//     TIENDA SC -> numerico ; COSTA COFFE -> TCC
//   Si TIPO esta vacio, muestra ambas (ej. "026150 / TCC000851").

function calcularPlacaProxima() {
    var e = entry();
    var b = lib();

    // ================= CONFIGURACION =================
    var LIB_TIRAJE = "SC - TIRAJE";
    var TIENDAS = [
        { tipo: "TIENDA SC",   prefijo: "" },
        { tipo: "COSTA COFFE", prefijo: "TCC" }
    ];
    var MOSTRAR_AVISOS = true;   // false = dejar vacio cuando no hay placa sugerida
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

    // Misma forma de identificar al usuario que el widget de tiraje
    function obtenerUsuario() {
        var n = "";
        try { n = txt(system().user); } catch (err1) { n = ""; }
        if (n === "") {
            try {
                var u = user();
                if (u) n = u.username ? txt(u.username) : txt(u);
            } catch (err2) { n = ""; }
        }
        if (n === "" || n.toLowerCase() === "null" || n.toLowerCase() === "undefined") n = "";
        return n;
    }

    function escribir(valor, esAviso) {
        if (esAviso && !MOSTRAR_AVISOS) valor = "";
        try {
            e.set("PLACA PROXIMA", valor);
        } catch (errSet) {
            log("Placa proxima - no se pudo escribir: " + errSet);
        }
    }

    var yo = up(obtenerUsuario());
    if (yo === "") {
        escribir("USUARIO NO IDENTIFICADO", true);
        return;
    }

    var controlLib = null;
    try { controlLib = libByName(LIB_TIRAJE); } catch (errLib) { controlLib = null; }
    if (!controlLib) {
        log("Placa proxima - no se encontró la biblioteca '" + LIB_TIRAJE + "'");
        escribir("", false);
        return;
    }

    // ---- Familia segun el TIPO de tienda (null = no se sabe) ----
    var tipoTienda = up(e.field("TIPO"));
    var famPref = null;
    for (var t = 0; t < TIENDAS.length; t++) {
        if (up(TIENDAS[t].tipo) === tipoTienda) { famPref = TIENDAS[t].prefijo; break; }
    }

    // ---- Tirajes activos / pausados DEL USUARIO ----
    var controles = controlLib.entries() || [];
    var activos = [];
    var pausadoPorFamilia = {};
    var hayPausado = false;
    for (var k = 0; k < controles.length; k++) {
        var c = controles[k];
        if (!c) continue;
        if (up(c.field("USUARIO")) !== yo) continue;   // tiraje de otro usuario: se ignora
        var a = leerPlaca(c.field("ETIQUETA INICIAL"));
        var z = leerPlaca(c.field("ETIQUETA FINAL"));
        if (!a || !z || a.pref !== z.pref || z.num < a.num) continue;
        var est = up(c.field("ESTADO TIRAJE"));
        if (est === "TIRAJE ACTIVO") {
            activos.push({ pref: a.pref, ini: a.num, fin: z.num, ancho: a.ancho });
        } else if (est === "TIRAJE PAUSADO") {
            pausadoPorFamilia[a.pref] = true;
            hayPausado = true;
        }
    }

    // ---- Candidatos: uno por familia (el primero que aparezca) ----
    var candidatos = [];
    var visto = {};
    for (var x = 0; x < activos.length; x++) {
        var r = activos[x];
        if (famPref !== null && r.pref !== famPref) continue;
        if (visto[r.pref]) continue;
        visto[r.pref] = true;
        candidatos.push(r);
    }

    if (candidatos.length === 0) {
        var pausado = (famPref !== null) ? pausadoPorFamilia[famPref] : hayPausado;
        if (pausado) escribir("TIRAJE PAUSADO - SIN ORDEN", true);
        else escribir("SIN TIRAJE ACTIVO", true);
        return;
    }

    // ---- Placas usadas (sin contar la entrada actual) ----
    var usadas = {};
    var todas = b.entries() || [];
    for (var i = 0; i < todas.length; i++) {
        var o = todas[i];
        if (!o) continue;
        if (e.id && o.id === e.id) continue;
        var p = leerPlaca(o.field("PLACA"));
        if (p) usadas[clave(p.pref, p.num)] = true;
    }

    // ---- Primera libre de cada rango ----
    var libres = [];
    for (var q = 0; q < candidatos.length; q++) {
        var cr = candidatos[q];
        for (var n = cr.ini; n <= cr.fin; n++) {
            if (!usadas[clave(cr.pref, n)]) {
                libres.push(armar(cr.pref, n, cr.ancho));
                break;
            }
        }
    }

    if (libres.length === 0) {
        escribir("TIRAJE COMPLETO - ACTIVA OTRO BLOQUE", true);
        return;
    }

    escribir(libres.join(" / "), false);
}
