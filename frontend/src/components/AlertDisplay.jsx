import React from 'react';
import { Alert, AlertDescription } from '../components/ui/alert';

/**
 * Componente para exibir alertas de forma consistente
 * @param {Object} alert - Objeto com type e message
 * @param {Function} onClose - Função para fechar o alerta
 */
export function AlertDisplay({ alert, onClose }) {
  if (!alert) return null;

  return (
    <Alert 
      variant={alert.type} 
      onClose={onClose}
      className="mb-4"
    >
      <AlertDescription>{alert.message}</AlertDescription>
    </Alert>
  );
}
