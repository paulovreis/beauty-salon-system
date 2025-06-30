import React, { useState } from "react"
import { BarChart3, Users, Scissors, Package, Calendar } from 'lucide-react'
import Dashboard from "./components/Dashboard"
import ServicesProducts from "./components/ServicesProducts"
import Employees from "./components/Employees"
import Inventory from "./components/Inventory"
import Scheduling from "./components/Scheduling"
import "./App.css"

function LoginPage({ onLogin }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")

  const handleSubmit = (e) => {
    e.preventDefault()
    // Aqui será feita a requisição para o backend Node/JWT futuramente
    if (!email || !password) {
      setError("Preencha todos os campos.")
      return
    }
    setError("")
    onLogin()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 to-purple-50">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm">
        <h2 className="text-2xl font-bold mb-6 text-center">Entrar no Sistema</h2>
        <div className="mb-4">
          <label className="block text-gray-700 mb-1" htmlFor="email">E-mail</label>
          <input
            id="email"
            type="email"
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring focus:border-primary"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="username"
          />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700 mb-1" htmlFor="password">Senha</label>
          <input
            id="password"
            type="password"
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring focus:border-primary"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        {error && <div className="text-red-600 text-sm mb-2">{error}</div>}
        <button
          type="submit"
          className="w-full bg-primary text-white py-2 rounded-md font-medium hover:bg-primary/90 transition"
        >
          Entrar
        </button>
      </form>
    </div>
  )
}

function App() {
  const [activeTab, setActiveTab] = useState("dashboard")
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  const navigation = [
    { id: "dashboard", name: "Dashboard", icon: BarChart3, component: Dashboard },
    { id: "services", name: "Serviços", icon: Scissors, component: ServicesProducts },
    { id: "employees", name: "Funcionários", icon: Users, component: Employees },
    { id: "inventory", name: "Estoque", icon: Package, component: Inventory },
    { id: "scheduling", name: "Agendamentos", icon: Calendar, component: Scheduling },
  ]

  if (!isAuthenticated) {
    return <LoginPage onLogin={() => setIsAuthenticated(true)} />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50">
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Salão Fada Madrinha</h1>
          <p className="text-gray-600">Gerenciamento do salão</p>
        </div>

        <div className="space-y-6">
          {/* Abas de Navegação */}
          <div className="flex space-x-1 bg-white p-1 rounded-lg shadow-sm">
            {navigation.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === item.id
                      ? "bg-primary text-primary-foreground"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.name}
                </button>
              )
            })}
          </div>

          {/* Conteúdo */}
          <div>
            {navigation.map((item) => {
              const Component = item.component
              return (
                <div key={item.id} className={activeTab === item.id ? "block" : "hidden"}>
                  <Component />
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
