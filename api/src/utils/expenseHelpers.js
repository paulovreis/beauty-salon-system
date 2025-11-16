// Configurações e constantes para o sistema de despesas

export const EXPENSE_CATEGORIES = {
  RENT: 'Aluguel',
  SALARIES: 'Salários', 
  PRODUCTS: 'Produtos',
  EQUIPMENT: 'Equipamentos',
  MARKETING: 'Marketing',
  UTILITIES: 'Utilidades',
  TAXES: 'Impostos',
  MAINTENANCE: 'Manutenção',
  TRANSPORT: 'Transporte',
  OTHER: 'Outros'
};

export const PAYMENT_METHODS = {
  CASH: 'Dinheiro',
  DEBIT_CARD: 'Cartão Débito',
  CREDIT_CARD: 'Cartão Crédito',
  PIX: 'PIX',
  TRANSFER: 'Transferência',
  BOLETO: 'Boleto',
  CHECK: 'Cheque'
};

export const EXPENSE_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  OVERDUE: 'overdue',
  CANCELED: 'canceled'
};

// Helper functions para formatação e validação
export class ExpenseHelper {
  static formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  }

  static formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('pt-BR');
  }

  static validateExpense(expense) {
    const errors = [];

    if (!expense.category || expense.category.trim() === '') {
      errors.push('Categoria é obrigatória');
    }

    if (!expense.description || expense.description.trim() === '') {
      errors.push('Descrição é obrigatória');
    }

    if (!expense.amount || isNaN(expense.amount) || parseFloat(expense.amount) <= 0) {
      errors.push('Valor deve ser um número maior que zero');
    }

    if (!expense.expense_date) {
      errors.push('Data da despesa é obrigatória');
    }

    if (!expense.payment_method || expense.payment_method.trim() === '') {
      errors.push('Método de pagamento é obrigatório');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static getCategoryColor(category) {
    const colors = {
      [EXPENSE_CATEGORIES.RENT]: '#3B82F6',
      [EXPENSE_CATEGORIES.SALARIES]: '#10B981',
      [EXPENSE_CATEGORIES.PRODUCTS]: '#F59E0B',
      [EXPENSE_CATEGORIES.EQUIPMENT]: '#8B5CF6',
      [EXPENSE_CATEGORIES.MARKETING]: '#EF4444',
      [EXPENSE_CATEGORIES.UTILITIES]: '#06B6D4',
      [EXPENSE_CATEGORIES.TAXES]: '#84CC16',
      [EXPENSE_CATEGORIES.MAINTENANCE]: '#F97316',
      [EXPENSE_CATEGORIES.TRANSPORT]: '#6366F1',
      [EXPENSE_CATEGORIES.OTHER]: '#6B7280'
    };
    return colors[category] || '#6B7280';
  }

  static getCategoryIcon(category) {
    const icons = {
      [EXPENSE_CATEGORIES.RENT]: 'home',
      [EXPENSE_CATEGORIES.SALARIES]: 'users',
      [EXPENSE_CATEGORIES.PRODUCTS]: 'package',
      [EXPENSE_CATEGORIES.EQUIPMENT]: 'cog',
      [EXPENSE_CATEGORIES.MARKETING]: 'megaphone',
      [EXPENSE_CATEGORIES.UTILITIES]: 'zap',
      [EXPENSE_CATEGORIES.TAXES]: 'file-text',
      [EXPENSE_CATEGORIES.MAINTENANCE]: 'wrench',
      [EXPENSE_CATEGORIES.TRANSPORT]: 'truck',
      [EXPENSE_CATEGORIES.OTHER]: 'more-horizontal'
    };
    return icons[category] || 'more-horizontal';
  }

  static calculateMonthlyAverage(expenses) {
    if (!expenses || expenses.length === 0) return 0;
    
    const totalAmount = expenses.reduce((sum, expense) => sum + parseFloat(expense.amount), 0);
    const months = new Set(expenses.map(expense => 
      new Date(expense.expense_date).toISOString().substring(0, 7)
    )).size;
    
    return months > 0 ? totalAmount / months : totalAmount;
  }

  static getExpensesByPeriod(expenses, startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    return expenses.filter(expense => {
      const expenseDate = new Date(expense.expense_date);
      return expenseDate >= start && expenseDate <= end;
    });
  }

  static groupExpensesByCategory(expenses) {
    return expenses.reduce((acc, expense) => {
      if (!acc[expense.category]) {
        acc[expense.category] = [];
      }
      acc[expense.category].push(expense);
      return acc;
    }, {});
  }

  static generateExpenseReport(expenses) {
    const total = expenses.reduce((sum, expense) => sum + parseFloat(expense.amount), 0);
    const byCategory = this.groupExpensesByCategory(expenses);
    const categoryTotals = Object.keys(byCategory).map(category => ({
      category,
      total: byCategory[category].reduce((sum, expense) => sum + parseFloat(expense.amount), 0),
      count: byCategory[category].length,
      percentage: ((byCategory[category].reduce((sum, expense) => sum + parseFloat(expense.amount), 0) / total) * 100).toFixed(2)
    })).sort((a, b) => b.total - a.total);

    return {
      total_amount: total,
      total_count: expenses.length,
      average_expense: expenses.length > 0 ? total / expenses.length : 0,
      categories: categoryTotals,
      period: {
        start: expenses.length > 0 ? Math.min(...expenses.map(e => new Date(e.expense_date))) : null,
        end: expenses.length > 0 ? Math.max(...expenses.map(e => new Date(e.expense_date))) : null
      }
    };
  }

  static detectRecurringExpenses(expenses) {
    // Agrupa despesas similares por descrição
    const grouped = expenses.reduce((acc, expense) => {
      const key = expense.description.toLowerCase().trim();
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(expense);
      return acc;
    }, {});

    // Filtra grupos que têm 2+ ocorrências
    return Object.keys(grouped)
      .filter(key => grouped[key].length >= 2)
      .map(key => ({
        description: key,
        occurrences: grouped[key].length,
        total_amount: grouped[key].reduce((sum, expense) => sum + parseFloat(expense.amount), 0),
        average_amount: grouped[key].reduce((sum, expense) => sum + parseFloat(expense.amount), 0) / grouped[key].length,
        frequency_days: this.calculateFrequency(grouped[key]),
        expenses: grouped[key]
      }))
      .sort((a, b) => b.occurrences - a.occurrences);
  }

  static calculateFrequency(expenses) {
    if (expenses.length < 2) return null;
    
    const dates = expenses.map(e => new Date(e.expense_date)).sort();
    const intervals = [];
    
    for (let i = 1; i < dates.length; i++) {
      const diffTime = Math.abs(dates[i] - dates[i-1]);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      intervals.push(diffDays);
    }
    
    return intervals.length > 0 ? Math.round(intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length) : null;
  }
}

export default {
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  EXPENSE_STATUS,
  ExpenseHelper
};