import { User, Transaction, TransactionType } from '../types';

const USERS_KEY = 'mali_users';
const CURRENT_USER_KEY = 'mali_current_user';
const TRANSACTIONS_KEY = 'mali_transactions';

// --- Auth Services ---

export const registerUser = (username: string, password: string, name: string): User => {
  const usersStr = localStorage.getItem(USERS_KEY);
  const users: User[] = usersStr ? JSON.parse(usersStr) : [];

  if (users.find(u => u.username === username)) {
    throw new Error('اسم المستخدم موجود بالفعل');
  }

  const newUser: User = {
    id: crypto.randomUUID(),
    username,
    password, // Demo only: Storing password in plain text for localStorage simulation
    name
  };

  users.push(newUser);
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(newUser));
  return newUser;
};

export const loginUser = (username: string, password: string): User => {
  const usersStr = localStorage.getItem(USERS_KEY);
  const users: User[] = usersStr ? JSON.parse(usersStr) : [];
  
  const user = users.find(u => u.username === username && u.password === password);
  
  if (!user) {
    throw new Error('خطأ في اسم المستخدم أو كلمة المرور');
  }

  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  return user;
};

export const logoutUser = () => {
  localStorage.removeItem(CURRENT_USER_KEY);
};

export const getCurrentUser = (): User | null => {
  const userStr = localStorage.getItem(CURRENT_USER_KEY);
  return userStr ? JSON.parse(userStr) : null;
};

// --- Transaction Services ---

export const getTransactions = (userId: string): Transaction[] => {
  const allStr = localStorage.getItem(TRANSACTIONS_KEY);
  const all: Transaction[] = allStr ? JSON.parse(allStr) : [];
  return all.filter(t => t.userId === userId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

export const addTransaction = (transaction: Omit<Transaction, 'id' | 'paidAmount'>): Transaction => {
  const allStr = localStorage.getItem(TRANSACTIONS_KEY);
  const all: Transaction[] = allStr ? JSON.parse(allStr) : [];

  const newTrans: Transaction = {
    ...transaction,
    paidAmount: 0, // Initialize with 0 paid
    id: crypto.randomUUID(),
  };

  all.push(newTrans);
  localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(all));
  return newTrans;
};

export const addPaymentToTransaction = (id: string, paymentAmount: number): void => {
  const allStr = localStorage.getItem(TRANSACTIONS_KEY);
  let all: Transaction[] = allStr ? JSON.parse(allStr) : [];
  
  all = all.map(t => {
    if (t.id === id) {
        const newPaidAmount = (t.paidAmount || 0) + paymentAmount;
        // If paid amount covers the total, mark as settled
        const isSettled = newPaidAmount >= t.amount;
        return { 
            ...t, 
            paidAmount: newPaidAmount,
            status: isSettled ? 'settled' : 'pending'
        };
    }
    return t;
  });
  localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(all));
};

// Fallback for full toggle if needed (legacy support)
export const updateTransactionStatus = (id: string, status: 'settled' | 'pending'): void => {
  const allStr = localStorage.getItem(TRANSACTIONS_KEY);
  let all: Transaction[] = allStr ? JSON.parse(allStr) : [];
  
  all = all.map(t => {
      if (t.id === id) {
          return {
              ...t,
              status,
              // If marking as settled manually, assume full payment. If pending, reset payment? 
              // Better logic: If settled, paid = amount. If pending, keep paid amount (user might have unpaid it).
              paidAmount: status === 'settled' ? t.amount : (t.paidAmount || 0)
          }
      }
      return t;
  });
  localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(all));
};

export const deleteTransaction = (id: string): void => {
    const allStr = localStorage.getItem(TRANSACTIONS_KEY);
    let all: Transaction[] = allStr ? JSON.parse(allStr) : [];
    all = all.filter(t => t.id !== id);
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(all));
}