import pool from './postgre.js';

// Criação das tabelas em queries separadas para evitar erros de parsing e facilitar manutenção
export const createTables = async () => {
  try {
    const queries = [
      `CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'employee',
        reset_token VARCHAR(255),
        reset_token_expires TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE TABLE IF NOT EXISTS employees (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE,
        phone VARCHAR(20),
        hire_date DATE,
        status VARCHAR(20) DEFAULT 'active',
        base_salary DECIMAL(10,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      );`,
      `CREATE TABLE IF NOT EXISTS service_categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE TABLE IF NOT EXISTS services (
        id SERIAL PRIMARY KEY,
        category_id INTEGER,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        base_cost DECIMAL(10,2) NOT NULL,
        recommended_price DECIMAL(10,2) NOT NULL,
        duration_minutes INTEGER NOT NULL,
        profit_margin DECIMAL(5,2),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES service_categories(id)
      );`,
      `CREATE TABLE IF NOT EXISTS employee_specialties (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER NOT NULL,
        service_id INTEGER NOT NULL,
        commission_rate DECIMAL(5,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
        FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
        UNIQUE(employee_id, service_id)
      );`,
      `CREATE TABLE IF NOT EXISTS clients (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(20),
        address TEXT,
        birth_date DATE,
        notes TEXT,
        first_visit DATE,
        last_visit DATE,
        total_visits INTEGER DEFAULT 0,
        total_spent DECIMAL(10,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE TABLE IF NOT EXISTS appointments (
        id SERIAL PRIMARY KEY,
        client_id INTEGER NOT NULL,
        employee_id INTEGER NOT NULL,
        service_id INTEGER NOT NULL,
        appointment_date DATE NOT NULL,
        appointment_time TIME NOT NULL,
        duration_minutes INTEGER NOT NULL,
        status VARCHAR(20) DEFAULT 'scheduled',
        price DECIMAL(10,2) NOT NULL,
        commission_amount DECIMAL(10,2),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES clients(id),
        FOREIGN KEY (employee_id) REFERENCES employees(id),
        FOREIGN KEY (service_id) REFERENCES services(id)
      );`,
      `CREATE TABLE IF NOT EXISTS product_categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        category_id INTEGER,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        sku VARCHAR(100) UNIQUE,
        cost_price DECIMAL(10,2) NOT NULL,
        selling_price DECIMAL(10,2) NOT NULL,
        current_stock INTEGER DEFAULT 0,
        min_stock_level INTEGER DEFAULT 0,
        max_stock_level INTEGER DEFAULT 0,
        supplier_name VARCHAR(255),
        supplier_contact TEXT,
        last_restocked DATE,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES product_categories(id)
      );`,
      `CREATE TABLE IF NOT EXISTS stock_movements (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL,
        movement_type VARCHAR(20) NOT NULL,
        quantity INTEGER NOT NULL,
        unit_cost DECIMAL(10,2),
        reference_type VARCHAR(30) NOT NULL,
        reference_id INTEGER,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id)
      );`,
      `CREATE TABLE IF NOT EXISTS sales (
        id SERIAL PRIMARY KEY,
        client_id INTEGER,
        employee_id INTEGER,
        sale_date DATE NOT NULL,
        subtotal DECIMAL(10,2) NOT NULL,
        tax_amount DECIMAL(10,2) DEFAULT 0,
        discount_amount DECIMAL(10,2) DEFAULT 0,
        total_amount DECIMAL(10,2) NOT NULL,
        payment_method VARCHAR(20) NOT NULL,
        status VARCHAR(20) DEFAULT 'completed',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES clients(id),
        FOREIGN KEY (employee_id) REFERENCES employees(id)
      );`,
      `CREATE TABLE IF NOT EXISTS sale_items (
        id SERIAL PRIMARY KEY,
        sale_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price DECIMAL(10,2) NOT NULL,
        total_price DECIMAL(10,2) NOT NULL,
        FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id)
      );`,
      `CREATE TABLE IF NOT EXISTS expense_categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        icon VARCHAR(50),
        color VARCHAR(7),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE TABLE IF NOT EXISTS employee_commissions (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER NOT NULL,
        appointment_id INTEGER,
        sale_id INTEGER,
        commission_type VARCHAR(20) NOT NULL,
        base_amount DECIMAL(10,2) NOT NULL,
        commission_rate DECIMAL(5,2) NOT NULL,
        commission_amount DECIMAL(10,2) NOT NULL,
        pay_period_start DATE NOT NULL,
        pay_period_end DATE NOT NULL,
        is_paid BOOLEAN DEFAULT FALSE,
        paid_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees(id),
        FOREIGN KEY (appointment_id) REFERENCES appointments(id),
        FOREIGN KEY (sale_id) REFERENCES sales(id)
      );`,
      `CREATE TABLE IF NOT EXISTS promotions (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        promotion_type VARCHAR(30) NOT NULL,
        discount_value DECIMAL(10,2) NOT NULL,
        target_type VARCHAR(20) NOT NULL,
        target_id INTEGER,
        min_purchase_amount DECIMAL(10,2) DEFAULT 0,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        usage_limit INTEGER,
        usage_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        setting_key VARCHAR(100) UNIQUE NOT NULL,
        setting_value TEXT,
        description TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE TABLE IF NOT EXISTS time_slots (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER NOT NULL,
        date DATE NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        is_available BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
        UNIQUE(employee_id, date, start_time)
      );`,
      `CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY,
        category_id INTEGER,
        category VARCHAR(50) NOT NULL,
        description VARCHAR(255) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        expense_date DATE NOT NULL,
        payment_method VARCHAR(30) NOT NULL,
        receipt_number VARCHAR(100),
        supplier_name VARCHAR(255),
        employee_id INTEGER,
        is_recurring BOOLEAN DEFAULT FALSE,
        recurrence_pattern VARCHAR(20),
        parent_expense_id INTEGER,
        tags TEXT[],
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES expense_categories(id),
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL,
        FOREIGN KEY (parent_expense_id) REFERENCES expenses(id) ON DELETE CASCADE
      );`
    ];

    for (const q of queries) {
      await pool.query(q);
    }

    // Adicionar colunas faltantes na tabela expenses se não existirem
    try {
      await pool.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS category_id INTEGER;`);
      await pool.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS supplier_name VARCHAR(255);`);
      await pool.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS employee_id INTEGER;`);
      await pool.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE;`);
      await pool.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS recurrence_pattern VARCHAR(20);`);
      await pool.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS parent_expense_id INTEGER;`);
      await pool.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS tags TEXT[];`);
      await pool.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;`);
    } catch (err) {
      console.log('Algumas colunas já existiam ou houve erro ao adicionar:', err.message);
    }

    // Adicionar constraints de chave estrangeira se não existirem
    try {
      await pool.query(`
        DO $$ 
        BEGIN 
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'expenses_category_id_fkey'
          ) THEN
            ALTER TABLE expenses ADD CONSTRAINT expenses_category_id_fkey 
            FOREIGN KEY (category_id) REFERENCES expense_categories(id);
          END IF;
        END $$;
      `);
      
      await pool.query(`
        DO $$ 
        BEGIN 
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'expenses_employee_id_fkey'
          ) THEN
            ALTER TABLE expenses ADD CONSTRAINT expenses_employee_id_fkey 
            FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;
          END IF;
        END $$;
      `);
      
      await pool.query(`
        DO $$ 
        BEGIN 
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'expenses_parent_expense_id_fkey'
          ) THEN
            ALTER TABLE expenses ADD CONSTRAINT expenses_parent_expense_id_fkey 
            FOREIGN KEY (parent_expense_id) REFERENCES expenses(id) ON DELETE CASCADE;
          END IF;
        END $$;
      `);
    } catch (err) {
      console.log('Erro ao adicionar constraints de expenses:', err.message);
    }

    // Índices para performance de consultas de agendamentos e slots
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_appointments_employee_date_time ON appointments(employee_id, appointment_date, appointment_time);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_appointments_date_time ON appointments(appointment_date, appointment_time);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_time_slots_employee_date_time ON time_slots(employee_id, date, start_time);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_appointments_status_date ON appointments(status, appointment_date);`);
    
    // Índices para performance de consultas de despesas
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_expenses_employee ON expenses(employee_id) WHERE employee_id IS NOT NULL;`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_expenses_date_category ON expenses(expense_date, category);`);
    
    // Índices adicionais para otimização
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_products_stock_level ON products(current_stock, min_stock_level);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_products_name_search ON products(name);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_services_category ON services(category_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_services_active ON services(is_active);`);

    // Inserir categorias padrão de despesas se não existirem
    const defaultCategories = [
      { name: 'Aluguel', description: 'Aluguel do estabelecimento', icon: 'home', color: '#3B82F6' },
      { name: 'Salários', description: 'Pagamento de funcionários', icon: 'users', color: '#10B981' },
      { name: 'Produtos', description: 'Compra de produtos e insumos', icon: 'package', color: '#F59E0B' },
      { name: 'Equipamentos', description: 'Compra e manutenção de equipamentos', icon: 'cog', color: '#8B5CF6' },
      { name: 'Marketing', description: 'Publicidade e marketing', icon: 'megaphone', color: '#EF4444' },
      { name: 'Utilidades', description: 'Água, luz, internet, telefone', icon: 'zap', color: '#06B6D4' },
      { name: 'Impostos', description: 'Impostos e taxas', icon: 'file-text', color: '#84CC16' },
      { name: 'Manutenção', description: 'Manutenção do estabelecimento', icon: 'wrench', color: '#F97316' },
      { name: 'Transporte', description: 'Combustível e transporte', icon: 'truck', color: '#6366F1' },
      { name: 'Outros', description: 'Outras despesas não categorizadas', icon: 'more-horizontal', color: '#6B7280' }
    ];

    for (const category of defaultCategories) {
      await pool.query(`
        INSERT INTO expense_categories (name, description, icon, color)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (name) DO NOTHING
      `, [category.name, category.description, category.icon, category.color]);
    }

    console.log('Tabelas, índices e dados iniciais criados (se não existiam).');
  } catch (err) {
    console.error('Erro ao criar tabelas:', err);
  }
};
