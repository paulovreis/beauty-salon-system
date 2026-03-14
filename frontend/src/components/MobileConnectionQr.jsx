import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import api from './api/axios.js';

export default function MobileConnectionQr() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');

      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        setError('Usuário não autenticado.');
        return;
      }

      try {
        const res = await api.get('/dashboard/mobile-connection-qr', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;
        setData(res.data);
      } catch (e) {
        if (cancelled) return;
        const status = e?.response?.status;
        if (status === 401 || status === 403) {
          setError('Sessão expirada ou acesso negado.');
        } else {
          setError('Erro ao carregar QR de conexão do app.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <div className="p-4 md:p-8 text-center">Carregando QR de conexão...</div>;
  if (error) return <div className="p-4 md:p-8 text-center text-red-600">{error}</div>;

  const svg = data?.qr?.svg || '';
  const baseUrl = data?.baseUrl || '';
  const salonName = data?.meta?.name || 'Salão';

  return (
    <div className="space-y-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>Conectar App Mobile</CardTitle>
          <CardDescription>
            Abra o app do cliente e escaneie o QR Code para configurar este salão.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 grid-cols-1 lg:grid-cols-2 items-start">
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">Salão</div>
              <div className="text-lg font-semibold text-gray-900">{salonName}</div>

              <div className="mt-4 text-sm text-muted-foreground">Base URL pública</div>
              <div className="font-mono text-sm break-all bg-gray-50 border rounded-md p-3">{baseUrl || '-'}</div>

              <div className="text-xs text-muted-foreground">
                Se o QR estiver apontando para o domínio errado, ajuste a variável `API_PUBLIC_ORIGIN`.
              </div>
            </div>

            <div className="flex items-center justify-center">
              <div className="bg-white border rounded-lg p-4 shadow-sm max-w-[320px] w-full">
                {svg ? (
                  <div
                    aria-label="QR Code de conexão do app"
                    className="w-full"
                    dangerouslySetInnerHTML={{ __html: svg }}
                  />
                ) : (
                  <div className="text-center text-muted-foreground">QR indisponível.</div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
