import { axiosWithAuth } from './axiosWithAuth';

export const SchedulingApi = {
  async getById(id) {
    const res = await axiosWithAuth(`/scheduling/${id}`);
    return res.data;
  },
  async getByDate(date) {
    // date: YYYY-MM-DD
    const res = await axiosWithAuth(`/scheduling/date/${date}`);
    return res.data;
  },
  async update(id, payload) {
    const res = await axiosWithAuth(`/scheduling/${id}`, { method: 'put', data: payload });
    return res.data;
  },
  async delete(id) {
    const res = await axiosWithAuth(`/scheduling/${id}`, { method: 'delete' });
    return res.data;
  },
  async getNextFive() {
    const res = await axiosWithAuth('/scheduling/next/5');
    return res.data;
  },
  async getUpcomingPaginated(limit=10, offset=0) {
    const res = await axiosWithAuth(`/scheduling/upcoming?limit=${limit}&offset=${offset}`);
    // returns { data:[], limit, offset, total, hasMore }
    return res.data;
  },
  async confirm(id){
    const res = await axiosWithAuth(`/scheduling/${id}/confirm`, { method:'post' });
    return res.data;
  },
  async complete(id, payload){
    const res = await axiosWithAuth(`/scheduling/${id}/complete`, { method:'post', data: payload });
    return res.data;
  },
  async cancel(id){
    const res = await axiosWithAuth(`/scheduling/${id}/cancel`, { method:'post' });
    return res.data;
  },
  async create(payload) {
    // payload: { appointment_date, appointment_time, client_id, employee_id, service_id, status?, notes? }
    const res = await axiosWithAuth('/scheduling', { method: 'post', data: payload });
    return res.data;
  },
  async getAvailableSlots(employeeId, date, serviceId = null, excludeAppointmentId = null) {
    let url = `/scheduling/smart-slots/${employeeId}/${date}`;
    const params = new URLSearchParams();
    
    if (serviceId) params.append('serviceId', serviceId);
    if (excludeAppointmentId) params.append('excludeAppointmentId', excludeAppointmentId);
    
    if (params.toString()) {
      url += `?${params.toString()}`;
    }
    
    const res = await axiosWithAuth(url);
    return res.data;
  }
};

export const MercadoPagoApi = {
  async getStatus() {
    const res = await axiosWithAuth('/mercadopago/status');
    return res.data;
  },
  async getConnectUrl() {
    const res = await axiosWithAuth('/mercadopago/connect-url');
    return res.data;
  },
  async disconnect() {
    const res = await axiosWithAuth('/mercadopago/disconnect', { method: 'delete' });
    return res.data;
  },
};

export const PixPaymentsApi = {
  async getLatest(appointmentId) {
    const res = await axiosWithAuth(`/scheduling/${appointmentId}/payments/pix/latest`);
    return res.data;
  },
  async create(appointmentId) {
    const res = await axiosWithAuth(`/scheduling/${appointmentId}/payments/pix`, { method: 'post' });
    return res.data;
  },
  async resend(appointmentId) {
    const res = await axiosWithAuth(`/scheduling/${appointmentId}/payments/pix/resend`, { method: 'post' });
    return res.data;
  },
  async approveManual(appointmentId) {
    const res = await axiosWithAuth(`/scheduling/${appointmentId}/payments/approve`, { method: 'post' });
    return res.data;
  },
};

export const ClientsApi = {
  async search(q){
    const res = await axiosWithAuth(`/clients${q?`?q=${encodeURIComponent(q)}`:''}`);
    return res.data;
  }
}
