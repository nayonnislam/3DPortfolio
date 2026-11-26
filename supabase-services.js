const config = window.PORTFOLIO_SUPABASE_CONFIG || {};
const configured =
  typeof config.url === 'string' &&
  /^https:\/\/[a-z\d-]+\.supabase\.co\/?$/i.test(config.url) &&
  typeof config.anonKey === 'string' &&
  config.anonKey.length > 30 &&
  !config.anonKey.includes('YOUR_SUPABASE_');
const storageKey = 'nayonPortfolioSupabaseSession';
let session = null;
let currentUsername = '';

try {
  session = JSON.parse(localStorage.getItem(storageKey) || 'null');
} catch (error) {
  console.error('The saved Supabase session could not be read.', error);
  localStorage.removeItem(storageKey);
}

function persistSession() {
  if (session) localStorage.setItem(storageKey, JSON.stringify(session));
  else localStorage.removeItem(storageKey);
}

async function supabaseRequest(path, { method = 'GET', body, token, headers = {} } = {}) {
  if (!configured) throw new Error('Supabase is not configured yet.');
  const response = await fetch(`${config.url.replace(/\/$/, '')}${path}`, {
    method,
    headers: {
      apikey: config.anonKey,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(result?.msg || result?.message || result?.error_description || result?.error || 'Supabase request failed.');
  }
  return result;
}

export function validateAdminPassword(password) {
  if (typeof password !== 'string' || password.length < 12) {
    throw new Error('Use at least 12 characters for the new password.');
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9\s]/.test(password)) {
    throw new Error('The new password must include uppercase and lowercase letters, a number, and a symbol.');
  }
}

function validateAdminIdentifier(identifier) {
  const account = identifier.trim();
  if (!account) throw new Error('Enter your registered email or phone number.');
  if (account.includes('@')) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account)) {
      throw new Error('Enter a valid email address.');
    }
  } else if (!/^\+[1-9]\d{7,14}$/.test(account)) {
    throw new Error('Enter a phone number in international format, for example +8801713900909.');
  }
  return account;
}

function setSession(result) {
  session = {
    access_token: result.access_token,
    refresh_token: result.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + (result.expires_in || 3600),
    user: result.user
  };
  persistSession();
}

async function refreshSession() {
  if (!session?.refresh_token) {
    session = null;
    persistSession();
    return false;
  }
  try {
    const result = await supabaseRequest('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      body: { refresh_token: session.refresh_token }
    });
    setSession(result);
    return true;
  } catch (error) {
    console.error('The Supabase session could not be refreshed.', error);
    session = null;
    persistSession();
    return false;
  }
}

async function ensureFreshSession() {
  if (!session?.access_token) return false;
  if (session.expires_at && session.expires_at > Math.floor(Date.now() / 1000) + 60) return true;
  return refreshSession();
}

export function isSupabaseConfigured() {
  return configured;
}

export function isAdminSignedIn() {
  return Boolean(session?.access_token && session.user?.app_metadata?.role === 'admin');
}

export async function restoreAdminSession() {
  if (!(await ensureFreshSession())) return false;
  try {
    const user = await supabaseRequest('/auth/v1/user', { token: session.access_token });
    session.user = user;
    persistSession();
    if (user.app_metadata?.role !== 'admin') {
      await signOut();
      return false;
    }
    currentUsername = user.email || user.phone || '';
    return true;
  } catch (error) {
    console.error('The Supabase administrator session could not be restored.', error);
    await signOut();
    return false;
  }
}

export async function signIn(username, password) {
  const identifier = validateAdminIdentifier(username);
  const result = await supabaseRequest('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: identifier.includes('@')
      ? { email: identifier, password }
      : { phone: identifier, password }
  });
  setSession(result);
  if (result.user?.app_metadata?.role !== 'admin') {
    await signOut();
    throw new Error('This account does not have administrator access.');
  }
  currentUsername = result.user.email || result.user.phone || identifier;
}

export async function signOut() {
  if (session?.access_token && configured) {
    try {
      await supabaseRequest('/auth/v1/logout', { method: 'POST', token: session.access_token });
    } catch (error) {
      console.error('Supabase logout could not be confirmed by the server.', error);
    }
  }
  session = null;
  currentUsername = '';
  persistSession();
}

export async function requestPasswordReset(identifier) {
  const account = validateAdminIdentifier(identifier);
  if (account.includes('@')) {
    await supabaseRequest('/auth/v1/recover', { method: 'POST', body: { email: account } });
    return 'email';
  }
  if (!/^\+[1-9]\d{7,14}$/.test(account)) {
    throw new Error('Enter your registered email or phone in international format, for example +8801713900909.');
  }
  await supabaseRequest('/auth/v1/otp', {
    method: 'POST',
    body: { phone: account, create_user: false }
  });
  return 'phone';
}

export async function confirmPasswordReset(identifier, code, newPassword) {
  const account = validateAdminIdentifier(identifier);
  validateAdminPassword(newPassword);
  if (!/^\d{6}$/.test(code.trim())) {
    throw new Error('Enter the 6-digit verification code.');
  }
  const isEmail = account.includes('@');
  const result = await supabaseRequest('/auth/v1/verify', {
    method: 'POST',
    body: isEmail
      ? { email: account, token: code.trim(), type: 'recovery' }
      : { phone: account, token: code.trim(), type: 'sms' }
  });
  setSession(result);
  const user = await supabaseRequest('/auth/v1/user', { token: session.access_token });
  if (user.app_metadata?.role !== 'admin') {
    await signOut();
    throw new Error('This account does not have administrator access.');
  }
  const updatedUser = await supabaseRequest('/auth/v1/user', {
    method: 'PUT',
    token: session.access_token,
    body: { password: newPassword }
  });
  if (!updatedUser) throw new Error('Password updated, but Supabase returned no account details.');
  await signOut();
}

export async function changePassword(currentPassword, newPassword) {
  if (!currentUsername || !(await ensureFreshSession())) {
    throw new Error('Please sign in again to change your password.');
  }
  if (!currentPassword) throw new Error('Enter your current password.');
  if (currentPassword === newPassword) throw new Error('The new password must be different from the current password.');
  validateAdminPassword(newPassword);
  const identifier = currentUsername;
  const result = await supabaseRequest('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: identifier.includes('@')
      ? { email: identifier, password: currentPassword }
      : { phone: identifier, password: currentPassword }
  });
  if (result.user?.app_metadata?.role !== 'admin') {
    await signOut();
    throw new Error('This account does not have administrator access.');
  }
  setSession(result);
  const user = await supabaseRequest('/auth/v1/user', {
    method: 'PUT',
    token: session.access_token,
    body: { password: newPassword }
  });
  session.user = user;
  persistSession();
}

async function restRequest(path, { method = 'GET', body, prefer } = {}) {
  await ensureFreshSession();
  const headers = {};
  if (prefer) headers.Prefer = prefer;
  const result = await supabaseRequest(`/rest/v1/${path}`, {
    method,
    body,
    token: session?.access_token || config.anonKey,
    headers
  });
  return result;
}

export async function getProjects() {
  return restRequest('portfolio_projects?select=*&order=created_at.asc');
}

export async function saveProject(project) {
  const values = {
    id: project.id || crypto.randomUUID(),
    title: project.title,
    category: project.category || 'eyewear',
    description: project.description || '',
    cover: project.cover || '',
    gallery: project.gallery || [],
    details: project.details || [],
    model: project.model || '',
    deleted: false,
    updated_at: new Date().toISOString()
  };
  const result = await restRequest('portfolio_projects?on_conflict=id', {
    method: 'POST',
    body: values,
    prefer: 'resolution=merge-duplicates,return=representation'
  });
  return result[0];
}

export async function deleteProject(projectId) {
  if (projectId.startsWith('static-')) {
    await restRequest(`portfolio_projects?on_conflict=id`, {
      method: 'POST',
      body: {
        id: projectId,
        title: 'Deleted project',
        category: 'eyewear',
        description: '',
        cover: '',
        gallery: [],
        details: [],
        model: '',
        deleted: true,
        updated_at: new Date().toISOString()
      },
      prefer: 'resolution=merge-duplicates,return=minimal'
    });
    return;
  }
  await restRequest(`portfolio_projects?id=eq.${encodeURIComponent(projectId)}`, { method: 'DELETE' });
}

export async function uploadFile(file) {
  await ensureFreshSession();
  if (!session?.access_token || !isAdminSignedIn()) {
    throw new Error('Sign in as an administrator before uploading files.');
  }
  if (!file.size || file.size > 25 * 1024 * 1024) {
    throw new Error('Each uploaded file must be between 1 byte and 25 MB.');
  }
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(-100);
  const path = `${crypto.randomUUID()}-${safeName}`;
  const response = await fetch(`${config.url.replace(/\/$/, '')}/storage/v1/object/portfolio/${path}`, {
    method: 'POST',
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': file.type || 'application/octet-stream',
      'x-upsert': 'false'
    },
    body: file
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.message || result.error || `Could not upload ${file.name}.`);
  }
  return `${config.url.replace(/\/$/, '')}/storage/v1/object/public/portfolio/${path}`;
}
