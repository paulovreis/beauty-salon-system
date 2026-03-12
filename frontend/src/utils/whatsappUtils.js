// Utilitários para integração WhatsApp com o sistema do salão
// Este arquivo contém funções auxiliares para conectar WhatsApp com clientes e agendamentos
// EvolutionAPI 2.3.6 - Configuração Otimizada

import { forceHttpsWhenPageIsHttps } from './forceHttpsWhenPageIsHttps';

// Configuração da Evolution API
const EVOLUTION_CONFIG = {
  baseURL: forceHttpsWhenPageIsHttps(
    process.env.REACT_APP_EVOLUTION_API_URL || 'http://localhost:8080'
  ),
  apiKey: process.env.REACT_APP_EVOLUTION_API_KEY,
  defaultInstance: 'salao-principal'
};

// Templates de mensagens
export const MESSAGE_TEMPLATES = {
  WELCOME: (clientName) => 
    `Olá ${clientName}! 🎉\n\nSeja bem-vindo(a) ao nosso salão! Estamos muito felizes em tê-lo(a) como cliente.\n\nQualquer dúvida, estaremos aqui para ajudar! 💆‍♀️✨`,
  
  APPOINTMENT_CONFIRMATION: (clientName, service, date, time, employee) =>
    `Olá ${clientName}! ✅\n\nSeu agendamento foi confirmado:\n\n🗓️ Data: ${date}\n⏰ Horário: ${time}\n✂️ Serviço: ${service}\n👩‍💼 Profissional: ${employee}\n\nNos vemos em breve! 😊`,
  
  APPOINTMENT_REMINDER: (clientName, service, date, time) =>
    `Oi ${clientName}! ⏰\n\nLembrando que você tem agendamento amanhã:\n\n🗓️ Data: ${date}\n⏰ Horário: ${time}\n✂️ Serviço: ${service}\n\nTe esperamos! Se precisar reagendar, entre em contato conosco. 📞`,
  
  APPOINTMENT_THANKS: (clientName, service) =>
    `Obrigada ${clientName}! 💖\n\nFoi um prazer atendê-la hoje! Esperamos que tenha ficado satisfeita com o(a) ${service}.\n\nNão esqueça de agendar seu próximo horário! 📅✨`,
  
  BIRTHDAY: (clientName) =>
    `Parabéns ${clientName}! 🎂🎉\n\nHoje é seu dia especial! Que tal comemorar com um cuidado especial?\n\nTemos uma promoção especial para aniversariantes! Entre em contato para saber mais. ✂️ ✨`,
  
  PROMOTION: (clientName, promotion) =>
    `Oi ${clientName}! 🔥\n\nTemos uma promoção especial para você:\n\n${promotion}\n\nAproveite e agende já seu horário! Vagas limitadas. 📅✂️ `,
  
  MISSED_APPOINTMENT: (clientName, date, time) =>
    `Oi ${clientName}! 😊\n\nNotamos que você não pôde comparecer ao agendamento de ${date} às ${time}.\n\nTudo bem! Quando quiser reagendar, estaremos aqui. Nossa agenda está sempre aberta para você! 📅💖`
};

// Classe para gerenciar integração WhatsApp
export class WhatsAppIntegration {
  constructor(instanceName = EVOLUTION_CONFIG.defaultInstance) {
    this.instanceName = instanceName;
    this.baseURL = EVOLUTION_CONFIG.baseURL;
    this.apiKey = EVOLUTION_CONFIG.apiKey;
  }

  // Método privado para fazer requisições à Evolution API
  async _makeRequest(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': this.apiKey
      },
      ...options
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || `HTTP ${response.status}`);
      }
      
      return data;
    } catch (error) {
      console.error('WhatsApp API Error:', error);
      throw error;
    }
  }

  // Formatar número de telefone para WhatsApp
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
    
    return withoutZero;
  }

  // Verificar se a instância está conectada
  async isInstanceConnected() {
    try {
      const response = await this._makeRequest(`/instance/connectionState/${this.instanceName}`);
      return response.instance?.state === 'open';
    } catch (error) {
      console.error('Erro ao verificar conexão:', error);
      return false;
    }
  }

  // Enviar mensagem
  async sendMessage(phone, message) {
    const formattedPhone = this.formatPhoneNumber(phone);
    
    if (!formattedPhone) {
      throw new Error('Número de telefone inválido');
    }

    const isConnected = await this.isInstanceConnected();
    if (!isConnected) {
      throw new Error('WhatsApp não está conectado');
    }

    return this._makeRequest(`/message/sendText/${this.instanceName}`, {
      method: 'POST',
      body: JSON.stringify({
        number: formattedPhone,
        text: message
      })
    });
  }

  // Enviar mensagem de boas-vindas para novo cliente
  async sendWelcomeMessage(client) {
    if (!client.phone) {
      throw new Error('Cliente não possui telefone cadastrado');
    }

    const message = MESSAGE_TEMPLATES.WELCOME(client.name);
    return this.sendMessage(client.phone, message);
  }

  // Enviar confirmação de agendamento
  async sendAppointmentConfirmation(appointment) {
    const { client, service, employee, appointment_date, appointment_time } = appointment;
    
    if (!client.phone) {
      throw new Error('Cliente não possui telefone cadastrado');
    }

    const formattedDate = new Date(appointment_date).toLocaleDateString('pt-BR');
    const message = MESSAGE_TEMPLATES.APPOINTMENT_CONFIRMATION(
      client.name,
      service.name,
      formattedDate,
      appointment_time,
      employee.name
    );

    return this.sendMessage(client.phone, message);
  }

  // Enviar lembrete de agendamento
  async sendAppointmentReminder(appointment) {
    const { client, service, appointment_date, appointment_time } = appointment;
    
    if (!client.phone) {
      throw new Error('Cliente não possui telefone cadastrado');
    }

    const formattedDate = new Date(appointment_date).toLocaleDateString('pt-BR');
    const message = MESSAGE_TEMPLATES.APPOINTMENT_REMINDER(
      client.name,
      service.name,
      formattedDate,
      appointment_time
    );

    return this.sendMessage(client.phone, message);
  }

  // Enviar agradecimento pós-atendimento
  async sendThankYouMessage(appointment) {
    const { client, service } = appointment;
    
    if (!client.phone) {
      throw new Error('Cliente não possui telefone cadastrado');
    }

    const message = MESSAGE_TEMPLATES.APPOINTMENT_THANKS(client.name, service.name);
    return this.sendMessage(client.phone, message);
  }

  // Enviar mensagem de aniversário
  async sendBirthdayMessage(client) {
    if (!client.phone) {
      throw new Error('Cliente não possui telefone cadastrado');
    }

    const message = MESSAGE_TEMPLATES.BIRTHDAY(client.name);
    return this.sendMessage(client.phone, message);
  }

  // Enviar promoção
  async sendPromotionMessage(client, promotionText) {
    if (!client.phone) {
      throw new Error('Cliente não possui telefone cadastrado');
    }

    const message = MESSAGE_TEMPLATES.PROMOTION(client.name, promotionText);
    return this.sendMessage(client.phone, message);
  }

  // Enviar mensagem para falta em agendamento
  async sendMissedAppointmentMessage(appointment) {
    const { client, appointment_date, appointment_time } = appointment;
    
    if (!client.phone) {
      throw new Error('Cliente não possui telefone cadastrado');
    }

    const formattedDate = new Date(appointment_date).toLocaleDateString('pt-BR');
    const message = MESSAGE_TEMPLATES.MISSED_APPOINTMENT(
      client.name,
      formattedDate,
      appointment_time
    );

    return this.sendMessage(client.phone, message);
  }

  // Enviar mensagem em massa
  async sendBulkMessages(clients, messageTemplate) {
    const results = [];
    
    for (const client of clients) {
      try {
        if (client.phone) {
          const message = typeof messageTemplate === 'function' 
            ? messageTemplate(client) 
            : messageTemplate;
            
          await this.sendMessage(client.phone, message);
          results.push({ client: client.name, status: 'success' });
        } else {
          results.push({ client: client.name, status: 'no_phone' });
        }
        
        // Pequena pausa entre mensagens para não sobrecarregar
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        results.push({ 
          client: client.name, 
          status: 'error', 
          error: error.message 
        });
      }
    }
    
    return results;
  }
}

// Função utilitária para criar instância global
export const createWhatsAppService = (instanceName) => {
  return new WhatsAppIntegration(instanceName);
};

// Instância padrão para uso geral
export const whatsapp = new WhatsAppIntegration();

// Exemplo de uso:
/*
import { whatsapp, MESSAGE_TEMPLATES } from './whatsappUtils';

// Enviar boas-vindas
await whatsapp.sendWelcomeMessage(client);

// Confirmar agendamento
await whatsapp.sendAppointmentConfirmation(appointment);

// Enviar promoção personalizada
const promotion = "30% OFF em cortes até sexta-feira!";
await whatsapp.sendPromotionMessage(client, promotion);

// Envio em massa
const clients = await getActiveClients();
await whatsapp.sendBulkMessages(clients, MESSAGE_TEMPLATES.PROMOTION);
*/