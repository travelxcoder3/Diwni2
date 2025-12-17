export type TransactionType = 'credit' | 'debt'; // credit = لي (Money owed to me), debt = علي (Money I owe)
export type TransactionStatus = 'pending' | 'settled';

export interface User {
  id: string;
  username: string;
  password?: string; // In a real app, never store plain text
  name: string;
}

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  paidAmount: number; // New: Track how much has been paid
  currency: string;   // New: Track currency (SAR, USD, etc.)
  counterparty: string; // The person involved (e.g., "Ahmed")
  description: string;
  date: string;
  dueDate?: string;
  status: TransactionStatus;
}

export interface FinancialSummary {
  totalCredit: number; // Li
  totalDebt: number;   // Alai
  netBalance: number;
}