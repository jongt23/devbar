import { ref, get, query, orderByChild, startAt, endAt } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const TIPOS_COMPLETOS = new Set(['F1', 'F3']);

const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
})[char]);

const fmtEu = value => `${Number(value || 0).toFixed(2).replace('.', ',')} €`;

function esFacturaCompleta(factura) {
  return TIPOS_COMPLETOS.has(String(factura?.tipo || '')) || Boolean(factura?.destinatario?.nif);
}

function fechaEnRango(factura, desde, hasta) {
  const ts = Number(factura?.ts || 0);
  if (!ts) return true;
  return (!desde || ts >= desde) && (!hasta || ts <= hasta);
}

function plantillaFactura(factura, local) {
  const destinatario = factura.destinatario || {};
  const lineasIva = Array.isArray(factura.lineasIva) ? factura.lineasIva : [];
  const empresa = local?.datosNegocio || local || {};
  const qr = factura.qr
    ? `<img class="qr" src="data:image/png;base64,${escapeHtml(factura.qr)}" alt="Código QR de verificación">`
    : '';
  const filasIva = lineasIva.map(linea => `
    <tr>
      <td>IVA ${escapeHtml(linea.tipo_impositivo || 0)}%</td>
      <td>${fmtEu(linea.base_imponible)}</td>
      <td>${fmtEu(linea.cuota_repercutida)}</td>
    </tr>`).join('') || '<tr><td colspan="3">Sin desglose de IVA disponible.</td></tr>';

  return `<main class="invoice"><header><div><div class="title">FACTURA</div><div class="muted">${escapeHtml(empresa.nombre || '')}<br>${escapeHtml(empresa.direccion || '')}<br>${empresa.cif ? `CIF/NIF: ${escapeHtml(empresa.cif)}` : ''}</div></div>
    <div style="text-align:right"><strong>N.º ${escapeHtml(factura.serie || '')}-${escapeHtml(factura.numero || '')}</strong><br><span class="muted">Fecha: ${escapeHtml(factura.fecha || '')}<br>Tipo: ${escapeHtml(factura.tipo || '')}</span></div></header>
    <section class="block"><div class="label">Destinatario</div><div class="recipient"><strong>${escapeHtml(destinatario.nombre || '—')}</strong><br><span class="muted">NIF/CIF: ${escapeHtml(destinatario.nif || '—')}<br>${escapeHtml(destinatario.direccion || '')}</span></div></section>
    <section class="block"><div class="label">Desglose de impuestos</div><table><thead><tr><th>Concepto</th><th>Base imponible</th><th>Cuota IVA</th></tr></thead><tbody>${filasIva}</tbody></table><div class="total"><span>Total</span><span>${fmtEu(factura.total)}</span></div></section>
    ${qr || factura.uuid ? `<section class="verification">${qr}<div class="muted">${factura.uuid ? `<strong>Identificador de verificación:</strong> ${escapeHtml(factura.uuid)}` : ''}</div></section>` : ''}
    </main>`;
}

function abrirDocumento(titulo, contenido) {
  const win = window.open('', '_blank');
  if (!win) {
    alert('Permite las ventanas emergentes para abrir las facturas.');
    return;
  }
  win.document.open();
  win.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8">
    <title>${escapeHtml(titulo)}</title>
    <style>
      *{box-sizing:border-box} body{font-family:Arial,sans-serif;color:#182033;margin:0;background:#f3f5f8}
      .bar{padding:14px;text-align:center;background:#182033}.bar button{padding:9px 16px;border:0;border-radius:7px;background:#d8ff61;color:#182033;font-weight:700;cursor:pointer}
      .invoice{width:min(210mm,100%);min-height:297mm;margin:20px auto;background:#fff;padding:18mm;box-shadow:0 2px 18px #0002}
      header{display:flex;justify-content:space-between;gap:20px;border-bottom:2px solid #182033;padding-bottom:14px}.title{font-size:25px;font-weight:800}.muted{color:#5e687b;font-size:12px;line-height:1.5}
      .block{margin-top:20px}.recipient{border:1px solid #d8dde7;padding:12px;border-radius:8px;max-width:310px}.label{font-size:11px;text-transform:uppercase;color:#5e687b;font-weight:700;letter-spacing:.04em}
      table{width:100%;border-collapse:collapse;margin-top:10px}th,td{padding:10px;border-bottom:1px solid #d8dde7;text-align:left}th{background:#f3f5f8;font-size:12px}td:nth-child(n+2),th:nth-child(n+2){text-align:right}
      .total{margin-top:18px;margin-left:auto;width:260px;display:flex;justify-content:space-between;border-top:2px solid #182033;padding:12px 0;font-size:20px;font-weight:800}.qr{width:110px;height:110px}.verification{margin-top:26px;display:flex;align-items:center;gap:16px;border-top:1px solid #d8dde7;padding-top:16px}
      @media print{body{background:#fff}.bar{display:none}.invoice{box-shadow:none;margin:0;width:auto;min-height:0;padding:0;break-after:page;page-break-after:always}.invoice:last-child{break-after:auto;page-break-after:auto}}
    </style></head><body><div class="bar"><button onclick="window.print()">Imprimir / Guardar como PDF</button></div>
    ${contenido}</body></html>`);
  win.document.close();
}

function abrirFactura(factura, local) {
  abrirDocumento(`Factura ${factura.serie || ''}-${factura.numero || ''}`, plantillaFactura(factura, local));
}

function abrirFacturasLote(facturas, local) {
  abrirDocumento(`Facturas ${facturas.length} seleccionadas`, facturas.map(factura => plantillaFactura(factura, local)).join(''));
}

function fechaVentaTs(venta) {
  const ts = Number(venta?.ts || venta?.createdAt || 0);
  if (ts) return ts;
  const match = String(venta?.fecha || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) return 0;
  const [, dia, mes, anyo] = match;
  return new Date(`${anyo}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}T${venta?.hora || '00:00'}:00`).getTime();
}

function fechaFacturaTs(factura) {
  const ts = Number(factura?.ts || 0);
  if (ts) return ts;
  const match = String(factura?.fecha || '').match(/(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (!match) return 0;
  const [, dia, mes, anyo] = match;
  return new Date(`${anyo}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}T12:00:00`).getTime();
}

// Las ventas nuevas llevan fbKey. Para facturas antiguas cuyo cierre sobrescribió
// esa referencia, se recupera de forma conservadora por fecha, mesa y total.
export function resolverFacturaVenta(venta, facturasPorClave = {}) {
  const fbKey = venta?.verifactu?.fbKey;
  if (fbKey && facturasPorClave[fbKey]) return facturasPorClave[fbKey];
  const tsVenta = fechaVentaTs(venta);
  const diaVenta = tsVenta ? new Date(tsVenta).toISOString().slice(0, 10) : '';
  const mesa = String(venta?.mesa || venta?.mesaNombre || '').trim();
  const total = Number(venta?.total || 0);
  const porFechaYTotal = Object.values(facturasPorClave).filter(factura => {
    const tsFactura = fechaFacturaTs(factura);
    const diaFactura = tsFactura ? new Date(tsFactura).toISOString().slice(0, 10) : '';
    return Number(factura?.total || 0) === total
      && diaFactura && diaFactura === diaVenta;
  });
  const candidatasMesa = porFechaYTotal.filter(factura => String(factura?.mesa || '').trim() === mesa);
  if (candidatasMesa.length === 1) return candidatasMesa[0];
  // Facturas estándar antiguas pueden no guardar la mesa. Solo se relaja el
  // criterio cuando fecha e importe identifican una única factura.
  if (porFechaYTotal.length === 1) return porFechaYTotal[0];
  // Último respaldo para historiales migrados cuyo formato de fecha difiere:
  // se acepta solo si ese importe identifica una única factura en todo el local.
  const porImporte = Object.values(facturasPorClave)
    .filter(factura => Number(factura?.total || 0) === total);
  return porImporte.length === 1 ? porImporte[0] : null;
}

// Fuente única para cualquier informe: vuelve a leer el historial y las
// facturas del período en el momento de exportar, evitando resúmenes en memoria
// desactualizados o con campos transformados por otra pantalla.
export async function cargarOperacionesFiscales(db, desde, hasta) {
  const ventasQuery = query(ref(db, 'historial'), orderByChild('ts'), startAt(desde), endAt(hasta));
  const [ventasSnap, facturasSnap] = await Promise.all([
    get(ventasQuery), get(ref(db, 'verifactu/facturas'))
  ]);
  const facturasPorClave = facturasSnap.val() || {};
  const ventas = Object.values(ventasSnap.val() || {})
    .filter(venta => {
      const ts = fechaVentaTs(venta);
      return ts >= desde && ts <= hasta;
    });
  return {
    facturasPorClave,
    operaciones: ventas.map(ticket => ({ ticket, factura: resolverFacturaVenta(ticket, facturasPorClave) }))
  };
}

function plantillaInformeGestoria({ ventas, facturasPorClave, local, desdeTexto, hastaTexto }) {
  const filas = ventas.map(venta => {
    const factura = resolverFacturaVenta(venta, facturasPorClave);
    const documento = factura
      ? `Factura ${escapeHtml(factura.serie || '')}-${escapeHtml(factura.numero || '')} · ${escapeHtml(factura.destinatario?.nombre || factura.tipo || '')}`
      : `Ticket · ${escapeHtml(venta.mesa || venta.mesaNombre || '—')}`;
    return `<tr><td>${escapeHtml(venta.fecha || new Date(fechaVentaTs(venta)).toLocaleDateString('es-ES'))}</td><td>${documento}</td><td>${fmtEu(venta.total)}</td></tr>`;
  }).join('');
  const total = ventas.reduce((suma, venta) => suma + Number(venta.total || 0), 0);
  const facturadas = ventas.filter(venta => resolverFacturaVenta(venta, facturasPorClave));
  const empresa = local?.datosNegocio || local || {};
  return `
    <main class="invoice"><header><div><div class="title">INFORME PARA GESTORÍA</div><div class="muted">${escapeHtml(empresa.nombre || '')}<br>Período: ${escapeHtml(desdeTexto || 'Inicio')} — ${escapeHtml(hastaTexto || 'Fin')}</div></div>
    <div style="text-align:right"><strong>${ventas.length} operaciones</strong><br><span class="muted">${facturadas.length} facturadas · ${ventas.length - facturadas.length} tickets</span></div></header>
    <section class="block"><div class="label">Relación única de operaciones</div><div class="muted" style="margin-top:6px">Las ventas con factura se muestran por su número de factura; no se duplican como ticket.</div>
    <table><thead><tr><th>Fecha</th><th>Documento</th><th>Total</th></tr></thead><tbody>${filas || '<tr><td colspan="3">No hay ventas en el período.</td></tr>'}</tbody></table><div class="total"><span>Total período</span><span>${fmtEu(total)}</span></div></section></main>`;
}

async function generarPdfGestoria({ getDb, resultado }) {
  const db = getDb();
  if (!db) { resultado.textContent = 'Selecciona primero un local.'; return; }
  const desdeInput = document.getElementById('venta-desde') || document.getElementById('ventas-fecha-ini');
  const hastaInput = document.getElementById('venta-hasta') || document.getElementById('ventas-fecha-fin');
  const desde = desdeInput?.value ? new Date(`${desdeInput.value}T00:00:00`).getTime() : 0;
  const hasta = hastaInput?.value ? new Date(`${hastaInput.value}T23:59:59.999`).getTime() : Date.now();
  resultado.textContent = 'Preparando PDF consolidado…';
  try {
    const [{ operaciones, facturasPorClave }, localSnap] = await Promise.all([
      cargarOperacionesFiscales(db, desde, hasta), get(ref(db, 'config/local'))
    ]);
    const ventas = operaciones.map(item => item.ticket).sort((a, b) => fechaVentaTs(a) - fechaVentaTs(b));
    if (!ventas.length) { resultado.textContent = 'No hay ventas en el período seleccionado.'; return; }
    const contenido = plantillaInformeGestoria({ ventas, facturasPorClave, local: localSnap.val() || {}, desdeTexto: desdeInput?.value, hastaTexto: hastaInput?.value });
    abrirDocumento(`Gestoría ${desdeInput?.value || ''} ${hastaInput?.value || ''}`, contenido);
    resultado.textContent = 'PDF consolidado abierto en una nueva pestaña.';
  } catch (error) {
    console.error('No se pudo generar el PDF de gestoría:', error);
    resultado.textContent = 'No se pudo generar el PDF consolidado. Comprueba la conexión.';
  }
}

export function montarConsultaFacturas({ getDb, elementId }) {
  const host = document.getElementById(elementId);
  if (!host || host.dataset.facturasMontadas === '1') return;
  host.dataset.facturasMontadas = '1';

  host.innerHTML = `
    <div style="margin-top:18px;padding:14px;border:1px solid var(--border);border-radius:12px;background:var(--panel-light,var(--surface2))">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <div><strong>Facturas completas emitidas</strong><div style="font-size:12px;color:var(--text-dim,var(--muted));margin-top:3px">Consulta, abre e imprime las facturas con destinatario.</div></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn-action btn-facturas-cargar">Ver facturas</button><button type="button" class="btn-action btn-gestoria-consolidado" style="background:var(--panel-light);border:1px solid var(--border);color:var(--text)">PDF gestoría consolidado</button></div>
      </div>
      <div class="facturas-resultado" style="margin-top:12px;font-size:13px;color:var(--text-dim,var(--muted))">Pulsa “Ver facturas” para cargarlas.</div>
    </div>`;

  const resultado = host.querySelector('.facturas-resultado');
  host.querySelector('.btn-gestoria-consolidado').addEventListener('click', () => generarPdfGestoria({ getDb, resultado }));
  host.querySelector('.btn-facturas-cargar').addEventListener('click', async () => {
    const db = getDb();
    if (!db) { resultado.textContent = 'Selecciona primero un local.'; return; }
    resultado.textContent = 'Cargando facturas…';
    try {
      const [facturasSnap, localSnap] = await Promise.all([
        get(ref(db, 'verifactu/facturas')),
        get(ref(db, 'config/local'))
      ]);
      const desdeInput = document.getElementById('venta-desde') || document.getElementById('ventas-fecha-ini');
      const hastaInput = document.getElementById('venta-hasta') || document.getElementById('ventas-fecha-fin');
      const desde = desdeInput?.value ? new Date(`${desdeInput.value}T00:00:00`).getTime() : 0;
      const hasta = hastaInput?.value ? new Date(`${hastaInput.value}T23:59:59.999`).getTime() : 0;
      const local = localSnap.val() || {};
      const facturas = Object.values(facturasSnap.val() || {})
        .filter(esFacturaCompleta)
        .filter(factura => fechaEnRango(factura, desde, hasta))
        .sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0));

      if (!facturas.length) { resultado.textContent = 'No hay facturas completas en el período seleccionado.'; return; }
      resultado.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 0 10px;border-bottom:1px solid var(--border)">
          <label style="display:flex;align-items:center;gap:7px;cursor:pointer"><input type="checkbox" class="factura-seleccionar-todas"> Seleccionar todas</label>
          <button type="button" class="btn-action factura-pdf-lote" disabled style="width:auto;padding:8px 10px">Generar PDF (0)</button>
        </div>
        ${facturas.map((factura, index) => `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0;border-top:1px solid var(--border)">
          <label style="display:flex;align-items:center;gap:9px;min-width:0;cursor:pointer"><input type="checkbox" class="factura-seleccion" data-factura-index="${index}"><span><strong>${escapeHtml(factura.serie || '?')}-${escapeHtml(factura.numero || '?')}</strong> · ${escapeHtml(factura.destinatario?.nombre || 'Destinatario')}<br><span style="font-size:11px;color:var(--text-dim,var(--muted))">${escapeHtml(factura.fecha || '—')} · ${escapeHtml(factura.destinatario?.nif || '—')} · ${fmtEu(factura.total)}</span></span></label>
          <button type="button" class="btn-action" data-factura-index="${index}" style="width:auto;padding:8px 10px">Abrir / imprimir</button>
        </div>`).join('')}`;
      resultado.querySelectorAll('button[data-factura-index]').forEach(button => button.addEventListener('click', () => abrirFactura(facturas[Number(button.dataset.facturaIndex)], local)));
      const checks = [...resultado.querySelectorAll('.factura-seleccion')];
      const selectAll = resultado.querySelector('.factura-seleccionar-todas');
      const pdfLote = resultado.querySelector('.factura-pdf-lote');
      const actualizarSeleccion = () => {
        const seleccionadas = checks.filter(check => check.checked);
        selectAll.checked = seleccionadas.length === checks.length;
        selectAll.indeterminate = seleccionadas.length > 0 && seleccionadas.length < checks.length;
        pdfLote.disabled = !seleccionadas.length;
        pdfLote.textContent = `Generar PDF (${seleccionadas.length})`;
      };
      selectAll.addEventListener('change', () => { checks.forEach(check => { check.checked = selectAll.checked; }); actualizarSeleccion(); });
      checks.forEach(check => check.addEventListener('change', actualizarSeleccion));
      pdfLote.addEventListener('click', () => abrirFacturasLote(checks.filter(check => check.checked).map(check => facturas[Number(check.dataset.facturaIndex)]), local));
    } catch (error) {
      console.error('No se pudieron cargar las facturas:', error);
      resultado.textContent = 'No se pudieron cargar las facturas. Comprueba la conexión.';
    }
  });
}
