import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select } from './ui/select';
import { Textarea } from './ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from './ui/dialog';
import { Alert, AlertDescription } from './ui/alert';
import { Progress } from './ui/progress';
import { axiosWithAuth } from './api/axiosWithAuth';

const CATEGORIES = [
  { value: 'Aluguel', label: 'Aluguel', color: 'bg-blue-500' },
  { value: 'Salários', label: 'Salários', color: 'bg-green-500' },
  { value: 'Produtos', label: 'Produtos', color: 'bg-yellow-500' },
  { value: 'Equipamentos', label: 'Equipamentos', color: 'bg-purple-500' },
  { value: 'Marketing', label: 'Marketing', color: 'bg-red-500' },
  { value: 'Utilidades', label: 'Utilidades', color: 'bg-cyan-500' },
  { value: 'Impostos', label: 'Impostos', color: 'bg-lime-500' },
  { value: 'Manutenção', label: 'Manutenção', color: 'bg-orange-500' },
  { value: 'Transporte', label: 'Transporte', color: 'bg-indigo-500' },
  { value: 'Outros', label: 'Outros', color: 'bg-gray-500' }
];

const PAYMENT_METHODS = [
  { value: 'Dinheiro', label: 'Dinheiro' },
  { value: 'Cartão Débito', label: 'Cartão de Débito' },
  { value: 'Cartão Crédito', label: 'Cartão de Crédito' },
  { value: 'PIX', label: 'PIX' },
  { value: 'Transferência', label: 'Transferência Bancária' },
  { value: 'Boleto', label: 'Boleto' },
  { value: 'Cheque', label: 'Cheque' }
];

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('list');

  // Estados para paginação e filtros
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    category: '',
    start_date: '',
    end_date: '',
    search: ''
  });

  // Estados para formulário de nova despesa
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [newExpense, setNewExpense] = useState({
    category: '',
    description: '',
    amount: '',
    expense_date: new Date().toISOString().split('T')[0],
    payment_method: '',
    receipt_number: '',
    notes: ''
  });

  // Carregar despesas
  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
        ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v))
      });
      
      const response = await axiosWithAuth(`/expenses?${params}`);
      setExpenses(response.data.expenses);
      setTotalPages(response.data.pagination.totalPages);
    } catch (err) {
      setError('Erro ao carregar despesas');
      console.error('Erro ao buscar despesas:', err);
    } finally {
      setLoading(false);
    }
  };

  // Carregar resumo
  const fetchSummary = async () => {
    try {
      const response = await axiosWithAuth('/expenses/summary');
      setSummary(response.data);
    } catch (err) {
      console.error('Erro ao buscar resumo:', err);
    }
  };

  // Carregar analytics
  const fetchAnalytics = async () => {
    try {
      const response = await axiosWithAuth('/expenses/analytics');
      setAnalytics(response.data);
    } catch (err) {
      console.error('Erro ao buscar analytics:', err);
    }
  };

  // Efeitos
  useEffect(() => {
    fetchExpenses();
  }, [currentPage, filters]);

  useEffect(() => {
    if (activeTab === 'analytics') {
      fetchSummary();
      fetchAnalytics();
    }
  }, [activeTab]);

  // Handlers
  const handleAddExpense = async () => {
    try {
      await axiosWithAuth('/expenses', {
        method: 'POST',
        data: {
          ...newExpense,
          amount: parseFloat(newExpense.amount)
        }
      });
      
      setNewExpense({
        category: '',
        description: '',
        amount: '',
        expense_date: new Date().toISOString().split('T')[0],
        payment_method: '',
        receipt_number: '',
        notes: ''
      });
      
      setShowAddDialog(false);
      fetchExpenses();
      if (activeTab === 'analytics') {
        fetchSummary();
        fetchAnalytics();
      }
    } catch (err) {
      setError('Erro ao adicionar despesa');
      console.error('Erro ao criar despesa:', err);
    }
  };

  const handleEditExpense = (expense) => {
    setEditingExpense({
      ...expense,
      expense_date: new Date(expense.expense_date).toISOString().split('T')[0]
    });
    setShowEditDialog(true);
  };

  const handleUpdateExpense = async () => {
    try {
      await axiosWithAuth(`/expenses/${editingExpense.id}`, {
        method: 'PUT',
        data: {
          ...editingExpense,
          amount: parseFloat(editingExpense.amount)
        }
      });
      
      setEditingExpense(null);
      setShowEditDialog(false);
      fetchExpenses();
    } catch (err) {
      setError('Erro ao atualizar despesa');
      console.error('Erro ao atualizar despesa:', err);
    }
  };

  const handleDeleteExpense = async (id) => {
    if (window.confirm('Tem certeza que deseja excluir esta despesa?')) {
      try {
        await axiosWithAuth(`/expenses/${id}`, { method: 'DELETE' });
        fetchExpenses();
      } catch (err) {
        setError('Erro ao excluir despesa');
        console.error('Erro ao excluir despesa:', err);
      }
    }
  };

  const getCategoryColor = (category) => {
    const cat = CATEGORIES.find(c => c.value === category);
    return cat ? cat.color : 'bg-gray-500';
  };

  const formatCurrency = (value) => {
    const n = Number(value || 0);
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(n);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">Controle de Despesas</h2>
        <Button onClick={() => setShowAddDialog(true)}>
          Adicionar Despesa
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="list">Lista de Despesas</TabsTrigger>
          <TabsTrigger value="analytics">Análises</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-6">
          {/* Filtros */}
          <Card>
            <CardHeader>
              <CardTitle>Filtros</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <Label>Categoria</Label>
                  <select
                    className="w-full p-2 border rounded"
                    value={filters.category}
                    onChange={(e) => setFilters({...filters, category: e.target.value})}
                  >
                    <option value="">Todas as categorias</option>
                    {CATEGORIES.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Data Início</Label>
                  <Input
                    type="date"
                    value={filters.start_date}
                    onChange={(e) => setFilters({...filters, start_date: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Data Fim</Label>
                  <Input
                    type="date"
                    value={filters.end_date}
                    onChange={(e) => setFilters({...filters, end_date: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Buscar</Label>
                  <Input
                    placeholder="Descrição ou número do recibo"
                    value={filters.search}
                    onChange={(e) => setFilters({...filters, search: e.target.value})}
                  />
                </div>
              </div>
              <Button 
                className="mt-4"
                onClick={() => {
                  setFilters({category: '', start_date: '', end_date: '', search: ''});
                  setCurrentPage(1);
                }}
              >
                Limpar Filtros
              </Button>
            </CardContent>
          </Card>

          {/* Lista de despesas */}
          <Card>
            <CardHeader>
              <CardTitle>Despesas</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center">Carregando...</div>
              ) : expenses.length === 0 ? (
                <div className="text-center text-gray-500">Nenhuma despesa encontrada</div>
              ) : (
                <div className="space-y-4">
                  {expenses.map(expense => (
                    <div key={expense.id} className="border rounded-lg p-4 flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={`${getCategoryColor(expense.category)} text-white`}>
                            {expense.category}
                          </Badge>
                          <Badge variant="outline">
                            {expense.payment_method}
                          </Badge>
                          {expense.receipt_number && (
                            <Badge variant="outline">
                              #{expense.receipt_number}
                            </Badge>
                          )}
                        </div>
                        <h4 className="font-semibold">{expense.description}</h4>
                        <p className="text-sm text-gray-600">
                          {formatDate(expense.expense_date)} • {formatCurrency(expense.amount)}
                        </p>
                        {expense.notes && (
                          <p className="text-sm text-gray-500 mt-1">{expense.notes}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleEditExpense(expense)}>
                          Editar
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={() => handleDeleteExpense(expense.id)}
                        >
                          Excluir
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Paginação */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-6">
                  <Button 
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(currentPage - 1)}
                  >
                    Anterior
                  </Button>
                  <span>{currentPage} de {totalPages}</span>
                  <Button 
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(currentPage + 1)}
                  >
                    Próximo
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          {/* Resumo */}
          {summary && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{summary.total.total_count}</div>
                  <p className="text-xs text-gray-600">Total de Despesas</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{formatCurrency(summary.total.total_amount)}</div>
                  <p className="text-xs text-gray-600">Valor Total</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">
                    {formatCurrency(analytics?.current_month?.total || 0)}
                  </div>
                  <p className="text-xs text-gray-600">Mês Atual</p>
                  {analytics && (
                    <div className={`text-xs ${analytics.month_growth_percentage >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                      {analytics.month_growth_percentage >= 0 ? '+' : ''}
                      {Number(analytics.month_growth_percentage || 0).toFixed(1)}% vs mês anterior
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">
                    {analytics?.top_expense_this_month ? formatCurrency(analytics.top_expense_this_month.amount) : 'N/A'}
                  </div>
                  <p className="text-xs text-gray-600">Maior Despesa do Mês</p>
                  {analytics?.top_expense_this_month && (
                    <p className="text-xs text-gray-500 truncate">
                      {analytics.top_expense_this_month.description}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Despesas por categoria */}
          {summary?.by_category && (
            <Card>
              <CardHeader>
                <CardTitle>Despesas por Categoria</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {summary.by_category.map(cat => {
                    const total = Number(cat.total_amount || cat.total || 0);
                    const count = Number(cat.count || 0);
                    const avg = count > 0 ? total / count : 0;
                    const totalAll = Number(summary?.total?.total_amount || 0);
                    const progress = totalAll > 0 ? (total / totalAll) * 100 : 0;
                    return (
                    <div key={cat.category}>
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium">{cat.category}</span>
                        <span className="font-bold">{formatCurrency(total)}</span>
                      </div>
                      <Progress value={progress} className="h-2" />
                      <div className="text-xs text-gray-500 mt-1">
                        {count} despesas • Média: {formatCurrency(cat.avg_amount ?? avg)}
                      </div>
                    </div>
                  );})}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Evolução mensal */}
          {summary?.monthly_evolution && (
            <Card>
              <CardHeader>
                <CardTitle>Evolução Mensal (últimos meses)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {summary.monthly_evolution.map(month => (
                    <div key={month.month} className="flex justify-between items-center p-2 border-b">
                      <span>{new Date(month.month).toLocaleDateString('pt-BR', { year: 'numeric', month: 'long' })}</span>
                      <span className="font-bold">{formatCurrency(month.total_amount)}</span>
                      <span className="text-sm text-gray-500">{month.count} despesas</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog para adicionar despesa */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Nova Despesa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Categoria</Label>
              <select
                className="w-full p-2 border rounded"
                value={newExpense.category}
                onChange={(e) => setNewExpense({...newExpense, category: e.target.value})}
              >
                <option value="">Selecione uma categoria</option>
                {CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Descrição</Label>
              <Input
                value={newExpense.description}
                onChange={(e) => setNewExpense({...newExpense, description: e.target.value})}
                placeholder="Descreva a despesa"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newExpense.amount}
                  onChange={(e) => setNewExpense({...newExpense, amount: e.target.value})}
                  placeholder="0,00"
                />
              </div>
              <div>
                <Label>Data</Label>
                <Input
                  type="date"
                  value={newExpense.expense_date}
                  onChange={(e) => setNewExpense({...newExpense, expense_date: e.target.value})}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Método de Pagamento</Label>
                <select
                  className="w-full p-2 border rounded"
                  value={newExpense.payment_method}
                  onChange={(e) => setNewExpense({...newExpense, payment_method: e.target.value})}
                >
                  <option value="">Selecione o método</option>
                  {PAYMENT_METHODS.map(method => (
                    <option key={method.value} value={method.value}>{method.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Número do Recibo (opcional)</Label>
                <Input
                  value={newExpense.receipt_number}
                  onChange={(e) => setNewExpense({...newExpense, receipt_number: e.target.value})}
                  placeholder="000123"
                />
              </div>
            </div>
            <div>
              <Label>Observações (opcional)</Label>
              <Textarea
                value={newExpense.notes}
                onChange={(e) => setNewExpense({...newExpense, notes: e.target.value})}
                placeholder="Informações adicionais sobre a despesa"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddExpense}>
              Adicionar Despesa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para editar despesa */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Despesa</DialogTitle>
          </DialogHeader>
          {editingExpense && (
            <div className="space-y-4">
              <div>
                <Label>Categoria</Label>
                <select
                  className="w-full p-2 border rounded"
                  value={editingExpense.category}
                  onChange={(e) => setEditingExpense({...editingExpense, category: e.target.value})}
                >
                  <option value="">Selecione uma categoria</option>
                  {CATEGORIES.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Descrição</Label>
                <Input
                  value={editingExpense.description}
                  onChange={(e) => setEditingExpense({...editingExpense, description: e.target.value})}
                  placeholder="Descreva a despesa"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Valor (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editingExpense.amount}
                    onChange={(e) => setEditingExpense({...editingExpense, amount: e.target.value})}
                    placeholder="0,00"
                  />
                </div>
                <div>
                  <Label>Data</Label>
                  <Input
                    type="date"
                    value={editingExpense.expense_date}
                    onChange={(e) => setEditingExpense({...editingExpense, expense_date: e.target.value})}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Método de Pagamento</Label>
                  <select
                    className="w-full p-2 border rounded"
                    value={editingExpense.payment_method}
                    onChange={(e) => setEditingExpense({...editingExpense, payment_method: e.target.value})}
                  >
                    <option value="">Selecione o método</option>
                    {PAYMENT_METHODS.map(method => (
                      <option key={method.value} value={method.value}>{method.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Número do Recibo (opcional)</Label>
                  <Input
                    value={editingExpense.receipt_number || ''}
                    onChange={(e) => setEditingExpense({...editingExpense, receipt_number: e.target.value})}
                    placeholder="000123"
                  />
                </div>
              </div>
              <div>
                <Label>Observações (opcional)</Label>
                <Textarea
                  value={editingExpense.notes || ''}
                  onChange={(e) => setEditingExpense({...editingExpense, notes: e.target.value})}
                  placeholder="Informações adicionais sobre a despesa"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateExpense}>
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}