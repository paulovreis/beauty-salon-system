import { useState, useCallback, useEffect } from 'react';

/**
 * Hook customizado para gerenciar alertas de sucesso e erro
 * @param {number} autoCloseDelay - Tempo em ms para fechar automaticamente (0 = não fechar)
 * @returns {Object} - Funções e estados para gerenciar alertas
 */
export function useAlert(autoCloseDelay = 5000) {
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    if (alert && autoCloseDelay > 0) {
      const timer = setTimeout(() => {
        setAlert(null);
      }, autoCloseDelay);

      return () => clearTimeout(timer);
    }
  }, [alert, autoCloseDelay]);

  const showSuccess = useCallback((message) => {
    setAlert({
      type: 'success',
      message: typeof message === 'string' ? message : 'Operação realizada com sucesso!'
    });
  }, []);

  const showError = useCallback((error) => {
    let errorMessage = 'Ocorreu um erro. Tente novamente.';
    
    if (typeof error === 'string') {
      errorMessage = error;
    } else if (error?.response?.data?.message) {
      errorMessage = error.response.data.message;
    } else if (error?.response?.data?.error) {
      errorMessage = error.response.data.error;
    } else if (error?.message) {
      errorMessage = error.message;
    }

    setAlert({
      type: 'destructive',
      message: errorMessage
    });
  }, []);

  const showWarning = useCallback((message) => {
    setAlert({
      type: 'warning',
      message: typeof message === 'string' ? message : 'Atenção!'
    });
  }, []);

  const clearAlert = useCallback(() => {
    setAlert(null);
  }, []);

  return {
    alert,
    showSuccess,
    showError,
    showWarning,
    clearAlert
  };
}
