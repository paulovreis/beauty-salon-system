import pool from '../db/postgre.js';
import dotenv from 'dotenv';
import { decryptString } from '../utils/fieldCrypto.js';
dotenv.config();

function tryDecrypt(value) {
  if (!value || typeof value !== 'string') return value;
  try {
    return decryptString(value);
  } catch {
    return value;
  }
}

function decryptPhoneFields(rows) {
  if (!rows) return rows;
  const arr = Array.isArray(rows) ? rows : [rows];
  const mapped = arr.map((r) => {
    if (!r || typeof r !== 'object') return r;
    const out = { ...r };

    if ('notes_enc' in out) {
      out.notes = out.notes_enc ? tryDecrypt(out.notes_enc) : tryDecrypt(out.notes);
      delete out.notes_enc;
    } else if ('notes' in out) {
      out.notes = tryDecrypt(out.notes);
    }

    if ('client_phone_enc' in out) {
      out.client_phone = out.client_phone_enc ? tryDecrypt(out.client_phone_enc) : tryDecrypt(out.client_phone);
      delete out.client_phone_enc;
    } else if ('client_phone' in out) {
      out.client_phone = tryDecrypt(out.client_phone);
    }

    if ('employee_phone_enc' in out) {
      out.employee_phone = out.employee_phone_enc ? tryDecrypt(out.employee_phone_enc) : tryDecrypt(out.employee_phone);
      delete out.employee_phone_enc;
    } else if ('employee_phone' in out) {
      out.employee_phone = tryDecrypt(out.employee_phone);
    }

    if ('phone_enc' in out) {
      out.phone = out.phone_enc ? tryDecrypt(out.phone_enc) : tryDecrypt(out.phone);
      delete out.phone_enc;
    } else if ('phone' in out) {
      out.phone = tryDecrypt(out.phone);
    }

    return out;
  });

  return Array.isArray(rows) ? mapped : mapped[0];
}

class WhatsAppNotificationService {
  constructor() {
    this.evolutionApiUrl = process.env.EVOLUTION_API_URL || 'http://evolution-api:8080';
    this.apiKey = process.env.EVOLUTION_API_KEY;
    this.defaultInstance = 'main';

    // Evolution API aplica CORS mesmo para chamadas server-to-server.
    // Sem header Origin ela pode responder 500 "Not allowed by CORS".
    this.requestOrigin =
      process.env.EVOLUTION_REQUEST_ORIGIN ||
      process.env.EVOLUTION_PUBLIC_ORIGIN ||
      process.env.FRONTEND_URL ||
      process.env.FRONTEND_PUBLIC_ORIGIN ||
      process.env.API_PUBLIC_ORIGIN ||
      undefined;

    if (!this.apiKey) {
      console.warn('EVOLUTION_API_KEY não configurada; notificações WhatsApp podem falhar.');
    }
  }

  async sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Método para fazer requisições à Evolution API
  async makeApiRequest(endpoint, method = 'GET', data = null) {
    const url = `${this.evolutionApiUrl}${endpoint}`;

    if (!this.apiKey) {
      throw new Error('EVOLUTION_API_KEY não configurada');
    }

    const headers = {
      apikey: this.apiKey,
      Accept: 'application/json',
    };

    // Só define Content-Type quando há body.
    if (data && method !== 'GET') {
      headers['Content-Type'] = 'application/json';
    }

    if (this.requestOrigin) {
      headers.Origin = this.requestOrigin;
    }

    const config = { method, headers };

    if (data && method !== 'GET') {
      config.body = JSON.stringify(data);
    }

    const maxAttempts = Number.parseInt(process.env.EVOLUTION_API_RETRY_ATTEMPTS || '3', 10);
    const baseDelayMs = Number.parseInt(process.env.EVOLUTION_API_RETRY_DELAY_MS || '400', 10);

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await fetch(url, config);
        const text = await response.text();

        let responseData;
        try {
          responseData = text ? JSON.parse(text) : null;
        } catch {
          responseData = { message: text };
        }

        if (!response.ok) {
          const msg = responseData?.message || responseData?.error || `HTTP ${response.status}`;
          const err = new Error(String(msg));
          err.status = response.status;
          err.response = responseData;
          throw err;
        }

        return responseData;
      } catch (error) {
        const code = error?.cause?.code || error?.code;
        const isNetworkError =
          code === 'ECONNREFUSED' ||
          code === 'ECONNRESET' ||
          code === 'ENOTFOUND' ||
          code === 'ETIMEDOUT' ||
          /fetch failed/i.test(String(error?.message));

        const shouldRetry = isNetworkError && attempt < maxAttempts;
        console.error('Evolution API Error:', {
          url,
          method,
          attempt,
          maxAttempts,
          code,
          message: error?.message,
          status: error?.status,
        });

        if (!shouldRetry) throw error;
        await this.sleep(baseDelayMs * attempt);
      }
    }

    throw new Error('Evolution API request failed after retries');
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

    const maybeDecryptedPhone = tryDecrypt(phone);
    if (!maybeDecryptedPhone) return null;
    
    // Remove todos os caracteres não numéricos
    const cleaned = maybeDecryptedPhone.replace(/\D/g, '');
    
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
        message += `✂️ Serviço: ${appointment.service_name}\n`;
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
    message += `✂️ *Serviço:* ${appointment.service_name}\n`;
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
    message += `✂️ *Serviço:* ${appointment.service_name}\n`;
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
    message += `✂️ *Serviço:* ${appointment.service_name}\n`;
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
    message += `✂️ Serviço: ${newAppointment.service_name}\n`;
    message += `💰 Valor: R$ ${parseFloat(newAppointment.service_price).toFixed(2)}\n`;
    
    message += `\n🔔 Fique atento às mudanças! 👀`;
    
    return message;
  }

  // TEMPLATES ESPECIAIS PARA GERENTE/DONO

  // Template: Análise do dia
  createDailyAnalysisMessage(analysis) {
    // Usa timezone de São Paulo para alinhar a data com os relatórios e notificações diárias
    const today = new Date().toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'America/Sao_Paulo'
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
        message += `├ 📦 ${item.name}: ${item.current_stock} unidades\n`;
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
      'service': '✂️ ',
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
    message += `✂️ *Serviço:* ${appointment.service_name}\n`;
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
    message += `✂️ Serviço: ${appointment.service_name}\n`;
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
    message += `✂️ *Serviço:* ${appointment.service_name}\n`;
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
    message += `✂️ *Serviço:* ${appointment.service_name || 'N/A'}\n`;
    message += `📝 *Motivo:* ${reason}\n`;
    
    message += `\n⚠️ Este horário agora está disponível na sua agenda.\n`;
    message += `💡 Que tal aproveitar para um tempo livre ou reagendar outro cliente?\n\n`;
    
    return message;
  }

  // Método para cancelamento simples (usado quando dados podem estar incompletos)
  async sendSimpleCancellationNotification(appointmentId, reason = 'Status alterado para cancelado') {
    try {
      // Query mais simples para pegar dados básicos
      const basicQuery = `
        SELECT a.*, c.name as client_name, c.phone_enc as client_phone_enc, c.phone as client_phone, 
               e.name as employee_name, e.phone_enc as employee_phone_enc, e.phone as employee_phone,
               s.name as service_name
        FROM appointments a
        LEFT JOIN clients c ON a.client_id = c.id
        LEFT JOIN employees e ON a.employee_id = e.id
        LEFT JOIN services s ON a.service_id = s.id
        WHERE a.id = $1
      `;
      
      const result = await pool.query(basicQuery, [appointmentId]);
      if (result.rows.length === 0) return;
      
      const appointment = decryptPhoneFields(result.rows[0]);
      
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

  // MÉTODOS PARA BUSCAR DADOS DO BANCO

  // Buscar funcionários que devem receber notificações
  async getEmployeesForNotification(notificationType) {
    try {
      const query = `
        SELECT 
          e.id,
          e.name,
          e.phone_enc as phone_enc,
          e.phone,
          e.status,
          COALESCE(en.notification_types, '[]'::jsonb) as notification_types,
          COALESCE(en.enabled, true) as notifications_enabled
        FROM employees e
        LEFT JOIN employee_notifications en ON e.id = en.employee_id
        WHERE e.status = 'active'
        AND (e.phone_enc IS NOT NULL OR e.phone IS NOT NULL)
        AND (COALESCE(e.phone_enc, '') != '' OR COALESCE(e.phone, '') != '')
        AND COALESCE(en.enabled, true) = true
        AND (
          en.notification_types IS NULL 
          OR en.notification_types @> $1::jsonb
        )
      `;
      
      const result = await pool.query(query, [JSON.stringify([notificationType])]);
      console.log(`Encontrados ${result.rows.length} funcionários para notificação '${notificationType}'`);
      return decryptPhoneFields(result.rows);
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
        SELECT a.*, c.name as client_name, c.phone_enc as client_phone_enc, c.phone as client_phone,
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
      return decryptPhoneFields(result.rows);
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
        SELECT a.*, c.name as client_name, c.phone_enc as client_phone_enc, c.phone as client_phone,
               s.name as service_name, a.price as service_price,
               e.id as employee_id, e.name as employee_name, e.phone_enc as employee_phone_enc, e.phone as employee_phone
        FROM appointments a
        JOIN clients c ON a.client_id = c.id
        JOIN services s ON a.service_id = s.id
        JOIN employees e ON a.employee_id = e.id
        WHERE a.id = $1
      `;
      
      const result = await pool.query(appointmentQuery, [appointmentId]);
      if (result.rows.length === 0) return;
      
      const appointment = decryptPhoneFields(result.rows[0]);
      
      // Notificar funcionário respeitando configurações
      if (appointment.employee_phone) {
        const allow = await this.shouldReceiveNotification(appointment.employee_id, 'new_appointments');
        if (allow) {
          const employeeMessage = this.createNewAppointmentMessage(
            { name: appointment.employee_name }, 
            appointment
          );
          await this.sendMessage(appointment.employee_phone, employeeMessage);
        }
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
          notification_types: ['daily_schedule', 'new_appointments', 'appointment_changes', 'cancellations'],
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
        SELECT e.name, e.phone_enc as phone_enc, e.phone, en.enabled
        FROM employees e
        LEFT JOIN employee_notifications en ON en.employee_id = e.id
        WHERE e.id = $1 AND e.status = 'active'
      `, [employeeId]);

      if (result.rows.length === 0) {
        throw new Error('Funcionário não encontrado');
      }

      const employee = decryptPhoneFields(result.rows[0]);

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
          SELECT e.id, e.name, e.phone_enc as phone_enc, e.phone, COALESCE(u.role,'employee') AS role
          FROM employees e
          LEFT JOIN users u ON u.id = e.user_id
          WHERE e.status = 'active' AND (e.phone_enc IS NOT NULL OR e.phone IS NOT NULL)
        `);
        targetEmployees = decryptPhoneFields(result.rows);
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
        SELECT a.*, c.name as client_name, c.phone_enc as client_phone_enc, c.phone as client_phone,
               s.name as service_name, a.price as service_price,
               e.id as employee_id, e.name as employee_name, e.phone_enc as employee_phone_enc, e.phone as employee_phone
        FROM appointments a
        JOIN clients c ON a.client_id = c.id
        JOIN services s ON a.service_id = s.id
        JOIN employees e ON a.employee_id = e.id
        WHERE a.id = $1
      `;
      
      const result = await pool.query(appointmentQuery, [appointmentId]);
      if (result.rows.length === 0) return;
      
      const appointment = decryptPhoneFields(result.rows[0]);
      
      // Notificar funcionário respeitando configurações
      if (appointment.employee_phone) {
        const allow = await this.shouldReceiveNotification(appointment.employee_id, 'confirmations');
        if (allow) {
          const employeeMessage = this.createConfirmedAppointmentMessage(appointment, 'employee');
          await this.sendMessage(appointment.employee_phone, employeeMessage);
        }
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
        SELECT a.*, c.name as client_name, c.phone_enc as client_phone_enc, c.phone as client_phone,
               s.name as service_name, a.price as service_price,
               e.id as employee_id, e.name as employee_name, e.phone_enc as employee_phone_enc, e.phone as employee_phone
        FROM appointments a
        JOIN clients c ON a.client_id = c.id
        JOIN services s ON a.service_id = s.id
        JOIN employees e ON a.employee_id = e.id
        WHERE a.id = $1
      `;
      
      const result = await pool.query(appointmentQuery, [appointmentId]);
      if (result.rows.length === 0) return;
      
      const appointment = decryptPhoneFields(result.rows[0]);
      
      // Notificar funcionário respeitando configurações
      if (appointment.employee_phone) {
        const allow = await this.shouldReceiveNotification(appointment.employee_id, 'completions');
        if (allow) {
          const employeeMessage = this.createCompletedAppointmentMessage(appointment, 'employee');
          await this.sendMessage(appointment.employee_phone, employeeMessage);
        }
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
        SELECT a.*, c.name as client_name, c.phone_enc as client_phone_enc, c.phone as client_phone,
               s.name as service_name, a.price as service_price,
               e.id as employee_id, e.name as employee_name, e.phone_enc as employee_phone_enc, e.phone as employee_phone
        FROM appointments a
        JOIN clients c ON a.client_id = c.id
        JOIN services s ON a.service_id = s.id
        JOIN employees e ON a.employee_id = e.id
        WHERE a.id = $1
      `;
      
      const result = await pool.query(appointmentQuery, [appointmentId]);
      if (result.rows.length === 0) return;
      
      const appointment = decryptPhoneFields(result.rows[0]);
      
      // Notificar funcionário respeitando configurações
      if (appointment.employee_phone) {
        const allow = await this.shouldReceiveNotification(appointment.employee_id, 'cancellations');
        if (allow) {
          const employeeMessage = this.createCancelledAppointmentMessage(
            { name: appointment.employee_name }, 
            appointment, 
            reason
          );
          await this.sendMessage(appointment.employee_phone, employeeMessage);
        }
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
        SELECT a.*, c.name as client_name, c.phone_enc as client_phone_enc, c.phone as client_phone, 
               e.name as employee_name, e.phone_enc as employee_phone_enc, e.phone as employee_phone,
               s.name as service_name
        FROM appointments a
        LEFT JOIN clients c ON a.client_id = c.id
        LEFT JOIN employees e ON a.employee_id = e.id
        LEFT JOIN services s ON a.service_id = s.id
        WHERE a.id = $1
      `;
      
      const result = await pool.query(basicQuery, [appointmentId]);
      if (result.rows.length === 0) return;
      
      const appointment = decryptPhoneFields(result.rows[0]);
      
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
    message += `✂️ *Serviço:* ${appointment.service_name || 'N/A'}\n`;
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
    message += `✂️ *Serviço:* ${appointment.service_name || 'N/A'}\n`;
    
    if (reason) {
      message += `📝 *Motivo:* ${reason}\n`;
    }
    
    message += `\n💔 Sentimos muito pelo inconveniente.\n`;
    message += `📞 Entre em contato para reagendar!\n`;
    message += `💖 Esperamos vê-lo(a) em breve!`;
    
    return message;
  }

  // ========================================
  // NOTIFICAÇÕES DE PAGAMENTO PIX
  // ========================================

  createPixPaymentConfirmedClientMessage({ clientName, appointmentId, serviceName, employeeName, appointmentDate, appointmentTime, amount }) {
    const salonName = (process.env.NOME_SALAO || 'Salão').trim();
    const value = Number(amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    let dateStr = '';
    if (appointmentDate) {
      try {
        const [y, m, d] = String(appointmentDate).slice(0, 10).split('-');
        dateStr = `${d}/${m}/${y}`;
      } catch { dateStr = ''; }
    }

    return [
      `✅ *Pagamento Confirmado!*`,
      '',
      `Olá, *${clientName || 'Cliente'}*! 🎉`,
      `Seu pagamento via PIX foi recebido com sucesso.`,
      '',
      `📋 *Comprovante - Agendamento #${appointmentId}*`,
      `✂️ Serviço: ${serviceName || ''}`,
      employeeName ? `👩 Profissional: ${employeeName}` : null,
      (dateStr && appointmentTime) ? `📅 Data/hora: ${dateStr} às ${String(appointmentTime).slice(0, 5)}` : null,
      `💰 Valor pago: *R$ ${value}*`,
      '',
      `💚 *${salonName}* — Obrigada pela preferência! Até logo! 😊`,
    ].filter(l => l !== null).join('\n');
  }

  createPixPaymentConfirmedEmployeeMessage({ clientName, appointmentId, serviceName, appointmentDate, appointmentTime, amount }) {
    const value = Number(amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    let dateStr = '';
    if (appointmentDate) {
      try {
        const [y, m, d] = String(appointmentDate).slice(0, 10).split('-');
        dateStr = `${d}/${m}/${y}`;
      } catch { dateStr = ''; }
    }

    return [
      `💰 *Pagamento PIX Recebido!*`,
      '',
      `👤 Cliente: *${clientName || ''}*`,
      `✂️ Serviço: ${serviceName || ''}`,
      (dateStr && appointmentTime) ? `📅 Data/hora: ${dateStr} às ${String(appointmentTime).slice(0, 5)}` : null,
      `💵 Valor: *R$ ${value}*`,
      `🔖 Agendamento: #${appointmentId}`,
      '',
      `✅ Pagamento confirmado automaticamente via Mercado Pago.`,
    ].filter(l => l !== null).join('\n');
  }

  async sendPixPaymentConfirmedNotification({ db, appointmentId }) {
    try {
      const { rows } = await db.query(
        `SELECT a.id, a.price, a.appointment_date, a.appointment_time,
                c.name AS client_name, c.phone_enc AS client_phone_enc,
                e.name AS employee_name, e.phone_enc AS employee_phone_enc,
                s.name AS service_name
         FROM appointments a
         JOIN clients c ON c.id = a.client_id
         JOIN employees e ON e.id = a.employee_id
         JOIN services s ON s.id = a.service_id
         WHERE a.id = $1`,
        [appointmentId]
      );
      if (!rows.length) return;

      const appt = decryptPhoneFields(rows[0]);

      const clientPhone = appt.phone || appt.client_phone;
      if (clientPhone) {
        try {
          const msg = this.createPixPaymentConfirmedClientMessage({
            clientName: appt.client_name,
            appointmentId,
            serviceName: appt.service_name,
            employeeName: appt.employee_name,
            appointmentDate: appt.appointment_date,
            appointmentTime: appt.appointment_time,
            amount: appt.price,
          });
          await this.sendMessage(clientPhone, msg);
        } catch (err) {
          console.warn('sendPixPaymentConfirmedNotification: erro ao notificar cliente:', err?.message);
        }
      }

      const employeePhone = appt.employee_phone;
      if (employeePhone) {
        try {
          const msg = this.createPixPaymentConfirmedEmployeeMessage({
            clientName: appt.client_name,
            appointmentId,
            serviceName: appt.service_name,
            appointmentDate: appt.appointment_date,
            appointmentTime: appt.appointment_time,
            amount: appt.price,
          });
          await this.sendMessage(employeePhone, msg);
        } catch (err) {
          console.warn('sendPixPaymentConfirmedNotification: erro ao notificar profissional:', err?.message);
        }
      }
    } catch (err) {
      console.error('sendPixPaymentConfirmedNotification error:', err);
    }
  }

  // ========================================
  // NOTIFICAÇÕES AVANÇADAS PARA GERENTES E DONOS
  // ========================================

  // Enviar análise diária completa
  async sendDailyAnalysisNotification() {
    try {
      // Buscar gerentes e donos
      const managersQuery = `
        SELECT e.id, e.name, e.phone_enc as phone_enc, e.phone
        FROM employees e
        LEFT JOIN users u ON u.id = e.user_id
        LEFT JOIN employee_notifications en ON en.employee_id = e.id
        WHERE e.status = 'active' 
        AND COALESCE(u.role,'employee') IN ('owner', 'manager')
        AND (e.phone_enc IS NOT NULL OR e.phone IS NOT NULL)
        AND (COALESCE(e.phone_enc, '') != '' OR COALESCE(e.phone, '') != '')
        AND COALESCE(en.enabled, true) = true
        AND (
          en.notification_types IS NULL 
          OR en.notification_types @> '["daily_analysis"]'::jsonb
        )
      `;
      
      const managersResult = await pool.query(managersQuery);
      const managers = decryptPhoneFields(managersResult.rows);

      if (managers.length === 0) {
        console.log('Nenhum gerente/dono encontrado para análise diária');
        return;
      }

      // Gerar análise completa do dia
      const analysis = await this.generateDailyAnalysis();
      const message = this.createDailyAnalysisMessage(analysis);

      for (const manager of managers) {
        try {
          await this.sendMessage(manager.phone, message);
          console.log(`Análise diária enviada para ${manager.name}`);
        } catch (error) {
          console.error(`Erro ao enviar análise para ${manager.name}:`, error);
        }
      }
    } catch (error) {
      console.error('Erro ao enviar análise diária:', error);
    }
  }

  // Gerar dados da análise diária
  async generateDailyAnalysis() {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    
    try {
      // Agendamentos do dia
      const appointmentsQuery = `
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
          COUNT(CASE WHEN status = 'canceled' THEN 1 END) as canceled,
          COUNT(CASE WHEN status = 'scheduled' THEN 1 END) as pending,
          COALESCE(SUM(CASE WHEN status = 'completed' THEN price END), 0) as revenue
        FROM appointments 
        WHERE appointment_date = $1
      `;
      
      const appointmentsResult = await pool.query(appointmentsQuery, [today]);
      const appointmentStats = appointmentsResult.rows[0];

      // Despesas do dia
      const expensesQuery = `
        SELECT COALESCE(SUM(amount), 0) as total_expenses
        FROM expenses 
        WHERE expense_date = $1
      `;
      
      const expensesResult = await pool.query(expensesQuery, [today]);
      const totalExpenses = parseFloat(expensesResult.rows[0].total_expenses);

      // Clientes novos e recorrentes
      const clientsQuery = `
        SELECT 
          COUNT(DISTINCT c.id) as total_clients,
          COUNT(DISTINCT CASE WHEN c.created_at::date = $1 THEN c.id END) as new_clients
        FROM appointments a
        JOIN clients c ON a.client_id = c.id
        WHERE a.appointment_date = $1 AND a.status != 'canceled'
      `;
      
      const clientsResult = await pool.query(clientsQuery, [today]);
      const clientStats = clientsResult.rows[0];

      // Funcionários performance
      const employeeStatsQuery = `
        SELECT 
          e.name,
          COUNT(a.id) as appointments,
          COALESCE(SUM(CASE WHEN a.status = 'completed' THEN a.price END), 0) as revenue
        FROM employees e
        LEFT JOIN appointments a ON e.id = a.employee_id AND a.appointment_date = $1
        WHERE e.status = 'active'
        GROUP BY e.id, e.name
        ORDER BY appointments DESC
      `;
      
      const employeeStatsResult = await pool.query(employeeStatsQuery, [today]);

      // Produtos com estoque baixo
      const lowStockQuery = `
        SELECT name, current_stock, min_stock_level
        FROM products 
        WHERE current_stock <= min_stock_level AND is_active = true
        ORDER BY (current_stock - min_stock_level) ASC
        LIMIT 5
      `;
      
      const lowStockResult = await pool.query(lowStockQuery);

      const revenue = parseFloat(appointmentStats.revenue);
      const completionRate = appointmentStats.total > 0 
        ? Math.round((appointmentStats.completed / appointmentStats.total) * 100) 
        : 0;

      return {
        revenue: revenue,
        expenses: totalExpenses,
        completedAppointments: parseInt(appointmentStats.completed),
        cancelledAppointments: parseInt(appointmentStats.canceled),
        pendingAppointments: parseInt(appointmentStats.pending),
        completionRate: completionRate,
        totalClientsServed: parseInt(clientStats.total_clients),
        newClients: parseInt(clientStats.new_clients),
        returningClients: parseInt(clientStats.total_clients) - parseInt(clientStats.new_clients),
        employeeStats: employeeStatsResult.rows,
        lowStockItems: lowStockResult.rows
      };
    } catch (error) {
      console.error('Erro ao gerar análise diária:', error);
      return {
        revenue: 0,
        expenses: 0,
        completedAppointments: 0,
        cancelledAppointments: 0,
        pendingAppointments: 0,
        completionRate: 0,
        totalClientsServed: 0,
        newClients: 0,
        returningClients: 0,
        employeeStats: [],
        lowStockItems: []
      };
    }
  }

  // Notificar sobre alterações no sistema (produtos, serviços, estoque, etc.)
  async sendSystemChangeNotification(changeType, details, affectedEntity) {
    try {
      // Buscar gerentes e donos que devem receber notificações do sistema
      const managersQuery = `
        SELECT e.id, e.name, e.phone_enc as phone_enc, e.phone
        FROM employees e
        LEFT JOIN users u ON u.id = e.user_id
        LEFT JOIN employee_notifications en ON e.id = en.employee_id
        WHERE e.status = 'active' 
        AND COALESCE(u.role,'employee') IN ('owner', 'manager')
        AND (e.phone_enc IS NOT NULL OR e.phone IS NOT NULL)
        AND (COALESCE(e.phone_enc, '') != '' OR COALESCE(e.phone, '') != '')
        AND COALESCE(en.enabled, true) = true
        AND (
          en.notification_types IS NULL 
          OR en.notification_types @> '["system_changes"]'::jsonb
        )
      `;
      
      const managersResult = await pool.query(managersQuery);
      const managers = decryptPhoneFields(managersResult.rows);

      if (managers.length === 0) {
        console.log('Nenhum gerente/dono configurado para receber notificações do sistema');
        return;
      }

      const message = this.createSystemChangeMessage(changeType, details, affectedEntity);

      for (const manager of managers) {
        try {
          await this.sendMessage(manager.phone, message);
          console.log(`Notificação de alteração no sistema enviada para ${manager.name}`);
        } catch (error) {
          console.error(`Erro ao enviar notificação do sistema para ${manager.name}:`, error);
        }
      }
    } catch (error) {
      console.error('Erro ao enviar notificação de alteração no sistema:', error);
    }
  }

  // Template para alterações no sistema
  createSystemChangeMessage(changeType, details, affectedEntity) {
    const timestamp = new Date().toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo'
    });

    const icons = {
      'product_created': '🆕📦',
      'product_updated': '✏️📦',
      'product_deleted': '🗑️📦',
      'service_created': '🆕✂️ ',
      'service_updated': '✏️✂️ ',
      'service_deleted': '🗑️✂️ ',
      'inventory_restock': '📈📦',
      'inventory_output': '📉📦',
      'inventory_update': '🔄📦',
      'low_stock_alert': '⚠️📦',
      'expense_created': '🆕💸',
      'expense_updated': '✏️💸',
      'employee_created': '🆕👨‍💼',
      'employee_updated': '✏️👨‍💼',
      'client_created': '🆕👤',
      'client_updated': '✏️👤'
    };

    const titles = {
      'product_created': 'NOVO PRODUTO CADASTRADO',
      'product_updated': 'PRODUTO ATUALIZADO',
      'product_deleted': 'PRODUTO REMOVIDO',
      'service_created': 'NOVO SERVIÇO CADASTRADO',
      'service_updated': 'SERVIÇO ATUALIZADO',
      'service_deleted': 'SERVIÇO REMOVIDO',
      'inventory_restock': 'ESTOQUE REPOSTO',
      'inventory_output': 'SAÍDA DE ESTOQUE',
      'inventory_update': 'ESTOQUE ATUALIZADO',
      'low_stock_alert': 'ESTOQUE BAIXO',
      'expense_created': 'NOVA DESPESA REGISTRADA',
      'expense_updated': 'DESPESA ATUALIZADA',
      'employee_created': 'NOVO FUNCIONÁRIO',
      'employee_updated': 'FUNCIONÁRIO ATUALIZADO',
      'client_created': 'NOVO CLIENTE',
      'client_updated': 'CLIENTE ATUALIZADO'
    };

    let message = `${icons[changeType] || '🔔'} *${titles[changeType] || 'ALTERAÇÃO NO SISTEMA'}*\n\n`;
    
    if (affectedEntity) {
      message += `📋 *${affectedEntity}*\n`;
      message += `═══════════════════════\n`;
    }
    
    Object.keys(details).forEach(key => {
      if (details[key] !== null && details[key] !== undefined) {
        const label = this.formatFieldLabel(key);
        const value = this.formatFieldValue(key, details[key]);
        message += `▫️ *${label}:* ${value}\n`;
      }
    });
    
    message += `\n⏰ *${timestamp}*\n`;
    message += `🔄 Sistema atualizado automaticamente.`;
    
    return message;
  }

  // Formatação de labels de campos
  formatFieldLabel(key) {
    const labels = {
      // Comuns
      'id': 'ID',
      'name': 'Nome',
      'description': 'Descrição',
      'notes': 'Observações',
      'status': 'Status',
      'is_active': 'Ativo',
      'phone': 'Telefone',
      'email': 'E-mail',
      'role': 'Função',
      'hire_date': 'Data de Contratação',
      'reason': 'Motivo',
      'address': 'Endereço',
      
      // Serviços
      'price': 'Preço',
      'base_cost': 'Custo Base',
      'recommended_price': 'Preço Recomendado',
      'profit_margin': 'Margem de Lucro',
      'duration_minutes': 'Duração',
      'category': 'Categoria',
      
      // Despesas
      'amount': 'Valor',
      'expense_date': 'Data',
      'payment_method': 'Forma de Pagamento',
      'receipt_number': 'Nº do Recibo',
      
      // Produtos/Estoque
      'selling_price': 'Preço de Venda',
      'cost_price': 'Preço de Custo',
      'current_stock': 'Estoque Atual',
      'min_stock_level': 'Estoque Mínimo',
      'max_stock_level': 'Estoque Máximo',
      'old_stock': 'Estoque Anterior',
      'new_stock': 'Estoque Atual',
      'difference': 'Diferença',
      'sku': 'SKU',
      'supplier_name': 'Fornecedor',
      'supplier_contact': 'Contato do Fornecedor',
      'category_id': 'Categoria',
      'base_salary': 'Salário Base',
    };

    if (labels[key]) return labels[key];

    // Fallback: converte snake_case/camelCase para Título com espaços
    const spaced = key
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .toLowerCase()
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    return spaced;
  }

  // Formatação de valores de campos
  formatFieldValue(key, value) {
    // Booleanos
    if (typeof value === 'boolean') {
      return value ? 'Sim' : 'Não';
    }

    // Valores monetários
    if (key.includes('price') || key.includes('cost') || key.includes('amount') || key.includes('valor') || key.includes('salary')) {
      const num = Number(value) || 0;
      return `R$ ${num.toFixed(2)}`;
    }

    // Percentuais (margem etc.)
    if (key.includes('margin') || key.includes('percentage') || key.endsWith('_percent')) {
      const num = Number(value);
      if (isFinite(num)) return `${num.toFixed(2)}%`;
    }

    // Datas
    if (key.includes('date')) {
      try {
        return new Date(value).toLocaleDateString('pt-BR');
      } catch {
        return value;
      }
    }

    // Duração
    if (key === 'duration_minutes') {
      return `${value} min`;
    }

    // Número do recibo vazio
    if (key === 'receipt_number') {
      return value ? value : 'Não informado';
    }

    // Forma de pagamento
    if (key === 'payment_method') {
      const map = {
        'cash': 'Dinheiro',
        'dinheiro': 'Dinheiro',
        'credit': 'Crédito',
        'credit_card': 'Crédito',
        'debit': 'Débito',
        'debit_card': 'Débito',
        'pix': 'PIX',
        'transfer': 'Transferência',
        'bank_transfer': 'Transferência',
        'boleto': 'Boleto'
      };
      const v = String(value).toLowerCase();
      return map[v] || value;
    }

    // Status comuns
    if (key === 'status') {
      const map = {
        'active': 'Ativo',
        'inactive': 'Inativo',
        'completed': 'Concluído',
        'canceled': 'Cancelado',
        'cancelled': 'Cancelado',
        'scheduled': 'Agendado'
      };
      const v = String(value).toLowerCase();
      return map[v] || value;
    }

    return value;
  }

  // Notificação de estoque baixo
  async sendLowStockNotification(products) {
    try {
      const managersQuery = `
        SELECT e.id, e.name, e.phone_enc as phone_enc, e.phone
        FROM employees e
        LEFT JOIN users u ON u.id = e.user_id
        LEFT JOIN employee_notifications en ON e.id = en.employee_id
        WHERE e.status = 'active' 
        AND COALESCE(u.role,'employee') IN ('owner', 'manager')
        AND (e.phone_enc IS NOT NULL OR e.phone IS NOT NULL)
        AND COALESCE(en.enabled, true) = true
        AND (
          en.notification_types IS NULL 
          OR en.notification_types @> '["low_stock"]'::jsonb
        )
      `;
      
      const managersResult = await pool.query(managersQuery);
      const managers = decryptPhoneFields(managersResult.rows);

      if (managers.length === 0 || products.length === 0) return;

      const message = this.createLowStockMessage(products);

      for (const manager of managers) {
        try {
          await this.sendMessage(manager.phone, message);
          console.log(`Alerta de estoque baixo enviado para ${manager.name}`);
        } catch (error) {
          console.error(`Erro ao enviar alerta de estoque para ${manager.name}:`, error);
        }
      }
    } catch (error) {
      console.error('Erro ao enviar notificação de estoque baixo:', error);
    }
  }

  // Template para estoque baixo
  createLowStockMessage(products) {
    let message = `⚠️ *ALERTA DE ESTOQUE BAIXO*\n\n`;
    message += `📦 *${products.length} produto(s) com estoque baixo:*\n`;
    message += `═══════════════════════════════\n\n`;

    products.forEach((product, index) => {
      message += `${index + 1}. *${product.name}*\n`;
      message += `   📊 Atual: ${product.current_stock} unidades\n`;
      message += `   ⚠️ Mínimo: ${product.min_stock_level} unidades\n`;
      message += `   🔢 Diferença: ${product.current_stock - product.min_stock_level}\n\n`;
    });

    message += `🛒 *Ação necessária: Reposição de estoque*\n`;
    message += `⏰ ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`;

    return message;
  }

  // ========================================
  // TEMPLATES APRIMORADOS PARA CLIENTES
  // ========================================

  // Template aprimorado para confirmação de agendamento do cliente
  createEnhancedClientConfirmation(appointment) {
    const appointmentDate = new Date(appointment.appointment_date);
    const [year, month, day] = appointment.appointment_date.split('-');
    const formattedDate = new Date(year, month - 1, day);
    
    const weekdays = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
    const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    
    const weekday = weekdays[formattedDate.getDay()];
    const dayNum = parseInt(day);
    const monthName = months[parseInt(month) - 1];
    const yearNum = parseInt(year);
    
    const dateString = `${weekday}, ${dayNum} de ${monthName} de ${yearNum}`;

    let message = `✨ *AGENDAMENTO CONFIRMADO* ✨\n\n`;
    message += `💖 Olá, ${appointment.client_name}!\n`;
    message += `Seu agendamento foi realizado com sucesso!\n\n`;
    
    message += `📋 *DETALHES DO SEU AGENDAMENTO:*\n`;
    message += `═══════════════════════════════\n`;
    message += `📅 *Data:* ${dateString}\n`;
    message += `🕐 *Horário:* ${appointment.appointment_time}\n`;
    message += `✂️ *Serviço:* ${appointment.service_name}\n`;
    message += `👨‍💼 *Profissional:* ${appointment.employee_name}\n`;
    message += `💰 *Investimento:* R$ ${parseFloat(appointment.service_price).toFixed(2)}\n`;
    
    if (appointment.notes) {
      message += `📝 *Observações:* ${appointment.notes}\n`;
    }
    
    message += `\n🏪 *${process.env.NOME_SALAO || 'Nosso Salão de Beleza'}*\n`;
    message += `📱 Precisa reagendar? Entre em contato conosco!\n\n`;
    message += `🌟 *Estamos ansiosos para cuidar de você!*\n`;
    message += `💖 Obrigada pela confiança e preferência!\n\n`;
    message += `✨ *Prepare-se para ficar ainda mais linda!* ✨`;
    
    return message;
  }

  // Lembrete de agendamento (1 dia antes)
  async sendAppointmentReminder(appointmentId) {
    try {
      const appointmentQuery = `
        SELECT a.*, c.name as client_name, c.phone_enc as client_phone_enc, c.phone as client_phone,
               s.name as service_name, a.price as service_price,
               e.name as employee_name
        FROM appointments a
        JOIN clients c ON a.client_id = c.id
        JOIN services s ON a.service_id = s.id
        JOIN employees e ON a.employee_id = e.id
        WHERE a.id = $1 AND a.status = 'scheduled'
      `;
      
      const result = await pool.query(appointmentQuery, [appointmentId]);
      if (result.rows.length === 0) return;
      
      const appointment = decryptPhoneFields(result.rows[0]);
      
      if (appointment.client_phone) {
        const message = this.createAppointmentReminderMessage(appointment);
        await this.sendMessage(appointment.client_phone, message);
        console.log(`Lembrete enviado para ${appointment.client_name}`);
      }
    } catch (error) {
      console.error('Erro ao enviar lembrete de agendamento:', error);
    }
  }

  // Template para lembrete de agendamento
  createAppointmentReminderMessage(appointment) {
    const [year, month, day] = appointment.appointment_date.split('-');
    const formattedDate = new Date(year, month - 1, day);
    
    const weekdays = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
    const weekday = weekdays[formattedDate.getDay()];

    let message = `🔔 *LEMBRETE DE AGENDAMENTO*\n\n`;
    message += `💖 Olá, ${appointment.client_name}!\n\n`;
    message += `✨ Este é um lembrete carinhoso do seu agendamento de amanhã:\n\n`;
    
    message += `📅 *${weekday}* - ${formattedDate.toLocaleDateString('pt-BR')}\n`;
    message += `🕐 *${appointment.appointment_time}*\n`;
    message += `✂️ *${appointment.service_name}*\n`;
    message += `👨‍💼 *Profissional:* ${appointment.employee_name}\n\n`;
    
    message += `🏪 *${process.env.NOME_SALAO || 'Nosso Salão'}*\n\n`;
    message += `💡 *Dicas para amanhã:*\n`;
    message += `• Chegue com 10 minutos de antecedência\n`;
    message += `• Traga uma referência se desejar algo específico\n`;
    message += `• Qualquer dúvida, entre em contato conosco!\n\n`;
    
    message += `😊 *Mal podemos esperar para cuidar de você!*\n`;
    message += `✨ Até amanhã! ✨`;
    
    return message;
  }
}

export default new WhatsAppNotificationService();