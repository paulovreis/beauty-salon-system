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
import { axiosWithAuth } from "./api/axiosWithAuth.js";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [services, setServices] = useState([]);
  // Não precisa mais de availableServices, usaremos services diretamente
  const [newEmployee, setNewEmployee] = useState({
    name: "",
    email: "",
    phone: "",
    role: "",
    password: "",
    specialties: [], // [{ service_id, commission_rate }]
  });
  const [selectedSpecialty, setSelectedSpecialty] = useState("");
  const [commissionRate, setCommissionRate] = useState("");
  // Estado para edição
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null); // { ...employee, specialties: [{service_id, commission_rate, id}] }

  // Abre modal de edição e carrega especialidades do funcionário
  const handleEditClick = async (employee) => {
    setError("");
    try {
      // Busca especialidades do funcionário
      const res = await axiosWithAuth(`${API_URL}/employees/${employee.id}/specialties`, { method: "get" });
      let specialties = res.data || [];
      setEditingEmployee({ ...employee, specialties });
      setEditModalOpen(true);
    } catch (err) {
      setError("Erro ao carregar especialidades do funcionário");
    }
  };

  // Atualiza campos do funcionário em edição
  const handleEditField = (field, value) => {
    setEditingEmployee((prev) => ({ ...prev, [field]: value }));
  };

  // Adiciona especialidade na edição
  const handleAddEditSpecialty = (service_id, commission_rate) => {
    if (!service_id || !commission_rate) return;
    if (
      editingEmployee.specialties.some(
        (s) => s.service_id === Number(service_id)
      )
    )
      return;
    setEditingEmployee((prev) => ({
      ...prev,
      specialties: [
        ...prev.specialties,
        {
          service_id: Number(service_id),
          commission_rate: Number(commission_rate),
        },
      ],
    }));
  };

  // Remove especialidade na edição
  const handleRemoveEditSpecialty = (service_id) => {
    setEditingEmployee((prev) => ({
      ...prev,
      specialties: prev.specialties.filter((s) => s.service_id !== service_id),
    }));
  };

  // Atualiza taxa de comissão de uma especialidade na edição
  const handleEditSpecialtyRate = (service_id, newRate) => {
    setEditingEmployee((prev) => ({
      ...prev,
      specialties: prev.specialties.map((s) =>
        s.service_id === service_id
          ? { ...s, commission_rate: Number(newRate) }
          : s
      ),
    }));
  };

  // Salva edição do funcionário e especialidades
  const handleSaveEditEmployee = async () => {
    setError("");
    try {
      // Atualiza dados básicos
      await axiosWithAuth(`${API_URL}/employees/${editingEmployee.id}`, {
        method: "put",
        data: {
          name: editingEmployee.name,
          email: editingEmployee.email,
          phone: editingEmployee.phone,
          status: editingEmployee.status,
        },
      });

      // Busca especialidades atuais do backend
      const res = await axiosWithAuth(`${API_URL}/employees/${editingEmployee.id}/specialties`, { method: "get" });
      const currentSpecs = res.data || [];

      // Calcula especialidades a adicionar, atualizar e remover
      const toAdd = editingEmployee.specialties.filter(
        (s) => !currentSpecs.some((cs) => cs.service_id === s.service_id)
      );
      const toUpdate = editingEmployee.specialties.filter((s) =>
        currentSpecs.some(
          (cs) =>
            cs.service_id === s.service_id &&
            cs.commission_rate !== s.commission_rate
        )
      );
      const toRemove = currentSpecs.filter(
        (cs) =>
          !editingEmployee.specialties.some(
            (s) => s.service_id === cs.service_id
          )
      );

      // Adiciona novas especialidades
      for (const spec of toAdd) {
        await axiosWithAuth(`${API_URL}/employees/${editingEmployee.id}/specialties`, {
          method: "post",
          data: {
            service_id: spec.service_id,
            commission_rate: spec.commission_rate,
          },
        });
      }
      // Atualiza taxas
      for (const spec of toUpdate) {
        const specId = currentSpecs.find(
          (cs) => cs.service_id === spec.service_id
        )?.id;
        if (specId) {
          await axiosWithAuth(`${API_URL}/employees/${editingEmployee.id}/specialties/${specId}`, {
            method: "put",
            data: { commission_rate: spec.commission_rate },
          });
        }
      }
      // Remove especialidades
      for (const spec of toRemove) {
        await axiosWithAuth(`${API_URL}/employees/${editingEmployee.id}/specialties/${spec.id}`, {
          method: "delete",
        });
      }

      // Atualiza lista
      const reload = await axiosWithAuth(`${API_URL}/employees`, { method: "get" });
      setEmployees(reload.data);
      setEditModalOpen(false);
      setEditingEmployee(null);
    } catch (err) {
      setError("Erro ao salvar edição do funcionário");
    }
  };

  // Carregar funcionários e serviços do backend
  useEffect(() => {
    async function fetchEmployees() {
      setLoading(true);
      setError("");
      try {
        const res = await axiosWithAuth(`${API_URL}/employees`, { method: "get" });
        setEmployees(res.data);
      } catch (err) {
        setError("Erro ao carregar funcionários.");
      } finally {
        setLoading(false);
      }
    }
    async function fetchServices() {
      try {
        const res = await axiosWithAuth(`${API_URL}/services`, { method: "get" });
        setServices(res.data);
      } catch (err) { }
    }
    fetchEmployees();
    fetchServices();
    // Refetch quando agendamentos mudarem (evento disparado em Scheduling.jsx)
    const handler = () => fetchEmployees();
    window.addEventListener('appointments:changed', handler);
    return () => window.removeEventListener('appointments:changed', handler);
  }, []);

  // Adiciona especialidade (usando id do serviço)
  const addSpecialty = () => {
    if (selectedSpecialty && commissionRate) {
      if (
        newEmployee.specialties.some(
          (s) => s.service_id === Number(selectedSpecialty)
        )
      )
        return;
      setNewEmployee({
        ...newEmployee,
        specialties: [
          ...newEmployee.specialties,
          {
            service_id: Number(selectedSpecialty),
            commission_rate: Number(commissionRate),
          },
        ],
      });
      setSelectedSpecialty("");
      setCommissionRate("");
    }
  };

  const removeSpecialty = (service_id) => {
    setNewEmployee({
      ...newEmployee,
      specialties: newEmployee.specialties.filter(
        (s) => s.service_id !== service_id
      ),
    });
  };

  // Adicionar funcionário (integração backend)
  const handleAddEmployee = async () => {
    setError("");
    try {
      // Cria funcionário
      const res = await axiosWithAuth(`${API_URL}/employees`, {
        method: "post",
        data: {
          name: newEmployee.name,
          email: newEmployee.email,
          phone: newEmployee.phone,
          role: newEmployee.role,
          password: newEmployee.password
        },
      });
      if (res.status === 409) {
        setError("E-mail já cadastrado");
        return;
      }
      const created = res.data;
      // Adiciona especialidades
      for (const spec of newEmployee.specialties) {
        await axiosWithAuth(`${API_URL}/employees/${created.id}/specialties`, {
          method: "post",
          data: spec,
        });
      }
      // Recarrega lista
      const reload = await axiosWithAuth(`${API_URL}/employees`, { method: "get" });
      setEmployees(reload.data);
      setNewEmployee({ name: "", email: "", phone: "", specialties: [] });
    } catch (err) {
      setError(err.message || "Erro ao criar funcionário");
    }
  };

  // Deletar funcionário
  const handleDeleteEmployee = async (id) => {
    if (!window.confirm("Tem certeza que deseja excluir este funcionário?")) return;
    setError("");
    try {
      await axiosWithAuth(`${API_URL}/employees/${id}`, { method: "delete" });
      // Atualiza lista
      setEmployees((prev) => prev.filter((emp) => emp.id !== id));
    } catch (err) {
      setError(err.message || "Erro ao excluir funcionário");
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
              Adicionar Funcionário
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="employeePassword">Senha</Label>
                  <Input
                    id="employeePassword"
                    value={newEmployee.password}
                    onChange={(e) =>
                      setNewEmployee({ ...newEmployee, password: e.target.value })
                    }
                    type="password"
                  />
                </div>
                <div>
                  <Select
                    value={newEmployee.role}
                    onValueChange={(v) => setNewEmployee({ ...newEmployee, role: v})}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Selecione o cargo" />
                    </SelectTrigger>
                    <SelectContent>
                          <SelectItem key={'employee'} value={'employee'}>
                            Empregado
                          </SelectItem>
                          <SelectItem key={'owner'} value={'owner'}>
                            Dono
                          </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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
                      {services
                        .filter(
                          (service) =>
                            !newEmployee.specialties.some((s) => s.service_id === service.id)
                        )
                        .map((service) => (
                          <SelectItem key={service.id} value={String(service.id)}>
                            {service.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    placeholder="Comissão %"
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
                    {newEmployee.specialties.map((spec) => {
                      const service = services.find((s) => s.id === spec.service_id);
                      return (
                        <div
                          key={spec.service_id}
                          className="flex items-center justify-between p-2 bg-gray-50 rounded"
                        >
                          <span className="font-medium">{service ? service.name : spec.service_id}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">{spec.commission_rate}%</Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeSpecialty(spec.service_id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
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
                    <span className="text-muted-foreground">
                      Média/Serviço:
                    </span>
                    <span className="font-medium">
                      R${employee.monthlyStats?.averageService ?? 0}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Especialidades & Taxas</h4>
                <div className="space-y-1">
                  {(employee.specialties || []).map((spec) => {
                    const service = services.find((s) => s.id === (spec.service_id || spec));
                    const commission = spec.commission_rate || (employee.commissionRates?.[spec] ?? 0);
                    return (
                      <div
                        key={spec.service_id || spec}
                        className="flex justify-between items-center text-sm"
                      >
                        <span>{service ? service.name : spec.service_id || spec}</span>
                        <Badge variant="outline" className="text-xs">
                          {commission}%
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 bg-transparent"
                  onClick={() => handleEditClick(employee)}
                >
                  <Edit className="h-3 w-3 mr-1" />
                  Editar
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDeleteEmployee(employee.id)}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Excluir
                </Button>
                {/* Modal de edição de funcionário */}
                {editModalOpen && editingEmployee && (
                  <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Editar Funcionário</DialogTitle>
                        <DialogDescription>
                          Edite os dados e especialidades do funcionário
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="editEmployeeName">
                              Nome Completo
                            </Label>
                            <Input
                              id="editEmployeeName"
                              value={editingEmployee.name}
                              onChange={(e) =>
                                handleEditField("name", e.target.value)
                              }
                            />
                          </div>
                          <div>
                            <Label htmlFor="editEmployeeEmail">E-mail</Label>
                            <Input
                              id="editEmployeeEmail"
                              value={editingEmployee.email}
                              onChange={(e) =>
                                handleEditField("email", e.target.value)
                              }
                            />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="editEmployeePhone">Telefone</Label>
                          <Input
                            id="editEmployeePhone"
                            value={editingEmployee.phone}
                            onChange={(e) =>
                              handleEditField("phone", e.target.value)
                            }
                          />
                        </div>
                        <div>
                          <Label>Status</Label>
                          <Select
                            value={editingEmployee.status}
                            onValueChange={(v) => handleEditField("status", v)}
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue placeholder="Selecione o status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">Ativo</SelectItem>
                              <SelectItem value="inactive">Inativo</SelectItem>
                            </SelectContent>
                          </Select>
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
                                {services
                                  .filter(
                                    (s) =>
                                      !editingEmployee.specialties.some(
                                        (es) => es.service_id === s.id
                                      )
                                  )
                                  .map((service) => (
                                    <SelectItem
                                      key={service.id}
                                      value={String(service.id)}
                                    >
                                      {service.name}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                            <Input
                              type="number"
                              placeholder="Comissão %"
                              value={commissionRate}
                              onChange={(e) =>
                                setCommissionRate(e.target.value)
                              }
                              className="w-32"
                            />
                            <Button
                              onClick={() => {
                                handleAddEditSpecialty(
                                  selectedSpecialty,
                                  commissionRate
                                );
                                setSelectedSpecialty("");
                                setCommissionRate("");
                              }}
                              disabled={!selectedSpecialty || !commissionRate}
                            >
                              Adicionar
                            </Button>
                          </div>
                          {editingEmployee.specialties.length > 0 && (
                            <div className="space-y-2">
                              {editingEmployee.specialties.map((spec) => {
                                const service = services.find(
                                  (s) => s.id === spec.service_id
                                );
                                return (
                                  <div
                                    key={spec.service_id}
                                    className="flex items-center justify-between p-2 bg-gray-50 rounded"
                                  >
                                    <span className="font-medium">
                                      {service ? service.name : spec.service_id}
                                    </span>
                                    <div className="flex items-center gap-2">
                                      <Input
                                        type="number"
                                        value={spec.commission_rate}
                                        onChange={(e) =>
                                          handleEditSpecialtyRate(
                                            spec.service_id,
                                            e.target.value
                                          )
                                        }
                                        className="w-20"
                                      />
                                      <span>%</span>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                          handleRemoveEditSpecialty(
                                            spec.service_id
                                          )
                                        }
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        <Button
                          onClick={handleSaveEditEmployee}
                          className="w-full"
                        >
                          Salvar Alterações
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
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
          <CardDescription>
            Total de comissões devidas aos funcionários
          </CardDescription>
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
