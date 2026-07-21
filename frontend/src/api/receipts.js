const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const API_KEY = import.meta.env.VITE_API_KEY;

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'x-api-key': API_KEY,
      ...options.headers,
    },
  });

  const body = await res.json();
  if (!body.success) {
    throw new Error(body.error || 'Request failed');
  }
  return body.data;
}

export function createReceipt(imageFile) {
  const formData = new FormData();
  formData.append('image', imageFile);
  return request('/receipts', { method: 'POST', body: formData });
}

export function updateReceiptItems(receiptId, items) {
  return request(`/receipts/${receiptId}/items`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
}

export function confirmReceipt(receiptId) {
  return request(`/receipts/${receiptId}/confirm`, { method: 'POST' });
}

export function listReceipts(month) {
  return request(month ? `/receipts?month=${month}` : '/receipts');
}

export async function getReceiptImageUrl(receiptId) {
  const res = await fetch(`${BASE_URL}/receipts/${receiptId}/image`, {
    headers: { 'x-api-key': API_KEY },
  });
  if (!res.ok) throw new Error('이미지를 불러오지 못했습니다');
  return URL.createObjectURL(await res.blob());
}

export function getReceiptItems(receiptId) {
  return request(`/receipts/${receiptId}/items`);
}

export async function autoHygieneCheck() {
  const res = await fetch(`${BASE_URL}/hygiene/check`, {
    method: 'POST',
    headers: { 'x-api-key': API_KEY },
  });
  const body = await res.json();
  if (!body.success) throw new Error(body.error || 'Request failed');
  return body;
}

export async function registerEducation(attendees) {
  const res = await fetch(`${BASE_URL}/hygiene/education`, {
    method: 'POST',
    headers: { 'x-api-key': API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ attendees }),
  });
  const body = await res.json();
  if (!body.success) throw new Error(body.error || 'Request failed');
  return body;
}
