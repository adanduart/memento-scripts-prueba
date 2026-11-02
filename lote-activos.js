// LIBRERIA: LOTE DE ACTIVOS - SC TIENDAS CAPP (version GitHub)
// Uso en la accion:  loteActivos();
// Genera N copias de la entrada actual.
// - Con placa: pide rango (numericas o TCC, con o sin ceros). Todo el rango
//   debe caer en UN solo registro de SC - TIRAJE:
//     * tu tiraje activo (de la familia del TIPO de tienda) -> PLACA TIPO = TIRAJE
//     * un RANGO LEGADO del cliente                          -> PLACA TIPO = CLIENTE
//   Si el lote no empieza en la siguiente placa esperada del tiraje, pide confirmacion.
//   Valida duplicados, asigna placas consecutivas, calcula PLACA PROXIMA
//   y marca FALTA FOTO PLACA = PENDIENTE.
//   Si el lote completa el tiraje, lo marca como TIRAJE USADO.
// - Sin placa: pide cantidad y copia el motivo de PLACA INVIABLE POR.
// NOTA: lib().create() NO dispara triggers; todo se llena aqui.
// Requiere el permiso "Bibliotecas" para leer/escribir SC - TIRAJE.

function loteActivos() {
    var origen = entry();
    var b = lib();

    // ================= CONFIGURACION =================
    var MAX_LOTE = 99;        // ID-GRUPOC usa 2 digitos de consecutivo
    var LIB_TIRAJE = "SC - TIRAJE";
    var EST_ACTIVO = "TIRAJE ACTIVO";
    var EST_LEGADO = "RANGO LEGADO";
    var EST_USADO = "TIRAJE USADO";
    var TIENDAS = [
        { tipo: "TIENDA SC",   prefijo: "",    nombre: "numéricas (ej. 026002)" },
        { tipo: "COSTA COFFE", prefijo: "TCC", nombre: "TCC (ej. TCC000800)" }
    ];
    var MAX_LISTA = 10;
    // =================================================

    // ================= HELPERS =================
    function txt(v) { return (v === null || v === undefined) ? "" : ("" + v).trim(); }
    function up(v) { return txt(v).toUpperCase(); }

    function dosDigitos(n) {
        n = "" + n;
        return n.length < 2 ? "0" + n : n;
    }

    function asDate(val) {
        if (!val) return null;
        if (typeof val.getTime === "function") return new Date(val.getTime());
        if (typeof val === "number") return new Date(val);
        var d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
    }

    // Orden real de creacion (no cambia al editar)
    function claveOrden(o) {
        try {
            var ct = asDate(o.creationTime);
            if (ct) return ct.getTime();
        } catch (err1) {}
        var df = asDate(o.field("FECHA"));
        if (df) {
            var d = new Date(df.getFullYear(), df.getMonth(), df.getDate(), 0, 0, 0, 0);
            var dh = asDate(o.field("HORA"));
            if (dh) d.setHours(dh.getHours(), dh.getMinutes(), dh.getSeconds(), 0);
            return d.getTime();
        }
        var idn = parseInt(o.id, 10);
        return isNaN(idn) ? -Infinity : idn;
    }

    function obtenerUsuario() {
        var n = "";
        try { n = txt(system().user); } catch (err2) { n = ""; }
        if (n === "") {
            try {
                var u = user();
                if (u) n = u.username ? txt(u.username) : txt(u);
            } catch (err3) { n = ""; }
        }
        if (n === "" || n.toLowerCase() === "null" || n.toLowerCase() === "undefined") n = "SIN IDENTIFICAR";
        return n;
    }

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

    // Rango de un registro de SC - TIRAJE; el ancho sale de ETIQUETA INICIAL
    function leerRango(reg) {
        var a = leerPlaca(reg.field("ETIQUETA INICIAL"));
        var z = leerPlaca(reg.field("ETIQUETA FINAL"));
        if (!a || !z || a.pref !== z.pref || z.num < a.num) return null;
        return {
            pref: a.pref, ini: a.num, fin: z.num, ancho: a.ancho,
            estado: up(reg.field("ESTADO TIRAJE")),
            usuario: up(reg.field("USUARIO")),
            reg: reg
        };
    }

    function listaCorta(arr) {
        var s = arr.slice(0, MAX_LISTA).join(", ");
        if (arr.length > MAX_LISTA) s += " ... (+" + (arr.length - MAX_LISTA) + ")";
        return s;
    }

    // Agrega al objeto solo si el valor no esta vacio
    function poner(obj, campo, valor) {
        if (valor === null || valor === undefined) return;
        if (txt(valor) === "" || txt(valor) === "[]") return;
        obj[campo] = valor;
    }

    // Una sola vuelta a la biblioteca: ultima entrada + placas existentes
    function escanearBiblioteca() {
        var todas = b.entries() || [];
        var ultima = null;
        var mejor = -Infinity;
        var usadas = {};
        for (var k = 0; k < todas.length; k++) {
            var o = todas[k];
            if (!o) continue;
            var p = leerPlaca(o.field("PLACA"));
            if (p) usadas[clave(p.pref, p.num)] = true;
            var c = claveOrden(o);
            if (c > mejor) { mejor = c; ultima = o; }
        }
        return { ultima: ultima, usadas: usadas };
    }

    // ================= DATOS DE LA ENTRADA ORIGEN =================
    var placaOpc = up(origen.field("PLACA?"));
    var serieOpc = up(origen.field("SERIE?"));
    var conPlaca = (placaOpc !== "NO");
    var nombre = obtenerUsuario();
    var YO = up(nombre);

    // ================= VALIDAR RANGO CON PLACA =================
    // Devuelve el plan del lote, o null (despues de avisar)
    function prepararConPlaca(txtIni, txtFin) {
        var pi = leerPlaca(txtIni);
        var pf = leerPlaca(txtFin);
        if (!pi || !pf) {
            message("❌ Placa no válida.\nEjemplos: 026002, 15485, TCC000800.");
            return null;
        }
        if (pi.pref !== pf.pref) {
            message("❌ La placa inicial y la final deben ser del mismo tipo (numéricas o TCC).");
            return null;
        }
        if (pf.num < pi.num) {
            message("❌ La placa final es menor que la inicial.");
            return null;
        }
        var cant = pf.num - pi.num + 1;
        if (cant > MAX_LOTE) {
            message("❌ Máximo " + MAX_LOTE + " placas por corrida. Divide el rango.");
            return null;
        }

        var controlLib = null;
        try { controlLib = libByName(LIB_TIRAJE); } catch (errLib) { controlLib = null; }
        if (!controlLib) {
            message("❌ No se encontró la biblioteca " + LIB_TIRAJE + ".\nRevisa el permiso Bibliotecas.");
            return null;
        }

        // Registro que contiene la placa inicial (prioridad: legado o mi tiraje activo)
        var controles = controlLib.entries() || [];
        var rango = null;
        for (var c = 0; c < controles.length; c++) {
            if (!controles[c]) continue;
            var r = leerRango(controles[c]);
            if (!r) continue;
            if (r.pref !== pi.pref || pi.num < r.ini || pi.num > r.fin) continue;
            if (r.estado === EST_LEGADO) { rango = r; break; }
            if (r.estado === EST_ACTIVO && r.usuario === YO) { rango = r; break; }
            if (!rango) rango = r;
        }

        if (!rango) {
            message("❌ El rango no corresponde a ningún tiraje ni rango del cliente registrado en " +
                    LIB_TIRAJE + ".\nNo se creó ninguna entrada.");
            return null;
        }
        if (rango.estado !== EST_LEGADO && !(rango.estado === EST_ACTIVO && rango.usuario === YO)) {
            message("❌ Las placas no pertenecen a tu tiraje activo.\nRevisa el rango o activa el tiraje correcto.");
            return null;
        }
        if (pf.num > rango.fin) {
            message("❌ El rango se sale del registrado (" + armar(rango.pref, rango.ini, rango.ancho) +
                    " a " + armar(rango.pref, rango.fin, rango.ancho) + ").\nNo se creó ninguna entrada.");
            return null;
        }

        var esTiraje = (rango.estado !== EST_LEGADO);

        // Tipo de tienda (solo para tus etiquetas)
        if (esTiraje) {
            var tipoTienda = up(origen.field("TIPO"));
            for (var t = 0; t < TIENDAS.length; t++) {
                if (up(TIENDAS[t].tipo) === tipoTienda && pi.pref !== TIENDAS[t].prefijo) {
                    message("❌ Esta tienda es " + TIENDAS[t].tipo + " y usa placas " + TIENDAS[t].nombre + ".");
                    return null;
                }
            }
        }

        // Duplicados ANTES de crear
        var scan = escanearBiblioteca();
        var repetidas = [];
        for (var n = pi.num; n <= pf.num; n++) {
            if (scan.usadas[clave(pi.pref, n)]) repetidas.push(armar(pi.pref, n, rango.ancho));
        }
        if (repetidas.length > 0) {
            message("❌ Placas ya capturadas en la biblioteca:\n" + listaCorta(repetidas) +
                    "\n\nNo se creó ninguna entrada. Corrige el rango.");
            return null;
        }

        var plan = {
            cant: cant, ini: pi.num, pref: pi.pref, ancho: rango.ancho,
            rango: rango, esTiraje: esTiraje, scan: scan,
            esperada: null, saltadas: []
        };

        // Orden: siguiente placa esperada del tiraje
        if (esTiraje) {
            for (var q = rango.ini; q <= rango.fin; q++) {
                if (!scan.usadas[clave(rango.pref, q)]) { plan.esperada = q; break; }
            }
            if (plan.esperada !== null && pi.num > plan.esperada) {
                for (var s = plan.esperada; s < pi.num; s++) {
                    if (!scan.usadas[clave(rango.pref, s)]) plan.saltadas.push(armar(rango.pref, s, rango.ancho));
                }
            }
        }
        return plan;
    }

    // Siguiente placa libre del tiraje despues de asignar i copias del lote
    function proximaTras(plan, i) {
        var finLote = plan.ini + i - 1;
        for (var n = plan.rango.ini; n <= plan.rango.fin; n++) {
            if (plan.scan.usadas[clave(plan.pref, n)]) continue;
            if (n >= plan.ini && n <= finLote) continue;
            return armar(plan.pref, n, plan.ancho);
        }
        return "";
    }

    // ================= GENERADOR =================
    // plan = resultado de prepararConPlaca (con placa) o null (sin placa)
    function generarLote(cantidad, plan) {

        var scan = plan ? plan.scan : escanearBiblioteca();

        // ---- Usuario e iniciales para ID-GRUPOC (mismo formato que antes) ----
        var soloLetras = nombre.replace(/[^a-zA-Z]/g, "");
        var iniciales = soloLetras.substring(0, 2).toUpperCase();
        if (iniciales.length < 2) iniciales = (iniciales + "XX").substring(0, 2);

        var ahora = new Date();
        var sello = dosDigitos(ahora.getDate()) + dosDigitos(ahora.getHours()) +
                    dosDigitos(ahora.getMinutes()) + dosDigitos(ahora.getSeconds());

        // ---- Memoria persistente: PISO y UBICACION de la ultima entrada ----
        var fuenteUbi = scan.ultima ? scan.ultima : origen;
        var piso = fuenteUbi.field("PISO");
        var ubicacion = fuenteUbi.field("UBICACION");

        var creados = 0;
        var errores = 0;

        for (var i = 1; i <= cantidad; i++) {
            try {
                var n = {};

                // Control
                n["USUARIO"] = nombre;
                n["FECHA"] = ahora;
                n["HORA"] = ahora;
                n["ID-GRUPOC"] = iniciales + sello + dosDigitos(i);

                // Datos de la tienda (del activo origen)
                poner(n, "ID-SITE", origen.field("ID-SITE"));
                poner(n, "NOMBRE", origen.field("NOMBRE"));
                poner(n, "TIPO", origen.field("TIPO"));
                poner(n, "CECO", origen.field("CECO"));
                poner(n, "CIUDAD", origen.field("CIUDAD"));
                poner(n, "ESTADO", origen.field("ESTADO"));
                poner(n, "CLIENTE", origen.field("CLIENTE"));

                // Ubicacion
                poner(n, "PISO", piso);
                poner(n, "UBICACION", ubicacion);

                // Datos heredados del activo origen
                poner(n, "ID CATALOGO", origen.field("ID CATALOGO"));
                poner(n, "DESCRIPCION 1", origen.field("DESCRIPCION 1"));
                poner(n, "DESCRIPCION 2", origen.field("DESCRIPCION 2"));
                poner(n, "MARCA?", origen.field("MARCA?"));
                poner(n, "MARCA", origen.field("MARCA"));
                poner(n, "MODELO?", origen.field("MODELO?"));
                poner(n, "MODELO", origen.field("MODELO"));
                poner(n, "CONDICION", origen.field("CONDICION"));
                poner(n, "ESTATUS DE PLACA", origen.field("ESTATUS DE PLACA"));
                poner(n, "PANORAMICA 1", origen.field("PANORAMICA 1"));
                poner(n, "PANORAMICA 2", origen.field("PANORAMICA 2"));
                poner(n, "PANORAMICA 3", origen.field("PANORAMICA 3"));
                poner(n, "PANORAMICA 4", origen.field("PANORAMICA 4"));
                poner(n, "PANORAMICA 5", origen.field("PANORAMICA 5"));
                poner(n, "PANORAMICA 6", origen.field("PANORAMICA 6"));

                // ---- PLACA ----
                if (plan) {
                    n["PLACA?"] = "SI";
                    n["PLACA"] = armar(plan.pref, plan.ini + (i - 1), plan.ancho);
                    n["FALTA FOTO PLACA"] = "PENDIENTE";
                    n["PLACA TIPO"] = plan.esTiraje ? "TIRAJE" : "CLIENTE";
                    if (plan.esTiraje) poner(n, "PLACA PROXIMA", proximaTras(plan, i));
                    else poner(n, "PLACA PROXIMA", origen.field("PLACA PROXIMA"));
                } else {
                    poner(n, "PLACA?", origen.field("PLACA?"));
                    poner(n, "PLACA INVIABLE POR", origen.field("PLACA INVIABLE POR"));
                    poner(n, "PLACA PROXIMA", origen.field("PLACA PROXIMA"));
                }

                // ---- SERIE ----
                // NO: se hereda el NO con su motivo.
                // SI / SIN FOTO: se deja en blanco para capturar cada serie.
                if (serieOpc === "NO") {
                    poner(n, "SERIE?", origen.field("SERIE?"));
                    poner(n, "SERIE INVIABLE POR", origen.field("SERIE INVIABLE POR"));
                }

                b.create(n);
                creados++;
            } catch (errCreate) {
                errores++;
                log("Lote - error creando copia " + i + ": " + errCreate);
            }
        }

        // ---- Si el lote completo el tiraje, marcarlo como USADO ----
        var avisoTiraje = "";
        if (plan && plan.esTiraje && errores === 0 && proximaTras(plan, cantidad) === "") {
            try {
                plan.rango.reg.set("ESTADO TIRAJE", EST_USADO);
                avisoTiraje = "\n✅ Tiraje completado y marcado como USADO.";
            } catch (errUsado) {
                log("Lote - no se pudo marcar el tiraje como usado: " + errUsado);
            }
        }

        var detalle = "";
        if (plan) {
            detalle = "\nPlacas: " + armar(plan.pref, plan.ini, plan.ancho) + " a " +
                      armar(plan.pref, plan.ini + cantidad - 1, plan.ancho) +
                      " (" + (plan.esTiraje ? "TIRAJE" : "CLIENTE") + ")";
        }
        message("✅ Lote generado (" + (plan ? "con placa" : "sin placa") + ")" +
                detalle + "\nCreados: " + creados + "\nErrores: " + errores + avisoTiraje);
        return true;
    }

    // ================= DIALOGOS =================
    if (conPlaca) {
        var layoutB = ui().layout([
            ui().text("ESTE ACTIVO TIENE PLACA").font({ size: 20, style: "bold" }),
            ui().text("").height(16),
            ui().text("Placa inicial (ej. 026002, 15485 o TCC000800):").font({ size: 17 }),
            ui().edit("").tag("placaIni"),
            ui().text("Placa final (ej. 026030, 15500 o TCC000820):").font({ size: 17 }),
            ui().edit("").tag("placaFin")
        ]);

        dialog()
            .view(layoutB)
            .positiveButton("Generar lote", function() {
                var plan = prepararConPlaca(ui().findByTag("placaIni").text,
                                            ui().findByTag("placaFin").text);
                if (!plan) return false;

                // Salto de placas: pedir confirmacion
                if (plan.saltadas.length > 0) {
                    var esperada = armar(plan.pref, plan.esperada, plan.ancho);
                    var total = plan.saltadas.length;
                    dialog()
                        .title("⚠️ Confirmar salto de placas")
                        .text("El lote empieza en " + armar(plan.pref, plan.ini, plan.ancho) +
                              ", pero la siguiente placa esperada es " + esperada + ".\n\n" +
                              "Te saltarías " + total + (total === 1 ? " placa" : " placas") + ":\n" +
                              listaCorta(plan.saltadas) +
                              "\n\nQuedarán pendientes y PLACA PROXIMA las seguirá pidiendo." +
                              "\n¿Generar el lote de todos modos?")
                        .positiveButton("Generar", function() { generarLote(plan.cant, plan); return true; })
                        .negativeButton("Cancelar", function() { return true; })
                        .show();
                    return true;
                }

                return generarLote(plan.cant, plan);
            })
            .negativeButton("Cancelar", function() { return true; })
            .autoDismiss(false)
            .show();
    } else {
        var layoutA = ui().layout([
            ui().text("ESTE ACTIVO NO TIENE PLACA").font({ size: 20, style: "bold" }),
            ui().text("").height(16),
            ui().text("Cantidad de copias a generar:").font({ size: 17 }),
            ui().edit("").tag("cantidad")
        ]);

        dialog()
            .view(layoutA)
            .positiveButton("Generar lote", function() {
                var cant = parseInt(("" + ui().findByTag("cantidad").text).replace(/[^0-9]/g, ""), 10);
                if (isNaN(cant) || cant < 1) {
                    message("❌ Cantidad no válida.");
                    return false;
                }
                if (cant > MAX_LOTE) {
                    message("❌ Máximo " + MAX_LOTE + " copias por corrida.");
                    return false;
                }
                return generarLote(cant, null);
            })
            .negativeButton("Cancelar", function() { return true; })
            .autoDismiss(false)
            .show();
    }
}
