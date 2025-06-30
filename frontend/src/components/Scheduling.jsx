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
import { Calendar } from "./ui/calendar"
import { Textarea } from "./ui/textarea"
import { Avatar, AvatarFallback, AvatarInitials } from "./ui/avatar"
import { Plus, Clock, User, CalendarIcon, Edit, Trash2, Phone } from "lucide-react"

export default function Scheduling() {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [appointments, setAppointments] = useState([
    {
      id: 1,
      clientName: "Maria Silva",
      clientPhone: "(11) 99999-1111",
      service: "Coloração de Cabelo",
      employee: "Ana Costa",
      date: "2024-01-31",
      time: "09:00",
      duration: 120,
      price: 180,
      status: "confirmado",
      notes: "Primeira vez, deseja luzes loiras",
    },
    {
      id: 2,
      clientName: "Julia Santos",
      clientPhone: "(11) 99999-2222",
      service: "Progressiva",
      employee: "Carla Lima",
      date: "2024-01-31",
      time: "10:30",
      duration: 180,
      price: 250,
      status: "confirmado",
      notes: "Cliente regular, prefere marca específica",
    },
    {
      id: 3,
      clientName: "Pedro Oliveira",
      clientPhone: "(11) 99999-3333",
      service: "Corte",
      employee: "Ana Costa",
      date: "2024-01-31",
      time: "14:00",
      duration: 45,
      price: 45,
      status: "pendente",
      notes: "",
    },
    {
      id: 4,
      clientName: "Lucia Ferreira",
      clientPhone: "(11) 99999-4444",
      service: "Manicure",
      employee: "Beatriz Souza",
      date: "2024-01-31",
      time: "15:30",
      duration: 45,
      price: 35,
      status: "confirmado",
      notes: "Prefere esmalte em gel",
    },
  ])

  const [newAppointment, setNewAppointment] = useState({
    clientName: "",
    clientPhone: "",
    service: "",
    employee: "",
    date: "",
    time: "",
    notes: "",
  })

  const employees = [
    { name: "Ana Costa", specialties: ["Coloração de Cabelo", "Progressiva", "Corte"] },
    { name: "Carla Lima", specialties: ["Progressiva", "Queratina", "Tratamento Capilar"] },
    { name: "Beatriz Souza", specialties: ["Manicure", "Pedicure", "Nail Art"] },
  ]

  const services = [
    { name: "Coloração de Cabelo", duration: 120, price: 180 },
    { name: "Progressiva", duration: 180, price: 250 },
    { name: "Corte", duration: 45, price: 45 },
    { name: "Manicure", duration: 45, price: 35 },
    { name: "Pedicure", duration: 60, price: 40 },
    { name: "Queratina", duration: 150, price: 200 },
  ]

  const timeSlots = [
    "08:00",
    "08:30",
    "09:00",
    "09:30",
    "10:00",
    "10:30",
    "11:00",
    "11:30",
    "12:00",
    "12:30",
    "13:00",
    "13:30",
    "14:00",
    "14:30",
    "15:00",
    "15:30",
    "16:00",
    "16:30",
    "17:00",
    "17:30",
    "18:00",
  ]

  const getStatusColor = (status) => {
    switch (status) {
      case "confirmado":
        return "default"
      case "pendente":
        return "secondary"
      case "completo":
        return "outline"
      case "cancelado":
        return "destructive"
      default:
        return "default"
    }
  }

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    })
  }

  const getAvailableEmployees = (service) => {
    return employees.filter((emp) => emp.specialties.includes(service))
  }

  const getServiceDetails = (serviceName) => {
    return services.find((s) => s.name === serviceName)
  }

  const handleAddAppointment = () => {
    if (
      newAppointment.clientName &&
      newAppointment.service &&
      newAppointment.employee &&
      newAppointment.date &&
      newAppointment.time
    ) {
      const serviceDetails = getServiceDetails(newAppointment.service)

      const appointment = {
        id: appointments.length + 1,
        ...newAppointment,
        duration: serviceDetails?.duration || 60,
        price: serviceDetails?.price || 0,
        status: "pendente",
      }

      setAppointments([...appointments, appointment])
      setNewAppointment({
        clientName: "",
        clientPhone: "",
        service: "",
        employee: "",
        date: "",
        time: "",
        notes: "",
      })
    }
  }

  const todayAppointments = appointments.filter((apt) => apt.date === selectedDate.toISOString().split("T")[0])
  const upcomingAppointments = appointments.filter((apt) => new Date(apt.date) > new Date()).slice(0, 5)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold">Agendamento de Consultas</h2>
          <p className="text-muted-foreground">Gerencie os agendamentos dos clientes e a agenda dos funcionários</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Agendamento
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Agendar Novo Atendimento</DialogTitle>
              <DialogDescription>Reserve um novo horário para um cliente</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="clientName">Nome do Cliente</Label>
                  <Input
                    id="clientName"
                    value={newAppointment.clientName}
                    onChange={(e) => setNewAppointment({ ...newAppointment, clientName: e.target.value })}
                    placeholder="Maria Silva"
                  />
                </div>
                <div>
                  <Label htmlFor="clientPhone">Telefone</Label>
                  <Input
                    id="clientPhone"
                    value={newAppointment.clientPhone}
                    onChange={(e) => setNewAppointment({ ...newAppointment, clientPhone: e.target.value })}
                    placeholder="(11) 99999-1111"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="service">Serviço</Label>
                <Select
                  value={newAppointment.service}
                  onValueChange={(value) => {
                    setNewAppointment({ ...newAppointment, service: value, employee: "" })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o serviço" />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map((service) => (
                      <SelectItem key={service.name} value={service.name}>
                        {service.name} - {service.duration}min - R${service.price}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="employee">Funcionário</Label>
                <Select
                  value={newAppointment.employee}
                  onValueChange={(value) => setNewAppointment({ ...newAppointment, employee: value })}
                  disabled={!newAppointment.service}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o funcionário" />
                  </SelectTrigger>
                  <SelectContent>
                    {newAppointment.service &&
                      getAvailableEmployees(newAppointment.service).map((employee) => (
                        <SelectItem key={employee.name} value={employee.name}>
                          {employee.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="date">Data</Label>
                  <Input
                    id="date"
                    type="date"
                    value={newAppointment.date}
                    onChange={(e) => setNewAppointment({ ...newAppointment, date: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="time">Horário</Label>
                  <Select
                    value={newAppointment.time}
                    onValueChange={(value) => setNewAppointment({ ...newAppointment, time: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o horário" />
                    </SelectTrigger>
                    <SelectContent>
                      {timeSlots.map((time) => (
                        <SelectItem key={time} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  value={newAppointment.notes}
                  onChange={(e) => setNewAppointment({ ...newAppointment, notes: e.target.value })}
                  placeholder="Solicitações ou observações especiais..."
                />
              </div>

              <Button onClick={handleAddAppointment} className="w-full">
                Agendar Atendimento
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Calendar */}
        <Card>
          <CardHeader>
            <CardTitle>Calendário</CardTitle>
            <CardDescription>Selecione uma data para ver os agendamentos</CardDescription>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              className="rounded-md border"
            />
          </CardContent>
        </Card>

        {/* Today's Schedule */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              {formatDate(selectedDate.toISOString().split("T")[0])} Agenda
            </CardTitle>
            <CardDescription>{todayAppointments.length} agendamentos para hoje</CardDescription>
          </CardHeader>
          <CardContent>
            {todayAppointments.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhum agendamento para esta data</p>
            ) : (
              <div className="space-y-4">
                {todayAppointments
                  .sort((a, b) => a.time.localeCompare(b.time))
                  .map((appointment) => (
                    <div key={appointment.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="text-center">
                          <div className="font-medium">{appointment.time}</div>
                          <div className="text-xs text-muted-foreground">{appointment.duration}min</div>
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">{appointment.clientName}</div>
                          <div className="text-sm text-muted-foreground">{appointment.service}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {appointment.employee}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={getStatusColor(appointment.status)} className="mb-1">
                          {appointment.status}
                        </Badge>
                        <div className="text-sm font-medium">R${appointment.price}</div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Appointments */}
      <Card>
        <CardHeader>
          <CardTitle>Próximos Agendamentos</CardTitle>
          <CardDescription>Próximos 5 agendamentos</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {upcomingAppointments.map((appointment) => (
              <div key={appointment.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <Avatar>
                    <AvatarFallback>
                      <AvatarInitials name={appointment.clientName} />
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{appointment.clientName}</div>
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <Phone className="h-3 w-3" />
                      {appointment.clientPhone}
                    </div>
                  </div>
                  <div>
                    <div className="font-medium">{appointment.service}</div>
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {appointment.employee}
                    </div>
                  </div>
                  <div>
                    <div className="font-medium">{formatDate(appointment.date)}</div>
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {appointment.time} ({appointment.duration}min)
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={getStatusColor(appointment.status)}>{appointment.status}</Badge>
                  <div className="text-right">
                    <div className="font-medium">R${appointment.price}</div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm">
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Employee Schedule Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Resumo da Agenda dos Funcionários</CardTitle>
          <CardDescription>Carga de trabalho de hoje por funcionário</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {employees.map((employee) => {
              const employeeAppointments = todayAppointments.filter((apt) => apt.employee === employee.name)
              const totalRevenue = employeeAppointments.reduce((sum, apt) => sum + apt.price, 0)
              const totalDuration = employeeAppointments.reduce((sum, apt) => sum + apt.duration, 0)

              return (
                <div key={employee.name} className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>
                        <AvatarInitials name={employee.name} />
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{employee.name}</div>
                      <div className="text-xs text-muted-foreground">{employeeAppointments.length} agendamentos</div>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total de Horas:</span>
                      <span className="font-medium">
                        {Math.floor(totalDuration / 60)}h {totalDuration % 60}m
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Receita:</span>
                      <span className="font-medium">R${totalRevenue}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Comissão:</span>
                      <span className="font-medium text-green-600">R${Math.round(totalRevenue * 0.2)}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
