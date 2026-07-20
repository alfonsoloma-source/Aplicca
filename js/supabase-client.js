/**
 * Aplicca — Integración con Supabase
 * ------------------------------------------------------------------
 * Requiere que llenes SUPABASE_URL y SUPABASE_ANON_KEY abajo con los
 * datos de tu propio proyecto (Supabase → Project Settings → API).
 *
 * Este archivo conecta con backend real SOLO el registro, login y
 * logout de candidato y empresa. El resto del prototipo (buscar
 * vacantes, kanban, mensajes, etc.) sigue siendo una simulación
 * visual — ver README-DEPLOY.md para el plan de qué conectar después.
 * ------------------------------------------------------------------
 */
(function () {
  'use strict';

  // ⚠️ Reemplaza esto con los datos de TU proyecto de Supabase
  var SUPABASE_URL = 'https://uoevaidoxgxrzliyqxml.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_YcmKLwsdTsTdcxYoV92R4w_hUJK2Way';

  if (SUPABASE_URL.indexOf('TU-PROYECTO') !== -1) {
    console.warn(
      '[Aplicca] Falta configurar Supabase: edita js/supabase-client.js ' +
      'con la URL y la anon key de tu proyecto. Mientras tanto, login/registro no funcionarán.'
    );
  }

  var supabaseClient = window.supabase
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

  // Expuesto para que js/data.js (Publicar/Buscar vacante, Kanban, etc.) use
  // este mismo cliente en vez de crear uno nuevo por su cuenta.
  window.supabaseClientRef = supabaseClient;

  // Recuerda qué correo y qué rol está a medio verificar, para la pantalla de código.
  var pendingVerifyEmail = '';
  var pendingVerifyRole = 'candidato';

  function goToVerifyScreen(email, role) {
    pendingVerifyEmail = email;
    pendingVerifyRole = role;
    var display = document.getElementById('verify-email-display');
    if (display) display.textContent = email;
    window.showScreen('verify');
  }

  // Cuando la persona confirma su cuenta haciendo clic en el link del correo
  // (en esta misma pestaña o volviendo después), Supabase dispara este evento
  // solo — así la app avanza automáticamente sin que nadie tenga que escribir
  // ningún código.
  if (supabaseClient) {
    supabaseClient.auth.onAuthStateChange(function (event, session) {
      if (event === 'PASSWORD_RECOVERY') {
        // Volvió del link de "recuperar contraseña" — mándalo a poner la nueva.
        window.showScreen('nueva-contrasena');
        return;
      }

      if (event !== 'SIGNED_IN' || !session) return;

      var onVerifyScreen = document.getElementById('screen-verify') &&
        document.getElementById('screen-verify').classList.contains('active');
      if (!onVerifyScreen) return; // no interrumpir si ya estaba navegando en otra pantalla

      supabaseClient
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()
        .then(function (result) {
          var role = result.data ? result.data.role : pendingVerifyRole;
          window.showToast('¡Cuenta confirmada!');
          window.showScreen(role === 'empresa' ? 'empresa-perfil' : 'crearcv');
        });
    });
  }

  /** Pide a Supabase que mande el correo de recuperación de contraseña. */
  async function submitForgotPassword() {
    if (!ensureClient()) return;
    var input = document.getElementById('forgot-email-input');
    var email = input ? input.value.trim() : '';

    if (!email) {
      window.showToast('Escribe tu correo primero');
      return;
    }

    window.showLoading('Enviando instrucciones...', 700, function () {});

    var result = await supabaseClient.auth.resetPasswordForEmail(email);

    if (result.error) {
      window.showToast(friendlyAuthError(result.error.message), 3500);
      return;
    }

    var display = document.getElementById('forgot-email-display');
    if (display) display.textContent = email;
    window.showScreen('sent');
  }

  /** Guarda la contraseña nueva una vez que Supabase ya confirmó la sesión de recuperación. */
  async function submitNewPassword() {
    if (!ensureClient()) return;
    var pw1 = document.getElementById('pw-nueva') ? document.getElementById('pw-nueva').value : '';
    var pw2 = document.getElementById('pw-nueva-confirm') ? document.getElementById('pw-nueva-confirm').value : '';

    if (pw1.length < 6) {
      window.showToast('Tu contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (pw1 !== pw2) {
      window.showToast('Las dos contraseñas no son iguales');
      return;
    }

    window.showLoading('Guardando tu contraseña nueva...', 800, function () {});

    var result = await supabaseClient.auth.updateUser({ password: pw1 });

    if (result.error) {
      window.showToast(friendlyAuthError(result.error.message), 3500);
      return;
    }

    window.showToast('Contraseña actualizada — ya puedes iniciar sesión con ella');
    await supabaseClient.auth.signOut();
    window.showScreen('home');
  }

  var emailExistsModalTarget = 'candidato-dashboard';

  /** Muestra la alerta de "ese correo ya tiene cuenta" con las dos opciones. */
  function showEmailExistsModal(email, redirectTarget) {
    emailExistsModalTarget = redirectTarget || 'candidato-dashboard';
    var text = document.getElementById('email-exists-modal-text');
    if (text) {
      text.textContent = 'Ya existe una cuenta registrada con ' + email + '. ¿Quieres iniciar sesión, o prefieres recuperar tu contraseña?';
    }
    var modal = document.getElementById('email-exists-modal');
    if (modal) modal.classList.add('show');

    // Guardamos el correo para rellenarlo solo en la siguiente pantalla.
    modal.dataset.email = email;
  }

  function closeEmailExistsModal() {
    var modal = document.getElementById('email-exists-modal');
    if (modal) modal.classList.remove('show');
  }

  function handleEmailExistsAction(action) {
    var modal = document.getElementById('email-exists-modal');
    var email = modal ? modal.dataset.email : '';
    closeEmailExistsModal();

    if (action === 'login') {
      window.goToLogin(emailExistsModalTarget);
      var loginInput = document.getElementById('login-email-input');
      if (loginInput) loginInput.value = email;
    } else {
      window.showScreen('forgot');
      var forgotInput = document.getElementById('forgot-email-input');
      if (forgotInput) forgotInput.value = email;
    }
  }

  function ensureClient() {
    if (!supabaseClient) {
      window.showToast && window.showToast('Supabase no está configurado todavía');
      return false;
    }
    return true;
  }

  // Dominios de correo personal/genérico — no se aceptan para el registro de empresa,
  // porque necesitamos poder verificar el dominio corporativo (ver docs/SECURITY.md).
  var CONSUMER_EMAIL_DOMAINS = [
    'gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'live.com',
    'icloud.com', 'protonmail.com', 'aol.com', 'msn.com', 'hotmail.es', 'yahoo.es'
  ];

  function isConsumerEmailDomain(email) {
    var domain = (email || '').split('@')[1];
    if (!domain) return false;
    return CONSUMER_EMAIL_DOMAINS.indexOf(domain.toLowerCase().trim()) !== -1;
  }

  /** Traduce los errores más comunes de Supabase Auth a mensajes claros en español. */
  function friendlyAuthError(rawMessage) {
    var msg = (rawMessage || '').toLowerCase();
    if (msg.indexOf('already registered') !== -1 || msg.indexOf('already exists') !== -1 || msg.indexOf('user already') !== -1) {
      return 'Ese correo ya está registrado. ¿Quieres iniciar sesión en vez de crear una cuenta nueva?';
    }
    if (msg.indexOf('invalid login') !== -1 || msg.indexOf('invalid_credentials') !== -1) {
      return 'Correo o contraseña incorrectos.';
    }
    if (msg.indexOf('password') !== -1 && msg.indexOf('6 char') !== -1) {
      return 'Tu contraseña debe tener al menos 6 caracteres.';
    }
    return rawMessage;
  }

  /** Registro de candidato: crea el usuario de auth + su fila en candidate_profiles (vía trigger). */
  async function signUpCandidate(email, password, fullName) {
    if (!ensureClient()) return;
    window.showLoading('Verificando tu correo...', 400, function () {});

    var exists = await supabaseClient.rpc('email_exists', { check_email: email });
    if (exists.data === true) {
      showEmailExistsModal(email, 'candidato-dashboard');
      return;
    }

    window.showLoading('Creando tu cuenta...', 600, function () {});

    var result = await supabaseClient.auth.signUp({
      email: email,
      password: password,
      options: { data: { role: 'candidato', full_name: fullName } }
    });

    if (result.error) {
      window.showToast(friendlyAuthError(result.error.message), 3500);
      return;
    }

    window.showToast('Cuenta creada — revisa tu correo para confirmar');
    goToVerifyScreen(email, 'candidato');
  }

  /** Registro de empresa: crea el usuario de auth + su fila en company_profiles (vía trigger). */
  async function signUpCompany(email, password, companyName) {
    if (!ensureClient()) return;

    if (isConsumerEmailDomain(email)) {
      window.showToast('Usa tu correo corporativo (no gmail, hotmail, outlook, etc.) para registrar tu empresa.', 4000);
      return;
    }

    window.showLoading('Verificando tu correo...', 400, function () {});

    var exists = await supabaseClient.rpc('email_exists', { check_email: email });
    if (exists.data === true) {
      showEmailExistsModal(email, 'empresa-perfil');
      return;
    }

    window.showLoading('Creando tu cuenta de empresa...', 600, function () {});

    var result = await supabaseClient.auth.signUp({
      email: email,
      password: password,
      options: { data: { role: 'empresa', company_name: companyName } }
    });

    if (result.error) {
      window.showToast(friendlyAuthError(result.error.message), 3500);
      return;
    }

    window.showToast('Cuenta de empresa creada');
    goToVerifyScreen(email, 'empresa');
  }

  /** Login real: autentica, consulta el rol en `profiles`, y navega al dashboard correcto. */
  async function realLogin(email, password) {
    if (!ensureClient()) return;
    window.showLoading('Iniciando sesión...', 400, function () {});

    var authResult = await supabaseClient.auth.signInWithPassword({ email: email, password: password });
    if (authResult.error) {
      window.showToast(friendlyAuthError(authResult.error.message), 3500);
      return;
    }

    var userId = authResult.data.user.id;
    var profileResult = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (profileResult.error) {
      window.showToast('No pudimos leer tu perfil: ' + profileResult.error.message, 3500);
      return;
    }

    var role = profileResult.data.role;
    window.showToast('Bienvenido de nuevo');
    window.showScreen(role === 'empresa' ? 'empresa-perfil' : 'candidato-dashboard');
  }

  /** Cierra la sesión real y regresa al home público. */
  async function realLogout() {
    if (!ensureClient()) {
      window.showScreen('home');
      return;
    }
    await supabaseClient.auth.signOut();
    window.showToast('Sesión cerrada');
    window.showScreen('home');
  }

  /** Pide a Supabase que reenvíe el correo de confirmación al mismo correo. */
  async function resendVerifyCode() {
    if (!ensureClient()) return;
    if (!pendingVerifyEmail) {
      window.showToast('No encontramos a qué correo reenviar el código');
      return;
    }
    window.showLoading('Reenviando código...', 600, function () {});
    var result = await supabaseClient.auth.resend({ type: 'signup', email: pendingVerifyEmail });
    if (result.error) {
      window.showToast(friendlyAuthError(result.error.message), 3500);
      return;
    }
    window.showToast('Correo reenviado — revisa tu bandeja de entrada');
  }

  // Wrappers que toman los valores directo de los inputs de cada pantalla,
  // para poder llamarlos desde onclick="..." sin cambiar el HTML existente.
  function submitCandidateRegister() {
    var screen = document.getElementById('screen-register');
    var nameInputs = screen.querySelectorAll('input[type="text"]');
    // Nombre(s), Apellido(s) siguen siendo los únicos inputs de texto ahí.
    var fullName = (nameInputs[0] && nameInputs[0].value) + ' ' + (nameInputs[1] && nameInputs[1].value);
    var email = document.getElementById('register-email-input') ? document.getElementById('register-email-input').value : '';
    var password = document.getElementById('pw-register') ? document.getElementById('pw-register').value : '';
    signUpCandidate(email, password, fullName.trim());
  }

  function submitCompanyRegister() {
    var screen = document.getElementById('screen-empresa-registro');
    var textInputs = screen.querySelectorAll('input[type="text"]');
    // Nombre completo, Teléfono, Nombre comercial, Razón social, RFC, Código postal...
    var companyName = textInputs[2] && textInputs[2].value;
    var email = document.getElementById('empresa-email-input') ? document.getElementById('empresa-email-input').value : '';
    var password = document.getElementById('pw-empresa') ? document.getElementById('pw-empresa').value : '';
    signUpCompany(email, password, companyName);
  }

  function submitLogin() {
    var email = document.getElementById('login-email-input') ? document.getElementById('login-email-input').value : '';
    var password = document.getElementById('pw-login') ? document.getElementById('pw-login').value : '';
    realLogin(email, password);
  }

  window.signUpCandidate = signUpCandidate;
  window.signUpCompany = signUpCompany;
  window.realLogin = realLogin;
  window.realLogout = realLogout;
  window.submitCandidateRegister = submitCandidateRegister;
  window.submitCompanyRegister = submitCompanyRegister;
  window.submitLogin = submitLogin;
  window.resendVerifyCode = resendVerifyCode;
  window.submitForgotPassword = submitForgotPassword;
  window.submitNewPassword = submitNewPassword;
  window.handleEmailExistsAction = handleEmailExistsAction;
  window.closeEmailExistsModal = closeEmailExistsModal;
})();
