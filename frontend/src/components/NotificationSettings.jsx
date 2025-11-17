import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert } from './ui/alert';
import { axiosWithAuth } from './api/axiosWithAuth';

const NotificationSettings = () => {
  const [employees, setEmployees] = useState([]);
  const [notificationTypes, setNotificationTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [testingNotification, setTestingNotification] = useState(null);
  const [sendingAnalysis, setSendingAnalysis] = useState(false);
  const [checkingLowStock, setCheckingLowStock] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [employeesResponse, typesResponse] = await Promise.all([
        axiosWithAuth('/notifications/employees'),
        axiosWithAuth('/notifications/types')
      ]);

      setEmployees(employeesResponse.data.data || []);
      setNotificationTypes(typesResponse.data.data || []);
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
      setAlert({
        type: 'error',
        message: 'Erro ao carregar configurações de notificação'
      });
    } finally {
      setLoading(false);
    }
  };

  const updateEmployeeSettings = async (employeeId, settings) => {
    try {
      setSaving(true);
      await axiosWithAuth(`/notifications/employee/${employeeId}`, {
        method: 'PUT',
        data: settings
      });
      
      // Atualizar lista local
      setEmployees(prev => prev.map(emp => 
        emp.employee_id === employeeId 
          ? { ...emp, ...settings, updated_at: new Date().toISOString() }
          : emp
      ));

      setAlert({
        type: 'success',
        message: 'Configurações atualizadas com sucesso!'
      });
    } catch (error) {
      console.error('Erro ao atualizar configurações:', error);
      setAlert({
        type: 'error',
        message: 'Erro ao atualizar configurações'
      });
    } finally {
      setSaving(false);
    }
  };

  const sendTestNotification = async (employeeId, employeeName) => {
    try {
      setTestingNotification(employeeId);
      await axiosWithAuth(`/notifications/employee/${employeeId}/test`, {
        method: 'POST',
        data: {}
      });
      
      setAlert({
        type: 'success',
        message: `Notificação de teste enviada para ${employeeName}!`
      });
    } catch (error) {
      console.error('Erro ao enviar notificação de teste:', error);
      setAlert({
        type: 'error',
        message: error.response?.data?.message || 'Erro ao enviar notificação de teste'
      });
    } finally {
      setTestingNotification(null);
    }
  };

  const sendDailyNotifications = async () => {
    try {
      setLoading(true);
      await axiosWithAuth('/notifications/daily', {
        method: 'POST',
        data: {}
      });
      
      setAlert({
        type: 'success',
        message: 'Notificações diárias enviadas para todos os funcionários!'
      });
    } catch (error) {
      console.error('Erro ao enviar notificações diárias:', error);
      setAlert({
        type: 'error',
        message: error.response?.data?.message || 'Erro ao enviar notificações diárias'
      });
    } finally {
      setLoading(false);
    }
  };

  const sendDailyAnalysis = async () => {
    try {
      setSendingAnalysis(true);
      await axiosWithAuth('/notifications/daily-analysis', { method: 'POST', data: {} });
      setAlert({ type: 'success', message: 'Análise diária enviada para gerentes/donos!' });
    } catch (error) {
      console.error('Erro ao enviar análise diária:', error);
      setAlert({ type: 'error', message: error.response?.data?.message || 'Erro ao enviar análise diária' });
    } finally {
      setSendingAnalysis(false);
    }
  };

  const checkLowStock = async () => {
    try {
      setCheckingLowStock(true);
      const resp = await axiosWithAuth('/notifications/check-low-stock', { method: 'POST', data: {} });
      const count = resp.data?.data?.count ?? 0;
      setAlert({ type: 'success', message: `Verificação de estoque baixo concluída (${count} produto(s))` });
    } catch (error) {
      console.error('Erro ao verificar estoque baixo:', error);
      setAlert({ type: 'error', message: error.response?.data?.message || 'Erro na verificação de estoque baixo' });
    } finally {
      setCheckingLowStock(false);
    }
  };

  const toggleNotificationType = (employeeId, notificationType) => {
    const employee = employees.find(emp => emp.employee_id === employeeId);
    const currentTypes = employee.notification_types || [];
    
    let newTypes;
    if (currentTypes.includes(notificationType)) {
      newTypes = currentTypes.filter(type => type !== notificationType);
    } else {
      newTypes = [...currentTypes, notificationType];
    }

    updateEmployeeSettings(employeeId, { notification_types: newTypes });
  };

  const toggleEmployeeNotifications = (employeeId, enabled) => {
    updateEmployeeSettings(employeeId, { enabled });
  };

  const getNotificationTypeInfo = (typeKey) => {
    return notificationTypes.find(type => type.key === typeKey) || { 
      name: typeKey, 
      description: '', 
      category: 'other' 
    };
  };

  const groupNotificationTypesByCategory = () => {
    const grouped = {};
    notificationTypes.forEach(type => {
      if (!grouped[type.category]) {
        grouped[type.category] = [];
      }
      grouped[type.category].push(type);
    });
    return grouped;
  };

  const getCategoryColor = (category) => {
    const colors = {
      schedule: 'bg-blue-100 text-blue-800',
      inventory: 'bg-yellow-100 text-yellow-800',
      financial: 'bg-green-100 text-green-800',
      client: 'bg-purple-100 text-purple-800',
      other: 'bg-gray-100 text-gray-800'
    };
    return colors[category] || colors.other;
  };

  const getCategoryName = (category) => {
    const names = {
      schedule: 'Agendamentos',
      inventory: 'Estoque',
      financial: 'Financeiro',
      client: 'Clientes',
      other: 'Outros'
    };
    return names[category] || 'Outros';
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Carregando configurações...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {alert && (
        <Alert className={`${alert.type === 'error' ? 'border-red-500 bg-red-50' : 'border-green-500 bg-green-50'}`}>
          <div className={`${alert.type === 'error' ? 'text-red-700' : 'text-green-700'}`}>
            {alert.message}
          </div>
        </Alert>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Configurações de Notificação</h1>
          <p className="text-gray-600 mt-1">
            Gerencie as configurações de notificação WhatsApp dos funcionários
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={sendDailyNotifications} disabled={loading} variant="outline">
            {loading ? '⏳' : '📅'} Notificações Diárias
          </Button>
          <Button onClick={sendDailyAnalysis} disabled={sendingAnalysis} variant="outline">
            {sendingAnalysis ? '⏳' : '📊'} Análise Diária
          </Button>
          <Button onClick={checkLowStock} disabled={checkingLowStock} variant="outline">
            {checkingLowStock ? '⏳' : '📦'} Estoque Baixo
          </Button>
          <Button onClick={fetchData} disabled={loading}>
            🔄 Atualizar
          </Button>
        </div>
      </div>

      {/* Lista de funcionários */}
      <div className="grid gap-6">
        {employees.map(employee => (
          <Card key={employee.employee_id} className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-3">
                    <span>{employee.employee_name}</span>
                    <Badge variant={employee.employee_role === 'owner' ? 'default' : 'secondary'}>
                      {employee.employee_role}
                    </Badge>
                  </CardTitle>
                  <p className="text-sm text-gray-600 mt-1">
                    📱 {employee.employee_phone || 'Telefone não informado'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => sendTestNotification(employee.employee_id, employee.employee_name)}
                    disabled={!employee.enabled || !employee.employee_phone || testingNotification === employee.employee_id}
                  >
                    {testingNotification === employee.employee_id ? '⏳' : '🧪'} Teste
                  </Button>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Notificações:</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={employee.enabled || false}
                        onChange={(e) => toggleEmployeeNotifications(employee.employee_id, e.target.checked)}
                        className="sr-only peer"
                        disabled={saving}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-0">
              {employee.enabled ? (
                <div className="space-y-4">
                  {Object.entries(groupNotificationTypesByCategory()).map(([category, types]) => (
                    <div key={category}>
                      <h4 className="font-medium text-sm text-gray-700 mb-2">
                        {getCategoryName(category)}
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {types.map(type => {
                          // Restringe exibição conforme roles permitidas
                          if (type.roles && !type.roles.includes(employee.employee_role)) {
                            return null; // não renderiza tipos não permitidos para o papel
                          }
                          const isEnabled = (employee.notification_types || []).includes(type.key);
                          return (
                            <div
                              key={type.key}
                              className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                                isEnabled
                                  ? 'border-blue-300 bg-blue-50'
                                  : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                              }`}
                              onClick={() => toggleNotificationType(employee.employee_id, type.key)}
                            >
                              <div className="flex items-start gap-3">
                                <input
                                  type="checkbox"
                                  checked={isEnabled}
                                  onChange={() => {}} // Controlado pelo onClick do div
                                  className="mt-1"
                                  disabled={saving}
                                />
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-sm">{type.name}</span>
                                    <Badge className={getCategoryColor(type.category)} size="sm">
                                      {getCategoryName(type.category)}
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-gray-600 mt-1">
                                    {type.description}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-2">🔕</div>
                  <p>Notificações desabilitadas para este funcionário</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {employees.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <div className="text-4xl mb-4">👥</div>
            <h3 className="text-lg font-medium mb-2">Nenhum funcionário encontrado</h3>
            <p className="text-gray-600">
              Cadastre funcionários para configurar suas notificações
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default NotificationSettings;