import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Textarea } from "./ui/textarea";
import { Plus, Edit, Trash2, Calculator } from "lucide-react";

export default function ServicesProducts() {
  const baseUrl = "http://localhost:5000"; // Base URL for API requests
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [newService, setNewService] = useState({
    name: "",
    category_id: "",
    base_cost: "",
    profit_margin: "",
    duration_minutes: "",
    description: "",
  });
  const [recommendedPrice, setRecommendedPrice] = useState("");

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
  ]);
  const [newProduct, setNewProduct] = useState({
    name: "",
    category: "",
    cost: "",
    desiredProfitMargin: "",
    supplier: "",
  });
  const [recommendedProductPrice, setRecommendedProductPrice] = useState("");
  // Estado para edição de serviço
  const [editingService, setEditingService] = useState(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: "", description: "" });
  // Atualiza o preço recomendado do produto sempre que cost ou desiredProfitMargin mudarem
  useEffect(() => {
    async function fetchProductPrice() {
      if (newProduct.cost && newProduct.desiredProfitMargin) {
        const price = await calculateRecommendedPrice(
          Number(newProduct.cost),
          Number(newProduct.desiredProfitMargin)
        );
        setRecommendedProductPrice(price);
      } else {
        setRecommendedProductPrice("");
      }
    }
    fetchProductPrice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newProduct.cost, newProduct.desiredProfitMargin]);

  useEffect(() => {
    fetchServices();
    fetchCategories();
  }, []);

  // Atualiza o preço recomendado sempre que base_cost ou profit_margin mudarem
  useEffect(() => {
    async function fetchPrice() {
      if (newService.base_cost && newService.profit_margin) {
        const price = await calculateRecommendedPrice(
          Number(newService.base_cost),
          Number(newService.profit_margin)
        );
        setRecommendedPrice(price);
      } else {
        setRecommendedPrice("");
      }
    }
    fetchPrice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newService.base_cost, newService.profit_margin]);

  async function fetchServices() {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${baseUrl}/services/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Erro ao buscar serviços");
      const data = await res.json();
      setServices(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchCategories() {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${baseUrl}/services/categories`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Erro ao buscar categorias");
      const data = await res.json();
      setCategories(data);
    } catch (e) {
      setError(e.message);
    }
  }

  async function calculateRecommendedPrice(base_cost, profit_margin) {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${baseUrl}/services/calculate-price`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          base_cost: Number(base_cost),
          profit_margin: Number(profit_margin),
        }),
      });
      if (!res.ok) throw new Error("Erro ao calcular preço");
      const data = await res.json();
      return data.price;
    } catch (e) {
      setError(e.message);
      return "";
    }
  }

  async function handleAddService() {
    setError("");
    if (
      !newService.name ||
      !newService.category_id ||
      !newService.base_cost ||
      !newService.profit_margin
    ) {
      setError("Preencha todos os campos obrigatórios!");
      return;
    }
    setLoading(true);
    try {
      const recommended_price = await calculateRecommendedPrice(
        newService.base_cost,
        newService.profit_margin
      );
      const token = localStorage.getItem("token");
      const res = await fetch(`${baseUrl}/services/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newService.name,
          category_id: Number(newService.category_id),
          base_cost: Number(newService.base_cost),
          profit_margin: Number(newService.profit_margin),
          recommended_price: Number(recommended_price),
          duration_minutes: Number(newService.duration_minutes),
          description: newService.description,
        }),
      });
      if (!res.ok) throw new Error("Erro ao adicionar serviço");
      setNewService({
        name: "",
        category_id: "",
        base_cost: "",
        profit_margin: "",
        duration_minutes: "",
        description: "",
      });
      fetchServices();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // Abrir modal de edição
  function handleEditService(service) {
    // Tenta obter o category_id pelo nome da categoria
    let categoryId = service.category_id;
    if (!categoryId && (service.category || service.category_name)) {
      const found = categories.find(
        (cat) =>
          cat.name === service.category || cat.name === service.category_name
      );
      if (found) categoryId = found.id;
    }
    setEditingService({
      ...service,
      category_id: categoryId ? String(categoryId) : "",
    });
    setShowEditDialog(true);
  }

  // Salvar edição
  async function handleSaveEditService() {
    if (
      !editingService.name ||
      !editingService.category_id ||
      !editingService.base_cost ||
      !editingService.profit_margin
    ) {
      setError("Preencha todos os campos obrigatórios!");
      return;
    }
    setLoading(true);
    try {
      // Calcula preço recomendado atualizado
      const recommended_price = await calculateRecommendedPrice(
        editingService.base_cost,
        editingService.profit_margin
      );
      const token = localStorage.getItem("token");
      const res = await fetch(`${baseUrl}/services/${editingService.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: editingService.name,
          category_id: Number(editingService.category_id),
          base_cost: Number(editingService.base_cost),
          profit_margin: Number(editingService.profit_margin),
          recommended_price: Number(recommended_price),
          duration_minutes: Number(editingService.duration_minutes),
          description: editingService.description,
          is_active:
            editingService.is_active !== undefined
              ? editingService.is_active
              : true,
        }),
      });
      if (!res.ok) throw new Error("Erro ao atualizar serviço");
      setShowEditDialog(false);
      setEditingService(null);
      fetchServices();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const handleAddProduct = () => {
    if (newProduct.name && newProduct.cost && newProduct.desiredProfitMargin) {
      const cost = Number.parseFloat(newProduct.cost);
      const profitMargin = Number.parseFloat(newProduct.desiredProfitMargin);
      const sellingPrice = Number.parseFloat(
        calculateRecommendedPrice(cost, profitMargin)
      );

      const product = {
        id: products.length + 1,
        name: newProduct.name,
        category: newProduct.category,
        cost,
        sellingPrice,
        profitMargin,
        stock: 0,
        supplier: newProduct.supplier,
      };

      setProducts([...products, product]);
      setNewProduct({
        name: "",
        category: "",
        cost: "",
        desiredProfitMargin: "",
        supplier: "",
      });
    }
  };

  async function handleAddCategory() {
    if (!newCategory.name) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${baseUrl}/services/categories`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newCategory),
      });
      if (!res.ok) throw new Error("Erro ao adicionar categoria");
      setNewCategory({ name: "", description: "" });
      setShowCategoryDialog(false);
      fetchCategories();
    } catch (e) {
      alert(e.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold">Serviços & Produtos</h2>
          <p className="text-muted-foreground">
            Gerencie os serviços do seu salão e produtos para revenda
          </p>
        </div>
        <Button variant="outline" onClick={() => setShowCategoryDialog(true)}>
          + Adicionar Categoria
        </Button>
      </div>
      {/* Modal de categoria */}
      {showCategoryDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-lg">
            <h3 className="text-lg font-semibold mb-2">Nova Categoria</h3>
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={newCategory.name}
                onChange={(e) =>
                  setNewCategory({ ...newCategory, name: e.target.value })
                }
              />
              <Label>Descrição</Label>
              <Textarea
                value={newCategory.description}
                onChange={(e) =>
                  setNewCategory({
                    ...newCategory,
                    description: e.target.value,
                  })
                }
              />
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowCategoryDialog(false)}
              >
                Cancelar
              </Button>
              <Button onClick={handleAddCategory}>Salvar</Button>
            </div>
          </div>
        </div>
      )}

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
                  <DialogDescription>
                    Criar um novo serviço com cálculo automático de preço
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="serviceName">Nome do Serviço</Label>
                    <Input
                      id="serviceName"
                      value={newService.name}
                      onChange={(e) =>
                        setNewService({ ...newService, name: e.target.value })
                      }
                      placeholder="ex: Coloração de Cabelo"
                    />
                  </div>
                  <div>
                    <Label htmlFor="serviceCategory">Categoria</Label>
                    <Select
                      value={newService.category_id}
                      onValueChange={(value) =>
                        setNewService({ ...newService, category_id: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="baseCost">Custo Base (R$)</Label>
                      <Input
                        id="baseCost"
                        type="number"
                        value={newService.base_cost}
                        onChange={(e) =>
                          setNewService({
                            ...newService,
                            base_cost: e.target.value,
                          })
                        }
                        placeholder="45.00"
                      />
                    </div>
                    <div>
                      <Label htmlFor="profitMargin">Margem de Lucro (%)</Label>
                      <Input
                        id="profitMargin"
                        type="number"
                        value={newService.profit_margin}
                        onChange={(e) =>
                          setNewService({
                            ...newService,
                            profit_margin: e.target.value,
                          })
                        }
                        placeholder="75"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="duration">Duração (minutos)</Label>
                    <Input
                      id="duration"
                      type="number"
                      value={newService.duration_minutes}
                      onChange={(e) =>
                        setNewService({
                          ...newService,
                          duration_minutes: e.target.value,
                        })
                      }
                      placeholder="120"
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Descrição</Label>
                    <Textarea
                      id="description"
                      value={newService.description}
                      onChange={(e) =>
                        setNewService({
                          ...newService,
                          description: e.target.value,
                        })
                      }
                      placeholder="Descrição do serviço..."
                    />
                  </div>
                  {newService.base_cost && newService.profit_margin && (
                    <div className="p-3 bg-green-50 rounded-lg">
                      <div className="flex items-center gap-2 text-green-700">
                        <Calculator className="h-4 w-4" />
                        <span className="font-medium">
                          Preço Recomendado: R${recommendedPrice}
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
                    <Badge variant="secondary">
                      {service.duration_minutes}min
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">
                        Custo Base:
                      </span>
                      <span className="font-medium">R${service.base_cost}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">
                        Preço Recomendado:
                      </span>
                      <span className="font-medium text-green-600">
                        R${service.recommended_price}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">
                        Margem de Lucro:
                      </span>
                      <Badge variant="outline">{service.profit_margin}%</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {service.description}
                    </p>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditService(service)}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {/* Modal de edição de serviço */}
            {showEditDialog && editingService && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-lg">
                  <h3 className="text-lg font-semibold mb-2">Editar Serviço</h3>
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input
                      value={editingService.name}
                      onChange={(e) =>
                        setEditingService({
                          ...editingService,
                          name: e.target.value,
                        })
                      }
                    />
                    <Label>Categoria</Label>
                    <Select
                      value={editingService.category_id ?? ""}
                      onValueChange={(value) =>
                        setEditingService({
                          ...editingService,
                          category_id: value,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Label>Custo Base (R$)</Label>
                    <Input
                      type="number"
                      value={editingService.base_cost}
                      onChange={(e) =>
                        setEditingService({
                          ...editingService,
                          base_cost: e.target.value,
                        })
                      }
                    />
                    <Label>Margem de Lucro (%)</Label>
                    <Input
                      type="number"
                      value={editingService.profit_margin}
                      onChange={(e) =>
                        setEditingService({
                          ...editingService,
                          profit_margin: e.target.value,
                        })
                      }
                    />
                    <Label>Duração (minutos)</Label>
                    <Input
                      type="number"
                      value={editingService.duration_minutes}
                      onChange={(e) =>
                        setEditingService({
                          ...editingService,
                          duration_minutes: e.target.value,
                        })
                      }
                    />
                    <Label>Descrição</Label>
                    <Textarea
                      value={editingService.description}
                      onChange={(e) =>
                        setEditingService({
                          ...editingService,
                          description: e.target.value,
                        })
                      }
                    />
                    <div className="flex gap-2 mt-4 justify-end">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowEditDialog(false);
                          setEditingService(null);
                        }}
                      >
                        Cancelar
                      </Button>
                      <Button onClick={handleSaveEditService}>Salvar</Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
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
                  <DialogDescription>
                    Adicionar um produto para revenda com preço automático
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="productName">Nome do Produto</Label>
                    <Input
                      id="productName"
                      value={newProduct.name}
                      onChange={(e) =>
                        setNewProduct({ ...newProduct, name: e.target.value })
                      }
                      placeholder="ex: Tintura de Cabelo - Loiro"
                    />
                  </div>
                  <div>
                    <Label htmlFor="productCategory">Categoria</Label>
                    <Select
                      value={newProduct.category}
                      onValueChange={(value) =>
                        setNewProduct({ ...newProduct, category: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Hair Products">
                          Produtos para Cabelo
                        </SelectItem>
                        <SelectItem value="Nail Products">
                          Produtos para Unhas
                        </SelectItem>
                        <SelectItem value="Skin Care">
                          Cuidados com a Pele
                        </SelectItem>
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
                        onChange={(e) =>
                          setNewProduct({ ...newProduct, cost: e.target.value })
                        }
                        placeholder="25.00"
                      />
                    </div>
                    <div>
                      <Label htmlFor="productMargin">Margem de Lucro (%)</Label>
                      <Input
                        id="productMargin"
                        type="number"
                        value={newProduct.desiredProfitMargin}
                        onChange={(e) =>
                          setNewProduct({
                            ...newProduct,
                            desiredProfitMargin: e.target.value,
                          })
                        }
                        placeholder="44"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="supplier">Fornecedor</Label>
                    <Input
                      id="supplier"
                      value={newProduct.supplier}
                      onChange={(e) =>
                        setNewProduct({
                          ...newProduct,
                          supplier: e.target.value,
                        })
                      }
                      placeholder="Beauty Supply Co."
                    />
                  </div>
                  {recommendedProductPrice && (
                    <div className="p-3 bg-green-50 rounded-lg">
                      <div className="flex items-center gap-2 text-green-700">
                        <Calculator className="h-4 w-4" />
                        <span className="font-medium">
                          Preço Recomendado: R${recommendedProductPrice}
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
                    <Badge
                      variant={product.stock > 10 ? "secondary" : "destructive"}
                    >
                      Estoque: {product.stock}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">
                        Custo:
                      </span>
                      <span className="font-medium">R${product.cost}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">
                        Preço de Venda:
                      </span>
                      <span className="font-medium text-green-600">
                        R${product.sellingPrice}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">
                        Margem de Lucro:
                      </span>
                      <Badge variant="outline">{product.profitMargin}%</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">
                        Fornecedor:
                      </span>
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
  );
}
