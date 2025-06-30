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
import { Avatar, AvatarFallback, AvatarInitials } from "./ui/avatar"
import { Plus, Edit, Trash2, DollarSign } from "lucide-react"

export default function Employees() {
  const [employees, setEmployees] = useState([
    {
      id: 1,
      name: "Ana Costa",
      email: "ana@salon.com",
      phone: "(11) 99999-1111",
      specialties: ["Coloração de Cabelo", "Progressiva"],
      commissionRates: {
        "Coloração de Cabelo": 20,
        Progressiva: 25,
        Corte: 15,
      },
      monthlyStats: {
        servicesCompleted: 45,
        totalRevenue: 3200,
        totalCommission: 640,
        averageService: 71,
      },
      status: "ativo",
    },
    {
      id: 2,
      name: "Carla Lima",
      email: "carla@salon.com",
      phone: "(11) 99999-2222",
      specialties: ["Progressiva", "Queratina"],
      commissionRates: {
        Progressiva: 25,
        Queratina: 22,
        "Tratamento Capilar": 18,
      },
      monthlyStats: {
        servicesCompleted: 38,
        totalRevenue: 2850,
        totalCommission: 570,
        averageService: 75,
      },
      status: "ativo",
    },
    {
      id: 3,
      name: "Beatriz Souza",
      email: "beatriz@salon.com",
      phone: "(11) 99999-3333",
      specialties: ["Manicure", "Pedicure"],
      commissionRates: {
        Manicure: 30,
        Pedicure: 30,
        "Nail Art": 35,
      },
      monthlyStats: {
        servicesCompleted: 42,
        totalRevenue: 2100,
        totalCommission: 420,
        averageService: 50,
      },
      status: "ativo",
    },
  ])

  const [newEmployee, setNewEmployee] = useState({
    name: "",
    email: "",
    phone: "",
    specialties: [],
    commissionRates: {},
  })

  const [selectedSpecialty, setSelectedSpecialty] = useState("")
  const [commissionRate, setCommissionRate] = useState("")

  const availableServices = [
    "Coloração de Cabelo",
    "Progressiva",
    "Corte",
    "Queratina",
    "Tratamento Capilar",
    "Manicure",
    "Pedicure",
    "Nail Art",
    "Facial",
    "Sobrancelha",
  ]

  const addSpecialty = () => {
    if (selectedSpecialty && commissionRate) {
      setNewEmployee({
        ...newEmployee,
        specialties: [...newEmployee.specialties, selectedSpecialty],
        commissionRates: {
          ...newEmployee.commissionRates,
          [selectedSpecialty]: Number.parseInt(commissionRate),
        },
      })
      setSelectedSpecialty("")
      setCommissionRate("")
    }
  }

  const removeSpecialty = (specialty) => {
    const updatedSpecialties = newEmployee.specialties.filter((s) => s !== specialty)
    const updatedRates = { ...newEmployee.commissionRates }
    delete updatedRates[specialty]

    setNewEmployee({
      ...newEmployee,
      specialties: updatedSpecialties,
      commissionRates: updatedRates,
    })
  }

  const handleAddEmployee = () => {
    if (newEmployee.name && newEmployee.email && newEmployee.specialties.length > 0) {
      const employee = {
        id: employees.length + 1,
        ...newEmployee,
        monthlyStats: {
          servicesCompleted: 0,
          totalRevenue: 0,
          totalCommission: 0,
          averageService: 0,
        },
        status: "active",
      }

      setEmployees([...employees, employee])
      setNewEmployee({
        name: "",
        email: "",
        phone: "",
        specialties: [],
        commissionRates: {},
      })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold">Employee Management</h2>
          <p className="text-muted-foreground">Manage staff and commission structures</p>
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
              <DialogTitle>Add New Employee</DialogTitle>
              <DialogDescription>Create a new employee profile with commission rates</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="employeeName">Full Name</Label>
                  <Input
                    id="employeeName"
                    value={newEmployee.name}
                    onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                    placeholder="Ana Costa"
                  />
                </div>
                <div>
                  <Label htmlFor="employeeEmail">Email</Label>
                  <Input
                    id="employeeEmail"
                    type="email"
                    value={newEmployee.email}
                    onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                    placeholder="ana@salon.com"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="employeePhone">Phone</Label>
                <Input
                  id="employeePhone"
                  value={newEmployee.phone}
                  onChange={(e) => setNewEmployee({ ...newEmployee, phone: e.target.value })}
                  placeholder="(11) 99999-1111"
                />
              </div>

              <div className="space-y-3">
                <Label>Specialties & Commission Rates</Label>
                <div className="flex gap-2">
                  <Select value={selectedSpecialty} onValueChange={setSelectedSpecialty}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select service" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableServices
                        .filter((service) => !newEmployee.specialties.includes(service))
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
                  <Button onClick={addSpecialty} disabled={!selectedSpecialty || !commissionRate}>
                    Add
                  </Button>
                </div>

                {newEmployee.specialties.length > 0 && (
                  <div className="space-y-2">
                    {newEmployee.specialties.map((specialty) => (
                      <div key={specialty} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="font-medium">{specialty}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{newEmployee.commissionRates[specialty]}%</Badge>
                          <Button variant="ghost" size="sm" onClick={() => removeSpecialty(specialty)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Button onClick={handleAddEmployee} className="w-full">
                Add Employee
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
                <Badge variant={employee.status === "active" ? "default" : "secondary"}>{employee.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Monthly Performance</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Services:</span>
                    <span className="font-medium">{employee.monthlyStats.servicesCompleted}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Revenue:</span>
                    <span className="font-medium">R${employee.monthlyStats.totalRevenue}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Commission:</span>
                    <span className="font-medium text-green-600">R${employee.monthlyStats.totalCommission}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Avg/Service:</span>
                    <span className="font-medium">R${employee.monthlyStats.averageService}</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Specialties & Rates</h4>
                <div className="space-y-1">
                  {employee.specialties.map((specialty) => (
                    <div key={specialty} className="flex justify-between items-center text-sm">
                      <span>{specialty}</span>
                      <Badge variant="outline" className="text-xs">
                        {employee.commissionRates[specialty]}%
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 bg-transparent">
                  <Edit className="h-3 w-3 mr-1" />
                  Edit
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
          <CardTitle>Commission Summary - This Month</CardTitle>
          <CardDescription>Total commissions owed to employees</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {employees.map((employee) => (
              <div key={employee.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      <AvatarInitials name={employee.name} />
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{employee.name}</p>
                    <p className="text-sm text-muted-foreground">{employee.monthlyStats.servicesCompleted} services</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium">R${employee.monthlyStats.totalCommission}</p>
                  <p className="text-sm text-muted-foreground">
                    {((employee.monthlyStats.totalCommission / employee.monthlyStats.totalRevenue) * 100).toFixed(1)}%
                    avg rate
                  </p>
                </div>
              </div>
            ))}
            <div className="border-t pt-4">
              <div className="flex justify-between items-center font-medium">
                <span>Total Commissions:</span>
                <span className="text-lg">
                  R${employees.reduce((sum, emp) => sum + emp.monthlyStats.totalCommission, 0)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
