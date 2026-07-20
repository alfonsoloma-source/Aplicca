/**
 * Aplicca — Datos reales (Etapa 1)
 * ------------------------------------------------------------------
 * Conecta con Supabase: Publicar vacante, Buscar vacantes, Postularme,
 * Mis postulaciones, y el Kanban de candidatos (incluye arrastrar para
 * cambiar de etapa, y notas/etiquetas del reclutador).
 *
 * Todo lo demás del prototipo (mensajería, notificaciones, planes, etc.)
 * sigue siendo simulación visual — ver README-DEPLOY.md para el orden
 * de las siguientes etapas.
 * ------------------------------------------------------------------
 */
(function () {
  'use strict';

  var currentSelectedJobId = null;
  var currentKanbanJobId = null;

  function esc(str) {
    var div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function timeAgo(dateStr) {
    var diffMs = Date.now() - new Date(dateStr).getTime();
    var mins = Math.floor(diffMs / 60000);
    if (mins < 60) return 'Hace ' + Math.max(mins, 1) + ' min';
    var hours = Math.floor(mins / 60);
    if (hours < 24) return 'Hace ' + hours + ' h';
    var days = Math.floor(hours / 24);
    if (days < 30) return 'Hace ' + days + ' día' + (days === 1 ? '' : 's');
    return 'Hace ' + Math.floor(days / 30) + ' mes' + (Math.floor(days / 30) === 1 ? '' : 'es');
  }

  function formatSalary(min, max) {
    if (!min && !max) return 'Sueldo no mostrado por la empresa';
    var fmt = function (n) { return '$' + Number(n).toLocaleString('es-MX'); };
    if (min && max) return fmt(min) + ' - ' + fmt(max) + ' Mensual';
    return fmt(min || max) + ' Mensual';
  }

  /* ------------------------------------------------------------ *
   * Publicar vacante
   * ------------------------------------------------------------ */
  async function publishJob() {
    var client = window.supabaseClientRef;
    if (!client) return window.showToast('Supabase no está listo todavía');

    var title = (document.getElementById('job-title-input') || {}).value || '';
    if (!title.trim()) {
      window.showToast('Escribe el título del puesto');
      return;
    }

    var session = await client.auth.getSession();
    var userId = session.data.session && session.data.session.user.id;
    if (!userId) {
      window.showToast('Tu sesión expiró — inicia sesión de nuevo');
      window.goToLogin('empresa-perfil');
      return;
    }

    var payload = {
      company_id: userId,
      title: title.trim(),
      description: (document.getElementById('job-description-input') || {}).value || '',
      salary_min: parseFloat((document.getElementById('job-salary-min-input') || {}).value.replace(/[^\d.]/g, '')) || null,
      salary_max: parseFloat((document.getElementById('job-salary-max-input') || {}).value.replace(/[^\d.]/g, '')) || null,
      work_mode: (document.getElementById('job-mode-input') || {}).value || 'presencial',
      contract_type: (document.getElementById('job-contract-input') || {}).value || '',
      experience_level: (document.getElementById('job-experience-input') || {}).value || '',
      education_min: (document.getElementById('job-education-input') || {}).value || '',
      positions_count: parseInt((document.getElementById('job-positions-input') || {}).value, 10) || 1,
      status: 'activa'
    };

    window.showLoading('Publicando tu vacante...', 700, function () {});
    var result = await client.from('jobs').insert(payload);

    if (result.error) {
      window.showToast('No se pudo publicar: ' + result.error.message, 4000);
      return;
    }

    window.showToast('¡Vacante publicada!');
    window.showScreen('empresa-vacantes');
    loadMyJobs();
  }

  /* ------------------------------------------------------------ *
   * Mis vacantes (lado empresa)
   * ------------------------------------------------------------ */
  async function loadMyJobs() {
    var client = window.supabaseClientRef;
    var container = document.getElementById('my-jobs-list');
    if (!client || !container) return;

    var session = await client.auth.getSession();
    var userId = session.data.session && session.data.session.user.id;
    if (!userId) {
      container.innerHTML = '<p class="field-hint-select">Inicia sesión para ver tus vacantes.</p>';
      return;
    }

    var result = await client
      .from('jobs')
      .select('id, title, salary_min, salary_max, work_mode, status, published_at, applications(count)')
      .eq('company_id', userId)
      .order('published_at', { ascending: false });

    if (result.error) {
      container.innerHTML = '<p class="field-hint-select">No se pudieron cargar tus vacantes: ' + esc(result.error.message) + '</p>';
      return;
    }

    var jobs = result.data || [];
    var counts = { activa: 0, pausada: 0, cerrada: 0 };
    jobs.forEach(function (j) { if (counts[j.status] !== undefined) counts[j.status]++; });

    var elActive = document.getElementById('stat-jobs-active');
    var elPaused = document.getElementById('stat-jobs-paused');
    var elClosed = document.getElementById('stat-jobs-closed');
    if (elActive) elActive.textContent = counts.activa + ' Activas';
    if (elPaused) elPaused.textContent = counts.pausada + ' Pausadas';
    if (elClosed) elClosed.textContent = counts.cerrada + ' Cerradas';

    if (jobs.length === 0) {
      container.innerHTML =
        '<div class="empty-state show"><i class="ti ti-briefcase-off" aria-hidden="true"></i>' +
        '<p>Todavía no has publicado ninguna vacante.</p></div>';
      return;
    }

    var statusLabel = { activa: 'Activa', pausada: 'Pausada', cerrada: 'Cerrada' };

    container.innerHTML = jobs.map(function (job) {
      var appCount = (job.applications && job.applications[0] && job.applications[0].count) || 0;
      var badge = job.status === 'activa'
        ? '<span class="badge-rec">Activa</span>'
        : '<p class="posted">' + statusLabel[job.status] + '</p>';
      return (
        '<div class="job-card" style="max-width:100%" onclick="openJobKanban(\'' + job.id + '\', ' + JSON.stringify(job.title) + ')">' +
        badge +
        '<h4 style="padding-right:70px">' + esc(job.title) + '</h4>' +
        '<p class="salary">' + esc(formatSalary(job.salary_min, job.salary_max)) + '</p>' +
        '<p class="loc">' + esc(job.work_mode || '') + ' · ' + appCount + ' candidato' + (appCount === 1 ? '' : 's') + '</p>' +
        '</div>'
      );
    }).join('');
  }

  function openJobKanban(jobId, jobTitle) {
    currentKanbanJobId = jobId;
    window.showScreen('empresa-candidatos');
    var titleEl = document.getElementById('kanban-job-title');
    if (titleEl) titleEl.textContent = jobTitle;
    loadKanban(jobId);
  }

  /* ------------------------------------------------------------ *
   * Buscar vacantes (lado candidato)
   * ------------------------------------------------------------ */
  async function loadJobsSearch() {
    var client = window.supabaseClientRef;
    var container = document.getElementById('jobs-search-list');
    if (!client || !container) return;

    var result = await client
      .from('jobs')
      .select('id, title, salary_min, salary_max, work_mode, published_at, company_profiles(company_name, domain_verified)')
      .eq('status', 'activa')
      .order('published_at', { ascending: false })
      .limit(30);

    if (result.error) {
      container.innerHTML = '<p class="field-hint-select">No se pudieron cargar las vacantes: ' + esc(result.error.message) + '</p>';
      return;
    }

    var jobs = result.data || [];
    var countEl = document.getElementById('jobs-results-count');
    if (countEl) countEl.textContent = jobs.length + ' resultado' + (jobs.length === 1 ? '' : 's');

    if (jobs.length === 0) {
      container.innerHTML =
        '<div class="empty-state show"><i class="ti ti-search-off" aria-hidden="true"></i>' +
        '<p>Todavía no hay vacantes publicadas. ¡Vuelve pronto!</p></div>';
      return;
    }

    container.innerHTML = jobs.map(function (job, i) {
      var company = job.company_profiles ? job.company_profiles.company_name : 'Empresa confidencial';
      var verified = job.company_profiles && job.company_profiles.domain_verified;
      return (
        '<div class="job-card' + (i === 0 ? ' selected' : '') + '" data-job-id="' + job.id + '" onclick="selectJobDetail(\'' + job.id + '\')">' +
        '<p class="posted">' + timeAgo(job.published_at) + '</p>' +
        '<h4>' + esc(job.title) + '</h4>' +
        '<p class="salary">' + esc(formatSalary(job.salary_min, job.salary_max)) + '</p>' +
        '<p class="empresa">' + esc(company) + (verified ? ' <i class="ti ti-shield-check" aria-hidden="true"></i>' : '') + '</p>' +
        '<p class="loc">' + esc(job.work_mode || '') + '</p>' +
        '</div>'
      );
    }).join('');

    // Muestra el detalle del primer resultado automáticamente.
    if (jobs[0]) selectJobDetail(jobs[0].id, jobs);
  }

  var lastLoadedJobs = [];

  async function selectJobDetail(jobId) {
    currentSelectedJobId = jobId;
    document.querySelectorAll('#jobs-search-list .job-card').forEach(function (card) {
      card.classList.toggle('selected', card.dataset.jobId === jobId);
    });

    var client = window.supabaseClientRef;
    if (!client) return;

    var result = await client
      .from('jobs')
      .select('id, title, salary_min, salary_max, work_mode, company_profiles(company_name, domain_verified)')
      .eq('id', jobId)
      .single();

    if (result.error || !result.data) return;
    var job = result.data;
    var company = job.company_profiles ? job.company_profiles.company_name : 'Empresa confidencial';

    var titleEl = document.getElementById('detail-job-title');
    var salaryEl = document.getElementById('detail-job-salary');
    var empresaEl = document.getElementById('detail-job-empresa');
    if (titleEl) titleEl.textContent = job.title;
    if (salaryEl) salaryEl.textContent = formatSalary(job.salary_min, job.salary_max);
    if (empresaEl) empresaEl.textContent = company + ' · ' + (job.work_mode || '');
  }

  /* ------------------------------------------------------------ *
   * Postularme
   * ------------------------------------------------------------ */
  async function applyToJob() {
    var client = window.supabaseClientRef;
    if (!client) return window.showToast('Supabase no está listo todavía');
    if (!currentSelectedJobId) {
      window.showToast('Elige una vacante de la lista primero');
      return;
    }

    var session = await client.auth.getSession();
    var userId = session.data.session && session.data.session.user.id;
    if (!userId) {
      window.showToast('Inicia sesión para poder postularte');
      window.goToLogin('candidato-dashboard');
      return;
    }

    window.showLoading('Enviando tu postulación...', 800, function () {});

    var result = await client.from('applications').insert({
      job_id: currentSelectedJobId,
      candidate_id: userId,
      source: 'plataforma'
    });

    if (result.error) {
      if (result.error.code === '23505') {
        window.showToast('Ya te habías postulado a esta vacante');
      } else {
        window.showToast('No se pudo enviar tu postulación: ' + result.error.message, 4000);
      }
      return;
    }

    window.showScreen('postulado');
  }

  /* ------------------------------------------------------------ *
   * Mis postulaciones (lado candidato)
   * ------------------------------------------------------------ */
  var STATUS_LABEL = {
    nuevo: 'Nuevo', revisado: 'Vista', entrevista: 'Entrevista',
    oferta: 'Oferta', rechazado: 'Rechazada', contratado: 'Contratado'
  };
  var STATUS_CLASS = {
    nuevo: 'status-nuevo', revisado: 'status-revisado', entrevista: 'status-entrevista',
    oferta: 'status-entrevista', rechazado: '', contratado: 'status-entrevista'
  };

  async function loadMyApplications() {
    var client = window.supabaseClientRef;
    var container = document.getElementById('my-applications-list');
    if (!client || !container) return;

    var session = await client.auth.getSession();
    var userId = session.data.session && session.data.session.user.id;
    if (!userId) {
      container.innerHTML = '<p class="field-hint-select">Inicia sesión para ver tus postulaciones.</p>';
      return;
    }

    var result = await client
      .from('applications')
      .select('id, status, source, applied_at, jobs(title, company_profiles(company_name))')
      .eq('candidate_id', userId)
      .order('applied_at', { ascending: false });

    if (result.error) {
      container.innerHTML = '<p class="field-hint-select">No se pudieron cargar tus postulaciones: ' + esc(result.error.message) + '</p>';
      return;
    }

    var apps = result.data || [];
    if (apps.length === 0) {
      container.innerHTML =
        '<div class="empty-state show"><i class="ti ti-send-off" aria-hidden="true"></i>' +
        '<p>Todavía no te has postulado a ninguna vacante.</p></div>';
      return;
    }

    container.innerHTML = apps.map(function (app) {
      var jobTitle = app.jobs ? app.jobs.title : 'Vacante';
      var company = app.jobs && app.jobs.company_profiles ? app.jobs.company_profiles.company_name : 'Empresa';
      var sourceIcon = app.source === 'whatsapp'
        ? '<i class="ti ti-brand-whatsapp" aria-hidden="true"></i> aplicaste por WhatsApp'
        : 'aplicaste desde la plataforma';
      var pillClass = STATUS_CLASS[app.status] || '';
      var pillStyle = app.status === 'rechazado' ? ' style="background:#fde4e4;color:#b3261e"' : '';
      return (
        '<div class="candidate-card">' +
        '<div><p style="margin:0;font-size:13.5px;font-weight:600">' + esc(jobTitle) + '</p>' +
        '<p style="margin:2px 0 0;font-size:11.5px;color:#9a9a9a">' + esc(company) + ' · ' + sourceIcon + '</p></div>' +
        '<span class="status-pill ' + pillClass + '"' + pillStyle + '>' + (STATUS_LABEL[app.status] || app.status) + '</span>' +
        '</div>'
      );
    }).join('');
  }

  /* ------------------------------------------------------------ *
   * Kanban de candidatos (lado empresa)
   * ------------------------------------------------------------ */
  function initials(name) {
    if (!name) return '??';
    var parts = name.trim().split(/\s+/);
    return ((parts[0] || '')[0] || '') + ((parts[1] || '')[0] || '');
  }

  async function loadKanban(jobId) {
    var client = window.supabaseClientRef;
    if (!client || !jobId) return;
    currentKanbanJobId = jobId;

    var result = await client
      .from('applications')
      .select('id, status, source, applied_at, notes, candidate_profiles(full_name, desired_position)')
      .eq('job_id', jobId)
      .order('applied_at', { ascending: false });

    ['nuevo', 'revisado', 'entrevista', 'oferta', 'rechazado'].forEach(function (stage) {
      var zone = document.getElementById('kanban-dropzone-' + stage);
      if (zone) zone.innerHTML = '';
    });

    if (result.error) {
      window.showToast('No se pudieron cargar los candidatos: ' + result.error.message, 4000);
      return;
    }

    var apps = result.data || [];
    var subtitleEl = document.getElementById('kanban-job-subtitle');
    var whatsappCount = apps.filter(function (a) { return a.source === 'whatsapp'; }).length;
    if (subtitleEl) {
      subtitleEl.textContent = apps.length + ' candidato' + (apps.length === 1 ? '' : 's') +
        ' · ' + whatsappCount + ' llegaron por WhatsApp';
    }

    apps.forEach(function (app) {
      var stage = app.status || 'nuevo';
      var zone = document.getElementById('kanban-dropzone-' + stage);
      if (!zone) return;

      var name = app.candidate_profiles ? app.candidate_profiles.full_name : 'Candidato';
      var position = app.candidate_profiles ? app.candidate_profiles.desired_position : '';
      var sourceHtml = app.source === 'whatsapp'
        ? '<i class="ti ti-brand-whatsapp" aria-hidden="true"></i> WhatsApp · ' + timeAgo(app.applied_at)
        : '<i class="ti ti-world" aria-hidden="true"></i> Plataforma · ' + timeAgo(app.applied_at);
      var noteHtml = app.notes
        ? '<div class="kanban-source" style="color:var(--color-ink)"><i class="ti ti-note" aria-hidden="true"></i> ' + esc(app.notes) + '</div>'
        : '';

      var card = document.createElement('div');
      card.className = 'kanban-card';
      card.id = 'app-' + app.id;
      card.draggable = true;
      card.dataset.applicationId = app.id;
      card.setAttribute('ondragstart', 'dragStart(event)');
      card.setAttribute('ondragend', 'dragEnd(event)');
      card.innerHTML =
        '<div class="kanban-card-top"><div class="candidate-avatar">' + esc(initials(name)) + '</div><b>' + esc(name || 'Candidato') + '</b></div>' +
        '<div class="kanban-source">' + sourceHtml + '</div>' +
        (position ? '<div class="kanban-tags"><span class="kanban-tag">' + esc(position) + '</span></div>' : '') +
        noteHtml +
        '<div class="kanban-card-actions">' +
        '<button class="kanban-icon-btn" onclick="event.stopPropagation();promptApplicationNote(\'' + app.id + '\')" aria-label="Agregar nota"><i class="ti ti-note" aria-hidden="true"></i></button>' +
        '<button class="kanban-icon-btn" onclick="event.stopPropagation();showScreen(\'chat-empresa\')" aria-label="Enviar mensaje al candidato"><i class="ti ti-message-circle" aria-hidden="true"></i></button>' +
        '</div>';
      zone.appendChild(card);
    });

    window.updateKanbanTotals && window.updateKanbanTotals();
  }

  /** Se llama desde app.js cuando el usuario suelta una tarjeta en otra columna. */
  async function onKanbanCardMoved(applicationId, newStage) {
    var client = window.supabaseClientRef;
    if (!client || !applicationId) return;

    var result = await client
      .from('applications')
      .update({ status: newStage })
      .eq('id', applicationId);

    if (result.error) {
      window.showToast('No se pudo guardar el cambio: ' + result.error.message, 4000);
      return;
    }
    window.showToast('Etapa actualizada');
  }

  /** Nota rápida del reclutador sobre un candidato (se guarda en la tarjeta). */
  async function promptApplicationNote(applicationId) {
    var client = window.supabaseClientRef;
    if (!client) return;
    var note = window.prompt('Nota sobre este candidato:');
    if (note === null) return;

    var result = await client.from('applications').update({ notes: note }).eq('id', applicationId);
    if (result.error) {
      window.showToast('No se pudo guardar la nota: ' + result.error.message, 3500);
      return;
    }
    window.showToast('Nota guardada');
    if (currentKanbanJobId) loadKanban(currentKanbanJobId);
  }

  window.publishJob = publishJob;
  window.loadMyJobs = loadMyJobs;
  window.openJobKanban = openJobKanban;
  window.loadJobsSearch = loadJobsSearch;
  window.selectJobDetail = selectJobDetail;
  window.applyToJob = applyToJob;
  window.loadMyApplications = loadMyApplications;
  window.loadKanban = loadKanban;
  window.onKanbanCardMoved = onKanbanCardMoved;
  window.promptApplicationNote = promptApplicationNote;
})();
