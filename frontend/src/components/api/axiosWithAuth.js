import api from './axios';

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
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      throw new Error('Sessão expirada ou acesso negado');
    }
    throw error;
  }
}
