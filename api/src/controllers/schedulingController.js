// controllers/schedulingController.js
import pool from "../db/postgre.js";

class SchedulingController {
	constructor() {}
	// Estrutura dos agendamentos:
	// CREATE TABLE IF NOT EXISTS appointments (
	//     id SERIAL PRIMARY KEY,
	//     client_id INTEGER NOT NULL,
	//     employee_id INTEGER NOT NULL,
	//     service_id INTEGER NOT NULL,
	//     appointment_date DATE NOT NULL,
	//     appointment_time TIME NOT NULL,
	//     duration_minutes INTEGER NOT NULL,
	//     status VARCHAR(20) DEFAULT 'scheduled',
	//     price DECIMAL(10,2) NOT NULL,
	//     commission_amount DECIMAL(10,2),
	//     notes TEXT,
	//     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	//     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	//     FOREIGN KEY (client_id) REFERENCES clients(id),
	//     FOREIGN KEY (employee_id) REFERENCES employees(id),
	//     FOREIGN KEY (service_id) REFERENCES services(id)
	//   );

	// Estrutura dos clientes:
	// CREATE TABLE IF NOT EXISTS clients (
	//     id SERIAL PRIMARY KEY,
	//     name VARCHAR(255) NOT NULL,
	//     email VARCHAR(255),
	//     phone VARCHAR(20),
	//     address TEXT,
	//     birth_date DATE,
	//     notes TEXT,
	//     first_visit DATE,
	//     last_visit DATE,
	//     total_visits INTEGER DEFAULT 0,
	//     total_spent DECIMAL(10,2) DEFAULT 0,
	//     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	//     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	//   );

	// Estrutura dos funcionários:
	// CREATE TABLE IF NOT EXISTS employees (
	//     id SERIAL PRIMARY KEY,
	//     user_id INTEGER,
	//     name VARCHAR(255) NOT NULL,
	//     email VARCHAR(255) UNIQUE,
	//     phone VARCHAR(20),
	//     hire_date DATE,
	//     status VARCHAR(20) DEFAULT 'active',
	//     base_salary DECIMAL(10,2) DEFAULT 0,
	//     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	//     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	//     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
	//   );

	// get all schedulings - Otimizado com paginação e filtros
	async getAllSchedulings(req, res) {
		const pool = req.pool;
		try {
			const { 
				page = 1, 
				limit = 50, 
				status, 
				employee_id, 
				start_date, 
				end_date,
				client_search 
			} = req.query;
			
			const offset = (page - 1) * limit;
			let whereConditions = [];
			let queryParams = [];
			let paramIndex = 1;

			if (status) {
				whereConditions.push(`a.status = $${paramIndex}`);
				queryParams.push(status);
				paramIndex++;
			}

			if (employee_id) {
				whereConditions.push(`a.employee_id = $${paramIndex}`);
				queryParams.push(employee_id);
				paramIndex++;
			}

			if (start_date) {
				whereConditions.push(`a.appointment_date >= $${paramIndex}`);
				queryParams.push(start_date);
				paramIndex++;
			}

			if (end_date) {
				whereConditions.push(`a.appointment_date <= $${paramIndex}`);
				queryParams.push(end_date);
				paramIndex++;
			}

			if (client_search) {
				whereConditions.push(`c.name ILIKE $${paramIndex}`);
				queryParams.push(`%${client_search}%`);
				paramIndex++;
			}

			const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

			// Query principal otimizada usando índices
			const { rows } = await pool.query(`
				SELECT 
					a.id,
					a.appointment_date,
					a.appointment_time,
					a.status,
					a.duration_minutes,
					a.price,
					a.notes,
					c.name as client_name,
					c.phone as client_phone,
					e.name as employee_name,
					s.name as service_name,
					CASE 
						WHEN a.appointment_date < CURRENT_DATE THEN 'past'
						WHEN a.appointment_date = CURRENT_DATE THEN 'today'
						ELSE 'future'
					END as time_status
				FROM appointments a
				JOIN clients c ON a.client_id = c.id
				JOIN employees e ON a.employee_id = e.id
				JOIN services s ON a.service_id = s.id
				${whereClause}
				ORDER BY a.appointment_date DESC, a.appointment_time DESC
				LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
			`, [...queryParams, limit, offset]);

			// Count para paginação
			const { rows: countRows } = await pool.query(`
				SELECT COUNT(*) as total 
				FROM appointments a
				JOIN clients c ON a.client_id = c.id
				JOIN employees e ON a.employee_id = e.id
				JOIN services s ON a.service_id = s.id
				${whereClause}
			`, queryParams);

			res.json({
				appointments: rows,
				pagination: {
					currentPage: parseInt(page),
					totalItems: parseInt(countRows[0].total),
					itemsPerPage: parseInt(limit),
					totalPages: Math.ceil(countRows[0].total / limit)
				}
			});
		} catch (err) {
			console.error('Erro ao buscar agendamentos:', err);
			res
				.status(500)
				.json({ message: "Erro ao buscar agendamentos", error: err.message });
		}
	}

	// get scheduling by id
	async getSchedulingById(req, res) {
		const pool = req.pool;
		const { id } = req.params;
		try {
			const { rows } = await pool.query(
				`
				SELECT a.id,
				       a.client_id,
				       a.employee_id,
				       a.service_id,
					   a.appointment_date,
					   a.appointment_time,
					   a.status,
					   a.duration_minutes,
					   a.price,
					   a.notes,
					   c.name as client_name,
					   c.phone as client_phone,
					   e.name as employee_name,
					   s.name as service_name
                FROM appointments a
                JOIN clients c ON a.client_id = c.id
                JOIN employees e ON a.employee_id = e.id
                JOIN services s ON a.service_id = s.id
                WHERE a.id = $1
            `,
				[id]
			);
			if (rows.length === 0) {
				return res.status(404).json({ message: "Agendamento não encontrado" });
			}
			res.json(rows[0]);
		} catch (err) {
			res
				.status(500)
				.json({ message: "Erro ao buscar agendamento", error: err.message });
		}
	}

	// get scheduling by date
	async getSchedulingsByDate(req, res) {
		const pool = req.pool;
		const { date } = req.params;
		try {
			const { rows } = await pool.query(
				`
                SELECT a.id,
                       a.appointment_date,
                       a.appointment_time,
                       a.status,
                       a.duration_minutes,
                       a.price,
                       c.name as client_name,
                       c.phone as client_phone,
                       e.name as employee_name,
                       s.name as service_name
                FROM appointments a
                JOIN clients c ON a.client_id = c.id
                JOIN employees e ON a.employee_id = e.id
                JOIN services s ON a.service_id = s.id
                WHERE a.appointment_date = $1
            `,
				[date]
			);
			res.json(rows);
		} catch (err) {
			res
				.status(500)
				.json({ message: "Erro ao buscar agendamentos", error: err.message });
		}
	}

	// get next 5 schedulings
	async getNextFiveSchedulings(req, res) {
		const pool = req.pool;
		try {
			// Usar comparação separada de data e hora para evitar problemas de timezone
			// Inclui: todos os agendamentos com data futura OU de hoje com horário futuro
			const { rows } = await pool.query(`
				SELECT a.id,
				       a.appointment_date,
				       a.appointment_time,
				       a.status,
				       a.duration_minutes,
				       a.price,
				       c.name as client_name,
				       c.phone as client_phone,
				       e.name as employee_name,
				       s.name as service_name
				FROM appointments a
				JOIN clients c ON a.client_id = c.id
				JOIN employees e ON a.employee_id = e.id
				JOIN services s ON a.service_id = s.id
				WHERE a.appointment_date > CURRENT_DATE
				   OR (a.appointment_date = CURRENT_DATE AND a.appointment_time > CURRENT_TIME)
				ORDER BY a.appointment_date ASC, a.appointment_time ASC
				LIMIT 5;
			`);
			res.json(rows);
		} catch (err) {
			res
				.status(500)
				.json({ message: "Erro ao buscar agendamentos", error: err.message });
		}
	}

	// paginated upcoming schedulings (limit/offset)
	async getUpcomingPaginated(req,res){
		const pool = req.pool;
		const limit = Math.min(parseInt(req.query.limit)||10,50);
		const offset = parseInt(req.query.offset)||0;
		try {
			// Reutiliza o mesmo filtro tanto para dados como para a contagem total
			const whereClause = `WHERE a.appointment_date > CURRENT_DATE
			   OR (a.appointment_date = CURRENT_DATE AND a.appointment_time > CURRENT_TIME)`;
			const dataPromise = pool.query(`
				SELECT a.id, a.appointment_date, a.appointment_time, a.status, a.duration_minutes, a.price,
				       c.name as client_name, c.phone as client_phone, e.name as employee_name, s.name as service_name
				FROM appointments a
				JOIN clients c ON a.client_id = c.id
				JOIN employees e ON a.employee_id = e.id
				JOIN services s ON a.service_id = s.id
				${whereClause}
				ORDER BY a.appointment_date ASC, a.appointment_time ASC
				LIMIT $1 OFFSET $2
			`,[limit,offset]);
			const countPromise = pool.query(`SELECT COUNT(*) FROM appointments a ${whereClause}`);
			const [{rows}, countResult] = await Promise.all([dataPromise, countPromise]);
			const total = parseInt(countResult.rows[0].count,10) || 0;
			const hasMore = offset + rows.length < total;
			res.json({data: rows, limit, offset, total, hasMore});
		}catch(err){
			res.status(500).json({message:'Erro ao buscar agendamentos futuros', error: err.message});
		}
	}

	// get schedulings by employee
	async getSchedulingsByEmployee(req, res) {
		const pool = req.pool;
		const { employeeId } = req.params;
		try {
			const { rows } = await pool.query(
				`
				SELECT a.id,
					   a.appointment_date,
					   a.appointment_time,
					   a.status,
					   a.duration_minutes,
					   a.price,
					   c.name as client_name,
					   c.phone as client_phone,
					   e.name as employee_name,
					   s.name as service_name
                FROM appointments a
                JOIN clients c ON a.client_id = c.id
                JOIN employees e ON a.employee_id = e.id
                JOIN services s ON a.service_id = s.id
                WHERE a.employee_id = $1
            `,
				[employeeId]
			);
			res.json(rows);
		} catch (err) {
			res
				.status(500)
				.json({ message: "Erro ao buscar agendamentos", error: err.message });
		}
	}

	// create scheduling
	async createScheduling(req, res) {
		const pool = req.pool;
		const {
			appointment_date,
			appointment_time,
			client_id,
			client_name,
			client_phone,
			employee_id,
			service_id,
			status,
			notes,
		} = req.body;
		try {
			// Buscar dados do serviço para preencher duração e preço automaticamente
			const serviceResult = await pool.query(
				`SELECT duration_minutes, recommended_price FROM services WHERE id = $1`,
				[service_id]
			);
			if (serviceResult.rows.length === 0) {
				return res.status(400).json({ message: "Serviço inválido" });
			}
			const { duration_minutes, recommended_price } = serviceResult.rows[0];

			await pool.query('BEGIN');

			// Determina o clientId: usa o enviado ou cria/busca por telefone
			let ensuredClientId = client_id;
			if (!ensuredClientId) {
				if (!client_name || !client_phone) {
					await pool.query('ROLLBACK');
					return res.status(400).json({ message: 'Dados do cliente são obrigatórios' });
				}
				// Tenta localizar cliente pelo telefone
				const existing = await pool.query(
					`SELECT id FROM clients WHERE phone = $1 LIMIT 1`,
					[client_phone]
				);
				if (existing.rows.length) {
					ensuredClientId = existing.rows[0].id;
				} else {
					const inserted = await pool.query(
						`INSERT INTO clients (name, phone, first_visit, last_visit, total_visits, total_spent)
						 VALUES ($1, $2, CURRENT_DATE, CURRENT_DATE, 0, 0) RETURNING id`,
						[client_name, client_phone]
					);
					ensuredClientId = inserted.rows[0].id;
				}
			}

			// Impede conflito com outros agendamentos
			const conflict = await pool.query(
				`SELECT 1 FROM appointments
				 WHERE employee_id = $1 AND appointment_date = $2
				   AND NOT (
				     (appointment_time + make_interval(mins => duration_minutes)) <= $3::time
				     OR appointment_time >= ($3::time + make_interval(mins => $4))
				   )
				 LIMIT 1`,
				[employee_id, appointment_date, appointment_time, duration_minutes]
			);
			if (conflict.rows.length) {
				await pool.query('ROLLBACK');
				return res.status(409).json({ message: 'Conflito de horário para este funcionário' });
			}

			// Verifica se o slot está disponível
			const slot = await pool.query(
				`SELECT id, is_available FROM time_slots WHERE employee_id = $1 AND date = $2 AND start_time = $3 FOR UPDATE`,
				[employee_id, appointment_date, appointment_time]
			);
			if (slot.rows.length && slot.rows[0].is_available === false) {
				await pool.query('ROLLBACK');
				return res.status(409).json({ message: 'Horário indisponível' });
			}

			// Calcula comissão do funcionário (se houver regra)
			let commission_amount = null;
			const comm = await pool.query(
				`SELECT commission_rate FROM employee_specialties WHERE employee_id = $1 AND service_id = $2 LIMIT 1`,
				[employee_id, service_id]
			);
			if (comm.rows.length) {
				commission_amount = (Number(recommended_price) * Number(comm.rows[0].commission_rate)) / 100.0;
			}

			// Cria o agendamento com duration/price
			const { rows } = await pool.query(
				`
            INSERT INTO appointments (appointment_date, appointment_time, client_id, employee_id, service_id, status, notes, duration_minutes, price, commission_amount)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
        `,
				[
					appointment_date,
					appointment_time,
					ensuredClientId,
					employee_id,
					service_id,
					status || 'scheduled',
					notes || null,
					duration_minutes,
					recommended_price,
					commission_amount,
				]
			);

			// Marca o slot como ocupado (se existir)
			await pool.query(
				`UPDATE time_slots SET is_available = FALSE WHERE employee_id = $1 AND date = $2 AND start_time = $3`,
				[employee_id, appointment_date, appointment_time]
			);

			await pool.query('COMMIT');
			res.status(201).json(rows[0]);
		} catch (err) {
			await pool.query('ROLLBACK').catch(() => {});
			res
				.status(500)
				.json({ message: "Erro ao criar agendamento", error: err.message });
		}
	}

	// update scheduling
	async updateScheduling(req, res) {
		const pool = req.pool;
		const { id } = req.params;
		const {
			appointment_date,
			appointment_time,
			client_id,
			employee_id,
			service_id,
			status,
			notes,
		} = req.body;
		try {
			await pool.query('BEGIN');
			// Busca o agendamento antigo para liberar o slot anterior
			const { rows: oldRows } = await pool.query(
				`SELECT id, client_id, employee_id, service_id, appointment_date, appointment_time, status, notes, duration_minutes, price FROM appointments WHERE id = $1`,
				[id]
			);
			if (oldRows.length === 0) {
				await pool.query('ROLLBACK');
				return res.status(404).json({ message: "Agendamento não encontrado" });
			}
			const old = oldRows[0];

			// Determina valores finais (mantém antigos se não enviados)
			const final_date = appointment_date || old.appointment_date;
			const final_time = appointment_time || old.appointment_time;
			const final_client_id = client_id || old.client_id;
			const final_employee_id = employee_id || old.employee_id;
			const final_service_id = service_id || old.service_id;
			const final_status = status || old.status;
			const final_notes = typeof notes === 'undefined' ? old.notes : notes;

			// Buscar dados do serviço para garantir duration/price
			const serviceResult = await pool.query(
				`SELECT duration_minutes, recommended_price FROM services WHERE id = $1`,
				[final_service_id]
			);
			if (serviceResult.rows.length === 0) {
				await pool.query('ROLLBACK');
				return res.status(400).json({ message: "Serviço inválido" });
			}
			const { duration_minutes, recommended_price } = serviceResult.rows[0];

			// Impede conflito com outros agendamentos (exclui o próprio id)
			const conflict = await pool.query(
				`SELECT 1 FROM appointments
				 WHERE employee_id = $1 AND appointment_date = $2 AND id <> $5
				   AND NOT (
				     (appointment_time + make_interval(mins => duration_minutes)) <= $3::time
				     OR appointment_time >= ($3::time + make_interval(mins => $4))
				   )
				 LIMIT 1`,
				[final_employee_id, final_date, final_time, duration_minutes, id]
			);
			if (conflict.rows.length) {
				await pool.query('ROLLBACK');
				return res.status(409).json({ message: 'Conflito de horário para este funcionário' });
			}

			// Recalcula comissão
			let commission_amount = null;
			const comm = await pool.query(
				`SELECT commission_rate FROM employee_specialties WHERE employee_id = $1 AND service_id = $2 LIMIT 1`,
				[final_employee_id, final_service_id]
			);
			if (comm.rows.length) {
				commission_amount = (Number(recommended_price) * Number(comm.rows[0].commission_rate)) / 100.0;
			}

			// Atualiza o agendamento
			const { rows } = await pool.query(
				`
					UPDATE appointments
					SET appointment_date = $1,
						appointment_time = $2,
						client_id = $3,
						employee_id = $4,
						service_id = $5,
						status = $6,
						notes = $7,
						duration_minutes = $9,
						price = $10,
						commission_amount = $11
					WHERE id = $8
					RETURNING *
				`,
				[
					final_date,
					final_time,
					final_client_id,
					final_employee_id,
					final_service_id,
					final_status,
					final_notes,
					id,
					duration_minutes,
					recommended_price,
					commission_amount
				]
			);

			// Libera o slot antigo
			await pool.query(
				`UPDATE time_slots SET is_available = TRUE WHERE employee_id = $1 AND date = $2 AND start_time = $3`,
				[old.employee_id, old.appointment_date, old.appointment_time]
			);
			// Ocupa o novo slot
			await pool.query(
				`UPDATE time_slots SET is_available = FALSE WHERE employee_id = $1 AND date = $2 AND start_time = $3`,
				[final_employee_id, final_date, final_time]
			);

			await pool.query('COMMIT');
			res.json(rows[0]);
		} catch (err) {
			await pool.query('ROLLBACK').catch(() => {});
			res
				.status(500)
				.json({ message: "Erro ao atualizar agendamento", error: err.message });
		}
	}

	// delete scheduling
	async deleteScheduling(req, res) {
		const pool = req.pool;
		const { id } = req.params;
		try {
			await pool.query('BEGIN');
			// Busca o agendamento para liberar o slot
			const { rows: oldRows } = await pool.query(
				`SELECT employee_id, appointment_date, appointment_time FROM appointments WHERE id = $1`,
				[id]
			);
			if (oldRows.length === 0) {
				await pool.query('ROLLBACK');
				return res.status(404).json({ message: "Agendamento não encontrado" });
			}
			const old = oldRows[0];

			// Deleta o agendamento
			const { rowCount } = await pool.query(
				`DELETE FROM appointments WHERE id = $1`,
				[id]
			);
			if (rowCount === 0) {
				await pool.query('ROLLBACK');
				return res.status(404).json({ message: "Agendamento não encontrado" });
			}

			// Libera o slot
			await pool.query(
				`UPDATE time_slots SET is_available = TRUE WHERE employee_id = $1 AND date = $2 AND start_time = $3`,
				[old.employee_id, old.appointment_date, old.appointment_time]
			);

			await pool.query('COMMIT');
			res.status(204).send();
		} catch (err) {
			await pool.query('ROLLBACK').catch(() => {});
			res
				.status(500)
				.json({ message: "Erro ao deletar agendamento", error: err.message });
		}
	}

	// get available time slots for a given date and employee
	async getAvailableTimeSlots(req, res) {
		const pool = req.pool;
		const { employeeId, date } = req.params;
		const { serviceId, excludeAppointmentId } = req.query;
		
		try {
			// Buscar duração do serviço se fornecido
			let serviceDuration = 30; // padrão
			if (serviceId) {
				const serviceResult = await pool.query(
					`SELECT duration_minutes FROM services WHERE id = $1`,
					[serviceId]
				);
				if (serviceResult.rows.length > 0) {
					serviceDuration = serviceResult.rows[0].duration_minutes;
				}
			}

			// Buscar agendamentos existentes para o funcionário na data (excluindo o próprio se em edição)
			let existingQuery = `
				SELECT appointment_time, duration_minutes 
				FROM appointments 
				WHERE employee_id = $1 AND appointment_date = $2 AND status != 'canceled'
			`;
			let queryParams = [employeeId, date];

			if (excludeAppointmentId) {
				existingQuery += ` AND id != $3`;
				queryParams.push(excludeAppointmentId);
			}

			const { rows: existingAppointments } = await pool.query(existingQuery, queryParams);

			// Gerar slots de 30 minutos das 08:00 às 18:00
			const slots = [];
			for (let hour = 8; hour < 18; hour++) {
				for (let minute = 0; minute < 60; minute += 30) {
					const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
					
					// Calcular se o serviço cabe neste slot
					const slotStartMinutes = this.timeToMinutes(timeStr);
					const serviceEndMinutes = slotStartMinutes + serviceDuration;
					
					// Verificar se o serviço se estende além do horário de funcionamento (18:00)
					if (serviceEndMinutes > this.timeToMinutes('18:00')) {
						continue; // Não adicionar este slot se o serviço não cabe
					}
					
					// Verificar se há conflito com agendamentos existentes
					const hasConflict = existingAppointments.some(apt => {
						if (!apt.appointment_time) return false;
						
						const aptStartMinutes = this.timeToMinutes(apt.appointment_time.slice(0, 5));
						const aptEndMinutes = aptStartMinutes + (apt.duration_minutes || 30);
						
						// Verifica sobreposição entre o novo serviço e o agendamento existente
						return !(serviceEndMinutes <= aptStartMinutes || slotStartMinutes >= aptEndMinutes);
					});

					if (!hasConflict) {
						const endHour = minute === 30 ? hour + 1 : hour;
						const endMinute = minute === 30 ? 0 : minute + 30;
						const endTimeStr = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
						
						slots.push({
							id: `dynamic-${hour}-${minute}`,
							employee_id: employeeId,
							date: date,
							start_time: timeStr,
							end_time: endTimeStr,
							is_available: true
						});
					}
				}
			}

			res.json(slots);
		} catch (err) {
			res
				.status(500)
				.json({
					message: "Erro ao buscar horários disponíveis",
					error: err.message,
				});
		}
	}

	// Método auxiliar para converter horário em minutos
	timeToMinutes(timeStr) {
		const [hours, minutes] = timeStr.split(':').map(Number);
		return hours * 60 + minutes;
	}

	async transitionStatus(req,res,newStatus){
		const pool = req.pool;
		const { id } = req.params;
		try {
			await pool.query('BEGIN');
			// Busca o agendamento atual
			const current = await pool.query(`SELECT id, client_id, status, price FROM appointments WHERE id = $1 FOR UPDATE`,[id]);
			if(!current.rows.length){
				await pool.query('ROLLBACK');
				return res.status(404).json({message:'Agendamento não encontrado'});
			}
			const appt = current.rows[0];
			// Atualiza status
			const updated = await pool.query(`UPDATE appointments SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,[id,newStatus]);
			// Ajusta métricas básicas de cliente quando completa ou cancela
			if(appt.status !== 'completed' && newStatus === 'completed'){
				await pool.query(`UPDATE clients SET total_visits = total_visits + 1, total_spent = total_spent + $2, last_visit = CURRENT_DATE WHERE id = $1`,[appt.client_id, appt.price]);
			}
			if(appt.status === 'completed' && newStatus === 'canceled'){
				// Reverte visita/gasto se estava marcado como completed antes
				await pool.query(`UPDATE clients SET total_visits = GREATEST(total_visits - 1,0), total_spent = GREATEST(total_spent - $2,0) WHERE id = $1`,[appt.client_id, appt.price]);
			}
			await pool.query('COMMIT');
			res.json(updated.rows[0]);
		}catch(err){
			await pool.query('ROLLBACK').catch(()=>{});
			res.status(500).json({message:'Erro ao atualizar status', error: err.message});
		}
	}

	async generateTimeSlots(req,res){
		const pool = req.pool;
		const { employee_ids, start_date, end_date, start_time='08:00', end_time='18:00', interval_minutes=30 } = req.body;
		if(!employee_ids || !Array.isArray(employee_ids) || !start_date || !end_date){
			return res.status(400).json({message:'Parâmetros inválidos'});
		}
		try {
			await pool.query('BEGIN');
			const days = [];
			for(let d = new Date(start_date); d <= new Date(end_date); d.setDate(d.getDate()+1)){
				const y = d.getFullYear();
				const m = String(d.getMonth()+1).padStart(2,'0');
				const day = String(d.getDate()).padStart(2,'0');
				days.push(`${y}-${m}-${day}`);
			}
			for(const emp of employee_ids){
				for(const day of days){
					// gera intervalos
					let cur = start_time;
					while(true){
						const [h,m] = cur.split(':').map(Number);
						const next = new Date(0,0,0,h,m+interval_minutes,0);
						const nextStr = `${String(next.getHours()).padStart(2,'0')}:${String(next.getMinutes()).padStart(2,'0')}`;
						if(nextStr > end_time) break;
						await pool.query(`INSERT INTO time_slots (employee_id, date, start_time, end_time, is_available) VALUES ($1,$2,$3,$4,TRUE) ON CONFLICT (employee_id,date,start_time) DO NOTHING`,[emp,day,cur,nextStr]);
						cur = nextStr;
					}
				}
			}
			await pool.query('COMMIT');
			res.json({message:'Time slots gerados', employees: employee_ids.length, dias: days.length});
		}catch(err){
			await pool.query('ROLLBACK').catch(()=>{});
			res.status(500).json({message:'Erro ao gerar time slots', error: err.message});
		}
	}
}

export default new SchedulingController();
