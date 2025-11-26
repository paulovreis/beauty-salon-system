import { useEffect, useMemo, useRef, useState } from "react"
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
import { Plus, Clock, User, CalendarIcon, Edit, Trash2, Phone, ChevronDown, Check, XCircle } from "lucide-react"
import { axiosWithAuth } from "./api/axiosWithAuth"
import { SchedulingApi, ClientsApi } from "./api/scheduling"

export default function Scheduling() {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(false)

  const [newAppointment, setNewAppointment] = useState({
    clientName: "",
    clientPhone: "",
    serviceId: "",
    employeeId: "",
    date: "",
    time: "",
    notes: "",
  })

  const [employees, setEmployees] = useState([])
  const [services, setServices] = useState([])
  const [availableSlots, setAvailableSlots] = useState([])
  const [nextFive, setNextFive] = useState([])
  const [upcoming, setUpcoming] = useState([])
  const [upcomingLimit, setUpcomingLimit] = useState(10)
  const [upcomingOffset, setUpcomingOffset] = useState(0)
  const [upcomingHasMore, setUpcomingHasMore] = useState(true)
  const [upcomingTotal, setUpcomingTotal] = useState(null)
  const [upcomingLoading, setUpcomingLoading] = useState(false)
  // Delete confirmation dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [statusMenuOpenId, setStatusMenuOpenId] = useState(null)
  const statusMenuRef = useRef(null)
  const [clientSearch, setClientSearch] = useState('')
  const [clientResults, setClientResults] = useState([])
  const [showClientDropdown, setShowClientDropdown] = useState(false)
  const [editing, setEditing] = useState(null)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [toast, setToast] = useState(null) // {type,message}
  // Payment modal state
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)
  const [paymentTarget, setPaymentTarget] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const paymentMethods = [
    { value: 'cash', label: 'Dinheiro' },
    { value: 'credit', label: 'Crédito' },
    { value: 'debit', label: 'Débito' },
    { value: 'pix', label: 'PIX' },
    { value: 'transfer', label: 'Transferência' },
    { value: 'boleto', label: 'Boleto' },
  ]
  const statusOptions = [
    { value: 'scheduled', label: 'pendente' },
    { value: 'confirmed', label: 'confirmado' },
    { value: 'completed', label: 'completo' },
    { value: 'canceled', label: 'cancelado' },
  ]

  const decodeJwt = (token) => {
    try {
      const payload = token.split('.')[1]
      const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
      return JSON.parse(json)
    } catch {
      return null
    }
  }

  // Load employees and services once
  useEffect(() => {
    (async () => {
      try {
        // Employees with fallback if role is employee
        let employeesData = []
        try {
          const empRes = await axiosWithAuth('/employees')
          employeesData = empRes.data || []
        } catch (e) {
          const token = localStorage.getItem('token')
          const decoded = token ? decodeJwt(token) : null
          if (decoded?.id) {
            const selfRes = await axiosWithAuth(`/employees/${decoded.id}`)
            if (selfRes?.data) employeesData = [selfRes.data]
          }
        }
        const svcRes = await axiosWithAuth('/services')
        setEmployees(employeesData)
        setServices(svcRes.data || [])
      } catch (e) {
        console.error('Falha ao carregar listas:', e)
      }
    })()
  }, [])

  // Load appointments when selectedDate changes
  useEffect(() => {
    (async () => {
      try {
        setLoading(true)
        const d = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`
        console.log('Carregando agendamentos para data:', d)
        const data = await SchedulingApi.getByDate(d)
        console.log('Dados recebidos da API:', data)
        const mapped = (data || []).map((a) => ({
          id: a.id,
          clientName: a.client_name,
          clientPhone: a.client_phone || '',
          service: a.service_name,
          employee: a.employee_name,
          employeeId: a.employee_id, // usar id para cálculos mais confiáveis
          date: a.appointment_date,
          time: a.appointment_time?.slice(0,5),
          duration: a.duration_minutes,
          price: Number(a.price || 0),
          status: a.status,
          notes: a.notes || '',
          commissionAmount: a.commission_amount != null ? Number(a.commission_amount) : null,
        }))
        console.log('Agendamentos mapeados:', mapped)
        setAppointments(mapped)
      } catch (e) {
        console.error('Falha ao carregar agendamentos:', e)
      } finally {
        setLoading(false)
      }
    })()
  }, [selectedDate])

  // Load available slots when employee/date/service changes in dialog
  useEffect(() => {
    (async () => {
      if (!newAppointment.employeeId || !newAppointment.date || !newAppointment.serviceId) {
        setAvailableSlots([])
        return
      }
      try {
        const slots = await SchedulingApi.getAvailableSlots(
          newAppointment.employeeId, 
          newAppointment.date, 
          newAppointment.serviceId
        )
        setAvailableSlots(slots || [])
      } catch (e) {
        console.error('Falha ao carregar horários disponíveis:', e)
        setAvailableSlots([])
      }
    })()
  }, [newAppointment.employeeId, newAppointment.date, newAppointment.serviceId, appointments])

  // Load next five upcoming
  useEffect(() => {
    loadNextFive()
    loadUpcoming(true)
  }, [])

  // Outside click for status dropdown & client dropdown
  useEffect(()=>{
    const handler = (e)=>{
      if(statusMenuOpenId){
        const menu = document.querySelector('[data-status-menu="true"]');
        if(menu && !menu.contains(e.target)) setStatusMenuOpenId(null)
      }
      if(showClientDropdown){
        const dd = document.getElementById('client-autocomplete');
        if(dd && !dd.contains(e.target)) setShowClientDropdown(false)
      }
    };
    document.addEventListener('mousedown', handler);
    return ()=> document.removeEventListener('mousedown', handler);
  },[statusMenuOpenId, showClientDropdown])

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

  const statusLabel = (status) => {
    const s = (status || '').toLowerCase()
    if (s === 'scheduled' || s === 'pendente') return 'pendente'
    if (s === 'confirmed' || s === 'confirmado') return 'confirmado'
    if (s === 'completed' || s === 'completo') return 'completo'
    if (s === 'canceled' || s === 'cancelado') return 'cancelado'
    return status || 'pendente'
  }
  const getStatusColor = (status) => {
    const s = statusLabel(status)
    switch (s) {
      case 'confirmado':
        return 'default'
      case 'pendente':
        return 'secondary'
      case 'completo':
        return 'outline'
      case 'cancelado':
        return 'destructive'
      default:
        return 'default'
    }
  }

  const formatDate = (val) => {
    // Estratégia definitiva: trabalhar sempre com a substring YYYY-MM-DD e montar label sem usar parsing de string ISO (evita TZ)
    try {
      let ds = ''
      if (typeof val === 'string') ds = val.slice(0,10) // pega os 10 primeiros caracteres se vier 'YYYY-MM-DD...' ou ISO
      else if (val instanceof Date) {
        const y = val.getFullYear();
        const m = String(val.getMonth()+1).padStart(2,'0');
        const d = String(val.getDate()).padStart(2,'0');
        ds = `${y}-${m}-${d}`
      } else return 'Data inválida'
      if(!/^\d{4}-\d{2}-\d{2}$/.test(ds)) return 'Data inválida'
      const [y,m,d] = ds.split('-').map(Number)
      const localDate = new Date(y, m-1, d) // local, não sofre rollback porque usamos componentes
      const weekdays = ['dom.','seg.','ter.','qua.','qui.','sex.','sáb.']
      const months = ['jan.','fev.','mar.','abr.','mai.','jun.','jul.','ago.','set.','out.','nov.','dez.']
      return `${weekdays[localDate.getDay()]} ${d} de ${months[m-1]}`
    } catch(err){
      console.error('Erro ao formatar data:', err, val)
      return 'Data inválida'
    }
  }

  const getAvailableEmployees = (serviceId) => {
    // If using specialties table would filter by serviceId; for now return all employees
    return employees
  }

  const getServiceDetails = (serviceId) => services.find((s) => String(s.id) === String(serviceId))

  // Função auxiliar para converter horário em minutos (mantida para validações locais se necessário)
  const timeToMinutes = (timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number)
    return hours * 60 + minutes
  }

  const handleAddAppointment = async () => {
    if (!newAppointment.clientName || !newAppointment.employeeId || !newAppointment.serviceId || !newAppointment.date || !newAppointment.time) return
    
    try {
      const payload = {
        appointment_date: newAppointment.date,
        appointment_time: newAppointment.time,
        employee_id: Number(newAppointment.employeeId),
        service_id: Number(newAppointment.serviceId),
        client_name: newAppointment.clientName,
        client_phone: newAppointment.clientPhone,
        notes: newAppointment.notes,
      }
      await SchedulingApi.create(payload)
      // refresh list
      const d = newAppointment.date
      const data = await SchedulingApi.getByDate(d)
      const mapped = (data || []).map((a) => ({
        id: a.id,
        clientName: a.client_name,
        clientPhone: a.client_phone || '',
        service: a.service_name,
        employee: a.employee_name,
        date: (a.appointment_date||'').slice(0,10),
        time: a.appointment_time?.slice(0,5),
        duration: a.duration_minutes,
        price: Number(a.price || 0),
        status: a.status,
        notes: a.notes || '',
      }))
      setAppointments(mapped)
      setNewAppointment({ clientName: "", clientPhone: "", serviceId: "", employeeId: "", date: "", time: "", notes: "" })
      
      // Recarregar slots disponíveis após criar agendamento
      if (newAppointment.date === `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`) {
        // Se foi criado na data atualmente selecionada, recarregar slots
        try {
          const slots = await SchedulingApi.getAvailableSlots(
            newAppointment.employeeId,
            newAppointment.date,
            newAppointment.serviceId
          )
          setAvailableSlots(slots || [])
        } catch (e) {
          console.error('Erro ao recarregar slots:', e)
          setAvailableSlots([])
        }
      } else {
        setAvailableSlots([])
      }
      
      // Refresh next five as well
      await Promise.all([loadNextFive(), loadUpcoming(true)])
      setToast({type:'success', message:'Agendamento criado'})
  window.dispatchEvent(new CustomEvent('appointments:changed'))
    } catch (e) {
      console.error('Erro ao criar agendamento:', e)
      setToast({type:'error', message:'Erro ao criar: '+(e.response?.data?.message || e.message)})
    }
  }

  const handleEditAppointment = async (appointment) => {
    try {
      // Buscar dados completos (para garantir IDs corretos se necessários)
      const res = await axiosWithAuth(`/scheduling/${appointment.id}`)
      const a = res.data
      
      // Formatar a data corretamente para o input date
      let formattedDate = a.appointment_date
      if (formattedDate && typeof formattedDate === 'string') {
        // Se a data vem com timestamp, pegar apenas a parte da data
        formattedDate = formattedDate.split('T')[0]
      }
      
      setEditing({
        id: a.id,
        clientId: a.client_id,
        employeeId: String(a.employee_id),
        serviceId: String(a.service_id),
        date: formattedDate,
        time: a.appointment_time?.slice(0,5),
        notes: a.notes || ''
      })
      // Pré-carrega slots disponíveis do funcionário/data/serviço atuais
      if(a.employee_id && a.appointment_date && a.service_id){
        try {
          const slots = await SchedulingApi.getAvailableSlots(
            a.employee_id, 
            a.appointment_date.slice(0,10), 
            a.service_id, 
            a.id
          )
          setAvailableSlots(slots || [])
        }catch(e){
          console.error('Erro ao carregar slots para edição:', e)
          setAvailableSlots([])
        }
      }
      setEditModalOpen(true)
    }catch(err){
      setToast({type:'error', message:'Falha ao carregar agendamento para edição'})
    }
  }

  const handleSaveEdit = async () => {
    if(!editing) return;
    
    // Validar campos obrigatórios
    if (!editing.date || !editing.time || !editing.employeeId || !editing.serviceId) {
      setToast({type:'error', message:'Preencha todos os campos obrigatórios (data, hora, funcionário e serviço)'});
      return;
    }
    
    try {
      await SchedulingApi.update(editing.id, {
        appointment_date: editing.date,
        appointment_time: editing.time,
        notes: editing.notes || '',
        employee_id: Number(editing.employeeId),
        service_id: Number(editing.serviceId)
      })
      // refresh
      const d = editing.date;
      const data = await SchedulingApi.getByDate(d)
      const mapped = (data || []).map(a=>({
        id:a.id, clientName:a.client_name, clientPhone:a.client_phone||'', service:a.service_name, employee:a.employee_name,
        date:a.appointment_date, time:a.appointment_time?.slice(0,5), duration:a.duration_minutes, price:Number(a.price||0), status:a.status, notes:a.notes||''
      }))
      setAppointments(mapped)
      await Promise.all([loadNextFive(), loadUpcoming(true)])
      setToast({type:'success', message:'Agendamento atualizado'})
  window.dispatchEvent(new CustomEvent('appointments:changed'))
    }catch(e){
      setToast({type:'error', message:'Erro ao salvar edição: '+(e.response?.data?.message||e.message)})
    }finally{
      setEditModalOpen(false); setEditing(null)
    }
  }

  const handleChangeStatus = async (appointment, newStatus) => {
    try {
      let updated;
      if(newStatus==='confirmed') updated = await SchedulingApi.confirm(appointment.id)
      else if(newStatus==='completed') {
        // Open payment dialog to choose method
        setPaymentTarget(appointment)
        setPaymentMethod('cash')
        setShowPaymentDialog(true)
        return
      }
      else if(newStatus==='canceled') updated = await SchedulingApi.cancel(appointment.id)
      else updated = await SchedulingApi.update(appointment.id,{status:newStatus})
      setAppointments(prev => prev.map(a => a.id === appointment.id ? { ...a, status: updated.status } : a))
      await Promise.all([loadNextFive(), loadUpcoming(true)])
      setToast({type:'success', message:'Status atualizado'})
      // Dispara evento global para outras telas recarregarem stats
      window.dispatchEvent(new CustomEvent('appointments:changed'))
    } catch (e) {
      setToast({type:'error', message:'Erro ao alterar status: '+(e.response?.data?.message || e.message)})
    } finally {
      setStatusMenuOpenId(null)
    }
  }

  const handleConfirmPayment = async () => {
    if (!paymentTarget) return
    try {
      const updated = await SchedulingApi.complete(paymentTarget.id, { payment_method: paymentMethod })
      setAppointments(prev => prev.map(a => a.id === paymentTarget.id ? { ...a, status: updated.status } : a))
      await Promise.all([loadNextFive(), loadUpcoming(true)])
      setToast({type:'success', message:'Serviço concluído e pagamento registrado'})
      window.dispatchEvent(new CustomEvent('appointments:changed'))
    } catch (e) {
      setToast({type:'error', message:'Erro ao registrar pagamento: '+(e.response?.data?.message || e.message)})
    } finally {
      setShowPaymentDialog(false)
      setPaymentTarget(null)
    }
  }

  // Opens confirmation dialog
  const handleRequestDelete = (appointment) => {
    setDeleteTarget(appointment)
    setShowDeleteDialog(true)
  }

  // Executes deletion after confirmation
  const handleDeleteAppointment = async () => {
    if (!deleteTarget) return
    try {
      await SchedulingApi.delete(deleteTarget.id)
      // Refresh current date appointments
      const selectedDateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`
      const data = await SchedulingApi.getByDate(selectedDateStr)
      const mapped = (data || []).map((a) => ({
        id: a.id,
        clientName: a.client_name,
        clientPhone: a.client_phone || '',
        service: a.service_name,
        employee: a.employee_name,
        date: (a.appointment_date||'').slice(0,10),
        time: a.appointment_time?.slice(0,5),
        duration: a.duration_minutes,
        price: Number(a.price || 0),
        status: a.status,
        notes: a.notes || '',
      }))
      setAppointments(mapped)
      await Promise.all([loadNextFive(), loadUpcoming(true)])
      setToast({type:'success', message:'Agendamento excluído'})
  window.dispatchEvent(new CustomEvent('appointments:changed'))
    } catch (e) {
      console.error('Erro ao excluir agendamento:', e)
      setToast({type:'error', message:'Erro ao excluir: '+(e.response?.data?.message || e.message)})
    } finally {
      setShowDeleteDialog(false)
      setDeleteTarget(null)
    }
  }

  const loadNextFive = async () => {
    try {
      const data = await SchedulingApi.getNextFive()
      const mapped = (data || []).map((a) => ({
        id: a.id,
        clientName: a.client_name,
        clientPhone: a.client_phone || '',
        service: a.service_name,
        employee: a.employee_name,
        date: a.appointment_date,
        time: a.appointment_time?.slice(0,5),
        duration: a.duration_minutes,
        price: Number(a.price || 0),
        status: a.status,
        notes: a.notes || '',
      }))
      setNextFive(mapped)
    } catch (e) {
      console.error('Falha ao carregar próximos 5 agendamentos:', e)
    }
  }

  const loadUpcoming = async (reset=false) => {
    if(upcomingLoading) return;
    setUpcomingLoading(true)
    try {
      const _limit = upcomingLimit;
      const _offset = reset ? 0 : upcomingOffset;
      const resp = await SchedulingApi.getUpcomingPaginated(_limit,_offset)
      const mapped = (resp.data || []).map(a=>({
        id:a.id, clientName:a.client_name, clientPhone:a.client_phone||'', service:a.service_name, employee:a.employee_name, date:(a.appointment_date||'').slice(0,10),
        time:a.appointment_time?.slice(0,5), duration:a.duration_minutes, price:Number(a.price||0), status:a.status, notes:a.notes||''
      }))
      if(reset){
        setUpcoming(mapped)
      } else {
        // Evitar duplicados se backend retornar itens já carregados
        setUpcoming(prev=>{
          const existingIds = new Set(prev.map(p=>p.id))
            const merged = [...prev]
            mapped.forEach(m=> { if(!existingIds.has(m.id)) merged.push(m) })
            return merged
        })
      }
      setUpcomingOffset(_offset + mapped.length) // usar realmente o que veio
      if(resp.total != null) setUpcomingTotal(resp.total)
      if(typeof resp.hasMore === 'boolean'){
        setUpcomingHasMore(resp.hasMore)
      } else {
        setUpcomingHasMore(mapped.length === _limit)
      }
    }catch(e){
      console.error('Erro ao carregar agendamentos futuros paginados', e)
    } finally {
      setUpcomingLoading(false)
    }
  }

  // Autocomplete clientes (debounce simples)
  useEffect(()=>{
    if(!clientSearch){ setClientResults([]); return; }
    const t = setTimeout(async ()=>{
      try {
        const data = await ClientsApi.search(clientSearch)
        setClientResults(data)
        setShowClientDropdown(true)
      }catch{}
    },300)
    return ()=> clearTimeout(t)
  },[clientSearch])

  const todayAppointments = appointments // já estão filtrados por data selecionada
  const upcomingAppointments = upcoming.length ? upcoming : nextFive

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
                  <div className="relative" id="client-autocomplete">
                    <Input
                      id="clientName"
                      value={newAppointment.clientName}
                      onChange={(e) => { setNewAppointment({ ...newAppointment, clientName: e.target.value }); setClientSearch(e.target.value) }}
                      placeholder="Maria Silva"
                      onFocus={()=> clientSearch && setShowClientDropdown(true)}
                    />
                    {showClientDropdown && clientResults.length>0 && (
                      <div className="absolute z-20 bg-white border rounded w-full mt-1 max-h-48 overflow-auto text-sm shadow">
                        {clientResults.map(c=> (
                          <button key={c.id} className="block w-full text-left px-2 py-1 hover:bg-muted" onClick={()=>{ setNewAppointment({...newAppointment, clientName:c.name, clientPhone:c.phone}); setShowClientDropdown(false)}}>
                            {c.name} <span className="text-xs text-muted-foreground">{c.phone}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
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
                  value={newAppointment.serviceId}
                  onValueChange={(value) => {
                    setNewAppointment({ ...newAppointment, serviceId: value, employeeId: "", time: "" })
                    // Limpar slots disponíveis para forçar recarga com nova duração
                    setAvailableSlots([])
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o serviço" />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map((service) => (
                      <SelectItem key={service.id} value={String(service.id)}>
                        {service.name} - {service.duration_minutes}min - R${service.recommended_price}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="employee">Funcionário</Label>
                <Select
                  value={newAppointment.employeeId}
                  onValueChange={(value) => setNewAppointment({ ...newAppointment, employeeId: value })}
                  disabled={!newAppointment.serviceId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o funcionário" />
                  </SelectTrigger>
                  <SelectContent>
                    {newAppointment.serviceId &&
                      getAvailableEmployees(newAppointment.serviceId).map((employee) => (
                        <SelectItem key={employee.id} value={String(employee.id)}>
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
                    disabled={!newAppointment.employeeId || !newAppointment.date || !newAppointment.serviceId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o horário" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSlots.length > 0 ? (
                        availableSlots.map((slot) => (
                          <SelectItem key={slot.id} value={slot.start_time?.slice(0,5)}>
                            {slot.start_time?.slice(0,5)}
                          </SelectItem>
                        ))
                      ) : newAppointment.employeeId && newAppointment.date && newAppointment.serviceId ? (
                        <SelectItem key="no-slots" value="" disabled>
                          Nenhum horário disponível para este serviço
                        </SelectItem>
                      ) : (
                        <SelectItem key="select-first" value="" disabled>
                          Selecione serviço, funcionário e data primeiro
                        </SelectItem>
                      )}
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
              {selectedDate.toLocaleDateString("pt-BR", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })} Agenda
            </CardTitle>
            <CardDescription>{loading ? 'Carregando...' : `${todayAppointments.length} agendamentos para hoje`}</CardDescription>
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
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <Button variant="outline" size="sm" onClick={() => setStatusMenuOpenId(statusMenuOpenId === appointment.id ? null : appointment.id)} className="flex items-center gap-1">
                            <span className="capitalize">{statusLabel(appointment.status)}</span>
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                          {statusMenuOpenId === appointment.id && (
                            <div className="absolute right-0 z-10 mt-1 w-40 rounded-md border bg-white shadow">
                              {statusOptions.map(opt => (
                                <button
                                  key={opt.value}
                                  onClick={() => handleChangeStatus(appointment, opt.value)}
                                  className={`w-full text-left px-3 py-2 text-sm hover:bg-muted ${statusLabel(appointment.status) === opt.label ? 'font-semibold' : ''}`}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="text-sm font-medium w-20 text-right">R${Number(appointment.price || 0).toFixed(2)}</div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleEditAppointment(appointment)}>
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleRequestDelete(appointment)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
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
          <CardDescription>Próximos agendamentos (paginados)</CardDescription>
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
                  <Badge variant={getStatusColor(appointment.status)}>{statusLabel(appointment.status)}</Badge>
                  <div className="text-right">
                    <div className="font-medium">R${Number(appointment.price || 0).toFixed(2)}</div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleEditAppointment(appointment)}>
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleRequestDelete(appointment)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {upcomingHasMore && (
            <div className="mt-4 flex justify-center">
              <Button variant="outline" size="sm" disabled={upcomingLoading} onClick={()=> loadUpcoming(false)}>
                {upcomingLoading ? 'Carregando...' : 'Ver mais'}
              </Button>
            </div>
          )}
          {upcomingTotal != null && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Exibindo {upcoming.length} de {upcomingTotal} agendamentos futuros
            </p>
          )}
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
              // Filtra pelo id do funcionário quando disponível (fallback para nome)
              const employeeAppointments = todayAppointments.filter((apt) => (
                (apt.employeeId != null ? apt.employeeId === employee.id : apt.employee === employee.name)
              ))

              // Agendamentos considerados carga de trabalho (ainda a realizar)
              const workloadStatuses = ['scheduled','confirmed','in_progress']
              const workloadAppointments = employeeAppointments.filter(a => workloadStatuses.includes(a.status))

              // Receita apenas de serviços concluídos
              const revenueAppointments = employeeAppointments.filter(a => a.status === 'completed')
              const totalRevenue = revenueAppointments.reduce((sum, apt) => sum + (apt.price || 0), 0)

              // Duração total (minutos) apenas do que ainda vai acontecer hoje
              const totalDuration = workloadAppointments.reduce((sum, apt) => sum + (apt.duration || 0), 0)

              // Comissão: usar commissionAmount quando existir, senão fallback para 20% do preço
              const totalCommission = revenueAppointments.reduce((sum, apt) => sum + (apt.commissionAmount != null ? apt.commissionAmount : (apt.price || 0) * 0.2), 0)

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
                      <div className="text-xs text-muted-foreground">{workloadAppointments.length} agendamentos ativos</div>
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
                      <span className="font-medium">R${totalRevenue.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Comissão:</span>
                      <span className="font-medium text-green-600">R${totalCommission.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={(open) => { if(!open){ setShowDeleteDialog(false); setDeleteTarget(null) } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir este agendamento? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => { setShowDeleteDialog(false); setDeleteTarget(null) }}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteAppointment}>Excluir</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Method Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Forma de pagamento</DialogTitle>
            <DialogDescription>Selecione a forma de pagamento para concluir o atendimento.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Método</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {paymentMethods.map(m => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="secondary" onClick={()=>{setShowPaymentDialog(false); setPaymentTarget(null)}}>Cancelar</Button>
            <Button onClick={handleConfirmPayment}>Confirmar</Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Edit Modal */}
      <Dialog open={editModalOpen} onOpenChange={(o)=> { if(!o){ setEditModalOpen(false); setEditing(null)} }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Agendamento</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Serviço</Label>
                  <Select value={editing.serviceId} onValueChange={async (v)=> {
                    // Ao trocar serviço, resetar horário e recarregar slots
                    setEditing(prev=> ({...prev, serviceId:v, time:''}))
                    
                    // Se tem funcionário e data, recarregar slots com novo serviço
                    if (editing.employeeId && editing.date) {
                      try {
                        const slots = await SchedulingApi.getAvailableSlots(
                          editing.employeeId, 
                          editing.date, 
                          v, 
                          editing.id
                        )
                        setAvailableSlots(slots || [])
                      } catch (e) {
                        console.error('Erro ao recarregar slots:', e)
                        setAvailableSlots([])
                      }
                    } else {
                      setAvailableSlots([])
                    }
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Serviço" />
                    </SelectTrigger>
                    <SelectContent>
                      {services.map(s=> (
                        <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Funcionário</Label>
                  <Select value={editing.employeeId} onValueChange={async (v)=> {
                    setEditing(prev=> ({...prev, employeeId:v, time:''}))
                    
                    // Recarregar slots se tem data e serviço
                    if(editing.date && editing.serviceId){
                      try { 
                        const slots = await SchedulingApi.getAvailableSlots(
                          v, 
                          editing.date, 
                          editing.serviceId, 
                          editing.id
                        ); 
                        setAvailableSlots(slots || [])
                      } catch(e){
                        console.error('Erro ao recarregar slots:', e)
                        setAvailableSlots([])
                      }
                    } else {
                      setAvailableSlots([])
                    }
                  }} disabled={!editing.serviceId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Funcionário" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map(emp=> (
                        <SelectItem key={emp.id} value={String(emp.id)}>{emp.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Data</Label>
                  <Input 
                    type="date" 
                    value={editing.date || ''} 
                    onChange={async e=> {
                      const val = e.target.value; 
                      setEditing(prev=> ({...prev, date:val, time:''}));
                      
                      // Recarregar slots se tem funcionário e serviço
                      if(editing.employeeId && editing.serviceId){
                        try { 
                          const slots = await SchedulingApi.getAvailableSlots(
                            editing.employeeId, 
                            val, 
                            editing.serviceId, 
                            editing.id
                          ); 
                          setAvailableSlots(slots || [])
                        } catch(e){
                          console.error('Erro ao recarregar slots:', e)
                          setAvailableSlots([])
                        }
                      } else {
                        setAvailableSlots([])
                      }
                    }} 
                  />
                </div>
                <div>
                  <Label>Hora</Label>
                  <Select value={editing.time || ''} onValueChange={(v)=> setEditing(prev=> ({...prev,time:v}))} disabled={!editing.date || !editing.employeeId || !editing.serviceId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Horário" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSlots.length > 0 ? (
                        availableSlots.map(slot=> (
                          <SelectItem key={slot.id} value={slot.start_time?.slice(0,5)}>
                            {slot.start_time?.slice(0,5)}
                          </SelectItem>
                        ))
                      ) : editing?.employeeId && editing?.date && editing?.serviceId ? (
                        <SelectItem key="no-slots" value="" disabled>
                          Nenhum horário disponível para este serviço
                        </SelectItem>
                      ) : (
                        <SelectItem key="select-first" value="" disabled>
                          Complete serviço, funcionário e data primeiro
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea value={editing.notes || ''} onChange={e=> setEditing(prev=> ({...prev,notes:e.target.value}))} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={()=>{ setEditModalOpen(false); setEditing(null)}}>Cancelar</Button>
                <Button onClick={handleSaveEdit}>Salvar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-4 right-4 px-4 py-2 rounded shadow text-sm text-white ${toast.type==='error'?'bg-red-600':'bg-green-600'}`}
             onAnimationEnd={()=>{ /* could add auto dismiss */ }}>
          <div className="flex items-center gap-2">
            {toast.type==='error'? <XCircle className="h-4 w-4" /> : <Check className="h-4 w-4" />}
            <span>{toast.message}</span>
            <button className="ml-2 text-xs underline" onClick={()=> setToast(null)}>fechar</button>
          </div>
        </div>
      )}
    </div>
  )
}
