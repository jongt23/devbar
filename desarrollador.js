import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, onValue, get, set, update, push, remove, query, orderByChild, startAt, endAt } 
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// --- ESTADO GLOBAL ---
let locales = [];
let localActivo = null;
let currentApp = null;
let db = null;
let auth = null;

// Datos cargados en tiempo real del local activo
let mesasData = {};
let pedidosData = {};
let cartaData = {};
let categoriasData = {};
let historialData = {};
let seguridadData = {};
let localConfig = {};
let usuariosData = {};
let printServiceData = {};

// Ventas (Historial) - Variables de Consulta y Paginación
let ventasDataList = [];
let ventasPaginaActual = 1;
const VENTAS_POR_PAGINA = 15;

// ID de categoría seleccionada actualmente en el editor de carta
let categoriaSeleccionadaId = null;
// Mesa seleccionada en la vista de salón
let mesaSeleccionadaId = null;

// Ajustes del plano
let planoCfg = { cols: 16, rows: 12 };
let planoZonaActiva = null;

// Auditoría
let auditUnlocked = false;
let auditEventos = [];
let auditUsuarios = {};
let auditPaginaActual = 1;
const AUDIT_POR_PAGINA = 25;
const AUDIT_PWD_DEFAULT = "audit1234";

// --- INICIALIZACIÓN ---
document.addEventListener("DOMContentLoaded", () => {
  cargarLocales();
  renderLocales();
  
  // Exponer funciones globales para interactuar con botones del HTML
  window.abrirModalLocal = abrirModalLocal;
  window.cerrarModalLocal = cerrarModalLocal;
  window.guardarLocal = guardarLocal;
  window.seleccionarLocal = seleccionarLocal;
  window.eliminarLocal = eliminarLocal;
  window.editarLocal = editarLocal;
  
  window.cambiarPestana = cambiarPestana;
  window.deseleccionarMesa = deseleccionarMesa;
  window.seleccionarMesa = seleccionarMesa;

  window.abrirModalCategoria = abrirModalCategoria;
  window.cerrarModalCategoria = cerrarModalCategoria;
  window.guardarCategoria = guardarCategoria;
  window.seleccionarCategoria = seleccionarCategoria;

  window.abrirModalProducto = abrirModalProducto;
  window.cerrarModalProducto = cerrarModalProducto;
  window.guardarProducto = guardarProducto;
  window.editarProducto = editarProducto;
  window.eliminarProducto = eliminarProducto;

  window.guardarEstadoSeguridadWifi = guardarEstadoSeguridadWifi;

  // Nuevas funciones expuestas
  window.addCamarero = addCamarero;
  window.deleteCamarero = deleteCamarero;
  window.guardarDatosNegocio = guardarDatosNegocio;
  window.guardarAjustesTicket = guardarAjustesTicket;
  window.guardarConfigImpresoras = guardarConfigImpresoras;
  window.togglePausaImpresion = togglePausaImpresion;
  window.checkAuditPassword = checkAuditPassword;
  window.bloquearAuditoria = bloquearAuditoria;
  window.aplicarFiltrosAuditoria = aplicarFiltrosAuditoria;
  window.resetFiltrosAuditoria = resetFiltrosAuditoria;
  window.exportarAuditoriaCSV = exportarAuditoriaCSV;
  window.changeAuditPwd = changeAuditPwd;
  window.seleccionarZonaPlano = seleccionarZonaPlano;
  window.cerrarModalTicketDetalle = cerrarModalTicketDetalle;
  window.mostrarDetalleTicketHistorico = mostrarDetalleTicketHistorico;
  window.guardarLimiteCuota = guardarLimiteCuota;

  // Filtros y Paginación de Ventas
  window.aplicarFiltrosVentas = aplicarFiltrosVentas;
  window.resetFiltrosVentas = resetFiltrosVentas;
  window.cambiarPaginaVentas = cambiarPaginaVentas;

  // Paginación de Auditoría
  window.cambiarPaginaAuditoria = cambiarPaginaAuditoria;

  // Mobile helper bindings
  window.toggleSidebar = toggleSidebar;
  window.volverACategorias = volverACategorias;
});

// --- GESTIÓN DE LOCALES (LOCALSTORAGE) ---
function cargarLocales() {
  const raw = localStorage.getItem("dev_locales");
  if (raw) {
    try {
      locales = JSON.parse(raw);
    } catch {
      locales = [];
    }
  } else {
    locales = [];
  }
}

function guardarLocales() {
  localStorage.setItem("dev_locales", JSON.stringify(locales));
}

function renderLocales() {
  const container = document.getElementById("locales-container");
  container.innerHTML = "";
  
  if (locales.length === 0) {
    container.innerHTML = `<div style="text-align:center;color:var(--text-dim);font-size:12px;padding:20px 10px;">No hay locales añadidos.<br>Pulsa en "Añadir" para registrar tu primer local.</div>`;
    return;
  }
  
  locales.forEach(loc => {
    const isActivo = localActivo && localActivo.id === loc.id;
    const item = document.createElement("div");
    item.className = `local-item${isActivo ? ' active' : ''}`;
    item.onclick = (e) => {
      // Evitar que haga clic en el item al pulsar botones de acciones
      if (e.target.closest('.local-actions')) return;
      seleccionarLocal(loc.id);
    };
    
    const initials = loc.nombre ? loc.nombre.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : '??';
    item.innerHTML = `
      <div class="local-info">
        <div class="local-name">
          <div class="local-status-dot${isActivo ? ' connected' : ''}" id="dot-${loc.id}"></div>
          <span class="full-name">${loc.nombre}</span>
          <span class="short-name">${initials}</span>
        </div>
        <div class="local-url">${loc.databaseURL}</div>
      </div>
      <div class="local-actions">
        <button class="btn-icon" onclick="editarLocal('${loc.id}')" title="Editar">✏️</button>
        <button class="btn-icon delete" onclick="eliminarLocal('${loc.id}')" title="Eliminar">🗑️</button>
      </div>
    `;
    container.appendChild(item);
  });
}

// --- CONEXIÓN DINÁMICA A FIREBASE ---
async function seleccionarLocal(id) {
  const local = locales.find(l => l.id === id);
  if (!local) return;
  
  localActivo = local;
  renderLocales();
  
  // Cerrar sidebar y backdrop en móvil si se selecciona un local
  document.querySelector(".sidebar")?.classList.remove("open");
  document.querySelector(".sidebar-backdrop")?.classList.remove("show");
  
  // Mostrar dashboard
  document.getElementById("welcome-screen").style.display = "none";
  const dash = document.getElementById("active-dashboard");
  dash.style.display = "flex";
  
  // Poner etiquetas en cargando
  document.getElementById("label-nombre-local-activo").querySelector("span").textContent = `Conectando a ${local.nombre}...`;
  document.getElementById("active-status-dot").className = "local-status-dot";
  
  // Limpiar estados anteriores de UI
  deseleccionarMesa();
  categoriaSeleccionadaId = null;
  document.getElementById("categorias-container").innerHTML = "";
  document.getElementById("tabla-productos").style.display = "none";
  document.getElementById("placeholder-productos").style.display = "block";
  document.getElementById("btn-add-producto").style.display = "none";
  document.getElementById("label-categoria-seleccionada").textContent = "Selecciona una categoría";

  // Inicializar estados y controles de Ventas
  ventasDataList = [];
  ventasPaginaActual = 1;
  historialData = {};
  const hoy = new Date().toISOString().split("T")[0];
  
  const vIni = document.getElementById("ventas-fecha-ini");
  const vFin = document.getElementById("ventas-fecha-fin");
  if (vIni) vIni.value = hoy;
  if (vFin) vFin.value = hoy;

  const tbody = document.getElementById("ventas-tbody");
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center;color:var(--text-dim);padding:30px;">
          Presiona Filtrar para consultar el historial de ventas.
        </td>
      </tr>
    `;
  }
  document.getElementById("venta-total-recaudado").textContent = "0,00 €";
  document.getElementById("venta-total-tickets").textContent = "0";
  document.getElementById("venta-ticket-medio").textContent = "0,00 €";
  document.getElementById("ventas-paginacion-info").textContent = "Página 1 de 1";
  document.getElementById("btn-ventas-prev").disabled = true;
  document.getElementById("btn-ventas-next").disabled = true;

  // Inicializar estados y controles de Auditoría
  auditEventos = [];
  auditPaginaActual = 1;
  
  const aIni = document.getElementById("audit-fecha-ini");
  const aFin = document.getElementById("audit-fecha-fin");
  if (aIni) aIni.value = hoy;
  if (aFin) aFin.value = hoy;

  const auditLista = document.getElementById("audit-lista");
  if (auditLista) {
    auditLista.innerHTML = `<div style="font-size: 13px; color: var(--text-dim); text-align: center; padding: 30px;">Presiona Filtrar para consultar el registro.</div>`;
  }
  document.getElementById("audit-stat-eventos").textContent = "0";
  document.getElementById("audit-stat-eliminados").textContent = "0";
  document.getElementById("audit-stat-descuentos").textContent = "0";
  document.getElementById("audit-paginacion-info").textContent = "Página 1 de 1";
  document.getElementById("btn-audit-prev").disabled = true;
  document.getElementById("btn-audit-next").disabled = true;
  
  try {
    // Desconectar app previa si existe
    if (currentApp) {
      await deleteApp(currentApp);
      currentApp = null;
    }
    
    // Crear configuración del proyecto
    const config = {
      apiKey: local.apiKey,
      databaseURL: local.databaseURL,
      projectId: local.databaseURL.split('//')[1].split('.')[0]
    };
    
    currentApp = initializeApp(config, `app-${local.id}`);
    db = getDatabase(currentApp);
    auth = getAuth(currentApp);
    
    // Autenticación anónima para cumplir con las reglas de Firebase
    await signInAnonymously(auth);
    
    // Cambiar estado a conectado
    document.getElementById("label-nombre-local-activo").querySelector("span").textContent = local.nombre;
    document.getElementById("active-status-dot").className = "local-status-dot connected";
    document.getElementById(`dot-${local.id}`).className = "local-status-dot connected";
    
    // Activar escuchas en tiempo real
    suscribirseAFirebase();
    
  } catch (error) {
    console.error("Fallo al conectar a Firebase del local:", error);
    document.getElementById("label-nombre-local-activo").querySelector("span").textContent = `${local.nombre} (Error de conexion)`;
    document.getElementById("active-status-dot").className = "local-status-dot";
    alert(`No se pudo conectar a Firebase para ${local.nombre}.\nComprueba que la URL y la API Key sean válidas.`);
  }
}

// --- ESCUCHAS EN TIEMPO REAL ---
function suscribirseAFirebase() {
  if (!db) return;
  
  // 1. Escuchar Mesas
  onValue(ref(db, "mesas"), snap => {
    mesasData = snap.val() || {};
    renderPlanoMesas();
  });
  
  // 2. Escuchar Pedidos activos
  onValue(ref(db, "pedidos"), snap => {
    pedidosData = snap.val() || {};
    renderPlanoMesas();
    if (mesaSeleccionadaId) {
      mostrarDetalleMesa(mesaSeleccionadaId);
    }
  });
  
  // 3. Escuchar Categorías y Carta
  onValue(ref(db, "categorias"), snap => {
    categoriasData = snap.val() || {};
    renderCategorias();
  });
  
  onValue(ref(db, "carta"), snap => {
    cartaData = snap.val() || {};
    if (categoriaSeleccionadaId) {
      renderProductos(categoriaSeleccionadaId);
    }
  });
  
  // Historial de Ventas no se escucha en tiempo real para evitar consumos masivos de cuotas.
  // Se cargará bajo demanda mediante consultas por rango de fecha.
  
  // 5. Escuchar Seguridad y Wi-Fi
  onValue(ref(db, "config/seguridad"), snap => {
    seguridadData = snap.val() || {};
    actualizarAjustesSeguridad();
  });

  // 6. Escuchar Datos de Configuración del Local
  onValue(ref(db, "config/local"), snap => {
    localConfig = snap.val() || {};
    actualizarDatosConfigLocal();
  });

  // 7. Escuchar Camareros
  onValue(ref(db, "config/usuarios"), snap => {
    usuariosData = snap.val() || {};
    renderCamareros();
    poblarCamarerosAuditoria(usuariosData);
  });

  // 8. Escuchar Servicio de Impresión
  onValue(ref(db, "config/printService"), snap => {
    printServiceData = snap.val() || {};
    renderConfigImpresoras();
  });

  // 9. Escuchar Configuración del Plano
  onValue(ref(db, "config/plano"), snap => {
    const d = snap.val();
    if (d) {
      planoCfg = { cols: Number(d.cols) || 16, rows: Number(d.rows) || 12 };
    }
    renderPlanoMesas();
  });

  // 10. Escuchar Cuota de Firebase
  onValue(ref(db, "config/quota/lineas"), snap => {
    const val = snap.val();
    actualizarLimiteCuotaUI(val);
  });

  // 11. Escuchar Estadísticas de Consumo
  onValue(ref(db, "config/stats"), snap => {
    const val = snap.val() || {};
    renderEstadisticasConsumo(val);
  });
}

// --- AUXILIAR: TIEMPO DESDE PRIMERA COMANDA ACTIVA ---
function calcularTiempoOcupada(mid) {
  const envios = pedidosData[mid];
  if (!envios) return null;
  let minTs = Infinity;
  Object.values(envios).forEach(envio => {
    const envioTs = Number(envio.ts) || 0;
    if (envioTs > 0 && envioTs < minTs) minTs = envioTs;
  });
  if (minTs === Infinity) return null;
  const mins = Math.max(0, Math.floor((Date.now() - minTs) / 60000));
  const hrs = Math.floor(mins / 60);
  const mR = mins % 60;
  return hrs > 0 ? `${hrs}h ${mR}m` : `${mR}m`;
}

function seleccionarZonaPlano(zona) {
  planoZonaActiva = zona;
  renderPlanoMesas();
}

// --- VISTA: SALÓN (DIBUJO DE PLANO/GRID) ---
function renderPlanoMesas() {
  const wrapper = document.getElementById("salon-mesas-wrapper");
  wrapper.innerHTML = "";
  
  const entries = Object.entries(mesasData)
    .sort(([,a],[,b]) => (a.orden ?? 999) - (b.orden ?? 999) || a.nombre.localeCompare(b.nombre, 'es', { numeric: true }));

  if (entries.length === 0) {
    wrapper.innerHTML = `<div class="drawer-placeholder">No hay mesas configuradas en este local.</div>`;
    return;
  }

  // 1. Zonas
  const hayZonas = entries.some(([,m]) => m.zona && m.zona.trim());
  let zonas = [];
  if (hayZonas) {
    zonas = [...new Set(entries.map(([,m]) => (m.zona || "").trim()).filter(Boolean))];
    if (!planoZonaActiva || !zonas.includes(planoZonaActiva)) {
      planoZonaActiva = zonas[0];
    }
  }

  const mesasFiltradas = hayZonas
    ? entries.filter(([,m]) => (m.zona || "").trim() === planoZonaActiva)
    : entries;

  // Renderizar pestañas de zonas
  if (hayZonas) {
    const tabs = document.createElement("div");
    tabs.className = "plano-tabs";
    zonas.forEach(z => {
      const btn = document.createElement("button");
      btn.className = `plano-tab${z === planoZonaActiva ? ' active' : ''}`;
      btn.textContent = z;
      btn.onclick = () => seleccionarZonaPlano(z);
      tabs.appendChild(btn);
    });
    wrapper.appendChild(tabs);
  }

  // 2. Determinar si hay mesas ubicadas en plano
  const ubicadas = mesasFiltradas.filter(([,m]) => m.plano);
  const sinUbicar = mesasFiltradas.filter(([,m]) => !m.plano);

  if (ubicadas.length > 0) {
    // Renderizar Plano Gráfico en CSS Grid
    const planoContainer = document.createElement("div");
    planoContainer.className = "plano-wrap";
    
    const cols = planoCfg.cols || 16;
    const rows = planoCfg.rows || 12;
    
    const grid = document.createElement("div");
    grid.className = "plano-grid";
    grid.style.setProperty("--plano-cols", cols);
    grid.style.setProperty("--plano-rows", rows);
    
    mesasFiltradas.forEach(([mid, m]) => {
      const p = m.plano;
      if (!p) return; // Si no está ubicada en esta zona/plano
      
      const card = document.createElement("div");
      const tienePedido = pedidosData[mid] && Object.keys(pedidosData[mid]).length > 0;
      let claseAlerta = tienePedido ? "ocupada" : "libre";
      let tiempoOcupada = null;
      if (tienePedido) {
        tiempoOcupada = calcularTiempoOcupada(mid);
        let minTsPendiente = Infinity;
        let tienePendiente = false;
        
        Object.values(pedidosData[mid]).forEach(envio => {
          const envioTs = Number(envio.ts) || 0;
          const ls = envio.lineas || { _: envio };
          Object.values(ls).forEach(l => {
            if (l && l.estado === "pendiente") {
              tienePendiente = true;
              const lts = Number(l.ts) || envioTs || 0;
              if (lts > 0 && lts < minTsPendiente) minTsPendiente = lts;
            }
          });
        });
        
        if (tienePendiente && minTsPendiente < Infinity) {
          const minsPend = Math.max(0, Math.floor((Date.now() - minTsPendiente) / 60000));
          if (minsPend >= 20) {
            claseAlerta = "alerta-danger";
          } else if (minsPend >= 10) {
            claseAlerta = "alerta-warn";
          } else {
            claseAlerta = "alerta-ok";
          }
        }
      }
      
      const isCircle = p.shape === "circle" ? " circle" : "";
      card.className = `plano-mesa-grid ${claseAlerta}${isCircle}`;
      card.style.gridColumn = `${p.x} / span ${p.w}`;
      card.style.gridRow = `${p.y} / span ${p.h}`;
      
      // Calcular total e ítems usando cantidades y precios de comanda (precioTicket / qtyTicket si existen)
      let totalQty = 0;
      let subtotal = 0;
      if (tienePedido) {
        Object.values(pedidosData[mid]).forEach(env => {
          const ls = env.lineas || { _: env };
          Object.values(ls).forEach(l => {
            if (l && l.nombre && l.estado !== 'cancelado') {
              const qty = l.qtyTicket !== undefined && l.qtyTicket !== null
                ? Number(l.qtyTicket)
                : (l.estado === 'servido' ? Number(l.qty || 0) : (l.qtyServida !== undefined && l.qtyServida !== null ? Number(l.qtyServida) : Number(l.qty || 0)));
              const price = l.precioTicket !== undefined && l.precioTicket !== null
                ? Number(l.precioTicket)
                : (l.precio !== undefined && l.precio !== null ? Number(l.precio) : Number(cartaData[l.artId]?.precio || 0));
              if (qty > 0) {
                totalQty += qty;
                subtotal += (price * qty);
              }
            }
          });
        });
      }

      card.innerHTML = `
        <span class="plano-mesa-nombre">${m.nombre}</span>
        ${tienePedido ? `<span class="plano-mesa-sub">${totalQty} art. | ${subtotal.toFixed(2)}€</span>` : '<span class="plano-mesa-sub">Libre</span>'}
        ${tiempoOcupada ? `<span class="plano-mesa-tiempo-badge">⏳ ${tiempoOcupada}</span>` : ""}
      `;
      card.onclick = () => seleccionarMesa(mid);
      grid.appendChild(card);
    });
    
    planoContainer.appendChild(grid);
    wrapper.appendChild(planoContainer);
    
    // Si hay mesas sin ubicar en esta zona, mostrarlas al final
    if (sinUbicar.length > 0) {
      const sinUbicarDiv = document.createElement("div");
      sinUbicarDiv.className = "plano-sinubicar";
      sinUbicarDiv.style.marginTop = "12px";
      sinUbicarDiv.style.fontSize = "12px";
      sinUbicarDiv.style.color = "var(--text-dim)";
      sinUbicarDiv.innerHTML = `<strong>Mesas sin ubicar:</strong> ${sinUbicar.map(([,m]) => m.nombre).join(", ")}`;
      wrapper.appendChild(sinUbicarDiv);
    }
  } else {
    // Dibujar Grid Simple
    const grid = document.createElement("div");
    grid.className = "mesas-grid";
    
    mesasFiltradas.forEach(([mid, m]) => {
      const tienePedido = pedidosData[mid] && Object.keys(pedidosData[mid]).length > 0;
      const card = document.createElement("div");
      
      let claseAlerta = tienePedido ? "ocupada" : "libre";
      let tiempoOcupada = null;
      if (tienePedido) {
        tiempoOcupada = calcularTiempoOcupada(mid);
        let minTsPendiente = Infinity;
        let tienePendiente = false;
        
        Object.values(pedidosData[mid]).forEach(envio => {
          const envioTs = Number(envio.ts) || 0;
          const ls = envio.lineas || { _: envio };
          Object.values(ls).forEach(l => {
            if (l && l.estado === "pendiente") {
              tienePendiente = true;
              const lts = Number(l.ts) || envioTs || 0;
              if (lts > 0 && lts < minTsPendiente) minTsPendiente = lts;
            }
          });
        });
        
        if (tienePendiente && minTsPendiente < Infinity) {
          const minsPend = Math.max(0, Math.floor((Date.now() - minTsPendiente) / 60000));
          if (minsPend >= 20) {
            claseAlerta = "alerta-danger";
          } else if (minsPend >= 10) {
            claseAlerta = "alerta-warn";
          } else {
            claseAlerta = "alerta-ok";
          }
        }
      }
      
      card.className = `mesa-card ${claseAlerta}`;
      
      let totalQty = 0;
      let subtotal = 0;
      if (tienePedido) {
        Object.values(pedidosData[mid]).forEach(env => {
          const ls = env.lineas || { _: env };
          Object.values(ls).forEach(l => {
            if (l && l.nombre && l.estado !== 'cancelado') {
              const qty = l.qtyTicket !== undefined && l.qtyTicket !== null
                ? Number(l.qtyTicket)
                : (l.estado === 'servido' ? Number(l.qty || 0) : (l.qtyServida !== undefined && l.qtyServida !== null ? Number(l.qtyServida) : Number(l.qty || 0)));
              const price = l.precioTicket !== undefined && l.precioTicket !== null
                ? Number(l.precioTicket)
                : (l.precio !== undefined && l.precio !== null ? Number(l.precio) : Number(cartaData[l.artId]?.precio || 0));
              if (qty > 0) {
                totalQty += qty;
                subtotal += (price * qty);
              }
            }
          });
        });
      }
      
      card.innerHTML = `
        <div style="font-size:18px;margin-bottom:4px;">${m.nombre}</div>
        ${tienePedido ? `<div class="mesa-subtext">${totalQty} art. (${subtotal.toFixed(2)}€)</div>` : '<div class="mesa-subtext" style="color:var(--accent);">Libre</div>'}
        ${tiempoOcupada ? `<div class="plano-mesa-tiempo-badge">⏳ ${tiempoOcupada}</div>` : ""}
      `;
      card.onclick = () => seleccionarMesa(mid);
      grid.appendChild(card);
    });
    wrapper.appendChild(grid);
  }
}

// --- DETALLE DE MESA Y COMANDA ACTIVA ---
function seleccionarMesa(mid) {
  mesaSeleccionadaId = mid;
  mostrarDetalleMesa(mid);
}

function deseleccionarMesa() {
  mesaSeleccionadaId = null;
  document.getElementById("drawer-mesa-title").textContent = "Mesa sin seleccionar";
  document.getElementById("drawer-ticket-total").textContent = "0,00 €";
  document.getElementById("drawer-ticket-lines").innerHTML = `<div class="drawer-placeholder">Haz clic en una mesa ocupada para ver su comanda en tiempo real.</div>`;
}

function mostrarDetalleMesa(mid) {
  const mesa = mesasData[mid];
  if (!mesa) return;
  
  document.getElementById("drawer-mesa-title").textContent = `Mesa ${mesa.nombre}`;
  
  const container = document.getElementById("drawer-ticket-lines");
  container.innerHTML = "";
  
  const envios = pedidosData[mid];
  if (!envios || Object.keys(envios).length === 0) {
    container.innerHTML = `<div class="drawer-placeholder">Esta mesa no tiene comandas pendientes de cobro (Libre).</div>`;
    document.getElementById("drawer-ticket-total").textContent = "0,00 €";
    return;
  }
  
  let totalMesa = 0;
  let itemsCount = 0;
  
  // Agrupar líneas por nombre para consolidar el ticket del salón
  const lineasConsolidadas = {};
  
  Object.values(envios).forEach(env => {
    const ls = env.lineas || { _: env };
    Object.values(ls).forEach(l => {
      if (l && l.nombre && l.estado !== 'cancelado') {
        const qty = l.qtyTicket !== undefined && l.qtyTicket !== null
          ? Number(l.qtyTicket)
          : (l.estado === 'servido' ? Number(l.qty || 0) : (l.qtyServida !== undefined && l.qtyServida !== null ? Number(l.qtyServida) : Number(l.qty || 0)));
        const price = l.precioTicket !== undefined && l.precioTicket !== null
          ? Number(l.precioTicket)
          : (l.precio !== undefined && l.precio !== null ? Number(l.precio) : Number(cartaData[l.artId]?.precio || 0));

        if (qty <= 0) return;

        const key = `${l.nombre}_${price}_${l.nota || ''}`;
        if (!lineasConsolidadas[key]) {
          lineasConsolidadas[key] = {
            nombre: l.nombre,
            precio: price,
            qty: 0,
            nota: l.nota || ''
          };
        }
        lineasConsolidadas[key].qty += qty;
      }
    });
  });
  
  Object.values(lineasConsolidadas).forEach(l => {
    const totalLinea = l.precio * l.qty;
    totalMesa += totalLinea;
    itemsCount++;
    
    const div = document.createElement("div");
    div.className = "ticket-line-item";
    div.innerHTML = `
      <span class="line-qty">${l.qty}x</span>
      <div class="line-details">
        <div class="line-name">${l.nombre}</div>
        ${l.nota ? `<div class="line-note">${l.nota}</div>` : ''}
      </div>
      <span class="line-price">${totalLinea.toFixed(2)} €</span>
    `;
    container.appendChild(div);
  });
  
  if (itemsCount === 0) {
    container.innerHTML = `<div class="drawer-placeholder">No hay artículos en las comandas de esta mesa.</div>`;
  }
  
  document.getElementById("drawer-ticket-total").textContent = `${totalMesa.toFixed(2)} €`;
}

// --- VISTA: EDITOR DE CARTA ---
function renderCategorias() {
  const container = document.getElementById("categorias-container");
  container.innerHTML = "";
  
  const entries = Object.entries(categoriasData).sort((a,b) => (a[1].orden || 0) - (b[1].orden || 0));
  if (entries.length === 0) {
    container.innerHTML = `<div style="text-align:center;font-size:12px;color:var(--text-dim);padding:10px;">No hay categorías.</div>`;
    return;
  }
  
  entries.forEach(([cid, cat]) => {
    const isActiva = categoriaSeleccionadaId === cid;
    const btn = document.createElement("button");
    btn.className = `cat-btn${isActiva ? ' active' : ''}`;
    btn.onclick = () => seleccionarCategoria(cid);
    
    btn.innerHTML = `
      <span>${cat.nombre}</span>
      <div class="local-actions">
        <button class="btn-icon" onclick="event.stopPropagation(); abrirModalCategoria('${cid}', '${cat.nombre}')">✏️</button>
        <button class="btn-icon delete" onclick="event.stopPropagation(); eliminarCategoria('${cid}')">🗑️</button>
      </div>
    `;
    container.appendChild(btn);
  });
}

function seleccionarCategoria(cid) {
  categoriaSeleccionadaId = cid;
  renderCategorias();
  
  const cat = categoriasData[cid];
  document.getElementById("label-categoria-seleccionada").textContent = cat ? cat.nombre.toUpperCase() : "Artículos";
  
  document.getElementById("btn-add-producto").style.display = "block";
  document.getElementById("tabla-productos").style.display = "table";
  document.getElementById("placeholder-productos").style.display = "none";
  
  // Indicar que se ha entrado a ver la categoría activa en móvil
  document.querySelector(".carta-container")?.classList.add("has-active-cat");
  
  renderProductos(cid);
}

function renderProductos(cid) {
  const tbody = document.getElementById("productos-tbody");
  tbody.innerHTML = "";
  
  const productos = Object.entries(cartaData)
    .filter(([_, p]) => p.catId === cid)
    .sort((a,b) => (a[1].orden || 0) - (b[1].orden || 0));
    
  if (productos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text-dim);padding:20px;">No hay productos creados en esta categoría.</td></tr>`;
    return;
  }
  
  productos.forEach(([pid, p]) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="font-weight: 500;">${p.nombre}</td>
      <td class="table-price">${Number(p.precio || 0).toFixed(2)} €</td>
      <td style="text-transform: capitalize; color: var(--accent);">${p.destino || 'barra'}</td>
      <td style="text-align: right;">
        <button class="btn-icon" onclick="editarProducto('${pid}')" style="margin-right:8px;">✏️</button>
        <button class="btn-icon delete" onclick="eliminarProducto('${pid}')">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function parseFechaHoraTicket(fecha, hora = '00:00') {
  if (!fecha) return NaN;
  const fechaTxt = String(fecha).trim();
  const horaTxt = String(hora || '00:00').trim().slice(0, 5);

  if (/^\d{4}-\d{2}-\d{2}$/.test(fechaTxt)) {
    return new Date(`${fechaTxt}T${horaTxt}:00`).getTime();
  }

  const match = fechaTxt.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return NaN;

  const [, dd, mm, yyyy] = match;
  const iso = `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  return new Date(`${iso}T${horaTxt}:00`).getTime();
}

function normalizarTicketVenta(id, ticket = {}) {
  const base = ticket && typeof ticket === 'object' ? ticket : {};
  const tsNum = Number(base.ts);
  const ts = Number.isFinite(tsNum) && tsNum > 0
    ? tsNum
    : parseFechaHoraTicket(base.fecha, base.hora);
  return { id, ...base, ts };
}

// --- VISTA: HISTORIAL DE VENTAS ---
async function cargarVentasRango(fechaIni, fechaFin) {
  const ini = new Date(`${fechaIni}T00:00:00`);
  const fin = new Date(`${fechaFin}T23:59:59.999`);
  if (isNaN(ini.getTime()) || isNaN(fin.getTime())) return {};

  try {
    const snap = await get(ref(db, "historial"));
    const rawData = snap.val() || {};

    const filtered = {};
    const tsIni = ini.getTime();
    const tsFin = fin.getTime();

    for (const [id, t] of Object.entries(rawData)) {
      if (!t || typeof t !== 'object') continue;
      const normalized = normalizarTicketVenta(id, t);
      if (Number.isFinite(normalized.ts) && normalized.ts >= tsIni && normalized.ts <= tsFin) {
        filtered[id] = normalized;
      }
    }
    return filtered;
  } catch (error) {
    console.error("Error al cargar ventas en el rango:", error);
    return {};
  }
}


async function aplicarFiltrosVentas() {
  if (!db) return;

  const fechaIniInput = document.getElementById("ventas-fecha-ini");
  const fechaFinInput = document.getElementById("ventas-fecha-fin");
  let fechaIni = fechaIniInput.value;
  let fechaFin = fechaFinInput.value;

  if (!fechaIni || !fechaFin) {
    alert("Por favor selecciona un rango de fechas.");
    return;
  }

  const tbody = document.getElementById("ventas-tbody");
  tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-dim);padding:30px;">Cargando ventas...</td></tr>`;

  // Realizar lectura bajo demanda única
  historialData = await cargarVentasRango(fechaIni, fechaFin);
  
  // Transformar a lista para ordenamiento y paginación
  ventasDataList = Object.entries(historialData).map(([id, t]) => ({
    id,
    ...t
  }));

  // Ordenar cronológicamente descendiente
  ventasDataList.sort((a, b) => Number(b.ts || b.createdAt || 0) - Number(a.ts || a.createdAt || 0));

  // Calcular y actualizar estadísticas globales para el período seleccionado
  let recaudado = 0;
  let conteo = 0;
  ventasDataList.forEach(t => {
    recaudado += Number(t.total || 0);
    conteo++;
  });

  document.getElementById("venta-total-recaudado").textContent = `${recaudado.toFixed(2)} €`;
  document.getElementById("venta-total-tickets").textContent = conteo;
  document.getElementById("venta-ticket-medio").textContent = conteo ? `${(recaudado / conteo).toFixed(2)} €` : "0,00 €";

  ventasPaginaActual = 1;
  renderVentasPagina();
}

function renderVentasPagina() {
  const tbody = document.getElementById("ventas-tbody");
  tbody.innerHTML = "";

  if (ventasDataList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-dim);padding:30px;">No se registran ventas en el rango de fechas seleccionado.</td></tr>`;
    document.getElementById("ventas-paginacion-info").textContent = "Página 1 de 1";
    document.getElementById("btn-ventas-prev").disabled = true;
    document.getElementById("btn-ventas-next").disabled = true;
    return;
  }

  const totalPages = Math.ceil(ventasDataList.length / VENTAS_POR_PAGINA) || 1;
  
  // Limitar página actual a rango válido
  if (ventasPaginaActual < 1) ventasPaginaActual = 1;
  if (ventasPaginaActual > totalPages) ventasPaginaActual = totalPages;

  const startIdx = (ventasPaginaActual - 1) * VENTAS_POR_PAGINA;
  const endIdx = startIdx + VENTAS_POR_PAGINA;
  const pageTickets = ventasDataList.slice(startIdx, endIdx);

  pageTickets.forEach(t => {
    const total = Number(t.total || 0);
    // Formatear Fecha
    const ts = Number(t.createdAt || t.ts || 0);
    const fechaTxt = ts ? new Date(ts).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
    const metodo = t.pagoMetodo || (t.cobro ? 'Efectivo' : '—');

    const tr = document.createElement("tr");
    tr.style.cursor = "pointer";
    tr.onclick = () => mostrarDetalleTicketHistorico(t.id);
    tr.innerHTML = `
      <td>${fechaTxt}</td>
      <td style="font-weight:600;">${t.mesaNombre || t.mesa || '—'}</td>
      <td>${t.camarero || '—'}</td>
      <td style="text-transform: capitalize;">${metodo}</td>
      <td class="table-price" style="text-align: right; color: var(--accent); font-weight:600;">${total.toFixed(2)} €</td>
    `;
    tbody.appendChild(tr);
  });

  // Actualizar controles de paginación
  document.getElementById("ventas-paginacion-info").textContent = `Página ${ventasPaginaActual} de ${totalPages}`;
  document.getElementById("btn-ventas-prev").disabled = (ventasPaginaActual <= 1);
  document.getElementById("btn-ventas-next").disabled = (ventasPaginaActual >= totalPages);
}

function cambiarPaginaVentas(delta) {
  ventasPaginaActual += delta;
  renderVentasPagina();
}

function resetFiltrosVentas() {
  const hoy = new Date().toISOString().split("T")[0];
  document.getElementById("ventas-fecha-ini").value = hoy;
  document.getElementById("ventas-fecha-fin").value = hoy;
  
  ventasDataList = [];
  historialData = {};
  
  document.getElementById("ventas-tbody").innerHTML = `
    <tr>
      <td colspan="5" style="text-align:center;color:var(--text-dim);padding:30px;">
        Presiona Filtrar para consultar el historial de ventas.
      </td>
    </tr>
  `;
  document.getElementById("venta-total-recaudado").textContent = "0,00 €";
  document.getElementById("venta-total-tickets").textContent = "0";
  document.getElementById("venta-ticket-medio").textContent = "0,00 €";
  
  ventasPaginaActual = 1;
  document.getElementById("ventas-paginacion-info").textContent = "Página 1 de 1";
  document.getElementById("btn-ventas-prev").disabled = true;
  document.getElementById("btn-ventas-next").disabled = true;
}

// --- VISTA: AJUSTES DE SEGURIDAD ---
function actualizarAjustesSeguridad() {
  const isRestricted = boolCheck(seguridadData.wifiRestricted);
  document.getElementById("switch-wifi-restriction").checked = isRestricted;
  document.getElementById("config-wifi-ip").value = seguridadData.wifiIP || "No registrada";
}

function actualizarDatosConfigLocal() {
  if (!localConfig) return;
  // Business fields
  document.getElementById("local-nombre").value = localConfig.nombre || "";
  document.getElementById("local-cif").value = localConfig.cif || "";
  document.getElementById("local-telefono").value = localConfig.telefono || "";
  document.getElementById("local-direccion").value = localConfig.direccion || "";
  document.getElementById("local-footer").value = localConfig.footer || "";
  document.getElementById("local-comanda-auto-servir").value = String(localConfig.comandaAutoServir === true);

  // Ticket fields
  document.getElementById("local-ticket-paper").value = localConfig.ticketPaper || "58mm";
  document.getElementById("local-ticket-print-mode").value = localConfig.ticketPrintMode || "browser";
  document.getElementById("local-ticket-font-size").value = localConfig.ticketFontSize || 9;
  document.getElementById("local-ticket-header-name-size").value = localConfig.ticketHeaderNameFontSize || 12;
  document.getElementById("local-ticket-uppercase").value = String(localConfig.ticketUppercase === true);
  document.getElementById("local-ticket-show-notes").value = String(localConfig.ticketShowNotes !== false);
  document.getElementById("local-ticket-logo").value = localConfig.ticketLogoUrl || "";
}

async function guardarEstadoSeguridadWifi() {
  if (!db) return;
  const isChecked = document.getElementById("switch-wifi-restriction").checked;
  
  try {
    await update(ref(db, "config/seguridad"), {
      wifiRestricted: isChecked,
      updatedAt: Date.now()
    });
    console.log("Restricción Wi-Fi actualizada:", isChecked);
  } catch (error) {
    alert("Error al actualizar la configuración de seguridad.");
    document.getElementById("switch-wifi-restriction").checked = !isChecked; // Deshacer
  }
}

// --- MODALES Y CRUD DE LOCALES ---
function abrirModalLocal(id = null) {
  const modal = document.getElementById("modal-local");
  modal.classList.add("open");
  
  if (id) {
    // Editar
    const loc = locales.find(l => l.id === id);
    document.getElementById("modal-local-title").textContent = "Editar Local de Firebase";
    document.getElementById("form-local-id").value = loc.id;
    document.getElementById("form-local-nombre").value = loc.nombre;
    document.getElementById("form-local-dburl").value = loc.databaseURL;
    document.getElementById("form-local-apikey").value = loc.apiKey;
  } else {
    // Crear
    document.getElementById("modal-local-title").textContent = "Añadir Local de Firebase";
    document.getElementById("form-local-id").value = "";
    document.getElementById("form-local-nombre").value = "";
    document.getElementById("form-local-dburl").value = "";
    document.getElementById("form-local-apikey").value = "";
  }
}

function cerrarModalLocal() {
  document.getElementById("modal-local").classList.remove("open");
}

function guardarLocal() {
  const id = document.getElementById("form-local-id").value;
  const nombre = document.getElementById("form-local-nombre").value.trim();
  const dburl = document.getElementById("form-local-dburl").value.trim().replace(/\/$/, "");
  const apikey = document.getElementById("form-local-apikey").value.trim();
  
  if (!nombre || !dburl || !apikey) {
    alert("Por favor, rellena todos los campos.");
    return;
  }
  
  if (id) {
    // Actualizar existente
    const idx = locales.findIndex(l => l.id === id);
    if (idx !== -1) {
      locales[idx] = { id, nombre, databaseURL: dburl, apiKey: apikey };
    }
  } else {
    // Crear nuevo local
    const newId = `local_${Date.now()}`;
    locales.push({ id: newId, nombre, databaseURL: dburl, apiKey: apikey });
  }
  
  guardarLocales();
  renderLocales();
  cerrarModalLocal();
}

function eliminarLocal(id) {
  if (!confirm("¿Estás seguro de que quieres eliminar este local del panel de control?")) return;
  
  if (localActivo && localActivo.id === id) {
    localActivo = null;
    document.getElementById("active-dashboard").style.display = "none";
    document.getElementById("welcome-screen").style.display = "flex";
  }
  
  locales = locales.filter(l => l.id !== id);
  guardarLocales();
  renderLocales();
}

function editarLocal(id) {
  abrirModalLocal(id);
}

// --- CRUD DE CATEGORÍAS (CARTA) ---
function abrirModalCategoria(id = null, nombre = "") {
  document.getElementById("modal-categoria").classList.add("open");
  if (id) {
    document.getElementById("modal-cat-title").textContent = "Editar Categoría";
    document.getElementById("form-cat-id").value = id;
    document.getElementById("form-cat-nombre").value = nombre;
  } else {
    document.getElementById("modal-cat-title").textContent = "Añadir Categoría";
    document.getElementById("form-cat-id").value = "";
    document.getElementById("form-cat-nombre").value = "";
  }
}

function cerrarModalCategoria() {
  document.getElementById("modal-categoria").classList.remove("open");
}

async function guardarCategoria() {
  if (!db) return;
  const id = document.getElementById("form-cat-id").value;
  const nombre = document.getElementById("form-cat-nombre").value.trim();
  
  if (!nombre) return;
  
  try {
    if (id) {
      // Editar existente en Firebase
      await update(ref(db, `categorias/${id}`), { nombre });
    } else {
      // Crear nueva en Firebase
      const listRef = ref(db, "categorias");
      const newRef = push(listRef);
      // Calcular el orden
      const maxOrden = Object.values(categoriasData).reduce((max, c) => Math.max(max, c.orden || 0), 0);
      await set(newRef, {
        nombre,
        orden: maxOrden + 1
      });
    }
    cerrarModalCategoria();
  } catch (error) {
    alert("Error al guardar la categoría en Firebase.");
  }
}

async function eliminarCategoria(cid) {
  if (!db) return;
  const tieneProductos = Object.values(cartaData).some(p => p.catId === cid);
  if (tieneProductos) {
    alert("No se puede eliminar la categoría porque contiene artículos. Elimina o mueve los artículos primero.");
    return;
  }
  
  if (!confirm("¿Quieres eliminar esta categoría de forma permanente?")) return;
  
  try {
    await remove(ref(db, `categorias/${cid}`));
    if (categoriaSeleccionadaId === cid) {
      categoriaSeleccionadaId = null;
      document.getElementById("tabla-productos").style.display = "none";
      document.getElementById("placeholder-productos").style.display = "block";
      document.getElementById("btn-add-producto").style.display = "none";
      document.getElementById("label-categoria-seleccionada").textContent = "Selecciona una categoría";
    }
  } catch (error) {
    alert("Error al eliminar la categoría.");
  }
}

// --- CRUD DE PRODUCTOS (CARTA) ---
function abrirModalProducto() {
  document.getElementById("modal-producto").classList.add("open");
  document.getElementById("modal-prod-title").textContent = "Añadir Artículo";
  document.getElementById("form-prod-id").value = "";
  document.getElementById("form-prod-nombre").value = "";
  document.getElementById("form-prod-precio").value = "";
  document.getElementById("form-prod-destino").value = "barra";
}

function cerrarModalProducto() {
  document.getElementById("modal-producto").classList.remove("open");
}

function editarProducto(pid) {
  const p = cartaData[pid];
  if (!p) return;
  
  document.getElementById("modal-producto").classList.add("open");
  document.getElementById("modal-prod-title").textContent = "Editar Artículo";
  document.getElementById("form-prod-id").value = pid;
  document.getElementById("form-prod-nombre").value = p.nombre;
  document.getElementById("form-prod-precio").value = p.precio;
  document.getElementById("form-prod-destino").value = p.destino || "barra";
}

async function guardarProducto() {
  if (!db || !categoriaSeleccionadaId) return;
  
  const id = document.getElementById("form-prod-id").value;
  const nombre = document.getElementById("form-prod-nombre").value.trim();
  const precio = parseFloat(document.getElementById("form-prod-precio").value);
  const destino = document.getElementById("form-prod-destino").value;
  
  if (!nombre || isNaN(precio) || precio < 0) {
    alert("Por favor, rellena todos los campos correctamente.");
    return;
  }
  
  try {
    if (id) {
      // Editar
      await update(ref(db, `carta/${id}`), {
        nombre,
        precio,
        destino
      });
    } else {
      // Crear nuevo
      const newRef = push(ref(db, "carta"));
      // Orden del producto
      const maxOrden = Object.values(cartaData)
        .filter(p => p.catId === categoriaSeleccionadaId)
        .reduce((max, p) => Math.max(max, p.orden || 0), 0);
        
      await set(newRef, {
        catId: categoriaSeleccionadaId,
        nombre,
        precio,
        destino,
        orden: maxOrden + 1
      });
    }
    cerrarModalProducto();
  } catch (error) {
    alert("Error al guardar el producto en la base de datos.");
  }
}

async function eliminarProducto(pid) {
  if (!db) return;
  if (!confirm("¿Deseas eliminar este artículo de la carta permanentemente?")) return;
  
  try {
    await remove(ref(db, `carta/${pid}`));
  } catch (error) {
    alert("Error al eliminar el producto.");
  }
}

// --- NAVEGACIÓN Y PESTAÑAS ---
function cambiarPestana(paneId) {
  const tabs = document.querySelectorAll(".nav-tab");
  tabs.forEach(t => t.classList.remove("active"));
  
  // Buscar tab
  const btn = Array.from(tabs).find(t => t.getAttribute("onclick").includes(paneId));
  if (btn) btn.classList.add("active");
  
  const panes = document.querySelectorAll(".view-pane");
  panes.forEach(p => p.classList.remove("active"));
  
  document.getElementById(`pane-${paneId}`).classList.add("active");

  // Si entra a auditoría y ya estaba desbloqueado, inicializar filtros
  if (paneId === "auditoria") {
    if (sessionStorage.getItem("audit_unlocked") === "1") {
      desbloquearAuditoria();
    } else {
      bloquearAuditoria();
    }
  }
}

// --- GESTIÓN DE CAMAREROS (CRUD) ---
function renderCamareros() {
  const lista = document.getElementById("usuarios-lista");
  if (!lista) return;

  const entries = Object.entries(usuariosData || {});
  if (entries.length === 0) {
    lista.innerHTML = `<p style="font-size:13px;color:var(--text-dim);text-align:center;padding:20px;">Sin camareros registrados. Añade uno a la izquierda.</p>`;
    return;
  }

  lista.innerHTML = "";
  entries.forEach(([id, u]) => {
    const card = document.createElement("div");
    card.className = "camarero-card";
    card.innerHTML = `
      <div class="camarero-card-info">
        <span class="camarero-card-name">${u.nombre}</span>
        <span class="camarero-card-pin">PIN: ${u.pin}</span>
      </div>
      <button class="btn-icon delete" onclick="deleteCamarero('${id}')" title="Eliminar Camarero">🗑️</button>
    `;
    lista.appendChild(card);
  });
}

async function addCamarero() {
  if (!db) return;
  const nombre = document.getElementById("usr-nombre").value.trim();
  const pin = document.getElementById("usr-pin").value.trim();

  if (!nombre) {
    alert("Introduce el nombre del camarero.");
    return;
  }
  if (!/^\d{4}$/.test(pin)) {
    alert("El PIN debe constar de 4 números exactos.");
    return;
  }

  // Comprobar duplicado
  const duplicado = Object.values(usuariosData).find(u => u.pin === pin);
  if (duplicado) {
    alert(`El PIN ya está en uso por: ${duplicado.nombre}`);
    return;
  }

  try {
    await push(ref(db, "config/usuarios"), { nombre, pin });
    document.getElementById("usr-nombre").value = "";
    document.getElementById("usr-pin").value = "";
    alert("Camarero añadido con éxito.");
  } catch (err) {
    alert("Error al guardar en Firebase.");
  }
}

async function deleteCamarero(id) {
  if (!db) return;
  if (!confirm("¿Estás seguro de que quieres eliminar este camarero?")) return;

  try {
    await remove(ref(db, `config/usuarios/${id}`));
  } catch (err) {
    alert("Error al eliminar camarero.");
  }
}

// --- AJUSTES AVANZADOS (GUARDADO) ---
async function guardarDatosNegocio() {
  if (!db) return;
  const nombre = document.getElementById("local-nombre").value.trim();
  const cif = document.getElementById("local-cif").value.trim();
  const telefono = document.getElementById("local-telefono").value.trim();
  const direccion = document.getElementById("local-direccion").value.trim();
  const footer = document.getElementById("local-footer").value.trim();
  const autoServir = document.getElementById("local-comanda-auto-servir").value === "true";

  try {
    await update(ref(db, "config/local"), {
      nombre,
      cif,
      telefono,
      direccion,
      footer,
      comandaAutoServir: autoServir
    });
    alert("Datos del negocio guardados con éxito.");
  } catch (err) {
    alert("Error al guardar datos del negocio.");
  }
}

async function guardarAjustesTicket() {
  if (!db) return;
  const ticketPaper = document.getElementById("local-ticket-paper").value;
  const ticketPrintMode = document.getElementById("local-ticket-print-mode").value;
  const ticketFontSize = parseFloat(document.getElementById("local-ticket-font-size").value) || 9;
  const ticketHeaderNameFontSize = parseFloat(document.getElementById("local-ticket-header-name-size").value) || 12;
  const ticketUppercase = document.getElementById("local-ticket-uppercase").value === "true";
  const ticketShowNotes = document.getElementById("local-ticket-show-notes").value === "true";
  const ticketLogoUrl = document.getElementById("local-ticket-logo").value.trim();

  try {
    await update(ref(db, "config/local"), {
      ticketPaper,
      ticketPrintMode,
      ticketFontSize,
      ticketHeaderNameFontSize,
      ticketUppercase,
      ticketShowNotes,
      ticketLogoUrl
    });
    alert("Configuración de ticket guardada.");
  } catch (err) {
    alert("Error al guardar ajustes de ticket.");
  }
}

// --- SERVICIO DE IMPRESIÓN (PRINTER SERVICE) ---
function renderConfigImpresoras() {
  const paused = !!printServiceData.paused;
  const label = document.getElementById("ps-pausa-label");
  const btn = document.getElementById("btn-toggle-pausa");
  
  if (label) label.textContent = paused ? "Impresión en PAUSA" : "Servicio ACTIVO";
  if (btn) {
    btn.textContent = paused ? "Reanudar" : "Pausar";
    btn.className = paused ? "btn" : "btn btn-secondary";
  }

  const setPrinterVals = (type) => {
    const config = printServiceData[type] || {};
    const printerEl = document.getElementById(`ps-${type}-printer`);
    const enabledEl = document.getElementById(`ps-${type}-enabled`);
    const paperEl = document.getElementById(`ps-${type}-paper`);
    if (printerEl) printerEl.value = config.printerName || "";
    if (enabledEl) enabledEl.value = String(config.enabled !== false);
    if (paperEl) paperEl.value = config.paper || "58mm";
  };

  setPrinterVals("ticket");
  setPrinterVals("barra");
  setPrinterVals("cocina");
}

async function togglePausaImpresion() {
  if (!db) return;
  const current = !!printServiceData.paused;
  try {
    await set(ref(db, "config/printService/paused"), !current);
  } catch (err) {
    alert("Error al cambiar estado de pausa.");
  }
}

async function guardarConfigImpresoras() {
  if (!db) return;
  
  const getPrinterConfig = (type) => {
    return {
      enabled: document.getElementById(`ps-${type}-enabled`).value === "true",
      printerName: document.getElementById(`ps-${type}-printer`).value.trim(),
      paper: document.getElementById(`ps-${type}-paper`).value
    };
  };

  try {
    await update(ref(db, "config/printService"), {
      ticketFinal: getPrinterConfig("ticket"),
      barra: getPrinterConfig("barra"),
      cocina: getPrinterConfig("cocina")
    });
    alert("Impresoras guardadas con éxito.");
  } catch (err) {
    alert("Error al guardar impresoras.");
  }
}

// --- DETALLE DE TICKET HISTÓRICO (MODAL) ---
function mostrarDetalleTicketHistorico(tid) {
  const t = historialData[tid];
  if (!t) return;

  const modal = document.getElementById("modal-ticket-detalle");
  const body = document.getElementById("modal-ticket-detalle-body");
  
  const linesHtml = (t.lineas || []).map(l => {
    const subtotal = Number(l.precio || 0) * Number(l.qty || 0);
    return `
      <div style="display: flex; justify-content: space-between; font-size: 13px; border-bottom: 1px solid var(--border); padding: 8px 0;">
        <div style="flex: 1;">
          <strong>${l.qty}x</strong> ${l.nombre}
          ${l.nota ? `<div style="font-size: 11px; color: var(--warn); margin-top: 2px;">Nota: ${l.nota}</div>` : ""}
        </div>
        <div style="font-family: var(--font-code);">${subtotal.toFixed(2)} €</div>
      </div>
    `;
  }).join("");

  const ts = Number(t.createdAt || t.ts || 0);
  const fechaCompleta = ts ? new Date(ts).toLocaleString('es-ES') : `${t.fecha || ""} ${t.hora || ""}`;

  body.innerHTML = `
    <div style="margin-bottom: 16px; border-bottom: 1px dashed var(--border); padding-bottom: 12px; font-size: 13px; line-height: 1.5;">
      <div><strong>Mesa:</strong> ${t.mesaNombre || t.mesa || "—"}</div>
      <div><strong>Camarero:</strong> ${t.camarero || "—"}</div>
      <div><strong>Fecha/Hora:</strong> ${fechaCompleta}</div>
      <div><strong>Método de Pago:</strong> ${t.pagoMetodo || (t.cobro ? "Efectivo" : "—")}</div>
    </div>
    <div style="margin-bottom: 16px;">
      <h4 style="font-size: 13px; color: var(--accent); margin-bottom: 8px;">Consumo:</h4>
      ${linesHtml || '<div style="color: var(--text-dim); text-align: center;">Sin artículos registrados.</div>'}
    </div>
    <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: 700; border-top: 2px solid var(--accent); padding-top: 10px;">
      <span>TOTAL COBRADO:</span>
      <span style="color: var(--accent); font-family: var(--font-code);">${Number(t.total || 0).toFixed(2)} €</span>
    </div>
  `;

  modal.classList.add("open");
}

function cerrarModalTicketDetalle() {
  document.getElementById("modal-ticket-detalle").classList.remove("open");
}

// --- AUDITORÍA DE ACCIONES SENSIBLES ---
const AUDIT_LABELS = {
  articulo_agregado:   { label: 'Artículo añadido',     color: 'var(--accent)',    sensible: false },
  articulo_eliminado:  { label: 'Artículo ELIMINADO',   color: '#f87171',          sensible: true  },
  cantidad_editada:    { label: 'Cantidad editada',     color: '#fbbf24',          sensible: true  },
  descuento_aplicado:  { label: 'Descuento aplicado',   color: '#fbbf24',          sensible: true  },
  ticket_impreso:      { label: 'Ticket impreso',       color: '#60a5fa',          sensible: false },
  ticket_cobrado:      { label: 'Mesa cobrada',         color: 'var(--accent)',    sensible: false },
  factura_emitida:     { label: 'Factura emitida',      color: 'var(--accent)',    sensible: false },
  mesa_cerrada:        { label: 'Mesa cerrada',         color: 'var(--text-dim)',  sensible: false },
  mesa_transferida:    { label: 'Mesa transferida',     color: 'var(--text-dim)',  sensible: false }
};

async function checkAuditPassword() {
  const input = document.getElementById("audit-pwd-input");
  const error = document.getElementById("audit-pwd-error");
  const val = input.value.trim();

  let passwordCorrecta = AUDIT_PWD_DEFAULT;
  try {
    const snap = await get(ref(db, "config/audit/password"));
    if (snap.val()) passwordCorrecta = String(snap.val());
  } catch (e) {}

  if (val === passwordCorrecta) {
    error.style.display = "none";
    input.value = "";
    desbloquearAuditoria();
  } else {
    error.style.display = "block";
  }
}

function bloquearAuditoria() {
  auditUnlocked = false;
  sessionStorage.removeItem("audit_unlocked");
  document.getElementById("audit-locked").style.display = "flex";
  document.getElementById("audit-unlocked").style.display = "none";
}

function desbloquearAuditoria() {
  auditUnlocked = true;
  sessionStorage.setItem("audit_unlocked", "1");
  document.getElementById("audit-locked").style.display = "none";
  document.getElementById("audit-unlocked").style.display = "flex";
  
  // Set default dates (today)
  const hoy = new Date().toISOString().split("T")[0];
  document.getElementById("audit-fecha-ini").value = hoy;
  document.getElementById("audit-fecha-fin").value = hoy;

  poblarCamarerosAuditoria(usuariosData);
  aplicarFiltrosAuditoria();
}

function poblarCamarerosAuditoria(usuarios) {
  auditUsuarios = usuarios || {};
  const select = document.getElementById("audit-camarero");
  if (!select) return;
  
  const valActual = select.value;
  const nombres = Object.values(auditUsuarios)
    .map(u => u && u.nombre ? String(u.nombre) : null)
    .filter(Boolean)
    .sort((a,b) => a.localeCompare(b, 'es'));

  select.innerHTML = `<option value="">— Todos —</option>` +
    nombres.map(n => `<option value="${n}">${n}</option>`).join("");
  
  if (valActual && nombres.includes(valActual)) select.value = valActual;
}

async function leerEventosAuditoriaRango(fechaIni, fechaFin) {
  const ini = new Date(`${fechaIni}T00:00:00`);
  const fin = new Date(`${fechaFin}T00:00:00`);
  if (isNaN(ini.getTime()) || isNaN(fin.getTime())) return [];
  if (ini > fin) return [];

  const eventos = [];
  const cursor = new Date(ini);
  let safety = 90; // Límite de 90 días para evitar lecturas masivas

  while (cursor <= fin && safety-- > 0) {
    const yyyy = cursor.getFullYear();
    const mm = String(cursor.getMonth() + 1).padStart(2, "0");
    const dd = String(cursor.getDate()).padStart(2, "0");
    const dateKey = `${yyyy}-${mm}-${dd}`;

    try {
      const snap = await get(ref(db, `auditoria/${dateKey}`));
      const data = snap.val() || {};
      Object.entries(data).forEach(([id, ev]) => {
        if (ev && typeof ev === "object") {
          eventos.push({ id, dateKey, ...ev });
        }
      });
    } catch (_) {}
    cursor.setDate(cursor.getDate() + 1);
  }
  return eventos;
}

async function aplicarFiltrosAuditoria() {
  if (!auditUnlocked) return;
  
  const fechaIni = document.getElementById("audit-fecha-ini").value;
  const fechaFin = document.getElementById("audit-fecha-fin").value;
  const camFiltro = document.getElementById("audit-camarero").value || "";
  const accFiltro = document.getElementById("audit-accion").value || "";
  const mesaFiltro = document.getElementById("audit-mesa").value.trim().toLowerCase();

  const listContainer = document.getElementById("audit-lista");
  listContainer.innerHTML = `<div style="font-size: 13px; color: var(--text-dim); text-align: center; padding: 20px;">Cargando registros...</div>`;

  let eventos = await leerEventosAuditoriaRango(fechaIni, fechaFin);

  // Filtrar
  eventos = eventos.filter(ev => {
    if (camFiltro && ev.camarero !== camFiltro) return false;
    if (accFiltro && ev.accion !== accFiltro) return false;
    if (mesaFiltro) {
      const m = String(ev.mesa || "").toLowerCase();
      if (!m.includes(mesaFiltro)) return false;
    }
    return true;
  }).sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0));

  auditEventos = eventos;

  // Actualizar estadísticas
  document.getElementById("audit-stat-eventos").textContent = eventos.length;
  document.getElementById("audit-stat-eliminados").textContent = eventos.filter(e => e.accion === "articulo_eliminado").length;
  document.getElementById("audit-stat-descuentos").textContent = eventos.filter(e => e.accion === "descuento_aplicado").length;

  auditPaginaActual = 1;
  renderAuditoriaPagina();
}

function renderAuditoriaPagina() {
  const listContainer = document.getElementById("audit-lista");
  listContainer.innerHTML = "";

  if (auditEventos.length === 0) {
    listContainer.innerHTML = `<div style="font-size: 13px; color: var(--text-dim); text-align: center; padding: 20px;">Sin eventos que coincidan con los filtros.</div>`;
    document.getElementById("audit-paginacion-info").textContent = "Página 1 de 1";
    document.getElementById("btn-audit-prev").disabled = true;
    document.getElementById("btn-audit-next").disabled = true;
    return;
  }

  const totalPages = Math.ceil(auditEventos.length / AUDIT_POR_PAGINA) || 1;
  if (auditPaginaActual < 1) auditPaginaActual = 1;
  if (auditPaginaActual > totalPages) auditPaginaActual = totalPages;

  const startIdx = (auditPaginaActual - 1) * AUDIT_POR_PAGINA;
  const endIdx = startIdx + AUDIT_POR_PAGINA;
  const pageEvents = auditEventos.slice(startIdx, endIdx);

  // Renderizar cabecera de la lista
  listContainer.innerHTML = `
    <div class="audit-header">
      <div>Fecha / Hora</div>
      <div>Camarero</div>
      <div>Mesa</div>
      <div>Acción</div>
      <div>Detalle</div>
    </div>
  `;

  pageEvents.forEach(ev => {
    const info = AUDIT_LABELS[ev.accion] || { label: ev.accion || "—", color: "var(--text-dim)", sensible: false };
    const date = new Date(Number(ev.ts) || 0);
    const dateTxt = date.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "2-digit" });
    const timeTxt = ev.hora || date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    
    const div = document.createElement("div");
    div.className = "audit-item" + (info.sensible ? " sensible-log" : "");

    const importeStr = (ev.total !== undefined && ev.total !== null && !isNaN(Number(ev.total)))
      ? `<span style="font-family: var(--font-code); color: var(--accent); margin-left: 6px; font-weight: 500;">(${Number(ev.total).toFixed(2)}€)</span>`
      : "";

    div.innerHTML = `
      <div class="audit-col-time">${dateTxt}<br>${timeTxt}</div>
      <div class="audit-col-user">${ev.camarero || "—"}</div>
      <div class="audit-col-table">Mesa ${ev.mesa || "—"}</div>
      <div class="audit-col-action" style="color: ${info.color};">${info.label}</div>
      <div class="audit-col-detail">${ev.detalle || ""}${importeStr}</div>
    `;
    listContainer.appendChild(div);
  });

  // Actualizar controles de paginación
  document.getElementById("audit-paginacion-info").textContent = `Página ${auditPaginaActual} de ${totalPages}`;
  document.getElementById("btn-audit-prev").disabled = (auditPaginaActual <= 1);
  document.getElementById("btn-audit-next").disabled = (auditPaginaActual >= totalPages);
}

function cambiarPaginaAuditoria(delta) {
  auditPaginaActual += delta;
  renderAuditoriaPagina();
}

function resetFiltrosAuditoria() {
  const hoy = new Date().toISOString().split("T")[0];
  document.getElementById("audit-fecha-ini").value = hoy;
  document.getElementById("audit-fecha-fin").value = hoy;
  document.getElementById("audit-camarero").value = "";
  document.getElementById("audit-accion").value = "";
  document.getElementById("audit-mesa").value = "";
  aplicarFiltrosAuditoria();
}

function exportarAuditoriaCSV() {
  if (auditEventos.length === 0) {
    alert("No hay registros en el listado para exportar.");
    return;
  }

  const escapeCsv = (str) => `"${String(str || "").replace(/"/g, '""')}"`;
  
  let csv = "Fecha,Hora,Camarero,Mesa,Accion,Detalle,Total\n";
  auditEventos.forEach(ev => {
    const d = new Date(Number(ev.ts) || 0);
    const dateTxt = d.toLocaleDateString("es-ES");
    const timeTxt = ev.hora || d.toLocaleTimeString("es-ES");
    const label = (AUDIT_LABELS[ev.accion]?.label) || ev.accion || "";
    csv += `${escapeCsv(dateTxt)},${escapeCsv(timeTxt)},${escapeCsv(ev.camarero)},${escapeCsv(ev.mesa)},${escapeCsv(label)},${escapeCsv(ev.detalle)},${ev.total !== undefined ? ev.total : ""}\n`;
  });

  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  
  const ini = document.getElementById("audit-fecha-ini").value;
  const fin = document.getElementById("audit-fecha-fin").value;
  link.download = `auditoria_${ini}_a_${fin}.csv`;
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function changeAuditPwd() {
  if (!db) return;
  const val = document.getElementById("new-audit-pwd").value.trim();
  if (!val) {
    alert("Introduce una contraseña válida.");
    return;
  }

  try {
    await set(ref(db, "config/audit/password"), val);
    document.getElementById("new-audit-pwd").value = "";
    alert("Contraseña de auditoría actualizada.");
  } catch (err) {
    alert("Error al actualizar la contraseña en Firebase.");
  }
}

// --- AUXILIARES ---
function boolCheck(v) {
  return v === true || v === "true" || v === 1 || v === "1";
}

// --- GESTIÓN DE CUOTAS Y CONSUMOS ---
function actualizarLimiteCuotaUI(val) {
  const currentLimitEl = document.getElementById("quota-current-limit");
  const inputEl = document.getElementById("quota-limit-input");
  
  if (val === null) {
    if (currentLimitEl) currentLimitEl.textContent = "Sin configurar";
    if (inputEl) inputEl.value = "";
  } else if (val === -1) {
    if (currentLimitEl) currentLimitEl.textContent = "∞ Sin límite";
    if (inputEl) inputEl.value = -1;
  } else {
    if (currentLimitEl) currentLimitEl.textContent = `${val} líneas`;
    if (inputEl) inputEl.value = val;
  }
}

function renderEstadisticasConsumo(stats) {
  const listEl = document.getElementById("quota-monthly-list");
  const totalAccumulatedEl = document.getElementById("quota-total-accumulated");
  
  if (!listEl) return;
  
  const entries = Object.entries(stats).sort((a, b) => b[0].localeCompare(a[0]));
  if (entries.length === 0) {
    listEl.innerHTML = `<div style="text-align: center; color: var(--text-dim); font-size: 12px; padding: 10px;">Sin registros de uso mensual.</div>`;
    if (totalAccumulatedEl) totalAccumulatedEl.textContent = "0 líneas";
    return;
  }

  let totalLines = 0;
  listEl.innerHTML = "";
  
  entries.forEach(([monthKey, data]) => {
    const qty = Number(data.lineas || 0);
    totalLines += qty;
    
    const [year, month] = monthKey.split("-");
    const dateObj = new Date(year, month - 1, 1);
    const monthName = dateObj.toLocaleString("es-ES", { month: "long", year: "numeric" });
    
    const div = document.createElement("div");
    div.style.fontSize = "13px";
    div.style.display = "flex";
    div.style.flexDirection = "column";
    div.style.gap = "4px";
    
    div.innerHTML = `
      <div style="display: flex; justify-content: space-between;">
        <span style="text-transform: capitalize;">${monthName}</span>
        <strong>${qty.toLocaleString()} líneas</strong>
      </div>
      <div style="height: 4px; background-color: var(--border); border-radius: 2px; overflow: hidden;">
        <div style="height: 100%; width: ${Math.min(100, (qty / 1000) * 100)}%; background-color: var(--accent);"></div>
      </div>
    `;
    listEl.appendChild(div);
  });
  
  if (totalAccumulatedEl) {
    totalAccumulatedEl.textContent = `${totalLines.toLocaleString()} líneas`;
  }
}

async function guardarLimiteCuota() {
  if (!db) return;
  const inputVal = document.getElementById("quota-limit-input").value.trim();
  if (inputVal === "") {
    alert("Introduce un límite de líneas válido o -1 para ilimitado.");
    return;
  }
  
  const val = parseInt(inputVal);
  if (isNaN(val)) {
    alert("Introduce un valor numérico correcto.");
    return;
  }
  
  try {
    await set(ref(db, "config/quota/lineas"), val);
    alert("Límite de cuota actualizado con éxito.");
  } catch (err) {
    alert("Error al actualizar la cuota en Firebase.");
  }
}

// --- FUNCIONES RESPONSIVAS / MÓVIL ---
function toggleSidebar() {
  const sidebar = document.querySelector(".sidebar");
  const backdrop = document.querySelector(".sidebar-backdrop");
  if (sidebar && backdrop) {
    sidebar.classList.toggle("open");
    backdrop.classList.toggle("show");
  }
}

function volverACategorias() {
  categoriaSeleccionadaId = null;
  document.querySelector(".carta-container")?.classList.remove("has-active-cat");
  renderCategorias();
}
