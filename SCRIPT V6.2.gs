// --- CÓDIGO.GS (Google Apps Script) — Carol Q ---
// v6.2: v6.1 + descuento VIP ignora pedidos cancelados, ID de producto en Ventas y encabezados flexibles.
//
// QUÉ CAMBIÓ EN v6.2
//  • Un pedido "Cancelado" ya NO cuenta para el descuento de bienvenida ni para las recompensas por amiga.
//  • "Ventas" guarda el ID del producto (columna "ID Producto"); al cancelar, el stock se devuelve por ID
//    (aunque renombren el producto). Pedidos viejos sin ID se siguen buscando por nombre y variante.
//  • Reconoce los encabezados actuales del Sheet ("Categoría", "Calle, número exterior/interior",
//    "Municipio / Alcaldía *", "Referencias o punto de encuentro"). Se quitaron las 2 columnas de
//    sublimación que ya no se usan.
//  • El catálogo limpia espacios sobrantes en nombre, variante y foto.
//  • Incluye probarCorreoAdmin() para probar el correo sin hacer un pedido.
//  (v6.1: emojis del correo como entidades HTML; asunto con emojis simples ✅ ⚠️ ⏳.)
//
// CÓMO INSTALARLO
//  1) En Apps Script borra TODO el contenido de Código.gs y pega este archivo completo.
//  2) Propiedades del script: PAYPAL_CLIENT_ID debe ser el mismo client-id que está en index.html y
//     PAYPAL_CLIENT_SECRET el Secret LIVE de ESA misma app de PayPal.
//  3) Guarda y ve a Implementar > Administrar implementaciones > (lápiz) > Nueva versión > Implementar.
//  4) Ejecuta diagnostico() y lee el registro (Ver > Registros).
//
// (Si es tu primera instalación) Propiedades de la secuencia de comandos:
//       PAYPAL_CLIENT_ID     = el client-id que está en index.html
//       PAYPAL_CLIENT_SECRET = el "Secret" de tu app LIVE en developer.paypal.com
//  y ejecuta instalarDisparadores() y diagnostico().

// ============================================================
// 1. CONFIGURACIÓN
// ============================================================

var ADMIN_EMAIL = "carolqvirtual@gmail.com";     // recibe el correo semáforo de cada pedido
var SHIPPING_COST_PAQUETERIA = 99;               // igual que en index.html
var FREE_SHIPPING_THRESHOLD = 549;               // igual que en index.html
var VIP_MIN_COMPRA_ = 999;
var PAYPAL_API_ = "https://api-m.paypal.com";
var MAX_ITEMS_ = 30;
var MAX_QTY_ = 20;
var ENTREGA_LABELS_ = {
  courier: "Envío Foráneo / Paquetería",
  onDemand: "Envío Express por Uber / Didi Flash",
  pickup: "Punto Acordado (Tlalnepantla / Nicolás Romero)"
};
var BLANCOS_SHEET_NAME = "Blancos Personalizables";

// Definición de columnas: [CLAVE, alias de encabezado aceptados...]. La POSICIÓN en la lista es la
// columna original y solo se usa como respaldo si el encabezado no se encuentra.
var DEF_HOJA1 = [
  ["ID", "id"], ["PRODUCTO", "producto"],
  ["VARIANTE", "variante / opcion", "variante/opcion", "variante", "opcion"],
  ["DEPARTAMENTO", "departamento"], ["SUBCATEGORIA", "subcategoria"], ["PRECIO", "precio"],
  ["ESTADO", "estado"], ["BADGE", "badge"], ["DESCRIPCION", "descripcion"],
  ["FOTO", "foto url", "foto", "imagen"], ["NOTAS", "notas/recordatorio de stock", "notas"],
  ["STOCK", "stock"]
];
var DEF_VENTAS = [
  ["FECHA", "fecha y hora", "fecha"], ["FOLIO", "folio"], ["CLIENTE", "cliente"], ["WHATSAPP", "whatsapp"],
  ["CORREO", "correo"], ["COMUNIDAD_VIP", "comunidad vip"], ["ZONA", "municipio / zona", "zona"],
  ["TIPO_ENTREGA", "tipo entrega"], ["DEPARTAMENTO", "departamento", "categoria"], ["PRODUCTO", "producto"],
  ["VARIANTE", "variante"], ["CANTIDAD", "cantidad"], ["PRECIO_UNITARIO", "precio unitario"],
  ["SUBTOTAL", "subtotal"], ["DESCUENTO", "descuento aplicado", "descuento"],
  ["TOTAL_PAGADO", "total pagado", "total"], ["METODO_PAGO", "metodo de pago"],
  ["ALERTA_DESCUENTO", "alerta descuento"], ["REFERIDO_POR", "referido por (whatsapp)", "referido por"],
  ["TIPO_DESCUENTO", "tipo de descuento"], ["ID_PRODUCTO", "id producto"]
];
var DEF_PEDIDOS = [
  ["FECHA", "fecha y hora", "fecha"], ["FOLIO", "folio"], ["CLIENTE", "cliente"], ["WHATSAPP", "whatsapp"],
  ["CORREO", "correo"], ["COMUNIDAD_VIP", "comunidad vip"], ["ZONA", "municipio / zona", "zona"],
  ["TIPO_ENTREGA", "tipo entrega"], ["METODO_PAGO", "metodo de pago"], ["ARTICULOS", "articulos"],
  ["SUBTOTAL", "subtotal"], ["DESCUENTO", "descuento aplicado", "descuento"],
  ["TIPO_DESCUENTO", "tipo de descuento"], ["TOTAL_PAGADO", "total pagado", "total"],
  ["REFERIDO_POR", "referido por (whatsapp)", "referido por"],
  ["ESTADO", "estado del pedido"], ["PAQUETERIA", "paqueteria"],
  ["GUIA", "guia de rastreo", "guia"], ["FECHA_ENVIO", "fecha de envio"],
  ["CALLE", "calle, numero exterior/interior", "calle y numero", "calle"], ["COLONIA", "colonia"], ["CP", "codigo postal", "cp"],
  ["ESTADO_DOMICILIO", "estado", "municipio / alcaldia *"],
  ["NOTAS", "referencias o punto de encuentro", "referencias / punto de encuentro", "referencias"]
];
var VENTAS_HEADERS = [
  "Fecha y Hora", "Folio", "Cliente", "WhatsApp", "Correo", "Comunidad VIP",
  "Municipio / Zona", "Tipo Entrega", "Departamento", "Producto", "Variante",
  "Cantidad", "Precio Unitario", "Subtotal", "Descuento Aplicado", "Total Pagado",
  "Método de Pago", "Alerta Descuento", "Referido Por (WhatsApp)", "Tipo de Descuento", "ID Producto"
];
var PEDIDOS_HEADERS = [
  "Fecha y Hora", "Folio", "Cliente", "WhatsApp", "Correo", "Comunidad VIP",
  "Municipio / Zona", "Tipo Entrega", "Método de Pago", "Artículos",
  "Subtotal", "Descuento Aplicado", "Tipo de Descuento", "Total Pagado",
  "Referido Por (WhatsApp)", "Estado del Pedido", "Paquetería",
  "Guía de Rastreo", "Fecha de Envío",
  "Calle, número exterior/interior", "Colonia", "Código Postal", "Estado", "Referencias o punto de encuentro"
];

// "Blancos Personalizables" (la tienda actual ya no la usa; se conserva por compatibilidad).
var BCOL = { ID: 0, ARTICULO: 1, VARIANTE: 2, PRECIO: 3, ESTADO: 4, ICONO: 5, STOCK: 6 };
var BLANCOS_ESTADO_COL_1I = 5;
var BLANCOS_STOCK_COL_1I = 7;

// ============================================================
// 2. UTILIDADES
// ============================================================

function timestampStr_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");
}
function normPhone(v) { return String(v || "").trim().replace(/[^0-9]/g, "").slice(-10); }
function normEmail(v) { return String(v || "").trim().toLowerCase(); }

function normTexto_(v) {
  return String(v === null || v === undefined ? "" : v)
    .toLowerCase()
    .replace(/[áàäâ]/g, "a").replace(/[éèëê]/g, "e").replace(/[íìïî]/g, "i")
    .replace(/[óòöô]/g, "o").replace(/[úùüû]/g, "u")
    .replace(/\s+/g, " ").trim();
}

function escHtml_(v) {
  return String(v === null || v === undefined ? "" : v)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Convierte emojis "grandes" (4 bytes) a entidades HTML (&#x1F7E1;) para que Gmail los muestre bien.
function aEntidades_(s) {
  return String(s).replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, function (p) {
    var cp = (p.charCodeAt(0) - 0xD800) * 0x400 + (p.charCodeAt(1) - 0xDC00) + 0x10000;
    return "&#x" + cp.toString(16).toUpperCase() + ";";
  });
}
// Quita emojis "grandes" (para texto plano y asuntos, donde no existen las entidades).
function sinEmoji_(s) {
  return String(s).replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "").replace(/[ \t]{2,}/g, " ");
}

function dinero_(n) {
  var s = Number(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return "$" + s.replace(/\.00$/, "") + " MXN";
}

// Texto seguro para Sheets: sin caracteres de control, longitud limitada y sin fórmulas (=, +, -, @).
function limpiar_(v, max) {
  var s = String(v === null || v === undefined ? "" : v).replace(/[\u0000-\u001F\u007F]/g, " ").trim();
  s = s.slice(0, max || 200);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}
function emailValido_(v) {
  return v.length <= 120 && /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(v);
}
function idLimpio_(v) { return String(v === null || v === undefined ? "" : v).replace(/[^\w-]/g, ""); }

function jsonOut_(obj) {
  var o = ContentService.createTextOutput(JSON.stringify(obj));
  o.setMimeType(ContentService.MimeType.JSON);
  return o;
}
function errorPedido_(msg) { return jsonOut_({ status: "error", message: msg }); }

// Solo PayPal/tarjeta ya verificado es un pago realizado. WhatsApp/transferencia = apartado.
function esPagoConfirmado_(metodoPago) { return /paypal|tarjeta/i.test(String(metodoPago || "")); }
function esPorVerificar_(metodoPago) { return /^por verificar/i.test(String(metodoPago || "")); }

// Mapa de columnas de una hoja: busca cada columna por el NOMBRE de su encabezado (fila 1).
// Si no aparece usa su posición original, salvo que esa posición ya la ocupe otra columna reconocida.
// Regresa { CLAVE: índice0 (o -1), _ancho: n, _respaldo: [claves encontradas solo por posición] }.
function mapaColumnas_(sheet, defs) {
  var lastCol = sheet ? sheet.getLastColumn() : 0;
  var hdr = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
  var norm = [], i, d, a;
  for (i = 0; i < hdr.length; i++) norm.push(normTexto_(hdr[i]));
  var map = {}, usados = {}, faltan = [];
  for (d = 0; d < defs.length; d++) {
    map[defs[d][0]] = -1;
    for (a = 1; a < defs[d].length && map[defs[d][0]] < 0; a++) {
      var pos = norm.indexOf(defs[d][a]);
      if (pos >= 0 && !usados[pos]) { map[defs[d][0]] = pos; usados[pos] = true; }
    }
    if (map[defs[d][0]] < 0) faltan.push(d);
  }
  var respaldo = [], maxIdx = hdr.length - 1;
  for (i = 0; i < faltan.length; i++) {
    var dd = faltan[i];
    if (!usados[dd] && dd < Math.max(hdr.length, defs.length)) {
      map[defs[dd][0]] = dd; usados[dd] = true; respaldo.push(defs[dd][0]);
    }
  }
  for (d = 0; d < defs.length; d++) if (map[defs[d][0]] > maxIdx) maxIdx = map[defs[d][0]];
  map._ancho = maxIdx + 1;
  map._respaldo = respaldo;
  return map;
}
function valor_(fila, m, clave) {
  var idx = m[clave];
  return (idx >= 0 && idx < fila.length) ? fila[idx] : "";
}
function filaDesdeMapa_(m, valores) {
  var fila = [], i;
  for (i = 0; i < m._ancho; i++) fila.push("");
  for (var k in valores) {
    if (valores.hasOwnProperty(k) && m[k] !== undefined && m[k] >= 0) fila[m[k]] = valores[k];
  }
  return fila;
}
function agregarFilas_(sheet, m, listaValores) {
  var filas = [];
  for (var i = 0; i < listaValores.length; i++) filas.push(filaDesdeMapa_(m, listaValores[i]));
  sheet.getRange(sheet.getLastRow() + 1, 1, filas.length, m._ancho).setValues(filas);
}
function obtenerHoja_(ss, nombre, headers) {
  var sh = ss.getSheetByName(nombre);
  if (!sh) { sh = ss.insertSheet(nombre); sh.appendRow(headers); }
  return sh;
}

// Asegura que "Ventas" tenga la columna "ID Producto" (la crea al final si falta).
function asegurarEncabezadoVentas_(sheet) {
  var lastCol = sheet.getLastColumn();
  var hdr = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
  for (var i = 0; i < hdr.length; i++) if (normTexto_(hdr[i]) === "id producto") return;
  if (lastCol >= sheet.getMaxColumns()) sheet.insertColumnAfter(lastCol);
  sheet.getRange(1, lastCol + 1).setValue("ID Producto");
}

// Folios de pedidos cancelados: no cuentan para descuentos VIP ni recompensas.
function foliosCancelados_(ss) {
  var set = {};
  var ped = ss.getSheetByName("Pedidos");
  if (!ped || ped.getLastRow() < 2) return set;
  var m = mapaColumnas_(ped, DEF_PEDIDOS);
  if (m.FOLIO < 0 || m.ESTADO < 0) return set;
  var ancho = Math.min(m._ancho, ped.getLastColumn());
  var datos = ped.getRange(2, 1, ped.getLastRow() - 1, ancho).getValues();
  for (var i = 0; i < datos.length; i++) {
    var est = normTexto_(valor_(datos[i], m, "ESTADO"));
    if (est === "cancelado" || est === "cancelada") set[String(valor_(datos[i], m, "FOLIO")).trim()] = true;
  }
  return set;
}

function folioExiste_(sheet, folio) {
  var n = sheet.getLastRow();
  if (n < 2) return false;
  var m = mapaColumnas_(sheet, DEF_PEDIDOS);
  if (m.FOLIO < 0) return false;
  var vals = sheet.getRange(2, m.FOLIO + 1, n - 1, 1).getValues();
  for (var i = 0; i < vals.length; i++) if (String(vals[i][0]).trim() === folio) return true;
  return false;
}

function construirLinkRastreo_(paqueteria, guia) {
  var p = String(paqueteria || "").toLowerCase();
  var g = encodeURIComponent(String(guia || "").trim());
  if (!g) return "";
  if (p.indexOf("estafeta") !== -1) return "https://www.estafeta.com/Rastreo/" + g;
  if (p.indexOf("dhl") !== -1) return "https://www.dhl.com/mx-es/home/tracking/tracking-express.html?tracking-id=" + g;
  if (p.indexOf("fedex") !== -1) return "https://www.fedex.com/fedextrack/?trknbr=" + g;
  if (p.indexOf("correos") !== -1) return "https://www.correosdemexico.gob.mx/SSLServicios/ConsultaEnvios/Consulta.aspx?guia=" + g;
  if (p.indexOf("paquetexpress") !== -1 || p.indexOf("paquete express") !== -1) return "https://www.paquetexpress.com.mx/rastreo?guia=" + g;
  if (p.indexOf("99minutos") !== -1 || p.indexOf("99 minutos") !== -1) return "https://www.99minutos.com/rastreo/" + g;
  return "";
}

function logError_(ss, type, folio, email, msg) {
  var errSheet = ss.getSheetByName("Errores");
  if (!errSheet) {
    errSheet = ss.insertSheet("Errores");
    errSheet.appendRow(["Fecha", "Tipo", "Folio", "Email", "Mensaje de Error"]);
  }
  errSheet.appendRow([timestampStr_(), type, limpiar_(folio, 60), limpiar_(email, 120), limpiar_(msg, 500)]);
}

// ============================================================
// 3. AUTOMATIZACIÓN: Estado según Stock, guía de rastreo y cancelaciones
// ============================================================

// Trigger SIMPLE: sin permisos especiales. Sincroniza Stock/Estado y devuelve stock por cancelación.
function onEdit(e) {
  try {
    var sheet = e.range.getSheet();
    var nombre = sheet.getName();
    if (nombre === "Hoja 1") {
      var m = mapaColumnas_(sheet, DEF_HOJA1);
      manejarEdicionInventario_(e, m.ID + 1, m.ESTADO + 1, m.STOCK + 1);
    } else if (nombre === BLANCOS_SHEET_NAME) {
      manejarEdicionInventario_(e, BCOL.ID + 1, BLANCOS_ESTADO_COL_1I, BLANCOS_STOCK_COL_1I);
    } else if (nombre === "Pedidos") {
      manejarCancelacionPedido_(e);
    }
  } catch (err) {
    try { logError_(SpreadsheetApp.getActiveSpreadsheet(), "ONEDIT_INVENTARIO", "", "", err.toString()); } catch (logErr) {}
  }
}

// Trigger INSTALABLE (se crea con instalarDisparadores()). Corre con permisos completos: manda el correo de guía.
function onEditPedidoInstalable(e) {
  try {
    var sheet = e.range.getSheet();
    if (sheet.getName() === "Pedidos") {
      manejarCancelacionPedido_(e);
      manejarEdicionPedido_(e);
    }
  } catch (err) {
    try { logError_(SpreadsheetApp.getActiveSpreadsheet(), "ON_EDIT_PEDIDO", "", "", err.toString()); } catch (logErr) {}
  }
}

function manejarEdicionInventario_(e, idCol1I, estadoCol1I, stockCol1I) {
  if (idCol1I < 1 || estadoCol1I < 1 || stockCol1I < 1) return;
  var sheet = e.range.getSheet();
  var startRow = e.range.getRow(), startCol = e.range.getColumn();
  var numRows = e.range.getNumRows(), endCol = startCol + e.range.getNumColumns() - 1;
  var tocaEstado = startCol <= estadoCol1I && endCol >= estadoCol1I;
  var tocaStock = startCol <= stockCol1I && endCol >= stockCol1I;
  if (!tocaEstado && !tocaStock) return;

  for (var r = 0; r < numRows; r++) {
    var row = startRow + r;
    if (row === 1) continue;
    var idVal = sheet.getRange(row, idCol1I).getValue();
    if (idVal === "" || idVal === null) continue;
    var stockCell = sheet.getRange(row, stockCol1I);
    var estadoCell = sheet.getRange(row, estadoCol1I);
    var stockVal = Number(stockCell.getValue() || 0);
    var estadoVal = String(estadoCell.getValue() || "").trim().toLowerCase();
    if (stockVal > 0 && estadoVal === "agotado") estadoCell.setValue("Disponible");
    else if (stockVal <= 0 && estadoVal !== "agotado") estadoCell.setValue("Agotado");
  }
}

function manejarEdicionPedido_(e) {
  var range = e.range;
  var sheet = range.getSheet();
  var m = mapaColumnas_(sheet, DEF_PEDIDOS);
  if (m.GUIA < 0 || range.getColumn() !== (m.GUIA + 1)) return;
  if (range.getRow() === 1) return;

  var nuevaGuia = String(range.getValue() || "").trim();
  var guiaAnterior = e.oldValue ? String(e.oldValue).trim() : "";
  if (!nuevaGuia || nuevaGuia === guiaAnterior) return;

  var fila = range.getRow();
  var datosFila = sheet.getRange(fila, 1, 1, m._ancho).getValues()[0];
  var correo = String(valor_(datosFila, m, "CORREO") || "");
  var cliente = escHtml_(valor_(datosFila, m, "CLIENTE") || "Cliente");
  var folio = escHtml_(valor_(datosFila, m, "FOLIO"));
  var paqueteria = String(valor_(datosFila, m, "PAQUETERIA") || "");

  if (m.ESTADO >= 0) sheet.getRange(fila, m.ESTADO + 1).setValue("Enviado");
  if (m.FECHA_ENVIO >= 0) sheet.getRange(fila, m.FECHA_ENVIO + 1).setValue(new Date());
  if (!emailValido_(correo)) return;

  var linkRastreo = construirLinkRastreo_(paqueteria, nuevaGuia);
  var guiaH = escHtml_(nuevaGuia), paqH = escHtml_(paqueteria);
  var asunto = "¡Tu pedido de Carol Q ya va en camino! (#" + sinEmoji_(String(valor_(datosFila, m, "FOLIO"))) + ")";
  var botonHtml = linkRastreo
    ? '<a href="' + linkRastreo + '" target="_blank" style="background-color:#1F1916; color:#FFFFFF; padding:14px 28px; border-radius:30px; text-decoration:none; font-size:14px; font-weight:700; display:inline-block;">Rastrear mi paquete</a>'
    : '';

  var cuerpoHtml = '<div style="background-color:#FAF7F2; padding:40px 20px; font-family:\'Plus Jakarta Sans\', Arial, sans-serif; color:#1F1916;">' +
    '<div style="max-width:560px; margin:0 auto; background:#FFFFFF; border:1px solid #ECE3D8; border-radius:16px; overflow:hidden; box-shadow:0 8px 30px rgba(31,25,22,0.08);">' +
      '<div style="text-align:center; padding:32px 24px 20px; border-bottom:1px solid #ECE3D8;">' +
        '<h2 style="font-family:Georgia, serif; font-size:26px; color:#1F1916; margin:0 0 6px; font-weight:700;">Carol Q</h2>' +
        '<p style="font-size:11px; color:#9E7B3B; text-transform:uppercase; letter-spacing:0.15em; margin:0; font-weight:700;">Tu pedido va en camino</p>' +
      '</div>' +
      '<div style="padding:30px 28px 24px; text-align:center;">' +
        '<p style="font-size:16px; color:#1F1916; margin:0 0 8px; font-weight:700;">¡Buenas noticias, ' + cliente + '!</p>' +
        '<p style="font-size:13px; color:#5C524B; margin:0 0 20px; line-height:1.6;">Tu pedido #' + folio + ' ya salió' + (paqueteria ? (' con <strong>' + paqH + '</strong>') : '') + '. Aquí tienes tu número de guía:</p>' +
        '<div style="background:#FAF7F2; border:1px dashed #DACBC0; border-radius:10px; padding:14px; margin-bottom:22px; font-size:18px; font-weight:700; letter-spacing:0.04em; color:#9E7B3B;">' + guiaH + '</div>' +
        (botonHtml ? ('<div style="margin-bottom:22px;">' + botonHtml + '</div>') : '') +
        '<p style="font-size:11px; color:#9E9187; margin:0; line-height:1.5;">¿Dudas con tu envío? Escríbenos a nuestro WhatsApp: 55 3552 2522.</p>' +
      '</div>' +
    '</div>' +
  '</div>';

  var textoPlano = "Carol Q\n\n¡Buenas noticias! Tu pedido #" + String(valor_(datosFila, m, "FOLIO")) + " ya salió" +
    (paqueteria ? (" con " + paqueteria) : "") + ".\nGuía: " + nuevaGuia +
    (linkRastreo ? ("\nRastrear: " + linkRastreo) : "") +
    "\n\n¿Dudas? Escríbenos a nuestro WhatsApp: 55 3552 2522.";

  try {
    GmailApp.sendEmail(correo, asunto, sinEmoji_(textoPlano), { htmlBody: aEntidades_(cuerpoHtml), name: "Carol Q Boutique" });
  } catch (err) {
    logError_(SpreadsheetApp.getActiveSpreadsheet(), "EMAIL_GUIA", String(valor_(datosFila, m, "FOLIO")), correo, err.toString());
  }
}

// Reversión automática de stock cuando un pedido pasa a "Cancelado" (una sola vez por folio).
function manejarCancelacionPedido_(e) {
  var range = e.range;
  var sheet = range.getSheet();
  if (sheet.getName() !== "Pedidos") return;
  var ss = sheet.getParent();
  var m = mapaColumnas_(sheet, DEF_PEDIDOS);
  if (m.ESTADO < 0 || m.FOLIO < 0) return;
  var estadoCol = m.ESTADO + 1, folioCol = m.FOLIO + 1;
  var startCol = range.getColumn();
  var endCol = startCol + range.getNumColumns() - 1;
  if (estadoCol < startCol || estadoCol > endCol) return;

  var startRow = range.getRow(), numRows = range.getNumRows();
  for (var r = 0; r < numRows; r++) {
    var row = startRow + r;
    if (row === 1) continue;
    var estadoCell = sheet.getRange(row, estadoCol);
    var estadoNorm = normTexto_(estadoCell.getValue());
    if (estadoNorm !== "cancelado" && estadoNorm !== "cancelada") continue;
    var folio = String(sheet.getRange(row, folioCol).getValue() || "").trim();
    if (!folio) continue;
    var resultado = revertirStockPorFolio_(ss, folio);
    if (resultado && resultado.nota) {
      try { estadoCell.setNote(resultado.nota); } catch (noteErr) {}
    }
  }
}

function revertirStockPorFolio_(ss, folio) {
  var lock = LockService.getDocumentLock();
  try { lock.waitLock(25000); }
  catch (lockErr) {
    logError_(ss, "REVERSION_STOCK_LOCK", folio, "", "No se pudo obtener el bloqueo; revisa si el stock ya se devolvió.");
    return null;
  }
  try {
    var props = PropertiesService.getDocumentProperties();
    var marca = "STOCK_REVERTIDO_" + folio;
    if (props.getProperty(marca)) return null;

    var ventasSheet = ss.getSheetByName("Ventas");
    var invSheet = ss.getSheetByName("Hoja 1");
    if (!ventasSheet || !invSheet || ventasSheet.getLastRow() < 2) {
      logError_(ss, "REVERSION_STOCK", folio, "", "No se encontró la hoja 'Ventas' o 'Hoja 1'.");
      return null;
    }
    var mv = mapaColumnas_(ventasSheet, DEF_VENTAS);
    var ventasData = ventasSheet.getDataRange().getValues();
    var lineas = [];
    for (var v = 1; v < ventasData.length; v++) {
      if (String(valor_(ventasData[v], mv, "FOLIO") || "").trim() !== folio) continue;
      var qty = Number(valor_(ventasData[v], mv, "CANTIDAD") || 0);
      if (!qty || qty < 0) continue;
      lineas.push({ id: idLimpio_(valor_(ventasData[v], mv, "ID_PRODUCTO")), producto: String(valor_(ventasData[v], mv, "PRODUCTO") || ""), variante: String(valor_(ventasData[v], mv, "VARIANTE") || ""), qty: qty });
    }
    if (lineas.length === 0) {
      logError_(ss, "REVERSION_STOCK", folio, "", "No hay renglones en 'Ventas' con este folio; no se devolvió stock.");
      return { nota: "No se encontraron artículos de este folio en 'Ventas'. No se devolvió stock." };
    }

    var mi = mapaColumnas_(invSheet, DEF_HOJA1);
    var invData = invSheet.getDataRange().getValues();
    var indice = {}, indiceCompuesto = {}, indicePorId = {};
    for (var i = 1; i < invData.length; i++) {
      var idInv = idLimpio_(valor_(invData[i], mi, "ID"));
      if (idInv && !indicePorId.hasOwnProperty(idInv)) indicePorId[idInv] = i;
      var nProd = normTexto_(valor_(invData[i], mi, "PRODUCTO"));
      var nVar = normTexto_(valor_(invData[i], mi, "VARIANTE"));
      var clave = nProd + "|" + nVar;
      if (!indice.hasOwnProperty(clave)) indice[clave] = i;
      if (nVar) {
        var claveComp = nProd + " (" + nVar + ")";
        if (!indiceCompuesto.hasOwnProperty(claveComp)) indiceCompuesto[claveComp] = i;
      }
    }

    var nuevoStock = {}, devueltas = [], noEncontradas = [];
    for (var l = 0; l < lineas.length; l++) {
      var claveL = normTexto_(lineas[l].producto) + "|" + normTexto_(lineas[l].variante);
      var etiqueta = lineas[l].qty + "x " + lineas[l].producto + (lineas[l].variante ? " (" + lineas[l].variante + ")" : "");
      var fila;
      if (lineas[l].id && indicePorId.hasOwnProperty(lineas[l].id)) fila = indicePorId[lineas[l].id];
      else if (indice.hasOwnProperty(claveL)) fila = indice[claveL];
      else if (indiceCompuesto.hasOwnProperty(normTexto_(lineas[l].producto))) fila = indiceCompuesto[normTexto_(lineas[l].producto)];
      else { noEncontradas.push(etiqueta); continue; }
      var actual = nuevoStock.hasOwnProperty(fila) ? nuevoStock[fila] : Number(valor_(invData[fila], mi, "STOCK") || 0);
      nuevoStock[fila] = actual + lineas[l].qty;
      devueltas.push(etiqueta + " → stock " + nuevoStock[fila]);
    }

    for (var f in nuevoStock) {
      if (!nuevoStock.hasOwnProperty(f)) continue;
      var nFila = Number(f);
      if (mi.STOCK >= 0) invSheet.getRange(nFila + 1, mi.STOCK + 1).setValue(nuevoStock[f]);
      var estadoActual = normTexto_(valor_(invData[nFila], mi, "ESTADO"));
      if (nuevoStock[f] > 0 && estadoActual === "agotado" && mi.ESTADO >= 0) {
        invSheet.getRange(nFila + 1, mi.ESTADO + 1).setValue("Disponible");
      }
    }
    if (devueltas.length > 0) props.setProperty(marca, timestampStr_());

    var nota = "";
    if (devueltas.length > 0) nota += "Stock devuelto automáticamente (" + timestampStr_() + "):\n" + devueltas.join("\n");
    if (noEncontradas.length > 0) {
      nota += (nota ? "\n\n" : "") + "⚠️ No se encontraron en 'Hoja 1' (ajusta el stock a mano):\n" + noEncontradas.join("\n");
      logError_(ss, "REVERSION_STOCK", folio, "", "No encontrados en Hoja 1: " + noEncontradas.join("; "));
    }
    return { nota: nota };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================
// 4. doGet — catálogo, blancos y consulta VIP
// ============================================================

function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (e && e.parameter && e.parameter.checkVip === "true") return responderCheckVip_(ss, e);
    if (e && e.parameter && e.parameter.blancos === "true") return responderBlancos_(ss);
    return responderCatalogo_(ss);
  } catch (error) {
    try { logError_(SpreadsheetApp.getActiveSpreadsheet(), "DOGET", "", "", error.toString()); } catch (logErr) {}
    var esConsultaVip = e && e.parameter && e.parameter.checkVip === "true";
    return jsonOut_(esConsultaVip ? { elegible: true, tipo: "Bienvenida" } : []);
  }
}

function responderCatalogo_(ss) {
  var sheet = ss.getSheetByName("Hoja 1");
  if (!sheet || sheet.getLastRow() < 2) return jsonOut_([]);
  var m = mapaColumnas_(sheet, DEF_HOJA1);
  var rows = sheet.getDataRange().getValues();
  var products = [], vistos = {};

  for (var r = 1; r < rows.length; r++) {
    var idRaw = valor_(rows[r], m, "ID");
    if (idRaw === "" || idRaw === null) continue;
    var id = idLimpio_(idRaw);
    if (!id || vistos[id]) continue;          // ID vacío o repetido: se omite (ver diagnostico())
    vistos[id] = true;

    var stockRaw = valor_(rows[r], m, "STOCK");
    var stockVal = Number(stockRaw === "" || stockRaw === null ? 0 : stockRaw);
    if (isNaN(stockVal)) stockVal = 0;
    var estadoVal = String(valor_(rows[r], m, "ESTADO") || "Disponible").trim();
    var estadoLow = estadoVal.toLowerCase();

    if (stockVal > 0 && estadoLow === "agotado") {
      estadoVal = "Disponible";
      if (m.ESTADO >= 0) sheet.getRange(r + 1, m.ESTADO + 1).setValue("Disponible");
    } else if (stockVal <= 0 && estadoLow !== "agotado") {
      estadoVal = "Agotado";
      if (m.ESTADO >= 0) sheet.getRange(r + 1, m.ESTADO + 1).setValue("Agotado");
    }

    products.push({
      id: id,
      nombre: String(valor_(rows[r], m, "PRODUCTO") || "").trim(),
      variante: String(valor_(rows[r], m, "VARIANTE") || "").trim(),
      departamento: String(valor_(rows[r], m, "DEPARTAMENTO") || ""),
      subcategoria: String(valor_(rows[r], m, "SUBCATEGORIA") || ""),
      precio: Number(valor_(rows[r], m, "PRECIO") || 0),
      estado: estadoVal,
      badge: String(valor_(rows[r], m, "BADGE") || ""),
      descripcion: String(valor_(rows[r], m, "DESCRIPCION") || ""),
      foto: String(valor_(rows[r], m, "FOTO") || "").trim(),
      stock: stockVal
    });
  }
  return jsonOut_(products);
}

function responderBlancos_(ss) {
  var sheet = ss.getSheetByName(BLANCOS_SHEET_NAME);
  if (!sheet) return jsonOut_([]);
  var rows = sheet.getDataRange().getValues();
  var blancos = [];
  for (var r = 1; r < rows.length; r++) {
    var id = rows[r][BCOL.ID];
    if (id === "" || id === null) continue;
    var stockVal = Number(rows[r][BCOL.STOCK] != null && rows[r][BCOL.STOCK] !== "" ? rows[r][BCOL.STOCK] : 0);
    var estadoVal = String(rows[r][BCOL.ESTADO] || "Disponible").trim();
    if (stockVal > 0 && estadoVal.toLowerCase() === "agotado") {
      estadoVal = "Disponible"; sheet.getRange(r + 1, BLANCOS_ESTADO_COL_1I).setValue("Disponible");
    } else if (stockVal <= 0 && estadoVal.toLowerCase() !== "agotado") {
      estadoVal = "Agotado"; sheet.getRange(r + 1, BLANCOS_ESTADO_COL_1I).setValue("Agotado");
    }
    blancos.push({
      id: String(id), articulo: String(rows[r][BCOL.ARTICULO] || ""), variante: String(rows[r][BCOL.VARIANTE] || ""),
      precio: Number(rows[r][BCOL.PRECIO] || 0), estado: estadoVal, icono: String(rows[r][BCOL.ICONO] || "\uD83C\uDF81"), stock: stockVal
    });
  }
  return jsonOut_(blancos);
}

// Lógica de VIP / referidos (la usan doGet y doPost).
function evaluarVip_(ss, email, phone) {
  var R = 3;
  var ventasSheet = ss.getSheetByName("Ventas");
  var hasBoughtBefore = false, yaEsComunidadVip = false, matchBoth = false;
  var referred = {}, rewardFolios = {};
  var cancelados = foliosCancelados_(ss);
  if (ventasSheet && ventasSheet.getLastRow() > 1) {
    var m = mapaColumnas_(ventasSheet, DEF_VENTAS);
    var data = ventasSheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var rowFolio = String(valor_(row, m, "FOLIO") || "");
      if (!rowFolio) continue;
      if (cancelados[rowFolio.trim()]) continue;   // pedido cancelado: no cuenta
      var rowPhone = normPhone(valor_(row, m, "WHATSAPP"));
      var rowEmail = normEmail(valor_(row, m, "CORREO"));
      var rowRefBy = normPhone(valor_(row, m, "REFERIDO_POR"));
      var esElla = (phone && rowPhone === phone) || (email && rowEmail === email);
      if (esElla) {
        hasBoughtBefore = true;
        if (phone && email && rowPhone === phone && rowEmail === email) matchBoth = true;
        if (String(valor_(row, m, "TIPO_DESCUENTO") || "") === "Recompensa por Amiga") rewardFolios[rowFolio] = true;
        var c = String(valor_(row, m, "COMUNIDAD_VIP") || "").trim().toLowerCase();
        if (c === "sí" || c === "si") yaEsComunidadVip = true;
      }
      if (phone && rowRefBy === phone && !esElla) referred[rowEmail || rowPhone || rowFolio] = true;
    }
  }
  var referredCount = Object.keys(referred).length;
  var rewardsAvailable = Math.max(0, Math.floor(referredCount / R) - Object.keys(rewardFolios).length);
  var elegible = !hasBoughtBefore, tipo = "Bienvenida";
  if (hasBoughtBefore && rewardsAvailable > 0) { elegible = true; tipo = "Recompensa por Amiga"; }
  return { elegible: elegible, tipo: tipo, yaEsComunidadVip: yaEsComunidadVip, referredCount: referredCount, rewardsAvailable: rewardsAvailable, matchBoth: matchBoth };
}

// No revela historial de terceros: contadores y membresía solo si correo Y teléfono coinciden.
function responderCheckVip_(ss, e) {
  var R = 3;
  var v = evaluarVip_(ss, normEmail(e.parameter.email), normPhone(e.parameter.phone));
  var conoce = v.matchBoth;
  var referidas = conoce ? v.referredCount : 0;
  var restante = referidas % R;
  return jsonOut_({
    elegible: v.elegible,
    tipo: v.tipo,
    yaEsComunidadVip: conoce ? v.yaEsComunidadVip : false,
    referredCount: referidas,
    referidosRequeridos: R,
    rewardsAvailable: conoce ? v.rewardsAvailable : 0,
    faltanParaSiguiente: restante === 0 ? R : R - restante
  });
}

// ============================================================
// 5. PayPal y doPost
// ============================================================

function verificarPayPal_(orderId, totalEsperado) {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty("PAYPAL_CLIENT_ID");
  var secret = props.getProperty("PAYPAL_CLIENT_SECRET");
  if (!id || !secret) return { ok: false, reason: "Faltan PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET en las propiedades del script." };
  try {
    var tk = UrlFetchApp.fetch(PAYPAL_API_ + "/v1/oauth2/token", {
      method: "post",
      headers: { Authorization: "Basic " + Utilities.base64Encode(id + ":" + secret) },
      payload: "grant_type=client_credentials",
      muteHttpExceptions: true
    });
    if (tk.getResponseCode() !== 200) return { ok: false, reason: "No se pudo autenticar con PayPal (HTTP " + tk.getResponseCode() + ")." };
    var token = JSON.parse(tk.getContentText()).access_token;
    var r = UrlFetchApp.fetch(PAYPAL_API_ + "/v2/checkout/orders/" + encodeURIComponent(orderId), {
      headers: { Authorization: "Bearer " + token },
      muteHttpExceptions: true
    });
    if (r.getResponseCode() !== 200) return { ok: false, reason: "PayPal no reconoce la orden (HTTP " + r.getResponseCode() + ")." };
    var o = JSON.parse(r.getContentText());
    var pu = (o.purchase_units && o.purchase_units[0]) || {};
    var cap = pu.payments && pu.payments.captures && pu.payments.captures[0];
    if (o.status !== "COMPLETED" || !cap || cap.status !== "COMPLETED") return { ok: false, reason: "La orden no está completada en PayPal (" + o.status + ")." };
    var monto = Number(cap.amount && cap.amount.value);
    if ((cap.amount && cap.amount.currency_code) !== "MXN" || Math.abs(monto - totalEsperado) > 0.01) {
      return { ok: false, reason: "Monto pagado en PayPal (" + monto + ") distinto al calculado por la tienda (" + totalEsperado + "). Revisa que el precio no haya cambiado." };
    }
    return { ok: true, reason: "" };
  } catch (err) {
    return { ok: false, reason: "Error consultando PayPal: " + err };
  }
}

// Alerta para la administradora cuando una clienta pagó y el pedido NO se pudo registrar.
function alertarPagoSinRegistrar_(ss, folio, email, motivo) {
  try { logError_(ss, "PAGO_SIN_REGISTRAR", folio, email, motivo); } catch (x) {}
  try {
    GmailApp.sendEmail(ADMIN_EMAIL, "⚠️ [PAGO SIN REGISTRAR] Orden PayPal " + sinEmoji_(folio),
      sinEmoji_("Una clienta pagó por PayPal pero el pedido no se pudo registrar en la hoja.\n\nID de PayPal: " + folio +
      "\nCorreo capturado: " + email + "\nMotivo: " + motivo +
      "\n\nEntra a tu cuenta de PayPal, localiza esa orden y captura el pedido a mano en 'Pedidos'/'Ventas' (o escríbele a la clienta)."),
      { name: "Carol Q · Alertas de Pedido" });
  } catch (y) {}
}

// El servidor NO confía en precios, totales, nombres ni descuentos que mande el navegador.
function doPost(e) {
  var lock = LockService.getScriptLock();
  var ss = null, folio = "", email = "", pagoDeclarado = false, folioIn = "";
  function rechazar(msg, detalle) {
    if (pagoDeclarado && folioIn) {
      alertarPagoSinRegistrar_(ss || SpreadsheetApp.getActiveSpreadsheet(), folioIn, email, msg + (detalle ? " | " + detalle : ""));
      return errorPedido_(msg + " Tu pago SÍ se recibió: escríbenos por WhatsApp con tu ID de transacción " + folioIn + ".");
    }
    return errorPedido_(msg);
  }
  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!e || !e.postData || !e.postData.contents || e.postData.contents.length > 60000) return errorPedido_("Solicitud inválida.");
    var data = JSON.parse(e.postData.contents);
    if (!data || typeof data !== "object") return errorPedido_("Solicitud inválida.");

    pagoDeclarado = /paypal|tarjeta/i.test(String(data.metodoPago || ""));
    folioIn = String(data.folio || "").replace(/[^A-Za-z0-9-]/g, "").slice(0, 30);
    email = limpiar_(data.email, 120);

    // 1) Datos de la clienta (validados y limpiados)
    var cliente = limpiar_(data.cliente, 80);
    var telefono = normPhone(data.telefono);
    var zona = limpiar_(data.zona, 80);
    if (!cliente || telefono.length !== 10 || !emailValido_(email) || !zona) return rechazar("Revisa tus datos de contacto.");
    var tipoEnvio = tipoEnvioDe_(data);
    var calle = limpiar_(data.calle, 120), colonia = limpiar_(data.colonia, 80);
    var cp = String(data.cp || "").replace(/\D/g, "").slice(0, 5);
    var estadoDom = limpiar_(data.estado, 40), notas = limpiar_(data.notas, 300);
    if (tipoEnvio !== "pickup" && (!calle || !colonia || cp.length !== 5 || !estadoDom)) return rechazar("Falta tu domicilio completo.");
    var comunidadVip = data.comunidadVip === "Sí" ? "Sí" : "No";
    var referidoPor = normPhone(data.referidoPor);
    if (referidoPor.length !== 10 || referidoPor === telefono) referidoPor = "";
    var entregaLabel = ENTREGA_LABELS_[tipoEnvio];

    // 2) Artículos agrupados por ID
    var pedidoItems = Array.isArray(data.items) ? data.items : [];
    if (!pedidoItems.length || pedidoItems.length > MAX_ITEMS_) return rechazar("Tu bolsa está vacía o es demasiado grande.");
    var porId = {}, orden = [];
    for (var k = 0; k < pedidoItems.length; k++) {
      var it = pedidoItems[k] || {};
      var id = idLimpio_(it.id);
      var q = Math.floor(Number(it.qty));
      if (!id || !(q >= 1) || q > MAX_QTY_) return rechazar("Cantidad no válida.");
      if (!porId.hasOwnProperty(id)) { porId[id] = 0; orden.push(id); }
      porId[id] += q;
    }

    lock.waitLock(30000);   // evita que dos compras simultáneas vendan la misma última pieza

    var invSheet = ss.getSheetByName("Hoja 1");
    if (!invSheet) return rechazar("Catálogo no disponible.");
    var ventasSheet = obtenerHoja_(ss, "Ventas", VENTAS_HEADERS);
    var pedidosSheet = obtenerHoja_(ss, "Pedidos", PEDIDOS_HEADERS);

    // Reintento o reenvío del mismo folio/orden: no se vuelve a descontar ni registrar.
    if (folioIn && folioExiste_(pedidosSheet, folioIn)) return jsonOut_({ status: "success", folio: folioIn, duplicate: true });

    var mi = mapaColumnas_(invSheet, DEF_HOJA1);
    var invData = invSheet.getDataRange().getValues();
    var lineas = [], faltantes = [], subtotal = 0;
    for (var oi = 0; oi < orden.length; oi++) {
      var pid = orden[oi];
      var fila = -1;
      for (var r = 1; r < invData.length; r++) {
        if (idLimpio_(valor_(invData[r], mi, "ID")) === pid) { fila = r; break; }
      }
      if (fila < 0) return rechazar("Uno de los productos ya no está disponible. Actualiza la página e intenta de nuevo.");
      var precio = Number(valor_(invData[fila], mi, "PRECIO") || 0);
      var stockRaw = valor_(invData[fila], mi, "STOCK");
      var stock = Number(stockRaw === "" || stockRaw === null ? 0 : stockRaw) || 0;
      var qty = porId[pid];
      if (!(precio > 0)) return rechazar("Uno de los productos no está a la venta.");
      var nombre = String(valor_(invData[fila], mi, "PRODUCTO") || "Producto");
      var variante = String(valor_(invData[fila], mi, "VARIANTE") || "").trim();
      if (qty > stock) faltantes.push(nombre + (variante ? " (" + variante + ")" : ""));
      lineas.push({ fila: fila, id: pid, nombre: nombre, variante: variante, departamento: String(valor_(invData[fila], mi, "DEPARTAMENTO") || ""), precio: precio, qty: qty, stock: stock });
      subtotal += precio * qty;
    }

    // 3) Totales calculados en el servidor
    var envio = tipoEnvio === "courier" ? (subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST_PAQUETERIA) : 0;
    var vip = evaluarVip_(ss, normEmail(email), telefono);
    var descuento = 0, tipoDescuento = "Ninguno";
    if (comunidadVip === "Sí" && vip.elegible && subtotal >= VIP_MIN_COMPRA_) {
      descuento = vip.tipo === "Recompensa por Amiga" ? Math.min(subtotal * 0.15, 250) : Math.min(subtotal * 0.10, 200);
      descuento = Math.round(descuento * 100) / 100;
      tipoDescuento = vip.tipo;
    }
    var total = Math.round((Math.max(0, subtotal - descuento) + envio) * 100) / 100;

    // 4) Pago: PayPal solo cuenta como pagado si PayPal lo confirma por el monto correcto
    var metodoPago = "WhatsApp / Transferencia", pagoVerificado = false, avisoPago = "";
    folio = folioIn;
    if (pagoDeclarado) {
      if (!/^[A-Z0-9]{10,25}$/i.test(folio)) return rechazar("Folio de pago no válido.");
      var ver = verificarPayPal_(folio, total);
      if (ver.ok) { metodoPago = "PayPal / Tarjeta"; pagoVerificado = true; }
      else {
        metodoPago = "Por verificar - orden " + folio;   // no contiene 'paypal' ni 'tarjeta' a propósito
        avisoPago = ver.reason;
        logError_(ss, "PAYPAL_VERIFICACION", folio, email, ver.reason);
      }
    } else if (!folio || folioExiste_(pedidosSheet, folio)) {
      folio = "WA-" + Math.floor(Math.random() * 900000 + 100000);
    }

    // Sin pago declarado y sin existencias: se rechaza. Con pago declarado SIEMPRE se registra (el dinero ya se movió).
    if (faltantes.length && !pagoDeclarado) {
      return errorPedido_("Sin existencias suficientes de: " + faltantes.join(", ") + ". Actualiza la página.");
    }
    var notasFinal = notas;
    if (avisoPago) notasFinal += " ⚠️ PAGO POR VERIFICAR EN PAYPAL: " + avisoPago;
    if (faltantes.length) notasFinal += " ⚠️ PAGADO PERO SIN STOCK SUFICIENTE (" + faltantes.join(", ") + "): avisar a la clienta y reembolsar. El stock quedó en negativo para llevar la cuenta.";
    notasFinal = notasFinal.trim();

    // 5) Registro (cada valor va a la columna que corresponde por encabezado)
    var ts = new Date(), ventasFilas = [], resumen = [], stockReporte = [], itemsMail = [];
    for (var l = 0; l < lineas.length; l++) {
      var ln = lineas[l];
      resumen.push(ln.qty + "x " + ln.nombre + (ln.variante ? " (" + ln.variante + ")" : ""));
      itemsMail.push({ id: ln.id, nombre: ln.nombre, variante: ln.variante, departamento: ln.departamento, precio: ln.precio, qty: ln.qty });
      ventasFilas.push({
        FECHA: ts, FOLIO: folio, CLIENTE: cliente, WHATSAPP: telefono, CORREO: email, COMUNIDAD_VIP: comunidadVip,
        ZONA: zona, TIPO_ENTREGA: entregaLabel, DEPARTAMENTO: ln.departamento, PRODUCTO: ln.nombre, VARIANTE: ln.variante,
        CANTIDAD: ln.qty, PRECIO_UNITARIO: ln.precio, SUBTOTAL: ln.precio * ln.qty, DESCUENTO: descuento, TOTAL_PAGADO: total,
        METODO_PAGO: metodoPago, ALERTA_DESCUENTO: "", REFERIDO_POR: referidoPor, TIPO_DESCUENTO: tipoDescuento,
        ID_PRODUCTO: ln.id
      });
    }
    asegurarEncabezadoVentas_(ventasSheet);
    agregarFilas_(ventasSheet, mapaColumnas_(ventasSheet, DEF_VENTAS), ventasFilas);
    agregarFilas_(pedidosSheet, mapaColumnas_(pedidosSheet, DEF_PEDIDOS), [{
      FECHA: ts, FOLIO: folio, CLIENTE: cliente, WHATSAPP: telefono, CORREO: email, COMUNIDAD_VIP: comunidadVip,
      ZONA: zona, TIPO_ENTREGA: entregaLabel, METODO_PAGO: metodoPago, ARTICULOS: resumen.join(", "),
      SUBTOTAL: subtotal, DESCUENTO: descuento, TIPO_DESCUENTO: tipoDescuento, TOTAL_PAGADO: total, REFERIDO_POR: referidoPor,
      ESTADO: "Pendiente de envío", CALLE: calle, COLONIA: colonia, CP: cp, ESTADO_DOMICILIO: estadoDom, NOTAS: notasFinal
    }]);

    for (var s = 0; s < lineas.length; s++) {
      var L = lineas[s];
      // Con pago y sin stock el número queda negativo a propósito (así se ve la sobreventa y la cancelación cuadra).
      var nuevo = pagoDeclarado ? (L.stock - L.qty) : Math.max(0, L.stock - L.qty);
      if (mi.STOCK >= 0) invSheet.getRange(L.fila + 1, mi.STOCK + 1).setValue(nuevo);
      if (nuevo <= 0 && mi.ESTADO >= 0) invSheet.getRange(L.fila + 1, mi.ESTADO + 1).setValue("Agotado");
      stockReporte.push({ nombre: L.nombre, variante: L.variante, stock: nuevo });
    }

    // 6) Correos (nunca rompen el registro)
    var datosAdmin = { cliente: cliente, telefono: telefono, email: email, zona: zona, tipoEntrega: entregaLabel, tipoEnvio: tipoEnvio,
      metodoPago: metodoPago, tipoDescuento: tipoDescuento, comunidadVip: comunidadVip, avisoPago: avisoPago };
    enviarCorreoAdministradora_(ss, pedidosSheet, datosAdmin, itemsMail, folio, descuento, total, calle, colonia, cp, estadoDom, notasFinal, [], stockReporte);

    var esc = escHtml_;
    var datosCliente = { cliente: esc(cliente), telefono: telefono, email: email, zona: esc(zona), tipoEntrega: entregaLabel, tipoEnvio: tipoEnvio,
      metodoPago: metodoPago, tipoDescuento: tipoDescuento, comunidadVip: comunidadVip };
    var itemsCliente = itemsMail.map(function (x) { return { nombre: esc(x.nombre), variante: esc(x.variante), precio: x.precio, qty: x.qty }; });
    enviarCorreoConfirmacion_(ss, datosCliente, itemsCliente, folio, descuento, total, esc(calle), esc(colonia), esc(cp), esc(estadoDom), esc(notas), []);

    return jsonOut_({ status: "success", folio: folio, total: total, verificado: pagoVerificado || !pagoDeclarado, pagoDeclarado: pagoDeclarado });

  } catch (err) {
    try { logError_(ss || SpreadsheetApp.getActiveSpreadsheet(), "DOPOST", folio || folioIn, email, String(err)); } catch (logErr) {}
    if (pagoDeclarado && folioIn) {
      alertarPagoSinRegistrar_(ss || SpreadsheetApp.getActiveSpreadsheet(), folioIn, email, "Error interno: " + String(err));
      return errorPedido_("No pudimos registrar tu pedido, pero tu pago SÍ se recibió. Escríbenos por WhatsApp con tu ID de transacción " + folioIn + ".");
    }
    return errorPedido_("No pudimos registrar tu pedido. Escríbenos por WhatsApp para confirmarlo.");
  } finally {
    try { lock.releaseLock(); } catch (relErr) {}
  }
}

function tipoEnvioDe_(data) {
  var t = String(data.tipoEnvio || "");
  if (t === "courier" || t === "onDemand" || t === "pickup") return t;
  var n = String(data.tipoEntrega || "").toLowerCase();
  if (n.indexOf("paquet") !== -1 || n.indexOf("for\u00e1neo") !== -1 || n.indexOf("foraneo") !== -1) return "courier";
  if (n.indexOf("uber") !== -1 || n.indexOf("didi") !== -1) return "onDemand";
  return "pickup";
}

// ============================================================
// 6. CORREOS
// ============================================================

// Correo SEMÁFORO: verde = pagado (verificado) · amarillo = apartado (WhatsApp/transferencia) · naranja = pago PayPal por verificar.
// Los emojis del cuerpo van como entidades HTML (&#x...;) para que se vean bien en cualquier cliente de correo.
function enviarCorreoAdministradora_(ss, pedidosSheet, data, items, folio, descuentoAplicado, totalPagado, calle, colonia, cp, estadoDomicilio, notas, disenosLinks, stockReporte) {
  try {
    var pagado = esPagoConfirmado_(data.metodoPago);
    var porVerificar = esPorVerificar_(data.metodoPago);
    var tipoEnvio = tipoEnvioDe_(data);
    var cliente = String(data.cliente || "Cliente");
    var telefonoRaw = String(data.telefono || "").trim();
    var tel10 = normPhone(telefonoRaw);
    var linkWhatsApp = tel10.length === 10 ? ("https://wa.me/52" + tel10) : "";
    var correoCliente = String(data.email || "").trim();
    var linkHoja = ss.getUrl() + "#gid=" + pedidosSheet.getSheetId();

    // Asunto: solo emojis simples (✅ ⚠️ ⏳), que viajan bien en el encabezado del correo.
    var asunto = pagado
      ? "\u2705 [PAGO CONFIRMADO] Pedido #" + folio + " — Empacar y Enviar"
      : (porVerificar
        ? "\u26A0\uFE0F [VERIFICAR PAGO PAYPAL] Pedido #" + folio + " — Revisa antes de enviar"
        : "\u23F3 [PENDIENTE DE PAGO] Apartado #" + folio + " — Esperando WhatsApp / Comprobante");

    var tieneDomicilio = (tipoEnvio !== "pickup") && (calle || colonia || cp || estadoDomicilio);
    var domicilio = tieneDomicilio
      ? (calle + (colonia ? (", " + colonia) : "") + (data.zona ? (", " + data.zona) : "") + (estadoDomicilio ? (", " + estadoDomicilio) : "") + (cp ? (" CP " + cp) : ""))
      : (data.zona || "Por definir");
    var domicilioLabel = tieneDomicilio ? "Domicilio" : "Municipio / Zona";
    var notasLabel = tipoEnvio === "pickup" ? "Punto de encuentro" : "Referencias";

    var tareaVerde = tipoEnvio === "courier"
      ? "Tu única tarea: preparar el paquete con los datos de entrega que aparecen abajo y despacharlo a paquetería."
      : "Tu única tarea: preparar el pedido y coordinar la entrega con la clienta por WhatsApp (" + escHtml_(data.tipoEntrega || "entrega acordada") + ").";

    var botonWa = linkWhatsApp
      ? '<div style="text-align:center; margin-bottom:20px;">' +
          '<a href="' + linkWhatsApp + '" target="_blank" style="background-color:#25D366; color:#FFFFFF; padding:18px 34px; border-radius:40px; text-decoration:none; font-size:18px; font-weight:800; display:inline-block; box-shadow:0 4px 15px rgba(37,211,102,0.35);">&#x1F4AC; Abrir WhatsApp con ' + escHtml_(cliente) + '</a>' +
        '</div>'
      : '<p style="text-align:center; font-size:13px; color:#B71C1C; margin:0 0 20px;">&#x26A0;&#xFE0F; No se recibió un teléfono válido de la clienta; revisa la hoja "Pedidos".</p>';

    var bannerHtml;
    if (pagado) {
      bannerHtml =
        '<div style="background:#E8F5E9; border:2px solid #2E7D32; border-radius:12px; padding:18px 20px; margin-bottom:20px;">' +
          '<p style="margin:0 0 6px; font-size:18px; font-weight:800; color:#1B5E20;">&#x1F7E2; PAGO CONFIRMADO</p>' +
          '<p style="margin:0; font-size:14px; color:#1B5E20; line-height:1.6;">PayPal confirmó el pago por el monto correcto y el stock ya fue descontado. ' + tareaVerde + '</p>' +
        '</div>';
    } else if (porVerificar) {
      bannerHtml =
        '<div style="background:#FFF3E0; border:2px solid #EF6C00; border-radius:12px; padding:18px 20px; margin-bottom:20px;">' +
          '<p style="margin:0 0 6px; font-size:18px; font-weight:800; color:#BF360C;">&#x1F7E0; PAGO DE PAYPAL POR VERIFICAR</p>' +
          '<p style="margin:0 0 8px; font-size:14px; color:#BF360C; line-height:1.6;">La clienta dice haber pagado con PayPal, pero el sistema <strong>no pudo confirmarlo automáticamente</strong>. Entra a tu cuenta de PayPal y busca la orden <strong>' + escHtml_(folio) + '</strong> antes de enviar nada.</p>' +
          '<p style="margin:0; font-size:13px; color:#5C524B; line-height:1.6;">Motivo: ' + escHtml_(data.avisoPago || "sin detalle") + '</p>' +
        '</div>' + botonWa;
    } else {
      bannerHtml =
        '<div style="background:#FFF8E1; border:2px solid #F9A825; border-radius:12px; padding:18px 20px; margin-bottom:20px;">' +
          '<p style="margin:0 0 6px; font-size:18px; font-weight:800; color:#8D6100;">&#x1F7E1; PENDIENTE DE PAGO — APARTADO POR 24 HORAS</p>' +
          '<p style="margin:0; font-size:14px; color:#8D6100; line-height:1.6;">Es un apartado temporal: las piezas ya se apartaron del catálogo, pero <strong>todavía no hay pago</strong>. Escríbele a la clienta por WhatsApp y espera su comprobante.</p>' +
        '</div>' + botonWa +
        '<div style="background:#FFFFFF; border:1px dashed #F9A825; border-radius:10px; padding:14px 16px; margin-bottom:20px; font-size:13px; color:#5C524B; line-height:1.6;">' +
          '<strong>Recordatorio:</strong> Si la clienta no confirma su pago en 24 horas, entra a la hoja \'Pedidos\' y cambia el estado a \'Cancelado\' para devolver las piezas al catálogo automáticamente.' +
        '</div>';
    }

    var itemsHtml = items.map(function (i) {
      var sub = Number(i.precio || 0) * Number(i.qty || 0);
      var varTxt = i.variante ? (' <span style="color:#9E7B3B;">(' + escHtml_(i.variante) + ')</span>') : '';
      return '<tr><td style="padding:8px 0; font-size:14px; color:#1F1916; border-bottom:1px solid #ECE3D8;">• <strong>' + escHtml_(i.qty) + 'x</strong> ' + escHtml_(i.nombre) + varTxt + '</td>' +
             '<td style="padding:8px 0; font-size:14px; color:#1F1916; text-align:right; white-space:nowrap; border-bottom:1px solid #ECE3D8;">' + dinero_(sub) + '</td></tr>';
    }).join("");

    var descuentoHtml = descuentoAplicado > 0
      ? '<tr><td style="padding:8px 0; font-size:13px; color:#2E7D32;">Descuento (' + escHtml_(data.tipoDescuento || "Bienvenida") + ')</td><td style="padding:8px 0; font-size:13px; color:#2E7D32; text-align:right; white-space:nowrap;">-' + dinero_(descuentoAplicado) + '</td></tr>'
      : '';

    var agotadas = 0, stockFilasHtml = "", stockTexto = "";
    for (var s = 0; s < stockReporte.length; s++) {
      var sr = stockReporte[s];
      var etiquetaStock = escHtml_(sr.nombre) + (sr.variante ? (' (' + escHtml_(sr.variante) + ')') : '');
      var esCero = Number(sr.stock) <= 0;
      if (esCero) agotadas++;
      var textoStock = esCero ? ('&#x1F534; AGOTADA (' + sr.stock + ')') : ('Quedan ' + sr.stock);
      stockFilasHtml += '<tr><td style="padding:6px 0; font-size:13px; color:#1F1916; border-bottom:1px solid #ECE3D8;">' + etiquetaStock + '</td>' +
        '<td style="padding:6px 0; font-size:13px; text-align:right; white-space:nowrap; border-bottom:1px solid #ECE3D8; ' +
        (esCero ? 'color:#B71C1C; font-weight:800;' : 'color:#1F1916;') + '">' + textoStock + '</td></tr>';
      stockTexto += "\n - " + sr.nombre + (sr.variante ? (" (" + sr.variante + ")") : "") + ": " + (esCero ? ("AGOTADA (" + sr.stock + ")") : ("quedan " + sr.stock));
    }
    var stockHtml = stockReporte.length
      ? ('<div style="margin-bottom:20px;">' +
           '<p style="margin:0 0 8px; font-size:13px; font-weight:800; color:#1F1916; text-transform:uppercase; letter-spacing:0.05em;">&#x1F4CA; Stock restante tras esta compra</p>' +
           (agotadas > 0 ? '<p style="margin:0 0 8px; font-size:13px; color:#B71C1C; font-weight:700;">&#x26A0;&#xFE0F; ' + agotadas + (agotadas === 1 ? ' pieza quedó agotada' : ' piezas quedaron agotadas') + ' y ya se marcaron como "Agotado" en el catálogo.</p>' : '') +
           '<table style="width:100%; border-collapse:collapse;">' + stockFilasHtml + '</table>' +
         '</div>')
      : '';

    var avisoNotas = String(notas || "").indexOf("SIN STOCK SUFICIENTE") !== -1
      ? '<p style="margin:0 0 16px; font-size:13px; color:#B71C1C; font-weight:800;">&#x26A0;&#xFE0F; Esta clienta PAGÓ pero no había piezas suficientes: avísale y reembolsa (ver notas en la hoja Pedidos).</p>'
      : '';

    var cuerpo = '<div style="background-color:#FAF7F2; padding:24px 12px; font-family:Arial, sans-serif; color:#1F1916;">' +
      '<div style="max-width:600px; margin:0 auto; background:#FFFFFF; border:1px solid #ECE3D8; border-radius:16px; padding:24px 22px;">' +
        '<p style="margin:0 0 14px; font-size:12px; color:#9E7B3B; text-transform:uppercase; letter-spacing:0.15em; font-weight:700;">Carol Q · Pedido #' + escHtml_(folio) + '</p>' +
        bannerHtml + avisoNotas +
        '<p style="margin:0 0 8px; font-size:13px; font-weight:800; color:#1F1916; text-transform:uppercase; letter-spacing:0.05em;">&#x1F464; Datos de la clienta</p>' +
        '<div style="background:#FAF7F2; border:1px solid #DACBC0; border-radius:10px; padding:14px 16px; margin-bottom:20px; font-size:14px; line-height:1.8; color:#1F1916;">' +
          '<strong>Nombre:</strong> ' + escHtml_(cliente) + '<br>' +
          '<strong>Teléfono / WhatsApp:</strong> ' + escHtml_(telefonoRaw || "—") + '<br>' +
          (correoCliente ? ('<strong>Correo:</strong> ' + escHtml_(correoCliente) + '<br>') : '') +
          '<strong>Entrega:</strong> ' + escHtml_(data.tipoEntrega || "Punto acordado") + '<br>' +
          '<strong>' + domicilioLabel + ':</strong> ' + escHtml_(domicilio) + '<br>' +
          (notas && !avisoNotas ? ('<strong>' + notasLabel + ':</strong> ' + escHtml_(notas) + '<br>') : '') +
          '<strong>Método de pago:</strong> ' + escHtml_(data.metodoPago || "—") +
        '</div>' +
        '<p style="margin:0 0 8px; font-size:13px; font-weight:800; color:#1F1916; text-transform:uppercase; letter-spacing:0.05em;">&#x1F6CD;&#xFE0F; Artículos</p>' +
        '<table style="width:100%; border-collapse:collapse; margin-bottom:6px;">' +
          itemsHtml + descuentoHtml +
          '<tr><td style="padding:12px 0 4px; font-size:16px; font-weight:800; color:#1F1916;">' + (pagado ? 'Total pagado' : 'Total a cobrar') + '</td>' +
          '<td style="padding:12px 0 4px; font-size:18px; font-weight:800; color:#B87363; text-align:right; white-space:nowrap;">' + dinero_(totalPagado) + '</td></tr>' +
        '</table>' +
        '<div style="height:14px;"></div>' + stockHtml +
        '<div style="text-align:center; margin-top:8px;">' +
          '<a href="' + linkHoja + '" target="_blank" style="background-color:#1F1916; color:#FFFFFF; padding:13px 26px; border-radius:30px; text-decoration:none; font-size:14px; font-weight:700; display:inline-block;">&#x1F4C4; Abrir hoja de Pedidos</a>' +
        '</div>' +
      '</div>' +
    '</div>';

    // Texto plano (sin emojis)
    var encabezadoTxt = pagado
      ? "[PAGO CONFIRMADO] Pedido #" + folio + "\nPayPal confirmó el pago y el stock ya fue descontado. Prepara el paquete y despácha."
      : (porVerificar
        ? "[PAGO DE PAYPAL POR VERIFICAR] Pedido #" + folio + "\nRevisa la orden " + folio + " en tu cuenta de PayPal antes de enviar.\nMotivo: " + (data.avisoPago || "")
        : "[PENDIENTE DE PAGO] Apartado #" + folio + " (24 horas)\nEscríbele a la clienta y espera su comprobante." +
          (linkWhatsApp ? ("\nWhatsApp: " + linkWhatsApp) : "") +
          "\nSi no confirma en 24 horas, en la hoja 'Pedidos' cambia el estado a 'Cancelado' para devolver las piezas al catálogo.");
    var textoPlano = encabezadoTxt +
      "\n\nCliente: " + cliente + "\nTeléfono: " + telefonoRaw +
      "\nEntrega: " + (data.tipoEntrega || "") + "\n" + domicilioLabel + ": " + domicilio +
      (notas ? ("\n" + notasLabel + ": " + notas) : "") +
      "\nMétodo de pago: " + (data.metodoPago || "") +
      "\n\nArtículos:\n" + items.map(function (i) { return " - " + i.qty + "x " + i.nombre + (i.variante ? (" (" + i.variante + ")") : ""); }).join("\n") +
      "\n\nTotal: " + dinero_(totalPagado) +
      (stockTexto ? ("\n\nStock restante:" + stockTexto) : "") +
      "\n\nHoja de Pedidos: " + linkHoja;

    GmailApp.sendEmail(ADMIN_EMAIL, sinEmoji_(asunto), sinEmoji_(textoPlano), { htmlBody: aEntidades_(cuerpo), name: "Carol Q · Alertas de Pedido" });
  } catch (adminErr) {
    try { logError_(ss, "EMAIL_ADMIN", folio, ADMIN_EMAIL, adminErr.toString()); } catch (logErr) {}
  }
}

// Correo a la clienta. Los textos que vienen de la clienta ya llegan escapados desde doPost.
function enviarCorreoConfirmacion_(ss, data, items, folio, descuentoAplicado, totalPagado, calle, colonia, cp, estadoDomicilio, notas, disenosLinks) {
  try {
    var tipoEnvio = tipoEnvioDe_(data);
    var pagado = esPagoConfirmado_(data.metodoPago);
    var porVerificar = esPorVerificar_(data.metodoPago);
    var cliente = data.cliente || "Cliente";

    var emailSubject = pagado
      ? "Confirmación de tu pedido en Carol Q (#" + folio + ")"
      : (porVerificar ? "Recibimos tu pedido en Carol Q (#" + folio + ")" : "Tu pedido quedó apartado en Carol Q (#" + folio + ")");

    var itemsHtml = items.map(function (i) {
      var subtotalItem = Number(i.precio) * Number(i.qty);
      var etiquetaVariante = i.variante ? (' <span style="color:#9E7B3B;">(' + i.variante + ')</span>') : '';
      return '<tr><td style="padding: 10px 0; color: #1F1916; font-size: 14px; border-bottom: 1px solid #ECE3D8;">• <strong>' + i.qty + 'x</strong> ' + i.nombre + etiquetaVariante + '</td><td style="padding: 10px 0; text-align: right; color: #1F1916; font-size: 14px; font-weight: 600; white-space: nowrap; border-bottom: 1px solid #ECE3D8;">' + dinero_(subtotalItem) + '</td></tr>';
    }).join("");

    var discountHtml = descuentoAplicado > 0 ?
      '<tr><td style="padding: 10px 0; color: #2E7D32; font-size: 13px; border-bottom: 1px solid #ECE3D8;">Descuento Aplicado (' + escHtml_(data.tipoDescuento || 'Bienvenida') + ')</td><td style="padding: 10px 0; text-align: right; color: #2E7D32; font-size: 13px; font-weight: 600; white-space: nowrap; border-bottom: 1px solid #ECE3D8;">-' + dinero_(descuentoAplicado) + '</td></tr>' : "";

    var introTxt, saludoTxt, totalLabel;
    if (pagado) {
      introTxt = "Recibimos tu pago y estamos alistando tu paquete con mucho cariño. Aquí tienes el resumen:";
      saludoTxt = "¡Muchas gracias por tu compra, "; totalLabel = "Total Pagado";
    } else if (porVerificar) {
      introTxt = "Recibimos tu pedido y estamos confirmando tu pago de PayPal. Te escribiremos por WhatsApp en cuanto lo tengamos. Aquí tienes el resumen:";
      saludoTxt = "¡Muchas gracias por tu pedido, "; totalLabel = "Total";
    } else {
      introTxt = "Recibimos tu pedido y lo apartamos por 24 horas en espera de tu comprobante de pago (SPEI o depósito). Aquí tienes el resumen:";
      saludoTxt = "¡Muchas gracias por tu pedido, "; totalLabel = "Total a pagar";
    }

    var siguientePasoTxt;
    if (tipoEnvio === "courier") {
      siguientePasoTxt = pagado
        ? "En cuanto tu pedido salga, te mandaremos otro correo con tu número de guía para que puedas rastrearlo."
        : "Cuando confirmemos tu pago y tu paquete salga, te mandaremos otro correo con tu número de guía para que puedas rastrearlo.";
    } else if (tipoEnvio === "onDemand") {
      siguientePasoTxt = "Te escribiremos por WhatsApp para coordinar el envío por Uber/DiDi. El costo del viaje es según la tarifa de la app y está a cargo del cliente; por ahí mismo te compartiremos el seguimiento o la hora estimada de llegada.";
    } else {
      siguientePasoTxt = "Nos pondremos en contacto contigo por WhatsApp para acordar el lugar y la hora de entrega.";
    }

    var tieneDomicilio = (tipoEnvio !== "pickup") && (calle || colonia || cp || estadoDomicilio);
    var domicilioResumen = tieneDomicilio
      ? (calle + (colonia ? (', ' + colonia) : '') + (data.zona ? (', ' + data.zona) : '') + (estadoDomicilio ? (', ' + estadoDomicilio) : '') + (cp ? (' CP ' + cp) : ''))
      : (data.zona || 'Por definir');
    var domicilioLabel = tieneDomicilio ? "Domicilio" : "Zona";
    var notasLabel = tipoEnvio === "pickup" ? "Referencias / punto de encuentro" : "Referencias";

    // El botón de la comunidad solo aparece si la clienta la aceptó (checkbox opcional).
    var botonComunidad = data.comunidadVip === "Sí"
      ? '<div style="text-align: center; margin-bottom: 24px;">' +
          '<a href="https://chat.whatsapp.com/CTfAxQL63tuDrDGmJISIhP" target="_blank" style="background-color: #25D366; color: #FFFFFF; padding: 14px 28px; border-radius: 30px; text-decoration: none; font-size: 14px; font-weight: 700; display: inline-block; box-shadow: 0 4px 15px rgba(37,211,102,0.3);">Unirme a la Comunidad VIP de WhatsApp</a>' +
        '</div>'
      : '';

    var emailBody = '<div style="background-color: #FAF7F2; padding: 40px 20px; font-family: \'Plus Jakarta Sans\', Arial, sans-serif; color: #1F1916;">' +
      '<div style="max-width: 560px; margin: 0 auto; background: #FFFFFF; border: 1px solid #ECE3D8; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 30px rgba(31,25,22,0.08);">' +
        '<div style="text-align: center; padding: 32px 24px 20px; border-bottom: 1px solid #ECE3D8; background: #FFFFFF;">' +
          '<h2 style="font-family: Georgia, serif; font-size: 28px; color: #1F1916; margin: 0 0 6px; font-weight: 700;">Carol Q</h2>' +
          '<p style="font-size: 11px; color: #9E7B3B; text-transform: uppercase; letter-spacing: 0.15em; margin: 0; font-weight: 700;">Detalles especiales creados con significado</p>' +
        '</div>' +
        '<div style="padding: 30px 28px 24px;">' +
          '<p style="font-size: 16px; color: #1F1916; margin: 0 0 8px; font-weight: 700;">' + saludoTxt + cliente + '!</p>' +
          '<p style="font-size: 13px; color: #5C524B; margin: 0 0 24px; line-height: 1.6;">' + introTxt + '</p>' +
          '<div style="background: #FAF7F2; border: 1px solid #DACBC0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">' +
            '<table style="width: 100%; border-collapse: collapse;">' + itemsHtml + discountHtml +
              '<tr><td style="padding: 14px 0 4px; font-size: 16px; font-weight: 700; color: #1F1916;">' + totalLabel + '</td>' +
              '<td style="padding: 14px 0 4px; font-size: 18px; font-weight: 700; color: #B87363; text-align: right; white-space: nowrap;">' + dinero_(totalPagado) + '</td></tr>' +
            '</table>' +
            '<div style="margin-top: 16px; padding-top: 12px; border-top: 1px dashed #DACBC0; font-size: 12px; color: #5C524B; line-height: 1.5;">' +
              '<strong>Entrega:</strong> ' + escHtml_(data.tipoEntrega || 'Punto acordado') + '<br>' +
              '<strong>' + domicilioLabel + ':</strong> ' + domicilioResumen + '<br>' +
              (notas ? ('<strong>' + notasLabel + ':</strong> ' + notas + '<br>') : '') +
              '<strong>Folio de orden:</strong> #' + escHtml_(folio) +
            '</div>' +
          '</div>' +
          '<p style="font-size: 12px; color: #5C524B; text-align: center; margin: 0 0 20px; line-height: 1.6;">' + siguientePasoTxt + '</p>' +
          botonComunidad +
          '<p style="font-size: 11px; color: #9E9187; text-align: center; margin: 0; line-height: 1.5;">¿Tienes dudas con tu pedido? Escríbenos directamente a nuestro WhatsApp: 55 3552 2522.</p>' +
        '</div>' +
      '</div>' +
    '</div>';

    var plainTextBody = "Carol Q\n\n" + saludoTxt + String(cliente).replace(/&amp;/g, "&") + "!\n" + introTxt +
      "\n\nFolio: #" + folio + "\n" + totalLabel + ": " + dinero_(totalPagado) +
      "\nEntrega: " + (data.tipoEntrega || '') + "\n" + domicilioLabel + ": " + domicilioResumen +
      (notas ? ("\n" + notasLabel + ": " + notas) : "") +
      "\n\n" + siguientePasoTxt + "\n\n¿Dudas? Escríbenos a nuestro WhatsApp: 55 3552 2522.";

    GmailApp.sendEmail(data.email, sinEmoji_(emailSubject), sinEmoji_(plainTextBody), { htmlBody: aEntidades_(emailBody), name: "Carol Q Boutique" });
  } catch (emailError) {
    logError_(ss, "EMAIL", folio, data.email, emailError.toString());
  }
}

// ============================================================
// 7. HERRAMIENTAS PARA TI (ejecútalas desde el editor de Apps Script)
// ============================================================

// Crea (una sola vez) el activador "Al editar" que manda el correo de guía de rastreo.
function instalarDisparadores() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "onEditPedidoInstalable") { Logger.log("El activador ya existía. Nada que hacer."); return; }
  }
  ScriptApp.newTrigger("onEditPedidoInstalable").forSpreadsheet(ss).onEdit().create();
  Logger.log("Activador creado: onEditPedidoInstalable.");
}

// Revisa que el Sheet y la configuración estén en orden. Lee el resultado en Ver > Registros.
function diagnostico() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var problemas = [], avisos = [];
  var hojas = [["Hoja 1", DEF_HOJA1, true], ["Ventas", DEF_VENTAS, false], ["Pedidos", DEF_PEDIDOS, false]];
  for (var h = 0; h < hojas.length; h++) {
    var sh = ss.getSheetByName(hojas[h][0]);
    if (!sh) { (hojas[h][2] ? problemas : avisos).push("Falta la hoja '" + hojas[h][0] + "'" + (hojas[h][2] ? "" : " (se crea sola con el primer pedido).")); continue; }
    var m = mapaColumnas_(sh, hojas[h][1]);
    if (m._respaldo.length) avisos.push("'" + hojas[h][0] + "': no encontré el encabezado de " + m._respaldo.join(", ") + "; uso la posición original.");
    for (var k in m) if (m.hasOwnProperty(k) && k.charAt(0) !== "_" && m[k] < 0) problemas.push("'" + hojas[h][0] + "': falta la columna " + k + ".");
  }
  var inv = ss.getSheetByName("Hoja 1");
  if (inv && inv.getLastRow() > 1) {
    var mi = mapaColumnas_(inv, DEF_HOJA1), rows = inv.getDataRange().getValues(), vistos = {};
    for (var r = 1; r < rows.length; r++) {
      var id = idLimpio_(valor_(rows[r], mi, "ID"));
      if (!id) continue;
      if (vistos[id]) problemas.push("ID repetido en Hoja 1 (fila " + (r + 1) + "): " + id + " — esa fila NO se muestra en la tienda.");
      vistos[id] = true;
      if (!(Number(valor_(rows[r], mi, "PRECIO")) > 0)) avisos.push("Hoja 1 fila " + (r + 1) + " (" + id + "): sin precio válido; no se puede comprar.");
      if (!/^https:\/\//i.test(String(valor_(rows[r], mi, "FOTO")))) avisos.push("Hoja 1 fila " + (r + 1) + " (" + id + "): la foto no es un enlace https.");
    }
  }
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty("PAYPAL_CLIENT_ID") || !props.getProperty("PAYPAL_CLIENT_SECRET")) problemas.push("Faltan PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET: los pagos PayPal quedarán 'Por verificar'.");
  var hayTrigger = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === "onEditPedidoInstalable"; });
  if (!hayTrigger) problemas.push("No existe el activador de guías. Ejecuta instalarDisparadores().");
  Logger.log(problemas.length || avisos.length
    ? ("PROBLEMAS:\n- " + (problemas.join("\n- ") || "ninguno") + "\n\nAVISOS:\n- " + (avisos.join("\n- ") || "ninguno"))
    : "Todo en orden ✔");
  return { problemas: problemas, avisos: avisos };
}

// Manda UN correo de prueba a la administradora (no escribe nada en las hojas de ventas).
function probarCorreoAdmin() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ped = obtenerHoja_(ss, "Pedidos", PEDIDOS_HEADERS);
  var data = { cliente: "Prueba Emojis", telefono: "5512345678", email: "prueba@example.com",
    zona: "Nicolás Romero", tipoEntrega: ENTREGA_LABELS_.pickup, tipoEnvio: "pickup",
    metodoPago: "WhatsApp / Transferencia", tipoDescuento: "Ninguno", comunidadVip: "No", avisoPago: "" };
  var items = [{ id: "X", nombre: "Producto de prueba", variante: "Oro", departamento: "", precio: 280, qty: 1 }];
  enviarCorreoAdministradora_(ss, ped, data, items, "WA-PRUEBA", 0, 280, "", "", "", "", "", [],
    [{ nombre: "Producto de prueba", variante: "Oro", stock: 0 }]);
}