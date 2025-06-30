import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Badge } from "./ui/badge"
import { Progress } from "./ui/progress"
import { DollarSign, TrendingUp, Package, AlertTriangle, Scissors } from "lucide-react"

export default function Dashboard() {
  const monthlyStats = {
    revenue: 15420,
    expenses: 8750,
    profit: 6670,
    profitMargin: 43.2,
    servicesCompleted: 156,
    newClients: 23,
    inventoryValue: 12500,
    lowStockItems: 8,
  }

  const recentServices = [
    { id: 1, service: "Hair Coloring", client: "Maria Silva", employee: "Ana Costa", amount: 180, time: "14:30" },
    { id: 2, service: "Progressive", client: "Julia Santos", employee: "Carla Lima", amount: 250, time: "13:00" },
    { id: 3, service: "Haircut", client: "Pedro Oliveira", employee: "Ana Costa", amount: 45, time: "12:15" },
    { id: 4, service: "Manicure", client: "Lucia Ferreira", employee: "Beatriz Souza", amount: 35, time: "11:30" },
  ]

  const topEmployees = [
    { name: "Ana Costa", services: 45, revenue: 3200, commission: 640 },
    { name: "Carla Lima", services: 38, revenue: 2850, commission: 570 },
    { name: "Beatriz Souza", services: 42, revenue: 2100, commission: 420 },
  ]

  return (
    <div className="space-y-6">
      {/* Métricas principais */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Mensal</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R${monthlyStats.revenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              <TrendingUp className="inline h-3 w-3 mr-1" />
              +12,5% em comparação ao mês passado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lucro Mensal</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R${monthlyStats.profit.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{monthlyStats.profitMargin}% margem de lucro</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Serviços completos</CardTitle>
            <Scissors className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{monthlyStats.servicesCompleted}</div>
            <p className="text-xs text-muted-foreground">+{monthlyStats.newClients} novos clientes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor do estoque</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R${monthlyStats.inventoryValue.toLocaleString()}</div>
            <p className="text-xs text-red-600">
              <AlertTriangle className="inline h-3 w-3 mr-1" />
              {monthlyStats.lowStockItems} itens com estoque baixo
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Serviços recentes */}
        <Card>
          <CardHeader>
            <CardTitle>Serviços recentes</CardTitle>
            <CardDescription>Últimos serviços realizados hoje</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentServices.map((service) => (
                <div key={service.id} className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{service.service}</p>
                    <p className="text-xs text-muted-foreground">
                      {service.client} • {service.employee} • {service.time}
                    </p>
                  </div>
                  <Badge variant="secondary">R${service.amount}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Melhores funcionários */}
        <Card>
          <CardHeader>
            <CardTitle>Melhores funcionários do mês</CardTitle>
            <CardDescription>Ranking de desempenho por receita gerada</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topEmployees.map((employee, index) => (
                <div key={employee.name} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">#{index + 1}</Badge>
                      <span className="font-medium">{employee.name}</span>
                    </div>
                    <span className="text-sm font-medium">R${employee.revenue}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{employee.services} serviços</span>
                    <span>Comissão: R${employee.commission}</span>
                  </div>
                  <Progress value={(employee.revenue / 3500) * 100} className="h-2" />
                </div>
              ))}
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
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Salários dos funcionários</span>
                <span className="text-sm font-medium">R$4.200</span>
              </div>
              <Progress value={48} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Custos de produtos</span>
                <span className="text-sm font-medium">R$2.800</span>
              </div>
              <Progress value={32} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Água, luz e aluguel</span>
                <span className="text-sm font-medium">R$1.750</span>
              </div>
              <Progress value={20} className="h-2" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
