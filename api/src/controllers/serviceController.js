class ServiceController {
  constructor(){}
    async getAllServices(req, res) {
        const db = req.pool;
        try{
            const { rows } = await db.query(`
                SELECT s.id, s.name, s.description, s.base_cost, s.recommended_price, 
                       s.duration_minutes, s.profit_margin, s.is_active, 
                       c.name as category_name
                FROM services s
                JOIN service_categories c ON s.category_id = c.id
                ORDER BY s.name
            `);
            res.json(rows);
        }catch (err) {
            console.log("Erro ao buscar serviços:", err);
            res.status(500).json({ message: "Erro ao buscar serviços", error: err.message });
        }
    }

    async getServiceById(req, res) {
        const db = req.pool;
        const { id } = req.params;
        try {
            const { rows } = await db.query(`
                SELECT s.id, s.name, s.description, s.base_cost, s.recommended_price, 
                       s.duration_minutes, s.profit_margin, s.is_active, 
                       c.name as category_name
                FROM services s
                JOIN service_categories c ON s.category_id = c.id
                WHERE s.id = $1
            `, [id]);
            if (rows.length === 0) {
                return res.status(404).json({ message: "Serviço não encontrado" });
            }
            res.json(rows[0]);
        } catch (err) {
            console.log("Erro ao buscar serviço:", err);
            res.status(500).json({ message: "Erro ao buscar serviço", error: err.message });
        }
    }

    async getServicesByName(req, res) {
        const db = req.pool;
        const { name } = req.query;
        try {
            const { rows } = await db.query(`
                SELECT s.id, s.name, s.description, s.base_cost, s.recommended_price, 
                       s.duration_minutes, s.profit_margin, s.is_active, 
                       c.name as category_name
                FROM services s
                JOIN service_categories c ON s.category_id = c.id
                WHERE LOWER(s.name) LIKE LOWER($1)
                ORDER BY s.name
            `, [`%${name}%`]);
            res.json(rows);
        } catch (err) {
            console.log("Erro ao buscar serviços por nome:", err);
            res.status(500).json({ message: "Erro ao buscar serviços por nome", error: err.message });
        }
    }

    async createService(req, res) {
        const db = req.pool;
        const { name, description, base_cost, recommended_price, duration_minutes, profit_margin, category_id } = req.body;
        try {
            const { rows } = await db.query(`
                INSERT INTO services (name, description, base_cost, recommended_price, duration_minutes, profit_margin, category_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
            `, [name, description, base_cost, recommended_price, duration_minutes, profit_margin, category_id]);
            res.status(201).json(rows[0]);
        } catch (err) {
            console.log("Erro ao criar serviço:", err);
            res.status(500).json({ message: "Erro ao criar serviço", error: err.message });
        }
    }

    async updateService(req, res) {
        const db = req.pool;
        const { id } = req.params;
        const { name, description, base_cost, recommended_price, duration_minutes, profit_margin, category_id, is_active } = req.body;
        try {
            const { rows } = await db.query(`
                UPDATE services 
                SET name = $1, description = $2, base_cost = $3, recommended_price = $4, 
                    duration_minutes = $5, profit_margin = $6, category_id = $7, is_active = $8,
                    updated_at = NOW()
                WHERE id = $9
                RETURNING *
            `, [name, description, base_cost, recommended_price, duration_minutes, profit_margin, category_id, is_active, id]);
            if (rows.length === 0) {
                return res.status(404).json({ message: "Serviço não encontrado" });
            }
            res.json(rows[0]);
        } catch (err) {
            console.log("Erro ao atualizar serviço:", err);
            res.status(500).json({ message: "Erro ao atualizar serviço", error: err.message });
        }
    }

    async deleteService(req, res) {
        const db = req.pool;
        const { id } = req.params;
        try {
            const { rowCount } = await db.query(`
                DELETE FROM services 
                WHERE id = $1
            `, [id]);
            if (rowCount === 0) {
                return res.status(404).json({ message: "Serviço não encontrado" });
            }
            res.json({ message: "Serviço removido com sucesso" });
        } catch (err) {
            console.log("Erro ao remover serviço:", err);
            res.status(500).json({ message: "Erro ao remover serviço", error: err.message });
        }
    }

    async getServiceSpecialties(req, res) {
        const db = req.pool;
        const { id } = req.params;
        try {
            const { rows } = await db.query(`
                SELECT es.id, e.name as employee_name, s.name as service_name, es.commission_rate
                FROM employee_specialties es
                JOIN employees e ON es.employee_id = e.id
                JOIN services s ON es.service_id = s.id
                WHERE es.service_id = $1
            `, [id]);
            res.json(rows);
        } catch (err) {
            console.log("Erro ao buscar especialidades do serviço:", err);
            res.status(500).json({ message: "Erro ao buscar especialidades do serviço", error: err.message });
        }
    }

    async addServiceSpecialty(req, res) {
        const db = req.pool;
        const { id } = req.params;
        const { employee_id, commission_rate } = req.body;
        try {
            const { rows } = await db.query(`
                INSERT INTO employee_specialties (employee_id, service_id, commission_rate)
                VALUES ($1, $2, $3)
                RETURNING *
            `, [employee_id, id, commission_rate]);
            res.status(201).json(rows[0]);
        } catch (err) {
            console.log("Erro ao adicionar especialidade ao serviço:", err);
            res.status(500).json({ message: "Erro ao adicionar especialidade ao serviço", error: err.message });
        }
    }

    async updateServiceSpecialty(req, res) {
        const db = req.pool;
        const { id, specialtyId } = req.params;
        const { commission_rate } = req.body;
        try {
            const { rows } = await db.query(`
                UPDATE employee_specialties 
                SET commission_rate = $1, updated_at = NOW()
                WHERE id = $2 AND service_id = $3
                RETURNING *
            `, [commission_rate, specialtyId, id]);
            if (rows.length === 0) {
                return res.status(404).json({ message: "Especialidade não encontrada" });
            }
            res.json(rows[0]);
        } catch (err) {
            console.log("Erro ao atualizar especialidade do serviço:", err);
            res.status(500).json({ message: "Erro ao atualizar especialidade do serviço", error: err.message });
        }
    }

    async getServicesByCategory(req, res) {
        const db = req.pool;
        const { categoryId } = req.params;
        try {
            const { rows } = await db.query(`
                SELECT s.id, s.name, s.description, s.base_cost, s.recommended_price, 
                       s.duration_minutes, s.profit_margin, s.is_active
                FROM services s
                WHERE s.category_id = $1
                ORDER BY s.name
            `, [categoryId]);
            res.json(rows);
        } catch (err) {
            console.log("Erro ao buscar serviços por categoria:", err);
            res.status(500).json({ message: "Erro ao buscar serviços por categoria", error: err.message });
        }
    }
}

export default ServiceController;
