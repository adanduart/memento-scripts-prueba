// LIBRERIA: VALIDAR PLACA - SC TIENDAS CAPP (version GitHub)
// Uso en el disparador:  validarPlaca();
// Disparadores (fase "Antes de guardar"):
//   - Crear una entrada:      duplicados + clasificacion + tipo de tienda + orden
//   - Actualizar una entrada: duplicados + clasificacion
// Requiere el permiso "Bibliotecas" para leer SC - TIRAJE.
//
// Clasifica cada placa en PLACA TIPO:
//   TIRAJE        -> cae en un tiraje activo del usuario
//   CLIENTE       -> cae en un RANGO LEGADO
//   NO RECONOCIDA -> no cae en ningun rango (requiere doble confirmacion)

function validarPlaca() {
    var e = entry();
    var b = lib();

    // ================= CONFIGURACION =================
    var LIB_TIRAJE = "SC - TIRAJE";
    var CAMPO_SALTO = "SALTO CONFIRMADO";
    var CAMPO_PLACA_TIPO = "PLACA TIPO";
    var CAMPO_TIPO_TIENDA = "TIPO";
    var EST_ACTIVO = "TIRAJE ACTIVO";
    var EST_LEGADO = "RANGO LEGADO";
    // Tipo de tienda -> prefijo de las placas de tiraje que le tocan
    var TIENDAS = [
        { tipo: "TIENDA SC",   prefijo: "",    nombre: "numéricas (ej. 026002)" },
        { tipo: "COSTA COFFE", prefijo: "TCC", nombre: "TCC (ej. TCC000800)" }
    ];
    var MAX_LISTA_SALTO = 10;
    // =================================================

    // ================= HELPERS =================
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

    function dentro(p, r) {
        return p && r && p.pref === r.pref && p.num >= r.ini && p.num <= r.fin;
    }

    // Lee un registro de SC - TIRAJE como rango; el ancho sale de ETIQUETA INICIAL
    function leerRango(reg) {
        var a = leerPlaca(reg.field("ETIQUETA INICIAL"));
        var z = leerPlaca(reg.field("ETIQUETA FINAL"));
        if (!a || !z || a.pref !== z.pref) return null;
        return {
            pref: a.pref, ini: a.num, fin: z.num, ancho: a.ancho,
            estado: up(reg.field("ESTADO TIRAJE")),
            usuario: up(reg.field("USUARIO")),
            reg: reg
        };
    }

    function ponerTipo(v) {
        try { e.set(CAMPO_PLACA_TIPO, v); }
        catch (err) { log("Validar placa - no se pudo escribir " + CAMPO_PLACA_TIPO + ": " + err); }
    }

    function usuarioActual() {
        var u = up(e.field("USUARIO"));
        if (u !== "") return u;
        try {
            if (b.userName) return up(b.userName);
            if (b.user) return up(b.user);
            if (typeof(user) === "function") return up(user());
            return up(currentUser());
        } catch (err) { return ""; }
    }

    function bloquear(texto, titulo) {
        var t = titulo ? titulo : "⚠️ No se puede guardar";
        try {
            dialog()
                .title(t)
                .text(texto)
                .positiveButton("Entendido", function() { return true; })
                .show();
        } catch (errDlg) {
            message(t + "\n" + texto);
        }
        cancel();
        exit();
    }

    function leerSalto(reg) {
        try { return up(reg.field(CAMPO_SALTO)); } catch (err) { return null; }
    }

    function escribirSalto(reg, valor) {
        try { reg.set(CAMPO_SALTO, valor); return true; }
        catch (err) {
            log("Validar placa - no se pudo escribir '" + CAMPO_SALTO + "' en " + LIB_TIRAJE + ": " + err);
            return false;
        }
    }

    // ================= 1. ¿APLICA? =================
    var placaOpc = up(e.field("PLACA?"));
    var serieOpc = up(e.field("SERIE?"));
    var placaAplica = (placaOpc === "SI" || placaOpc === "SIN FOTO");
    var serieAplica = (serieOpc === "SI" || serieOpc === "SIN FOTO");

    if (!placaAplica) ponerTipo("");
    if (!placaAplica && !serieAplica) return;

    // ================= 2. RANGOS DE SC - TIRAJE =================
    var rangos = [];
    if (placaAplica) {
        var controlLib = null;
        try { controlLib = libByName(LIB_TIRAJE); } catch (errLib) { controlLib = null; }
        if (!controlLib) log("Validar placa - no se encontró la biblioteca '" + LIB_TIRAJE + "'");
        var controles = controlLib ? (controlLib.entries() || []) : [];
        for (var c = 0; c < controles.length; c++) {
            if (!controles[c]) continue;
            var rg = leerRango(controles[c]);
            if (rg) rangos.push(rg);
        }
    }

    // ================= 3. NORMALIZAR PLACA =================
    // Se reescribe con el ancho oficial del rango donde cae (15485 -> 000015485)
    var placa = "";
    var p = null;
    if (placaAplica) {
        var original = txt(e.field("PLACA"));
        p = leerPlaca(original);
        if (p) {
            var ancho = p.ancho;
            for (var x = 0; x < rangos.length; x++) {
                if (dentro(p, rangos[x])) { ancho = rangos[x].ancho; break; }
            }
            placa = armar(p.pref, p.num, ancho);
        } else {
            placa = up(original).replace(/\s/g, "");
        }
        if (placa !== "" && placa !== original) e.set("PLACA", placa);
    }
    var serie = serieAplica ? up(e.field("SERIE")) : "";

    // ================= 4. DUPLICADOS + PLACAS USADAS =================
    var todas = b.entries() || [];
    var esNueva = true;
    var usadas = {};

    for (var i = 0; i < todas.length; i++) {
        var o = todas[i];
        if (!o) continue;
        if (e.id && o.id === e.id) { esNueva = false; continue; }

        var opTxt = up(o.field("PLACA")).replace(/\s/g, "");
        if (opTxt !== "") {
            var op = leerPlaca(opTxt);
            if (placa !== "") {
                var mismo = (p && op) ? (clave(p.pref, p.num) === clave(op.pref, op.num))
                                      : (opTxt === placa);
                if (mismo) {
                    bloquear("La PLACA '" + placa + "' ya existe en otro activo.\nNo se puede guardar duplicada.");
                }
            }
            if (op) usadas[clave(op.pref, op.num)] = true;
        }

        if (serie !== "") {
            var os = up(o.field("SERIE"));
            if (os !== "" && os === serie) {
                bloquear("La SERIE '" + serie + "' ya existe en otro activo.\nNo se puede guardar duplicada.");
            }
        }
    }

    if (placa === "") { ponerTipo(""); return; }

    // ================= 5. CLASIFICAR =================
    var yo = usuarioActual();
    var tipoTienda = up(e.field(CAMPO_TIPO_TIENDA));
    var tienda = null;
    for (var t = 0; t < TIENDAS.length; t++) {
        if (up(TIENDAS[t].tipo) === tipoTienda) { tienda = TIENDAS[t]; break; }
    }

    var legado = null, miActivo = null, otroTiraje = null;
    for (var k = 0; k < rangos.length; k++) {
        var r = rangos[k];
        if (!dentro(p, r)) continue;
        if (r.estado === EST_LEGADO) { if (!legado) legado = r; }
        else if (r.estado === EST_ACTIVO && r.usuario === yo) { if (!miActivo) miActivo = r; }
        else { if (!otroTiraje) otroTiraje = r; }
    }
    var esMia = (miActivo !== null || otroTiraje !== null);

    // ---- CLIENTE: sin orden ni aviso ----
    if (!esMia && legado) {
        ponerTipo("CLIENTE");
        return;
    }

    // ---- TIRAJE (etiquetas propias) ----
    if (esMia) {
        if (tienda && p.pref !== tienda.prefijo) {
            bloquear("Esta tienda es " + tienda.tipo + " y usa placas " + tienda.nombre +
                     ".\nLa PLACA '" + placa + "' es de otro tipo de tienda.");
        }

        // Al editar un activo ya capturado no se revisa rango ni orden
        if (!esNueva) { ponerTipo("TIRAJE"); return; }

        if (!miActivo) {
            bloquear("La PLACA '" + placa + "' no pertenece a tu tiraje activo.\n" +
                     "Revisa la etiqueta o activa el tiraje correcto en " + LIB_TIRAJE + ".");
        }

        // ---- Orden con doble confirmacion ----
        var esperada = null;
        for (var n = miActivo.ini; n <= miActivo.fin; n++) {
            if (!usadas[clave(miActivo.pref, n)]) { esperada = n; break; }
        }

        var saltoGuardado = leerSalto(miActivo.reg);

        if (esperada === null || p.num === esperada) {
            if (saltoGuardado) escribirSalto(miActivo.reg, "");
            ponerTipo("TIRAJE");
            return;
        }

        var saltadas = [];
        var totalSaltadas = 0;
        for (var s = esperada; s < p.num; s++) {
            if (!usadas[clave(miActivo.pref, s)]) {
                totalSaltadas++;
                if (saltadas.length < MAX_LISTA_SALTO) saltadas.push(armar(miActivo.pref, s, miActivo.ancho));
            }
        }
        var listaTxt = saltadas.join(", ");
        if (totalSaltadas > saltadas.length) listaTxt += " ... (+" + (totalSaltadas - saltadas.length) + ")";
        var placaEsperada = armar(miActivo.pref, esperada, miActivo.ancho);

        // Segundo intento con la misma placa: confirmado
        if (saltoGuardado !== null && saltoGuardado === placa) {
            escribirSalto(miActivo.reg, "");
            ponerTipo("TIRAJE");
            return;
        }

        if (saltoGuardado === null || !escribirSalto(miActivo.reg, placa)) {
            bloquear("Debes capturar las placas en orden.\nLa siguiente placa esperada es " +
                     placaEsperada + ", no " + placa + ".");
        }

        bloquear("Vas a guardar " + placa + " saltándote " + totalSaltadas +
                 (totalSaltadas === 1 ? " placa" : " placas") + ":\n" + listaTxt +
                 "\n\nQuedarán pendientes y PLACA PROXIMA las seguirá pidiendo." +
                 "\n\nSi es correcto, presiona GUARDAR otra vez con la misma placa." +
                 "\nSi no, escanea " + placaEsperada + ".",
                 "⚠️ Confirmar salto de placas");
    }

    // ---- NO RECONOCIDA ----
    // Al editar un activo que ya se confirmo como no reconocido, no se vuelve a preguntar
    if (!esNueva && up(e.field(CAMPO_PLACA_TIPO)) === "NO RECONOCIDA") return;

    // La confirmacion se anota en el tiraje activo del usuario (de preferencia el de esta tienda)
    var regConf = null;
    for (var q = 0; q < rangos.length; q++) {
        var rq = rangos[q];
        if (rq.estado === EST_ACTIVO && rq.usuario === yo) {
            if (!regConf || (tienda && rq.pref === tienda.prefijo)) regConf = rq;
        }
    }

    var marca = "NR:" + placa;
    if (regConf) {
        var g = leerSalto(regConf.reg);
        if (g !== null && g === marca) {
            escribirSalto(regConf.reg, "");
            ponerTipo("NO RECONOCIDA");
            return;
        }
        if (g !== null && escribirSalto(regConf.reg, marca)) {
            bloquear("La PLACA '" + placa + "' no corresponde a ningún tiraje ni rango del cliente registrado." +
                     "\n\nSi es correcta, presiona GUARDAR otra vez con la misma placa." +
                     "\nSi no, revisa la etiqueta.",
                     "⚠️ Placa no reconocida");
        }
    }

    // Sin tiraje activo donde anotar la confirmacion: se permite con aviso
    message("⚠️ Placa no reconocida: " + placa);
    ponerTipo("NO RECONOCIDA");
}
