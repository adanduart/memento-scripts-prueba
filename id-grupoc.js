// LIBRERIA: ID-GRUPOC (version GitHub)
// Uso en el disparador:  ponerIdGrupoc();
// Arma ID-GRUPOC = iniciales del usuario + dia + hora + minuto + segundo
// Ej: aduart, dia 29 a las 16:02:12 -> AD29160212

function ponerIdGrupoc() {
    var e = entry();
    var b = lib();
    var nombre = "";

    if (b.userName) { nombre = b.userName; }
    else if (b.user) { nombre = b.user; }
    else if (typeof(user) === 'function') { nombre = user(); }
    else {
        try { nombre = currentUser(); } catch (e2) { nombre = ""; }
    }
    if (!nombre || nombre == "") {
        try { nombre = b.userEmail; } catch (e3) { nombre = ""; }
    }
    if (!nombre || nombre == "") {
        var yaGuardado = e.field("USUARIO");
        if (yaGuardado) { nombre = "" + yaGuardado; }
    }

    var soloLetras = ("" + nombre).replace(/[^a-zA-Z]/g, "");
    var iniciales = soloLetras.substring(0, 2).toUpperCase();
    if (iniciales.length < 2) {
        iniciales = (iniciales + "XX").substring(0, 2);
    }

    var ahora = new Date();

    function dosDigitos(n) {
        n = "" + n;
        return n.length < 2 ? "0" + n : n;
    }

    var dia = dosDigitos(ahora.getDate());
    var hora = dosDigitos(ahora.getHours());
    var minuto = dosDigitos(ahora.getMinutes());
    var segundo = dosDigitos(ahora.getSeconds());

    e.set("ID-GRUPOC", iniciales + dia + hora + minuto + segundo);
}
