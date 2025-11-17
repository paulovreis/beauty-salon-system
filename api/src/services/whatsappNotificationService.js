import pool from '../db/postgre.js';
import dotenv from 'dotenv';
dotenv.config();

class WhatsAppNotificationService {
  constructor() {
    this.evolutionApiUrl = 'http://evolution-api:8080';
    this.apiKey = process.env.EVOLUTION_API_KEY || '2f8c1e7b-4a6d-4e2a-9c3b-7e5d2a1f9b6e';
    this.defaultInstance = 'main';
  }

  // Método para fazer requisições à Evolution API
  async makeApiRequest(endpoint, method = 'GET', data = null) {
    const url = `${this.evolutionApiUrl}${endpoint}`;
    const config = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'apikey': this.apiKey
      }
    };

    if (data && method !== 'GET') {
      config.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, config);
      const responseData = await response.json();
      
      if (!response.ok) {
        throw new Error(responseData.message || `HTTP ${response.status}`);
      }
      
      return responseData;
    } catch (error) {
      console.error('Evolution API Error:', error);
      throw error;
    }
  }

  // Obter instância ativa
  async getActiveInstance() {
    try {
      const instances = await this.makeApiRequest('/instance/fetchInstances');
      const activeInstance = instances.find(instance => 
        instance.connectionStatus === 'open'
      );
      
      if (!activeInstance) {
        throw new Error('Nenhuma instância WhatsApp conectada encontrada');
      }
      
      return activeInstance.name;
    } catch (error) {
      console.error('Erro ao obter instância ativa:', error);
      return this.defaultInstance; // fallback
    }
  }

  // Formatar número de telefone para WhatsApp (adicionar prefixo 55)
  formatPhoneNumber(phone) {
    if (!phone) return null;
    
    // Remove todos os caracteres não numéricos
    const cleaned = phone.replace(/\D/g, '');
    
    // Se começar com 0, remove (código de área antigo)
    const withoutZero = cleaned.startsWith('0') ? cleaned.substring(1) : cleaned;
    
    // Se não tem código do país, adiciona 55 (Brasil)
    if (withoutZero.length === 10 || withoutZero.length === 11) {
      return `55${withoutZero}`;
    }
    
    // Se já tem 13 dígitos (55 + 11 dígitos), usa como está
    if (withoutZero.length === 13 && withoutZero.startsWith('55')) {
      return withoutZero;
    }
    
    // Se não tem formato válido, log e retorna null
    console.warn(`Número de telefone inválido: ${phone} (limpo: ${cleaned})`);
    return null;
  }

  // Enviar mensagem
  async sendMessage(phone, message) {
    try {
      const formattedPhone = this.formatPhoneNumber(phone);
      if (!formattedPhone) {
        console.warn(`Pulando envio para telefone inválido: ${phone}`);
        return { success: false, reason: 'invalid_phone' };
      }

      const instanceName = await this.getActiveInstance();
      console.log(`Usando instância: ${instanceName} para enviar mensagem`);
      
      const result = await this.makeApiRequest(
        `/message/sendText/${instanceName}`,
        'POST',
        {
          number: formattedPhone,
          text: message
        }
      );

      console.log(`Mensagem enviada para ${formattedPhone}: ${message.substring(0, 50)}...`);
      return result;
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      throw error;
    }
  }

  // TEMPLATES DE MENSAGENS PARA FUNCIONÁRIOS

  // Template: Clientes do dia
  createDailyClientsMessage(employee, appointments, date) {
    // Criar formatação manual da data para evitar problemas de timezone
    const [year, month, day] = date.split('-');
    const dateNum = parseInt(day);
    const monthNum = parseInt(month);
    
    const months = [
      'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
      'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
    ];
    
    const weekdays = [
      'domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 
      'quinta-feira', 'sexta-feira', 'sábado'
    ];
    
    // Criar data UTC para cálculo do dia da semana
    const tempDate = new Date(year, month - 1, day);
    const weekday = weekdays[tempDate.getDay()];
    
    const formattedDate = `${weekday}, ${dateNum} de ${months[monthNum - 1]} de ${year}`;

    let message = `🌅 *Bom dia, ${employee.name}!*\n\n`;
    message += `📅 *Agenda de ${formattedDate}*\n`;
    message += `═══════════════════════\n\n`;

    if (appointments.length === 0) {
      message += `🎉 *Você não tem agendamentos hoje!*\n`;
      message += `Aproveite para descansar ou se preparar para os próximos dias! 💆‍♀️\n\n`;
    } else {
      message += `👥 *Você tem ${appointments.length} agendamento(s) hoje:*\n\n`;
      
      appointments.forEach((appointment, index) => {
        message += `🕐 *${appointment.appointment_time}* - ${appointment.client_name}\n`;
        message += `💅 Serviço: ${appointment.service_name}\n`;
        message += `💰 Valor: R$ ${parseFloat(appointment.service_price).toFixed(2)}\n`;
        message += `📱 Tel: ${appointment.client_phone || 'Não informado'}\n`;
        if (appointment.notes) {
          message += `📝 Obs: ${appointment.notes}\n`;
        }
        message += `───────────────\n`;
      });

      const totalValue = appointments.reduce((sum, apt) => sum + parseFloat(apt.service_price || 0), 0);
      message += `\n💰 *Total do dia: R$ ${totalValue.toFixed(2)}*\n`;
    }

    message += `\n✨ Tenha um ótimo dia de trabalho! ✨`;
    return message;
  }

  // Template: Novo agendamento
  createNewAppointmentMessage(employee, appointment) {
    let message = `🎉 *Novo Agendamento!*\n\n`;
    message += `👤 *Cliente:* ${appointment.client_name}\n`;
    message += `📱 *Telefone:* ${appointment.client_phone || 'Não informado'}\n`;
    message += `📅 *Data:* ${new Date(appointment.appointment_date).toLocaleDateString('pt-BR')}\n`;
    message += `🕐 *Horário:* ${appointment.appointment_time}\n`;
    message += `💅 *Serviço:* ${appointment.service_name}\n`;
    message += `💰 *Valor:* R$ ${parseFloat(appointment.service_price).toFixed(2)}\n`;
    
    if (appointment.notes) {
      message += `📝 *Observações:* ${appointment.notes}\n`;
    }
    
    message += `\n✅ Agendamento confirmado em seu nome!\n`;
    message += `📲 Prepare-se para atender mais este cliente! 💆‍♀️`;
    
    return message;
  }

  // Template: Agendamento cancelado
  createCancelledAppointmentMessage(employee, appointment, reason = '') {
    let message = `❌ *Agendamento Cancelado*\n\n`;
    message += `👤 *Cliente:* ${appointment.client_name}\n`;
    message += `📅 *Data:* ${new Date(appointment.appointment_date).toLocaleDateString('pt-BR')}\n`;
    message += `🕐 *Horário:* ${appointment.appointment_time}\n`;
    message += `💅 *Serviço:* ${appointment.service_name}\n`;
    message += `💰 *Valor:* R$ ${parseFloat(appointment.service_price).toFixed(2)}\n`;
    
    if (reason) {
      message += `📝 *Motivo:* ${reason}\n`;
    }
    
    message += `\n⚠️ Este horário agora está disponível na sua agenda.\n`;
    message += `💡 Que tal aproveitar para um tempo livre ou reagendar outro cliente?`;
    
    return message;
  }

  // Template: Agendamento confirmado
  createConfirmedAppointmentMessage(employee, appointment) {
    let message = `✅ *Agendamento Confirmado!*\n\n`;
    message += `👤 *Cliente:* ${appointment.client_name}\n`;
    message += `📱 *Telefone:* ${appointment.client_phone || 'Não informado'}\n`;
    message += `📅 *Data:* ${new Date(appointment.appointment_date).toLocaleDateString('pt-BR')}\n`;
    message += `🕐 *Horário:* ${appointment.appointment_time}\n`;
    message += `💅 *Serviço:* ${appointment.service_name}\n`;
    message += `💰 *Valor:* R$ ${parseFloat(appointment.service_price).toFixed(2)}\n`;
    
    message += `\n🎯 Cliente confirmou presença!\n`;
    message += `💪 Prepare-se para um atendimento incrível! ✨`;
    
    return message;
  }

  // Template: Alteração no agendamento
  createUpdatedAppointmentMessage(employee, oldAppointment, newAppointment, changes) {
    let message = `📝 *Agendamento Alterado*\n\n`;
    message += `👤 *Cliente:* ${newAppointment.client_name}\n\n`;
    message += `🔄 *Alterações realizadas:*\n`;
    message += `═══════════════════════\n`;
    
    changes.forEach(change => {
      message += `📌 *${change.field}:*\n`;
      message += `   ❌ Antes: ${change.oldValue}\n`;
      message += `   ✅ Agora: ${change.newValue}\n\n`;
    });
    
    message += `📅 *Dados atuais:*\n`;
    message += `🗓️ Data: ${new Date(newAppointment.appointment_date).toLocaleDateString('pt-BR')}\n`;
    message += `🕐 Horário: ${newAppointment.appointment_time}\n`;
    message += `💅 Serviço: ${newAppointment.service_name}\n`;
    message += `💰 Valor: R$ ${parseFloat(newAppointment.service_price).toFixed(2)}\n`;
    
    message += `\n🔔 Fique atento às mudanças! 👀`;
    
    return message;
  }

  // TEMPLATES ESPECIAIS PARA GERENTE/DONO

  // Template: Análise do dia
  createDailyAnalysisMessage(analysis) {
    const today = new Date().toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    let message = `📊 *RELATÓRIO DIÁRIO - ${today.toUpperCase()}*\n`;
    message += `═══════════════════════════════\n\n`;

    // Financeiro
    message += `💰 *FINANCEIRO*\n`;
    message += `├ 💵 Faturamento: R$ ${analysis.revenue.toFixed(2)}\n`;
    message += `├ 📉 Despesas: R$ ${analysis.expenses.toFixed(2)}\n`;
    message += `└ 📈 Lucro Líquido: R$ ${(analysis.revenue - analysis.expenses).toFixed(2)}\n\n`;

    // Agendamentos
    message += `📅 *AGENDAMENTOS*\n`;
    message += `├ ✅ Realizados: ${analysis.completedAppointments}\n`;
    message += `├ ❌ Cancelados: ${analysis.cancelledAppointments}\n`;
    message += `├ ⏳ Pendentes: ${analysis.pendingAppointments}\n`;
    message += `└ 💯 Taxa de Conclusão: ${analysis.completionRate}%\n\n`;

    // Clientes
    message += `👥 *CLIENTES*\n`;
    message += `├ 🆕 Novos: ${analysis.newClients}\n`;
    message += `├ 🔄 Retorno: ${analysis.returningClients}\n`;
    message += `└ 📊 Total Atendido: ${analysis.totalClientsServed}\n\n`;

    // Estoque
    if (analysis.lowStockItems && analysis.lowStockItems.length > 0) {
      message += `⚠️ *ESTOQUE BAIXO*\n`;
      analysis.lowStockItems.forEach(item => {
        message += `├ 📦 ${item.name}: ${item.quantity} unidades\n`;
      });
      message += `\n`;
    }

    // Funcionários
    message += `👨‍💼 *FUNCIONÁRIOS*\n`;
    analysis.employeeStats.forEach(emp => {
      message += `├ ${emp.name}: ${emp.appointments} agendamentos\n`;
    });

    message += `\n🏆 *Parabéns pela jornada de hoje!* 🌟`;
    
    return message;
  }

  // Template: Alteração de dados importantes
  createSystemUpdateMessage(updateType, details) {
    let message = `🔔 *ATUALIZAÇÃO DO SISTEMA*\n\n`;
    
    const icons = {
      'service': '💅',
      'product': '🛍️',
      'inventory': '📦',
      'expense': '💸',
      'employee': '👨‍💼',
      'client': '👤'
    };

    message += `${icons[updateType] || '📝'} *${updateType.toUpperCase()} ATUALIZADO*\n`;
    message += `───────────────────────\n`;
    
    Object.keys(details).forEach(key => {
      message += `📌 *${key}:* ${details[key]}\n`;
    });
    
    message += `\n⏰ ${new Date().toLocaleString('pt-BR')}\n`;
    message += `🔄 Sistema atualizado automaticamente.`;
    
    return message;
  }

  // TEMPLATES DE MENSAGENS PARA CLIENTES

  // Template: Confirmação de agendamento para cliente
  createClientAppointmentConfirmation(appointment) {
    let message = `✅ *Agendamento Confirmado!*\n\n`;
    message += `🎉 Olá, ${appointment.client_name}!\n`;
    message += `Seu agendamento foi realizado com sucesso!\n\n`;
    
    message += `📋 *DETALHES DO AGENDAMENTO:*\n`;
    message += `═══════════════════════════\n`;
    message += `📅 *Data:* ${new Date(appointment.appointment_date).toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })}\n`;
    message += `🕐 *Horário:* ${appointment.appointment_time}\n`;
    message += `💅 *Serviço:* ${appointment.service_name}\n`;
    message += `👨‍💼 *Profissional:* ${appointment.employee_name}\n`;
    message += `💰 *Valor:* R$ ${parseFloat(appointment.service_price).toFixed(2)}\n`;
    
    if (appointment.notes) {
      message += `📝 *Observações:* ${appointment.notes}\n`;
    }
    
    message += `\n📍 *${process.env.NOME_SALAO || 'Nosso Salão'}*\n`;
    message += `📱 Entre em contato conosco se precisar reagendar!\n\n`;
    message += `✨ *Estamos ansiosos para atendê-la!* ✨\n`;
    message += `💖 Obrigada pela preferência!`;
    
    return message;
  }

  // Template: Alteração de agendamento para cliente
  createClientAppointmentUpdate(appointment, changes) {
    let message = `🔄 *Agendamento Alterado*\n\n`;
    message += `Olá, ${appointment.client_name}!\n`;
    message += `Houve uma alteração no seu agendamento:\n\n`;
    
    message += `📝 *ALTERAÇÕES:*\n`;
    message += `═════════════════\n`;
    changes.forEach(change => {
      message += `🔸 *${change.field}:*\n`;
      message += `   ❌ ${change.oldValue}\n`;
      message += `   ✅ ${change.newValue}\n\n`;
    });
    
    message += `📋 *DADOS ATUALIZADOS:*\n`;
    message += `═══════════════════════\n`;
    message += `📅 Data: ${new Date(appointment.appointment_date).toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })}\n`;
    message += `🕐 Horário: ${appointment.appointment_time}\n`;
    message += `💅 Serviço: ${appointment.service_name}\n`;
    message += `👨‍💼 Profissional: ${appointment.employee_name}\n`;
    message += `💰 Valor: R$ ${parseFloat(appointment.service_price).toFixed(2)}\n`;
    
    message += `\n📱 Dúvidas? Entre em contato conosco!\n`;
    message += `💖 Obrigada pela compreensão!`;
    
    return message;
  }

  // Template: Cancelamento para cliente
  createClientAppointmentCancellation(appointment, reason = '') {
    let message = `😔 *Agendamento Cancelado*\n\n`;
    message += `Olá, ${appointment.client_name}!\n`;
    message += `Infelizmente seu agendamento foi cancelado:\n\n`;
    
    message += `📅 *Data:* ${new Date(appointment.appointment_date).toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric', 
      month: 'long',
      day: 'numeric'
    })}\n`;
    message += `🕐 *Horário:* ${appointment.appointment_time}\n`;
    message += `💅 *Serviço:* ${appointment.service_name}\n`;
    message += `👨‍💼 *Profissional:* ${appointment.employee_name}\n`;
    
    if (reason) {
      message += `📝 *Motivo:* ${reason}\n`;
    }
    
    message += `\n💔 Sentimos muito pelo inconveniente.\n`;
    message += `📞 Entre em contato para reagendar: [seu telefone]\n`;
    message += `💖 Esperamos vê-lo(a) em breve!`;
    
    return message;
  }

  // Template alternativo para cancelamento simples
  createSimpleCancellationMessage(appointment, reason = '') {
    let message = `❌ *Agendamento Cancelado*\n\n`;
    message += `👤 *Cliente:* ${appointment.client_name || 'N/A'}\n`;
    message += `📅 *Data:* ${appointment.appointment_date ? new Date(appointment.appointment_date).toLocaleDateString('pt-BR') : 'N/A'}\n`;
    message += `🕐 *Horário:* ${appointment.appointment_time || 'N/A'}\n`;
    message += `💅 *Serviço:* ${appointment.service_name || 'N/A'}\n`;
    message += `📝 *Motivo:* ${reason}\n`;
    
    message += `\n⚠️ Este horário agora está disponível na sua agenda.\n`;
    message += `💡 Que tal aproveitar para um tempo livre ou reagendar outro cliente?\n\n`;
    
    return message;
  }

  // Método para cancelamento com dados mínimos (usado pela mudança de status)
  async sendSimpleCancellationNotification(appointmentId, reason = 'Status alterado para cancelado') {
    try {
      // Query mais simples para pegar dados básicos
      const basicQuery = `
        SELECT a.*, c.name as client_name, e.name as employee_name, e.phone as employee_phone
        FROM appointments a
        LEFT JOIN clients c ON a.client_id = c.id
        LEFT JOIN employees e ON a.employee_id = e.id
        WHERE a.id = $1
      `;
      
      const result = await pool.query(basicQuery, [appointmentId]);
      if (result.rows.length === 0) return;
      
      const appointment = result.rows[0];
      
      // Notificar funcionário com dados mínimos
      if (appointment.employee_phone) {
        const employeeMessage = this.createSimpleCancellationMessage(appointment, reason);
        await this.sendMessage(appointment.employee_phone, employeeMessage);
      }
    } catch (error) {
      console.error('Erro ao enviar notificação simples de cancelamento:', error);
    }
    
    message += `📋 *DETALHES DO AGENDAMENTO CANCELADO:*\n`;
    message += `═══════════════════════════════════\n`;
    message += `📅 Data: ${new Date(appointment.appointment_date).toLocaleDateString('pt-BR')}\n`;
    message += `🕐 Horário: ${appointment.appointment_time}\n`;
    message += `💅 Serviço: ${appointment.service_name}\n`;
    message += `👨‍💼 Profissional: ${appointment.employee_name}\n`;
    
    if (reason) {
      message += `\n📝 *Motivo:* ${reason}\n`;
    }
    
    message += `\n🤝 *Queremos reagendar com você!*\n`;
    message += `📱 Entre em contato conosco para escolher um novo horário.\n`;
    message += `✨ Estamos ansiosos para atendê-la em breve!\n\n`;
    message += `💖 Desculpe pelo transtorno e obrigada pela compreensão!`;
    
    return message;
  }

  // MÉTODOS PARA BUSCAR DADOS DO BANCO

  // Buscar funcionários que devem receber notificações
  async getEmployeesForNotification(notificationType) {
    try {
      const query = `
        SELECT 
          e.id,
          e.name,
          e.phone,
          e.status,
          COALESCE(en.notification_types, '[]'::jsonb) as notification_types,
          COALESCE(en.enabled, true) as notifications_enabled
        FROM employees e
        LEFT JOIN employee_notifications en ON e.id = en.employee_id
        WHERE e.status = 'active'
        AND e.phone IS NOT NULL 
        AND e.phone != ''
        AND COALESCE(en.enabled, true) = true
        AND (
          en.notification_types IS NULL 
          OR en.notification_types @> $1::jsonb
        )
      `;
      
      const result = await pool.query(query, [JSON.stringify([notificationType])]);
      console.log(`Encontrados ${result.rows.length} funcionários para notificação '${notificationType}'`);
      return result.rows;
    } catch (error) {
      console.error('Erro ao buscar funcionários para notificação:', error);
      return [];
    }
  }

  // Buscar agendamentos do dia para um funcionário
  async getDailyAppointments(employeeId, date) {
    try {
      console.log(`Buscando agendamentos para funcionário ${employeeId} na data: ${date}`);
      const query = `
        SELECT a.*, c.name as client_name, c.phone as client_phone,
               s.name as service_name, a.price as service_price
        FROM appointments a
        JOIN clients c ON a.client_id = c.id
        JOIN services s ON a.service_id = s.id
        WHERE a.employee_id = $1 
        AND a.appointment_date = $2
        AND a.status != 'canceled'
        ORDER BY a.appointment_time
      `;
      
      const result = await pool.query(query, [employeeId, date]);
      console.log(`Resultado da consulta: ${result.rows.length} agendamentos encontrados`);
      if (result.rows.length > 0) {
        console.log('Agendamentos encontrados:', result.rows.map(row => ({
          id: row.id,
          client_name: row.client_name,
          appointment_time: row.appointment_time,
          appointment_date: row.appointment_date
        })));
      }
      return result.rows;
    } catch (error) {
      console.error('Erro ao buscar agendamentos do dia:', error);
      return [];
    }
  }

  // MÉTODOS PÚBLICOS PARA ENVIO DE NOTIFICAÇÕES

  // Enviar notificação de clientes do dia
  async sendDailyClientsNotification(date = null) {
    // Se não foi passada uma data, usar a data atual no fuso horário de São Paulo
    if (!date) {
      // Usar uma abordagem mais simples para obter a data de São Paulo
      const saoPauloDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
      date = saoPauloDate; // já retorna no formato YYYY-MM-DD
      console.log(`Data não fornecida, usando data atual de São Paulo: ${date}`);
    }
    try {
      console.log(`Iniciando envio de notificações diárias para a data: ${date}`);
      const employees = await this.getEmployeesForNotification('daily_schedule');
      
      if (employees.length === 0) {
        console.log('Nenhum funcionário encontrado para receber notificações diárias');
        return;
      }
      
      for (const employee of employees) {
        console.log(`Processando funcionário: ${employee.name} (ID: ${employee.id})`);
        const appointments = await this.getDailyAppointments(employee.id, date);
        console.log(`Encontrados ${appointments.length} agendamentos para ${employee.name}`);
        
        const message = this.createDailyClientsMessage(employee, appointments, date);
        
        try {
          const sendResult = await this.sendMessage(employee.phone, message);
          if (sendResult && sendResult.success === false) {
            console.log(`Pulando ${employee.name} - telefone inválido: ${employee.phone}`);
          } else {
            console.log(`Notificação enviada com sucesso para ${employee.name}`);
          }
        } catch (sendError) {
          console.error(`Erro ao enviar mensagem para ${employee.name}:`, sendError);
        }
      }
      
      console.log(`Notificações de clientes do dia enviadas para ${employees.length} funcionários`);
    } catch (error) {
      console.error('Erro ao enviar notificações de clientes do dia:', error);
    }
  }

  // Enviar notificação de novo agendamento
  async sendNewAppointmentNotification(appointmentId) {
    try {
      const appointmentQuery = `
        SELECT a.*, c.name as client_name, c.phone as client_phone,
               s.name as service_name, a.price as service_price,
               e.name as employee_name, e.phone as employee_phone
        FROM appointments a
        JOIN clients c ON a.client_id = c.id
        JOIN services s ON a.service_id = s.id
        JOIN employees e ON a.employee_id = e.id
        WHERE a.id = $1
      `;
      
      const result = await pool.query(appointmentQuery, [appointmentId]);
      if (result.rows.length === 0) return;
      
      const appointment = result.rows[0];
      
      // Notificar funcionário
      if (appointment.employee_phone) {
        const employeeMessage = this.createNewAppointmentMessage(
          { name: appointment.employee_name }, 
          appointment
        );
        await this.sendMessage(appointment.employee_phone, employeeMessage);
      }
      
      // Notificar cliente
      if (appointment.client_phone) {
        const clientMessage = this.createClientAppointmentConfirmation(appointment);
        await this.sendMessage(appointment.client_phone, clientMessage);
      }
      
      console.log(`Notificações de novo agendamento enviadas (ID: ${appointmentId})`);
    } catch (error) {
      console.error('Erro ao enviar notificação de novo agendamento:', error);
    }
  }

  // Buscar configurações de notificação de um funcionário
  async getEmployeeNotificationSettings(employeeId) {
    try {
      const result = await pool.query(`
        SELECT notification_types, enabled
        FROM employee_notifications
        WHERE employee_id = $1
      `, [employeeId]);

      if (result.rows.length === 0) {
        // Retornar configuração padrão se não existir
        return {
          notification_types: ['daily_schedule', 'appointment_changes', 'new_appointments', 'cancellations'],
          enabled: true
        };
      }

      return result.rows[0];
    } catch (error) {
      console.error('Erro ao buscar configurações de notificação:', error);
      return { notification_types: [], enabled: false };
    }
  }

  // Verificar se um funcionário deve receber um tipo específico de notificação
  async shouldReceiveNotification(employeeId, notificationType) {
    const settings = await this.getEmployeeNotificationSettings(employeeId);
    return settings.enabled && settings.notification_types.includes(notificationType);
  }

  // Enviar notificação de teste
  async sendTestNotification(employeeId, customMessage = null) {
    try {
      // Buscar dados do funcionário
      const result = await pool.query(`
        SELECT e.name, e.phone, en.enabled
        FROM employees e
        LEFT JOIN employee_notifications en ON en.employee_id = e.id
        WHERE e.id = $1 AND e.status = 'active'
      `, [employeeId]);

      if (result.rows.length === 0) {
        throw new Error('Funcionário não encontrado');
      }

      const employee = result.rows[0];

      if (!employee.enabled) {
        throw new Error('Notificações desabilitadas para este funcionário');
      }

      if (!employee.phone) {
        throw new Error('Funcionário não possui número de telefone cadastrado');
      }

      const testMessage = customMessage || `🧪 *Teste de Notificação*\n\nOlá, ${employee.name}!\n\nEsta é uma mensagem de teste do sistema de notificações do salão.\n\n✅ Suas notificações estão funcionando corretamente!`;

      await this.sendMessage(employee.phone, testMessage);

      return {
        success: true,
        employee_name: employee.name,
        phone: employee.phone,
        message: testMessage
      };
    } catch (error) {
      console.error('Erro ao enviar notificação de teste:', error);
      throw error;
    }
  }

  // Notificar funcionários com base no tipo de notificação
  async notifyEmployeesByType(notificationType, messageText, employees = null) {
    try {
      let targetEmployees = employees;

      if (!targetEmployees) {
        // Buscar todos os funcionários ativos se não especificado
        const result = await pool.query(`
          SELECT e.id, e.name, e.phone, e.role
          FROM employees e
          WHERE e.status = 'active' AND e.phone IS NOT NULL
        `);
        targetEmployees = result.rows;
      }

      const notifications = [];

      for (const employee of targetEmployees) {
        const shouldReceive = await this.shouldReceiveNotification(employee.id, notificationType);
        
        if (shouldReceive) {
          try {
            await this.sendMessage(employee.phone, messageText);
            notifications.push({
              employee_id: employee.id,
              employee_name: employee.name,
              phone: employee.phone,
              status: 'sent'
            });
          } catch (error) {
            console.error(`Erro ao enviar notificação para ${employee.name}:`, error);
            notifications.push({
              employee_id: employee.id,
              employee_name: employee.name,
              phone: employee.phone,
              status: 'error',
              error: error.message
            });
          }
        } else {
          notifications.push({
            employee_id: employee.id,
            employee_name: employee.name,
            phone: employee.phone,
            status: 'skipped',
            reason: 'notifications_disabled_or_type_not_allowed'
          });
        }
      }

      return notifications;
    } catch (error) {
      console.error('Erro ao notificar funcionários:', error);
      throw error;
    }
  }

  // Notificação de confirmação de agendamento
  async sendAppointmentConfirmationNotification(appointmentId) {
    try {
      const appointmentQuery = `
        SELECT a.*, c.name as client_name, c.phone as client_phone,
               s.name as service_name, a.price as service_price,
               e.name as employee_name, e.phone as employee_phone
        FROM appointments a
        JOIN clients c ON a.client_id = c.id
        JOIN services s ON a.service_id = s.id
        JOIN employees e ON a.employee_id = e.id
        WHERE a.id = $1
      `;
      
      const result = await pool.query(appointmentQuery, [appointmentId]);
      if (result.rows.length === 0) return;
      
      const appointment = result.rows[0];
      
      // Notificar funcionário
      if (appointment.employee_phone) {
        const employeeMessage = this.createConfirmedAppointmentMessage(appointment, 'employee');
        await this.sendMessage(appointment.employee_phone, employeeMessage);
      }
      
      // Notificar cliente
      if (appointment.client_phone) {
        const clientMessage = this.createConfirmedAppointmentMessage(appointment, 'client');
        await this.sendMessage(appointment.client_phone, clientMessage);
      }
    } catch (error) {
      console.error('Erro ao enviar notificação de confirmação:', error);
    }
  }

  // Notificação de conclusão de agendamento
  async sendAppointmentCompletionNotification(appointmentId) {
    try {
      const appointmentQuery = `
        SELECT a.*, c.name as client_name, c.phone as client_phone,
               s.name as service_name, a.price as service_price,
               e.name as employee_name, e.phone as employee_phone
        FROM appointments a
        JOIN clients c ON a.client_id = c.id
        JOIN services s ON a.service_id = s.id
        JOIN employees e ON a.employee_id = e.id
        WHERE a.id = $1
      `;
      
      const result = await pool.query(appointmentQuery, [appointmentId]);
      if (result.rows.length === 0) return;
      
      const appointment = result.rows[0];
      
      // Notificar funcionário
      if (appointment.employee_phone) {
        const employeeMessage = this.createCompletedAppointmentMessage(appointment, 'employee');
        await this.sendMessage(appointment.employee_phone, employeeMessage);
      }
      
      // Notificar cliente
      if (appointment.client_phone) {
        const clientMessage = this.createCompletedAppointmentMessage(appointment, 'client');
        await this.sendMessage(appointment.client_phone, clientMessage);
      }
    } catch (error) {
      console.error('Erro ao enviar notificação de conclusão:', error);
    }
  }

  // Notificação de cancelamento de agendamento
  async sendAppointmentCancellationNotification(appointmentId, reason = 'Cancelado pelo sistema') {
    try {
      const appointmentQuery = `
        SELECT a.*, c.name as client_name, c.phone as client_phone,
               s.name as service_name, a.price as service_price,
               e.name as employee_name, e.phone as employee_phone
        FROM appointments a
        JOIN clients c ON a.client_id = c.id
        JOIN services s ON a.service_id = s.id
        JOIN employees e ON a.employee_id = e.id
        WHERE a.id = $1
      `;
      
      const result = await pool.query(appointmentQuery, [appointmentId]);
      if (result.rows.length === 0) return;
      
      const appointment = result.rows[0];
      
      // Notificar funcionário
      if (appointment.employee_phone) {
        const employeeMessage = this.createCancelledAppointmentMessage(
          { name: appointment.employee_name }, 
          appointment, 
          reason
        );
        await this.sendMessage(appointment.employee_phone, employeeMessage);
      }
      
      // Notificar cliente
      if (appointment.client_phone) {
        const clientMessage = this.createClientAppointmentCancellation(appointment, reason);
        await this.sendMessage(appointment.client_phone, clientMessage);
      }
    } catch (error) {
      console.error('Erro ao enviar notificação de cancelamento:', error);
    }
  }

  // Templates de mensagens para confirmação
  createConfirmedAppointmentMessage(appointment, recipient) {
    const date = new Date(appointment.appointment_date).toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo'
    });
    const time = appointment.appointment_time;
    
    if (recipient === 'employee') {
      return `✅ *Agendamento Confirmado*

👤 *Cliente:* ${appointment.client_name}
💇 *Serviço:* ${appointment.service_name}  
📅 *Data:* ${date}
⏰ *Horário:* ${time}
💰 *Valor:* R$ ${parseFloat(appointment.service_price).toFixed(2)}

O cliente confirmou o agendamento!`;
    } else {
      return `✅ *Agendamento Confirmado*

Olá, ${appointment.client_name}!

Seu agendamento foi confirmado:
💇 *Serviço:* ${appointment.service_name}
👨‍💼 *Profissional:* ${appointment.employee_name}
📅 *Data:* ${date}
⏰ *Horário:* ${time}
💰 *Valor:* R$ ${parseFloat(appointment.service_price).toFixed(2)}

Nos vemos em breve! 😊`;
    }
  }

  // Templates de mensagens para conclusão
  createCompletedAppointmentMessage(appointment, recipient) {
    const date = new Date(appointment.appointment_date).toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo'
    });
    const time = appointment.appointment_time;
    
    if (recipient === 'employee') {
      return `✅ *Serviço Concluído*

👤 *Cliente:* ${appointment.client_name}
💇 *Serviço:* ${appointment.service_name}  
📅 *Data:* ${date}
⏰ *Horário:* ${time}
💰 *Valor:* R$ ${parseFloat(appointment.service_price).toFixed(2)}

Serviço marcado como concluído!`;
    } else {
      return `🎉 *Serviço Concluído*

Olá, ${appointment.client_name}!

Obrigado por escolher nosso salão:
💇 *Serviço:* ${appointment.service_name}
👨‍💼 *Profissional:* ${appointment.employee_name}
📅 *Data:* ${date}
⏰ *Horário:* ${time}

Esperamos que tenha gostado do resultado!
Volte sempre! 😊✨`;
    }
  }

  // Método para cancelamento simples (usado quando dados podem estar incompletos)
  async sendSimpleCancellationNotification(appointmentId, reason = 'Status alterado para cancelado') {
    try {
      // Query mais simples para pegar dados básicos
      const basicQuery = `
        SELECT a.*, c.name as client_name, c.phone as client_phone, 
               e.name as employee_name, e.phone as employee_phone,
               s.name as service_name
        FROM appointments a
        LEFT JOIN clients c ON a.client_id = c.id
        LEFT JOIN employees e ON a.employee_id = e.id
        LEFT JOIN services s ON a.service_id = s.id
        WHERE a.id = $1
      `;
      
      const result = await pool.query(basicQuery, [appointmentId]);
      if (result.rows.length === 0) return;
      
      const appointment = result.rows[0];
      
      // Notificar funcionário com dados básicos
      if (appointment.employee_phone) {
        const employeeMessage = this.createSimpleCancellationMessage(appointment, reason);
        await this.sendMessage(appointment.employee_phone, employeeMessage);
      }
      
      // Notificar cliente também
      if (appointment.client_phone) {
        const clientMessage = this.createClientSimpleCancellation(appointment, reason);
        await this.sendMessage(appointment.client_phone, clientMessage);
      }
    } catch (error) {
      console.error('Erro ao enviar notificação simples de cancelamento:', error);
    }
  }

  // Template para cancelamento simples
  createSimpleCancellationMessage(appointment, reason = '') {
    let message = `❌ *Agendamento Cancelado*\n\n`;
    message += `👤 *Cliente:* ${appointment.client_name || 'N/A'}\n`;
    message += `📅 *Data:* ${appointment.appointment_date ? new Date(appointment.appointment_date).toLocaleDateString('pt-BR') : 'N/A'}\n`;
    message += `🕐 *Horário:* ${appointment.appointment_time || 'N/A'}\n`;
    message += `💅 *Serviço:* ${appointment.service_name || 'N/A'}\n`;
    message += `📝 *Motivo:* ${reason}\n`;
    
    message += `\n⚠️ Este horário agora está disponível na sua agenda.\n`;
    message += `💡 Que tal aproveitar para um tempo livre ou reagendar outro cliente?\n\n`;
    
    return message;
  }

  // Template para cancelamento simples do cliente
  createClientSimpleCancellation(appointment, reason = '') {
    let message = `😔 *Agendamento Cancelado*\n\n`;
    message += `Olá, ${appointment.client_name || 'Cliente'}!\n`;
    message += `Infelizmente seu agendamento foi cancelado:\n\n`;
    
    message += `📅 *Data:* ${appointment.appointment_date ? new Date(appointment.appointment_date).toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric', 
      month: 'long',
      day: 'numeric'
    }) : 'N/A'}\n`;
    message += `🕐 *Horário:* ${appointment.appointment_time || 'N/A'}\n`;  
    message += `💅 *Serviço:* ${appointment.service_name || 'N/A'}\n`;
    
    if (reason) {
      message += `📝 *Motivo:* ${reason}\n`;
    }
    
    message += `\n💔 Sentimos muito pelo inconveniente.\n`;
    message += `📞 Entre em contato para reagendar!\n`;
    message += `💖 Esperamos vê-lo(a) em breve!`;
    
    return message;
  }

  // Outros métodos de notificação serão implementados de forma similar...
}

export default new WhatsAppNotificationService();