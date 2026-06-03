async function probeMock() {
  try {
    const res = await fetch('/api/v1/capabilities');
    if (!res.ok) throw new Error(String(res.status));
    const caps = await res.json();
    console.log('[playground] mock capabilities', caps);
  } catch {
    console.warn('[playground] mock gateway not reachable — run: pnpm dev:mock');
  }
}

void probeMock();