import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs"
import { BarChart3, Users, Scissors, Package, Calendar } from "lucide-react"
import Dashboard from "./components/Dashboard"
import ServicesProducts from "./components/ServicesProducts"
import Employees from "./components/Employees"
import Inventory from "./components/Inventory"
import Scheduling from "./components/Scheduling"

export default function BeautySalonSystem() {
  const [activeTab, setActiveTab] = useState("dashboard")

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50">
      <div className="container mx-auto p-4 md:p-6">
        <div className="mb-8">
          <h1 className="text-2xl md:text-4xl font-bold text-gray-900 mb-2">Gerenciamento de Salão de Beleza</h1>
          <p className="text-gray-600">Sistema completo de gestão para o seu salão de beleza</p>
        </div>

        <Tabs defaultValue="dashboard" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="sticky top-0 z-10 bg-gradient-to-br from-pink-50 to-purple-50 pb-2">
            <TabsList className="w-full overflow-x-auto flex gap-2 sm:grid sm:grid-cols-3 lg:grid-cols-5">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="services" className="flex items-center gap-2">
              <Scissors className="h-4 w-4" />
              Serviços
            </TabsTrigger>
            <TabsTrigger value="employees" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Funcionários
            </TabsTrigger>
            <TabsTrigger value="inventory" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Estoque
            </TabsTrigger>
            <TabsTrigger value="scheduling" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Agendamentos
            </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="dashboard">
            <Dashboard />
          </TabsContent>

          <TabsContent value="services">
            <ServicesProducts />
          </TabsContent>

          <TabsContent value="employees">
            <Employees />
          </TabsContent>

          <TabsContent value="inventory">
            <Inventory />
          </TabsContent>

          <TabsContent value="scheduling">
            <Scheduling />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
