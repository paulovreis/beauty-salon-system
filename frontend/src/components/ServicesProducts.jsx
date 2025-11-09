import { useState, useEffect } from "react";
import { axiosWithAuth } from "./api/axiosWithAuth.js";
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

  const [products, setProducts] = useState([]);
  const [newProduct, setNewProduct] = useState({
    name: "",
    category_id: "",
    sku: "",
    cost_price: "",
    selling_price: "",
    current_stock: "",
    min_stock_level: "",
    max_stock_level: "",
    supplier_name: "",
    supplier_contact: "",
    description: "",
  });
  // Estado para edição de serviço
  const [editingService, setEditingService] = useState(null);
  const [showEditServiceDialog, setShowEditServiceDialog] = useState(false);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: "", description: "" });
  // Estado para aba ativa (deve vir antes de qualquer uso)
  const [activeTab, setActiveTab] = useState("services");

  // Estados para deletar
  const [showDeleteServiceDialog, setShowDeleteServiceDialog] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState(null);
  const [showDeleteProductDialog, setShowDeleteProductDialog] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showEditProductDialog, setShowEditProductDialog] = useState(false);

  // Estado para categorias de produtos
  const [productCategories, setProductCategories] = useState([]);

  // Atualiza o preço recomendado do produto sempre que cost ou desiredProfitMargin mudarem
  // Se desejar cálculo automático de selling_price, pode-se adicionar lógica aqui

  // Buscar produtos do backend
  async function fetchProducts() {
    setLoading(true);
    setError("");
    try {
      const res = await axiosWithAuth("/inventory", { method: "get" });
      // O endpoint /inventory retorna { products: [...], pagination: {...} }
      const productsData = res.data?.products || [];
      // Garantir que products seja sempre um array
      setProducts(Array.isArray(productsData) ? productsData : []);
    } catch (e) {
      setError(e.response?.data?.message || e.message);
      setProducts([]); // Definir como array vazio em caso de erro
    } finally {
      setLoading(false);
    }
  }

  // Buscar categorias de produtos do backend
  async function fetchProductCategories() {
    try {
      const res = await axiosWithAuth("/products/categories", {
        method: "get",
      });
      // Garantir que productCategories seja sempre um array
      setProductCategories(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setError(e.response?.data?.message || e.message);
      setProductCategories([]); // Definir como array vazio em caso de erro
    }
  }

  // Buscar produtos e categorias ao abrir aba products
  useEffect(() => {
    if (activeTab === "products") {
      fetchProducts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Buscar categorias de produtos ao montar o componente (garante que sempre existam para o select)
  useEffect(() => {
    fetchProductCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      const res = await axiosWithAuth("/services/", { method: "get" });
      // Garantir que services seja sempre um array
      setServices(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setError(e.response?.data?.message || e.message);
      setServices([]); // Definir como array vazio em caso de erro
    } finally {
      setLoading(false);
    }
  }

  async function fetchCategories() {
    try {
      const res = await axiosWithAuth("/services/categories", {
        method: "get",
      });
      // Garantir que categories seja sempre um array
      setCategories(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setError(e.response?.data?.message || e.message);
      setCategories([]); // Definir como array vazio em caso de erro
    }
  }

  async function calculateRecommendedPrice(base_cost, profit_margin) {
    try {
      const res = await axiosWithAuth("/services/calculate-price", {
        method: "post",
        data: {
          base_cost: Number(base_cost),
          profit_margin: Number(profit_margin),
        },
      });
      return res.data.price;
    } catch (e) {
      setError(e.response?.data?.message || e.message);
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
      await axiosWithAuth("/services/", {
        method: "post",
        data: {
          name: newService.name,
          category_id: Number(newService.category_id),
          base_cost: Number(newService.base_cost),
          profit_margin: Number(newService.profit_margin),
          recommended_price: Number(recommended_price),
          duration_minutes: Number(newService.duration_minutes),
          description: newService.description,
        },
      });
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
      setError(e.response?.data?.message || e.message);
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
    setShowEditServiceDialog(true);
  }

  // // Salvar edição
  // async function handleSaveEditService() {
  //   if (
  //     !editingService.name ||
  //     !editingService.category_id ||
  //     !editingService.base_cost ||
  //     !editingService.profit_margin
  //   ) {
  //     setError("Preencha todos os campos obrigatórios!");
  //     return;
  //   }
  //   setLoading(true);
  //   try {
  //     console.log('Editing service data before save:', editingService);
  //     // Calcula preço recomendado atualizado
  //     const recommended_price = await calculateRecommendedPrice(
  //       editingService.base_cost,
  //       editingService.profit_margin
  //     );
  //     await axiosWithAuth(`/services/${editingService.id}`, {
  //       method: "put",
  //       data: {
  //         name: editingService.name,
  //         category_id: Number(editingService.category_id),
  //         base_cost: Number(editingService.base_cost),
  //         profit_margin: Number(editingService.profit_margin),
  //         recommended_price: Number(recommended_price),
  //         duration_minutes: Number(editingService.duration_minutes),
  //         description: editingService.description,
  //         is_active:
  //           editingService.is_active !== undefined
  //             ? editingService.is_active
  //             : true,
  //       },
  //     });
  //     setShowEditServiceDialog(false);
  //     setEditingService(null);
  //     fetchServices();
  //   } catch (e) {
  //     setError(e.message);
  //   } finally {
  //     setLoading(false);
  //   }
  // }

  async function handleAddProduct() {
    setError("");
    if (
      !newProduct.name ||
      !newProduct.category_id ||
      !newProduct.cost_price ||
      !newProduct.selling_price
    ) {
      setError("Preencha todos os campos obrigatórios!");
      return;
    }
    setLoading(true);
    try {
      await axiosWithAuth("/products/", {
        method: "post",
        data: {
          name: newProduct.name,
          category_id: Number(newProduct.category_id),
          sku: newProduct.sku,
          cost_price: Number(newProduct.cost_price),
          selling_price: Number(newProduct.selling_price),
          current_stock: newProduct.current_stock
            ? Number(newProduct.current_stock)
            : 0,
          min_stock_level: newProduct.min_stock_level
            ? Number(newProduct.min_stock_level)
            : 0,
          max_stock_level: newProduct.max_stock_level
            ? Number(newProduct.max_stock_level)
            : 0,
          supplier_name: newProduct.supplier_name,
          supplier_contact: newProduct.supplier_contact,
          description: newProduct.description,
        },
      });
      setNewProduct({
        name: "",
        category_id: "",
        sku: "",
        cost_price: "",
        selling_price: "",
        current_stock: "",
        min_stock_level: "",
        max_stock_level: "",
        supplier_name: "",
        supplier_contact: "",
        description: "",
      });
      fetchProducts();
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddCategory() {
    if (!newCategory.name) return;
    if (activeTab === "services") {
      try {
        await axiosWithAuth("/services/categories", {
          method: "post",
          data: newCategory,
        });
        setNewCategory({ name: "", description: "" });
        setShowCategoryDialog(false);
        fetchCategories();
      } catch (e) {
        alert(e.response?.data?.message || e.message);
      }
    }else{
      try {
        await axiosWithAuth("/products/categories", {
          method: "post",
          data: newCategory,
        });
        setNewCategory({ name: "", description: "" });
        setShowCategoryDialog(false);
        fetchProductCategories();
      } catch (e) {
        alert(e.response?.data?.message || e.message);
      }
    }
  }

  // Service edit and delete handlers
  function handleEditServiceClick(service) {
    console.log('Service data:', service);
    console.log('Categories available:', categories);
    
    // Se o serviço tem category_name mas não category_id, vamos buscar o ID pela categoria
    let categoryId = service.category_id;
    if (!categoryId && service.category_name) {
      const foundCategory = categories.find(cat => cat.name === service.category_name);
      if (foundCategory) {
        categoryId = foundCategory.id;
      }
    }
    
    // Calcula o preço recomendado usando base_cost e profit_margin
    let recommended_price = "";
    if (service.base_cost && service.profit_margin) {
      recommended_price = (
      Number(service.base_cost) +
      (Number(service.base_cost) * Number(service.profit_margin) / 100)
      ).toFixed(2);
    }

    const editData = {
      id: service.id,
      name: service.name || '',
      description: service.description || '',
      base_cost: service.base_cost || '',
      recommended_price: recommended_price,
      profit_margin: service.profit_margin || '',
      duration: service.duration_minutes || '',
      category_id: categoryId || ''
    };
    
    console.log('Edit data being set:', editData);
    setEditingService(editData);
    setShowEditServiceDialog(true);
  }

  async function handleSaveEditService() {
    if (!editingService.name || !editingService.category_id || !editingService.base_cost || !editingService.profit_margin || !editingService.recommended_price || !editingService.duration) return;

    try {
      setLoading(true);
      await axiosWithAuth(`/services/${editingService.id}`, {
        method: "put",
        data: {
          name: editingService.name,
          description: editingService.description || null,
          base_cost: parseFloat(editingService.base_cost) || 0,
          recommended_price: parseFloat(editingService.recommended_price) || 0,
          duration_minutes: parseInt(editingService.duration) || 0,
          profit_margin: 20, // valor padrão
          category_id: parseInt(editingService.category_id),
          is_active: true
        }
      });
      setShowEditServiceDialog(false);
      setEditingService({});
      fetchServices();
    } catch (e) {
      alert(e.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteService(serviceId) {
    if (window.confirm("Tem certeza que deseja excluir este serviço?")) {
      try {
        setLoading(true);
        await axiosWithAuth(`/services/${serviceId}`, {
          method: "delete"
        });
        fetchServices();
      } catch (e) {
        alert(e.response?.data?.message || e.message);
      } finally {
        setLoading(false);
      }
    }
  }

  // Product edit and delete handlers
  function handleEditProductClick(product) {
    console.log('Product data:', product);
    console.log('Product categories available:', productCategories);
    
    // Se o produto tem category_name mas não category_id, vamos buscar o ID pela categoria
    let categoryId = product.category_id;
    if (!categoryId && product.category_name) {
      const foundCategory = productCategories.find(cat => cat.name === product.category_name);
      if (foundCategory) {
        categoryId = foundCategory.id;
      }
    }
    
    const editData = {
      id: product.id,
      name: product.name || '',
      sku: product.sku || '',
      description: product.description || '',
      price: product.price || product.selling_price || '',
      quantity_in_stock: product.quantity_in_stock || product.current_stock || '',
      category_id: categoryId || ''
    };
    
    console.log('Product edit data being set:', editData);
    setEditingProduct(editData);
    setShowEditProductDialog(true);
  }

  async function handleSaveEditProduct() {
    if (!editingProduct.name || !editingProduct.category_id || !editingProduct.price) return;
    
    try {
      setLoading(true);
      
      const payload = {
        name: editingProduct.name,
        price: parseFloat(editingProduct.price),
        selling_price: parseFloat(editingProduct.price),
        quantity_in_stock: parseInt(editingProduct.quantity_in_stock) || 0,
        current_stock: parseInt(editingProduct.quantity_in_stock) || 0,
        category_id: parseInt(editingProduct.category_id)
      };

      if (editingProduct.description && editingProduct.description.trim()) {
        payload.description = editingProduct.description;
      }
      if (editingProduct.sku && editingProduct.sku.trim()) {
        payload.sku = editingProduct.sku;
      }

      await axiosWithAuth(`/products/${editingProduct.id}`, {
        method: "put",
        data: payload
      });
      setShowEditProductDialog(false);
      setEditingProduct({});
      fetchProducts();
    } catch (e) {
      alert(e.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteProduct(productId) {
    if (window.confirm("Tem certeza que deseja excluir este produto?")) {
      try {
        setLoading(true);
        await axiosWithAuth(`/products/${productId}`, {
          method: "delete"
        });
        fetchProducts();
      } catch (e) {
        alert(e.response?.data?.message || e.message);
      } finally {
        setLoading(false);
      }
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

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
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
            {Array.isArray(services) && services.length > 0 ? services.map((service) => (
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
                      onClick={() => handleEditServiceClick(service)}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleDeleteService(service.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )) : (
              <div className="col-span-full text-center py-8 text-gray-500">
                {loading ? "Carregando serviços..." : "Nenhum serviço encontrado."}
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
                      value={newProduct.category_id}
                      onValueChange={(value) =>
                        setNewProduct({ ...newProduct, category_id: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {productCategories.map((category) => (
                          <SelectItem
                            key={category.id}
                            value={String(category.id)}
                          >
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="productSku">SKU</Label>
                      <Input
                        id="productSku"
                        value={newProduct.sku}
                        onChange={(e) =>
                          setNewProduct({ ...newProduct, sku: e.target.value })
                        }
                        placeholder="SKU123"
                      />
                    </div>
                    <div>
                      <Label htmlFor="productCost">Custo (R$)</Label>
                      <Input
                        id="productCost"
                        type="number"
                        value={newProduct.cost_price}
                        onChange={(e) =>
                          setNewProduct({
                            ...newProduct,
                            cost_price: e.target.value,
                          })
                        }
                        placeholder="25.00"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="productSelling">
                        Preço de Venda (R$)
                      </Label>
                      <Input
                        id="productSelling"
                        type="number"
                        value={newProduct.selling_price}
                        onChange={(e) =>
                          setNewProduct({
                            ...newProduct,
                            selling_price: e.target.value,
                          })
                        }
                        placeholder="40.00"
                      />
                    </div>
                    <div>
                      <Label htmlFor="productStock">Estoque Atual</Label>
                      <Input
                        id="productStock"
                        type="number"
                        value={newProduct.current_stock}
                        onChange={(e) =>
                          setNewProduct({
                            ...newProduct,
                            current_stock: e.target.value,
                          })
                        }
                        placeholder="10"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="minStock">Estoque Mínimo</Label>
                      <Input
                        id="minStock"
                        type="number"
                        value={newProduct.min_stock_level}
                        onChange={(e) =>
                          setNewProduct({
                            ...newProduct,
                            min_stock_level: e.target.value,
                          })
                        }
                        placeholder="2"
                      />
                    </div>
                    <div>
                      <Label htmlFor="maxStock">Estoque Máximo</Label>
                      <Input
                        id="maxStock"
                        type="number"
                        value={newProduct.max_stock_level}
                        onChange={(e) =>
                          setNewProduct({
                            ...newProduct,
                            max_stock_level: e.target.value,
                          })
                        }
                        placeholder="100"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="supplierName">Fornecedor</Label>
                      <Input
                        id="supplierName"
                        value={newProduct.supplier_name}
                        onChange={(e) =>
                          setNewProduct({
                            ...newProduct,
                            supplier_name: e.target.value,
                          })
                        }
                        placeholder="Beauty Supply Co."
                      />
                    </div>
                    <div>
                      <Label htmlFor="supplierContact">
                        Contato Fornecedor
                      </Label>
                      <Input
                        id="supplierContact"
                        value={newProduct.supplier_contact}
                        onChange={(e) =>
                          setNewProduct({
                            ...newProduct,
                            supplier_contact: e.target.value,
                          })
                        }
                        placeholder="(11) 99999-9999"
                      />
                    </div>
                  </div>
                  <Button onClick={handleAddProduct} className="w-full">
                    Adicionar Produto
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.isArray(products) && products.length > 0 ? products.map((product) => (
              <Card key={product.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{product.name}</CardTitle>
                      <CardDescription>{product.category_name}</CardDescription>
                    </div>
                    <Badge
                      variant={
                        product.current_stock > 10 ? "secondary" : "destructive"
                      }
                    >
                      Estoque: {product.current_stock ?? 0}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">
                        SKU:
                      </span>
                      <span className="font-medium">{product.sku}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">
                        Custo:
                      </span>
                      <span className="font-medium">
                        R${product.cost_price}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">
                        Preço de Venda:
                      </span>
                      <span className="font-medium text-green-600">
                        R${product.selling_price}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">
                        Estoque:
                      </span>
                      <span className="font-medium">
                        {product.current_stock}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">
                        Fornecedor:
                      </span>
                      <span className="font-medium">
                        {product.supplier_name}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">
                        Descrição:
                      </span>
                      <span className="text-xs">{product.description}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleEditProductClick(product)}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleDeleteProduct(product.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )) : (
              <div className="col-span-full text-center py-8 text-gray-500">
                {loading ? "Carregando produtos..." : "Nenhum produto encontrado."}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog de Edição de Serviço */}
      <Dialog open={showEditServiceDialog} onOpenChange={setShowEditServiceDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Serviço</DialogTitle>
            <DialogDescription>Edite as informações do serviço</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="editServiceName">Nome do Serviço</Label>
              <Input
                id="editServiceName"
                value={editingService?.name || ""}
                onChange={(e) =>
                  setEditingService({ ...editingService, name: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="editServiceCategory">Categoria</Label>
              <Select
                value={editingService?.category_id ? editingService.category_id.toString() : ""}
                onValueChange={(value) =>
                  setEditingService({ ...editingService, category_id: parseInt(value) })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma categoria" />
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
            <div>
              <Label htmlFor="editServicePrice">Preço base (R$)</Label>
              <Input
                id="editServicePrice"
                type="number"
                step="0.01"
                value={editingService?.base_cost || ""}
                onChange={(e) =>
                  setEditingService({ ...editingService, base_cost: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="editServiceProfit">Margem de lucro (%)</Label>
              <Input
                id="editServiceProfit"
                type="number"
                step="0.01"
                value={editingService?.profit_margin || ""}
                onChange={(e) =>
                  setEditingService({ ...editingService, profit_margin: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="editServiceDuration">Duração (minutos)</Label>
              <Input
                id="editServiceDuration"
                type="number"
                value={editingService?.duration || ""}
                onChange={(e) =>
                  setEditingService({ ...editingService, duration: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="editServiceDescription">Descrição</Label>
              <Textarea
                id="editServiceDescription"
                value={editingService?.description || ""}
                onChange={(e) =>
                  setEditingService({ ...editingService, description: e.target.value })
                }
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setShowEditServiceDialog(false)}
            >
              Cancelar
            </Button>
            <Button onClick={handleSaveEditService}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Edição de Produto */}
      <Dialog open={showEditProductDialog} onOpenChange={setShowEditProductDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Produto</DialogTitle>
            <DialogDescription>Edite as informações do produto</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="editProductName">Nome do Produto</Label>
              <Input
                id="editProductName"
                value={editingProduct?.name || ""}
                onChange={(e) =>
                  setEditingProduct({ ...editingProduct, name: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="editProductSku">SKU</Label>
              <Input
                id="editProductSku"
                value={editingProduct?.sku || ""}
                onChange={(e) =>
                  setEditingProduct({ ...editingProduct, sku: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="editProductCategory">Categoria</Label>
              <Select
                value={editingProduct?.category_id ? editingProduct.category_id.toString() : ""}
                onValueChange={(value) =>
                  setEditingProduct({ ...editingProduct, category_id: parseInt(value) })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  {productCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id.toString()}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="editProductPrice">Preço (R$)</Label>
              <Input
                id="editProductPrice"
                type="number"
                step="0.01"
                value={editingProduct?.price || ""}
                onChange={(e) =>
                  setEditingProduct({ ...editingProduct, price: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="editProductStock">Quantidade em Estoque</Label>
              <Input
                id="editProductStock"
                type="number"
                value={editingProduct?.quantity_in_stock || ""}
                onChange={(e) =>
                  setEditingProduct({ ...editingProduct, quantity_in_stock: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="editProductDescription">Descrição</Label>
              <Textarea
                id="editProductDescription"
                value={editingProduct?.description || ""}
                onChange={(e) =>
                  setEditingProduct({ ...editingProduct, description: e.target.value })
                }
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setShowEditProductDialog(false)}
            >
              Cancelar
            </Button>
            <Button onClick={handleSaveEditProduct}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
