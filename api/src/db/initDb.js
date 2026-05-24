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
        email_enc TEXT,
        email_hash CHAR(64),
        reset_token_hash CHAR(64),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE TABLE IF NOT EXISTS employees (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE,
        phone VARCHAR(20),
        email_enc TEXT,
        email_hash CHAR(64),
        phone_enc TEXT,
        phone_hash CHAR(64),
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
        user_id INTEGER,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(20),
        address TEXT,
        birth_date DATE,
        birth_month SMALLINT,
        birth_day SMALLINT,
        notes TEXT,
        email_enc TEXT,
        email_hash CHAR(64),
        phone_enc TEXT,
        phone_hash CHAR(64),
        address_enc TEXT,
        birth_date_enc TEXT,
        notes_enc TEXT,
        first_visit DATE,
        last_visit DATE,
        total_visits INTEGER DEFAULT 0,
        total_spent DECIMAL(10,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ,FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
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
        payment_status VARCHAR(20) DEFAULT 'unpaid',
        payment_provider VARCHAR(30),
        payment_approved_by_user_id INTEGER,
        payment_approved_at TIMESTAMP,
        price DECIMAL(10,2) NOT NULL,
        commission_amount DECIMAL(10,2),
        notes TEXT,
        notes_enc TEXT,
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
        supplier_contact_enc TEXT,
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
        output_type VARCHAR(30),
        reason TEXT,
        notes TEXT,
        registered_by INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id),
        FOREIGN KEY (registered_by) REFERENCES users(id) ON DELETE SET NULL
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
        notes_enc TEXT,
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
        receipt_number_enc TEXT,
        supplier_name_enc TEXT,
        notes_enc TEXT,
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

      // Colunas criptografadas (financeiro/PII textual)
      await pool.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_number_enc TEXT;`);
      await pool.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS supplier_name_enc TEXT;`);
      await pool.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS notes_enc TEXT;`);
    } catch (err) {
      console.log('Algumas colunas já existiam ou houve erro ao adicionar:', err.message);
    }

    // Adicionar colunas criptografadas/hash para users/employees/clients/products (se não existirem)
    try {
      // users
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_enc TEXT;`);
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_hash CHAR(64);`);
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_hash CHAR(64);`);

      // employees
      await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS email_enc TEXT;`);
      await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS email_hash CHAR(64);`);
      await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS phone_enc TEXT;`);
      await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS phone_hash CHAR(64);`);

      // clients
      await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS user_id INTEGER;`);
      await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS email_enc TEXT;`);
      await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS email_hash CHAR(64);`);
      await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS phone_enc TEXT;`);
      await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS phone_hash CHAR(64);`);
      await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS address_enc TEXT;`);
      await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS birth_date_enc TEXT;`);
      await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS birth_month SMALLINT;`);
      await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS birth_day SMALLINT;`);
      await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS notes_enc TEXT;`);

      // products
      await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier_contact_enc TEXT;`);

      // appointments/sales (notes)
      await pool.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS notes_enc TEXT;`);
      await pool.query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS notes_enc TEXT;`);
    } catch (err) {
      console.log('Algumas colunas crypto/hash já existiam ou houve erro ao adicionar:', err.message);
    }

    // Transição: permitir users.email ficar NULL e mover unicidade para hash (evita plaintext obrigatório)
    try {
      await pool.query(`ALTER TABLE users ALTER COLUMN email DROP NOT NULL;`);
    } catch (err) {
      // ignore if already nullable
      void err;
    }

    // Remover UNIQUE antigo de users.email (se existir) para permitir limpar plaintext
    try {
      await pool.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE table_name = 'users' AND constraint_type = 'UNIQUE' AND constraint_name = 'users_email_key'
          ) THEN
            ALTER TABLE users DROP CONSTRAINT users_email_key;
          END IF;
        END $$;
      `);
    } catch (err) {
      console.log('Aviso ao ajustar constraint users_email_key:', err.message);
    }

    // Remover UNIQUE antigo de employees.email (se existir) e mover para hash
    try {
      await pool.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE table_name = 'employees' AND constraint_type = 'UNIQUE' AND constraint_name = 'employees_email_key'
          ) THEN
            ALTER TABLE employees DROP CONSTRAINT employees_email_key;
          END IF;
        END $$;
      `);
    } catch (err) {
      console.log('Aviso ao ajustar constraint employees_email_key:', err.message);
    }

    // Adicionar colunas faltantes na tabela stock_movements para saídas de inventário
    try {
      await pool.query(`ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS output_type VARCHAR(30);`);
      await pool.query(`ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS reason TEXT;`);
      await pool.query(`ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS registered_by INTEGER;`);
      await pool.query(`ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;`);
      
      // Adicionar foreign key para registered_by se não existir
      await pool.query(`
        DO $$ 
        BEGIN 
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'stock_movements_registered_by_fkey'
          ) THEN
            ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_registered_by_fkey 
            FOREIGN KEY (registered_by) REFERENCES users(id) ON DELETE SET NULL;
          END IF;
        END $$;
      `);
    } catch (err) {
      console.log('Algumas colunas de stock_movements já existiam ou houve erro ao adicionar:', err.message);
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
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_appointments_client_date_time ON appointments(client_id, appointment_date DESC, appointment_time DESC);`);
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
    
    // Índices para saídas de inventário
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON stock_movements(movement_type);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_stock_movements_output_type ON stock_movements(output_type) WHERE movement_type = 'output';`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_stock_movements_registered_by ON stock_movements(registered_by);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements(created_at DESC);`);

    // Índices/constraints para colunas hash (lookup exato e unicidade)
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_hash ON users(email_hash) WHERE email_hash IS NOT NULL;`);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_employees_email_hash ON employees(email_hash) WHERE email_hash IS NOT NULL;`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_employees_phone_hash ON employees(phone_hash) WHERE phone_hash IS NOT NULL;`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_clients_email_hash ON clients(email_hash) WHERE email_hash IS NOT NULL;`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_clients_phone_hash ON clients(phone_hash) WHERE phone_hash IS NOT NULL;`);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_clients_user_id ON clients(user_id) WHERE user_id IS NOT NULL;`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_clients_birth_month_day ON clients(birth_month, birth_day) WHERE birth_month IS NOT NULL AND birth_day IS NOT NULL;`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_reset_token_hash ON users(reset_token_hash) WHERE reset_token_hash IS NOT NULL;`);

    // FK for clients.user_id (if not present)
    try {
      await pool.query(`
        DO $$ 
        BEGIN 
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'clients_user_id_fkey'
          ) THEN
            ALTER TABLE clients ADD CONSTRAINT clients_user_id_fkey 
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
          END IF;
        END $$;
      `);
    } catch (err) {
      console.log('Aviso ao adicionar FK clients_user_id_fkey:', err.message);
    }

    // Pagamentos de agendamentos (serviços)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS appointment_payments (
        id SERIAL PRIMARY KEY,
        appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
        amount DECIMAL(10,2) NOT NULL,
        payment_method VARCHAR(30) NOT NULL,
        paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        notes_enc TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Mercado Pago - contas conectadas (OAuth) por usuário
    await pool.query(`
      CREATE TABLE IF NOT EXISTS mercadopago_accounts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        mp_user_id VARCHAR(64),
        access_token_enc TEXT,
        refresh_token_enc TEXT,
        token_type VARCHAR(30),
        scope TEXT,
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // PIX - intent/requests por agendamento (não substitui appointment_payments)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS appointment_pix_payments (
        id SERIAL PRIMARY KEY,
        appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
        provider VARCHAR(30) NOT NULL DEFAULT 'mercadopago',
        seller_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        mp_payment_id VARCHAR(64),
        mp_payment_status VARCHAR(40),
        amount DECIMAL(10,2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'BRL',
        idempotency_key VARCHAR(80),
        qr_code TEXT,
        qr_code_base64 TEXT,
        ticket_url TEXT,
        expires_at TIMESTAMP,
        created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Índices para integrações de pagamento
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_pix_payments_appt ON appointment_pix_payments(appointment_id, created_at DESC);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_pix_payments_mp_payment_id ON appointment_pix_payments(mp_payment_id) WHERE mp_payment_id IS NOT NULL;`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_mp_accounts_user_id ON mercadopago_accounts(user_id);`);

    // Evolução: adicionar notes_enc em appointment_payments (se tabela já existir)
    try {
      await pool.query(`ALTER TABLE appointment_payments ADD COLUMN IF NOT EXISTS notes_enc TEXT;`);
    } catch (err) {
      // ignore
      void err;
    }

    // Evolução: adicionar colunas de pagamento em appointments (se tabela já existir)
    try {
      await pool.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'unpaid';`);
      await pool.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS payment_provider VARCHAR(30);`);
      await pool.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS payment_approved_by_user_id INTEGER;`);
      await pool.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS payment_approved_at TIMESTAMP;`);
    } catch (err) {
      void err;
    }

    // Índice depende da coluna existir (bancos antigos podem não ter ainda)
    try {
      await pool.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'appointments'
              AND column_name = 'payment_status'
          ) THEN
            EXECUTE 'CREATE INDEX IF NOT EXISTS idx_appointments_payment_status ON appointments(payment_status)';
          END IF;
        END $$;
      `);
    } catch (err) {
      void err;
    }

    // FK para aprovação manual de pagamento (opcional)
    try {
      await pool.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'appointments_payment_approved_by_user_id_fkey'
          ) THEN
            ALTER TABLE appointments ADD CONSTRAINT appointments_payment_approved_by_user_id_fkey
            FOREIGN KEY (payment_approved_by_user_id) REFERENCES users(id) ON DELETE SET NULL;
          END IF;
        END $$;
      `);
    } catch (err) {
      void err;
    }

    // Índices para pagamentos de agendamentos
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_appt_payments_appt ON appointment_payments(appointment_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_appt_payments_paid_at ON appointment_payments(paid_at DESC);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_appt_payments_method ON appointment_payments(payment_method);`);

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

    // Criar extensão unaccent se não existir
    await pool.query(`CREATE EXTENSION IF NOT EXISTS unaccent;`);

    // Criar tabela de configurações de notificações dos funcionários
    await pool.query(`
      CREATE TABLE IF NOT EXISTS employee_notifications (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        notification_types JSONB DEFAULT '[]',
        enabled BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(employee_id)
      )
    `);

    // Criar índice para configurações de notificações
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_employee_notifications_employee ON employee_notifications(employee_id);`);

    // Mobile: in-app notifications for clients
    await pool.query(`
      CREATE TABLE IF NOT EXISTS client_notifications (
        id SERIAL PRIMARY KEY,
        client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL DEFAULT 'generic',
        title VARCHAR(255),
        body TEXT,
        data JSONB,
        is_read BOOLEAN NOT NULL DEFAULT false,
        read_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`CREATE INDEX IF NOT EXISTS idx_client_notifications_client_created ON client_notifications(client_id, created_at DESC);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_client_notifications_client_unread_created ON client_notifications(client_id, is_read, created_at DESC);`);

    // Mobile: device tokens for push notifications (FCM)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS client_devices (
        id SERIAL PRIMARY KEY,
        client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        platform VARCHAR(20) NOT NULL,
        token_enc TEXT NOT NULL,
        token_hash CHAR(64) NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(token_hash)
      )
    `);

    await pool.query(`CREATE INDEX IF NOT EXISTS idx_client_devices_client_enabled ON client_devices(client_id, enabled) WHERE enabled = TRUE;`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_client_devices_last_seen ON client_devices(last_seen DESC);`);

    console.log('Tabelas, índices e dados iniciais criados (se não existiam).');
  } catch (err) {
    console.error('Erro ao criar tabelas:', err);
    throw err;
  }
};
