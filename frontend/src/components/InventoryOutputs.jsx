import React, { useState, useEffect } from 'react';
import { axiosWithAuth } from './api/axiosWithAuth';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';

export default function InventoryOutputs() {
  const [outputs, setOutputs] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  
  // Filtros
  const [filters, setFilters] = useState({
    product_id: '',
    output_type: '',
    start_date: '',
    end_date: ''
  });

  // Modal de criação/edição
  const [showModal, setShowModal] = useState(false);
  const [editingOutput, setEditingOutput] = useState(null);
  const [formData, setFormData] = useState({
    product_id: '',
    quantity: '',
    output_type: 'other',
    reason: '',
    notes: ''
  });

  // Carregar produtos ao montar componente
  useEffect(() => {
    loadProducts();
    loadOutputs();
  }, [page, filters]);

  const loadProducts = async () => {
    try {
      const response = await axiosWithAuth('/products');
      // A resposta pode ser um array direto ou um objeto com propriedades
      const productsData = Array.isArray(response.data) 
        ? response.data 
        : (response.data.products || []);
      setProducts(productsData);
    } catch (err) {
      console.error('Erro ao carregar produtos:', err);
      setProducts([]);
    }
  };

  const loadOutputs = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, v]) => v !== '')
        )
      });

      const response = await axiosWithAuth(`/inventory/outputs?${params}`);
      setOutputs(response.data.outputs);
      setPagination(response.data.pagination);
    } catch (err) {
      setError('Erro ao carregar saídas: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOutput = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const response = await axiosWithAuth('/inventory/outputs', {
        method: 'post',
        data: {
          ...formData,
          quantity: parseInt(formData.quantity)
        }
      });

      setSuccess('Saída registrada com sucesso!');
      setShowModal(false);
      resetForm();
      loadOutputs();
    } catch (err) {
      const message = err.response?.data?.message || err.message;
      setError('Erro ao registrar saída: ' + message);
    }
  };

  const handleUpdateOutput = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      await axiosWithAuth(`/inventory/outputs/${editingOutput.id}`, {
        method: 'put',
        data: {
          quantity: parseInt(formData.quantity),
          output_type: formData.output_type,
          reason: formData.reason,
          notes: formData.notes
        }
      });

      setSuccess('Saída atualizada com sucesso!');
      setShowModal(false);
      setEditingOutput(null);
      resetForm();
      loadOutputs();
    } catch (err) {
      const message = err.response?.data?.message || err.message;
      setError('Erro ao atualizar saída: ' + message);
    }
  };

  const handleDeleteOutput = async (id) => {
    if (!window.confirm('Deseja realmente deletar esta saída? O estoque será revertido.')) {
      return;
    }

    try {
      const response = await axiosWithAuth(`/inventory/outputs/${id}`, {
        method: 'delete'
      });
      
      setSuccess(`Saída deletada! ${response.data.quantity_restored} unidades revertidas ao estoque.`);
      loadOutputs();
    } catch (err) {
      const message = err.response?.data?.message || err.message;
      setError('Erro ao deletar saída: ' + message);
    }
  };

  const openEditModal = (output) => {
    setEditingOutput(output);
    setFormData({
      product_id: output.product_id.toString(),
      quantity: output.quantity.toString(),
      output_type: output.output_type || 'other',
      reason: output.reason || '',
      notes: output.notes || ''
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      product_id: '',
      quantity: '',
      output_type: 'other',
      reason: '',
      notes: ''
    });
    setEditingOutput(null);
  };

  const getOutputTypeLabel = (type) => {
    const types = {
      sale: 'Venda',
      loss: 'Perda',
      damage: 'Dano',
      expired: 'Vencido',
      transfer: 'Transferência',
      sample: 'Amostra',
      other: 'Outro'
    };
    return types[type] || type;
  };

  const getOutputTypeBadgeColor = (type) => {
    const colors = {
      sale: 'bg-green-500',
      loss: 'bg-red-500',
      damage: 'bg-orange-500',
      expired: 'bg-purple-500',
      transfer: 'bg-blue-500',
      sample: 'bg-yellow-500',
      other: 'bg-gray-500'
    };
    return colors[type] || 'bg-gray-500';
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Saídas de Inventário</h1>
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Registrar Nova Saída
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
          {success}
        </div>
      )}

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Produto</Label>
              <select
                value={filters.product_id}
                onChange={(e) => setFilters({ ...filters, product_id: e.target.value })}
                className="w-full p-2 border rounded-md"
              >
                <option value="">Todos</option>
                {Array.isArray(products) && products.map(product => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label>Tipo de Saída</Label>
              <select
                value={filters.output_type}
                onChange={(e) => setFilters({ ...filters, output_type: e.target.value })}
                className="w-full p-2 border rounded-md"
              >
                <option value="">Todos</option>
                <option value="sale">Venda</option>
                <option value="loss">Perda</option>
                <option value="damage">Dano</option>
                <option value="expired">Vencido</option>
                <option value="transfer">Transferência</option>
                <option value="sample">Amostra</option>
                <option value="other">Outro</option>
              </select>
            </div>

            <div>
              <Label>Data Inicial</Label>
              <Input
                type="date"
                value={filters.start_date}
                onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
              />
            </div>

            <div>
              <Label>Data Final</Label>
              <Input
                type="date"
                value={filters.end_date}
                onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
              />
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={loadOutputs}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Aplicar Filtros
            </button>
            <button
              onClick={() => {
                setFilters({ product_id: '', output_type: '', start_date: '', end_date: '' });
                setPage(1);
              }}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Limpar
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Saídas */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Saídas</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p>Carregando...</p>
          ) : outputs.length === 0 ? (
            <p className="text-gray-500">Nenhuma saída encontrada</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">ID</th>
                    <th className="text-left p-2">Produto</th>
                    <th className="text-left p-2">Quantidade</th>
                    <th className="text-left p-2">Tipo</th>
                    <th className="text-left p-2">Motivo</th>
                    <th className="text-left p-2">Registrado por</th>
                    <th className="text-left p-2">Data</th>
                    <th className="text-left p-2">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {outputs.map(output => (
                    <tr key={output.id} className="border-b hover:bg-gray-50">
                      <td className="p-2">{output.id}</td>
                      <td className="p-2">
                        <div>
                          <div className="font-medium">{output.product_name}</div>
                          <div className="text-sm text-gray-500">{output.product_sku}</div>
                        </div>
                      </td>
                      <td className="p-2">{output.quantity}</td>
                      <td className="p-2">
                        <Badge className={getOutputTypeBadgeColor(output.output_type)}>
                          {getOutputTypeLabel(output.output_type)}
                        </Badge>
                      </td>
                      <td className="p-2 max-w-xs truncate">{output.reason || '-'}</td>
                      <td className="p-2">{output.registered_by_email || '-'}</td>
                      <td className="p-2">
                        {new Date(output.created_at).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="p-2">
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEditModal(output)}
                            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleDeleteOutput(output.id)}
                            className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                          >
                            Deletar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Paginação */}
          {pagination && (
            <div className="mt-4 flex justify-between items-center">
              <p className="text-sm text-gray-600">
                Mostrando {outputs.length} de {pagination.totalItems} registros
              </p>
              <div className="flex gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Anterior
                </button>
                <span className="px-4 py-2">
                  Página {pagination.currentPage} de {pagination.totalPages}
                </span>
                <button
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage(page + 1)}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Criação/Edição */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">
              {editingOutput ? 'Editar Saída' : 'Registrar Nova Saída'}
            </h2>

            <form onSubmit={editingOutput ? handleUpdateOutput : handleCreateOutput}>
              <div className="space-y-4">
                {!editingOutput && (
                  <div>
                    <Label>Produto *</Label>
                    <select
                      value={formData.product_id}
                      onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
                      required
                      className="w-full p-2 border rounded-md"
                    >
                      <option value="">Selecione um produto</option>
                      {Array.isArray(products) && products.map(product => (
                        <option key={product.id} value={product.id}>
                          {product.name} (Estoque: {product.current_stock})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <Label>Quantidade *</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label>Tipo de Saída</Label>
                  <select
                    value={formData.output_type}
                    onChange={(e) => setFormData({ ...formData, output_type: e.target.value })}
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="sale">Venda</option>
                    <option value="loss">Perda</option>
                    <option value="damage">Dano</option>
                    <option value="expired">Vencido</option>
                    <option value="transfer">Transferência</option>
                    <option value="sample">Amostra</option>
                    <option value="other">Outro</option>
                  </select>
                </div>

                <div>
                  <Label>Motivo</Label>
                  <Input
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    placeholder="Ex: Venda para cliente João"
                  />
                </div>

                <div>
                  <Label>Observações</Label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Informações adicionais..."
                    rows={3}
                    className="w-full p-2 border rounded-md"
                  />
                </div>
              </div>

              <div className="mt-6 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setEditingOutput(null); resetForm(); }}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  {editingOutput ? 'Atualizar' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
