import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Badge } from "./ui/badge"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "./ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { Alert, AlertDescription } from "./ui/alert"
import { Progress } from "./ui/progress"
import { Plus, Package, AlertTriangle, TrendingDown, Calendar, Edit } from "lucide-react"

export default function Inventory() {
  const [inventory, setInventory] = useState([
    {
      id: 1,
      name: "Tintura de Cabelo - Loiro",
      category: "Produtos para Cabelo",
      currentStock: 5,
      minStock: 10,
      maxStock: 50,
      cost: 25,
      sellingPrice: 45,
      supplier: "Beauty Supply Co.",
      lastRestocked: "2024-01-15",
      lastSold: "2024-01-28",
      daysSinceLastSale: 3,
      monthlyUsage: 12,
      status: "baixo_estoque",
    },
    {
      id: 2,
      name: "Esmalte - Vermelho",
      category: "Produtos para Unhas",
      currentStock: 25,
      minStock: 15,
      maxStock: 40,
      cost: 8,
      sellingPrice: 18,
      supplier: "Nail Pro Ltd.",
      lastRestocked: "2024-01-20",
      lastSold: "2024-01-30",
      daysSinceLastSale: 1,
      monthlyUsage: 8,
      status: "em_estoque",
    },
    {
      id: 3,
      name: "Tratamento de Queratina",
      category: "Produtos para Cabelo",
      currentStock: 3,
      minStock: 5,
      maxStock: 20,
      cost: 45,
      sellingPrice: 85,
      supplier: "Professional Hair Co.",
      lastRestocked: "2024-01-10",
      lastSold: "2024-01-15",
      daysSinceLastSale: 16,
      monthlyUsage: 4,
      status: "pouca_saida",
    },
    {
      id: 4,
      name: "Shampoo - Profissional",
      category: "Produtos para Cabelo",
      currentStock: 0,
      minStock: 8,
      maxStock: 30,
      cost: 15,
      sellingPrice: 35,
      supplier: "Hair Care Plus",
      lastRestocked: "2024-01-05",
      lastSold: "2024-01-29",
      daysSinceLastSale: 2,
      monthlyUsage: 15,
      status: "fora_de_estoque",
    },
  ])

  const [newItem, setNewItem] = useState({
    name: "",
    category: "",
    currentStock: "",
    minStock: "",
    maxStock: "",
    cost: "",
    sellingPrice: "",
    supplier: "",
  })

  const getStatusColor = (status) => {
    switch (status) {
      case "in_stock":
        return "default"
      case "low_stock":
        return "secondary"
      case "out_of_stock":
        return "destructive"
      case "slow_moving":
        return "outline"
      default:
        return "default"
    }
  }

  const getStatusText = (status) => {
    switch (status) {
      case "in_stock":
        return "Em Estoque"
      case "low_stock":
        return "Baixo Estoque"
      case "out_of_stock":
        return "Fora de Estoque"
      case "slow_moving":
        return "Pouca Saída"
      default:
        return "Desconhecido"
    }
  }

  const getPromotionSuggestion = (item) => {
    if (item.daysSinceLastSale > 30) {
      return { type: "clearance", discount: 30, reason: "Sem vendas há mais de 30 dias" }
    } else if (item.daysSinceLastSale > 14 && item.currentStock > item.minStock * 2) {
      return { type: "promotion", discount: 20, reason: "Pouca saída com estoque alto" }
    } else if (item.status === "slow_moving") {
      return { type: "bundle", discount: 15, reason: "Agrupar com itens populares" }
    }
    return null
  }

  const handleAddItem = () => {
    if (newItem.name && newItem.currentStock && newItem.minStock) {
      const currentStock = Number.parseInt(newItem.currentStock)
      const minStock = Number.parseInt(newItem.minStock)

      let status = "in_stock"
      if (currentStock === 0) status = "out_of_stock"
      else if (currentStock <= minStock) status = "low_stock"

      const item = {
        id: inventory.length + 1,
        ...newItem,
        currentStock,
        minStock: Number.parseInt(newItem.minStock),
        maxStock: Number.parseInt(newItem.maxStock),
        cost: Number.parseFloat(newItem.cost),
        sellingPrice: Number.parseFloat(newItem.sellingPrice),
        lastRestocked: new Date().toISOString().split("T")[0],
        lastSold: "",
        daysSinceLastSale: 0,
        monthlyUsage: 0,
        status,
      }

      setInventory([...inventory, item])
      setNewItem({
        name: "",
        category: "",
        currentStock: "",
        minStock: "",
        maxStock: "",
        cost: "",
        sellingPrice: "",
        supplier: "",
      })
    }
  }

  const lowStockItems = inventory.filter((item) => item.status === "baixo_estoque" || item.status === "fora_de_estoque")
  const slowMovingItems = inventory.filter((item) => item.daysSinceLastSale > 14)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold">Controle de Estoque</h2>
          <p className="text-muted-foreground">Acompanhe os níveis de estoque e identifique oportunidades de promoção</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Item
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Adicionar Item ao Estoque</DialogTitle>
              <DialogDescription>Adicione um novo produto ao seu estoque</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="itemName">Nome do Produto</Label>
                <Input
                  id="itemName"
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  placeholder="Tintura de Cabelo - Loiro"
                />
              </div>
              <div>
                <Label htmlFor="itemCategory">Categoria</Label>
                <Select value={newItem.category} onValueChange={(value) => setNewItem({ ...newItem, category: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Hair Products">Produtos para Cabelo</SelectItem>
                    <SelectItem value="Nail Products">Produtos para Unhas</SelectItem>
                    <SelectItem value="Skin Care">Cuidados com a Pele</SelectItem>
                    <SelectItem value="Tools">Ferramentas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label htmlFor="currentStock">Atual</Label>
                  <Input
                    id="currentStock"
                    type="number"
                    value={newItem.currentStock}
                    onChange={(e) => setNewItem({ ...newItem, currentStock: e.target.value })}
                    placeholder="25"
                  />
                </div>
                <div>
                  <Label htmlFor="minStock">Mín</Label>
                  <Input
                    id="minStock"
                    type="number"
                    value={newItem.minStock}
                    onChange={(e) => setNewItem({ ...newItem, minStock: e.target.value })}
                    placeholder="10"
                  />
                </div>
                <div>
                  <Label htmlFor="maxStock">Máx</Label>
                  <Input
                    id="maxStock"
                    type="number"
                    value={newItem.maxStock}
                    onChange={(e) => setNewItem({ ...newItem, maxStock: e.target.value })}
                    placeholder="50"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="cost">Custo (R$)</Label>
                  <Input
                    id="cost"
                    type="number"
                    value={newItem.cost}
                    onChange={(e) => setNewItem({ ...newItem, cost: e.target.value })}
                    placeholder="25.00"
                  />
                </div>
                <div>
                  <Label htmlFor="sellingPrice">Preço de Venda (R$)</Label>
                  <Input
                    id="sellingPrice"
                    type="number"
                    value={newItem.sellingPrice}
                    onChange={(e) => setNewItem({ ...newItem, sellingPrice: e.target.value })}
                    placeholder="45.00"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="supplier">Fornecedor</Label>
                <Input
                  id="supplier"
                  value={newItem.supplier}
                  onChange={(e) => setNewItem({ ...newItem, supplier: e.target.value })}
                  placeholder="Beauty Supply Co."
                />
              </div>
              <Button onClick={handleAddItem} className="w-full">
                Adicionar Item
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Alerts */}
      {lowStockItems.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>{lowStockItems.length} itens</strong> precisam ser reabastecidos. Verifique o estoque abaixo para mais detalhes.
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Itens</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inventory.length}</div>
            <p className="text-xs text-muted-foreground">
              Em {new Set(inventory.map((item) => item.category)).size} categorias
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Itens com Baixo Estoque</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{lowStockItems.length}</div>
            <p className="text-xs text-muted-foreground">Precisam de atenção imediata</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pouca Saída</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{slowMovingItems.length}</div>
            <p className="text-xs text-muted-foreground">Considere promoções</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor do Estoque</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$
              {inventory.reduce((sum, item) => sum + item.currentStock * item.cost, 0).toLocaleString("pt-BR")}
            </div>
            <p className="text-xs text-muted-foreground">Valor total de custo</p>
          </CardContent>
        </Card>
      </div>

      {/* Inventory List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {inventory.map((item) => {
          const promotion = getPromotionSuggestion(item)
          const stockPercentage = (item.currentStock / item.maxStock) * 100

          return (
            <Card key={item.id} className={item.status === "out_of_stock" ? "border-red-200" : ""}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{item.name}</CardTitle>
                    <CardDescription>{item.category}</CardDescription>
                  </div>
                  <Badge variant={getStatusColor(item.status)}>{getStatusText(item.status)}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Nível de Estoque</span>
                    <span>
                      {item.currentStock} / {item.maxStock}
                    </span>
                  </div>
                  <Progress value={stockPercentage} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>Mín: {item.minStock}</span>
                    <span>Máx: {item.maxStock}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Custo:</span>
                    <p className="font-medium">R$ {item.cost}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Venda:</span>
                    <p className="font-medium">R$ {item.sellingPrice}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Última Venda:</span>
                    <p className="font-medium">{item.daysSinceLastSale}d atrás</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Uso Mensal:</span>
                    <p className="font-medium">{item.monthlyUsage}</p>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  <p>Fornecedor: {item.supplier}</p>
                  <p>Último Reabastecimento: {item.lastRestocked}</p>
                </div>

                {promotion && (
                  <Alert className="border-blue-200 bg-blue-50">
                    <Calendar className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      <strong>Sugestão de Promoção:</strong> {promotion.discount}% de desconto - {promotion.reason}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1 bg-transparent">
                    <Edit className="h-3 w-3 mr-1" />
                    Editar
                  </Button>
                  <Button variant="outline" size="sm">
                    <Package className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Promotion Recommendations */}
      {slowMovingItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recomendações de Promoção</CardTitle>
            <CardDescription>Itens que podem se beneficiar de preços promocionais</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {slowMovingItems.map((item) => {
                const promotion = getPromotionSuggestion(item)
                if (!promotion) return null

                return (
                  <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">{promotion.reason}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-green-600">{promotion.discount}% OFF</p>
                      <p className="text-sm text-muted-foreground">
                        R$ {item.sellingPrice} → R$ {(item.sellingPrice * (1 - promotion.discount / 100)).toFixed(2)}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
