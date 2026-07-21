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
  return body;
}

export async function createReceipt(imageFile) {
  const formData = new FormData();
  formData.append('image', imageFile);
  return (await request('/receipts', { method: 'POST', body: formData })).data;
}

export async function updateReceiptItems(receiptId, items) {
  return (
    await request(`/receipts/${receiptId}/items`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    })
  ).data;
}

export async function confirmReceipt(receiptId) {
  return (await request(`/receipts/${receiptId}/confirm`, { method: 'POST' })).data;
}

export async function listReceipts(month) {
  return (await request(month ? `/receipts?month=${month}` : '/receipts')).data;
}

export function autoHygieneCheck() {
  return request('/hygiene/check', { method: 'POST' });
}

export function registerEducation() {
  return request('/hygiene/education', { method: 'POST' });
}

export async function getReceiptImageUrl(receiptId) {
  const res = await fetch(`${BASE_URL}/receipts/${receiptId}/image`, {
    headers: { 'x-api-key': API_KEY },
  });
  if (!res.ok) throw new Error('이미지를 불러오지 못했습니다');
  return URL.createObjectURL(await res.blob());
}
