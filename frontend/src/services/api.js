const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

function notifyUnauthorized() {
  clearToken();
  window.dispatchEvent(new CustomEvent('admin:unauthorized'));
}

export function getToken() {
  return localStorage.getItem('adminToken');
}

export function clearToken() {
  localStorage.removeItem('adminToken');
}

async function parseResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return response.json().catch(() => ({}));
  return response.text().catch(() => '');
}

export async function apiFetch(path, options = {}) {
  const token = getToken();
  const isFormData = options.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers || {})
  };

  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${API}${path}`, { ...options, headers });
  } catch {
    throw new Error('Unable to reach the server. Check the API URL and your connection.');
  }

  const data = await parseResponse(response);
  if (response.status === 401) {
    notifyUnauthorized();
    throw new Error(data?.message || 'Your admin session has expired. Please sign in again.');
  }

  if (!response.ok) {
    throw new Error((typeof data === 'object' && data?.message) || 'Something went wrong');
  }

  return data;
}

async function fetchBlob(path, failureMessage) {
  const token = getToken();
  let response;
  try {
    response = await fetch(`${API}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  } catch {
    throw new Error('Unable to reach the server. Check the API URL and your connection.');
  }

  if (response.status === 401) {
    const data = await parseResponse(response);
    notifyUnauthorized();
    throw new Error(data?.message || 'Your admin session has expired. Please sign in again.');
  }
  if (!response.ok) {
    const data = await parseResponse(response);
    throw new Error(data?.message || failureMessage);
  }
  return response.blob();
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function apiDownload(path, filename) {
  const blob = await fetchBlob(path, 'Download failed');
  triggerDownload(blob, filename);
}

export async function apiOpenFile(path, filename = 'document') {
  const blob = await fetchBlob(path, 'Document access failed');
  const url = URL.createObjectURL(blob);
  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  if (!opened) triggerDownload(blob, filename || 'document');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function apiOpenPdf(path) {
  const blob = await fetchBlob(path, 'PDF generation failed');
  const url = URL.createObjectURL(blob);
  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  if (!opened) triggerDownload(blob, 'document.pdf');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
