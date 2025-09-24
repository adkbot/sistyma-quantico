const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export async function getKeysState() {
  const response = await fetch(`${API}/api/keys/state`);
  if (!response.ok) {
    throw new Error(`Falha ao obter estado das chaves: ${response.status}`);
  }
  return response.json();
}

export async function saveKeys(body) {
  const response = await fetch(`${API}/api/keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}
