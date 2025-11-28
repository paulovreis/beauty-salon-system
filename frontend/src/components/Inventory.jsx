import { useState, useEffect } from "react"
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
import { Plus, Package, AlertTriangle, TrendingDown, Calendar, Edit, Trash2 } from "lucide-react"
import { axiosWithAuth } from "./api/axiosWithAuth";

export default function Inventory() {
  const [inventory, setInventory] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingItem, setEditingItem] = useState(null)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [itemToDelete, setItemToDelete] = useState(null)
  const [showRestockDialog, setShowRestockDialog] = useState(false)
  const [restockItem, setRestockItem] = useState(null)
  const [restockQuantity, setRestockQuantity] = useState(1)
  const [restockNotes, setRestockNotes] = useState("")
  const [restockLoading, setRestockLoading] = useState(false)

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      // Buscar produtos via inventoryController
      const inventoryRes = await axiosWithAuth("/inventory");
      const categoriesRes = await axiosWithAuth("/products/categories");

      setCategories(Array.isArray(categoriesRes.data) ? categoriesRes.data : []);

      // Mapeia os produtos do inventoryController para o formato do inventory
      // O inventoryController retorna { products: [...], pagination: {...} }
      const inventoryData = inventoryRes.data?.products || [];
      const productsData = Array.isArray(inventoryData) ? inventoryData : [];
      const mapped = productsData.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category_name || "",
        currentStock: item.current_stock || 0,
        minStock: item.min_stock_level || 0,
        maxStock: item.max_stock_level || 0,
        cost: item.cost_price || 0,
        sellingPrice: item.selling_price || 0,
        supplier: item.supplier_name || "",
        sku: item.sku || "",
        description: item.description || "",
        lastRestocked: item.last_restocked,
        lastSold: item.last_sold,
        daysSinceLastSale: item.days_since_last_sale || 0,
        monthlyUsage: item.monthly_usage || 0,
        status: (() => {
          if ((item.current_stock || 0) === 0) return 'out_of_stock'
          if ((item.current_stock || 0) <= (item.min_stock_level || 0)) return 'low_stock'
          return 'in_stock'
        })(),
      }))

      setInventory(mapped);
    } catch (err) {
      console.error('Erro ao carregar inventário', err);
      setError('Não foi possível carregar o inventário');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [])

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

  const [newItem, setNewItem] = useState({
    name: "",
    category_id: "",
    currentStock: "",
    minStock: "",
    maxStock: "",
    cost: "",
    sellingPrice: "",
    supplier: "",
    sku: "",
    description: "",
  })

  const handleAddItem = async () => {
    // Validação mais específica
    if (!newItem.name.trim()) {
      setError("Nome do produto é obrigatório");
      return;
    }
    
    if (!newItem.category_id) {
      setError("Categoria é obrigatória");
      return;
    }
    
    if (!newItem.cost || Number(newItem.cost) <= 0) {
      setError("Custo deve ser um valor positivo");
      return;
    }
    
    if (!newItem.sellingPrice || Number(newItem.sellingPrice) <= 0) {
      setError("Preço de venda deve ser um valor positivo");
      return;
    }

    try {
      // Usar os mesmos campos do productController
      const payload = {
        name: newItem.name.trim(),
        category_id: Number(newItem.category_id),
        current_stock: Number(newItem.currentStock) || 0,
        min_stock_level: Number(newItem.minStock) || 0,
        max_stock_level: Number(newItem.maxStock) || 0,
        cost_price: Number(newItem.cost),
        selling_price: Number(newItem.sellingPrice),
      };

      // Só adicionar campos opcionais se não estiverem vazios
      if (newItem.supplier && newItem.supplier.trim()) {
        payload.supplier_name = newItem.supplier.trim();
      }
      
      if (newItem.sku && newItem.sku.trim()) {
        payload.sku = newItem.sku.trim();
      }
      
      if (newItem.description && newItem.description.trim()) {
        payload.description = newItem.description.trim();
      }
      
      console.log("Payload enviado:", payload);
      
      const res = await axiosWithAuth("/products", {
        method: "post",
        data: payload,
      });
        
      // Atualiza inventário local com o novo produto salvo
      const item = res.data;
      const categoryName = categories.find(c => c.id === item.category_id)?.name || "";
      
      setInventory((prev) => [
        ...prev,
        {
          id: item.id,
          name: item.name,
          category: categoryName,
          currentStock: item.current_stock || 0,
          minStock: item.min_stock_level || 0,
          maxStock: item.max_stock_level || 0,
          cost: item.cost_price || 0,
          sellingPrice: item.selling_price || 0,
          supplier: item.supplier_name || "",
          sku: item.sku || "",
          description: item.description || "",
          lastRestocked: item.last_restocked,
          lastSold: item.last_sold,
          daysSinceLastSale: item.days_since_last_sale || 0,
          monthlyUsage: item.monthly_usage || 0,
          status: item.current_stock === 0 ? 'out_of_stock' : item.current_stock <= item.min_stock_level ? 'low_stock' : 'in_stock',
        },
      ]);
      
      // Limpar formulário
      setNewItem({
        name: "",
        category_id: "",
        currentStock: "",
        minStock: "",
        maxStock: "",
        cost: "",
        sellingPrice: "",
        supplier: "",
        sku: "",
        description: "",
      });
    } catch (err) {
      console.error("Erro detalhado:", err);
      const errorMsg = err.response?.data?.message || err.response?.data?.error || err.message || "Erro desconhecido";
      setError("Erro ao adicionar produto: " + errorMsg);
    }
  }

  const handleEditItem = (item) => {
    setEditingItem({
      id: item.id,
      name: item.name,
      category_id: categories.find(c => c.name === item.category)?.id || "",
      currentStock: item.currentStock.toString(),
      minStock: item.minStock.toString(),
      maxStock: item.maxStock.toString(),
      cost: item.cost.toString(),
      sellingPrice: item.sellingPrice.toString(),
      supplier: item.supplier || "",
      sku: item.sku || "",
      description: item.description || "",
    })
    setShowEditDialog(true)
  }

  const handleSaveEdit = async () => {
    if (!editingItem.name || !editingItem.category_id || !editingItem.cost || !editingItem.sellingPrice) {
      setError("Preencha todos os campos obrigatórios")
      return
    }

    try {
      const payload = {
        name: editingItem.name.trim(),
        category_id: Number(editingItem.category_id),
        current_stock: Number(editingItem.currentStock) || 0,
        min_stock_level: Number(editingItem.minStock) || 0,
        max_stock_level: Number(editingItem.maxStock) || 0,
        cost_price: Number(editingItem.cost),
        selling_price: Number(editingItem.sellingPrice),
      }

      if (editingItem.supplier && editingItem.supplier.trim()) {
        payload.supplier_name = editingItem.supplier.trim()
      }
      
      if (editingItem.sku && editingItem.sku.trim()) {
        payload.sku = editingItem.sku.trim()
      }
      
      if (editingItem.description && editingItem.description.trim()) {
        payload.description = editingItem.description.trim()
      }

      const res = await axiosWithAuth(`/products/${editingItem.id}`, {
        method: "put",
        data: payload,
      })

      // Atualizar o item no inventário local
      const updatedItem = res.data
      const categoryName = categories.find(c => c.id === updatedItem.category_id)?.name || ""
      
      setInventory(prev => prev.map(item => 
        item.id === editingItem.id 
          ? {
              id: updatedItem.id,
              name: updatedItem.name,
              category: categoryName,
              currentStock: updatedItem.current_stock || 0,
              minStock: updatedItem.min_stock_level || 0,
              maxStock: updatedItem.max_stock_level || 0,
              cost: updatedItem.cost_price || 0,
              sellingPrice: updatedItem.selling_price || 0,
              supplier: updatedItem.supplier_name || "",
              sku: updatedItem.sku || "",
              description: updatedItem.description || "",
              lastRestocked: updatedItem.last_restocked,
              lastSold: updatedItem.last_sold,
              daysSinceLastSale: updatedItem.days_since_last_sale || 0,
              monthlyUsage: updatedItem.monthly_usage || 0,
              status: updatedItem.current_stock === 0 ? 'out_of_stock' : updatedItem.current_stock <= updatedItem.min_stock_level ? 'low_stock' : 'in_stock',
            }
          : item
      ))

      setShowEditDialog(false)
      setEditingItem(null)
    } catch (err) {
      console.error("Erro ao editar produto:", err)
      const errorMsg = err.response?.data?.message || err.response?.data?.error || err.message || "Erro desconhecido"
      setError("Erro ao editar produto: " + errorMsg)
    }
  }

  const handleDeleteItem = (item) => {
    setItemToDelete(item)
    setShowDeleteDialog(true)
  }

  const confirmDelete = async () => {
    if (!itemToDelete) return

    try {
      await axiosWithAuth(`/products/${itemToDelete.id}`, {
        method: "delete",
      })

      setInventory(prev => prev.filter(item => item.id !== itemToDelete.id))
      setShowDeleteDialog(false)
      setItemToDelete(null)
    } catch (err) {
      console.error("Erro ao excluir produto:", err)
      const errorMsg = err.response?.data?.message || err.response?.data?.error || err.message || "Erro desconhecido"
      setError("Erro ao excluir produto: " + errorMsg)
    }
  }

  const handleOpenRestock = (item) => {
    setRestockItem(item)
    setRestockQuantity(1)
    setRestockNotes("")
    setShowRestockDialog(true)
  }

  const handleConfirmRestock = async () => {
    if (!restockItem || restockQuantity <= 0) {
      setError("Quantidade deve ser maior que zero")
      return
    }

    setRestockLoading(true)
    try {
      await axiosWithAuth(`/inventory/${restockItem.id}/restock`, {
        method: "post",
        data: {
          quantity: Number(restockQuantity),
          notes: restockNotes.trim() || undefined,
        },
      })

      // Reload list after successful restock
      await loadData()
      setShowRestockDialog(false)
      setRestockItem(null)
    } catch (err) {
      console.error("Erro ao reabastecer produto:", err)
      const errorMsg = err.response?.data?.message || err.response?.data?.error || err.message || "Erro desconhecido"
      setError("Erro ao reabastecer produto: " + errorMsg)
    } finally {
      setRestockLoading(false)
    }
  }

  const lowStockItems = inventory.filter((item) => item.status === "low_stock" || item.status === "out_of_stock")
  const slowMovingItems = inventory.filter((item) => item.daysSinceLastSale > 14)

  const maskLastRestocked = (dateStr) => {
    if (!dateStr) return "Nunca"
    const date = new Date(dateStr)
    return date.toLocaleDateString()
  }

  return (
    <div className="space-y-6">
      {loading && (
        <Alert>
          <AlertDescription>Carregando dados do estoque...</AlertDescription>
        </Alert>
      )}
      
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

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
                <Select value={newItem.category_id} onValueChange={(value) => setNewItem({ ...newItem, category_id: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id.toString()}>
                        {category.name}
                      </SelectItem>
                    ))}
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
                    step="0.01"
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
                    step="0.01"
                    value={newItem.sellingPrice}
                    onChange={(e) => setNewItem({ ...newItem, sellingPrice: e.target.value })}
                    placeholder="45.00"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="sku">SKU (Opcional)</Label>
                  <Input
                    id="sku"
                    value={newItem.sku}
                    onChange={(e) => setNewItem({ ...newItem, sku: e.target.value })}
                    placeholder="SKU123"
                  />
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
              </div>
              <div>
                <Label htmlFor="description">Descrição (Opcional)</Label>
                <Input
                  id="description"
                  value={newItem.description}
                  onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                  placeholder="Descrição do produto"
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
              {inventory
                .reduce((sum, item) => {
                  const cost = Number(item.cost);
                  const qty = Number(item.currentStock);
                  if (isNaN(cost) || isNaN(qty)) return sum;
                  return sum + qty * cost;
                }, 0)
                .toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">Valor total de custo</p>
          </CardContent>
        </Card>
      </div>

      {/* Inventory List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {inventory.map((item) => {
          const promotion = getPromotionSuggestion(item)
          const max = Number(item.maxStock) || 0;
          const stockPercentage = max > 0 ? (Number(item.currentStock) / max) * 100 : 0

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
                  <p>Último Reabastecimento: {maskLastRestocked(item.lastRestocked)}</p>
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
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => handleOpenRestock(item)}>
                    <Package className="h-3 w-3 mr-1" />
                    Reabastecer
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 bg-transparent" onClick={() => handleEditItem(item)}>
                    <Edit className="h-3 w-3 mr-1" />
                    Editar
                  </Button>
                  <Button variant="outline" size="sm" className="bg-red-500 hover:bg-red-600 transition ease-in-out" onClick={() => handleDeleteItem(item)}>
                    <Trash2 className="h-3 w-3 text-white" />
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

      {/* Dialog de Edição */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Produto</DialogTitle>
            <DialogDescription>Edite as informações do produto</DialogDescription>
          </DialogHeader>
          {editingItem && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="editName">Nome do Produto</Label>
                <Input
                  id="editName"
                  value={editingItem.name}
                  onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="editCategory">Categoria</Label>
                <Select value={editingItem.category_id} onValueChange={(value) => setEditingItem({ ...editingItem, category_id: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id.toString()}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label htmlFor="editCurrentStock">Atual</Label>
                  <Input
                    id="editCurrentStock"
                    type="number"
                    value={editingItem.currentStock}
                    onChange={(e) => setEditingItem({ ...editingItem, currentStock: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="editMinStock">Mín</Label>
                  <Input
                    id="editMinStock"
                    type="number"
                    value={editingItem.minStock}
                    onChange={(e) => setEditingItem({ ...editingItem, minStock: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="editMaxStock">Máx</Label>
                  <Input
                    id="editMaxStock"
                    type="number"
                    value={editingItem.maxStock}
                    onChange={(e) => setEditingItem({ ...editingItem, maxStock: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="editCost">Custo (R$)</Label>
                  <Input
                    id="editCost"
                    type="number"
                    step="0.01"
                    value={editingItem.cost}
                    onChange={(e) => setEditingItem({ ...editingItem, cost: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="editSellingPrice">Preço de Venda (R$)</Label>
                  <Input
                    id="editSellingPrice"
                    type="number"
                    step="0.01"
                    value={editingItem.sellingPrice}
                    onChange={(e) => setEditingItem({ ...editingItem, sellingPrice: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="editSku">SKU (Opcional)</Label>
                  <Input
                    id="editSku"
                    value={editingItem.sku}
                    onChange={(e) => setEditingItem({ ...editingItem, sku: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="editSupplier">Fornecedor</Label>
                  <Input
                    id="editSupplier"
                    value={editingItem.supplier}
                    onChange={(e) => setEditingItem({ ...editingItem, supplier: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="editDescription">Descrição (Opcional)</Label>
                <Input
                  id="editDescription"
                  value={editingItem.description}
                  onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveEdit} className="flex-1">
                  Salvar Alterações
                </Button>
                <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Exclusão */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o produto "{itemToDelete?.name}"? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Reabastecimento */}
      <Dialog open={showRestockDialog} onOpenChange={setShowRestockDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reabastecer Produto</DialogTitle>
            <DialogDescription>
              Adicione estoque ao produto "{restockItem?.name}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="restockQuantity">Quantidade</Label>
              <Input
                id="restockQuantity"
                type="number"
                min="1"
                value={restockQuantity}
                onChange={(e) => setRestockQuantity(Number(e.target.value))}
              />
            </div>
            <div>
              <Label htmlFor="restockNotes">Observações (Opcional)</Label>
              <Input
                id="restockNotes"
                value={restockNotes}
                onChange={(e) => setRestockNotes(e.target.value)}
                placeholder="Ex: Nota fiscal 123456"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowRestockDialog(false)} disabled={restockLoading}>
                Cancelar
              </Button>
              <Button onClick={handleConfirmRestock} disabled={restockLoading}>
                {restockLoading ? "Processando..." : "Confirmar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
