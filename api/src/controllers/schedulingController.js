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

	// get all schedulings
	async getAllSchedulings(req, res) {
		const pool = req.pool;
		try {
			const { rows } = await pool.query(`
                SELECT a.id, a.appointment_date, a.appointment_time, c.name as client_name, e.name as employee_name, s.name as service_name, a.status
                FROM appointments a
                JOIN clients c ON a.client_id = c.id
                JOIN employees e ON a.employee_id = e.id
                JOIN services s ON a.service_id = s.id
                ORDER BY a.appointment_date DESC, a.appointment_time DESC
            `);
			res.json(rows);
		} catch (err) {
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
                SELECT a.id, a.appointment_date, a.appointment_time, c.name as client_name, e.name as employee_name, s.name as service_name, a.status, a.notes
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
                SELECT a.id, a.appointment_date, a.appointment_time, c.name as client_name, e.name as employee_name, s.name as service_name, a.status
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
			const { rows } = await pool.query(`
                SELECT a.id, a.appointment_date, a.appointment_time, c.name as client_name, e.name as employee_name, s.name as service_name, a.status
                FROM appointments a
                JOIN clients c ON a.client_id = c.id
                JOIN employees e ON a.employee_id = e.id
                JOIN services s ON a.service_id = s.id
                WHERE a.appointment_date > NOW()
                ORDER BY a.appointment_date ASC, a.appointment_time ASC
                LIMIT 5
            `);
			res.json(rows);
		} catch (err) {
			res
				.status(500)
				.json({ message: "Erro ao buscar agendamentos", error: err.message });
		}
	}

	// get schedulings by employee
	async getSchedulingsByEmployee(req, res) {
		const pool = req.pool;
		const { employeeId } = req.params;
		try {
			const { rows } = await pool.query(
				`
                SELECT a.id, a.appointment_date, a.appointment_time, c.name as client_name, e.name as employee_name, s.name as service_name, a.status
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
			employee_id,
			service_id,
			status,
			notes,
		} = req.body;
		try {
			// Cria o agendamento
			const { rows } = await pool.query(
				`
            INSERT INTO appointments (appointment_date, appointment_time, client_id, employee_id, service_id, status, notes)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `,
				[
					appointment_date,
					appointment_time,
					client_id,
					employee_id,
					service_id,
					status,
					notes,
				]
			);

			// Marca o slot como ocupado
			await pool.query(
				`
            UPDATE time_slots
            SET is_available = FALSE
            WHERE employee_id = $1 AND date = $2 AND start_time = $3
        `,
				[employee_id, appointment_date, appointment_time]
			);

			res.status(201).json(rows[0]);
		} catch (err) {
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
			// Busca o agendamento antigo para liberar o slot anterior
			const { rows: oldRows } = await pool.query(
				`SELECT employee_id, appointment_date, appointment_time FROM appointments WHERE id = $1`,
				[id]
			);
			if (oldRows.length === 0) {
				return res.status(404).json({ message: "Agendamento não encontrado" });
			}
			const old = oldRows[0];

			// Atualiza o agendamento
			const { rows } = await pool.query(
				`
					UPDATE appointments
					SET appointment_date = $1, appointment_time = $2, client_id = $3, employee_id = $4, service_id = $5, status = $6, notes = $7
					WHERE id = $8
					RETURNING *
				`,
				[
					appointment_date,
					appointment_time,
					client_id,
					employee_id,
					service_id,
					status,
					notes,
					id,
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
				[employee_id, appointment_date, appointment_time]
			);

			res.json(rows[0]);
		} catch (err) {
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
			// Busca o agendamento para liberar o slot
			const { rows: oldRows } = await pool.query(
				`SELECT employee_id, appointment_date, appointment_time FROM appointments WHERE id = $1`,
				[id]
			);
			if (oldRows.length === 0) {
				return res.status(404).json({ message: "Agendamento não encontrado" });
			}
			const old = oldRows[0];

			// Deleta o agendamento
			const { rowCount } = await pool.query(
				`DELETE FROM appointments WHERE id = $1`,
				[id]
			);
			if (rowCount === 0) {
				return res.status(404).json({ message: "Agendamento não encontrado" });
			}

			// Libera o slot
			await pool.query(
				`UPDATE time_slots SET is_available = TRUE WHERE employee_id = $1 AND date = $2 AND start_time = $3`,
				[old.employee_id, old.appointment_date, old.appointment_time]
			);

			res.status(204).send();
		} catch (err) {
			res
				.status(500)
				.json({ message: "Erro ao deletar agendamento", error: err.message });
		}
	}

	// get available time slots for a given date and employee
	async getAvailableTimeSlots(req, res) {
		const pool = req.pool;
		const { employeeId, date } = req.params;
		try {
			const { rows } = await pool.query(
				`SELECT * FROM time_slots WHERE employee_id = $1 AND date = $2 AND is_available = TRUE ORDER BY start_time ASC`,
				[employeeId, date]
			);
			res.json(rows);
		} catch (err) {
			res
				.status(500)
				.json({
					message: "Erro ao buscar horários disponíveis",
					error: err.message,
				});
		}
	}
}

export default new SchedulingController();
