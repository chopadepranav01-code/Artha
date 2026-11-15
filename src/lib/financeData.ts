export type TransactionType = 'income' | 'expense' | 'saving'

export type Transaction = {
  id: string
  merchant: string
  category: string
  date: string
  amount: number
  type: TransactionType
}

export type Budget = {
  id: string
  name: string
  spent: number
  limit: number
  color: string
}

export type Goal = {
  id: string
  title: string
  amount: number
  saved: number
  monthly: number
  date: string
  color: string
}

export type Account = {
  id: string
  name: string
  type: 'cash' | 'savings' | 'investment' | 'credit'
  balance: number
  color: string
}

export type RecurringBill = {
  id: string
  name: string
  amount: number
  dueDate: string
  category: string
  color: string
}

export type Debt = {
  id: string
  name: string
  balance: number
  rate: number
  payment: number
  color: string
}

export type FinanceSnapshot = {
  transactions: Transaction[]
  budgets: Budget[]
  goals: Goal[]
  accounts: Account[]
  bills: RecurringBill[]
  debts: Debt[]
}

const STORAGE_KEY = 'artha-finance-data-v1'

export const defaultTransactions: Transaction[] = [
  { id: 'txn-1', merchant: 'Salary', category: 'Income', date: '2026-08-06', amount: 87500, type: 'income' },
  { id: 'txn-2', merchant: 'Zomato', category: 'Food', date: '2026-08-08', amount: 1200, type: 'expense' },
  { id: 'txn-3', merchant: 'Amazon', category: 'Shopping', date: '2026-08-09', amount: 6400, type: 'expense' },
  { id: 'txn-4', merchant: 'SIP', category: 'Savings', date: '2026-08-09', amount: 8000, type: 'saving' },
  { id: 'txn-5', merchant: 'Rent', category: 'Housing', date: '2026-08-02', amount: 24000, type: 'expense' },
]

export const defaultBudgets: Budget[] = [
  { id: 'budget-1', name: 'Food', spent: 6200, limit: 10000, color: '#2E7D32' },
  { id: 'budget-2', name: 'Travel', spent: 8400, limit: 12000, color: '#CBA135' },
  { id: 'budget-3', name: 'Shopping', spent: 9200, limit: 8000, color: '#E76F51' },
  { id: 'budget-4', name: 'Learning', spent: 3000, limit: 6000, color: '#7C3AED' },
]

export const defaultGoals: Goal[] = [
  { id: 'goal-1', title: 'Emergency Fund', amount: 240000, saved: 163000, monthly: 18000, date: 'Aug 2027', color: '#2E7D32' },
  { id: 'goal-2', title: 'Car', amount: 900000, saved: 385000, monthly: 22000, date: 'Dec 2026', color: '#CBA135' },
  { id: 'goal-3', title: 'Laptop', amount: 120000, saved: 83000, monthly: 9000, date: 'Nov 2026', color: '#7C3AED' },
]

export const defaultAccounts: Account[] = [
  { id: 'acct-1', name: 'Cash', type: 'cash', balance: 250000, color: '#2E7D32' },
  { id: 'acct-2', name: 'Savings', type: 'savings', balance: 420000, color: '#CBA135' },
  { id: 'acct-3', name: 'Investments', type: 'investment', balance: 980000, color: '#7C3AED' },
  { id: 'acct-4', name: 'Credit Card', type: 'credit', balance: -420000, color: '#E76F51' },
]

export const defaultBills: RecurringBill[] = [
  { id: 'bill-1', name: 'Rent', amount: 24000, dueDate: '2026-08-15', category: 'Housing', color: '#CBA135' },
  { id: 'bill-2', name: 'Internet', amount: 1800, dueDate: '2026-08-18', category: 'Utilities', color: '#38BDF8' },
  { id: 'bill-3', name: 'Insurance', amount: 6200, dueDate: '2026-08-22', category: 'Protection', color: '#2E7D32' },
]

export const defaultDebts: Debt[] = [
  { id: 'debt-1', name: 'Credit Card', balance: 420000, rate: 24, payment: 12000, color: '#E76F51' },
  { id: 'debt-2', name: 'Education Loan', balance: 860000, rate: 8.5, payment: 18000, color: '#7C3AED' },
]

export function loadStoredState(): FinanceSnapshot {
  if (typeof window === 'undefined') {
    return { transactions: defaultTransactions, budgets: defaultBudgets, goals: defaultGoals, accounts: defaultAccounts, bills: defaultBills, debts: defaultDebts }
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return { transactions: defaultTransactions, budgets: defaultBudgets, goals: defaultGoals, accounts: defaultAccounts, bills: defaultBills, debts: defaultDebts }
    }

    const parsed = JSON.parse(raw) as Partial<FinanceSnapshot>
    return {
      transactions: Array.isArray(parsed.transactions) && parsed.transactions.length ? parsed.transactions : defaultTransactions,
      budgets: Array.isArray(parsed.budgets) && parsed.budgets.length ? parsed.budgets : defaultBudgets,
      goals: Array.isArray(parsed.goals) && parsed.goals.length ? parsed.goals : defaultGoals,
      accounts: Array.isArray(parsed.accounts) && parsed.accounts.length ? parsed.accounts : defaultAccounts,
      bills: Array.isArray(parsed.bills) && parsed.bills.length ? parsed.bills : defaultBills,
      debts: Array.isArray(parsed.debts) && parsed.debts.length ? parsed.debts : defaultDebts,
    }
  } catch {
    return { transactions: defaultTransactions, budgets: defaultBudgets, goals: defaultGoals, accounts: defaultAccounts, bills: defaultBills, debts: defaultDebts }
  }
}

export function persistStoredState(snapshot: FinanceSnapshot) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
}
