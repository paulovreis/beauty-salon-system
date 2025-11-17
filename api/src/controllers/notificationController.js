import pool from '../db/postgre.js';
import whatsappService from '../services/whatsappNotificationService.js';

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
        'appointment_changes',
        'new_appointments',
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

    res.json({
      success: true,
      data: result.rows[0]
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

    // Validar tipos de notificação
    const validTypes = [
      'daily_schedule',
      'appointment_changes',
      'new_appointments',
      'cancellations',
      'inventory_alerts',
      'financial_reports',
      'client_updates'
    ];

    if (notification_types && !Array.isArray(notification_types)) {
      return res.status(400).json({
        success: false,
        message: 'notification_types deve ser um array'
      });
    }

    if (notification_types && notification_types.some(type => !validTypes.includes(type))) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de notificação inválido'
      });
    }

    const result = await pool.query(`
      UPDATE employee_notifications 
      SET 
        notification_types = COALESCE($2, notification_types),
        enabled = COALESCE($3, enabled),
        updated_at = CURRENT_TIMESTAMP
      WHERE employee_id = $1
      RETURNING *
    `, [employeeId, notification_types ? JSON.stringify(notification_types) : null, enabled]);

    if (result.rows.length === 0) {
      // Criar se não existir
      const insertResult = await pool.query(`
        INSERT INTO employee_notifications (employee_id, notification_types, enabled)
        VALUES ($1, $2, $3)
        RETURNING *
      `, [employeeId, JSON.stringify(notification_types || []), enabled !== undefined ? enabled : true]);

      return res.json({
        success: true,
        data: insertResult.rows[0],
        message: 'Configurações de notificação criadas com sucesso'
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Configurações de notificação atualizadas com sucesso'
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
      WHERE e.status = 'active'
      ORDER BY e.name
    `);

    // Para funcionários sem configuração, criar configuração padrão
    const employeesWithoutConfig = result.rows.filter(row => !row.notification_types);
    const defaultTypes = ['daily_schedule', 'appointment_changes', 'new_appointments', 'cancellations'];

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
      WHERE e.status = 'active'
      ORDER BY e.name
    `);

    res.json({
      success: true,
      data: finalResult.rows
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
        name: 'Programação Diária',
        description: 'Receber resumo diário dos agendamentos',
        category: 'schedule'
      },
      {
        key: 'appointment_changes',
        name: 'Alterações de Agendamento',
        description: 'Notificações sobre mudanças nos agendamentos',
        category: 'schedule'
      },
      {
        key: 'new_appointments',
        name: 'Novos Agendamentos',
        description: 'Notificações sobre novos agendamentos',
        category: 'schedule'
      },
      {
        key: 'cancellations',
        name: 'Cancelamentos',
        description: 'Notificações sobre cancelamentos de agendamentos',
        category: 'schedule'
      },
      {
        key: 'inventory_alerts',
        name: 'Alertas de Estoque',
        description: 'Alertas sobre produtos com estoque baixo',
        category: 'inventory'
      },
      {
        key: 'financial_reports',
        name: 'Relatórios Financeiros',
        description: 'Resumos financeiros diários/semanais',
        category: 'financial'
      },
      {
        key: 'client_updates',
        name: 'Atualizações de Clientes',
        description: 'Notificações sobre novos clientes e atualizações',
        category: 'client'
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
      WHERE e.id = $1 AND e.status = 'active'
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