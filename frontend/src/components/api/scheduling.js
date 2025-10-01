import { axiosWithAuth } from './axiosWithAuth';

export const SchedulingApi = {
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
  async complete(id){
    const res = await axiosWithAuth(`/scheduling/${id}/complete`, { method:'post' });
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
  async getAvailableSlots(employeeId, date) {
    const res = await axiosWithAuth(`/scheduling/available-slots/${employeeId}/${date}`);
    return res.data;
  }
};

export const ClientsApi = {
  async search(q){
    const res = await axiosWithAuth(`/clients${q?`?q=${encodeURIComponent(q)}`:''}`);
    return res.data;
  }
}
