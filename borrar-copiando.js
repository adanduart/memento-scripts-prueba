// LIBRERIA: BORRAR COPIANDO (version GitHub)
// Borra los datos unicos de cada activo al copiar una entrada.
// No depende de botones de opcion (llegan vacios en la fase
// "Abriendo tarjeta de edicion").
//
// Uso en el disparador:  borrarCopiando();
// O con listas propias:
//   borrarCopiando(["PLACA", "SERIE"], ["PLACA FOTO"]);

function borrarCopiando(listaTexto, listaImagen) {
    var e = entry();

    // Campos de texto / codigo de barras que se vacian
    var camposTexto = listaTexto || [
        "PLACA",
        "SERIE",
        "OBSERVACIONES"
    ];

    // Campos de imagen que se vacian
    // (las panoramicas NO van aqui: son de la ubicacion)
    var camposImagen = listaImagen || [
        "PLACA FOTO",
        "SERIE FOTO"
    ];

    for (var i = 0; i < camposTexto.length; i++) {
        try {
            e.set(camposTexto[i], "");
        } catch (err1) {
            log("Borrar copiando - error en texto '" + camposTexto[i] + "': " + err1);
        }
    }

    for (var j = 0; j < camposImagen.length; j++) {
        try {
            e.set(camposImagen[j], null);
        } catch (err2) {
            log("Borrar copiando - error en imagen '" + camposImagen[j] + "': " + err2);
        }
    }
}
