import pool from '../db/postgre.js';
import whatsappService from '../services/whatsappNotificationService.js';

// Lista centralizada dos tipos válidos (mantém sincronizado com getNotificationTypes)
const VALID_NOTIFICATION_TYPES = [
  'daily_schedule',
  'new_appointments',
  'appointment_changes',
  'cancellations',
  'confirmations',
  'completions',
  'daily_analysis',
  'system_changes',
  'low_stock',
  'financial_updates'
];

// Mapeamento de aliases/nomes antigos para novos identificadores padronizados
// Isto evita erros ao atualizar configurações que já contenham chaves antigas.
const TYPE_ALIASES = {
  daily_clients: 'daily_schedule',
  dailyClients: 'daily_schedule',
  daily_agenda: 'daily_schedule',
  newAppointment: 'new_appointments',
  appointment_update: 'appointment_changes',
  appointment_change: 'appointment_changes',
  appointment_cancel: 'cancellations',
  appointment_canceled: 'cancellations',
  appointment_confirm: 'confirmations',
  appointment_confirmation: 'confirmations',
  appointment_complete: 'completions',
  appointment_completed: 'completions',
  daily_report: 'daily_analysis',
  system_update: 'system_changes',
  system_change: 'system_changes',
  low_stock_alert: 'low_stock',
  estoque_baixo: 'low_stock',
  financial_summary: 'financial_updates',
  financial_update: 'financial_updates'
};

// Normaliza, aplica aliases, remove duplicados e filtra inválidos.
function normalizeTypes(types) {
  if (!Array.isArray(types)) return [];
  const mapped = types.map(t => TYPE_ALIASES[t] || t).filter(t => typeof t === 'string');
  const unique = [...new Set(mapped)];
  return unique.filter(t => VALID_NOTIFICATION_TYPES.includes(t));
}

// Obter configurações de notificação de um funcionário
export const getEmployeeNotificationSettings = async (req, res) => {
  try {
    const { employeeId } = req.params;
    
    // Verificar se o usuário pode acessar essas configurações
    if (req.user.role !== 'owner' && req.user.role !== 'manager' && req.user.employee_id !== parseInt(employeeId)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Acesso negado' 
      });
    }

    const result = await pool.query(`
      SELECT 
        en.*,
        e.name as employee_name,
        u.role as employee_role
      FROM employee_notifications en
      JOIN employees e ON e.id = en.employee_id
      LEFT JOIN users u ON u.id = e.user_id
      WHERE en.employee_id = $1
    `, [employeeId]);

    if (result.rows.length === 0) {
      // Criar configuração padrão se não existir
      const defaultTypes = [
        'daily_schedule',
        'new_appointments',
        'appointment_changes',
        'cancellations'
      ];

      const insertResult = await pool.query(`
        INSERT INTO employee_notifications (employee_id, notification_types, enabled)
        VALUES ($1, $2, true)
        RETURNING *
      `, [employeeId, JSON.stringify(defaultTypes)]);

      const employeeResult = await pool.query(`
        SELECT e.name, u.role 
        FROM employees e 
        LEFT JOIN users u ON u.id = e.user_id 
        WHERE e.id = $1
      `, [employeeId]);

      return res.json({
        success: true,
        data: {
          ...insertResult.rows[0],
          employee_name: employeeResult.rows[0]?.name,
          employee_role: employeeResult.rows[0]?.role
        }
      });
    }

    const row = result.rows[0];
    let types = [];
    try {
      types = Array.isArray(row.notification_types)
        ? normalizeTypes(row.notification_types)
        : Array.isArray(JSON.parse(row.notification_types || '[]'))
          ? normalizeTypes(JSON.parse(row.notification_types || '[]'))
          : [];
    } catch {
      types = [];
    }
    res.json({
      success: true,
      data: { ...row, notification_types: types }
    });
  } catch (error) {
    console.error('Erro ao buscar configurações de notificação:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro interno do servidor' 
    });
  }
};

// Atualizar configurações de notificação de um funcionário
export const updateEmployeeNotificationSettings = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { notification_types, enabled } = req.body;

    // Verificar se o usuário pode atualizar essas configurações
    if (req.user.role !== 'owner' && req.user.role !== 'manager' && req.user.employee_id !== parseInt(employeeId)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Acesso negado' 
      });
    }

    // Validar / normalizar tipos de notificação (suporta aliases antigos)
    if (notification_types && !Array.isArray(notification_types)) {
      return res.status(400).json({
        success: false,
        message: 'notification_types deve ser um array'
      });
    }

    let sanitizedTypes = null;
    let dropped = [];
    if (Array.isArray(notification_types)) {
      const before = [...notification_types];
      sanitizedTypes = normalizeTypes(notification_types);
      // Quais foram descartados (inválidos após alias + filtro)
      dropped = before
        .map(t => TYPE_ALIASES[t] || t)
        .filter(t => !VALID_NOTIFICATION_TYPES.includes(t));
    }

    const result = await pool.query(`
      UPDATE employee_notifications 
      SET 
        notification_types = COALESCE($2, notification_types),
        enabled = COALESCE($3, enabled),
        updated_at = CURRENT_TIMESTAMP
      WHERE employee_id = $1
      RETURNING *
    `, [employeeId, sanitizedTypes ? JSON.stringify(sanitizedTypes) : null, enabled]);

    if (result.rows.length === 0) {
      // Criar se não existir
      const insertResult = await pool.query(`
        INSERT INTO employee_notifications (employee_id, notification_types, enabled)
        VALUES ($1, $2, $3)
        RETURNING *
      `, [employeeId, JSON.stringify(sanitizedTypes || []), enabled !== undefined ? enabled : true]);

      return res.json({
        success: true,
        data: insertResult.rows[0],
        message: 'Configurações de notificação criadas com sucesso'
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: dropped.length
        ? `Configurações atualizadas. Tipos inválidos foram descartados: ${dropped.join(', ')}`
        : 'Configurações de notificação atualizadas com sucesso'
    });
  } catch (error) {
    console.error('Erro ao atualizar configurações de notificação:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro interno do servidor' 
    });
  }
};

// Listar configurações de notificação de todos os funcionários (apenas owner/manager)
export const getAllEmployeeNotificationSettings = async (req, res) => {
  try {
    // Apenas owner e manager podem ver todas as configurações
    if (req.user.role !== 'owner' && req.user.role !== 'manager') {
      return res.status(403).json({ 
        success: false, 
        message: 'Acesso negado' 
      });
    }

    const result = await pool.query(`
      SELECT 
        e.id as employee_id,
        e.name as employee_name,
        u.role as employee_role,
        e.phone as employee_phone,
        en.notification_types,
        en.enabled,
        en.updated_at
      FROM employees e
      LEFT JOIN users u ON u.id = e.user_id
      LEFT JOIN employee_notifications en ON en.employee_id = e.id
      ORDER BY e.name
    `);

    // Para funcionários sem configuração, criar configuração padrão
    const employeesWithoutConfig = result.rows.filter(row => !row.notification_types);
    const defaultTypes = ['daily_schedule', 'new_appointments', 'appointment_changes', 'cancellations'];

    for (const employee of employeesWithoutConfig) {
      await pool.query(`
        INSERT INTO employee_notifications (employee_id, notification_types, enabled)
        VALUES ($1, $2, true)
        ON CONFLICT (employee_id) DO NOTHING
      `, [employee.employee_id, JSON.stringify(defaultTypes)]);
    }

    // Buscar novamente com as configurações criadas
    const finalResult = await pool.query(`
      SELECT 
        e.id as employee_id,
        e.name as employee_name,
        u.role as employee_role,
        e.phone as employee_phone,
        en.notification_types,
        en.enabled,
        en.updated_at
      FROM employees e
      LEFT JOIN users u ON u.id = e.user_id
      LEFT JOIN employee_notifications en ON en.employee_id = e.id
      ORDER BY e.name
    `);

    const sanitized = finalResult.rows.map(r => {
      let types = [];
      try {
        types = Array.isArray(r.notification_types)
          ? normalizeTypes(r.notification_types)
          : Array.isArray(JSON.parse(r.notification_types || '[]'))
            ? normalizeTypes(JSON.parse(r.notification_types || '[]'))
            : [];
      } catch {
        types = [];
      }
      return { ...r, notification_types: types };
    });
    res.json({
      success: true,
      data: sanitized
    });
  } catch (error) {
    console.error('Erro ao buscar configurações de notificação de funcionários:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro interno do servidor' 
    });
  }
};

// Obter tipos de notificação disponíveis
export const getNotificationTypes = async (req, res) => {
  try {
    const notificationTypes = [
      {
        key: 'daily_schedule',
        name: 'Agenda Diária',
        description: 'Receber lista de clientes do dia todas as manhãs',
        category: 'schedule',
        roles: ['owner', 'manager', 'employee']
      },
      {
        key: 'new_appointments',
        name: 'Novos Agendamentos',
        description: 'Notificação quando um novo agendamento for feito',
        category: 'schedule',
        roles: ['owner', 'manager', 'employee']
      },
      {
        key: 'appointment_changes',
        name: 'Alterações em Agendamentos',
        description: 'Notificação quando um agendamento for alterado',
        category: 'schedule',
        roles: ['owner', 'manager', 'employee']
      },
      {
        key: 'cancellations',
        name: 'Cancelamentos',
        description: 'Notificação quando um agendamento for cancelado',
        category: 'schedule',
        roles: ['owner', 'manager', 'employee']
      },
      {
        key: 'confirmations',
        name: 'Confirmações',
        description: 'Notificação quando um agendamento for confirmado',
        category: 'schedule',
        roles: ['owner', 'manager', 'employee']
      },
      {
        key: 'completions',
        name: 'Serviços Concluídos',
        description: 'Notificação quando um serviço for marcado como concluído',
        category: 'schedule',
        roles: ['owner', 'manager', 'employee']
      },
      {
        key: 'daily_analysis',
        name: 'Análise Diária Completa',
        description: 'Relatório completo do dia (financeiro, estoque, clientes)',
        category: 'management',
        roles: ['owner', 'manager']
      },
      {
        key: 'system_changes',
        name: 'Alterações no Sistema',
        description: 'Notificações sobre novos produtos, serviços, alterações de estoque',
        category: 'management',
        roles: ['owner', 'manager']
      },
      {
        key: 'low_stock',
        name: 'Estoque Baixo',
        description: 'Alertas quando produtos estiverem com estoque baixo',
        category: 'inventory',
        roles: ['owner', 'manager']
      },
      {
        key: 'financial_updates',
        name: 'Atualizações Financeiras',
        description: 'Notificações sobre despesas, receitas e alterações financeiras',
        category: 'financial',
        roles: ['owner', 'manager']
      }
    ];

    res.json({
      success: true,
      data: notificationTypes
    });
  } catch (error) {
    console.error('Erro ao buscar tipos de notificação:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro interno do servidor' 
    });
  }
};

// Enviar notificações diárias para funcionários
export const sendDailyNotifications = async (req, res) => {
  try {
    // Verificar se o usuário pode enviar notificações diárias
    if (req.user.role !== 'owner' && req.user.role !== 'manager') {
      return res.status(403).json({ 
        success: false, 
        message: 'Acesso negado' 
      });
    }

    const { date } = req.body;
    const targetDate = date; // Deixar o serviço determinar a data se não fornecida

    try {
      await whatsappService.sendDailyClientsNotification(targetDate);
      
      const finalDate = targetDate || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
      res.json({
        success: true,
        message: `Notificações diárias enviadas para ${finalDate}`,
        date: finalDate
      });
    } catch (whatsappError) {
      console.error('Erro ao enviar notificações diárias:', whatsappError);
      const finalDate = targetDate || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
      res.status(500).json({
        success: false,
        message: `Erro ao enviar notificações diárias: ${whatsappError.message}`,
        date: finalDate
      });
    }
  } catch (error) {
    console.error('Erro ao processar notificações diárias:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro interno do servidor' 
    });
  }
};

// Verificar e enviar notificações de estoque baixo (apenas owner/manager)
export const checkLowStock = async (req, res) => {
  try {
    // Verificar se o usuário pode executar esta ação
    if (req.user.role !== 'owner' && req.user.role !== 'manager') {
      return res.status(403).json({ 
        success: false, 
        message: 'Acesso negado' 
      });
    }

    const pool = (await import('../db/postgre.js')).default;
    const dynamicWhatsappService = (await import('../services/whatsappNotificationService.js')).default;

    // Buscar produtos com estoque baixo
    const lowStockQuery = `
      SELECT id, name, current_stock, min_stock_level
      FROM products 
      WHERE current_stock <= min_stock_level 
      AND is_active = true 
      ORDER BY current_stock ASC
    `;

    const result = await pool.query(lowStockQuery);
    const lowStockProducts = result.rows;

    if (lowStockProducts.length === 0) {
      return res.json({
        success: true,
        message: 'Nenhum produto com estoque baixo encontrado',
        data: { products: [], count: 0 }
      });
    }

    // Enviar notificações WhatsApp
    await dynamicWhatsappService.sendLowStockNotification(lowStockProducts);

    res.json({
      success: true,
      message: `Notificações de estoque baixo enviadas para ${lowStockProducts.length} produtos`,
      data: { products: lowStockProducts, count: lowStockProducts.length }
    });
  } catch (error) {
    console.error('Erro ao verificar estoque baixo:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro interno do servidor' 
    });
  }
};

// Enviar análise diária completa (apenas owner/manager)
export const sendDailyAnalysis = async (req, res) => {
  try {
    // Verificar se é owner ou manager
    if (!['owner', 'manager'].includes(req.user.role)) {
      return res.status(403).json({ 
        message: 'Acesso negado: apenas proprietários e gerentes podem enviar análise diária' 
      });
    }

    await whatsappService.sendDailyAnalysisNotification();
    
    res.json({ 
      message: 'Análise diária enviada com sucesso para gerentes e proprietários',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erro ao enviar análise diária:', error);
    res.status(500).json({ 
      message: 'Erro interno do servidor ao enviar análise diária',
      error: error.message 
    });
  }
};

// Enviar notificação de alteração no sistema
export const sendSystemChangeNotification = async (req, res) => {
  try {
    const { changeType, details, affectedEntity } = req.body;

    if (!changeType || !details) {
      return res.status(400).json({ 
        message: 'Tipo de alteração e detalhes são obrigatórios' 
      });
    }

    await whatsappService.sendSystemChangeNotification(
      changeType, 
      details, 
      affectedEntity
    );
    
    res.json({ 
      message: 'Notificação de alteração no sistema enviada com sucesso',
      changeType,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erro ao enviar notificação de alteração:', error);
    res.status(500).json({ 
      message: 'Erro interno do servidor ao enviar notificação de alteração',
      error: error.message 
    });
  }
};

// Enviar alerta de estoque baixo
export const sendLowStockAlert = async (req, res) => {
  try {
    // Verificar se é owner ou manager
    if (!['owner', 'manager'].includes(req.user.role)) {
      return res.status(403).json({ 
        message: 'Acesso negado: apenas proprietários e gerentes podem enviar alertas de estoque' 
      });
    }

    // Buscar produtos com estoque baixo
    const lowStockQuery = `
      SELECT name, current_stock, min_stock_level
      FROM products 
      WHERE current_stock <= min_stock_level AND is_active = true
      ORDER BY (current_stock - min_stock_level) ASC
    `;
    
    const result = await pool.query(lowStockQuery);
    const lowStockProducts = result.rows;

    if (lowStockProducts.length === 0) {
      return res.json({ 
        message: 'Nenhum produto com estoque baixo encontrado',
        products: []
      });
    }

    await whatsappService.sendLowStockNotification(lowStockProducts);
    
    res.json({ 
      message: `Alerta de estoque baixo enviado para ${lowStockProducts.length} produto(s)`,
      products: lowStockProducts,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erro ao enviar alerta de estoque:', error);
    res.status(500).json({ 
      message: 'Erro interno do servidor ao enviar alerta de estoque',
      error: error.message 
    });
  }
};

// Enviar lembrete de agendamento
export const sendAppointmentReminder = async (req, res) => {
  try {
    const { appointmentId } = req.params;

    if (!appointmentId) {
      return res.status(400).json({ message: 'ID do agendamento é obrigatório' });
    }

    await whatsappService.sendAppointmentReminder(appointmentId);
    
    res.json({ 
      message: 'Lembrete de agendamento enviado com sucesso',
      appointmentId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erro ao enviar lembrete:', error);
    res.status(500).json({ 
      message: 'Erro interno do servidor ao enviar lembrete',
      error: error.message 
    });
  }
};

// Enviar notificação de teste
export const sendTestNotification = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { message } = req.body || {};

    // Verificar se o usuário pode enviar notificações de teste
    if (req.user.role !== 'owner' && req.user.role !== 'manager') {
      return res.status(403).json({ 
        success: false, 
        message: 'Acesso negado' 
      });
    }

    // Buscar dados do funcionário
    const employeeResult = await pool.query(`
      SELECT e.name, e.phone, en.enabled
      FROM employees e
      LEFT JOIN employee_notifications en ON en.employee_id = e.id
      WHERE e.id = $1
    `, [employeeId]);

    if (employeeResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Funcionário não encontrado'
      });
    }

    const employee = employeeResult.rows[0];

    if (!employee.enabled) {
      return res.status(400).json({
        success: false,
        message: 'Notificações desabilitadas para este funcionário'
      });
    }

    if (!employee.phone) {
      return res.status(400).json({
        success: false,
        message: 'Funcionário não possui número de telefone cadastrado'
      });
    }

    // Integrar com o serviço de WhatsApp
    const testMessage = message || `🧪 *Teste de Notificação*\n\nOlá, ${employee.name}!\n\nEsta é uma mensagem de teste do sistema de notificações do salão.\n\n✅ Suas notificações estão funcionando corretamente!`;

    try {
      // Usar o serviço de WhatsApp para enviar a mensagem
      await whatsappService.sendMessage(employee.phone, testMessage);
      
      res.json({
        success: true,
        message: 'Notificação de teste enviada com sucesso',
        data: {
          employee_name: employee.name,
          phone: employee.phone,
          message: testMessage
        }
      });
    } catch (whatsappError) {
      console.error('Erro ao enviar via WhatsApp:', whatsappError);
      res.status(500).json({
        success: false,
        message: `Erro ao enviar WhatsApp: ${whatsappError.message}`,
        data: {
          employee_name: employee.name,
          phone: employee.phone,
          message: testMessage
        }
      });
    }
  } catch (error) {
    console.error('Erro ao enviar notificação de teste:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro interno do servidor' 
    });
  }
};