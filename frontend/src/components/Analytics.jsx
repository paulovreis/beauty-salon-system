import React, { useState, useEffect, useRef } from 'react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { 
  TrendingUp, TrendingDown, Users, Calendar, DollarSign, 
  Package, AlertTriangle, Download, RefreshCw, Star,
  Clock, Target, Zap, Award, Activity
} from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { axiosWithAuth } from './api/axiosWithAuth';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

// Componente de métricas principais
const MetricCard = ({ title, value, change, changeType, icon: Icon, color = "blue" }) => {
  const colorClasses = {
    blue: "bg-blue-50 text-blue-600 border-blue-200",
    green: "bg-green-50 text-green-600 border-green-200",
    yellow: "bg-yellow-50 text-yellow-600 border-yellow-200",
    red: "bg-red-50 text-red-600 border-red-200",
    purple: "bg-purple-50 text-purple-600 border-purple-200"
  };

  return (
    <Card className={`${colorClasses[color]} border-2`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium opacity-70">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {change && (
              <div className={`flex items-center mt-2 text-sm ${
                changeType === 'positive' ? 'text-green-600' : 
                changeType === 'negative' ? 'text-red-600' : 'text-gray-500'
              }`}>
                {changeType === 'positive' ? <TrendingUp className="w-4 h-4 mr-1" /> : 
                 changeType === 'negative' ? <TrendingDown className="w-4 h-4 mr-1" /> : null}
                {change}
              </div>
            )}
          </div>
          <Icon className="w-8 h-8 opacity-50" />
        </div>
      </CardContent>
    </Card>
  );
};

// Componente para gráficos de área
const AreaChartComponent = ({ data, dataKey, title, color = "#8884d8" }) => (
  <Card>
    <CardHeader>
      <CardTitle>{title}</CardTitle>
    </CardHeader>
    <CardContent>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip formatter={(value) => [`R$ ${Number(value).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, title]} />
          <Area type="monotone" dataKey={dataKey} stroke={color} fill={color} fillOpacity={0.3} />
        </AreaChart>
      </ResponsiveContainer>
    </CardContent>
  </Card>
);

// Componente para gráficos de barras
const BarChartComponent = ({ data, dataKey, title, color = "#8884d8" }) => (
  <Card>
    <CardHeader>
      <CardTitle>{title}</CardTitle>
    </CardHeader>
    <CardContent>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="category" />
          <YAxis />
          <Tooltip formatter={(value) => [`R$ ${Number(value).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, title]} />
          <Bar dataKey={dataKey} fill={color} />
        </BarChart>
      </ResponsiveContainer>
    </CardContent>
  </Card>
);

// Componente para gráficos de pizza
const PieChartComponent = ({ data, title }) => (
  <Card>
    <CardHeader>
      <CardTitle>{title}</CardTitle>
    </CardHeader>
    <CardContent>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => [`R$ ${Number(value).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, 'Valor']} />
        </PieChart>
      </ResponsiveContainer>
    </CardContent>
  </Card>
);

// Componente principal do Analytics
export default function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const analyticsRef = useRef();

  // Buscar dados do dashboard
  const fetchAnalyticsData = async () => {
    setLoading(true);
    try {
      const [
        stats,
        revenueAnalysis,
        customerAnalysis,
        serviceAnalysis,
        employeeAnalysis,
        inventoryAnalysis,
        financialAnalysis,
        predictiveAnalysis
      ] = await Promise.all([
        axiosWithAuth('/dashboard/stats'),
        axiosWithAuth('/dashboard/revenue-analysis'),
        axiosWithAuth('/dashboard/customer-analysis'),
        axiosWithAuth('/dashboard/service-analysis'),
        axiosWithAuth('/dashboard/employee-analysis'),
        axiosWithAuth('/dashboard/inventory-analysis'),
        axiosWithAuth('/dashboard/financial-analysis'),
        axiosWithAuth('/dashboard/predictive-analysis')
      ]);

      setData({
        stats: stats.data,
        revenue: revenueAnalysis.data,
        customers: customerAnalysis.data,
        services: serviceAnalysis.data,
        employees: employeeAnalysis.data,
        inventory: inventoryAnalysis.data,
        financial: financialAnalysis.data,
        predictive: predictiveAnalysis.data
      });
    } catch (err) {
      setError('Erro ao carregar dados de análise');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  // Função para gerar PDF
  const generatePDF = async () => {
    if (!analyticsRef.current) return;

    try {
      const canvas = await html2canvas(analyticsRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      // Adicionar título
      pdf.setFontSize(20);
      pdf.text('Relatório Analítico do Salão', 20, 20);
      
      // Adicionar data
      pdf.setFontSize(12);
      pdf.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 20, 30);

      position = 40;
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`relatorio-analise-salao-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert('Erro ao gerar PDF. Tente novamente.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-2 text-lg">Carregando análises...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-red-500">
        <AlertTriangle className="w-8 h-8 mr-2" />
        <span className="text-lg">{error}</span>
      </div>
    );
  }

  if (!data) return null;

  // Preparar dados para os gráficos
  const monthlyRevenueData = data.revenue.monthlyRevenue.map(item => ({
    month: item.month,
    revenue: Number(item.revenue || 0),
    appointments: Number(item.appointments_count || 0)
  }));

  const categoryRevenueData = data.revenue.revenueByCategory.map(item => ({
    category: item.category || 'Sem categoria',
    revenue: Number(item.revenue || 0),
    appointments: Number(item.appointments_count || 0)
  }));

  const employeeRevenueData = data.revenue.revenueByEmployee.map(item => ({
    employee: item.employee,
    revenue: Number(item.revenue || 0),
    appointments: Number(item.appointments_count || 0)
  }));

  const customerSegmentData = data.customers.customerSegments.map(item => ({
    name: item.segment,
    value: Number(item.count || 0),
    avgSpent: Number(item.avg_spent || 0)
  }));

  const weeklyPerformanceData = data.services.weeklyPerformance.map(item => ({
    day: item.day_name?.trim(),
    appointments: Number(item.appointments_count || 0),
    revenue: Number(item.revenue || 0)
  }));

  const hourlyPerformanceData = data.services.hourlyPerformance.map(item => ({
    hour: `${item.hour}:00`,
    appointments: Number(item.appointments_count || 0),
    revenue: Number(item.revenue || 0)
  }));

  const monthlyFinancialData = data.financial.monthlyFinancials.map(item => ({
    month: item.month,
    revenue: Number(item.total_revenue || 0),
    expenses: Number(item.total_expenses || 0),
    profit: Number(item.net_profit || 0)
  }));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" ref={analyticsRef}>
      {/* Header com ações */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard Analítico</h1>
          <p className="text-gray-600 mt-1">Análise completa de performance e insights estratégicos</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchAnalyticsData} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
          <Button onClick={generatePDF} className="bg-blue-600 hover:bg-blue-700">
            <Download className="w-4 h-4 mr-2" />
            Gerar PDF
          </Button>
        </div>
      </div>

      {/* Métricas principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          title="Receita Total"
          value={`R$ ${data.stats.totalRevenue.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`}
          change={`R$ ${data.stats.monthlyStats.monthlyRevenue.toLocaleString('pt-BR', {minimumFractionDigits: 2})} este mês`}
          changeType="positive"
          icon={DollarSign}
          color="green"
        />
        <MetricCard
          title="Total de Clientes"
          value={data.stats.totalClients.toLocaleString()}
          change={`${data.stats.monthlyStats.newClients} novos este mês`}
          changeType="positive"
          icon={Users}
          color="blue"
        />
        <MetricCard
          title="Agendamentos"
          value={data.stats.totalAppointments.toLocaleString()}
          change={`${data.stats.monthlyStats.completedAppointments} concluídos este mês`}
          changeType="positive"
          icon={Calendar}
          color="purple"
        />
        <MetricCard
          title="Funcionários Ativos"
          value={data.stats.totalEmployees.toLocaleString()}
          icon={Award}
          color="yellow"
        />
        <MetricCard
          title="Produtos Ativos"
          value={data.stats.totalProducts.toLocaleString()}
          icon={Package}
          color="red"
        />
      </div>

      {/* Tabs para diferentes análises */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="revenue">Receita</TabsTrigger>
          <TabsTrigger value="customers">Clientes</TabsTrigger>
          <TabsTrigger value="services">Serviços</TabsTrigger>
          <TabsTrigger value="employees">Funcionários</TabsTrigger>
          <TabsTrigger value="financial">Financeiro</TabsTrigger>
        </TabsList>

        {/* Tab: Visão Geral */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AreaChartComponent
              data={monthlyRevenueData}
              dataKey="revenue"
              title="Evolução da Receita (12 meses)"
              color="#10B981"
            />
            <BarChartComponent
              data={weeklyPerformanceData}
              dataKey="revenue"
              title="Performance por Dia da Semana"
              color="#3B82F6"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <PieChartComponent
              data={customerSegmentData}
              title="Segmentação de Clientes"
            />
            <Card>
              <CardHeader>
                <CardTitle>Top Funcionários por Receita</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {employeeRevenueData.slice(0, 5).map((employee, index) => (
                    <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <span className="font-medium">{employee.employee}</span>
                      <Badge variant="secondary">
                        R$ {employee.revenue.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Alertas de Estoque</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.inventory.stockStatus
                    .filter(item => item.stock_status !== 'Normal')
                    .slice(0, 5)
                    .map((item, index) => (
                    <div key={index} className="flex justify-between items-center p-2 rounded">
                      <span className="text-sm">{item.name}</span>
                      <Badge variant={
                        item.stock_status === 'Sem Estoque' ? 'destructive' :
                        item.stock_status === 'Estoque Baixo' ? 'default' : 'secondary'
                      }>
                        {item.stock_status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab: Receita */}
        <TabsContent value="revenue" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AreaChartComponent
              data={monthlyRevenueData}
              dataKey="revenue"
              title="Receita Mensal"
              color="#10B981"
            />
            <BarChartComponent
              data={categoryRevenueData}
              dataKey="revenue"
              title="Receita por Categoria de Serviço"
              color="#F59E0B"
            />
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Receita por Funcionário</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={employeeRevenueData.slice(0, 8)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="employee" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip formatter={(value) => [`R$ ${Number(value).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, 'Receita']} />
                    <Bar dataKey="revenue" fill="#8B5CF6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Performance por Horário</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={hourlyPerformanceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <Tooltip formatter={(value) => [value, 'Agendamentos']} />
                    <Line type="monotone" dataKey="appointments" stroke="#EF4444" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab: Clientes */}
        <TabsContent value="customers" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PieChartComponent
              data={customerSegmentData}
              title="Segmentação de Clientes"
            />
            <Card>
              <CardHeader>
                <CardTitle>Taxa de Retenção</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Ativos (30 dias)</span>
                    <Badge variant="default">
                      {((data.customers.retentionAnalysis.active_last_30 / data.customers.retentionAnalysis.total_customers) * 100).toFixed(1)}%
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Moderadamente Ativos (60 dias)</span>
                    <Badge variant="secondary">
                      {((data.customers.retentionAnalysis.active_last_60 / data.customers.retentionAnalysis.total_customers) * 100).toFixed(1)}%
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Pouco Ativos (90 dias)</span>
                    <Badge variant="outline">
                      {((data.customers.retentionAnalysis.active_last_90 / data.customers.retentionAnalysis.total_customers) * 100).toFixed(1)}%
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Top Clientes por Gasto</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.customers.topCustomers.slice(0, 10).map((customer, index) => (
                    <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <div>
                        <p className="font-medium">{customer.name}</p>
                        <p className="text-sm text-gray-500">{customer.total_visits} visitas</p>
                      </div>
                      <Badge variant={customer.status === 'Ativo' ? 'default' : 'secondary'}>
                        R$ {Number(customer.total_spent || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Clientes em Risco de Abandono</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.predictive.churnRisk.slice(0, 10).map((customer, index) => (
                    <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <div>
                        <p className="font-medium">{customer.name}</p>
                        <p className="text-sm text-gray-500">{customer.days_since_last_visit} dias sem visita</p>
                      </div>
                      <Badge variant={
                        customer.churn_risk === 'Alto Risco' ? 'destructive' :
                        customer.churn_risk === 'Médio Risco' ? 'default' : 'secondary'
                      }>
                        {customer.churn_risk}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab: Serviços */}
        <TabsContent value="services" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Serviços Mais Populares</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.services.popularServices.slice(0, 8).map((service, index) => (
                    <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <div>
                        <p className="font-medium">{service.name}</p>
                        <p className="text-sm text-gray-500">{service.category}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant="default">{service.bookings_count || 0} agendamentos</Badge>
                        <p className="text-sm text-gray-600 mt-1">
                          R$ {Number(service.total_revenue || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Taxa de Cancelamento por Serviço</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.services.cancellationRates
                    .filter(service => service.total > 0)
                    .slice(0, 8)
                    .map((service, index) => (
                    <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <span className="font-medium">{service.service}</span>
                      <Badge variant={
                        service.cancellation_rate > 20 ? 'destructive' :
                        service.cancellation_rate > 10 ? 'default' : 'secondary'
                      }>
                        {service.cancellation_rate || 0}%
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Performance por Dia da Semana</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={weeklyPerformanceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip formatter={(value, name) => [
                      name === 'appointments' ? value : `R$ ${Number(value).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, 
                      name === 'appointments' ? 'Agendamentos' : 'Receita'
                    ]} />
                    <Bar dataKey="appointments" fill="#3B82F6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Performance por Horário</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={hourlyPerformanceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <Tooltip formatter={(value) => [value, 'Agendamentos']} />
                    <Line type="monotone" dataKey="appointments" stroke="#10B981" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab: Funcionários */}
        <TabsContent value="employees" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Performance dos Funcionários</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.employees.employeePerformance.map((employee, index) => (
                    <div key={index} className="p-3 bg-gray-50 rounded">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium">{employee.name}</h4>
                        <Badge variant="default">
                          {employee.completion_rate || 0}% conclusão
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600">Agendamentos: {employee.total_appointments || 0}</p>
                          <p className="text-gray-600">Concluídos: {employee.completed_appointments || 0}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">
                            Receita: R$ {Number(employee.revenue_generated || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                          </p>
                          <p className="text-gray-600">
                            Comissão: R$ {Number(employee.total_commission || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Especialidades Mais Rentáveis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.employees.employeeSpecialties
                    .filter(specialty => specialty.commission_earned > 0)
                    .slice(0, 10)
                    .map((specialty, index) => (
                    <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <div>
                        <p className="font-medium">{specialty.employee}</p>
                        <p className="text-sm text-gray-500">{specialty.service}</p>
                      </div>
                      <Badge variant="secondary">
                        R$ {Number(specialty.commission_earned || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab: Financeiro */}
        <TabsContent value="financial" className="space-y-6">
          <div className="grid grid-cols-1 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Análise Financeira Mensal</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={monthlyFinancialData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`R$ ${Number(value).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, '']} />
                    <Legend />
                    <Line type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={2} name="Receita" />
                    <Line type="monotone" dataKey="expenses" stroke="#EF4444" strokeWidth={2} name="Despesas" />
                    <Line type="monotone" dataKey="profit" stroke="#3B82F6" strokeWidth={2} name="Lucro Líquido" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Métodos de Pagamento</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.financial.paymentMethods.map((method, index) => (
                    <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <span className="font-medium">{method.payment_method}</span>
                      <div className="text-right">
                        <Badge variant="default">{method.transaction_count} transações</Badge>
                        <p className="text-sm text-gray-600 mt-1">
                          R$ {Number(method.total_amount || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Comissões dos Funcionários</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.financial.commissionsAnalysis.map((commission, index) => (
                    <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <div>
                        <p className="font-medium">{commission.employee}</p>
                        <p className="text-sm text-gray-500">
                          {commission.commission_count} comissões - Média: {Number(commission.avg_commission_rate || 0).toFixed(1)}%
                        </p>
                      </div>
                      <Badge variant="secondary">
                        R$ {Number(commission.total_commissions || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}