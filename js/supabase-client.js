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

  function ensureClient() {
    if (!supabaseClient) {
      window.showToast && window.showToast('Supabase no está configurado todavía');
      return false;
    }
    return true;
  }

  /** Registro de candidato: crea el usuario de auth + su fila en candidate_profiles (vía trigger). */
  async function signUpCandidate(email, password, fullName) {
    if (!ensureClient()) return;
    window.showLoading('Creando tu cuenta...', 600, function () {});

    var result = await supabaseClient.auth.signUp({
      email: email,
      password: password,
      options: { data: { role: 'candidato', full_name: fullName } }
    });

    if (result.error) {
      window.showToast('Error: ' + result.error.message, 3500);
      return;
    }
    window.showToast('Cuenta creada — revisa tu correo para confirmar');
    window.showScreen('verify');
  }

  /** Registro de empresa: crea el usuario de auth + su fila en company_profiles (vía trigger). */
  async function signUpCompany(email, password, companyName) {
    if (!ensureClient()) return;
    window.showLoading('Creando tu cuenta de empresa...', 600, function () {});

    var result = await supabaseClient.auth.signUp({
      email: email,
      password: password,
      options: { data: { role: 'empresa', company_name: companyName } }
    });

    if (result.error) {
      window.showToast('Error: ' + result.error.message, 3500);
      return;
    }
    window.showToast('Cuenta de empresa creada');
    window.showScreen('empresa-perfil');
  }

  /** Login real: autentica, consulta el rol en `profiles`, y navega al dashboard correcto. */
  async function realLogin(email, password) {
    if (!ensureClient()) return;
    window.showLoading('Iniciando sesión...', 400, function () {});

    var authResult = await supabaseClient.auth.signInWithPassword({ email: email, password: password });
    if (authResult.error) {
      window.showToast('Error: ' + authResult.error.message, 3500);
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

  /** Helper para leer los valores de un formulario de auth por sus inputs visibles. */
  function readAuthForm(screenId) {
    var screen = document.getElementById(screenId);
    var inputs = screen.querySelectorAll('input[type="text"], input[type="password"]');
    return inputs;
  }

  // Wrappers que toman los valores directo de los inputs de cada pantalla,
  // para poder llamarlos desde onclick="..." sin cambiar el HTML existente.
  function submitCandidateRegister() {
    var inputs = readAuthForm('screen-register');
    // Orden de los inputs en el formulario: Nombre(s), Apellido(s), Correo, Contraseña
    var fullName = (inputs[0] && inputs[0].value) + ' ' + (inputs[1] && inputs[1].value);
    var email = inputs[2] && inputs[2].value;
    var password = document.getElementById('pw-register') ? document.getElementById('pw-register').value : '';
    signUpCandidate(email, password, fullName.trim());
  }

  function submitCompanyRegister() {
    var screen = document.getElementById('screen-empresa-registro');
    var textInputs = screen.querySelectorAll('input[type="text"]');
    // Nombre completo, Teléfono, Correo, Nombre comercial, Razón social, RFC, Código postal...
    var email = textInputs[2] && textInputs[2].value;
    var companyName = textInputs[3] && textInputs[3].value;
    var password = document.getElementById('pw-empresa') ? document.getElementById('pw-empresa').value : '';
    signUpCompany(email, password, companyName);
  }

  function submitLogin() {
    var screen = document.getElementById('screen-login');
    var email = screen.querySelector('input[type="text"]').value;
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
})();
