import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Badge } from './ui/badge';
import { 
  MessageCircle, 
  Plus, 
  RefreshCw, 
  QrCode, 
  Send, 
  Users, 
  Trash2 
} from 'lucide-react';
import { useAlert } from '../hooks/useAlert';
import { AlertDisplay } from './AlertDisplay';

// Configuração da API da Evolution - EvolutionAPI 2.3.6
const EVOLUTION_API_URL = process.env.REACT_APP_EVOLUTION_API_URL || 'http://localhost:8080';
const EVOLUTION_API_KEY = process.env.REACT_APP_EVOLUTION_API_KEY;

// Cliente axios para Evolution API
const evolutionApi = {
  async request(endpoint, options = {}) {
    const url = `${EVOLUTION_API_URL}${endpoint}`;
    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY,
        ...options.headers
      }
    };
    
    try {
      const response = await fetch(url, config);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || `HTTP ${response.status}`);
      }
      
      return data;
    } catch (error) {
      console.error('Evolution API Error:', error);
      throw error;
    }
  },

  // Métodos específicos da API
  async createInstance(instanceName) {
    return this.request('/instance/create', {
      method: 'POST',
      body: JSON.stringify({
        instanceName,
        token: EVOLUTION_API_KEY,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS'
      })
    });
  },

  async getInstances() {
    return this.request('/instance/fetchInstances');
  },

  async getInstanceInfo(instanceName) {
    return this.request(`/instance/connectionState/${instanceName}`);
  },

  async deleteInstance(instanceName) {
    return this.request(`/instance/delete/${instanceName}`, {
      method: 'DELETE'
    });
  },

  async getQRCode(instanceName) {
    return this.request(`/instance/connect/${instanceName}`);
  },

  async sendMessage(instanceName, number, message) {
    return this.request(`/message/sendText/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify({
        number: number.replace(/\D/g, ''), // Remove caracteres não numéricos
        text: message
      })
    });
  },

  async getChats(instanceName) {
    return this.request(`/chat/findChats/${instanceName}`);
  },

  async getContacts(instanceName) {
    return this.request(`/chat/findContacts/${instanceName}`);
  }
};

export default function WhatsApp() {
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(false);
  const { alert, showSuccess, showError, clearAlert } = useAlert();
  
  // Estados para criação de instância
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newInstanceName, setNewInstanceName] = useState('');
  
  // Estados para QR Code
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrCodeData, setQrCodeData] = useState(null);
  const [selectedInstance, setSelectedInstance] = useState(null);
  
  // Estados para mensagens
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageData, setMessageData] = useState({
    instanceName: '',
    number: '',
    message: ''
  });
  
  // Estados para contatos e chats
  const [contacts, setContacts] = useState([]);
  const [chats, setChats] = useState([]);
  const [showContactsModal, setShowContactsModal] = useState(false);

  useEffect(() => {
    loadInstances();
  }, []);

  const loadInstances = async () => {
    setLoading(true);
    clearAlert();
    try {
      console.log('Tentando conectar com Evolution API...');
      console.log('URL:', EVOLUTION_API_URL);
      console.log('API Key:', EVOLUTION_API_KEY);
      
      const response = await evolutionApi.getInstances();
      console.log('Resposta da API:', response);
      // Normaliza resposta para evitar instanceName undefined
      const rawList = Array.isArray(response)
        ? response
        : (Array.isArray(response?.instances) ? response.instances : []);

      const normalized = rawList.map((it) => {
        const name = it.instanceName || it.instance || it.name || it?.connection?.instance || it?.config?.instanceName;
        const status = (it.status || it.state || it.connectionStatus || it?.connection?.status || it?.connection?.state || '').toString();
        const profileName = it.profileName || it.pushName || it?.profile?.name || it?.user?.name || '';
        return {
          name,
          status,
          profileName,
          _raw: it
        };
      }).filter(it => !!it.name);

      setInstances(normalized);
    } catch (err) {
      console.error('Erro detalhado:', err);
      showError('Erro ao carregar instâncias: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInstance = async (e) => {
    e.preventDefault();
    if (!newInstanceName.trim()) {
      showError('Nome da instância é obrigatório');
      return;
    }

    setLoading(true);
    clearAlert();
    try {
      await evolutionApi.createInstance(newInstanceName.trim());
      showSuccess('Instância criada com sucesso!');
      setShowCreateModal(false);
      setNewInstanceName('');
      loadInstances();
    } catch (err) {
      showError('Erro ao criar instância: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteInstance = async (instanceName) => {
    if (!window.confirm(`Tem certeza que deseja excluir a instância "${instanceName}"?`)) {
      return;
    }

    setLoading(true);
    clearAlert();
    try {
      await evolutionApi.deleteInstance(instanceName);
      showSuccess('Instância excluída com sucesso!');
      loadInstances();
    } catch (err) {
      showError('Erro ao excluir instância: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectInstance = async (instanceName) => {
    setLoading(true);
    clearAlert();
    try {
      const response = await evolutionApi.getQRCode(instanceName);
      setQrCodeData(response);
      setSelectedInstance(instanceName);
      setShowQRModal(true);
      showSuccess('QR Code gerado com sucesso!');
    } catch (err) {
      showError('Erro ao obter QR Code: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageData.instanceName || !messageData.number || !messageData.message) {
      showError('Todos os campos são obrigatórios para enviar mensagem');
      return;
    }

    setLoading(true);
    clearAlert();
    try {
      await evolutionApi.sendMessage(
        messageData.instanceName,
        messageData.number,
        messageData.message
      );
      showSuccess('Mensagem enviada com sucesso!');
      setShowMessageModal(false);
      setMessageData({ instanceName: '', number: '', message: '' });
    } catch (err) {
      showError('Erro ao enviar mensagem: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleViewContacts = async (instanceName) => {
    setLoading(true);
    clearAlert();
    try {
      const [contactsResponse, chatsResponse] = await Promise.all([
        evolutionApi.getContacts(instanceName),
        evolutionApi.getChats(instanceName)
      ]);
      
      setContacts(contactsResponse || []);
      setChats(chatsResponse || []);
      setSelectedInstance(instanceName);
      setShowContactsModal(true);
      showSuccess('Contatos carregados com sucesso!');
    } catch (err) {
      showError('Erro ao carregar contatos: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status?.toLowerCase()) {
      case 'open':
      case 'connected':
        return <Badge className="bg-green-100 text-green-800">Conectado</Badge>;
      case 'connecting':
        return <Badge className="bg-yellow-100 text-yellow-800">Conectando</Badge>;
      case 'close':
      case 'disconnected':
        return <Badge className="bg-red-100 text-red-800">Desconectado</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">Status desconhecido</Badge>;
    }
  };

  const formatPhoneNumber = (number) => {
    if (!number) return '';
    const cleaned = number.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    }
    return number;
  };

  return (
    <div className="space-y-6">
      <AlertDisplay alert={alert} onClose={clearAlert} />

      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">WhatsApp Business</h2>
          <p className="text-gray-600">Gerencie suas instâncias do WhatsApp</p>
        </div>
        
        <div className="flex gap-2">
          <Button onClick={loadInstances} variant="outline" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          
          <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Instância
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Nova Instância</DialogTitle>
              </DialogHeader>
              
              <form onSubmit={handleCreateInstance} className="space-y-4">
                <div>
                  <Label htmlFor="instanceName">Nome da Instância</Label>
                  <Input
                    id="instanceName"
                    value={newInstanceName}
                    onChange={(e) => setNewInstanceName(e.target.value)}
                    placeholder="Ex: salao-principal"
                    required
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Use apenas letras, números e hífens. Sem espaços.
                  </p>
                </div>
                
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? 'Criando...' : 'Criar'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Lista de instâncias */}
      <Card>
        <CardHeader>
          <CardTitle>Instâncias WhatsApp</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && instances.length === 0 ? (
            <div className="text-center py-4">Carregando...</div>
          ) : instances.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <MessageCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>Nenhuma instância WhatsApp encontrada</p>
              <p className="text-sm">Crie sua primeira instância para começar</p>
            </div>
          ) : (
            <div className="space-y-4">
              {instances.map((instance) => (
                <div key={instance.name} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <MessageCircle className="h-5 w-5 text-green-600" />
                      <div>
                        <h3 className="font-medium">{instance.name}</h3>
                        <div className="flex items-center space-x-2 mt-1">
                          {getStatusBadge(instance.status)}
                          {instance.profileName && (
                            <span className="text-sm text-gray-600">
                              {instance.profileName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {/* <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewContacts(instance.name)}
                      title="Ver contatos"
                    >
                      <Users className="h-4 w-4" />
                    </Button> */}
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setMessageData({
                          ...messageData,
                          instanceName: instance.name
                        });
                        setShowMessageModal(true);
                      }}
                      title="Enviar mensagem"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleConnectInstance(instance.name)}
                      title="Conectar/QR Code"
                    >
                      <QrCode className="h-4 w-4" />
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteInstance(instance.name)}
                      className="text-red-600 hover:text-red-800"
                      title="Excluir instância"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal QR Code */}
      <Dialog open={showQRModal} onOpenChange={setShowQRModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conectar WhatsApp - {selectedInstance}</DialogTitle>
          </DialogHeader>
          
          <div className="text-center space-y-4">
            {qrCodeData?.base64 ? (
              <div>
                <img 
                  src={qrCodeData.base64} 
                  alt="QR Code WhatsApp" 
                  className="mx-auto border rounded"
                />
                <p className="text-sm text-gray-600 mt-2">
                  Escaneie este QR Code com o WhatsApp do seu celular
                </p>
              </div>
            ) : (
              <div className="py-8">
                <QrCode className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">Gerando QR Code...</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Enviar Mensagem */}
      <Dialog open={showMessageModal} onOpenChange={setShowMessageModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar Mensagem</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSendMessage} className="space-y-4">
            <div>
              <Label htmlFor="messageInstance">Instância</Label>
              <Input
                id="messageInstance"
                value={messageData.instanceName}
                onChange={(e) => setMessageData({...messageData, instanceName: e.target.value})}
                placeholder="Nome da instância"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="messageNumber">Número do WhatsApp</Label>
              <Input
                id="messageNumber"
                value={messageData.number}
                onChange={(e) => setMessageData({...messageData, number: e.target.value})}
                placeholder="5511999999999"
                required
              />
              <p className="text-sm text-gray-500 mt-1">
                Formato: código do país + DDD + número (sem espaços)
              </p>
            </div>
            
            <div>
              <Label htmlFor="message">Mensagem</Label>
              <Textarea
                id="message"
                value={messageData.message}
                onChange={(e) => setMessageData({...messageData, message: e.target.value})}
                placeholder="Digite sua mensagem..."
                rows={4}
                required
              />
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setShowMessageModal(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Enviando...' : 'Enviar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Contatos */}
      <Dialog open={showContactsModal} onOpenChange={setShowContactsModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Contatos - {selectedInstance}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-2" style={{maxHeight: '400px', overflowY: 'auto'}}>
            {contacts.length === 0 ? (
              <p className="text-center text-gray-500 py-4">Nenhum contato encontrado</p>
            ) : (
              contacts.map((contact, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <p className="font-medium">{contact.pushName || contact.name || 'Sem nome'}</p>
                    <p className="text-sm text-gray-600">{formatPhoneNumber(contact.id)}</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      setMessageData({
                        instanceName: selectedInstance,
                        number: contact.id,
                        message: ''
                      });
                      setShowContactsModal(false);
                      setShowMessageModal(true);
                    }}
                  >
                    <Send className="h-3 w-3 mr-1" />
                    Mensagem
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}