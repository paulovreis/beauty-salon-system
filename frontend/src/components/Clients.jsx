import React, { useState, useEffect } from 'react';
import { axiosWithAuth } from './api/axiosWithAuth';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Badge } from './ui/badge';
import { 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar,
  User,
  Users,
  TrendingUp,
  Gift
} from 'lucide-react';

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  
  // Estados do modal
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    birth_date: '',
    notes: ''
  });
  
  // Estado do modal de detalhes
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  
  // Estado do modal de exclusão
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [clientToDelete, setClientToDelete] = useState(null);

  useEffect(() => {
    loadClients();
    loadStats();
  }, [page, searchQuery]);

  const loadClients = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20'
      });
      
      if (searchQuery.trim()) {
        params.append('q', searchQuery.trim());
      }
      
      const response = await axiosWithAuth(`/clients?${params}`);
      
      if (Array.isArray(response.data)) {
        // Resposta de busca rápida
        setClients(response.data);
        setPagination(null);
      } else {
        // Resposta com paginação
        setClients(response.data.clients || []);
        setPagination(response.data.pagination);
      }
    } catch (err) {
      setError('Erro ao carregar clientes: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await axiosWithAuth('/clients/stats');
      setStats(response.data);
    } catch (err) {
      console.error('Erro ao carregar estatísticas:', err);
    }
  };

  const handleSearch = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    setPage(1); // Reset para primeira página ao buscar
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      address: '',
      birth_date: '',
      notes: ''
    });
    setEditingClient(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    try {
      if (editingClient) {
        await axiosWithAuth(`/clients/${editingClient.id}`, {
          method: 'PUT',
          data: formData
        });
        setSuccess('Cliente atualizado com sucesso!');
      } else {
        await axiosWithAuth('/clients', {
          method: 'POST',
          data: formData
        });
        setSuccess('Cliente criado com sucesso!');
      }
      
      setShowModal(false);
      resetForm();
      loadClients();
      loadStats();
    } catch (err) {
      setError(err.response?.data?.message || 'Erro ao salvar cliente');
    }
  };

  const handleEdit = (client) => {
    setEditingClient(client);
    setFormData({
      name: client.name || '',
      email: client.email || '',
      phone: client.phone || '',
      address: client.address || '',
      birth_date: client.birth_date ? client.birth_date.split('T')[0] : '',
      notes: client.notes || ''
    });
    setShowModal(true);
  };

  const handleViewDetails = async (client) => {
    try {
      const response = await axiosWithAuth(`/clients/${client.id}`);
      setSelectedClient(response.data);
      setShowDetailsModal(true);
    } catch (err) {
      setError('Erro ao carregar detalhes do cliente: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleDeleteClick = (client) => {
    setClientToDelete(client);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!clientToDelete) return;
    
    setError('');
    try {
      await axiosWithAuth(`/clients/${clientToDelete.id}`, {
        method: 'DELETE'
      });
      setSuccess('Cliente excluído com sucesso!');
      setShowDeleteModal(false);
      setClientToDelete(null);
      loadClients();
      loadStats();
    } catch (err) {
      setError(err.response?.data?.message || 'Erro ao excluir cliente');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  };

  const getStatusBadge = (client) => {
    const daysSinceLastVisit = client.last_visit ? 
      Math.floor((new Date() - new Date(client.last_visit)) / (1000 * 60 * 60 * 24)) : null;
    
    if (!daysSinceLastVisit) {
      return <Badge variant="secondary">Novo</Badge>;
    } else if (daysSinceLastVisit <= 30) {
      return <Badge variant="default">Ativo</Badge>;
    } else if (daysSinceLastVisit <= 90) {
      return <Badge variant="outline">Inativo</Badge>;
    } else {
      return <Badge variant="destructive">Perdido</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Mensagens de erro e sucesso */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
          {success}
        </div>
      )}

      {/* Estatísticas */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-sm text-gray-600">Total de Clientes</p>
                  <p className="text-2xl font-bold">{stats.stats?.total_clients || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm text-gray-600">Novos este Mês</p>
                  <p className="text-2xl font-bold">{stats.stats?.new_clients_month || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <User className="h-5 w-5 text-purple-500" />
                <div>
                  <p className="text-sm text-gray-600">Ativos este Mês</p>
                  <p className="text-2xl font-bold">{stats.stats?.active_clients_month || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Gift className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="text-sm text-gray-600">Aniversários</p>
                  <p className="text-2xl font-bold">{stats.upcoming_birthdays?.length || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Cabeçalho e busca */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold">Gestão de Clientes</h2>
        
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar clientes..."
              value={searchQuery}
              onChange={handleSearch}
              className="pl-10 w-full sm:w-64"
            />
          </div>
          
          <Dialog open={showModal} onOpenChange={setShowModal}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingClient ? 'Editar Cliente' : 'Novo Cliente'}
                </DialogTitle>
              </DialogHeader>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Nome *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                  />
                </div>
                
                <div>
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  />
                </div>
                
                <div>
                  <Label htmlFor="address">Endereço</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                  />
                </div>
                
                <div>
                  <Label htmlFor="birth_date">Data de Nascimento</Label>
                  <Input
                    id="birth_date"
                    type="date"
                    value={formData.birth_date}
                    onChange={(e) => setFormData({...formData, birth_date: e.target.value})}
                  />
                </div>
                
                <div>
                  <Label htmlFor="notes">Observações</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    rows={3}
                  />
                </div>
                
                <div className="flex justify-end space-x-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowModal(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingClient ? 'Atualizar' : 'Criar'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Lista de clientes */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Clientes</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-4">Carregando...</div>
          ) : clients.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchQuery ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
            </div>
          ) : (
            <div className="space-y-2">
              {clients.map((client) => (
                <div key={client.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 overflow-auto">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <div>
                        <h3 className="font-medium">{client.name}</h3>
                        <div className="flex items-center space-x-4 text-sm text-gray-600">
                          {client.phone && (
                            <span className="flex items-center">
                              <Phone className="h-3 w-3 mr-1" />
                              {client.phone}
                            </span>
                          )}
                          {client.email && (
                            <span className="flex items-center">
                              <Mail className="h-3 w-3 mr-1" />
                              {client.email}
                            </span>
                          )}
                          {client.last_visit && (
                            <span className="flex items-center">
                              <Calendar className="h-3 w-3 mr-1" />
                              Última visita: {formatDate(client.last_visit)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {getStatusBadge(client)}
                    
                    {client.upcoming_appointments > 0 && (
                      <Badge variant="outline">
                        {client.upcoming_appointments} agendamento{client.upcoming_appointments > 1 ? 's' : ''}
                      </Badge>
                    )}
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewDetails(client)}
                    >
                      Ver Detalhes
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(client)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteClick(client)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Paginação */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex justify-center items-center space-x-2 mt-4">
              <Button
                variant="outline"
                onClick={() => setPage(page - 1)}
                disabled={page <= 1}
              >
                Anterior
              </Button>
              
              <span className="text-sm">
                Página {pagination.page} de {pagination.totalPages}
              </span>
              
              <Button
                variant="outline"
                onClick={() => setPage(page + 1)}
                disabled={page >= pagination.totalPages}
              >
                Próxima
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de detalhes do cliente */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes do Cliente</DialogTitle>
          </DialogHeader>
          
          {selectedClient && (
            <div className="space-y-6">
              {/* Informações básicas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-gray-900">Informações Pessoais</h4>
                  <div className="mt-2 space-y-2 text-sm">
                    <p><strong>Nome:</strong> {selectedClient.name}</p>
                    {selectedClient.email && <p><strong>Email:</strong> {selectedClient.email}</p>}
                    {selectedClient.phone && <p><strong>Telefone:</strong> {selectedClient.phone}</p>}
                    {selectedClient.address && <p><strong>Endereço:</strong> {selectedClient.address}</p>}
                    {selectedClient.birth_date && (
                      <p><strong>Data de Nascimento:</strong> {formatDate(selectedClient.birth_date)}</p>
                    )}
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-900">Estatísticas</h4>
                  <div className="mt-2 space-y-2 text-sm">
                    <p><strong>Total de Visitas:</strong> {selectedClient.total_visits || 0}</p>
                    <p><strong>Total Gasto:</strong> {formatCurrency(selectedClient.total_spent)}</p>
                    <p><strong>Primeira Visita:</strong> {formatDate(selectedClient.first_visit)}</p>
                    <p><strong>Última Visita:</strong> {formatDate(selectedClient.last_visit)}</p>
                    {selectedClient.average_service_price && (
                      <p><strong>Valor Médio por Serviço:</strong> {formatCurrency(selectedClient.average_service_price)}</p>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Observações */}
              {selectedClient.notes && (
                <div>
                  <h4 className="font-medium text-gray-900">Observações</h4>
                  <p className="mt-2 text-sm text-gray-600">{selectedClient.notes}</p>
                </div>
              )}
              
              {/* Histórico de agendamentos */}
              {selectedClient.recent_appointments && selectedClient.recent_appointments.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900">Agendamentos Recentes</h4>
                  <div className="mt-2 space-y-2">
                    {selectedClient.recent_appointments.map((appointment) => (
                      <div key={appointment.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <div>
                          <p className="text-sm font-medium">{appointment.service_name}</p>
                          <p className="text-xs text-gray-600">
                            {formatDate(appointment.appointment_date)} - {appointment.employee_name}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">{formatCurrency(appointment.price)}</p>
                          <Badge variant={appointment.status === 'completed' ? 'default' : 'outline'}>
                            {appointment.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de confirmação de exclusão */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <p>
              Tem certeza que deseja excluir o cliente <strong>{clientToDelete?.name}</strong>?
            </p>
            <p className="text-sm text-gray-600">
              Esta ação não pode ser desfeita. O cliente só pode ser excluído se não tiver agendamentos associados.
            </p>
            
            <div className="flex justify-end space-x-2">
              <Button 
                variant="outline" 
                onClick={() => setShowDeleteModal(false)}
              >
                Cancelar
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleDeleteConfirm}
              >
                Excluir
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}