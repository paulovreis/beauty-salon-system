import whatsappNotificationService from './whatsappNotificationService.js';

class SchedulerService {
  constructor() {
    this.intervals = new Map();
    this.lastRun = new Map(); // guarda última data (YYYY-MM-DD) executada por tarefa
  }

  // Inicializar todas as tarefas automáticas
  startScheduledTasks() {
    console.log('🕐 Iniciando tarefas agendadas...');
    
    // Notificações diárias (8:00 AM)
    this.scheduleDailyNotifications();
    
    // Análise diária (22:00 PM)  
    this.scheduleDailyAnalysis();
    
    console.log('✅ Tarefas agendadas iniciadas com sucesso!');
  }

  // Parar todas as tarefas
  stopScheduledTasks() {
    console.log('🛑 Parando tarefas agendadas...');
    this.intervals.forEach((interval, name) => {
      clearInterval(interval);
      console.log(`  ✓ Tarefa ${name} parada`);
    });
    this.intervals.clear();
  }

  // Agendar notificações diárias para funcionários (8:00 AM SP) usando checagem por minuto
  scheduleDailyNotifications() {
    const interval = setInterval(async () => {
      const { dateKey, timeStr } = this.getSaoPauloDateTime();
      if (timeStr === '08:00' && this.lastRun.get('daily_notifications') !== dateKey) {
        this.lastRun.set('daily_notifications', dateKey);
        console.log(`📅 08:00 em SP (${dateKey}) → enviando notificações diárias`);
        await this.sendDailyNotifications();
      }
    }, 60 * 1000);
    this.intervals.set('daily_notifications', interval);
    console.log('📅 Notificações diárias agendadas (checagem minutely, TZ=America/Sao_Paulo)');
  }

  // Agendar análise diária para gerentes/donos (22:00 PM)
  scheduleDailyAnalysis() {
    const interval = setInterval(async () => {
      const { dateKey, timeStr } = this.getSaoPauloDateTime();
      if (timeStr === '22:00' && this.lastRun.get('daily_analysis') !== dateKey) {
        this.lastRun.set('daily_analysis', dateKey);
        console.log(`📊 22:00 em SP (${dateKey}) → enviando análise diária`);
        await this.sendDailyAnalysis();
      }
    }, 60 * 1000);
    this.intervals.set('daily_analysis', interval);
    console.log('📊 Análise diária agendada (checagem minutely, TZ=America/Sao_Paulo)');
  }



  // Métodos auxiliares
  // Obtém data e hora (HH:mm) atuais no fuso America/Sao_Paulo
  getSaoPauloDateTime() {
    const tz = 'America/Sao_Paulo';
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false
    }).formatToParts(new Date());
    const get = (type) => parts.find(p => p.type === type)?.value;
    const y = get('year');
    const m = get('month');
    const d = get('day');
    const hh = get('hour');
    const mm = get('minute');
    return { dateKey: `${y}-${m}-${d}`, timeStr: `${hh}:${mm}` };
  }

  // Executores das tarefas
  async sendDailyNotifications() {
    try {
      console.log('📱 Enviando notificações diárias...');
      await whatsappNotificationService.sendDailyClientsNotification();
      console.log('✅ Notificações diárias enviadas com sucesso');
    } catch (error) {
      console.error('❌ Erro ao enviar notificações diárias:', error);
    }
  }

  async sendDailyAnalysis() {
    try {
      console.log('📊 Enviando análise diária...');
      await whatsappNotificationService.sendDailyAnalysisNotification();
      console.log('✅ Análise diária enviada com sucesso');
    } catch (error) {
      console.error('❌ Erro ao enviar análise diária:', error);
    }
  }



  // Método para executar tarefas manualmente (para testes)
  async runTaskManually(taskName) {
    console.log(`🔧 Executando tarefa manualmente: ${taskName}`);
    
    switch (taskName) {
      case 'daily_notifications':
        await this.sendDailyNotifications();
        break;
      case 'daily_analysis':
        await this.sendDailyAnalysis();
        break;
      default:
        console.log(`❌ Tarefa desconhecida: ${taskName}`);
    }
  }
}

export default new SchedulerService();