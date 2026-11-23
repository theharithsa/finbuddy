/**
 * Data Formatter for KautilyaAI Responses
 * Intelligent formatting based on user intent and data type
 */

import { QueryIntent } from './intentClassifier.js';

export interface FormattedResponse {
  type: 'data' | 'analysis' | 'conversation';
  content: string;
  metadata?: {
    totalItems?: number;
    dateRange?: string;
    summary?: string;
  };
  actionItems?: any[];
}

export class DataFormatter {
  
  /**
   * Format response based on intent and data
   */
  static formatResponse(
    intent: QueryIntent, 
    data: any[], 
    rawMessage: string,
    userData: any
  ): FormattedResponse {
    
    switch (intent.responseFormat) {
      case 'RAW_DATA':
        return this.formatRawData(intent, data, rawMessage);
      
      case 'SUMMARY':
        return this.formatSummary(intent, data, rawMessage);
      
      case 'ANALYSIS':
        return this.formatAnalysis(intent, data, userData, rawMessage);
      
      default:
        return this.formatConversation(intent, data, rawMessage);
    }
  }

  /**
   * Format raw data as structured lists/tables
   */
  private static formatRawData(intent: QueryIntent, data: any[], message: string): FormattedResponse {
    const entity = intent.subtype;
    
    if (data.length === 0) {
      return {
        type: 'data',
        content: `📋 **No ${entity} found** matching your criteria.\n\nTry adjusting your filters or date range.`,
        metadata: { totalItems: 0 }
      };
    }

    let content: string;
    
    // Format based on entity type
    switch (entity) {
      case 'expenses':
        content = this.formatExpensesList(data, intent.parameters);
        break;
      case 'budgets':
        content = this.formatBudgetsList(data);
        break;
      case 'categories':
        content = this.formatCategoriesList(data);
        break;
      case 'people':
        content = this.formatPeopleList(data);
        break;
      default:
        content = this.formatGenericList(data);
    }

    return {
      type: 'data',
      content,
      metadata: {
        totalItems: data.length,
        summary: `Showing ${data.length} ${entity}`
      }
    };
  }

  /**
   * Format expenses as a detailed list
   */
  private static formatExpensesList(expenses: any[], parameters: any): string {
    const filters = parameters.filters || {};
    let content = `💰 **Your Expenses** (${expenses.length} entries)\n\n`;
    
    // Add filter info if present
    if (filters.dateRange) {
      content += `📅 **Period:** ${filters.dateRange.start} to ${filters.dateRange.end}\n`;
    }
    if (filters.category) {
      content += `🏷️ **Category:** ${filters.category}\n`;
    }
    if (filters.amount) {
      const { min, max } = filters.amount;
      if (min && max) {
        content += `💵 **Amount Range:** ₹${min.toLocaleString()} - ₹${max.toLocaleString()}\n`;
      } else if (min) {
        content += `💵 **Minimum Amount:** ₹${min.toLocaleString()}\n`;
      } else if (max) {
        content += `💵 **Maximum Amount:** ₹${max.toLocaleString()}\n`;
      }
    }
    content += `\n`;

    // Calculate totals
    const totalAmount = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    content += `📊 **Total Amount:** ₹${totalAmount.toLocaleString()}\n`;
    content += `📈 **Average:** ₹${Math.round(totalAmount / expenses.length).toLocaleString()}\n\n`;

    content += `---\n\n`;

    // List each expense
    expenses.forEach((expense, index) => {
      const date = this.formatDate(expense.date);
      const peopleInfo = expense.peopleIds && expense.peopleIds.length > 0 
        ? ` 👥 (shared with ${expense.peopleIds.length} people)` 
        : '';
      
      content += `**${index + 1}.** ${expense.description || 'Expense'}\n`;
      content += `   💰 **₹${expense.amount.toLocaleString()}** | 🏷️ ${expense.category} | 📅 ${date}${peopleInfo}\n`;
      
      if (expense.receiptUrl) {
        content += `   📄 Receipt attached\n`;
      }
      content += `\n`;
    });

    // Add category breakdown
    const categoryTotals = this.calculateCategoryTotals(expenses);
    if (Object.keys(categoryTotals).length > 1) {
      content += `\n📊 **Category Breakdown:**\n`;
      Object.entries(categoryTotals)
        .sort(([,a], [,b]) => (b as number) - (a as number))
        .forEach(([category, amount]) => {
          const percentage = ((amount as number) / totalAmount * 100).toFixed(1);
          content += `   • ${category}: ₹${(amount as number).toLocaleString()} (${percentage}%)\n`;
        });
    }

    return content;
  }

  /**
   * Format budgets list
   */
  private static formatBudgetsList(budgets: any[]): string {
    let content = `🎯 **Your Budgets** (${budgets.length} active)\n\n`;
    
    budgets.forEach((budget, index) => {
      const utilization = budget.spent || 0;
      const remaining = budget.limit - utilization;
      const percentageNum = budget.limit > 0 ? (utilization / budget.limit * 100) : 0;
      const percentage = percentageNum.toFixed(1);
      
      const status = percentageNum > 100 ? '🔴 Over Budget' : 
                    percentageNum > 80 ? '🟡 Nearly Full' : '🟢 On Track';
      
      content += `**${index + 1}.** ${budget.category} Budget\n`;
      content += `   💰 **₹${utilization.toLocaleString()}** / ₹${budget.limit.toLocaleString()} (${percentage}% used)\n`;
      content += `   💵 **Remaining:** ₹${remaining.toLocaleString()}\n`;
      content += `   📅 **Period:** ${budget.period}\n`;
      content += `   ${status}\n\n`;
    });

    return content;
  }

  /**
   * Format categories list
   */
  private static formatCategoriesList(categories: any[]): string {
    let content = `🏷️ **Your Categories** (${categories.length} total)\n\n`;
    
    categories.forEach((category, index) => {
      content += `**${index + 1}.** ${category.name}\n`;
      if (category.description) {
        content += `   📝 ${category.description}\n`;
      }
      if (category.icon) {
        content += `   ${category.icon}\n`;
      }
      content += `\n`;
    });

    return content;
  }

  /**
   * Format people list
   */
  private static formatPeopleList(people: any[]): string {
    let content = `👥 **Your People** (${people.length} total)\n\n`;
    
    people.forEach((person, index) => {
      content += `**${index + 1}.** ${person.name}\n`;
      if (person.relationship) {
        content += `   🤝 ${person.relationship}\n`;
      }
      if (person.email) {
        content += `   📧 ${person.email}\n`;
      }
      content += `\n`;
    });

    return content;
  }

  /**
   * Format summary response
   */
  private static formatSummary(intent: QueryIntent, data: any[], message: string): FormattedResponse {
    const entity = intent.subtype;
    
    if (data.length === 0) {
      return {
        type: 'data',
        content: `📋 No ${entity} data available for summary.`
      };
    }

    let content = `📊 **${entity.charAt(0).toUpperCase() + entity.slice(1)} Summary**\n\n`;
    
    if (entity === 'expenses') {
      const total = data.reduce((sum, exp) => sum + exp.amount, 0);
      const avgAmount = total / data.length;
      const categories = [...new Set(data.map(exp => exp.category))];
      
      content += `• **Total Entries:** ${data.length}\n`;
      content += `• **Total Amount:** ₹${total.toLocaleString()}\n`;
      content += `• **Average:** ₹${Math.round(avgAmount).toLocaleString()}\n`;
      content += `• **Categories:** ${categories.length} different categories\n`;
      content += `• **Top Category:** ${this.getTopCategory(data)}\n`;
    }

    return {
      type: 'data',
      content,
      metadata: { totalItems: data.length }
    };
  }

  /**
   * Format analysis response
   */
  private static formatAnalysis(intent: QueryIntent, data: any[], userData: any, message: string): FormattedResponse {
    // This would integrate with existing analysis logic
    return {
      type: 'analysis',
      content: `📈 **Analysis will be enhanced with ML insights**\n\nCombining your ${data.length} data points with advanced financial analysis...`
    };
  }

  /**
   * Format conversational response
   */
  private static formatConversation(intent: QueryIntent, data: any[], message: string): FormattedResponse {
    return {
      type: 'conversation',
      content: `I understand you're asking about ${intent.subtype}. Let me help you with that...`
    };
  }

  /**
   * Helper methods
   */
  private static formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });
  }

  private static calculateCategoryTotals(expenses: any[]): Record<string, number> {
    return expenses.reduce((acc, exp) => {
      acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
      return acc;
    }, {});
  }

  private static getTopCategory(expenses: any[]): string {
    const categoryTotals = this.calculateCategoryTotals(expenses);
    const topCategory = Object.entries(categoryTotals)
      .sort(([,a], [,b]) => (b as number) - (a as number))[0];
    
    return topCategory ? `${topCategory[0]} (₹${(topCategory[1] as number).toLocaleString()})` : 'None';
  }

  private static formatGenericList(data: any[]): string {
    let content = `📋 **Data List** (${data.length} items)\n\n`;
    
    data.forEach((item, index) => {
      content += `**${index + 1}.** ${JSON.stringify(item, null, 2)}\n\n`;
    });

    return content;
  }
}
