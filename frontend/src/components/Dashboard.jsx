import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Badge } from "./ui/badge"
import { Progress } from "./ui/progress"
import { DollarSign, TrendingUp, Package, AlertTriangle, Scissors } from "lucide-react"

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000"

// Função global de fetchWithAuth (deve estar disponível no projeto)
async function fetchWithAuth(url, options = {}) {
  let token = localStorage.getItem("token")
  if (!token) throw new Error("Usuário não autenticado")
  let response = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`
    }
  })
  if (response.status === 403 || response.status === 401) {
    // Não faça reload automático aqui! Apenas lance erro para o App controlar o fluxo.
    throw new Error("Sessão expirada ou acesso negado")
  }
  return response
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [recent, setRecent] = useState([])
  const [topEmployees, setTopEmployees] = useState([])
  const [revenue, setRevenue] = useState(null)
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      setError("")
      try {
        const [statsRes, recentRes, topRes, revenueRes, expenseRes] = await Promise.all([
          fetchWithAuth(`${API_URL}/dashboard/stats`),
          fetchWithAuth(`${API_URL}/dashboard/recent-appointments`),
          fetchWithAuth(`${API_URL}/dashboard/top-employees`),
          fetchWithAuth(`${API_URL}/dashboard/revenue-summary`),
          fetchWithAuth(`${API_URL}/dashboard/expense-breakdown`)
        ])
        setStats(await statsRes.json())
        setRecent(await recentRes.json())
        setTopEmployees(await topRes.json())
        setRevenue(await revenueRes.json())
        setExpenses(await expenseRes.json())
      } catch (err) {
        // Se for erro de permissão, mostre mensagem clara
        if (err.message && err.message.toLowerCase().includes("acesso negado")) {
          setError("Você não tem permissão para acessar o dashboard.")
        } else if (err.message && err.message.toLowerCase().includes("sessão expirada")) {
          setError("Sessão expirada. Faça login novamente.")
        } else {
          setError("Erro ao carregar dados do dashboard.")
        }
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) return <div className="p-8 text-center">Carregando dashboard...</div>
  if (error) return <div className="p-8 text-center text-red-600">{error}</div>

  // Exemplo de cálculo de valores para exibir
  const monthlyStats = stats ? {
    revenue: revenue?.totalAppointmentsRevenue + revenue?.totalSalesRevenue,
    profit: (revenue?.totalAppointmentsRevenue + revenue?.totalSalesRevenue) - expenses.reduce((acc, e) => acc + Number(e.total), 0),
    profitMargin: revenue && expenses.length ? Math.round(100 * ((revenue.totalAppointmentsRevenue + revenue.totalSalesRevenue - expenses.reduce((acc, e) => acc + Number(e.total), 0)) / (revenue.totalAppointmentsRevenue + revenue.totalSalesRevenue || 1))) : 0,
    servicesCompleted: stats.totalAppointments,
    newClients: 0, // Pode ser implementado no backend
    inventoryValue: 0, // Pode ser implementado no backend
    lowStockItems: 0 // Pode ser implementado no backend
  } : {}

  return (
    <div className="space-y-6">
      {/* Métricas principais */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R${monthlyStats.revenue?.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">
              <TrendingUp className="inline h-3 w-3 mr-1" />
              Receita de serviços e vendas
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lucro Estimado</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R${monthlyStats.profit?.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">{monthlyStats.profitMargin || 0}% margem de lucro</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Serviços completos</CardTitle>
            <Scissors className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{monthlyStats.servicesCompleted || 0}</div>
            <p className="text-xs text-muted-foreground">+{monthlyStats.newClients || 0} novos clientes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor do estoque</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R${monthlyStats.inventoryValue?.toLocaleString() || 0}</div>
            <p className="text-xs text-red-600">
              <AlertTriangle className="inline h-3 w-3 mr-1" />
              {monthlyStats.lowStockItems || 0} itens com estoque baixo
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Serviços recentes */}
        <Card>
          <CardHeader>
            <CardTitle>Serviços recentes</CardTitle>
            <CardDescription>Últimos agendamentos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recent.length === 0 ? (
                <div className="text-center text-muted-foreground">Nenhum serviço recente encontrado.</div>
              ) : (
                recent.map((service) => (
                  <div key={service.id} className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{service.service_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {service.client_name} • {service.employee_name} • {service.appointment_time}
                      </p>
                    </div>
                    <Badge variant="secondary">{service.status}</Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Melhores funcionários */}
        <Card>
          <CardHeader>
            <CardTitle>Melhores funcionários</CardTitle>
            <CardDescription>Ranking por número de serviços</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topEmployees.length === 0 ? (
                <div className="text-center text-muted-foreground">Nenhum funcionário encontrado.</div>
              ) : (
                topEmployees.map((employee, index) => (
                  <div key={employee.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">#{index + 1}</Badge>
                        <span className="font-medium">{employee.name}</span>
                      </div>
                      <span className="text-sm font-medium">{employee.total_appointments} serviços</span>
                    </div>
                    <Progress value={employee.total_appointments * 2} className="h-2" />
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detalhamento de despesas */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhamento mensal de despesas</CardTitle>
          <CardDescription>Visão detalhada dos custos operacionais</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {expenses.length === 0 ? (
              <div className="text-center text-muted-foreground col-span-3">Nenhuma despesa encontrada.</div>
            ) : (
              expenses.map((item) => (
                <div key={item.category} className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">{item.category}</span>
                    <span className="text-sm font-medium">R${Number(item.total).toLocaleString()}</span>
                  </div>
                  <Progress value={Number(item.total)} className="h-2" />
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
