import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Badge } from "./ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { Textarea } from "./ui/textarea"
import { Plus, Edit, Trash2, Calculator } from "lucide-react"

export default function ServicesProducts() {
  const [services, setServices] = useState([
    {
      id: 1,
      name: "Coloração de Cabelo",
      category: "Cabelo",
      baseCost: 45,
      recommendedPrice: 180,
      profitMargin: 75,
      duration: 120,
      description: "Serviço profissional de coloração de cabelo",
    },
    {
      id: 2,
      name: "Tratamento Progressiva",
      category: "Cabelo",
      baseCost: 80,
      recommendedPrice: 250,
      profitMargin: 68,
      duration: 180,
      description: "Tratamento de alisamento capilar",
    },
    {
      id: 3,
      name: "Manicure",
      category: "Unhas",
      baseCost: 15,
      recommendedPrice: 35,
      profitMargin: 57,
      duration: 45,
      description: "Serviço completo de cuidado com as unhas",
    },
  ])

  const [products, setProducts] = useState([
    {
      id: 1,
      name: "Tintura de Cabelo - Loiro",
      category: "Produtos para Cabelo",
      cost: 25,
      sellingPrice: 45,
      profitMargin: 44,
      stock: 15,
      supplier: "Beauty Supply Co.",
    },
    {
      id: 2,
      name: "Esmalte - Vermelho",
      category: "Produtos para Unhas",
      cost: 8,
      sellingPrice: 18,
      profitMargin: 56,
      stock: 25,
      supplier: "Nail Pro Ltd.",
    },
  ])

  const [newService, setNewService] = useState({
    name: "",
    category: "",
    baseCost: "",
    desiredProfitMargin: "",
    duration: "",
    description: "",
  })

  const [newProduct, setNewProduct] = useState({
    name: "",
    category: "",
    cost: "",
    desiredProfitMargin: "",
    supplier: "",
  })

  const calculateRecommendedPrice = (baseCost, profitMargin) => {
    return (baseCost / (1 - profitMargin / 100)).toFixed(2)
  }

  const handleAddService = () => {
    if (newService.name && newService.baseCost && newService.desiredProfitMargin) {
      const baseCost = Number.parseFloat(newService.baseCost)
      const profitMargin = Number.parseFloat(newService.desiredProfitMargin)
      const recommendedPrice = Number.parseFloat(calculateRecommendedPrice(baseCost, profitMargin))

      const service = {
        id: services.length + 1,
        name: newService.name,
        category: newService.category,
        baseCost,
        recommendedPrice,
        profitMargin,
        duration: Number.parseInt(newService.duration),
        description: newService.description,
      }

      setServices([...services, service])
      setNewService({
        name: "",
        category: "",
        baseCost: "",
        desiredProfitMargin: "",
        duration: "",
        description: "",
      })
    }
  }

  const handleAddProduct = () => {
    if (newProduct.name && newProduct.cost && newProduct.desiredProfitMargin) {
      const cost = Number.parseFloat(newProduct.cost)
      const profitMargin = Number.parseFloat(newProduct.desiredProfitMargin)
      const sellingPrice = Number.parseFloat(calculateRecommendedPrice(cost, profitMargin))

      const product = {
        id: products.length + 1,
        name: newProduct.name,
        category: newProduct.category,
        cost,
        sellingPrice,
        profitMargin,
        stock: 0,
        supplier: newProduct.supplier,
      }

      setProducts([...products, product])
      setNewProduct({
        name: "",
        category: "",
        cost: "",
        desiredProfitMargin: "",
        supplier: "",
      })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold">Serviços & Produtos</h2>
          <p className="text-muted-foreground">Gerencie os serviços do seu salão e produtos para revenda</p>
        </div>
      </div>

      <Tabs defaultValue="services" className="space-y-6">
        <TabsList>
          <TabsTrigger value="services">Serviços</TabsTrigger>
          <TabsTrigger value="products">Produtos</TabsTrigger>
        </TabsList>

        <TabsContent value="services" className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold">Serviços</h3>
            <Dialog>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Serviço
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Adicionar Novo Serviço</DialogTitle>
                  <DialogDescription>Criar um novo serviço com cálculo automático de preço</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="serviceName">Nome do Serviço</Label>
                    <Input
                      id="serviceName"
                      value={newService.name}
                      onChange={(e) => setNewService({ ...newService, name: e.target.value })}
                      placeholder="ex: Coloração de Cabelo"
                    />
                  </div>
                  <div>
                    <Label htmlFor="serviceCategory">Categoria</Label>
                    <Select
                      value={newService.category}
                      onValueChange={(value) => setNewService({ ...newService, category: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Hair">Cabelo</SelectItem>
                        <SelectItem value="Nails">Unhas</SelectItem>
                        <SelectItem value="Skin">Cuidados com a Pele</SelectItem>
                        <SelectItem value="Makeup">Maquiagem</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="baseCost">Custo Base (R$)</Label>
                      <Input
                        id="baseCost"
                        type="number"
                        value={newService.baseCost}
                        onChange={(e) => setNewService({ ...newService, baseCost: e.target.value })}
                        placeholder="45.00"
                      />
                    </div>
                    <div>
                      <Label htmlFor="profitMargin">Margem de Lucro (%)</Label>
                      <Input
                        id="profitMargin"
                        type="number"
                        value={newService.desiredProfitMargin}
                        onChange={(e) => setNewService({ ...newService, desiredProfitMargin: e.target.value })}
                        placeholder="75"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="duration">Duração (minutos)</Label>
                    <Input
                      id="duration"
                      type="number"
                      value={newService.duration}
                      onChange={(e) => setNewService({ ...newService, duration: e.target.value })}
                      placeholder="120"
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Descrição</Label>
                    <Textarea
                      id="description"
                      value={newService.description}
                      onChange={(e) => setNewService({ ...newService, description: e.target.value })}
                      placeholder="Descrição do serviço..."
                    />
                  </div>
                  {newService.baseCost && newService.desiredProfitMargin && (
                    <div className="p-3 bg-green-50 rounded-lg">
                      <div className="flex items-center gap-2 text-green-700">
                        <Calculator className="h-4 w-4" />
                        <span className="font-medium">
                          Preço Recomendado: R$
                          {calculateRecommendedPrice(
                            Number.parseFloat(newService.baseCost),
                            Number.parseFloat(newService.desiredProfitMargin),
                          )}
                        </span>
                      </div>
                    </div>
                  )}
                  <Button onClick={handleAddService} className="w-full">
                    Adicionar Serviço
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => (
              <Card key={service.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{service.name}</CardTitle>
                      <CardDescription>{service.category}</CardDescription>
                    </div>
                    <Badge variant="secondary">{service.duration}min</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Custo Base:</span>
                      <span className="font-medium">R${service.baseCost}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Preço Recomendado:</span>
                      <span className="font-medium text-green-600">R${service.recommendedPrice}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Margem de Lucro:</span>
                      <Badge variant="outline">{service.profitMargin}%</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">{service.description}</p>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button variant="outline" size="sm">
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="products" className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold">Produtos</h3>
            <Dialog>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Produto
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Adicionar Novo Produto</DialogTitle>
                  <DialogDescription>Adicionar um produto para revenda com preço automático</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="productName">Nome do Produto</Label>
                    <Input
                      id="productName"
                      value={newProduct.name}
                      onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                      placeholder="ex: Tintura de Cabelo - Loiro"
                    />
                  </div>
                  <div>
                    <Label htmlFor="productCategory">Categoria</Label>
                    <Select
                      value={newProduct.category}
                      onValueChange={(value) => setNewProduct({ ...newProduct, category: value })}
                    >
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
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="productCost">Custo (R$)</Label>
                      <Input
                        id="productCost"
                        type="number"
                        value={newProduct.cost}
                        onChange={(e) => setNewProduct({ ...newProduct, cost: e.target.value })}
                        placeholder="25.00"
                      />
                    </div>
                    <div>
                      <Label htmlFor="productMargin">Margem de Lucro (%)</Label>
                      <Input
                        id="productMargin"
                        type="number"
                        value={newProduct.desiredProfitMargin}
                        onChange={(e) => setNewProduct({ ...newProduct, desiredProfitMargin: e.target.value })}
                        placeholder="44"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="supplier">Fornecedor</Label>
                    <Input
                      id="supplier"
                      value={newProduct.supplier}
                      onChange={(e) => setNewProduct({ ...newProduct, supplier: e.target.value })}
                      placeholder="Beauty Supply Co."
                    />
                  </div>
                  {newProduct.cost && newProduct.desiredProfitMargin && (
                    <div className="p-3 bg-green-50 rounded-lg">
                      <div className="flex items-center gap-2 text-green-700">
                        <Calculator className="h-4 w-4" />
                        <span className="font-medium">
                          Preço Recomendado: R$
                          {calculateRecommendedPrice(
                            Number.parseFloat(newProduct.cost),
                            Number.parseFloat(newProduct.desiredProfitMargin),
                          )}
                        </span>
                      </div>
                    </div>
                  )}
                  <Button onClick={handleAddProduct} className="w-full">
                    Adicionar Produto
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <Card key={product.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{product.name}</CardTitle>
                      <CardDescription>{product.category}</CardDescription>
                    </div>
                    <Badge variant={product.stock > 10 ? "secondary" : "destructive"}>Estoque: {product.stock}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Custo:</span>
                      <span className="font-medium">R${product.cost}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Preço de Venda:</span>
                      <span className="font-medium text-green-600">R${product.sellingPrice}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Margem de Lucro:</span>
                      <Badge variant="outline">{product.profitMargin}%</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Fornecedor:</span>
                      <span className="text-xs">{product.supplier}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button variant="outline" size="sm">
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
