/**
 * Aplicca — Prototipo interactivo
 * ------------------------------------------------------------------
 * Organización:
 *   1. Navegación entre pantallas (router simple basado en clases)
 *   2. Encabezado con scroll (invierte tonos)
 *   3. Overlay de carga reutilizable
 *   4. Contraseña: mostrar / ocultar
 *   5. Menú de cuenta (hamburguesa)
 *   6. FAQ: acordeón
 *   7. Kanban de candidatos: drag & drop + totales
 *   8. Revelado de secciones al hacer scroll (IntersectionObserver)
 *   9. Inicialización
 *
 * Nota: las funciones que el HTML invoca vía `onclick="..."` deben
 * exponerse explícitamente en `window` (ver bloque de exportación al
 * final). Todo lo demás permanece privado al módulo.
 * ------------------------------------------------------------------
 */
(function () {
  'use strict';

  /* ------------------------------------------------------------ *
   * 1. Navegación entre pantallas
   * ------------------------------------------------------------ */
  var loginRedirectTarget = 'candidato-dashboard';

  /** Recuerda a dónde debe ir el login (candidato o empresa) antes de mostrarlo. */
  function goToLogin(target) {
    loginRedirectTarget = target || 'candidato-dashboard';
    var badge = document.getElementById('login-mode-badge');
    if (badge) badge.style.display = loginRedirectTarget === 'empresa-perfil' ? 'inline-flex' : 'none';
    showScreen('login');
  }

  /** Usa el destino recordado por goToLogin al completar el inicio de sesión. */
  function afterLogin() {
    showScreen(loginRedirectTarget);
  }

  var SHARED_AUTH_SCREENS = [
    'login', 'forgot', 'sent', 'register', 'verify', 'crearcv',
    'manual-personal', 'manual-educacion', 'manual-experiencia', 'manual-intereses', 'subircv'
  ];

  function showScreen(name) {
    document.querySelectorAll('.screen').forEach(function (screen) {
      screen.classList.remove('active');
    });
    var target = document.getElementById('screen-' + name);
    if (!target) {
      console.warn('[Aplicca] Pantalla no encontrada: screen-' + name);
      target = document.getElementById('screen-404');
      if (!target) return;
    }
    target.classList.add('active');
    window.scrollTo(0, 0);

    // El contenedor compartido de login/registro no usa display:none/block
    // por pantalla individual, así que su visibilidad se controla aquí
    // explícitamente (evitamos depender del selector CSS :has(), que no
    // todos los navegadores soportan).
    var sharedAuthWrap = document.getElementById('shared-auth-wrap');
    if (sharedAuthWrap) {
      sharedAuthWrap.classList.toggle('show', SHARED_AUTH_SCREENS.indexOf(name) !== -1);
    }

    var header = document.querySelector('.home-header');
    if (header) header.classList.remove('scrolled');
  }

  /** Resuelve una tarjeta (moderación, verificación, etc.): la desvanece y confirma con un toast. */
  function resolveCard(btn, message) {
    var card = btn.closest('.mod-card');
    showToast(message);
    if (card) {
      card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      card.style.opacity = '0';
      card.style.transform = 'translateX(12px)';
      window.setTimeout(function () {
        card.style.display = 'none';
      }, 300);
    }
  }

  function scrollToId(id) {
    var el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ------------------------------------------------------------ *
   * 2. Encabezado con scroll (invierte tonos al bajar la página)
   * ------------------------------------------------------------ */
  var SCROLL_INVERT_THRESHOLD = 40;

  function initStickyHeader() {
    window.addEventListener('scroll', function () {
      var header = document.querySelector('.home-header');
      if (header) header.classList.toggle('scrolled', window.scrollY > SCROLL_INVERT_THRESHOLD);
    });
  }

  /* ------------------------------------------------------------ *
   * 2b. Palabra rotativa de puestos (hero)
   * ------------------------------------------------------------ */
  var JOB_TITLES = [
    'Diseñador Gráfico', 'Desarrollador Web', 'Contador Público', 'Ejecutivo de Ventas',
    'Enfermero', 'Chef', 'Mesero', 'Recepcionista', 'Analista de Datos', 'Gerente de Marketing',
    'Abogado', 'Arquitecto', 'Ingeniero Civil', 'Electricista', 'Plomero', 'Chofer',
    'Repartidor', 'Community Manager', 'Diseñador UX/UI', 'Product Manager',
    'Especialista en RRHH', 'Reclutador', 'Coordinador de Eventos', 'Asistente Administrativo',
    'Cajero', 'Auxiliar Contable', 'Psicólogo', 'Nutriólogo', 'Fisioterapeuta',
    'Maestro de Primaria', 'Profesor Universitario', 'Ingeniero Industrial', 'Ingeniero Mecánico',
    'Ingeniero en Sistemas', 'Programador Backend', 'Programador Frontend', 'DevOps Engineer',
    'Data Scientist', 'Especialista en SEO', 'Diseñador Industrial', 'Vendedor de Piso',
    'Supervisor de Producción', 'Operador de Maquinaria', 'Almacenista', 'Auxiliar de Logística',
    'Analista de Compras', 'Analista Financiero', 'Auditor', 'Fotógrafo', 'Editor de Video',
    'Barista', 'Cocinero', 'Panadero', 'Estilista', 'Manicurista', 'Entrenador Personal',
    'Guardia de Seguridad', 'Recamarista', 'Ama de Llaves', 'Jardinero', 'Veterinario',
    'Asistente Veterinario', 'Farmacéutico', 'Técnico de Laboratorio', 'Radiólogo', 'Paramédico',
    'Piloto', 'Sobrecargo', 'Agente de Viajes', 'Traductor', 'Intérprete', 'Redactor',
    'Copywriter', 'Guionista', 'Músico', 'Diseñador de Moda', 'Sastre', 'Ilustrador',
    'Animador 3D', 'Desarrollador de Videojuegos', 'Especialista en Ciberseguridad',
    'Administrador de Redes', 'Soporte Técnico', 'Técnico en Refrigeración', 'Soldador',
    'Carpintero', 'Pintor', 'Albañil', 'Topógrafo', 'Geólogo', 'Biólogo', 'Químico',
    'Ingeniero Ambiental', 'Agrónomo', 'Zootecnista', 'Agente Inmobiliario', 'Agente de Seguros',
    'Cajero Bancario', 'Ejecutivo de Cuenta', 'Gerente de Sucursal', 'Supervisor de Call Center',
    'Teleoperador', 'Analista de Riesgos', 'Especialista en Logística'
  ];
  var jobTitleIndex = 0;
  var JOB_TITLE_INTERVAL_MS = 2400;

  function cycleJobTitle() {
    var el = document.getElementById('cycling-job');
    if (!el) return;
    el.classList.add('is-cycling');
    window.setTimeout(function () {
      jobTitleIndex = (jobTitleIndex + 1) % JOB_TITLES.length;
      el.textContent = JOB_TITLES[jobTitleIndex];
      el.classList.remove('is-cycling');
    }, 300);
  }

  function initJobTitleCycle() {
    window.setInterval(cycleJobTitle, JOB_TITLE_INTERVAL_MS);
  }

  /* ------------------------------------------------------------ *
   * 10. Editor de plantillas de mensajes
   * ------------------------------------------------------------ */
  var TEMPLATE_SAMPLE_VALUES = {
    '{{nombre_candidato}}': 'Ana López',
    '{{puesto}}': 'Coordinador de Eventos',
    '{{nombre_empresa}}': 'Empresa TechX',
    '{{fecha_entrevista}}': 'jueves 16 de julio, 11:00 AM'
  };

  function insertTemplateVar(variable) {
    var textarea = document.getElementById('template-body');
    if (!textarea) return;
    var pos = textarea.selectionStart || textarea.value.length;
    var before = textarea.value.slice(0, pos);
    var after = textarea.value.slice(pos);
    textarea.value = before + variable + after;
    textarea.focus();
    updateTemplatePreview();
  }

  function updateTemplatePreview() {
    var textarea = document.getElementById('template-body');
    var preview = document.getElementById('template-live-preview');
    if (!textarea || !preview) return;
    var rendered = textarea.value;
    Object.keys(TEMPLATE_SAMPLE_VALUES).forEach(function (key) {
      rendered = rendered.split(key).join(TEMPLATE_SAMPLE_VALUES[key]);
    });
    preview.textContent = rendered;
  }

  /* ------------------------------------------------------------ *
   * 11. Reportes: selección de tipo y formato
   * ------------------------------------------------------------ */
  function selectReportType(card) {
    document.querySelectorAll('.report-type-card').forEach(function (c) {
      c.classList.remove('selected');
    });
    card.classList.add('selected');
  }

  function selectFormat(chip) {
    var scope = chip.closest('.format-chip-row') || document;
    scope.querySelectorAll('.format-chip').forEach(function (c) {
      c.classList.remove('selected');
    });
    chip.classList.add('selected');
  }

  /* ------------------------------------------------------------ *
   * 12. Gestión de usuarios: búsqueda y filtro en vivo
   * ------------------------------------------------------------ */
  var currentUserFilter = 'todos';

  function setUserFilter(btn, filter) {
    currentUserFilter = filter;
    document.querySelectorAll('#screen-gestion-usuarios .filter-chip').forEach(function (c) {
      c.style.background = '';
      c.style.color = '';
    });
    btn.style.background = 'var(--color-ink)';
    btn.style.color = 'var(--color-surface)';
    filterUsers();
  }

  function filterUsers() {
    var query = (document.getElementById('user-search') || {}).value || '';
    query = query.trim().toLowerCase();
    var rows = document.querySelectorAll('#screen-gestion-usuarios .user-row');
    var visibleCount = 0;

    rows.forEach(function (row) {
      var name = row.querySelector('.user-cell-name').textContent.toLowerCase();
      var matchesQuery = name.indexOf(query) !== -1;
      var matchesFilter =
        currentUserFilter === 'todos' ||
        row.dataset.type === currentUserFilter ||
        row.dataset.status === currentUserFilter;

      var visible = matchesQuery && matchesFilter;
      row.classList.toggle('hidden-row', !visible);
      if (visible) visibleCount++;
    });

    var emptyState = document.getElementById('users-empty-state');
    if (emptyState) emptyState.classList.toggle('show', visibleCount === 0);
  }

  /* ------------------------------------------------------------ *
   * 13. Mi perfil: secciones opcionales expandibles
   * ------------------------------------------------------------ */
  function toggleMoreSections() {
    var panel = document.getElementById('more-sections-panel');
    var icon = document.getElementById('more-sections-icon');
    if (!panel) return;
    var isOpen = panel.style.display !== 'none';
    panel.style.display = isOpen ? 'none' : 'block';
    if (icon) icon.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
  }

  /* ------------------------------------------------------------ *
   * 14. Sugerencias de dominio al escribir un correo
   * ------------------------------------------------------------ */
  var COMMON_EMAIL_DOMAINS = [
    'gmail.com', 'outlook.com', 'outlook.es', 'hotmail.com', 'hotmail.es',
    'yahoo.com', 'yahoo.es', 'icloud.com', 'live.com', 'protonmail.com'
  ];

  function initEmailAutocomplete(inputId) {
    var input = document.getElementById(inputId);
    if (!input || input.dataset.autocompleteReady) return;
    input.dataset.autocompleteReady = 'true';

    var wrap = document.createElement('div');
    wrap.className = 'email-suggest-wrap';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);

    var list = document.createElement('div');
    list.className = 'email-suggest-list';
    wrap.appendChild(list);

    function renderMatches() {
      var value = input.value;
      var atIndex = value.indexOf('@');
      if (atIndex === -1) {
        list.classList.remove('show');
        return;
      }
      var localPart = value.slice(0, atIndex);
      var domainFragment = value.slice(atIndex + 1).toLowerCase();
      var matches = COMMON_EMAIL_DOMAINS.filter(function (domain) {
        return domain.indexOf(domainFragment) === 0 && domain !== domainFragment;
      });
      if (!localPart || matches.length === 0) {
        list.classList.remove('show');
        return;
      }
      list.innerHTML = '';
      matches.forEach(function (domain) {
        var item = document.createElement('div');
        item.className = 'email-suggest-item';
        item.textContent = localPart + '@' + domain;
        item.addEventListener('click', function () {
          input.value = localPart + '@' + domain;
          list.classList.remove('show');
          input.focus();
        });
        list.appendChild(item);
      });
      list.classList.add('show');
    }

    input.addEventListener('input', renderMatches);
    input.addEventListener('focus', renderMatches);
    document.addEventListener('click', function (e) {
      if (!wrap.contains(e.target)) list.classList.remove('show');
    });
  }

  function initAllEmailAutocompletes() {
    ['login-email-input', 'register-email-input', 'empresa-email-input', 'forgot-email-input']
      .forEach(initEmailAutocomplete);
  }

  /* ------------------------------------------------------------ *
   * 3. Overlay de carga reutilizable
   * ------------------------------------------------------------ */
  function showLoading(text, durationMs, onComplete) {
    var overlay = document.getElementById('loading-overlay');
    var label = document.getElementById('loading-text');
    if (!overlay || !label) return onComplete && onComplete();

    label.textContent = text;
    overlay.classList.add('show');

    window.setTimeout(function () {
      overlay.classList.remove('show');
      if (typeof onComplete === 'function') onComplete();
    }, durationMs);
  }

  function confirmCV() {
    showLoading('Guardando tu CV...', 1800, function () {
      showScreen('bienvenida');
    });
  }

  var TOAST_DEFAULT_MS = 2200;

  /** Muestra una confirmación breve tipo "listo" sin cambiar de pantalla. */
  function showToast(message, durationMs) {
    var toast = document.getElementById('cv-toast');
    var label = document.getElementById('cv-toast-text');
    if (!toast || !label) return;

    label.textContent = message;
    toast.classList.add('show');

    window.setTimeout(function () {
      toast.classList.remove('show');
    }, durationMs || TOAST_DEFAULT_MS);
  }

  /* ------------------------------------------------------------ *
   * 4. Contraseña: mostrar / ocultar
   * ------------------------------------------------------------ */
  var EYE_OPEN_SVG =
    '<svg class="eye-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';

  var EYE_CLOSED_SVG =
    '<svg class="eye-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M2 12c3 3.5 7 5.5 10 5.5s7-2 10-5.5"/></svg>';

  function togglePassword(inputId, triggerBtn) {
    var input = document.getElementById(inputId);
    if (!input) return;
    var willShow = input.type === 'password';
    input.type = willShow ? 'text' : 'password';
    triggerBtn.innerHTML = willShow ? EYE_CLOSED_SVG : EYE_OPEN_SVG;
  }

  /* ------------------------------------------------------------ *
   * 5. Menú de cuenta (hamburguesa)
   * ------------------------------------------------------------ */
  function toggleAccountMenu(event) {
    event.stopPropagation();
    var menu = event.currentTarget.nextElementSibling;
    var wasOpen = menu.classList.contains('show');
    closeAllAccountMenus();
    if (!wasOpen) menu.classList.add('show');
  }

  function closeAllAccountMenus() {
    document.querySelectorAll('.account-menu.show').forEach(function (menu) {
      menu.classList.remove('show');
    });
  }

  function initAccountMenu() {
    // Cierra cualquier menú abierto al hacer clic fuera de él.
    document.addEventListener('click', closeAllAccountMenus);
  }

  /* ------------------------------------------------------------ *
   * 6. FAQ: acordeón (una sola pregunta abierta a la vez)
   * ------------------------------------------------------------ */
  function toggleFaq(block) {
    var wasOpen = block.classList.contains('open');

    document.querySelectorAll('.faq-block.open').forEach(function (b) {
      b.classList.remove('open');
    });
    document.querySelectorAll('.faq-item.open').forEach(function (item) {
      item.classList.remove('open');
    });

    if (!wasOpen) {
      block.classList.add('open');
      block.querySelector('.faq-item').classList.add('open');
    }
  }

  /* ------------------------------------------------------------ *
   * 7. Kanban de candidatos: drag & drop + totales en vivo
   * ------------------------------------------------------------ */
  var KANBAN_STAGES = ['nuevo', 'revisado', 'entrevista', 'oferta', 'rechazado'];

  function allowDrop(event) {
    event.preventDefault();
    event.currentTarget.classList.add('dragover');
  }

  function dragStart(event) {
    event.dataTransfer.setData('text/plain', event.target.id);
    event.target.classList.add('dragging');
  }

  function dragEnd(event) {
    event.target.classList.remove('dragging');
    document.querySelectorAll('.kanban-dropzone').forEach(function (zone) {
      zone.classList.remove('dragover');
    });
  }

  function dropCard(event) {
    event.preventDefault();
    var cardId = event.dataTransfer.getData('text/plain');
    var card = document.getElementById(cardId);
    var dropzone = event.currentTarget;

    dropzone.classList.remove('dragover');
    if (card) dropzone.appendChild(card);
    updateKanbanTotals();
  }

  /** Recalcula conteos por etapa a partir del DOM y actualiza KPIs + barra. */
  function updateKanbanTotals() {
    var total = 0;

    KANBAN_STAGES.forEach(function (stage) {
      var column = document.querySelector('.kanban-col[data-stage="' + stage + '"]');
      if (!column) return;

      var count = column.querySelectorAll('.kanban-card').length;
      total += count;

      setText(column.querySelector('.kanban-count'), count);
      setText(document.getElementById('kpi-' + stage), count);

      var barSegment = document.querySelector('.stage-bar-segment[data-stage="' + stage + '"]');
      if (barSegment) {
        barSegment.style.flexGrow = Math.max(count, 0.001);
        barSegment.textContent = count;
      }
    });

    setText(document.getElementById('kpi-all'), total);
  }

  function setText(el, value) {
    if (el) el.textContent = value;
  }

  /** Filtra/resalta el tablero por etapa al hacer clic en un KPI o en la barra. */
  function filterStage(stage, kpiEl) {
    document.querySelectorAll('.kpi-card').forEach(function (card) {
      card.classList.remove('active');
    });

    var activeCard = kpiEl || document.querySelector('.kpi-card[data-stage="' + stage + '"]');
    if (activeCard) activeCard.classList.add('active');

    document.querySelectorAll('.stage-bar-segment').forEach(function (segment) {
      var isOtherStage = stage !== 'all' && segment.dataset.stage !== stage;
      segment.classList.toggle('dimmed', isOtherStage);
    });

    document.querySelectorAll('.kanban-col').forEach(function (column) {
      var isTargetStage = stage !== 'all' && column.dataset.stage === stage;
      column.classList.toggle('highlight', isTargetStage);
    });

    if (stage !== 'all') {
      var targetColumn = document.querySelector('.kanban-col[data-stage="' + stage + '"]');
      if (targetColumn) {
        targetColumn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }

  /* ------------------------------------------------------------ *
   * 8. Revelado de secciones al hacer scroll
   * ------------------------------------------------------------ */
  function initScrollReveal() {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );

    document.querySelectorAll('.reveal').forEach(function (el) {
      observer.observe(el);
    });
  }

  /* ------------------------------------------------------------ *
   * 9. Inicialización
   * ------------------------------------------------------------ */
  function init() {
    initStickyHeader();
    initAccountMenu();
    initScrollReveal();
    initJobTitleCycle();
    initAllEmailAutocompletes();
  }

  document.addEventListener('DOMContentLoaded', init);

  /* ------------------------------------------------------------ *
   * Exportación: únicas funciones que el HTML llama vía onclick
   * ------------------------------------------------------------ */
  window.showScreen = showScreen;
  window.goToLogin = goToLogin;
  window.afterLogin = afterLogin;
  window.scrollToId = scrollToId;
  window.showLoading = showLoading;
  window.showToast = showToast;
  window.resolveCard = resolveCard;
  window.confirmCV = confirmCV;
  window.togglePassword = togglePassword;
  window.toggleAccountMenu = toggleAccountMenu;
  window.toggleFaq = toggleFaq;
  window.allowDrop = allowDrop;
  window.dragStart = dragStart;
  window.dragEnd = dragEnd;
  window.dropCard = dropCard;
  window.filterStage = filterStage;
  window.insertTemplateVar = insertTemplateVar;
  window.updateTemplatePreview = updateTemplatePreview;
  window.selectReportType = selectReportType;
  window.selectFormat = selectFormat;
  window.setUserFilter = setUserFilter;
  window.filterUsers = filterUsers;
  window.toggleMoreSections = toggleMoreSections;
})();
