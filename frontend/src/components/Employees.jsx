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
import { Avatar, AvatarFallback, AvatarInitials } from "./ui/avatar";
import { Plus, Edit, Trash2, DollarSign } from "lucide-react";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";
// Função global de fetchWithAuth (deve estar disponível no projeto)
async function fetchWithAuth(url, options = {}) {
  let token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "/login";
    throw new Error("Usuário não autenticado");
  }
  let response = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });
  if (response.status === 403 || response.status === 401) {
    localStorage.removeItem("token");
    window.location.href = "/login";
    throw new Error("Sessão expirada ou acesso negado");
  }
  return response;
}

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [services, setServices] = useState([]);
  const availableServices = services.map((s) => s.name);
  // Carregar funcionários e serviços do backend
  useEffect(() => {
    async function fetchEmployees() {
      setLoading(true);
      setError("");
      try {
        const res = await fetchWithAuth(`${API_URL}/employees`);
        if (!res.ok) throw new Error("Erro ao carregar funcionários.");
        const data = await res.json();
        setEmployees(data);
      } catch (err) {
        setError("Erro ao carregar funcionários.");
      } finally {
        setLoading(false);
      }
    }
    async function fetchServices() {
      try {
        const res = await fetchWithAuth(`${API_URL}/services`);
        if (res.ok) {
          const data = await res.json();
          setServices(data);
        }
      } catch (err) {}
    }
    fetchEmployees();
    fetchServices();
  }, []);

  const [newEmployee, setNewEmployee] = useState({
    name: "",
    email: "",
    phone: "",
    specialties: [], // [{ service_id, commission_rate }]
  });

  const [selectedSpecialty, setSelectedSpecialty] = useState("");
  const [commissionRate, setCommissionRate] = useState("");

  // Adiciona especialidade (usando id do serviço)
  const addSpecialty = () => {
    if (selectedSpecialty && commissionRate) {
      if (newEmployee.specialties.some(s => s.service_id === Number(selectedSpecialty))) return;
      setNewEmployee({
        ...newEmployee,
        specialties: [
          ...newEmployee.specialties,
          { service_id: Number(selectedSpecialty), commission_rate: Number(commissionRate) }
        ]
      });
      setSelectedSpecialty("");
      setCommissionRate("");
    }
  };

  const removeSpecialty = (service_id) => {
    setNewEmployee({
      ...newEmployee,
      specialties: newEmployee.specialties.filter(s => s.service_id !== service_id)
    });
  };

  // Adicionar funcionário (integração backend)
  const handleAddEmployee = async () => {
    setError("");
    try {
      // Cria funcionário
      const res = await fetchWithAuth(`${API_URL}/employees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newEmployee.name,
          email: newEmployee.email,
          phone: newEmployee.phone,
        }),
      });
      if (res.status === 409) {
        setError("E-mail já cadastrado");
        return;
      }
      if (!res.ok) throw new Error("Erro ao criar funcionário");
      const created = await res.json();
      // Adiciona especialidades
      for (const spec of newEmployee.specialties) {
        await fetchWithAuth(`${API_URL}/employees/${created.id}/specialties`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(spec),
        });
      }
      // Recarrega lista
      const reload = await fetchWithAuth(`${API_URL}/employees`);
      setEmployees(await reload.json());
      setNewEmployee({ name: "", email: "", phone: "", specialties: [] });
    } catch (err) {
      setError(err.message || "Erro ao criar funcionário");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold">Gestão de Funcionários</h2>
          <p className="text-muted-foreground">
            Gerencie a equipe e as estruturas de comissão
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Employee
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Adicionar Novo Funcionário</DialogTitle>
              <DialogDescription>
                Crie um novo perfil de funcionário com taxas de comissão
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="employeeName">Nome Completo</Label>
                  <Input
                    id="employeeName"
                    value={newEmployee.name}
                    onChange={(e) =>
                      setNewEmployee({ ...newEmployee, name: e.target.value })
                    }
                    placeholder="Ana Costa"
                  />
                </div>
                <div>
                  <Label htmlFor="employeeEmail">E-mail</Label>
                  <Input
                    id="employeeEmail"
                    type="email"
                    value={newEmployee.email}
                    onChange={(e) =>
                      setNewEmployee({ ...newEmployee, email: e.target.value })
                    }
                    placeholder="ana@salon.com"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="employeePhone">Telefone</Label>
                <Input
                  id="employeePhone"
                  value={newEmployee.phone}
                  onChange={(e) =>
                    setNewEmployee({ ...newEmployee, phone: e.target.value })
                  }
                  placeholder="(11) 99999-1111"
                />
              </div>

              <div className="space-y-3">
                <Label>Especialidades & Taxas de Comissão</Label>
                <div className="flex gap-2">
                  <Select
                    value={selectedSpecialty}
                    onValueChange={setSelectedSpecialty}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Selecione o serviço" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableServices
                        .filter(
                          (service) =>
                            !newEmployee.specialties.includes(service)
                        )
                        .map((service) => (
                          <SelectItem key={service} value={service}>
                            {service}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    placeholder="Commission %"
                    value={commissionRate}
                    onChange={(e) => setCommissionRate(e.target.value)}
                    className="w-32"
                  />
                  <Button
                    onClick={addSpecialty}
                    disabled={!selectedSpecialty || !commissionRate}
                  >
                    Adicionar
                  </Button>
                </div>

                {newEmployee.specialties.length > 0 && (
                  <div className="space-y-2">
                    {newEmployee.specialties.map((specialty) => (
                      <div
                        key={specialty}
                        className="flex items-center justify-between p-2 bg-gray-50 rounded"
                      >
                        <span className="font-medium">{specialty}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">
                            {newEmployee.commissionRates[specialty]}%
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeSpecialty(specialty)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Button onClick={handleAddEmployee} className="w-full">
                Adicionar Funcionário
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {employees.map((employee) => (
          <Card key={employee.id}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback>
                    <AvatarInitials name={employee.name} />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <CardTitle className="text-lg">{employee.name}</CardTitle>
                  <CardDescription>{employee.email}</CardDescription>
                </div>
                <Badge
                  variant={
                    employee.status === "active" ? "default" : "secondary"
                  }
                >
                  {employee.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Desempenho Mensal</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Serviços:</span>
                    <span className="font-medium">
                      {employee.monthlyStats?.servicesCompleted ?? 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Receita:</span>
                    <span className="font-medium">
                      R${employee.monthlyStats?.totalRevenue ?? 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Comissão:</span>
                    <span className="font-medium text-green-600">
                      R${employee.monthlyStats?.totalCommission ?? 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Média/Serviço:</span>
                    <span className="font-medium">
                      R${employee.monthlyStats?.averageService ?? 0}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Especialidades & Taxas</h4>
                <div className="space-y-1">
                  {(employee.specialties || []).map((specialty) => (
                    <div
                      key={specialty}
                      className="flex justify-between items-center text-sm"
                    >
                      <span>{specialty}</span>
                      <Badge variant="outline" className="text-xs">
                        {employee.commissionRates?.[specialty] ?? 0}%
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 bg-transparent"
                >
                  <Edit className="h-3 w-3 mr-1" />
                  Editar
                </Button>
                <Button variant="outline" size="sm">
                  <DollarSign className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Commission Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Resumo de Comissões - Este Mês</CardTitle>
          <CardDescription>Total de comissões devidas aos funcionários</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {employees.map((employee) => (
              <div
                key={employee.id}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      <AvatarInitials name={employee.name} />
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{employee.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {employee.monthlyStats?.servicesCompleted ?? 0} serviços
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium">
                    R${employee.monthlyStats?.totalCommission ?? 0}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {employee.monthlyStats?.totalRevenue
                      ? (
                          (employee.monthlyStats.totalCommission /
                            employee.monthlyStats.totalRevenue) *
                          100
                        ).toFixed(1)
                      : 0}
                    % em média
                  </p>
                </div>
              </div>
            ))}
            <div className="border-t pt-4">
              <div className="flex justify-between items-center font-medium">
                <span>Total de Comissões:</span>
                <span className="text-lg">
                  R$
                  {employees.reduce(
                    (sum, emp) =>
                      sum + (emp.monthlyStats?.totalCommission ?? 0),
                    0
                  )}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
