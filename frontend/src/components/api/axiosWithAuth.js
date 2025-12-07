import api from './axios';

// Função para refresh token
async function refreshToken() {
  const token = localStorage.getItem("token");
  if (!token) return null;
  try {
    const response = await api.post('/auth/refresh-token', {}, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (response.data && response.data.token) {
      localStorage.setItem("token", response.data.token);
      return response.data.token;
    }
    return null;
  } catch (error) {
    console.error('Refresh token failed:', error);
    return null;
  }
}

// Função de requisição autenticada usando axios
export async function axiosWithAuth(url, options = {}) {
  let token = localStorage.getItem('token');
  if (!token) throw new Error('Usuário não autenticado');
  
  try {
    const method = options.method || 'get';
    const response = await api({
      url,
      method,
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });
    return response;
  } catch (error) {
    // Se recebeu 401, tenta fazer refresh do token
    if (error.response && error.response.status === 401) {
      const newToken = await refreshToken();
      if (newToken) {
        // Tenta a requisição novamente com o novo token
        try {
          const retryResponse = await api({
            url,
            method: options.method || 'get',
            ...options,
            headers: {
              ...(options.headers || {}),
              Authorization: `Bearer ${newToken}`,
            },
          });
          return retryResponse;
        } catch (retryError) {
          throw new Error('Sessão expirada. Faça login novamente.');
        }
      } else {
        throw new Error('Sessão expirada. Faça login novamente.');
      }
    }
    // 403 deve indicar falta de permissão, não sessão expirada
    if (error.response && error.response.status === 403) {
      const backendMsg = error.response.data?.message || 'Acesso negado: permissão insuficiente';
      throw new Error(backendMsg);
    }
    throw error;
  }
}
