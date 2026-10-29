// LIBRERIA: MEMORIA PERSISTENTE (version GitHub)
// Uso en el disparador:  memoriaPersistente();
// O con campos propios:  memoriaPersistente(["PISO", "UBICACION"]);

function memoriaPersistente(camposPersonalizados) {
    var e = entry();
    var b = lib();

    var CAMPOS = camposPersonalizados || [
        "ID-SITE",
        "NOMBRE",
        "TIPO",
        "CECO",
        "CIUDAD",
        "ESTADO",
        "PISO",
        "UBICACION"
    ];

    function asDate(val) {
        if (!val) return null;
        if (typeof val.getTime === "function") return new Date(val.getTime());
        if (typeof val === "number") return new Date(val);
        var d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
    }

    function claveOrden(o) {
        try {
            var ct = asDate(o.creationTime);
            if (ct) return ct.getTime();
        } catch (err1) {}
        try {
            var df = asDate(o.field("FECHA"));
            if (df) {
                var d = new Date(df.getFullYear(), df.getMonth(), df.getDate(), 0, 0, 0, 0);
                var dh = asDate(o.field("HORA"));
                if (dh) d.setHours(dh.getHours(), dh.getMinutes(), dh.getSeconds(), 0);
                return d.getTime();
            }
        } catch (err3) {}
        var idn = parseInt(o.id, 10);
        return isNaN(idn) ? -Infinity : idn;
    }

    var todas = b.entries() || [];
    var ultima = null;
    var mejorClave = -Infinity;

    for (var i = 0; i < todas.length; i++) {
        var o = todas[i];
        if (!o) continue;
        if (e.id && o.id === e.id) continue;
        var clave = claveOrden(o);
        if (clave > mejorClave) {
            mejorClave = clave;
            ultima = o;
        }
    }

    if (ultima) {
        for (var j = 0; j < CAMPOS.length; j++) {
            var nombreCampo = CAMPOS[j];
            try {
                var valor = ultima.field(nombreCampo);
                if (valor !== null && valor !== undefined && ("" + valor).trim() !== "") {
                    e.set(nombreCampo, valor);
                }
            } catch (err2) {
                log("Memoria persistente - error en campo " + nombreCampo + ": " + err2);
            }
        }
    }
}
