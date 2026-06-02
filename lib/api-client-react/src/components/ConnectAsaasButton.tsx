import React, { useState } from 'react';
import { customFetch } from '../custom-fetch';

/**
 * Botão que conecta o artista logado ao Asaas.
 * Usa a rota autenticada /artists/me/connect-asaas (não precisa de artistId).
 */
export function ConnectAsaasButton({ onConnected }: { onConnected?: (walletId: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [walletId, setWalletId] = useState<string | null>(null);

  const handleConnect = async () => {
    setLoading(true);
    try {
      const data = await customFetch<{ walletId: string; status: string }>(
        '/api/artists/me/connect-asaas',
        { method: 'POST' },
      );
      setWalletId(data.walletId);
      onConnected?.(data.walletId);
    } catch (err) {
      console.error(err);
      alert('Falha ao conectar ao Asaas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={handleConnect} disabled={loading || !!walletId}>
        {walletId ? 'Conectado ao Asaas' : loading ? 'Conectando...' : 'Conectar Asaas'}
      </button>
      {walletId && <p>Wallet ID: {walletId}</p>}
    </div>
  );
}
