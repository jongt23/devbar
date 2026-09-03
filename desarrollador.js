import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, onValue, get, query, orderByChild, startAt, endAt,
  set as fbSet, push as fbPush, remove as fbRemove, update as fbUpdate } 
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import qrcode from "./qrcode.mjs";
import { montarConsultaFacturas, cargarOperacionesFiscales } from './facturas-completas.js';

const checkAndTouchMenu = (refVal) => {
  if (!refVal) return;
  const url = refVal.toString();
  if (url.includes('/carta') || url.includes('/categorias') || url.includes('carta') || url.includes('categorias')) {
    fbSet(ref(db, 'config/menu_version'), Date.now()).catch(err => console.error(err));
  }
};

const set = (refVal, data) => {
  const res = fbSet(refVal, data);
  checkAndTouchMenu(refVal);
  return res;
};

const push = (refVal, data) => {
  const res = fbPush(refVal, data);
  checkAndTouchMenu(refVal);
  return res;
};

const remove = (refVal) => {
  const res = fbRemove(refVal);
  checkAndTouchMenu(refVal);
  return res;
};

const update = (refVal, data) => {
  const res = fbUpdate(refVal, data);
  if (data && typeof data === 'object') {
    const keys = Object.keys(data);
    if (keys.some(k => k.startsWith('carta') || k.startsWith('categorias'))) {
      fbSet(ref(db, 'config/menu_version'), Date.now()).catch(err => console.error(err));
    }
  }
  checkAndTouchMenu(refVal);
  return res;
};
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
let sesionesCamarerosData = {};
let selectedEmojisDev = [];
const EMOJI_LIST = ['🍔', '🍺', '🍕', '🍷', '☕', '🍰', '🍦', '🍟', '🌮', '🥗'];
let printServiceData = {};
let novedadesData = {};

// Ventas (Historial) - Variables de Consulta y Paginación
let ventasDataList = [];
let ventasPaginaActual = 1;
const VENTAS_POR_PAGINA = 15;

// Informe comercial para el propietario: solo se llena tras una consulta manual.
let propietarioTickets = [];
let propietarioRanking = [];
let propietarioConsultaRealizada = false;
let propietarioCategoriasIncluidas = null;
let propietarioCategoriasAntesEdicion = null;

// ID de categoría seleccionada actualmente en el editor de carta
let categoriaSeleccionadaId = null;
let currentCatVarsDev = [];
let currentProdVarsDev = [];
let currentProdComboGroupsDev = [];
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
  montarConsultaFacturas({ getDb: () => db, elementId: 'facturas-completas-desarrollador' });
  
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
  window.moverArt = moverArt;
  window.moverCat = moverCat;
  
  window.agregarVarianteCategoriaDev = agregarVarianteCategoriaDev;
  window.eliminarVarianteCategoriaDev = eliminarVarianteCategoriaDev;
  window.agregarVarianteProductoDev = agregarVarianteProductoDev;
  window.eliminarVarianteProductoDev = eliminarVarianteProductoDev;
  window.toggleComboPanelDev = toggleComboPanelDev;
  window.agregarGrupoComboDev = agregarGrupoComboDev;
  window.eliminarGrupoComboDev = eliminarGrupoComboDev;
  window.agregarOpcionComboDev = agregarOpcionComboDev;
  window.eliminarOpcionComboDev = eliminarOpcionComboDev;

  window.guardarEstadoSeguridadWifi = guardarEstadoSeguridadWifi;
  window.guardarEstadoBloqueoCamarerosDev = guardarEstadoBloqueoCamarerosDev;
  window.guardarExcepcionCamareroDev = guardarExcepcionCamareroDev;
  window.guardarEstadoEncargadoDev = guardarEstadoEncargadoDev;
  window.guardarPassEncargadoDev = guardarPassEncargadoDev;
  window.guardarPassAuditDev = guardarPassAuditDev;
  window.toggleCamareroActivoDev = toggleCamareroActivoDev;
  window.cerrarSesionCamareroDev = cerrarSesionCamareroDev;
  window.seleccionarEmojiDev = seleccionarEmojiDev;
  window.limpiarEmojisDev = limpiarEmojisDev;
  window.guardarEmojisDev = guardarEmojisDev;
  window.showCustomAlert = showCustomAlert;
  window.showCustomConfirm = showCustomConfirm;
  window.showCustomPrompt = showCustomPrompt;
  window.cerrarCustomModal = cerrarCustomModal;

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
  window.guardarNovedadConfig = guardarNovedadConfig;
  window.resetearVistosNovedad = resetearVistosNovedad;
  window.limpiarNovedadForm = limpiarNovedadForm;
  window.cargarNovedadForm = cargarNovedadForm;
  window.eliminarNovedad = eliminarNovedad;

  // Filtros y Paginación de Ventas
  window.aplicarFiltrosVentas = aplicarFiltrosVentas;
  window.resetFiltrosVentas = resetFiltrosVentas;
  window.cambiarPaginaVentas = cambiarPaginaVentas;

  // Informe comercial para propietario
  window.consultarInformePropietario = consultarInformePropietario;
  window.actualizarInformePropietario = actualizarInformePropietario;
  window.invalidarConsultaInformePropietario = invalidarConsultaInformePropietario;
  window.exportarPDFInformePropietario = exportarPDFInformePropietario;
  window.toggleSelectorCategoriasPropietario = toggleSelectorCategoriasPropietario;
  window.toggleCategoriaInformePropietario = toggleCategoriaInformePropietario;
  window.seleccionarTodasCategoriasPropietario = seleccionarTodasCategoriasPropietario;
  window.aplicarSelectorCategoriasPropietario = aplicarSelectorCategoriasPropietario;
  window.cancelarSelectorCategoriasPropietario = cancelarSelectorCategoriasPropietario;

  // Paginación de Auditoría
  window.cambiarPaginaAuditoria = cambiarPaginaAuditoria;
  window.toggleAuditFilters = toggleAuditFilters;

  // Gestoría y Ajuste Inteligente de Facturación
  window.setQuickFiltroGestoria = setQuickFiltroGestoria;
  window.cargarGestoriaBajoDemanda = cargarGestoriaBajoDemanda;
  window.cambiarSubtabGestoria = cambiarSubtabGestoria;
  window.filtrarTicketsGestoria = filtrarTicketsGestoria;
  window.toggleModoBorradoManual = toggleModoBorradoManual;
  window.toggleSelectTicket = toggleSelectTicket;
  window.seleccionarTodosTickets = seleccionarTodosTickets;
  window.borrarTicketsSeleccionados = borrarTicketsSeleccionados;
  window.eliminarTicketIndividualGestoria = eliminarTicketIndividualGestoria;
  window.toggleAjustePanel = toggleAjustePanel;
  window.calcularPropuestasAjuste = calcularPropuestasAjuste;
  window.verDetallePropuesta = verDetallePropuesta;
  window.cerrarModalPropuestaDetalle = cerrarModalPropuestaDetalle;
  window.aplicarPropuesta = aplicarPropuesta;
  window.cerrarModalCierresAfectados = cerrarModalCierresAfectados;
  window.copiarInformeCierres = copiarInformeCierres;
  window.exportarPDFGestoria = exportarPDFGestoria;
  window.exportarCSVGestoria = exportarCSVGestoria;

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

  const pIni = document.getElementById("propietario-fecha-ini");
  const pFin = document.getElementById("propietario-fecha-fin");
  if (pIni) pIni.value = hoy;
  if (pFin) pFin.value = hoy;
  propietarioTickets = [];
  propietarioRanking = [];
  propietarioConsultaRealizada = false;
  propietarioCategoriasIncluidas = null;
  actualizarVistaPropietario();

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

  const gIni = document.getElementById("gestoria-desde");
  const gFin = document.getElementById("gestoria-hasta");
  if (gIni) gIni.value = hoy;
  if (gFin) gFin.value = hoy;

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
    actualizarSelectorCategoriasPropietario();
    refrescarClasificacionPropietario();
  });
  
  onValue(ref(db, "carta"), snap => {
    cartaData = snap.val() || {};
    if (categoriaSeleccionadaId) {
      renderProductos(categoriaSeleccionadaId);
    }
    actualizarSelectorCategoriasPropietario();
    refrescarClasificacionPropietario();
  });
  
  // Historial de Ventas no se escucha en tiempo real para evitar consumos masivos de cuotas.
  // Se cargará bajo demanda mediante consultas por rango de fecha.
  
  // 5. Escuchar Seguridad y Wi-Fi
  onValue(ref(db, "config/seguridad"), snap => {
    seguridadData = snap.val() || {};
    actualizarAjustesSeguridad();
  });

  // Escuchar Contraseña de Auditoría (Gerente Móvil)
  onValue(ref(db, "config/audit/password"), snap => {
    const val = snap.val() ? String(snap.val()).trim() : "audit1234";
    const configAuditPass = document.getElementById("config-audit-pass-dev");
    if (configAuditPass) {
      configAuditPass.value = val;
    }
  });

  // 6. Escuchar Datos de Configuración del Local
  onValue(ref(db, "config/local"), snap => {
    localConfig = snap.val() || {};
    actualizarDatosConfigLocal();
    renderConfigImpresoras();
  });

  // 7. Escuchar Camareros
  onValue(ref(db, "config/usuarios"), snap => {
    usuariosData = snap.val() || {};
    renderCamareros();
    poblarCamarerosAuditoria(usuariosData);
  });
  onValue(ref(db, "config/sesionesCamareros"), snap => {
    sesionesCamarerosData = snap.val() || {};
    renderCamareros();
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

  // 12. Escuchar Novedades
  onValue(ref(db, "novedades"), snap => {
    novedadesData = snap.val() || {};
    renderNovedadesConfig();
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
    .filter(([id]) => !id.startsWith("temp_"))
    .sort(([,a],[,b]) => (a.orden ?? 999) - (b.orden ?? 999) || a.nombre.localeCompare(b.nombre, 'es', { numeric: true }));

  const temporales = Object.entries(mesasData)
    .filter(([id]) => id.startsWith("temp_"))
    .sort(([,a],[,b]) => (a.creadoTs || 0) - (b.creadoTs || 0));

  if (entries.length === 0 && temporales.length === 0) {
    wrapper.innerHTML = `<div class="drawer-placeholder">No hay mesas configuradas ni pedidos temporales en este local.</div>`;
    return;
  }

  if (entries.length > 0) {
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
    const sinUbicar = mesasFiltradas.filter(([,m]) => !m.plano && !m.nombre.startsWith('#'));

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
        const isCircle = p.shape === "circle" ? " circle" : "";
        const isDeco = m.nombre.startsWith('#');

        if (isDeco) {
          card.className = `plano-mesa-grid decorador${isCircle}`;
          card.style.gridColumn = `${p.x} / span ${p.w}`;
          card.style.gridRow = `${p.y} / span ${p.h}`;
          card.innerHTML = `<span class="plano-mesa-nombre">${m.nombre.slice(1)}</span>`;
          grid.appendChild(card);
          return;
        }

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
      
      mesasFiltradas.filter(([,m]) => !m.nombre.startsWith('#')).forEach(([mid, m]) => {
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

  // 3. Pedidos Temporales
  if (temporales.length > 0) {
    const tempSection = document.createElement("div");
    tempSection.className = "temp-pedidos-section";
    tempSection.style.marginTop = "24px";
    tempSection.style.paddingTop = "16px";
    tempSection.style.borderTop = "1px solid var(--border)";
    tempSection.style.width = "100%";
    
    tempSection.innerHTML = `
      <div style="font-family: var(--mono); font-size: 11px; font-weight: 600; color: var(--text-dim); margin-bottom: 12px; letter-spacing: 0.05em;">
        🛒 PEDIDOS TEMPORALES ACTIVOS
      </div>
    `;
    
    const tempGrid = document.createElement("div");
    tempGrid.className = "mesas-grid";
    
    temporales.forEach(([mid, m]) => {
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
        <div style="font-size:16px;margin-bottom:4px;font-weight:600;">${m.nombre}</div>
        ${tienePedido ? `<div class="mesa-subtext">${totalQty} art. (${subtotal.toFixed(2)}€)</div>` : '<div class="mesa-subtext" style="color:var(--accent);">Libre</div>'}
        ${tiempoOcupada ? `<div class="plano-mesa-tiempo-badge">⏳ ${tiempoOcupada}</div>` : ""}
      `;
      card.onclick = () => seleccionarMesa(mid);
      tempGrid.appendChild(card);
    });
    
    tempSection.appendChild(tempGrid);
    wrapper.appendChild(tempSection);
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
  
  const entries = Object.entries(categoriasData).sort((a,b) => (a[1].orden ?? 999) - (b[1].orden ?? 999) || a[1].nombre.localeCompare(b[1].nombre, 'es'));
  if (entries.length === 0) {
    container.innerHTML = `<div style="text-align:center;font-size:12px;color:var(--text-dim);padding:10px;">No hay categorías.</div>`;
    return;
  }
  
  entries.forEach(([cid, cat], idx, arr) => {
    const isActiva = categoriaSeleccionadaId === cid;
    const btn = document.createElement("button");
    btn.className = `cat-btn${isActiva ? ' active' : ''}`;
    btn.onclick = () => seleccionarCategoria(cid);
    
    btn.innerHTML = `
      <span>${cat.nombre}</span>
      <div class="local-actions">
        <button class="btn-icon" title="Subir" onclick="event.stopPropagation(); moverCat('${cid}', ${idx}, -1)" ${idx === 0 ? 'disabled' : ''}>↑</button>
        <button class="btn-icon" title="Bajar" onclick="event.stopPropagation(); moverCat('${cid}', ${idx}, 1)" ${idx === arr.length - 1 ? 'disabled' : ''}>↓</button>
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
  
  productos.forEach(([pid, p], idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="font-weight: 500;">${p.nombre}</td>
      <td class="table-price">${Number(p.precio || 0).toFixed(2)} €</td>
      <td style="text-transform: capitalize; color: var(--accent);">${p.destino || 'barra'}</td>
      <td style="text-align: right;">
        <button class="btn-icon" title="Subir" onclick="moverArt('${pid}', '${cid}', ${idx}, -1)" ${idx === 0 ? 'disabled' : ''}>↑</button>
        <button class="btn-icon" title="Bajar" onclick="moverArt('${pid}', '${cid}', ${idx}, 1)" ${idx === productos.length - 1 ? 'disabled' : ''}>↓</button>
        <button class="btn-icon" onclick="editarProducto('${pid}')" style="margin-right:8px;">✏️</button>
        <button class="btn-icon delete" onclick="eliminarProducto('${pid}')">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function moverArt(id, catId, idx, dir) {
  const arts = Object.entries(cartaData)
    .filter(([_, p]) => p.catId === catId)
    .sort((a,b) => (a[1].orden || 0) - (b[1].orden || 0));

  const idxDest = idx + dir;
  if (idxDest < 0 || idxDest >= arts.length) return;

  const updates = {};
  arts.forEach(([aid], i) => { updates['carta/' + aid + '/orden'] = i; });
  updates['carta/' + arts[idx][0] + '/orden'] = idxDest;
  updates['carta/' + arts[idxDest][0] + '/orden'] = idx;
  await update(ref(db), updates);
}

async function moverCat(id, idx, dir) {
  const cats = Object.entries(categoriasData)
    .sort((a,b) => (a[1].orden ?? 999) - (b[1].orden ?? 999) || a[1].nombre.localeCompare(b[1].nombre, 'es'));

  const idxDest = idx + dir;
  if (idxDest < 0 || idxDest >= cats.length) return;

  const updates = {};
  cats.forEach(([cid], i) => { updates['categorias/' + cid + '/orden'] = i; });
  updates['categorias/' + cats[idx][0] + '/orden'] = idxDest;
  updates['categorias/' + cats[idxDest][0] + '/orden'] = idx;
  await update(ref(db), updates);
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
    const tsIni = ini.getTime();
    const tsFin = fin.getTime();
    const q = query(ref(db, "historial"), orderByChild("ts"), startAt(tsIni), endAt(tsFin));
    const snap = await get(q);
    const rawData = snap.val() || {};

    const filtered = {};
    for (const [id, t] of Object.entries(rawData)) {
      if (!t || typeof t !== 'object') continue;
      const normalized = normalizarTicketVenta(id, t);
      filtered[id] = normalized;
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

// --- INFORME COMERCIAL PARA PROPIETARIO ---
function formatUnidadesInforme(valor) {
  const redondeado = Math.round(Number(valor || 0) * 1000) / 1000;
  return Number.isInteger(redondeado)
    ? String(redondeado)
    : redondeado.toLocaleString('es-ES', { maximumFractionDigits: 3 });
}

function actualizarSelectorCategoriasPropietario() {
  const lista = document.getElementById('propietario-categorias-lista');
  const resumen = document.getElementById('propietario-categorias-resumen');
  if (!lista || !resumen) return;
  const categorias = Object.entries(categoriasData || {})
    .sort(([, a], [, b]) => (a.orden ?? 999) - (b.orden ?? 999) || String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es'));
  const opciones = [...categorias.map(([id, categoria]) => ({ id, nombre: categoria.nombre || 'Sin nombre' })), { id: '__sin_categoria__', nombre: 'Sin categoría / histórico' }];
  const clave = `propietario_categorias_${localActivo?.id || 'local'}`;
  if (propietarioCategoriasIncluidas === null) {
    try { propietarioCategoriasIncluidas = new Set(JSON.parse(localStorage.getItem(clave) || 'null') || opciones.map(opcion => opcion.id)); }
    catch { propietarioCategoriasIncluidas = new Set(opciones.map(opcion => opcion.id)); }
  }
  propietarioCategoriasIncluidas = new Set([...propietarioCategoriasIncluidas].filter(id => opciones.some(opcion => opcion.id === id)));
  lista.innerHTML = opciones.map(opcion => `<label style="display:flex;gap:8px;align-items:center;font-size:12px;cursor:pointer;"><input type="checkbox" ${propietarioCategoriasIncluidas.has(opcion.id) ? 'checked' : ''} onchange="toggleCategoriaInformePropietario('${opcion.id}', this.checked)"><span>${escapeHtml(opcion.nombre)}</span></label>`).join('');
  resumen.textContent = propietarioCategoriasIncluidas.size === opciones.length ? 'Todas las categorías' : propietarioCategoriasIncluidas.size ? `${propietarioCategoriasIncluidas.size} categorías seleccionadas` : 'Ninguna categoría';
}

function guardarCategoriasPropietario() {
  localStorage.setItem(`propietario_categorias_${localActivo?.id || 'local'}`, JSON.stringify([...propietarioCategoriasIncluidas]));
}
function toggleSelectorCategoriasPropietario() {
  const panel = document.getElementById('propietario-categorias-panel');
  if (!panel) return;
  if (panel.style.display === 'none') {
    propietarioCategoriasAntesEdicion = new Set(propietarioCategoriasIncluidas || []);
    panel.style.display = 'block';
  } else {
    aplicarSelectorCategoriasPropietario();
  }
}
function toggleCategoriaInformePropietario(id, marcada) {
  if (marcada) propietarioCategoriasIncluidas.add(id); else propietarioCategoriasIncluidas.delete(id);
  guardarCategoriasPropietario(); actualizarSelectorCategoriasPropietario(); actualizarInformePropietario();
}
function seleccionarTodasCategoriasPropietario(marcar) {
  const ids = [...Object.keys(categoriasData || {}), '__sin_categoria__'];
  propietarioCategoriasIncluidas = marcar ? new Set(ids) : new Set();
  guardarCategoriasPropietario(); actualizarSelectorCategoriasPropietario(); actualizarInformePropietario();
}
function aplicarSelectorCategoriasPropietario() {
  guardarCategoriasPropietario();
  const panel = document.getElementById('propietario-categorias-panel');
  if (panel) panel.style.display = 'none';
  propietarioCategoriasAntesEdicion = null;
}
function cancelarSelectorCategoriasPropietario() {
  if (propietarioCategoriasAntesEdicion) propietarioCategoriasIncluidas = new Set(propietarioCategoriasAntesEdicion);
  guardarCategoriasPropietario();
  actualizarSelectorCategoriasPropietario();
  actualizarInformePropietario();
  const panel = document.getElementById('propietario-categorias-panel');
  if (panel) panel.style.display = 'none';
  propietarioCategoriasAntesEdicion = null;
}

function normalizarNombreArticuloPropietario(nombre) {
  return String(nombre || '').trim().toLocaleLowerCase('es')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/^>\s*/, '')
    .replace(/\s+/g, ' ');
}

function resolverArticuloCartaPropietario(linea = {}) {
  const artId = String(linea.artId || linea.articuloId || '').split('__')[0];
  if (artId && cartaData[artId]) return { id: artId, articulo: cartaData[artId] };

  // Los cierres antiguos guardaban nombre y precio, pero no artId.
  const nombre = normalizarNombreArticuloPropietario(linea.nombre);
  if (!nombre) return { id: '', articulo: null };
  let candidatos = Object.entries(cartaData)
    .filter(([, articulo]) => normalizarNombreArticuloPropietario(articulo?.nombre) === nombre);
  // Las variantes históricas se guardan como "Artículo (Variante)". Al no
  // conservar siempre el artId al cerrar mesa, se enlazan con el artículo base.
  if (!candidatos.length) {
    const nombreBase = nombre.replace(/\s*\([^)]*\)\s*$/, '').trim();
    if (nombreBase && nombreBase !== nombre) {
      candidatos = Object.entries(cartaData)
        .filter(([, articulo]) => normalizarNombreArticuloPropietario(articulo?.nombre) === nombreBase);
    }
  }
  if (candidatos.length > 1 && linea.precio !== undefined && linea.precio !== null) {
    const precio = Number(linea.precioTicket ?? linea.precio);
    const porPrecio = candidatos.filter(([, articulo]) => Number(articulo?.precio) === precio);
    if (porPrecio.length === 1) candidatos = porPrecio;
  }
  return candidatos.length === 1
    ? { id: candidatos[0][0], articulo: candidatos[0][1] }
    : { id: '', articulo: null };
}

function categoriaDeLineaPropietario(linea = {}, articulo = null) {
  const categoriaId = articulo?.catId || (categoriasData[linea.catId] ? linea.catId : '') || (categoriasData[linea.categoriaId] ? linea.categoriaId : '');
  const categoria = categoriasData[categoriaId] || null;
  return {
    id: categoriaId || '__sin_categoria__',
    nombre: categoria?.nombre || linea.categoriaNombre || linea.categoria || 'Sin categoría / histórico'
  };
}

function destinoDeLineaPropietario(linea = {}, articulo = null) {
  let destino = String(linea.destino || articulo?.destino || '').trim().toLowerCase();
  if (destino === 'pizza') destino = 'pizzas';
  if (destino === 'caja') destino = 'barra';
  const nombres = { barra: 'Barra', cocina: 'Cocina', pizzas: 'Pizzas', ambos: 'Barra y Cocina' };
  return { id: destino || '__sin_destino__', nombre: nombres[destino] || 'Sin destino / histórico' };
}

function cantidadLineaPropietario(linea = {}) {
  const candidatos = [linea.qtyTicket, linea.qtyServida, linea.qty, linea.cantidad];
  const cantidad = candidatos.find(valor => valor !== undefined && valor !== null && Number.isFinite(Number(valor)));
  return Math.max(0, Number(cantidad || 0));
}

function crearRankingPropietario(tickets = []) {
  const acumulado = new Map();
  tickets.forEach(ticket => {
    (ticket.lineas || []).forEach(linea => {
      if (!linea || linea.estado === 'cancelado') return;
      const unidades = cantidadLineaPropietario(linea);
      if (!unidades) return;

      const articuloResuelto = resolverArticuloCartaPropietario(linea);
      const articuloCarta = articuloResuelto.articulo || {};
      const nombre = String(linea.nombre || articuloCarta.nombre || 'Artículo sin nombre').trim();
      const precio = Number(linea.precioTicket ?? linea.precio ?? articuloCarta.precio ?? 0);
      const categoria = categoriaDeLineaPropietario(linea, articuloCarta);
      const destino = destinoDeLineaPropietario(linea, articuloCarta);
      const clave = `${articuloResuelto.id || linea.artId || linea.articuloId || nombre}::${categoria.id}::${destino.id}`;
      const actual = acumulado.get(clave) || {
        articuloId: articuloResuelto.id || '',
        nombre,
        categoriaId: categoria.id,
        categoriaNombre: categoria.nombre,
        destinoId: destino.id,
        destinoNombre: destino.nombre,
        unidades: 0,
        facturacion: 0
      };
      actual.unidades += unidades;
      actual.facturacion += precio * unidades;
      acumulado.set(clave, actual);
    });
  });
  return [...acumulado.values()];
}

function obtenerRankingVisiblePropietario() {
  const destinoFiltro = document.getElementById('propietario-destino')?.value || '';
  const orden = document.getElementById('propietario-orden')?.value || 'unidades';
  return propietarioRanking
    .filter(item => propietarioCategoriasIncluidas?.has(item.categoriaId))
    .filter(item => {
      if (!destinoFiltro) return true;
      if (destinoFiltro === 'bebida') return item.destinoId === 'barra';
      if (destinoFiltro === 'comida') return ['cocina', 'pizzas', 'ambos'].includes(item.destinoId);
      return item.destinoId === destinoFiltro;
    })
    .sort((a, b) => orden === 'facturacion'
      ? b.facturacion - a.facturacion || b.unidades - a.unidades || a.nombre.localeCompare(b.nombre, 'es')
      : b.unidades - a.unidades || b.facturacion - a.facturacion || a.nombre.localeCompare(b.nombre, 'es'));
}

function actualizarVistaPropietario() {
  const tbody = document.getElementById('propietario-tbody');
  if (!tbody) return;
  const totalFacturacionEl = document.getElementById('propietario-total-facturacion');
  const totalUnidadesEl = document.getElementById('propietario-total-unidades');
  const totalTicketsEl = document.getElementById('propietario-total-tickets');

  if (!propietarioConsultaRealizada) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-dim);padding:30px;">Selecciona el período y pulsa Consultar para generar el informe comercial.</td></tr>';
    if (totalFacturacionEl) totalFacturacionEl.textContent = '0,00 €';
    if (totalUnidadesEl) totalUnidadesEl.textContent = '0';
    if (totalTicketsEl) totalTicketsEl.textContent = '0';
    return;
  }

  const ranking = obtenerRankingVisiblePropietario();
  const totalFacturacion = ranking.reduce((suma, item) => suma + item.facturacion, 0);
  const totalUnidades = ranking.reduce((suma, item) => suma + item.unidades, 0);
  if (totalFacturacionEl) totalFacturacionEl.textContent = `${totalFacturacion.toFixed(2)} €`;
  if (totalUnidadesEl) totalUnidadesEl.textContent = formatUnidadesInforme(totalUnidades);
  if (totalTicketsEl) totalTicketsEl.textContent = String(propietarioTickets.length);

  if (!ranking.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-dim);padding:30px;">No hay artículos vendidos para el filtro seleccionado.</td></tr>';
    return;
  }

  tbody.innerHTML = ranking.map((item, indice) => {
    const porcentaje = totalFacturacion ? (item.facturacion / totalFacturacion) * 100 : 0;
    return `<tr><td style="text-align:right;color:var(--text-dim);">${indice + 1}</td><td style="font-weight:600;">${escapeHtml(item.nombre)}</td><td>${escapeHtml(item.categoriaNombre)}</td><td>${escapeHtml(item.destinoNombre)}</td><td style="text-align:right;font-family:var(--font-code);">${formatUnidadesInforme(item.unidades)}</td><td class="table-price" style="text-align:right;color:var(--accent);">${item.facturacion.toFixed(2)} €</td><td style="text-align:right;">${porcentaje.toFixed(1)} %</td></tr>`;
  }).join('');
}

async function consultarInformePropietario() {
  if (!db) return;
  if (propietarioCategoriasIncluidas === null) actualizarSelectorCategoriasPropietario();
  const desde = document.getElementById('propietario-fecha-ini')?.value;
  const hasta = document.getElementById('propietario-fecha-fin')?.value;
  if (!desde || !hasta) {
    showCustomAlert('Informe propietario', 'Selecciona un período de fechas para consultar las ventas.');
    return;
  }

  const tbody = document.getElementById('propietario-tbody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-dim);padding:30px;">Consultando ventas del período...</td></tr>';
  try {
    const data = await cargarVentasRango(desde, hasta);
    propietarioTickets = Object.entries(data).map(([id, ticket]) => ({ id, ...ticket }));
    propietarioRanking = crearRankingPropietario(propietarioTickets);
    propietarioConsultaRealizada = true;
    actualizarVistaPropietario();
  } catch (error) {
    console.error('Error al cargar el informe comercial:', error);
    propietarioConsultaRealizada = false;
    actualizarVistaPropietario();
    showCustomAlert('Informe propietario', 'No se pudieron consultar las ventas del período.');
  }
}

function actualizarInformePropietario() {
  if (propietarioConsultaRealizada) actualizarVistaPropietario();
}

function refrescarClasificacionPropietario() {
  if (!propietarioConsultaRealizada) return;
  propietarioRanking = crearRankingPropietario(propietarioTickets);
  actualizarVistaPropietario();
}

function invalidarConsultaInformePropietario() {
  if (!propietarioConsultaRealizada) return;
  propietarioTickets = [];
  propietarioRanking = [];
  propietarioConsultaRealizada = false;
  actualizarVistaPropietario();
}

function exportarPDFInformePropietario() {
  if (!propietarioConsultaRealizada) {
    showCustomAlert('Informe propietario', 'Pulsa Consultar antes de generar el PDF.');
    return;
  }

  const ranking = obtenerRankingVisiblePropietario();
  if (!ranking.length) {
    showCustomAlert('Informe propietario', 'No hay artículos para el filtro seleccionado.');
    return;
  }

  const desde = document.getElementById('propietario-fecha-ini').value;
  const hasta = document.getElementById('propietario-fecha-fin').value;
  const categoriaTexto = document.getElementById('propietario-categorias-resumen')?.textContent || 'Todas las categorías';
  const destinoTexto = document.getElementById('propietario-destino').selectedOptions[0]?.textContent || 'Todo';
  const orden = document.getElementById('propietario-orden').value;
  const ordenTexto = orden === 'facturacion' ? 'Facturación' : 'Unidades vendidas';
  const totalFacturacion = ranking.reduce((suma, item) => suma + item.facturacion, 0);
  const totalUnidades = ranking.reduce((suma, item) => suma + item.unidades, 0);
  const localNombre = localActivo?.nombre || localConfig?.datosNegocio?.nombre || 'Establecimiento';
  const fmtFecha = valor => {
    const [anyo, mes, dia] = String(valor).split('-');
    return anyo && mes && dia ? `${dia}/${mes}/${anyo}` : valor;
  };
  const filas = ranking.map((item, indice) => {
    const porcentaje = totalFacturacion ? (item.facturacion / totalFacturacion) * 100 : 0;
    return `<tr><td>${indice + 1}</td><td><strong>${escapeHtml(item.nombre)}</strong></td><td>${escapeHtml(item.categoriaNombre)}</td><td>${escapeHtml(item.destinoNombre)}</td><td class="num">${formatUnidadesInforme(item.unidades)}</td><td class="num">${item.facturacion.toFixed(2)} €</td><td class="num">${porcentaje.toFixed(1)} %</td></tr>`;
  }).join('');
  const topTres = ranking.slice(0, 3).map((item, indice) => ({ item, puesto: indice + 1 }));
  const valorRanking = item => orden === 'facturacion' ? item.facturacion : item.unidades;
  const porcentajeFacturacion = item => totalFacturacion ? (item.facturacion / totalFacturacion) * 100 : 0;
  const formatoPortada = item => `${porcentajeFacturacion(item).toFixed(1)} % de facturación`;
  const maximoTop = Math.max(...topTres.map(({ item }) => valorRanking(item)), 1);
  const iconosPodio = { 1: '🥇', 2: '🥈', 3: '🥉' };
  const podio = [topTres[1], topTres[0], topTres[2]].filter(Boolean).map(({ item, puesto }) => `
    <div class="podio-item puesto-${puesto}"><div class="medalla">${iconosPodio[puesto]}</div><div class="podio-nombre">${escapeHtml(item.nombre)}</div><div class="podio-valor">${formatoPortada(item)}</div><div class="podio-base"><strong>${puesto}</strong></div></div>`).join('');
  const barras = topTres.map(({ item, puesto }) => `
    <div class="barra-row"><div class="barra-label"><span>${iconosPodio[puesto]} ${escapeHtml(item.nombre)}</span><strong>${formatoPortada(item)}</strong></div><div class="barra-fondo"><div class="barra barra-${puesto}" style="width:${Math.max(8, (valorRanking(item) / maximoTop) * 100)}%"></div></div></div>`).join('');
  const cuotaTopTres = totalFacturacion
    ? topTres.reduce((suma, { item }) => suma + item.facturacion, 0) / totalFacturacion * 100
    : 0;
  const menosVendidos = [...ranking]
    .sort((a, b) => a.unidades - b.unidades || a.facturacion - b.facturacion || a.nombre.localeCompare(b.nombre, 'es'))
    .slice(0, Math.min(5, ranking.length));
  const bajaRotacion = menosVendidos.map(item => {
    const cuotaUnidades = totalUnidades ? (item.unidades / totalUnidades) * 100 : 0;
    return `<li><strong>${escapeHtml(item.nombre)}</strong><span>${cuotaUnidades.toFixed(1)} % de las unidades</span></li>`;
  }).join('');
  const destinoFiltro = document.getElementById('propietario-destino').value || '';
  const coincideDestino = destinoId => {
    if (!destinoFiltro) return true;
    if (destinoFiltro === 'bebida') return destinoId === 'barra';
    if (destinoFiltro === 'comida') return ['cocina', 'pizzas', 'ambos'].includes(destinoId);
    return destinoId === destinoFiltro;
  };
  const todosArticulosSinVentas = Object.entries(cartaData)
    .filter(([id, articulo]) => {
      const categoria = categoriaDeLineaPropietario({}, articulo);
      const destino = destinoDeLineaPropietario({}, articulo);
      const tuvoVentas = propietarioRanking.some(item => item.articuloId === id);
      return propietarioCategoriasIncluidas?.has(categoria.id) && coincideDestino(destino.id) && !tuvoVentas;
    })
    .sort(([, a], [, b]) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es'));
  const articulosSinVentas = todosArticulosSinVentas.slice(0, 6);
  const hayAnexoSinVentas = todosArticulosSinVentas.length > 6;
  const sinVentasHTML = articulosSinVentas.length
    ? `<div class="sin-ventas"><h3>Sin ventas en el período · prioridad máxima</h3><p>Estos artículos siguen en carta, pero no aparecen en el historial seleccionado. Conviene revisarlos antes que los de baja rotación.</p><ul>${articulosSinVentas.map(([, articulo]) => `<li><strong>${escapeHtml(articulo.nombre || 'Artículo sin nombre')}</strong><span>Sin ventas</span></li>`).join('')}</ul></div>`
    : '';

  const ventana = window.open('', '_blank');
  if (!ventana) {
    showCustomAlert('Informe propietario', 'Permite las ventanas emergentes para generar el PDF.');
    return;
  }
  ventana.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Informe comercial ${escapeHtml(localNombre)}</title>
    <style>
      *{box-sizing:border-box} body{margin:0;background:#eef1f5;color:#172033;font-family:Arial,sans-serif}.toolbar{padding:14px;text-align:center;background:#172033}.toolbar button{padding:10px 18px;border:0;border-radius:7px;background:#cfff4d;color:#172033;font-weight:700;cursor:pointer}.page{width:min(210mm,100%);min-height:297mm;margin:20px auto;padding:18mm;background:#fff;box-shadow:0 2px 18px #0002}.header{display:flex;justify-content:space-between;gap:20px;border-bottom:2px solid #172033;padding-bottom:14px}.eyebrow{font-size:11px;color:#667085;font-weight:700;letter-spacing:.08em;text-transform:uppercase}.title{font-size:27px;font-weight:800;margin-top:5px}.muted{margin-top:6px;color:#667085;font-size:12px;line-height:1.45}.badge{text-align:right;font-size:13px}.kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:22px 0}.kpi{border:1px solid #d9e0ea;border-radius:8px;padding:13px;background:#fafbfd}.kpi label{display:block;color:#667085;font-size:10px;font-weight:700;text-transform:uppercase}.kpi strong{display:block;margin-top:5px;font:700 20px monospace;color:#087f5b}h2{font-size:15px;margin:20px 0 9px;border-left:4px solid #2563eb;padding-left:8px;text-transform:uppercase}table{width:100%;border-collapse:collapse;font-size:12px}th,td{padding:9px;border-bottom:1px solid #dde3eb;text-align:left}th{background:#f1f4f8;text-transform:uppercase;font-size:10px;color:#42526a}.num{text-align:right;font-family:monospace}.footer{border-top:1px solid #dde3eb;margin-top:24px;padding-top:10px;font-size:10px;color:#7a8599;text-align:center}.cover{display:flex;flex-direction:column}.cover-main{margin-top:26px;padding:22px;border-radius:14px;background:linear-gradient(135deg,#f7fbff,#eef6ff);border:1px solid #d8e8fb}.cover-title{font-size:18px;font-weight:800;text-align:center}.cover-subtitle{text-align:center;color:#667085;font-size:12px;margin:5px 0 20px}.cover-insight{text-align:center;font-size:13px;color:#235d8a;background:#e8f3ff;border-radius:8px;padding:9px;margin:12px 0}.podio{display:flex;align-items:flex-end;justify-content:center;gap:12px;height:205px;margin:5px 0 25px}.podio-item{width:30%;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:flex-end}.medalla{font-size:29px;height:36px}.podio-nombre{font-size:12px;font-weight:700;max-width:145px;min-height:32px;display:flex;align-items:center;justify-content:center}.podio-valor{font:700 12px monospace;color:#087f5b;margin:5px 0}.podio-base{width:100%;display:flex;align-items:flex-start;justify-content:center;padding-top:12px;border-radius:9px 9px 0 0;color:#172033}.podio-base strong{font-size:26px}.puesto-1 .podio-base{height:100px;background:#f9d96c}.puesto-2 .podio-base{height:72px;background:#dce3eb}.puesto-3 .podio-base{height:50px;background:#e8ba91}.barras{margin-top:23px}.barra-row{margin:12px 0}.barra-label{display:flex;justify-content:space-between;gap:10px;font-size:12px;margin-bottom:5px}.barra-fondo{height:15px;border-radius:99px;background:#e5ebf3;overflow:hidden}.barra{height:100%;border-radius:99px}.barra-1{background:#e5b80b}.barra-2{background:#8996a7}.barra-3{background:#b87945}.sin-ventas,.baja-rotacion{margin-top:20px;padding:16px;border-radius:10px}.sin-ventas{border:1px solid #f0b7ba;background:#fff5f5}.sin-ventas h3{margin:0 0 5px;font-size:14px;color:#b4232c}.sin-ventas p,.baja-rotacion p{font-size:11px;margin:0 0 9px}.sin-ventas p{color:#7b5457}.sin-ventas ul,.baja-rotacion ul{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:1fr 1fr;gap:6px 18px}.sin-ventas li,.baja-rotacion li{font-size:11px;padding-bottom:5px;display:flex;justify-content:space-between;gap:8px}.sin-ventas li{border-bottom:1px solid #f4d7d8}.sin-ventas li span{color:#b4232c;white-space:nowrap}.baja-rotacion{border:1px solid #f1d9b5;background:#fffaf2}.baja-rotacion h3{margin:0 0 5px;font-size:14px;color:#9a5b15}.baja-rotacion p{color:#6f6251}.baja-rotacion li{border-bottom:1px solid #f1e5d1}.baja-rotacion li span{color:#8b7355;white-space:nowrap}.detail-page{page-break-before:always}.detalle-header{margin-bottom:18px}@media print{body{background:#fff}.toolbar{display:none}.page{width:auto;min-height:0;margin:0;box-shadow:none;padding:0}.detail-page{break-before:page;page-break-before:always}}
    </style></head><body><div class="toolbar"><button onclick="window.print()">Imprimir / Guardar como PDF</button></div><main class="page cover"><div class="header"><div><div class="eyebrow">Informe comercial</div><div class="title">${escapeHtml(localNombre)}</div><div class="muted">Período: ${fmtFecha(desde)} — ${fmtFecha(hasta)}<br>Familia: ${escapeHtml(categoriaTexto)} · Servicio: ${escapeHtml(destinoTexto)} · Orden: ${escapeHtml(ordenTexto)}</div></div><div class="badge"><strong>Lectura estratégica</strong><br><span class="muted">Carta y rotación de artículos</span></div></div><section class="cover-main"><div class="cover-title">Los 3 artículos destacados</div><div class="cover-subtitle">Clasificados por ${escapeHtml(ordenTexto.toLowerCase())}</div><div class="cover-insight">Los tres artículos concentran el <strong>${cuotaTopTres.toFixed(1)} %</strong> de la facturación del período.</div><div class="podio">${podio}</div><div class="barras">${barras}</div>${sinVentasHTML}<div class="baja-rotacion"><h3>Artículos con menor rotación</h3><p>Una señal para revisar visibilidad, precio, receta o permanencia en carta. No implica retirarlos automáticamente.</p><ul>${bajaRotacion}</ul></div></section><div class="footer">Resumen estratégico · Informe generado el ${new Date().toLocaleString('es-ES')}</div></main><main class="page detail-page"><div class="detalle-header"><div class="eyebrow">Informe comercial · detalle</div><div class="title">Ranking completo de artículos</div><div class="muted">${escapeHtml(localNombre)} · Período: ${fmtFecha(desde)} — ${fmtFecha(hasta)}</div></div><div class="kpis"><div class="kpi"><label>Facturación de artículos</label><strong>${totalFacturacion.toFixed(2)} €</strong></div><div class="kpi"><label>Unidades vendidas</label><strong>${formatUnidadesInforme(totalUnidades)}</strong></div><div class="kpi"><label>Artículos distintos</label><strong>${ranking.length}</strong></div></div><table><thead><tr><th>Pos.</th><th>Artículo</th><th>Categoría</th><th>Destino</th><th class="num">Unidades</th><th class="num">Facturación</th><th class="num">% fact.</th></tr></thead><tbody>${filas}</tbody></table><div class="footer">Informe comercial generado el ${new Date().toLocaleString('es-ES')} · Comandero TPVSync</div></main></body></html>`);
  if (hayAnexoSinVentas) {
    const piePortada = ventana.document.querySelector('.cover .footer');
    if (piePortada) piePortada.innerHTML += '<br><strong>Ver anexo Sin ventas.</strong>';

    const filasAnexo = todosArticulosSinVentas.map(([, articulo]) => {
      const categoria = categoriaDeLineaPropietario({}, articulo);
      const destino = destinoDeLineaPropietario({}, articulo);
      return `<tr><td>${escapeHtml(articulo.nombre || 'Artículo sin nombre')}</td><td>${escapeHtml(categoria.nombre)}</td><td>${escapeHtml(destino.nombre)}</td><td>Sin ventas</td></tr>`;
    }).join('');
    const anexo = ventana.document.createElement('main');
    anexo.className = 'page detail-page';
    anexo.innerHTML = `<div class="detalle-header"><div class="eyebrow">Anexo · revisión de carta</div><div class="title">Artículos sin ventas</div><div class="muted">Listado completo de los artículos en carta sin movimientos durante el período seleccionado. Requieren la máxima prioridad de revisión.</div></div><table><thead><tr><th>Artículo</th><th>Categoría</th><th>Destino</th><th>Estado</th></tr></thead><tbody>${filasAnexo}</tbody></table><div class="footer">Anexo generado el ${new Date().toLocaleString('es-ES')} · Comandero TPVSync</div>`;
    ventana.document.body.appendChild(anexo);
  }
  ventana.document.close();
}

// --- VISTA: AJUSTES DE SEGURIDAD ---
// --- VISTA: AJUSTES DE SEGURIDAD ---
function actualizarAjustesSeguridad() {
  const isRestricted = boolCheck(seguridadData.wifiRestricted);
  document.getElementById("switch-wifi-restriction").checked = isRestricted;
  document.getElementById("config-wifi-ip").value = seguridadData.wifiIP || "No registrada";

  // Inicializar bloqueo de camareros
  const switchBloqueo = document.getElementById("switch-bloqueo-camareros-dev");
  if (switchBloqueo) {
    switchBloqueo.checked = seguridadData.bloqueoCamareros === true;
  }
  
  poblarExcepcionCamareroSelectorDev();

  // Toggle de emojis
  const switchEmojis = document.getElementById('switch-emojis-activo');
  if (switchEmojis) switchEmojis.checked = seguridadData.emojisActivo === true;
  
  // Emojis de acceso global
  const emojisStr = seguridadData.emojisAcceso || "";
  selectedEmojisDev = emojisStr ? Array.from(emojisStr) : [];
  actualizarPreviewEmojisDev();
  renderEmojiPickerDev();

  // Geolocalización
  const switchGeo = document.getElementById('switch-geo-activo');
  if (switchGeo) switchGeo.checked = seguridadData.geoActivo === true;
  document.getElementById('config-geo-lat').value = seguridadData.geoLat != null ? seguridadData.geoLat : '';
  document.getElementById('config-geo-lng').value = seguridadData.geoLng != null ? seguridadData.geoLng : '';
  document.getElementById('config-geo-radio').value = seguridadData.geoRadio || '';
  const geoIntervaloSel = document.getElementById('config-geo-intervalo');
  if (geoIntervaloSel) geoIntervaloSel.value = String(seguridadData.geoIntervaloHoras || 3);

  // Encargado
  const switchEncargado = document.getElementById("switch-encargado-activo");
  if (switchEncargado) {
    switchEncargado.checked = seguridadData.encargadoAccesible === true;
  }
  const passEncargado = document.getElementById("config-encargado-pass-dev");
  if (passEncargado) {
    passEncargado.value = seguridadData.encargadoPassword || "";
    passEncargado.placeholder = seguridadData.encargadoPassword
      ? ""
      : "Sin contraseña configurada";
  }

  // Emparejamiento de Dispositivos por QR (Token del Local)
  const switchDevToken = document.getElementById("switch-device-token-dev");
  if (switchDevToken) switchDevToken.checked = seguridadData.deviceTokenActivo === true;

  const lblToken = document.getElementById("lbl-device-token-dev");
  const qrImg = document.getElementById("qr-device-token-img");
  const tokenVal = seguridadData.deviceToken || "";
  if (lblToken) lblToken.textContent = tokenVal || "(Sin clave generada)";

  if (qrImg) {
    if (tokenVal) {
      const basePath = window.location.pathname;
      const lastSlash = basePath.lastIndexOf('/');
      const dir = lastSlash >= 0 ? basePath.substring(0, lastSlash + 1) : '/';
      const camareroUrl = window.location.origin + dir + 'camarero.html';
      const pairUrl = `${camareroUrl}?pair=${encodeURIComponent(tokenVal)}`;
      // Se genera en el propio navegador: no depende de un servicio QR externo.
      const qr = qrcode(0, 'M');
      qr.addData(pairUrl);
      qr.make();
      qrImg.src = qr.createDataURL(4, 2);
      qrImg.style.display = "block";
    } else {
      qrImg.style.display = "none";
    }
  }
}

function poblarExcepcionCamareroSelectorDev() {
  const select = document.getElementById("select-camarero-excepcion-dev");
  if (!select) return;
  const currentVal = seguridadData.excepcionCamarero || "";
  select.innerHTML = '<option value="">(Ninguno)</option>';
  Object.entries(usuariosData || {}).forEach(([id, u]) => {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = u.nombre;
    select.appendChild(option);
  });
  select.value = currentVal;
}

async function guardarEstadoBloqueoCamarerosDev() {
  if (!db) return;
  const isChecked = document.getElementById("switch-bloqueo-camareros-dev").checked;
  try {
    await update(ref(db, "config/seguridad"), {
      bloqueoCamareros: isChecked,
      updatedAt: Date.now()
    });
    console.log("Bloqueo total de camareros actualizado:", isChecked);
  } catch (error) {
    alert("Error al actualizar el bloqueo de camareros.");
    document.getElementById("switch-bloqueo-camareros-dev").checked = !isChecked; // Deshacer
  }
}

async function guardarEstadoEncargadoDev() {
  if (!db) return;
  const switchEncargado = document.getElementById("switch-encargado-activo");
  const isChecked = switchEncargado.checked;
  try {
    await update(ref(db, "config/seguridad"), {
      encargadoAccesible: isChecked,
      updatedAt: Date.now()
    });
    console.log("Acceso de encargado actualizado:", isChecked);
  } catch (error) {
    alert("Error al actualizar el acceso de encargado.");
    switchEncargado.checked = !isChecked; // Deshacer
  }
}

async function guardarPassEncargadoDev() {
  if (!db) return;
  const val = document.getElementById("config-encargado-pass-dev").value.trim();
  if (!val) {
    alert("La contraseña no puede estar vacía.");
    return;
  }
  try {
    await update(ref(db, "config/seguridad"), {
      encargadoPassword: val,
      updatedAt: Date.now()
    });
    // No se registra la contraseña: sólo el cambio y su origen para auditoría.
    await push(ref(db, `auditoria/${new Date().toISOString().slice(0, 10)}`), {
      ts: Date.now(),
      accion: 'encargado_password_actualizada',
      detalle: 'Contraseña de encargado actualizada desde Desarrollador',
      origen: 'desarrollador'
    }).catch(() => {});
    alert("Contraseña de encargado guardada correctamente.");
  } catch (error) {
    alert("Error al guardar la contraseña de encargado.");
  }
}

async function guardarPassAuditDev() {
  if (!db) return;
  const val = document.getElementById("config-audit-pass-dev").value.trim();
  if (!val) {
    alert("La contraseña de auditoría no puede estar vacía.");
    return;
  }
  try {
    await set(ref(db, "config/audit/password"), val);
    alert("Contraseña de auditoría/gerente guardada correctamente.");
  } catch (error) {
    alert("Error al guardar la contraseña de auditoría/gerente.");
  }
}

async function guardarExcepcionCamareroDev() {
  if (!db) return;
  const val = document.getElementById("select-camarero-excepcion-dev").value;
  try {
    await update(ref(db, "config/seguridad"), {
      excepcionCamarero: val,
      updatedAt: Date.now()
    });
    console.log("Excepción de camarero actualizada:", val);
  } catch (error) {
    alert("Error al guardar la excepción.");
  }
}

function renderEmojiPickerDev() {
  const container = document.querySelector('.dev-emoji-picker');
  if (!container) return;
  container.innerHTML = EMOJI_LIST.map(emoji => `
    <button type="button" class="btn btn-secondary" onclick="window.seleccionarEmojiDev('${emoji}')" style="font-size: 16px; padding: 6px 0; height: auto; text-align: center; border-radius: 4px; border: 1px solid var(--border);">${emoji}</button>
  `).join('');
}

function seleccionarEmojiDev(emoji) {
  if (selectedEmojisDev.length >= 3) return;
  selectedEmojisDev.push(emoji);
  actualizarPreviewEmojisDev();
}

function limpiarEmojisDev() {
  selectedEmojisDev = [];
  actualizarPreviewEmojisDev();
}

function actualizarPreviewEmojisDev() {
  const preview = document.getElementById("dev-emojis-preview");
  if (!preview) return;
  const display = [];
  for (let i = 0; i < 3; i++) {
    display.push(selectedEmojisDev[i] || '❓');
  }
  preview.textContent = display.join(' ');
}

async function guardarEmojisDev() {
  if (!db) return;
  if (selectedEmojisDev.length < 3 && selectedEmojisDev.length > 0) {
    alert("La combinación debe tener exactamente 3 emojis, o estar vacía (para desactivar el reto).");
    return;
  }
  const val = selectedEmojisDev.join('');
  try {
    await update(ref(db, "config/seguridad"), {
      emojisAcceso: val,
      updatedAt: Date.now()
    });
    alert("Combinación de emojis de acceso guardada con éxito.");
  } catch (error) {
    alert("Error al actualizar la combinación de emojis.");
  }
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

async function toggleDeviceTokenActivoDev() {
  if (!db) return;
  const isChecked = document.getElementById("switch-device-token-dev").checked;
  
  let currentToken = seguridadData.deviceToken;
  if (isChecked && !currentToken) {
    currentToken = 'TK-' + Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
  }
  
  try {
    await update(ref(db, "config/seguridad"), {
      deviceTokenActivo: isChecked,
      deviceToken: currentToken || "",
      updatedAt: Date.now()
    });
    console.log("Emparejamiento QR actualizado:", isChecked);
  } catch (e) {
    alert("Error al actualizar la configuración de emparejamiento.");
    document.getElementById("switch-device-token-dev").checked = !isChecked;
  }
}
window.toggleDeviceTokenActivoDev = toggleDeviceTokenActivoDev;

async function rotarDeviceTokenDev() {
  if (!db) return;
  const ok = confirm("¿Estás seguro de regenerar la clave del local?\n\nTodos los camareros deberán volver a escanear el nuevo código QR para poder usar su PIN.");
  if (!ok) return;

  const nuevoToken = 'TK-' + Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
  try {
    await update(ref(db, "config/seguridad"), {
      deviceToken: nuevoToken,
      deviceTokenActivo: true,
      updatedAt: Date.now()
    });
    alert("Nueva clave generada con éxito. Muestra el código QR actualizado a tu personal.");
  } catch (e) {
    alert("Error al rotar la clave de seguridad.");
  }
}
window.rotarDeviceTokenDev = rotarDeviceTokenDev;

async function guardarEstadoEmojis() {
  if (!db) return;
  const isChecked = document.getElementById('switch-emojis-activo').checked;
  try {
    await update(ref(db, 'config/seguridad'), { emojisActivo: isChecked, updatedAt: Date.now() });
    console.log('Verificación por emojis:', isChecked);
  } catch (error) {
    alert('Error al actualizar la verificación por emojis.');
    document.getElementById('switch-emojis-activo').checked = !isChecked;
  }
}
window.guardarEstadoEmojis = guardarEstadoEmojis;

async function guardarEstadoGeo() {
  if (!db) return;
  const isChecked = document.getElementById('switch-geo-activo').checked;
  try {
    await update(ref(db, 'config/seguridad'), { geoActivo: isChecked, updatedAt: Date.now() });
    console.log('Restricción GPS:', isChecked);
  } catch (error) {
    alert('Error al actualizar la restricción GPS.');
    document.getElementById('switch-geo-activo').checked = !isChecked;
  }
}
window.guardarEstadoGeo = guardarEstadoGeo;

function usarUbicacionActualDev() {
  if (!navigator.geolocation) { alert('Tu navegador no soporta geolocalización.'); return; }
  navigator.geolocation.getCurrentPosition(pos => {
    document.getElementById('config-geo-lat').value = pos.coords.latitude.toFixed(6);
    document.getElementById('config-geo-lng').value = pos.coords.longitude.toFixed(6);
    alert(`Ubicación capturada: ${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`);
  }, err => {
    alert('Error al obtener ubicación: ' + err.message);
  }, { enableHighAccuracy: true, timeout: 10000 });
}
window.usarUbicacionActualDev = usarUbicacionActualDev;

function calcularRadioDesdeLimiteDev() {
  const latCenter = parseFloat(document.getElementById('config-geo-lat').value);
  const lngCenter = parseFloat(document.getElementById('config-geo-lng').value);
  if (isNaN(latCenter) || isNaN(lngCenter)) {
    alert('Primero configura el centro del local con "Usar esta ubicación".');
    return;
  }
  if (!navigator.geolocation) { alert('Tu navegador no soporta geolocalización.'); return; }
  navigator.geolocation.getCurrentPosition(pos => {
    const R = 6371000;
    const toRad = x => x * Math.PI / 180;
    const dLat = toRad(pos.coords.latitude - latCenter);
    const dLon = toRad(pos.coords.longitude - lngCenter);
    const a = Math.sin(dLat/2)**2 + Math.cos(toRad(latCenter)) * Math.cos(toRad(pos.coords.latitude)) * Math.sin(dLon/2)**2;
    const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const radio = Math.max(50, Math.ceil(dist));
    document.getElementById('config-geo-radio').value = radio;
    alert(`Distancia calculada: ${Math.round(dist)}m → Radio establecido: ${radio}m`);
  }, err => {
    alert('Error al obtener ubicación: ' + err.message);
  }, { enableHighAccuracy: true, timeout: 10000 });
}
window.calcularRadioDesdeLimiteDev = calcularRadioDesdeLimiteDev;

async function guardarUbicacionDev() {
  if (!db) return;
  const lat = parseFloat(document.getElementById('config-geo-lat').value);
  const lng = parseFloat(document.getElementById('config-geo-lng').value);
  const radio = parseInt(document.getElementById('config-geo-radio').value) || 100;
  const intervalo = parseInt(document.getElementById('config-geo-intervalo').value) || 3;
  if (isNaN(lat) || isNaN(lng)) {
    alert('Las coordenadas no son válidas. Usa "Usar esta ubicación" para capturarlas.');
    return;
  }
  if (radio < 1) { alert('El radio mínimo es 1 metro.'); return; }
  try {
    await update(ref(db, 'config/seguridad'), {
      geoLat: lat, geoLng: lng, geoRadio: radio, geoIntervaloHoras: intervalo, updatedAt: Date.now()
    });
    alert('Ubicación del local guardada con éxito.');
  } catch (error) {
    alert('Error al guardar la ubicación.');
  }
}
window.guardarUbicacionDev = guardarUbicacionDev;

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

async function eliminarLocal(id) {
  const ok = await showCustomConfirm("Locales", "¿Estás seguro de que quieres eliminar este local del panel de control?");
  if (!ok) return;
  
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
  
  document.getElementById("new-form-cat-var-nombre").value = "";
  document.getElementById("new-form-cat-var-precio").value = "";
  
  if (id) {
    document.getElementById("modal-cat-title").textContent = "Editar Categoría";
    document.getElementById("form-cat-id").value = id;
    document.getElementById("form-cat-nombre").value = nombre;
    const cat = categoriasData[id];
    document.getElementById("form-cat-notas").value = cat?.notasPredefinidas || "";
    currentCatVarsDev = cat?.variantes ? JSON.parse(JSON.stringify(cat.variantes)) : [];
  } else {
    document.getElementById("modal-cat-title").textContent = "Añadir Categoría";
    document.getElementById("form-cat-id").value = "";
    document.getElementById("form-cat-nombre").value = "";
    document.getElementById("form-cat-notas").value = "";
    currentCatVarsDev = [];
  }
  renderVariantesCategoriaDev();
}

function renderVariantesCategoriaDev() {
  const list = document.getElementById("form-cat-variantes-lista");
  if (!list) return;
  list.innerHTML = "";
  
  if (currentCatVarsDev.length === 0) {
    list.innerHTML = `<div style="font-size:11px;color:var(--muted);text-align:center;">Sin variantes configuradas.</div>`;
    return;
  }
  
  currentCatVarsDev.forEach((v, idx) => {
    const row = document.createElement("div");
    row.style.cssText = "display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,0.04);padding:6px 10px;border-radius:6px;font-size:12px;";
    row.innerHTML = `
      <span>${v.nombre} (${Number(v.precio || 0) >= 0 ? "+" : ""}${Number(v.precio || 0).toFixed(2)} €)</span>
      <button type="button" class="btn-icon" style="color:var(--danger);font-size:16px;cursor:pointer;background:none;border:none;" onclick="eliminarVarianteCategoriaDev(${idx})">&times;</button>
    `;
    list.appendChild(row);
  });
}

window.agregarVarianteCategoriaDev = () => {
  const nomEl = document.getElementById("new-form-cat-var-nombre");
  const preEl = document.getElementById("new-form-cat-var-precio");
  if (!nomEl || !preEl) return;
  const nombre = nomEl.value.trim();
  const precio = parseFloat(preEl.value) || 0;
  if (!nombre) return;
  currentCatVarsDev.push({ nombre, precio });
  nomEl.value = "";
  preEl.value = "";
  renderVariantesCategoriaDev();
};

window.eliminarVarianteCategoriaDev = (idx) => {
  currentCatVarsDev.splice(idx, 1);
  renderVariantesCategoriaDev();
};

function cerrarModalCategoria() {
  document.getElementById("modal-categoria").classList.remove("open");
}

async function guardarCategoria() {
  if (!db) return;
  const id = document.getElementById("form-cat-id").value;
  const nombre = document.getElementById("form-cat-nombre").value.trim();
  const notasPredefinidas = document.getElementById("form-cat-notas").value.trim();
  
  if (!nombre) return;
  
  try {
    if (id) {
      // Editar existente en Firebase
      await update(ref(db, `categorias/${id}`), { 
        nombre, 
        notasPredefinidas: notasPredefinidas || null,
        variantes: currentCatVarsDev.length ? currentCatVarsDev : null
      });
    } else {
      // Crear nueva en Firebase
      const listRef = ref(db, "categorias");
      const newRef = push(listRef);
      // Calcular el orden
      const maxOrden = Object.values(categoriasData).reduce((max, c) => Math.max(max, c.orden || 0), 0);
      await set(newRef, {
        nombre,
        orden: maxOrden + 1,
        notasPredefinidas: notasPredefinidas || null,
        variantes: currentCatVarsDev.length ? currentCatVarsDev : null
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
    await showCustomAlert("Carta", "No se puede eliminar la categoría porque contiene artículos. Elimina o mueve los artículos primero.");
    return;
  }
  
  const ok = await showCustomConfirm("Carta", "¿Quieres eliminar esta categoría de forma permanente?");
  if (!ok) return;
  
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
    await showCustomAlert("Carta", "Error al eliminar la categoría.");
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
  document.getElementById("form-prod-notas").value = "";
  
  document.getElementById("new-form-prod-var-nombre").value = "";
  document.getElementById("new-form-prod-var-precio").value = "";
  
  document.getElementById("form-prod-escombo").checked = false;
  document.getElementById("form-prod-combo-panel").style.display = "none";
  
  currentProdVarsDev = [];
  currentProdComboGroupsDev = [];
  
  renderVariantesProductoDev();
  updateEditComboGroupsListDev();
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
  document.getElementById("form-prod-notas").value = p.notasPredefinidas || "";
  
  document.getElementById("new-form-prod-var-nombre").value = "";
  document.getElementById("new-form-prod-var-precio").value = "";
  
  const esCombo = p.esCombo === true;
  document.getElementById("form-prod-escombo").checked = esCombo;
  document.getElementById("form-prod-combo-panel").style.display = esCombo ? "flex" : "none";
  
  currentProdVarsDev = p.variantes ? JSON.parse(JSON.stringify(p.variantes)) : [];
  
  const rawCombo = p.comboGroups;
  if (rawCombo) {
    const arr = Array.isArray(rawCombo) ? rawCombo : Object.values(rawCombo);
    currentProdComboGroupsDev = arr.map(g => {
      if (!g) return null;
      const itemsRaw = g.items;
      const itemsArr = itemsRaw ? (Array.isArray(itemsRaw) ? itemsRaw : Object.values(itemsRaw)) : [];
      return {
        nombre: g.nombre || '',
        items: itemsArr.filter(Boolean).map(item => ({
          artId: item.artId || '',
          suplemento: parseFloat(item.suplemento) || 0
        }))
      };
    }).filter(Boolean);
  } else {
    currentProdComboGroupsDev = [];
  }
  
  renderVariantesProductoDev();
  updateEditComboGroupsListDev();
}

function renderVariantesProductoDev() {
  const list = document.getElementById("form-prod-variantes-lista");
  if (!list) return;
  list.innerHTML = "";
  
  if (currentProdVarsDev.length === 0) {
    list.innerHTML = `<div style="font-size:11px;color:var(--muted);text-align:center;">Sin variantes configuradas.</div>`;
    return;
  }
  
  currentProdVarsDev.forEach((v, idx) => {
    const row = document.createElement("div");
    row.style.cssText = "display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,0.04);padding:6px 10px;border-radius:6px;font-size:12px;";
    row.innerHTML = `
      <span>${v.nombre} (${Number(v.precio || 0) >= 0 ? "+" : ""}${Number(v.precio || 0).toFixed(2)} €)</span>
      <button type="button" class="btn-icon" style="color:var(--danger);font-size:16px;cursor:pointer;background:none;border:none;" onclick="eliminarVarianteProductoDev(${idx})">&times;</button>
    `;
    list.appendChild(row);
  });
}

window.agregarVarianteProductoDev = () => {
  const nomEl = document.getElementById("new-form-prod-var-nombre");
  const preEl = document.getElementById("new-form-prod-var-precio");
  if (!nomEl || !preEl) return;
  const nombre = nomEl.value.trim();
  const precio = parseFloat(preEl.value) || 0;
  if (!nombre) return;
  currentProdVarsDev.push({ nombre, precio });
  nomEl.value = "";
  preEl.value = "";
  renderVariantesProductoDev();
};

window.eliminarVarianteProductoDev = (idx) => {
  currentProdVarsDev.splice(idx, 1);
  renderVariantesProductoDev();
};

// --- GESTIÓN DE COMBOS EN DESARROLLADOR ---
window.toggleComboPanelDev = () => {
  const chk = document.getElementById("form-prod-escombo");
  const panel = document.getElementById("form-prod-combo-panel");
  if (chk && panel) {
    panel.style.display = chk.checked ? "flex" : "none";
  }
};

window.updateEditComboGroupsListDev = () => {
  const el = document.getElementById("form-prod-combo-groups-lista");
  if (!el) return;
  
  const id = document.getElementById("form-prod-id").value;
  
  const otherArticlesHTML = Object.entries(categoriasData)
    .sort(([, ca], [, cb]) => (ca.orden ?? 999) - (cb.orden ?? 999) || ca.nombre.localeCompare(cb.nombre, 'es'))
    .map(([catId, cat]) => {
      const catArts = Object.entries(cartaData)
        .filter(([itemId, item]) => item.catId === catId && itemId !== id)
        .sort(([, artA], [, artB]) => (artA.orden || 0) - (artB.orden || 0) || artA.nombre.localeCompare(artB.nombre, 'es'));
      if (!catArts.length) return '';
      return `<optgroup label="${cat.nombre}">
        ${catArts.map(([itemId, item]) => `<option value="${itemId}">${item.nombre} (${Number(item.precio).toFixed(2)} €)</option>`).join('')}
      </optgroup>`;
    }).join('');

  el.innerHTML = currentProdComboGroupsDev.map((g, gIdx) => `
    <div style="background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:8px;padding:8px;display:flex;flex-direction:column;gap:6px;margin-bottom:6px">
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);padding-bottom:4px">
        <span style="font-weight:bold;font-size:12px;color:var(--text)">Grupo: ${g.nombre}</span>
        <button type="button" class="btn-icon" onclick="window.eliminarGrupoComboDev(${gIdx})" style="font-size:16px;color:var(--danger);background:none;border:none;cursor:pointer;">&times;</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:4px">
        ${(g.items || []).map((item, itemIdx) => {
          const subArt = cartaData[item.artId];
          const subArtNombre = subArt ? subArt.nombre : '[Artículo Eliminado]';
          return `
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;padding:2px 0">
              <span>${subArtNombre} ${item.suplemento > 0 ? `<b style="color:var(--accent)">+${Number(item.suplemento).toFixed(2)} €</b>` : '<span style="color:var(--muted)">Sin supl.</span>'}</span>
              <button type="button" class="btn-icon" onclick="window.eliminarOpcionComboDev(${gIdx}, ${itemIdx})" style="font-size:14px;color:var(--danger);background:none;border:none;cursor:pointer;">&times;</button>
            </div>
          `;
        }).join('')}
      </div>
      <div style="display:flex;gap:4px;margin-top:4px;align-items:center">
        <select id="combo-art-select-dev-${gIdx}" class="input-text" style="flex:1;font-size:11px;height:30px;padding:2px 6px;">
          <option value="">— Seleccionar artículo —</option>
          ${otherArticlesHTML}
        </select>
        <input type="number" id="combo-supl-input-dev-${gIdx}" placeholder="Supl. €" step="0.05" min="0" class="input-text" style="width:70px;font-size:11px;height:30px;padding:2px 6px;" />
        <button type="button" class="btn" onclick="window.agregarOpcionComboDev(${gIdx})" style="padding:0 8px;font-size:11px;height:30px;">+ Añadir</button>
      </div>
    </div>
  `).join('');
};

window.agregarGrupoComboDev = async () => {
  const nombre = await showCustomPrompt("Nuevo Grupo", "Nombre del grupo (ej: Primeros, Segundos, Postres):");
  if (!nombre || !nombre.trim()) return;
  currentProdComboGroupsDev.push({ nombre: nombre.trim(), items: [] });
  updateEditComboGroupsListDev();
};

window.eliminarGrupoComboDev = async (groupIdx) => {
  const seguro = await showCustomConfirm("Eliminar Grupo", "¿Deseas eliminar este grupo del combo?");
  if (!seguro) return;
  currentProdComboGroupsDev = currentProdComboGroupsDev.filter((_, idx) => idx !== groupIdx);
  updateEditComboGroupsListDev();
};

window.agregarOpcionComboDev = (groupIdx) => {
  const selectEl = document.getElementById(`combo-art-select-dev-${groupIdx}`);
  const suplEl = document.getElementById(`combo-supl-input-dev-${groupIdx}`);
  if (!selectEl || !suplEl) return;
  const artId = selectEl.value;
  const suplemento = parseFloat(suplEl.value) || 0;
  if (!artId) { alert("Elige un artículo"); return; }
  
  if (!currentProdComboGroupsDev[groupIdx]) return;
  currentProdComboGroupsDev[groupIdx].items.push({ artId, suplemento });
  updateEditComboGroupsListDev();
};

window.eliminarOpcionComboDev = (groupIdx, itemIdx) => {
  if (!currentProdComboGroupsDev[groupIdx]) return;
  currentProdComboGroupsDev[groupIdx].items = currentProdComboGroupsDev[groupIdx].items.filter((_, idx) => idx !== itemIdx);
  updateEditComboGroupsListDev();
};

async function guardarProducto() {
  if (!db || !categoriaSeleccionadaId) return;
  
  const id = document.getElementById("form-prod-id").value;
  const nombre = document.getElementById("form-prod-nombre").value.trim();
  const precio = parseFloat(document.getElementById("form-prod-precio").value);
  const destino = document.getElementById("form-prod-destino").value;
  const notasPredefinidas = document.getElementById("form-prod-notas").value.trim();
  const esCombo = document.getElementById("form-prod-escombo").checked;
  
  if (!nombre || isNaN(precio) || precio < 0) {
    alert("Por favor, rellena todos los campos correctamente.");
    return;
  }
  
  try {
    const payload = {
      nombre,
      precio,
      destino,
      notasPredefinidas: notasPredefinidas || null,
      variantes: currentProdVarsDev.length ? currentProdVarsDev : null,
      esCombo: esCombo,
      comboGroups: esCombo && currentProdComboGroupsDev.length ? currentProdComboGroupsDev : null
    };

    if (id) {
      // Editar
      await update(ref(db, `carta/${id}`), payload);
    } else {
      // Crear nuevo
      const newRef = push(ref(db, "carta"));
      // Orden del producto
      const maxOrden = Object.values(cartaData)
        .filter(p => p.catId === categoriaSeleccionadaId)
        .reduce((max, p) => Math.max(max, p.orden || 0), 0);
        
      payload.catId = categoriaSeleccionadaId;
      payload.orden = maxOrden + 1;

      await set(newRef, payload);
    }
    cerrarModalProducto();
  } catch (error) {
    alert("Error al guardar el producto en la base de datos.");
  }
}

async function eliminarProducto(pid) {
  if (!db) return;
  const ok = await showCustomConfirm("Carta", "¿Deseas eliminar este artículo de la carta permanentemente?");
  if (!ok) return;
  
  try {
    await remove(ref(db, `carta/${pid}`));
  } catch (error) {
    await showCustomAlert("Carta", "Error al eliminar el producto.");
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

  // Al entrar a gestoría solo se preparan las fechas: la lectura de historial
  // queda reservada para el botón «Consultar» o los filtros rápidos.
  if (paneId === "gestoria") {
    const dDesde = document.getElementById("gestoria-desde");
    const dHasta = document.getElementById("gestoria-hasta");
    if (dDesde && !dDesde.value) {
      const hoy = new Date().toISOString().split("T")[0];
      dDesde.value = hoy;
      dHasta.value = hoy;
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
    const isActive = u.activo !== false;
    const sesion = sesionesCamarerosData[id];
    const sesionActiva = Boolean(sesion?.sessionId);
    const presencia = sesion?.estado === 'desconectado'
      ? 'DESCONECTADO'
      : (sesion?.estado === 'segundo_plano' ? 'EN SEGUNDO PLANO' : 'EN USO');
    const ultimaActividad = sesion?.ultimaActividad ? new Date(sesion.ultimaActividad).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '';
    card.innerHTML = `
      <div class="camarero-card-info">
        <span class="camarero-card-name">${u.nombre}</span>
        <span class="camarero-card-pin">PIN: ${u.pin}</span>
        <span style="font-size:11px;color:${sesionActiva ? (sesion?.estado === 'desconectado' ? '#f59e0b' : '#22c55e') : 'var(--text-dim)'};font-weight:700;">${sesionActiva ? `● ${presencia}${ultimaActividad ? ` · ${ultimaActividad}` : ''}` : '○ SIN SESIÓN'}</span>
      </div>
      <div style="display: flex; align-items: center; gap: 12px;">
        <label class="switch" style="transform: scale(0.85); margin: 0; display: inline-block;">
          <input type="checkbox" ${isActive ? "checked" : ""} onchange="window.toggleCamareroActivoDev('${id}', this.checked)">
          <span class="slider"></span>
        </label>
        ${sesionActiva ? `<button class="btn-icon" onclick="cerrarSesionCamareroDev('${id}')" title="Cerrar sesión remota">⏏</button>` : ''}
        <button class="btn-icon delete" onclick="deleteCamarero('${id}')" title="Eliminar Camarero">🗑️</button>
      </div>
    `;
    lista.appendChild(card);
  });
}

async function toggleCamareroActivoDev(id, activo) {
  if (!db) return;
  try {
    await update(ref(db, `config/usuarios/${id}`), { activo });
    if (!activo) await remove(ref(db, `config/sesionesCamareros/${id}`));
    console.log(`Estado activo del camarero ${id} actualizado a:`, activo);
  } catch (error) {
    alert("Error al actualizar el estado del camarero.");
  }
}

async function cerrarSesionCamareroDev(id) {
  if (!db) return;
  const camarero = usuariosData[id]?.nombre || 'este camarero';
  const ok = await showCustomConfirm('Cerrar sesión', `¿Cerrar remotamente la sesión de ${camarero}?`);
  if (!ok) return;
  try {
    await remove(ref(db, `config/sesionesCamareros/${id}`));
  } catch (_) {
    await showCustomAlert('Cerrar sesión', 'No se pudo cerrar la sesión remota.');
  }
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
  const ok = await showCustomConfirm("Camareros", "¿Estás seguro de que quieres eliminar este camarero?");
  if (!ok) return;

  try {
    await remove(ref(db, `config/usuarios/${id}`));
  } catch (err) {
    await showCustomAlert("Camareros", "Error al eliminar camarero.");
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

  const setPrinterVals = (type, dbKey) => {
    const config = printServiceData[dbKey || type] || {};
    const printerEl = document.getElementById(`ps-${type}-printer`);
    const enabledEl = document.getElementById(`ps-${type}-enabled`);
    const paperEl = document.getElementById(`ps-${type}-paper`);
    const fontSizeEl = document.getElementById(`ps-${type}-font-size`);
    if (printerEl) printerEl.value = config.printerName || "";
    if (enabledEl) enabledEl.value = String(config.enabled !== false);
    if (paperEl) paperEl.value = config.paper || "58mm";
    
    let localKey = type === 'ticket' ? 'ticketFontSize' : `${type}FontSize`;
    if (fontSizeEl) fontSizeEl.value = localConfig[localKey] || config.fontSize || 9;
  };

  setPrinterVals("ticket", "ticketFinal");
  setPrinterVals("barra");
  setPrinterVals("cocina");
  setPrinterVals("pizzas");
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
      paper: document.getElementById(`ps-${type}-paper`).value,
      fontSize: parseFloat(document.getElementById(`ps-${type}-font-size`).value) || 9
    };
  };

  const ticketCfg = getPrinterConfig("ticket");
  const barraCfg = getPrinterConfig("barra");
  const cocinaCfg = getPrinterConfig("cocina");
  const pizzasCfg = getPrinterConfig("pizzas");

  try {
    await update(ref(db, "config/printService"), {
      ticketFinal: ticketCfg,
      barra: barraCfg,
      cocina: cocinaCfg,
      pizzas: pizzasCfg
    });
    await update(ref(db, "config/local"), {
      ticketFontSize: ticketCfg.fontSize,
      barraFontSize: barraCfg.fontSize,
      cocinaFontSize: cocinaCfg.fontSize,
      pizzasFontSize: pizzasCfg.fontSize
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

function toggleAuditFilters() {
  const bar = document.querySelector("#audit-unlocked .auditoria-filter-bar");
  const icon = document.getElementById("audit-filters-toggle-icon");
  if (!bar || !icon) return;

  if (bar.style.display === "none") {
    bar.style.display = ""; // defaults back to CSS (grid)
    icon.textContent = "▲";
  } else {
    bar.style.display = "none";
    icon.textContent = "▼";
  }
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

  // Colapsar filtros por defecto en móvil para ahorrar espacio
  if (window.innerWidth <= 768) {
    const bar = document.querySelector("#audit-unlocked .auditoria-filter-bar");
    const icon = document.getElementById("audit-filters-toggle-icon");
    if (bar && icon) {
      bar.style.display = "none";
      icon.textContent = "▼";
    }
  } else {
    // Asegurar que comience expandido en desktop
    const bar = document.querySelector("#audit-unlocked .auditoria-filter-bar");
    const icon = document.getElementById("audit-filters-toggle-icon");
    if (bar && icon) {
      bar.style.display = "";
      icon.textContent = "▲";
    }
  }
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

// --- GESTIÓN DE NOVEDADES (ANUNCIOS) ---
function renderNovedadesConfig() {
  const listaEl = document.getElementById("novedades-lista");
  if (!listaEl) return;

  const entries = Object.entries(novedadesData || {}).filter(([k, v]) => v && typeof v === "object");

  if (entries.length === 0) {
    listaEl.innerHTML = `<div style="font-size: 13px; color: var(--text-dim); text-align: center; padding: 20px;">Sin mensajes registrados. Crea uno a la izquierda.</div>`;
    return;
  }

  // Ordenar por ID o nombre
  entries.sort((a, b) => a[0].localeCompare(b[0]));

  listaEl.innerHTML = "";
  entries.forEach(([id, n]) => {
    const item = document.createElement("div");
    item.style.padding = "10px 14px";
    item.style.border = "1px solid var(--border)";
    item.style.borderRadius = "8px";
    item.style.background = "rgba(255, 255, 255, 0.02)";
    item.style.display = "flex";
    item.style.justifyContent = "space-between";
    item.style.alignItems = "center";
    item.style.gap = "10px";

    const badgeColor = n.activo ? "var(--success)" : "var(--danger)";
    const badgeText = n.activo ? "Activo" : "Inactivo";

    item.innerHTML = `
      <div style="flex: 1; min-width: 0;">
        <div style="font-size: 13px; font-weight: 500; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          ${n.titulo} <span style="font-size: 10px; color: var(--text-dim)">(${id})</span>
        </div>
        <div style="font-size: 10px; color: ${badgeColor}; font-weight: 500; margin-top: 2px;">
          ● ${badgeText}
        </div>
      </div>
      <div style="display: flex; gap: 6px; flex-shrink: 0;">
        <button class="btn btn-secondary" onclick="window.cargarNovedadForm('${id}')" style="height: auto; padding: 4px 8px; font-size: 11px;">Editar</button>
        <button class="btn" onclick="window.eliminarNovedad('${id}')" style="height: auto; padding: 4px 8px; font-size: 11px; background: none; border: 1px solid var(--danger); color: var(--danger);">Eliminar</button>
      </div>
    `;
    listaEl.appendChild(item);
  });
}

function cargarNovedadForm(id) {
  const n = novedadesData[id];
  if (!n) return;

  const nid = document.getElementById("nov-input-id");
  const ntitle = document.getElementById("nov-input-titulo");
  const nmsg = document.getElementById("nov-input-mensaje");
  const nactive = document.getElementById("nov-input-activo");

  if (nid) {
    nid.value = n.id || id;
    nid.disabled = true; // Desactivar edición de ID para evitar duplicaciones
  }
  if (ntitle) ntitle.value = n.titulo || "";
  if (nmsg) nmsg.value = n.mensaje || "";
  if (nactive) nactive.checked = n.activo !== false;
}

function limpiarNovedadForm() {
  const nid = document.getElementById("nov-input-id");
  const ntitle = document.getElementById("nov-input-titulo");
  const nmsg = document.getElementById("nov-input-mensaje");
  const nactive = document.getElementById("nov-input-activo");

  if (nid) {
    nid.value = "";
    nid.disabled = false;
  }
  if (ntitle) ntitle.value = "";
  if (nmsg) nmsg.value = "";
  if (nactive) nactive.checked = true;
}

async function guardarNovedadConfig() {
  if (!db) return;
  const nid = document.getElementById("nov-input-id").value.trim().replace(/[\.\#\$\[\]\/]/g, '_');
  const ntitle = document.getElementById("nov-input-titulo").value.trim();
  const nmsg = document.getElementById("nov-input-mensaje").value.trim();
  const nactive = document.getElementById("nov-input-activo").checked;

  if (!nid || !ntitle || !nmsg) {
    alert("Todos los campos (ID, Título y Mensaje) son obligatorios.");
    return;
  }

  const originalNovedad = novedadesData[nid] || {};
  const createdAt = originalNovedad.createdAt || Date.now();

  try {
    await set(ref(db, `novedades/${nid}`), {
      id: nid,
      titulo: ntitle,
      mensaje: nmsg,
      activo: nactive,
      createdAt: createdAt
    });
    alert("Novedad guardada correctamente.");
    limpiarNovedadForm();
  } catch (error) {
    alert("Error al guardar la novedad: " + error.message);
  }
}

async function eliminarNovedad(id) {
  if (!db) return;
  const ok = await showCustomConfirm("Novedades", `¿Seguro que deseas eliminar la novedad "${id}"?`);
  if (!ok) return;
  try {
    await remove(ref(db, `novedades/${id}`));
    await showCustomAlert("Novedades", "Novedad eliminada.");
    limpiarNovedadForm();
  } catch (error) {
    await showCustomAlert("Novedades", "Error al eliminar la novedad: " + error.message);
  }
}

async function resetearVistosNovedad() {
  if (!db) return;
  const ok = await showCustomConfirm("Novedades", "¿Seguro que deseas reiniciar los vistos? Esto hará que todos los camareros vuelvan a ver todos los mensajes activos de nuevo.");
  if (!ok) return;
  try {
    await remove(ref(db, "novedades_vistas"));
    await showCustomAlert("Novedades", "Se han reiniciado los vistos de todos los camareros.");
  } catch (error) {
    await showCustomAlert("Novedades", "Error al reiniciar los vistos: " + error.message);
  }
}

// --- MODAL GENÉRICO PERSONALIZADO (ALERT/CONFIRM/PROMPT) ---
let currentModalResolve = null;
let customModalHideTimer = null;

function mostrarCustomModal(titulo, mensaje, tipo, defaultValue = "") {
  return new Promise((resolve) => {
    // Si un modal abre otro inmediatamente, el cierre animado del anterior
    // no debe ocultar el nuevo.
    if (customModalHideTimer) {
      clearTimeout(customModalHideTimer);
      customModalHideTimer = null;
    }
    if (currentModalResolve) {
      currentModalResolve(null);
    }
    currentModalResolve = resolve;

    const overlay = document.getElementById("overlay-custom-modal");
    const modal = document.getElementById("custom-modal");
    const titleEl = document.getElementById("custom-modal-title");
    const msgEl = document.getElementById("custom-modal-message");
    const inputEl = document.getElementById("custom-modal-input");
    const btnCancel = document.getElementById("custom-modal-btn-cancel");
    const btnOk = document.getElementById("custom-modal-btn-ok");

    if (!overlay || !modal) {
      resolve(tipo === "prompt" ? defaultValue : (tipo !== "confirm"));
      return;
    }

    titleEl.textContent = titulo;
    msgEl.textContent = mensaje;

    if (tipo === "prompt") {
      inputEl.style.display = "block";
      inputEl.value = defaultValue;
    } else {
      inputEl.style.display = "none";
    }

    if (tipo === "alert") {
      btnCancel.style.display = "none";
    } else {
      btnCancel.style.display = "block";
    }

    overlay.style.display = "block";
    overlay.classList.add("open");
    modal.style.display = "flex";
    modal.style.opacity = "0";
    modal.style.transform = "translate(-50%, -50%) scale(0.9)";
    
    modal.offsetHeight; // force reflow

    setTimeout(() => {
      modal.style.opacity = "1";
      modal.style.transform = "translate(-50%, -50%) scale(1)";
      if (tipo === "prompt") {
        inputEl.focus();
        inputEl.setSelectionRange(inputEl.value.length, inputEl.value.length);
      }
    }, 10);

    btnOk.onclick = () => {
      const value = tipo === "prompt" ? inputEl.value : true;
      ocultarCustomModal();
      currentModalResolve = null;
      resolve(value);
    };

    btnCancel.onclick = () => {
      ocultarCustomModal();
      currentModalResolve = null;
      resolve(tipo === "prompt" ? null : false);
    };

    inputEl.onkeydown = (e) => {
      if (e.key === "Enter") {
        btnOk.click();
      }
    };
  });
}

function ocultarCustomModal() {
  const overlay = document.getElementById("overlay-custom-modal");
  const modal = document.getElementById("custom-modal");
  if (modal) {
    modal.style.opacity = "0";
    modal.style.transform = "translate(-50%, -50%) scale(0.9)";
  }
  if (customModalHideTimer) clearTimeout(customModalHideTimer);
  customModalHideTimer = setTimeout(() => {
    if (overlay) {
      overlay.style.display = "none";
      overlay.classList.remove("open");
    }
    if (modal) {
      modal.style.display = "none";
    }
    customModalHideTimer = null;
  }, 150);
}

function cerrarCustomModal() {
  if (currentModalResolve) {
    const cancelBtn = document.getElementById("custom-modal-btn-cancel");
    if (cancelBtn && cancelBtn.style.display !== "none") {
      cancelBtn.click();
    } else {
      const okBtn = document.getElementById("custom-modal-btn-ok");
      if (okBtn) okBtn.click();
    }
  }
}

function showCustomAlert(titulo, mensaje) {
  return mostrarCustomModal(titulo, mensaje, "alert");
}

function showCustomConfirm(titulo, mensaje) {
  return mostrarCustomModal(titulo, mensaje, "confirm");
}

function showCustomPrompt(titulo, mensaje, defaultValue = "") {
  return mostrarCustomModal(titulo, mensaje, "prompt", defaultValue);
}

// Sobreescribir el alert nativo del navegador para usar nuestro modal personalizado en toda la página
window.alert = function(mensaje) {
  showCustomAlert("Mensaje", mensaje);
};

// --- GESTORÍA Y AJUSTE INTELIGENTE DE FACTURACIÓN ---
let gestoriaTicketsList = [];
let gestoriaSubtabActiva = 'dias';
let gestoriaModoSeleccion = false;
let gestoriaSelectedIds = new Set();
let gestoriaPropuestas = [];
let gestoriaUltimoInformeCierres = [];
let gestoriaFiltroTexto = '';

const escapeHtml = (str) => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function setQuickFiltroGestoria(preset, btn) {
  if (btn) {
    document.querySelectorAll('.btn-gestoria-quick').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }

  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-11
  const d = now.getDate();

  function pad(n) { return String(n).padStart(2, '0'); }
  function fmtDate(dt) { return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`; }

  let desde = '';
  let hasta = '';

  switch (preset) {
    case 'hoy': {
      desde = fmtDate(now);
      hasta = fmtDate(now);
      break;
    }
    case 'ayer': {
      const ayer = new Date(y, m, d - 1);
      desde = fmtDate(ayer);
      hasta = fmtDate(ayer);
      break;
    }
    case 'mes_actual': {
      desde = `${y}-${pad(m + 1)}-01`;
      const finMes = new Date(y, m + 1, 0);
      hasta = fmtDate(finMes);
      break;
    }
    case 'mes_anterior': {
      const iniMesAnt = new Date(y, m - 1, 1);
      const finMesAnt = new Date(y, m, 0);
      desde = fmtDate(iniMesAnt);
      hasta = fmtDate(finMesAnt);
      break;
    }
    case 'trimestre_actual': {
      const q = Math.floor(m / 3);
      const iniQ = new Date(y, q * 3, 1);
      const finQ = new Date(y, (q + 1) * 3, 0);
      desde = fmtDate(iniQ);
      hasta = fmtDate(finQ);
      break;
    }
    case 'trimestre_anterior': {
      const q = Math.floor(m / 3);
      const prevQ = q === 0 ? 3 : q - 1;
      const prevY = q === 0 ? y - 1 : y;
      const iniQ = new Date(prevY, prevQ * 3, 1);
      const finQ = new Date(prevY, (prevQ + 1) * 3, 0);
      desde = fmtDate(iniQ);
      hasta = fmtDate(finQ);
      break;
    }
    case 't1': {
      desde = `${y}-01-01`;
      hasta = `${y}-03-31`;
      break;
    }
    case 't2': {
      desde = `${y}-04-01`;
      hasta = `${y}-06-30`;
      break;
    }
    case 't3': {
      desde = `${y}-07-01`;
      hasta = `${y}-09-30`;
      break;
    }
    case 't4': {
      desde = `${y}-10-01`;
      hasta = `${y}-12-31`;
      break;
    }
  }

  if (desde && hasta) {
    document.getElementById("gestoria-desde").value = desde;
    document.getElementById("gestoria-hasta").value = hasta;
    cargarGestoriaBajoDemanda();
  }
}

async function cargarGestoriaBajoDemanda() {
  if (!db) return;

  const desdeStr = document.getElementById("gestoria-desde").value;
  const hastaStr = document.getElementById("gestoria-hasta").value;
  if (!desdeStr || !hastaStr) {
    showCustomAlert("Gestoría", "Por favor selecciona un rango de fechas.");
    return;
  }

  // Cargar ventas del rango
  const data = await cargarVentasRango(desdeStr, hastaStr);
  gestoriaTicketsList = Object.entries(data).map(([id, t]) => ({
    id,
    ...t
  }));

  // Ordenar cronológicamente descendiente
  gestoriaTicketsList.sort((a, b) => Number(b.ts || b.createdAt || 0) - Number(a.ts || a.createdAt || 0));

  // Resetear selecciones y propuestas anteriores
  gestoriaSelectedIds.clear();
  actualizarBadgeSeleccionados();
  gestoriaPropuestas = [];
  const propCont = document.getElementById("gestoria-propuestas-container");
  if (propCont) propCont.style.display = "none";

  // Calcular KPIs
  let totalFacturado = 0;
  let totalEf = 0;
  let totalTj = 0;
  let conteo = gestoriaTicketsList.length;

  gestoriaTicketsList.forEach(t => {
    const tot = Number(t.total || 0);
    totalFacturado += tot;
    const metodo = (t.pagoMetodo || '').toLowerCase();
    if (metodo === 'tarjeta') {
      totalTj += tot;
    } else {
      totalEf += tot;
    }
  });

  const kpiTot = document.getElementById("gestoria-kpi-total");
  const kpiEf = document.getElementById("gestoria-kpi-efectivo");
  const kpiTj = document.getElementById("gestoria-kpi-tarjeta");
  const kpiCnt = document.getElementById("gestoria-kpi-tickets");
  const kpiMed = document.getElementById("gestoria-kpi-medio");

  if (kpiTot) kpiTot.textContent = `${totalFacturado.toFixed(2)} €`;
  if (kpiEf) kpiEf.textContent = `${totalEf.toFixed(2)} €`;
  if (kpiTj) kpiTj.textContent = `${totalTj.toFixed(2)} €`;
  if (kpiCnt) kpiCnt.textContent = conteo;
  if (kpiMed) kpiMed.textContent = conteo ? `${(totalFacturado / conteo).toFixed(2)} €` : "0,00 €";

  renderGestoriaSegunSubtab();
}

function cambiarSubtabGestoria(subtab) {
  gestoriaSubtabActiva = subtab;
  document.querySelectorAll('.gestoria-subtab-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(`gest-subtab-${subtab}`);
  if (btn) btn.classList.add('active');

  const vDias = document.getElementById('gestoria-view-dias');
  const vTickets = document.getElementById('gestoria-view-tickets');
  const vArticulos = document.getElementById('gestoria-view-articulos');

  if (vDias) vDias.style.display = subtab === 'dias' ? 'flex' : 'none';
  if (vTickets) vTickets.style.display = subtab === 'tickets' ? 'flex' : 'none';
  if (vArticulos) vArticulos.style.display = subtab === 'articulos' ? 'flex' : 'none';

  renderGestoriaSegunSubtab();
}

function renderGestoriaSegunSubtab() {
  if (gestoriaSubtabActiva === 'dias') renderGestoriaDias();
  else if (gestoriaSubtabActiva === 'tickets') renderGestoriaTickets();
  else if (gestoriaSubtabActiva === 'articulos') renderGestoriaArticulos();
}

function agruparVentasPorDiaLocal(tickets) {
  const mapa = {};
  tickets.forEach(t => {
    let fechaKey = t.fecha;
    if (!fechaKey || !/^\d{4}-\d{2}-\d{2}$/.test(fechaKey)) {
      const ts = Number(t.createdAt || t.ts || 0);
      if (ts) {
        const dt = new Date(ts);
        fechaKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
      } else {
        fechaKey = 'Desconocida';
      }
    }
    if (!mapa[fechaKey]) {
      mapa[fechaKey] = {
        fechaKey,
        tickets: 0,
        efectivo: 0,
        tarjeta: 0,
        total: 0,
        articulos: 0,
        listaTickets: []
      };
    }
    const tot = Number(t.total || 0);
    mapa[fechaKey].tickets += 1;
    mapa[fechaKey].total += tot;
    mapa[fechaKey].listaTickets.push(t);
    const metodo = (t.pagoMetodo || '').toLowerCase();
    if (metodo === 'tarjeta') {
      mapa[fechaKey].tarjeta += tot;
    } else {
      mapa[fechaKey].efectivo += tot;
    }
    const sumQty = (t.lineas || []).reduce((acc, l) => acc + Number(l.qty || 0), 0);
    mapa[fechaKey].articulos += sumQty;
  });

  return Object.values(mapa).sort((a, b) => b.fechaKey.localeCompare(a.fechaKey));
}

function renderGestoriaDias() {
  const tbody = document.getElementById("gestoria-tbody-dias");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (gestoriaTicketsList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-dim);padding:30px;">No hay ventas registradas en el período seleccionado.</td></tr>`;
    return;
  }

  const dias = agruparVentasPorDiaLocal(gestoriaTicketsList);
  dias.forEach(d => {
    let fTxt = d.fechaKey;
    if (d.fechaKey !== 'Desconocida') {
      const fObj = new Date(d.fechaKey + 'T12:00:00');
      fTxt = !isNaN(fObj.getTime())
        ? fObj.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
        : d.fechaKey;
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="font-weight:600;">${fTxt}</td>
      <td style="text-align: right; font-family: var(--font-code);">${d.tickets}</td>
      <td style="text-align: right; font-family: var(--font-code); color: #10b981;">${d.efectivo.toFixed(2)} €</td>
      <td style="text-align: right; font-family: var(--font-code); color: #60a5fa;">${d.tarjeta.toFixed(2)} €</td>
      <td class="table-price" style="text-align: right; color: var(--accent); font-weight:700;">${d.total.toFixed(2)} €</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderGestoriaTickets() {
  const tbody = document.getElementById("gestoria-tbody-tickets");
  if (!tbody) return;
  tbody.innerHTML = "";

  const query = gestoriaFiltroTexto.toLowerCase().trim();
  let list = gestoriaTicketsList;
  if (query) {
    list = list.filter(t => 
      String(t.mesaNombre || t.mesa || '').toLowerCase().includes(query) ||
      String(t.camarero || '').toLowerCase().includes(query) ||
      String(t.pagoMetodo || '').toLowerCase().includes(query)
    );
  }

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-dim);padding:30px;">No se encontraron tickets con el criterio seleccionado.</td></tr>`;
    return;
  }

  list.forEach(t => {
    const tot = Number(t.total || 0);
    const ts = Number(t.createdAt || t.ts || 0);
    const fTxt = ts ? new Date(ts).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : (t.fecha || '—');
    const metodo = (t.pagoMetodo || '').toLowerCase() === 'tarjeta' ? '💳 Tarjeta' : '💵 Efectivo';
    const isSelected = gestoriaSelectedIds.has(t.id);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="td-chk-gestoria" style="display: ${gestoriaModoSeleccion ? 'table-cell' : 'none'}; text-align: center;">
        <input type="checkbox" style="cursor:pointer;" onchange="window.toggleSelectTicket('${t.id}')" ${isSelected ? 'checked' : ''}>
      </td>
      <td>${fTxt}</td>
      <td style="font-weight:600;">${escapeHtml(t.mesaNombre || t.mesa || '—')}</td>
      <td>${escapeHtml(t.camarero || '—')}</td>
      <td>${metodo}</td>
      <td class="table-price" style="text-align: right; color: var(--accent); font-weight:600;">${tot.toFixed(2)} €</td>
      <td style="text-align: right;">
        <button type="button" class="btn btn-secondary" onclick="mostrarDetalleTicketHistorico('${t.id}')" style="padding: 4px 8px; font-size: 11px;" title="Ver Detalle">👁️</button>
        <button type="button" class="btn btn-secondary" onclick="window.eliminarTicketIndividualGestoria('${t.id}')" style="padding: 4px 8px; font-size: 11px; color: var(--danger); border-color: rgba(248,113,113,0.3);" title="Eliminar Ticket">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function filtrarTicketsGestoria(val) {
  gestoriaFiltroTexto = val || '';
  renderGestoriaTickets();
}

function toggleModoBorradoManual() {
  gestoriaModoSeleccion = !gestoriaModoSeleccion;
  const btn = document.getElementById("btn-toggle-modo-seleccion");
  const actions = document.getElementById("gestoria-selection-actions");
  const th = document.querySelector(".th-chk-gestoria");

  if (btn) {
    btn.textContent = gestoriaModoSeleccion ? "✕ Desactivar Modo Borrado" : "☑️ Activar Modo Borrado Manual";
    btn.style.color = gestoriaModoSeleccion ? "var(--danger)" : "var(--text)";
  }
  if (actions) actions.style.display = gestoriaModoSeleccion ? "flex" : "none";
  if (th) th.style.display = gestoriaModoSeleccion ? "table-cell" : "none";

  renderGestoriaTickets();
}

function toggleSelectTicket(id) {
  if (gestoriaSelectedIds.has(id)) {
    gestoriaSelectedIds.delete(id);
  } else {
    gestoriaSelectedIds.add(id);
  }
  actualizarBadgeSeleccionados();
}

function seleccionarTodosTickets(check) {
  if (check) {
    gestoriaTicketsList.forEach(t => gestoriaSelectedIds.add(t.id));
  } else {
    gestoriaSelectedIds.clear();
  }
  actualizarBadgeSeleccionados();
  renderGestoriaTickets();
}

function actualizarBadgeSeleccionados() {
  const badge = document.getElementById("gestoria-selected-count-badge");
  if (!badge) return;
  let sum = 0;
  gestoriaSelectedIds.forEach(id => {
    const t = gestoriaTicketsList.find(x => x.id === id);
    if (t) sum += Number(t.total || 0);
  });
  badge.textContent = `${gestoriaSelectedIds.size} sel. (${sum.toFixed(2)} €)`;
}

async function borrarTicketsSeleccionados() {
  if (gestoriaSelectedIds.size === 0) {
    showCustomAlert("Borrar Tickets", "No hay ningún ticket seleccionado.");
    return;
  }

  let sum = 0;
  gestoriaSelectedIds.forEach(id => {
    const t = gestoriaTicketsList.find(x => x.id === id);
    if (t) sum += Number(t.total || 0);
  });

  const ok = await showCustomConfirm(
    "Eliminar Tickets",
    `¿Deseas eliminar permanentemente los ${gestoriaSelectedIds.size} tickets seleccionados por un importe total de ${sum.toFixed(2)} €?\n\nEsta acción no se puede deshacer.`
  );
  if (!ok) return;

  try {
    for (const tid of gestoriaSelectedIds) {
      await remove(ref(db, `historial/${tid}`));
    }
    await showCustomAlert("Tickets Eliminados", `Se han eliminado ${gestoriaSelectedIds.size} tickets correctamente.`);
    cargarGestoriaBajoDemanda();
  } catch (err) {
    console.error(err);
    showCustomAlert("Error", "Ocurrió un error al eliminar los tickets.");
  }
}

async function eliminarTicketIndividualGestoria(id) {
  const t = gestoriaTicketsList.find(x => x.id === id);
  if (!t) return;

  const ok = await showCustomConfirm(
    "Eliminar Ticket",
    `¿Deseas eliminar el ticket de ${t.mesaNombre || t.mesa || 'Mesa'} por un importe de ${Number(t.total || 0).toFixed(2)} €?`
  );
  if (!ok) return;

  try {
    await remove(ref(db, `historial/${id}`));
    cargarGestoriaBajoDemanda();
  } catch (err) {
    console.error(err);
    showCustomAlert("Error", "Error al eliminar el ticket.");
  }
}

function renderGestoriaArticulos() {
  const tbody = document.getElementById("gestoria-tbody-articulos");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (gestoriaTicketsList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text-dim);padding:30px;">No hay ventas registradas en el período seleccionado.</td></tr>`;
    return;
  }

  const mapaArts = {};
  let totalFact = 0;
  gestoriaTicketsList.forEach(t => {
    (t.lineas || []).forEach(l => {
      const nombre = String(l.nombre || 'Sin nombre').trim();
      const qty = Number(l.qty || 0);
      const precio = Number(l.precio || 0);
      const tot = precio * qty;
      if (!mapaArts[nombre]) mapaArts[nombre] = { nombre, qty: 0, total: 0 };
      mapaArts[nombre].qty += qty;
      mapaArts[nombre].total += tot;
      totalFact += tot;
    });
  });

  const ranking = Object.values(mapaArts).sort((a, b) => b.total - a.total);
  ranking.forEach(a => {
    const pct = totalFact > 0 ? ((a.total / totalFact) * 100).toFixed(1) : "0.0";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="font-weight:500;">${escapeHtml(a.nombre)}</td>
      <td style="text-align: right; font-family: var(--font-code);">${a.qty}</td>
      <td class="table-price" style="text-align: right; color: var(--accent);">${a.total.toFixed(2)} €</td>
      <td style="text-align: right; font-family: var(--font-code); color: var(--text-dim);">${pct}%</td>
    `;
    tbody.appendChild(tr);
  });
}

function toggleAjustePanel() {
  const body = document.getElementById("gestoria-ajuste-body");
  const btn = document.getElementById("btn-toggle-ajuste");
  if (!body) return;
  const isHidden = body.style.display === "none";
  body.style.display = isHidden ? "flex" : "none";
  if (btn) btn.textContent = isHidden ? "Ocultar Panel" : "Mostrar Panel";
}

// --- MOTOR DE AJUSTE INTELIGENTE (MULTI-ESTIMACIÓN DISPERSA NO CORRELATIVA) ---
function calcularPropuestasAjuste() {
  if (!gestoriaTicketsList.length) {
    showCustomAlert("Ajuste de Facturación", "Primero consulta un período con ventas.");
    return;
  }

  const targetInput = document.getElementById("gestoria-target-total");
  const targetTotal = parseFloat(targetInput.value);
  if (isNaN(targetTotal) || targetTotal <= 0) {
    showCustomAlert("Ajuste de Facturación", "Por favor ingresa una cantidad objetivo válida (€).");
    return;
  }

  const totalReal = gestoriaTicketsList.reduce((acc, t) => acc + Number(t.total || 0), 0);
  if (targetTotal >= totalReal) {
    showCustomAlert("Ajuste de Facturación", `La cantidad objetivo (${targetTotal.toFixed(2)} €) debe ser menor que la facturación real actual (${totalReal.toFixed(2)} €).`);
    return;
  }

  const montoReducir = totalReal - targetTotal;
  const modo = document.getElementById("gestoria-target-mode").value;

  // Filtrar candidatos según modo
  let candidatos = gestoriaTicketsList.slice();
  if (modo === 'efectivo_puro') {
    candidatos = candidatos.filter(t => (t.pagoMetodo || '').toLowerCase() !== 'tarjeta');
  } else if (modo === 'efectivo_preferente') {
    // Preferente efectivo, pero se permiten mixtos si no alcanza
    const soloEf = candidatos.filter(t => (t.pagoMetodo || '').toLowerCase() !== 'tarjeta');
    const sumSoloEf = soloEf.reduce((a, b) => a + Number(b.total || 0), 0);
    if (sumSoloEf >= montoReducir) {
      candidatos = soloEf;
    }
  }

  const sumaCandidatos = candidatos.reduce((acc, t) => acc + Number(t.total || 0), 0);
  if (sumaCandidatos < montoReducir) {
    showCustomAlert("Ajuste de Facturación", `No hay suficientes tickets en el modo seleccionado (${sumaCandidatos.toFixed(2)} € disponibles) para reducir ${montoReducir.toFixed(2)} €.`);
    return;
  }

  // Agrupar candidatos por día
  const diasMap = {};
  candidatos.forEach(t => {
    const f = t.fecha || 'Desconocida';
    if (!diasMap[f]) diasMap[f] = [];
    diasMap[f].push(t);
  });

  // Generar 3 propuestas distintas con algoritmos de dispersión
  gestoriaPropuestas = [
    generarPropuestaDispersa(candidatos, diasMap, montoReducir, totalReal, targetTotal, 'Propuesta A: Dispersión Equilibrada', 'Reparto homogéneo de tickets medianos/pequeños por todos los días del período.', 1.0, false),
    generarPropuestaDispersa(candidatos, diasMap, montoReducir, totalReal, targetTotal, 'Propuesta B: Micro-Tickets Frecuentes', 'Prioriza tickets de menor importe distribuidos en mayor número de días.', 0.6, true),
    generarPropuestaDispersa(candidatos, diasMap, montoReducir, totalReal, targetTotal, 'Propuesta C: Enfoque Alternativo', 'Variación con selección salteada entre días y turnos de mayor actividad.', 1.3, false)
  ];

  renderPropuestasCards();
}

function generarPropuestaDispersa(candidatos, diasMap, montoMeta, totalReal, targetTotal, titulo, desc, factorTicket, priorizarPequenos) {
  const fechas = Object.keys(diasMap);
  const seleccionados = [];
  let sumaActual = 0;

  // Barajar fechas con semilla pseudo-aleatoria
  const fechasShuffle = fechas.slice().sort(() => Math.random() - 0.5);

  // Cuota base por día
  const cuotaPorDia = montoMeta / Math.max(fechas.length, 1);

  // Primera pasada: elegir tickets por día de manera no consecutiva
  for (const f of fechasShuffle) {
    if (sumaActual >= montoMeta) break;
    let ticketsDia = diasMap[f].slice();
    
    if (priorizarPequenos) {
      ticketsDia.sort((a, b) => Number(a.total || 0) - Number(b.total || 0));
    } else {
      // Ordenar aleatorio para no tomar consecutivos
      ticketsDia.sort(() => Math.random() - 0.5);
    }

    let gastadoDia = 0;
    for (let i = 0; i < ticketsDia.length; i += 2) { // Paso de 2 para no correlativos
      const t = ticketsDia[i];
      const tot = Number(t.total || 0);
      if (tot <= 0) continue;
      if (sumaActual + tot <= montoMeta + 15) {
        seleccionados.push(t);
        sumaActual += tot;
        gastadoDia += tot;
        if (gastadoDia >= cuotaPorDia * factorTicket || sumaActual >= montoMeta) break;
      }
    }
  }

  // Segunda pasada si falta para llegar al objetivo
  if (sumaActual < montoMeta) {
    const faltante = montoMeta - sumaActual;
    const restantes = candidatos.filter(c => !seleccionados.some(s => s.id === c.id));
    restantes.sort((a, b) => Math.abs(Number(a.total || 0) - faltante) - Math.abs(Number(b.total || 0) - faltante));

    for (const t of restantes) {
      const tot = Number(t.total || 0);
      if (tot <= 0) continue;
      if (sumaActual + tot <= montoMeta + 20 || Math.abs((sumaActual + tot) - montoMeta) < Math.abs(sumaActual - montoMeta)) {
        seleccionados.push(t);
        sumaActual += tot;
        if (Math.abs(sumaActual - montoMeta) < 5) break;
      }
    }
  }

  const totalResultante = totalReal - sumaActual;
  const desviacion = totalResultante - targetTotal;

  // Contar días afectados
  const diasAfectadosSet = new Set(seleccionados.map(t => t.fecha));
  const efCount = seleccionados.filter(t => (t.pagoMetodo || '').toLowerCase() !== 'tarjeta').length;
  const tjCount = seleccionados.filter(t => (t.pagoMetodo || '').toLowerCase() === 'tarjeta').length;

  return {
    titulo,
    desc,
    tickets: seleccionados,
    sumaEliminada: sumaActual,
    totalResultante,
    desviacion,
    diasAfectadosCount: diasAfectadosSet.size,
    efCount,
    tjCount
  };
}

function renderPropuestasCards() {
  const container = document.getElementById("gestoria-propuestas-container");
  const grid = document.getElementById("gestoria-propuestas-grid");
  if (!container || !grid) return;

  grid.innerHTML = "";
  container.style.display = "block";

  gestoriaPropuestas.forEach((p, idx) => {
    const desvTxt = p.desviacion >= 0 ? `+${p.desviacion.toFixed(2)} €` : `${p.desviacion.toFixed(2)} €`;
    const card = document.createElement("div");
    card.className = "proposal-card";
    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <span class="proposal-badge">${escapeHtml(p.titulo)}</span>
        <span style="font-size: 11px; font-weight: 700; color: ${Math.abs(p.desviacion) < 5 ? '#10b981' : 'var(--warn)'};">Desv: ${desvTxt}</span>
      </div>
      <div style="font-size: 11.5px; color: var(--text-dim); line-height: 1.4;">${escapeHtml(p.desc)}</div>
      
      <div style="background: var(--panel-light); border: 1px solid var(--border); border-radius: 6px; padding: 10px; display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 12px;">
        <div>
          <div style="font-size: 10px; color: var(--text-dim);">RESULTADO FINAL</div>
          <div style="font-weight: 700; font-size: 15px; color: var(--accent); font-family: var(--font-code);">${p.totalResultante.toFixed(2)} €</div>
        </div>
        <div>
          <div style="font-size: 10px; color: var(--text-dim);">A SUPRIMIR</div>
          <div style="font-weight: 700; font-size: 15px; color: var(--danger); font-family: var(--font-code);">${p.sumaEliminada.toFixed(2)} €</div>
        </div>
        <div style="grid-column: span 2; font-size: 11px; color: var(--text-dim); border-top: 1px solid rgba(255,255,255,0.05); padding-top: 4px; display: flex; justify-content: space-between;">
          <span>🧾 <b>${p.tickets.length}</b> tickets (${p.efCount} ef. / ${p.tjCount} tj.)</span>
          <span>📅 <b>${p.diasAfectadosCount}</b> días</span>
        </div>
      </div>

      <div style="display: flex; gap: 8px; margin-top: auto;">
        <button type="button" class="btn btn-secondary" onclick="window.verDetallePropuesta(${idx})" style="flex: 1; font-size: 11.5px; padding: 6px 8px;">👁️ Ver Tickets</button>
        <button type="button" class="btn" onclick="window.aplicarPropuesta(${idx})" style="flex: 1.2; font-size: 11.5px; padding: 6px 8px; background: var(--danger); border-color: var(--danger); color: #fff;">✓ Aplicar</button>
      </div>
    `;
    grid.appendChild(card);
  });
}

function verDetallePropuesta(idx) {
  const p = gestoriaPropuestas[idx];
  if (!p) return;

  const modal = document.getElementById("modal-propuesta-detalle");
  const title = document.getElementById("modal-propuesta-title");
  const resumen = document.getElementById("modal-propuesta-resumen");
  const tbody = document.getElementById("modal-propuesta-tbody");
  const btnAplicar = document.getElementById("btn-aplicar-desde-modal");

  title.textContent = `Detalle de ${p.titulo}`;
  resumen.innerHTML = `
    <b>Resumen de la propuesta:</b> Se eliminarán <b>${p.tickets.length}</b> tickets en <b>${p.diasAfectadosCount}</b> días distintos, reduciendo un total de <b style="color:var(--danger)">${p.sumaEliminada.toFixed(2)} €</b> para dejar el período en <b style="color:var(--accent)">${p.totalResultante.toFixed(2)} €</b>.
  `;

  tbody.innerHTML = "";
  p.tickets.forEach(t => {
    const tot = Number(t.total || 0);
    const ts = Number(t.createdAt || t.ts || 0);
    const fTxt = ts ? new Date(ts).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : (t.fecha || '—');
    const metodo = (t.pagoMetodo || '').toLowerCase() === 'tarjeta' ? '💳 Tarjeta' : '💵 Efectivo';

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${fTxt}</td>
      <td style="font-weight:600;">${escapeHtml(t.mesaNombre || t.mesa || '—')}</td>
      <td>${escapeHtml(t.camarero || '—')}</td>
      <td>${metodo}</td>
      <td class="table-price" style="text-align: right; color: var(--danger); font-weight:600;">-${tot.toFixed(2)} €</td>
    `;
    tbody.appendChild(tr);
  });

  btnAplicar.onclick = () => {
    cerrarModalPropuestaDetalle();
    aplicarPropuesta(idx);
  };

  modal.classList.add("open");
}

function cerrarModalPropuestaDetalle() {
  document.getElementById("modal-propuesta-detalle").classList.remove("open");
}

async function aplicarPropuesta(idx) {
  const p = gestoriaPropuestas[idx];
  if (!p) return;

  const ok = await showCustomConfirm(
    `Confirmar Ajuste: ${p.titulo}`,
    `¿Estás COMPLETAMENTE SEGURO de eliminar los ${p.tickets.length} tickets de esta propuesta?\n\n` +
    `• Importe a reducir: -${p.sumaEliminada.toFixed(2)} €\n` +
    `• Total resultante final: ${p.totalResultante.toFixed(2)} €\n` +
    `• Días afectados: ${p.diasAfectadosCount}\n\n` +
    `Esta acción eliminará estos tickets del historial en Firebase de forma permanente.`
  );
  if (!ok) return;

  try {
    // Calcular días afectados antes de borrar
    const diasAfectadosMap = {};
    p.tickets.forEach(t => {
      const f = t.fecha || 'Desconocida';
      if (!diasAfectadosMap[f]) {
        diasAfectadosMap[f] = { fechaKey: f, ticketsBorrar: 0, montoBorrar: 0, totalAnterior: 0 };
      }
      diasAfectadosMap[f].ticketsBorrar += 1;
      diasAfectadosMap[f].montoBorrar += Number(t.total || 0);
    });

    // Calcular el total anterior por día en base a gestoriaTicketsList
    gestoriaTicketsList.forEach(t => {
      const f = t.fecha || 'Desconocida';
      if (diasAfectadosMap[f]) {
        diasAfectadosMap[f].totalAnterior += Number(t.total || 0);
      }
    });

    // Eliminar tickets de Firebase
    for (const t of p.tickets) {
      await remove(ref(db, `historial/${t.id}`));
    }

    // Registrar en auditoría
    const fechaAudit = new Date().toISOString().split('T')[0];
    const auditRef = ref(db, `auditoria/${fechaAudit}`);
    await push(auditRef, {
      ts: Date.now(),
      usuario: 'Desarrollador (Ajuste Trimestre)',
      accion: 'ajuste_facturacion_trimestre',
      detalle: `Ajuste aplicado: ${p.titulo}. Suprimidos ${p.tickets.length} tickets (-${p.sumaEliminada.toFixed(2)} €) en ${p.diasAfectadosCount} días.`
    });

    // Preparar informe de cierres afectados
    gestoriaUltimoInformeCierres = Object.values(diasAfectadosMap).map(d => ({
      fechaKey: d.fechaKey,
      ticketsBorrar: d.ticketsBorrar,
      montoBorrar: d.montoBorrar,
      nuevoTotal: Math.max(0, d.totalAnterior - d.montoBorrar)
    })).sort((a, b) => a.fechaKey.localeCompare(b.fechaKey));

    // Mostrar modal con informe de cierres
    mostrarModalCierresAfectados();

    // Recargar datos
    cargarGestoriaBajoDemanda();

  } catch (err) {
    console.error(err);
    showCustomAlert("Error", "Ocurrió un error al aplicar el ajuste de facturación.");
  }
}

function mostrarModalCierresAfectados() {
  const modal = document.getElementById("modal-cierres-afectados");
  const tbody = document.getElementById("tbody-cierres-afectados");
  if (!modal || !tbody) return;

  tbody.innerHTML = "";
  gestoriaUltimoInformeCierres.forEach(d => {
    let fTxt = d.fechaKey;
    if (d.fechaKey !== 'Desconocida') {
      const fObj = new Date(d.fechaKey + 'T12:00:00');
      fTxt = !isNaN(fObj.getTime())
        ? fObj.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
        : d.fechaKey;
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="font-weight:600;">${fTxt}</td>
      <td style="text-align: right; font-family: var(--font-code);">${d.ticketsBorrar}</td>
      <td style="text-align: right; font-family: var(--font-code); color: var(--danger); font-weight:600;">-${d.montoBorrar.toFixed(2)} €</td>
      <td class="table-price" style="text-align: right; color: var(--accent); font-weight:700;">${d.nuevoTotal.toFixed(2)} €</td>
    `;
    tbody.appendChild(tr);
  });

  modal.classList.add("open");
}

function cerrarModalCierresAfectados() {
  document.getElementById("modal-cierres-afectados").classList.remove("open");
}

function copiarInformeCierres() {
  if (!gestoriaUltimoInformeCierres.length) return;
  let txt = "INFORME DE CIERRES DE CAJA AFECTADOS:\n\n";
  gestoriaUltimoInformeCierres.forEach(d => {
    txt += `• Fecha: ${d.fechaKey} | Tickets eliminados: ${d.ticketsBorrar} | Reducción: -${d.montoBorrar.toFixed(2)}€ | Nuevo Total: ${d.nuevoTotal.toFixed(2)}€\n`;
  });
  navigator.clipboard.writeText(txt).then(() => {
    showCustomAlert("Copiado", "Informe copiado al portapapeles con éxito.");
  });
}

function formatFechaEsp(dateStr) {
  if (!dateStr) return '';
  const s = String(dateStr).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-');
    return `${d}/${m}/${y}`;
  }
  const dt = new Date(s);
  if (!isNaN(dt.getTime())) {
    return dt.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  return s;
}

async function exportarPDFGestoria() {
  if (!gestoriaTicketsList.length) {
    showCustomAlert("Exportar PDF", "No hay ventas en el período consultado para exportar.");
    return;
  }

  const incluirArticulos = await showCustomConfirm(
    "📄 Configuración del PDF Gestor",
    "¿Deseas incluir el desglose de Artículos vendidos en el PDF?\n\n• Aceptar: Informe Completo (+ Desglose de Artículos)\n• Cancelar: Solo Resumen de Días y Totales (Recomendado para el gestor)"
  );

  const incluirDocumentos = await showCustomConfirm(
    "Detalle fiscal",
    "¿Deseas incluir la relación de documentos fiscales?\n\n• Aceptar: añade el listado de tickets y facturas vinculadas\n• Cancelar: informe resumido (recomendado)"
  );

  await generarDocumentoPDFGestoria(incluirArticulos === true, incluirDocumentos === true);
}

async function generarDocumentoPDFGestoria(incluirArticulos = false, incluirDocumentos = false) {
  const desdeStr = document.getElementById("gestoria-desde").value;
  const hastaStr = document.getElementById("gestoria-hasta").value;
  const desdeFmt = formatFechaEsp(desdeStr);
  const hastaFmt = formatFechaEsp(hastaStr);

  const locNombre = localActivo?.nombre || localConfig?.datosNegocio?.nombre || "Establecimiento";
  const locCif = localConfig?.datosNegocio?.cif ? `CIF: ${localConfig.datosNegocio.cif}` : '';
  const locDir = localConfig?.datosNegocio?.direccion || '';
  const locTel = localConfig?.datosNegocio?.telefono ? `Tel: ${localConfig.datosNegocio.telefono}` : '';

  const totalGen = gestoriaTicketsList.reduce((s, t) => s + Number(t.total || 0), 0);
  const totalTickets = gestoriaTicketsList.length;
  const totalEf = gestoriaTicketsList.filter(t => (t.pagoMetodo || '').toLowerCase() !== 'tarjeta').reduce((s, t) => s + Number(t.total || 0), 0);
  const totalTj = gestoriaTicketsList.filter(t => (t.pagoMetodo || '').toLowerCase() === 'tarjeta').reduce((s, t) => s + Number(t.total || 0), 0);
  const totalArts = gestoriaTicketsList.reduce((s, t) => s + (t.lineas || []).reduce((acc, l) => acc + Number(l.qty || 0), 0), 0);
  const fmtUnidadesPDF = valor => {
    const redondeado = Math.round(Number(valor || 0) * 1000) / 1000;
    return Number.isInteger(redondeado) ? String(redondeado) : redondeado.toLocaleString('es-ES', { maximumFractionDigits: 3 });
  };

  const dias = agruparVentasPorDiaLocal(gestoriaTicketsList);

  let relacionDocumentosHTML = '';
  if (incluirDocumentos) {
    let operacionesConDocumento = [];
    try {
      const desdeTs = new Date(`${desdeStr}T00:00:00`).getTime();
      const hastaTs = new Date(`${hastaStr}T23:59:59.999`).getTime();
      ({ operaciones: operacionesConDocumento } = await cargarOperacionesFiscales(db, desdeTs, hastaTs));
    } catch (error) {
      console.warn('No se pudieron cargar las facturas vinculadas:', error);
    }
    relacionDocumentosHTML = `
      <h3 style="margin-top:20px;">${incluirArticulos ? '3. ' : '2. '}Relación de documentos fiscales</h3>
      <div style="font-size:11px;color:#4b5563;margin:-4px 0 10px">Las operaciones facturadas se muestran por su factura vinculada; no se duplican como ticket.</div>
      <table>
        <thead><tr><th>Fecha</th><th>Documento</th><th>Destinatario / Mesa</th><th class="text-right">Importe</th></tr></thead>
        <tbody>${operacionesConDocumento.map(({ ticket, factura }) => {
          const fecha = ticket.fecha || (ticket.ts ? new Date(ticket.ts).toLocaleDateString('es-ES') : '—');
          const documento = factura ? `Factura ${escapeHtml(factura.serie || '')}-${escapeHtml(factura.numero || '')}` : 'Ticket';
          const referencia = factura ? escapeHtml(factura.destinatario?.nombre || factura.tipo || '—') : escapeHtml(ticket.mesa || ticket.mesaNombre || '—');
          return `<tr><td>${escapeHtml(fecha)}</td><td>${documento}</td><td>${referencia}</td><td class="text-right mono">${Number(ticket.total || 0).toFixed(2)} €</td></tr>`;
        }).join('')}</tbody>
      </table>`;
  }

  let seccionArticulosHTML = '';
  if (incluirArticulos) {
    const mapaArts = {};
    gestoriaTicketsList.forEach(t => {
      (t.lineas || []).forEach(l => {
        const nombre = String(l.nombre || 'Sin nombre');
        if (!mapaArts[nombre]) mapaArts[nombre] = { nombre, qty: 0, total: 0 };
        mapaArts[nombre].qty += Number(l.qty || 0);
        mapaArts[nombre].total += Number(l.precio || 0) * Number(l.qty || 0);
      });
    });
    const rankingArts = Object.values(mapaArts).sort((a, b) => b.qty - a.qty);

    seccionArticulosHTML = `
      <h3 style="margin-top:20px;">2. Resumen de Artículos Vendidos</h3>
      <table>
        <thead>
          <tr>
            <th>Artículo</th>
            <th class="text-right">Unidades</th>
            <th class="text-right">Total Facturado</th>
          </tr>
        </thead>
        <tbody>
          ${rankingArts.slice(0, 45).map(a => `
            <tr>
              <td>${escapeHtml(a.nombre)}</td>
              <td class="text-right mono">${fmtUnidadesPDF(a.qty)}</td>
              <td class="text-right mono">${a.total.toFixed(2)} €</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr class="t-foot">
            <td>TOTAL ARTÍCULOS (${rankingArts.length})</td>
            <td class="text-right mono">${fmtUnidadesPDF(totalArts)}</td>
            <td class="text-right mono">${totalGen.toFixed(2)} €</td>
          </tr>
        </tfoot>
      </table>
    `;
  }

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Informe_Ventas_${desdeFmt.replace(/\//g,'-')}_al_${hastaFmt.replace(/\//g,'-')}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; }
    body { padding: 24px; color: #111827; background: #fff; line-height: 1.4; }
    .no-print { display: flex; gap: 10px; margin-bottom: 20px; }
    .btn-print { background: #2563eb; color: #fff; border: none; padding: 10px 18px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 14px; }
    .btn-close { background: #e5e7eb; color: #374151; border: none; padding: 10px 18px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 14px; }
    .header-box { border-bottom: 2px solid #111827; padding-bottom: 14px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start; }
    .local-title { font-size: 20px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.03em; }
    .local-info { font-size: 12px; color: #4b5563; margin-top: 3px; }
    .report-badge { text-align: right; }
    .report-title { font-size: 14px; font-weight: 700; color: #1f2937; text-transform: uppercase; }
    .report-dates { font-size: 12px; color: #4b5563; font-weight: 600; margin-top: 2px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
    .kpi-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; }
    .kpi-lbl { font-size: 10px; text-transform: uppercase; color: #6b7280; font-weight: 600; letter-spacing: 0.05em; }
    .kpi-val { font-size: 18px; font-weight: 800; color: #111827; margin-top: 4px; font-family: monospace; }
    .kpi-val.total { color: #059669; }
    h3 { font-size: 14px; font-weight: 700; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.04em; color: #1f2937; border-left: 4px solid #2563eb; padding-left: 8px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
    th { background: #f3f4f6; color: #374151; font-weight: 700; text-transform: uppercase; font-size: 10px; padding: 8px 10px; border-bottom: 1px solid #d1d5db; text-align: left; }
    td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; }
    .text-right { text-align: right; }
    .mono { font-family: monospace; font-size: 12px; }
    .t-foot td { background: #f9fafb; font-weight: 800; font-size: 13px; border-top: 2px solid #111827; border-bottom: 2px solid #111827; }
    .footer-doc { margin-top: 30px; font-size: 10px; color: #9ca3af; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 12px; }
    .factura-anexo { page-break-before: always; break-before: page; border: 1px solid #d1d5db; padding: 18px; margin-top: 24px; }
    .factura-titulo { font-size: 21px; font-weight: 800; }.factura-fecha { color:#4b5563; margin-top:4px; }.factura-dest { margin:18px 0; line-height:1.55; }.factura-total { text-align:right; font-size:18px; font-weight:800; margin-top:16px; }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
      @page { margin: 15mm; }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <button class="btn-print" onclick="window.print()">🖨️ Imprimir / Guardar como PDF</button>
    <button class="btn-close" onclick="window.close()">✕ Cerrar</button>
  </div>

  <div class="header-box">
    <div>
      <div class="local-title">${escapeHtml(locNombre)}</div>
      <div class="local-info">
        ${locCif ? `${escapeHtml(locCif)} · ` : ''}${escapeHtml(locDir)} ${locTel ? `· ${escapeHtml(locTel)}` : ''}
      </div>
    </div>
    <div class="report-badge">
      <div class="report-title">Informe Oficial de Ventas (Gestoría)</div>
      <div class="report-dates">Período: ${desdeFmt} al ${hastaFmt}</div>
    </div>
  </div>

  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-lbl">Total Facturación</div>
      <div class="kpi-val total">${totalGen.toFixed(2)} €</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-lbl">Cobro en Efectivo</div>
      <div class="kpi-val">${totalEf.toFixed(2)} €</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-lbl">Cobro en Tarjeta / Banco</div>
      <div class="kpi-val">${totalTj.toFixed(2)} €</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-lbl">Nº Operaciones</div>
      <div class="kpi-val">${totalTickets}</div>
    </div>
  </div>

  <h3>${incluirArticulos ? '1. ' : ''}Resumen Diario de Ventas</h3>
  <table>
    <thead>
      <tr>
        <th>Fecha</th>
        <th class="text-right">Nº Tickets</th>
        <th class="text-right">Uds Artículos</th>
        <th class="text-right">💵 Efectivo</th>
        <th class="text-right">💳 Tarjeta</th>
        <th class="text-right">Total Facturado</th>
      </tr>
    </thead>
    <tbody>
      ${dias.map(d => {
        let fTxt = d.fechaKey;
        if (d.fechaKey !== 'Desconocida') {
          const fObj = new Date(d.fechaKey + 'T12:00:00');
          fTxt = !isNaN(fObj.getTime())
            ? fObj.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
            : d.fechaKey;
        }
        return `
          <tr>
            <td>${fTxt}</td>
            <td class="text-right mono">${d.tickets}</td>
            <td class="text-right mono">${fmtUnidadesPDF(d.articulos)}</td>
            <td class="text-right mono">${d.efectivo.toFixed(2)} €</td>
            <td class="text-right mono">${d.tarjeta.toFixed(2)} €</td>
            <td class="text-right mono" style="font-weight:700;">${d.total.toFixed(2)} €</td>
          </tr>
        `;
      }).join('')}
    </tbody>
    <tfoot>
      <tr class="t-foot">
        <td>TOTAL PERÍODO</td>
        <td class="text-right mono">${totalTickets}</td>
        <td class="text-right mono">${fmtUnidadesPDF(totalArts)}</td>
        <td class="text-right mono">${totalEf.toFixed(2)} €</td>
        <td class="text-right mono">${totalTj.toFixed(2)} €</td>
        <td class="text-right mono">${totalGen.toFixed(2)} €</td>
      </tr>
    </tfoot>
  </table>

  ${seccionArticulosHTML}

  ${relacionDocumentosHTML}

  <div class="footer-doc">
    Documento generado para fines contables y de gestoría · Sistema Comandero TPVSync · ${new Date().toLocaleString('es-ES')}
  </div>
</body>
</html>`;

  const w = window.open('', '_blank');
  if (w) {
    w.document.open();
    w.document.write(html);
    w.document.close();
  }
}

function exportarCSVGestoria() {
  if (!gestoriaTicketsList.length) {
    showCustomAlert("Exportar CSV", "No hay ventas en el período consultado para exportar.");
    return;
  }

  const desdeStr = document.getElementById("gestoria-desde").value;
  const hastaStr = document.getElementById("gestoria-hasta").value;
  const dias = agruparVentasPorDiaLocal(gestoriaTicketsList);

  let csvContent = "Fecha;N_Tickets;Uds_Articulos;Efectivo_EUR;Tarjeta_EUR;Total_EUR\r\n";
  dias.forEach(d => {
    csvContent += `"${d.fechaKey}";${d.tickets};${d.articulos};"${d.efectivo.toFixed(2).replace('.', ',')}";"${d.tarjeta.toFixed(2).replace('.', ',')}";"${d.total.toFixed(2).replace('.', ',')}"\r\n`;
  });

  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `ventas_${desdeStr}_al_${hastaStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
