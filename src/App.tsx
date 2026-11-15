import { useEffect, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import './App.css'
import { generateFinanceAssistantReply } from './lib/openai'
import { isFirebaseConfigured, firebaseAuth, googleProvider } from './lib/firebase'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { defaultAccounts, defaultBills, defaultBudgets, defaultDebts, defaultGoals, defaultTransactions, loadStoredState, persistStoredState, type Account, type Budget, type Debt, type Goal, type RecurringBill, type Transaction } from './lib/financeData'

const monthlySeries = [
  { month: 'Jan', income: 78000, expense: 44000 },
  { month: 'Feb', income: 82000, expense: 47000 },
  { month: 'Mar', income: 90000, expense: 51000 },
  { month: 'Apr', income: 93000, expense: 54000 },
  { month: 'May', income: 96000, expense: 58000 },
  { month: 'Jun', income: 101000, expense: 61000 },
  { month: 'Jul', income: 104000, expense: 63000 },
]

const pieData = [
  { name: 'Housing', value: 24000, color: '#CBA135' },
  { name: 'Food', value: 18000, color: '#2E7D32' },
  { name: 'Travel', value: 15000, color: '#7C3AED' },
  { name: 'Shopping', value: 12000, color: '#E76F51' },
  { name: 'Other', value: 9000, color: '#5B6577' },
]

const spendingByWeek = [
  { week: 'W1', amount: 8000 },
  { week: 'W2', amount: 11000 },
  { week: 'W3', amount: 9200 },
  { week: 'W4', amount: 13500 },
  { week: 'W5', amount: 10400 },
]

const aiMessages = [
  { sender: 'assistant', text: 'Your cash flow is healthy. Savings are up 12% versus last quarter.' },
  { sender: 'user', text: 'Where am I spending the most money?' },
  { sender: 'assistant', text: 'Housing and food are your top categories this month, accounting for 41% of all expenses.' },
]

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value)

const formatChartValue = (value: string | number | readonly (string | number)[] | undefined) => {
  const safeValue = Array.isArray(value) ? value[0] : value
  return formatCurrency(Number(safeValue ?? 0))
}

function App() {
  const [prompt, setPrompt] = useState('')
  const [chat, setChat] = useState(aiMessages)
  const [transactions, setTransactions] = useState<Transaction[]>(defaultTransactions)
  const [budgets, setBudgets] = useState<Budget[]>(defaultBudgets)
  const [goals, setGoals] = useState<Goal[]>(defaultGoals)
  const [accounts, setAccounts] = useState<Account[]>(defaultAccounts)
  const [bills, setBills] = useState<RecurringBill[]>(defaultBills)
  const [debts, setDebts] = useState<Debt[]>(defaultDebts)
  const [isLoadingAI, setIsLoadingAI] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authEmail, setAuthEmail] = useState('')
  const [authInitialized, setAuthInitialized] = useState(false)
  const [authError, setAuthError] = useState('')
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [resetModalOpen, setResetModalOpen] = useState(false)
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [budgetModalOpen, setBudgetModalOpen] = useState(false)
  const [goalModalOpen, setGoalModalOpen] = useState(false)
  const [billModalOpen, setBillModalOpen] = useState(false)
  const [debtModalOpen, setDebtModalOpen] = useState(false)
  const [quickAddForm, setQuickAddForm] = useState({
    merchant: '',
    category: 'Food',
    amount: '',
    type: 'expense' as Transaction['type'],
    date: new Date().toISOString().slice(0, 10),
  })
  const [budgetForm, setBudgetForm] = useState({
    name: '',
    limit: '',
    spent: '',
    color: '#2E7D32',
  })
  const [goalForm, setGoalForm] = useState({
    title: '',
    amount: '',
    saved: '',
    monthly: '',
    date: 'Dec 2027',
    color: '#2E7D32',
  })
  const [billForm, setBillForm] = useState({
    name: '',
    amount: '',
    category: 'Housing',
    dueDate: new Date().toISOString().slice(0, 10),
    color: '#CBA135',
  })
  const [debtForm, setDebtForm] = useState({
    name: '',
    balance: '',
    rate: '',
    payment: '',
    color: '#E76F51',
  })

  useEffect(() => {
    const snapshot = loadStoredState()
    setTransactions(snapshot.transactions)
    setBudgets(snapshot.budgets)
    setGoals(snapshot.goals)
    setAccounts(snapshot.accounts)
    setBills(snapshot.bills)
    setDebts(snapshot.debts)

  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('artha-auth-state')
    }

    if (!firebaseAuth) {
      setAuthInitialized(true)
      return
    }

    return onAuthStateChanged(
      firebaseAuth,
      (user) => {
        setAuthEmail(user?.email ?? '')
        setIsAuthenticated(Boolean(user))
        setAuthInitialized(true)
      },
      () => {
        setAuthError('Unable to verify your Google sign-in. Please refresh and try again.')
        setAuthEmail('')
        setIsAuthenticated(false)
        setAuthInitialized(true)
      },
    )
  }, [])

  useEffect(() => {
    persistStoredState({ transactions, budgets, goals, accounts, bills, debts })
  }, [transactions, budgets, goals, accounts, bills, debts])

  useEffect(() => {
    if (authInitialized && !isAuthenticated) {
      setAuthModalOpen(true)
    }
  }, [authInitialized, isAuthenticated])

  const handleSignIn = async () => {
    setAuthError('')

    if (!isFirebaseConfigured || !firebaseAuth) {
      setAuthError('Google sign-in is not configured yet. Add the Firebase web app settings and redeploy.')
      return
    }

    try {
      await signInWithPopup(firebaseAuth, googleProvider)
      setAuthModalOpen(false)
    } catch (error) {
      const errorCode = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
      if (errorCode === 'auth/unauthorized-domain') {
        setAuthError('This domain is not authorized in Firebase Authentication.')
      } else if (errorCode === 'auth/popup-closed-by-user') {
        setAuthError('Sign-in was cancelled.')
      } else {
        setAuthError('Google sign-in failed. Please try again.')
      }
    }
  }

  const handleSignOut = async () => {
    if (!firebaseAuth) return

    try {
      await signOut(firebaseAuth)
    } catch {
      setAuthError('Unable to sign out right now. Please try again.')
    }
  }

  const handleResetData = () => {
    setTransactions([])
    setBudgets([])
    setGoals([])
    setAccounts([])
    setBills([])
    setDebts([])
    setResetModalOpen(false)
    setAuthError('')

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('artha-finance-data-v1')
    }
    if (firebaseAuth) {
      void signOut(firebaseAuth)
    }
  }

  const handleQuickAdd = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const amount = Number(quickAddForm.amount)

    if (!quickAddForm.merchant.trim() || !Number.isFinite(amount) || amount <= 0) {
      return
    }

    const newTransaction: Transaction = {
      id: `txn-${Date.now()}`,
      merchant: quickAddForm.merchant.trim(),
      category: quickAddForm.category,
      amount,
      type: quickAddForm.type,
      date: quickAddForm.date,
    }

    setTransactions((current) => [newTransaction, ...current])
    if (quickAddForm.type === 'expense') {
      setBudgets((current) =>
        current.map((budget) =>
          budget.name.toLowerCase() === quickAddForm.category.toLowerCase()
            ? { ...budget, spent: budget.spent + amount }
            : budget,
        ),
      )
    }

    setQuickAddOpen(false)
    setQuickAddForm({
      merchant: '',
      category: 'Food',
      amount: '',
      type: 'expense',
      date: new Date().toISOString().slice(0, 10),
    })
  }

  const handleBudgetAdd = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const limit = Number(budgetForm.limit)
    const spent = Number(budgetForm.spent)

    if (!budgetForm.name.trim() || !Number.isFinite(limit) || limit <= 0) {
      return
    }

    const newBudget: Budget = {
      id: `budget-${Date.now()}`,
      name: budgetForm.name.trim(),
      limit,
      spent: Number.isFinite(spent) && spent > 0 ? spent : 0,
      color: budgetForm.color,
    }

    setBudgets((current) => [newBudget, ...current])
    setBudgetForm({ name: '', limit: '', spent: '', color: '#2E7D32' })
    setBudgetModalOpen(false)
  }

  const handleBillAdd = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const amount = Number(billForm.amount)

    if (!billForm.name.trim() || !Number.isFinite(amount) || amount <= 0) {
      return
    }

    const newBill: RecurringBill = {
      id: `bill-${Date.now()}`,
      name: billForm.name.trim(),
      amount,
      dueDate: billForm.dueDate,
      category: billForm.category,
      color: billForm.color,
    }

    setBills((current) => [newBill, ...current])
    setBillForm({
      name: '',
      amount: '',
      category: 'Housing',
      dueDate: new Date().toISOString().slice(0, 10),
      color: '#CBA135',
    })
    setBillModalOpen(false)
  }

  const handleDebtAdd = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const balance = Number(debtForm.balance)
    const payment = Number(debtForm.payment)
    const rate = Number(debtForm.rate)

    if (!debtForm.name.trim() || !Number.isFinite(balance) || balance <= 0) {
      return
    }

    const newDebt: Debt = {
      id: `debt-${Date.now()}`,
      name: debtForm.name.trim(),
      balance,
      rate: Number.isFinite(rate) ? rate : 0,
      payment: Number.isFinite(payment) ? payment : 0,
      color: debtForm.color,
    }

    setDebts((current) => [newDebt, ...current])
    setDebtForm({ name: '', balance: '', rate: '', payment: '', color: '#E76F51' })
    setDebtModalOpen(false)
  }

  const handleGoalAdd = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const amount = Number(goalForm.amount)
    const saved = Number(goalForm.saved)
    const monthly = Number(goalForm.monthly)

    if (!goalForm.title.trim() || !Number.isFinite(amount) || amount <= 0) {
      return
    }

    const newGoal: Goal = {
      id: `goal-${Date.now()}`,
      title: goalForm.title.trim(),
      amount,
      saved: Number.isFinite(saved) && saved > 0 ? saved : 0,
      monthly: Number.isFinite(monthly) && monthly > 0 ? monthly : 0,
      date: goalForm.date || 'Dec 2027',
      color: goalForm.color,
    }

    setGoals((current) => [newGoal, ...current])
    setGoalForm({ title: '', amount: '', saved: '', monthly: '', date: 'Dec 2027', color: '#2E7D32' })
    setGoalModalOpen(false)
  }

  const totals = useMemo(() => {
    const income = transactions.filter((item) => item.type === 'income').reduce((sum, item) => sum + item.amount, 0)
    const expense = transactions.filter((item) => item.type === 'expense').reduce((sum, item) => sum + item.amount, 0)
    const savings = transactions.filter((item) => item.type === 'saving').reduce((sum, item) => sum + item.amount, 0)
    const accountBalance = accounts.reduce((sum, account) => sum + account.balance, 0)
    const monthlyBills = bills.reduce((sum, bill) => sum + bill.amount, 0)
    const monthlyDebtPayments = debts.reduce((sum, debt) => sum + debt.payment, 0)
    return {
      income,
      expense,
      savings: income - expense + savings,
      accountBalance,
      available: Math.max(accountBalance + savings - expense - monthlyBills - monthlyDebtPayments, 0),
      monthlyBills,
      monthlyDebtPayments,
    }
  }, [transactions, accounts, bills, debts])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = prompt.trim()
    if (!trimmed) return

    setChat((current) => [...current, { sender: 'user', text: trimmed }])
    setPrompt('')
    setIsLoadingAI(true)

    try {
      const answer = await generateFinanceAssistantReply(trimmed, { transactions, budgets, goals, accounts, bills, debts })
      setChat((current) => [...current, { sender: 'assistant', text: answer }])
    } catch {
      setChat((current) => [...current, { sender: 'assistant', text: 'I could not analyze that request right now, but your finances are still tracking correctly.' }])
    } finally {
      setIsLoadingAI(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="artha-app">
        <div className="background-grid" />

        <header className="topbar">
          <div className="brand-wrap">
            <div className="brand-mark">A</div>
            <div>
              <div className="brand-name">Artha</div>
              <div className="brand-tag">Track Every Rupee</div>
            </div>
          </div>

          <div className="top-actions">
            <button className="ghost-button" type="button" onClick={() => setAuthModalOpen(true)}>
              Sign in
            </button>
            <button className="ghost-button" type="button" onClick={() => setResetModalOpen(true)}>
              Reset data
            </button>
          </div>
        </header>

        <div className="workspace-layout">
          <main className="app-shell">
            <section className="hero-row">
              <div>
                <div className="eyebrow">Secure access</div>
                <h1>Sign in to view your financial dashboard.</h1>
              </div>
            </section>
          </main>
        </div>

        {authModalOpen && (
          <div className="auth-overlay" onClick={() => setAuthModalOpen(false)}>
            <div className="auth-modal" onClick={(event) => event.stopPropagation()}>
              <div className="auth-header">
                <div>
                  <div className="eyebrow">Welcome back</div>
                  <h2>Sign in to Artha</h2>
                </div>
                <button type="button" className="icon-button" onClick={() => setAuthModalOpen(false)} aria-label="Close sign-in dialog">
                  ✕
                </button>
              </div>

              <div className="auth-alt-actions">
                <button type="button" className="primary-button auth-submit" onClick={() => void handleSignIn()} disabled={!authInitialized}>
                  Continue with Google
                </button>
                {authError && <p className="auth-error" role="alert">{authError}</p>}
              </div>
            </div>
          </div>
        )}

        {resetModalOpen && (
          <div className="auth-overlay" onClick={() => setResetModalOpen(false)}>
            <div className="auth-modal" onClick={(event) => event.stopPropagation()}>
              <div className="auth-header">
                <div>
                  <div className="eyebrow">Reset workspace</div>
                  <h2>Delete all saved data?</h2>
                </div>
                <button type="button" className="icon-button" onClick={() => setResetModalOpen(false)} aria-label="Close reset dialog">
                  ✕
                </button>
              </div>

              <div className="auth-form">
                <p>This will permanently remove all saved financial records, budgets, goals, bills, and account data.</p>
                <div className="auth-alt-actions">
                  <button type="button" className="ghost-button" onClick={() => setResetModalOpen(false)}>
                    Cancel
                  </button>
                  <button type="button" className="primary-button auth-submit" onClick={handleResetData}>
                    Reset all data
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="artha-app">
      <div className="background-grid" />

      <header className="topbar">
        <div className="brand-wrap">
          <div className="brand-mark">A</div>
          <div>
            <div className="brand-name">Artha</div>
            <div className="brand-tag">Track Every Rupee</div>
          </div>
        </div>

        <div className="top-actions">
          <button type="button" className="ghost-button status-button" onClick={() => setAuthModalOpen(true)}>
            <span className="status-dot" />
            {authEmail}
          </button>
          <button type="button" className="ghost-button" onClick={() => setAuthModalOpen(true)}>
            Security
          </button>
          <button type="button" className="ghost-button" onClick={() => setResetModalOpen(true)}>
            Reset data
          </button>
          <button type="button" className="ghost-button" onClick={handleSignOut}>
            Sign out
          </button>
          <button className="primary-button" type="button" onClick={() => setQuickAddOpen(true)}>
            + Quick Add
          </button>
        </div>
      </header>

      <div className="workspace-layout">
        <main className="app-shell">
          <section className="hero-row">
            <div>
              <div className="eyebrow">Good afternoon 👋</div>
              <h1>Financial health is strong this month.</h1>
            </div>
            <label className="search-panel" aria-label="Search transactions">
              <span>⌕</span>
              <input
                type="text"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Search merchants, categories, notes, tags..."
              />
            </label>
          </section>

          <section className="metrics-grid">
            <article className="metric-card main-card">
              <div className="metric-label">Net position</div>
              <div className="metric-value success">{formatCurrency(totals.accountBalance)}</div>
              <div className="metric-detail">Total liquid and investment balance across accounts.</div>
            </article>

            <article className="metric-card">
              <div className="metric-label">Monthly bills</div>
              <div className="metric-value income">{formatCurrency(totals.monthlyBills)}</div>
              <div className="metric-detail">Expected recurring obligations this month.</div>
            </article>

            <article className="metric-card">
              <div className="metric-label">Available cash</div>
              <div className="metric-value expense">{formatCurrency(totals.available)}</div>
              <div className="metric-detail">After recurring bills and debt payments.</div>
            </article>
          </section>

          <section className="main-grid">
            <div className="primary-stack">
              <article className="panel analytics-panel">
                <div className="panel-header">
                  <div>
                    <div className="eyebrow">Analytics</div>
                    <h2>Income vs expense trend</h2>
                  </div>
                  <button className="ghost-button" type="button">
                    This year
                  </button>
                </div>

                <div className="chart-grid">
                  <div className="chart-box large-box">
                    <ResponsiveContainer width="100%" height={240}>
                      <AreaChart data={monthlySeries}>
                        <defs>
                          <linearGradient id="incomeFill" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="5%" stopColor="#2E7D32" stopOpacity={0.5} />
                            <stop offset="95%" stopColor="#2E7D32" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="expenseFill" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="5%" stopColor="#CBA135" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#CBA135" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                        <XAxis dataKey="month" stroke="#8b99b8" tickLine={false} axisLine={false} />
                        <YAxis stroke="#8b99b8" tickLine={false} axisLine={false} />
                        <Tooltip formatter={formatChartValue} />
                        <Area type="monotone" dataKey="income" stroke="#2E7D32" strokeWidth={2.5} fill="url(#incomeFill)" />
                        <Area type="monotone" dataKey="expense" stroke="#CBA135" strokeWidth={2.5} fill="url(#expenseFill)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="chart-box">
                    <div className="mini-title">Budget vs actual</div>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={spendingByWeek}>
                        <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                        <XAxis dataKey="week" stroke="#8b99b8" tickLine={false} axisLine={false} />
                        <Tooltip formatter={formatChartValue} />
                        <Bar dataKey="amount" radius={[8, 8, 0, 0]} fill="#CBA135" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="chart-box">
                    <div className="mini-title">Category split</div>
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={42} outerRadius={68} paddingAngle={3}>
                          {pieData.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={formatChartValue} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </article>

              <article className="panel budget-panel">
                <div className="panel-header">
                  <div>
                    <div className="eyebrow">Budget planner</div>
                    <h2>Monthly budgets</h2>
                  </div>
                  <button className="ghost-button" type="button" onClick={() => setBudgetModalOpen(true)}>
                    + Add budget
                  </button>
                </div>

                <div className="budget-list">
                  {budgets.map((budget) => {
                    const progress = Math.min((budget.spent / budget.limit) * 100, 100)
                    const warn = progress >= 75

                    return (
                      <div className="budget-row" key={budget.name}>
                        <div className="budget-head">
                          <div>
                            <div className="budget-name">{budget.name}</div>
                            <div className="budget-meta">{formatCurrency(budget.spent)} of {formatCurrency(budget.limit)}</div>
                          </div>
                          <div className={`budget-status ${warn ? 'warn' : ''}`}>
                            {Math.round(progress)}%
                          </div>
                        </div>
                        <div className="progress-bar">
                          <span style={{ width: `${progress}%`, background: budget.color }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </article>
            </div>

            <aside className="side-stack">
              <article className="panel assistant-panel">
                <div className="panel-header">
                  <div>
                    <div className="eyebrow">AI assistant</div>
                    <h2>Artha AI</h2>
                  </div>
                  <button className="ghost-button" type="button">
                    Voice
                  </button>
                </div>

                <div className="chat-window">
                  {chat.map((message, index) => (
                    <div key={`${message.sender}-${index}`} className={`message ${message.sender}`}>
                      {message.text}
                    </div>
                  ))}
                  {isLoadingAI && <div className="message assistant">Analyzing your finances…</div>}
                </div>

                <form className="assistant-form" onSubmit={handleSubmit}>
                  <input
                    type="text"
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    placeholder="Ask Artha about your money..."
                  />
                  <button type="submit">Ask</button>
                </form>
              </article>

              <article className="panel goals-panel">
                <div className="panel-header">
                  <div>
                    <div className="eyebrow">Savings goals</div>
                    <h2>Goal progress</h2>
                  </div>
                  <button className="ghost-button" type="button" onClick={() => setGoalModalOpen(true)}>
                    + Add goal
                  </button>
                </div>

                <div className="goal-list">
                  {goals.map((goal) => {
                    const percent = Math.min((goal.saved / goal.amount) * 100, 100)
                    return (
                      <div className="goal-card" key={goal.title}>
                        <div className="goal-topline">
                          <div className="goal-name">{goal.title}</div>
                          <div className="goal-amount">{formatCurrency(goal.saved)} / {formatCurrency(goal.amount)}</div>
                        </div>
                        <div className="ring-wrap">
                          <div
                            className="ring"
                            style={{
                              background: `conic-gradient(${goal.color} ${percent}%, rgba(148,163,184,0.18) 0)`,
                            }}
                          >
                            <span>{Math.round(percent)}%</span>
                          </div>
                        </div>
                        <div className="goal-meta">Monthly: {formatCurrency(goal.monthly)} · Due {goal.date}</div>
                      </div>
                    )
                  })}
                </div>
              </article>
            </aside>
          </section>

          <section className="bottom-grid">
            <article className="panel account-panel">
              <div className="panel-header">
                <div>
                  <div className="eyebrow">Accounts</div>
                  <h2>Balance overview</h2>
                </div>
                <button className="ghost-button" type="button" onClick={() => setDebtModalOpen(true)}>
                  + Debt
                </button>
              </div>

              <div className="account-list">
                {accounts.map((account) => (
                  <div key={account.id} className="account-row">
                    <div className="account-left">
                      <span className="account-dot" style={{ background: account.color }} />
                      <div>
                        <div className="account-name">{account.name}</div>
                        <div className="account-type">{account.type}</div>
                      </div>
                    </div>
                    <strong className={account.balance < 0 ? 'negative-balance' : 'positive-balance'}>
                      {formatCurrency(Math.abs(account.balance))}
                      {account.balance < 0 ? ' owed' : ' available'}
                    </strong>
                  </div>
                ))}
              </div>

              <div className="mini-divider" />

              <div className="panel-header small-header">
                <div>
                  <div className="eyebrow">Bills</div>
                  <h2>Recurring obligations</h2>
                </div>
                <button className="ghost-button" type="button" onClick={() => setBillModalOpen(true)}>
                  + Bill
                </button>
              </div>

              <div className="bill-list">
                {bills.map((bill) => (
                  <div key={bill.id} className="bill-row">
                    <div className="bill-left">
                      <span className="account-dot" style={{ background: bill.color }} />
                      <div>
                        <div className="account-name">{bill.name}</div>
                        <div className="account-type">{bill.category} · due {bill.dueDate}</div>
                      </div>
                    </div>
                    <strong>{formatCurrency(bill.amount)}</strong>
                  </div>
                ))}
              </div>

              <div className="mini-divider" />

              <div className="panel-header small-header">
                <div>
                  <div className="eyebrow">Debt</div>
                  <h2>Paydown</h2>
                </div>
              </div>

              <div className="debt-list">
                {debts.map((debt) => (
                  <div key={debt.id} className="bill-row">
                    <div className="bill-left">
                      <span className="account-dot" style={{ background: debt.color }} />
                      <div>
                        <div className="account-name">{debt.name}</div>
                        <div className="account-type">{debt.rate}% APR · {formatCurrency(debt.payment)} / month</div>
                      </div>
                    </div>
                    <strong className="negative-balance">{formatCurrency(debt.balance)}</strong>
                  </div>
                ))}
              </div>
            </article>

            <article className="panel history-panel">
              <div className="panel-header">
                <div>
                  <div className="eyebrow">Recent activity</div>
                  <h2>Transactions</h2>
                </div>
              </div>

              <div className="transaction-list">
                {transactions.map((transaction) => (
                  <div className="transaction-row" key={`${transaction.merchant}-${transaction.date}`}>
                    <div className="transaction-merchant">
                      <div className={`currency-pill ${transaction.type}`}>
                        {transaction.type === 'income' ? '↗' : transaction.type === 'saving' ? '✓' : '↘'}
                      </div>
                      <div>
                        <div className="merchant-name">{transaction.merchant}</div>
                        <div className="merchant-meta">{transaction.category} · {transaction.date}</div>
                      </div>
                    </div>
                    <div className={`transaction-amount ${transaction.type}`}>
                      {transaction.type === 'income' ? '+' : transaction.type === 'saving' ? '+' : '-'}
                      {formatCurrency(transaction.amount)}
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </section>
        </main>
      </div>

      {debtModalOpen && (
        <div className="auth-overlay" onClick={() => setDebtModalOpen(false)}>
          <div className="auth-modal" onClick={(event) => event.stopPropagation()}>
            <div className="auth-header">
              <div>
                <div className="eyebrow">Debt tracker</div>
                <h2>Add debt</h2>
              </div>
              <button type="button" className="icon-button" onClick={() => setDebtModalOpen(false)} aria-label="Close debt dialog">
                ✕
              </button>
            </div>

            <form className="auth-form" onSubmit={handleDebtAdd}>
              <label>
                Debt name
                <input
                  type="text"
                  value={debtForm.name}
                  onChange={(event) => setDebtForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Education loan"
                />
              </label>

              <div className="quick-add-grid">
                <label>
                  Balance
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={debtForm.balance}
                    onChange={(event) => setDebtForm((current) => ({ ...current, balance: event.target.value }))}
                    placeholder="860000"
                  />
                </label>

                <label>
                  Rate (%)
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={debtForm.rate}
                    onChange={(event) => setDebtForm((current) => ({ ...current, rate: event.target.value }))}
                    placeholder="8.5"
                  />
                </label>
              </div>

              <label>
                Monthly payment
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={debtForm.payment}
                  onChange={(event) => setDebtForm((current) => ({ ...current, payment: event.target.value }))}
                  placeholder="18000"
                />
              </label>

              <label>
                Accent color
                <div className="color-row">
                  {['#E76F51', '#7C3AED', '#CBA135', '#2E7D32', '#38BDF8'].map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`color-swatch ${debtForm.color === color ? 'selected' : ''}`}
                      style={{ background: color }}
                      onClick={() => setDebtForm((current) => ({ ...current, color }))}
                      aria-label={`Select ${color}`}
                    />
                  ))}
                </div>
              </label>

              <button type="submit" className="primary-button auth-submit">
                Save debt
              </button>
            </form>
          </div>
        </div>
      )}

      {billModalOpen && (
        <div className="auth-overlay" onClick={() => setBillModalOpen(false)}>
          <div className="auth-modal" onClick={(event) => event.stopPropagation()}>
            <div className="auth-header">
              <div>
                <div className="eyebrow">Recurring bills</div>
                <h2>Add bill</h2>
              </div>
              <button type="button" className="icon-button" onClick={() => setBillModalOpen(false)} aria-label="Close bill dialog">
                ✕
              </button>
            </div>

            <form className="auth-form" onSubmit={handleBillAdd}>
              <label>
                Bill name
                <input
                  type="text"
                  value={billForm.name}
                  onChange={(event) => setBillForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Rent"
                />
              </label>

              <div className="quick-add-grid">
                <label>
                  Amount
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={billForm.amount}
                    onChange={(event) => setBillForm((current) => ({ ...current, amount: event.target.value }))}
                    placeholder="24000"
                  />
                </label>

                <label>
                  Due date
                  <input
                    type="date"
                    value={billForm.dueDate}
                    onChange={(event) => setBillForm((current) => ({ ...current, dueDate: event.target.value }))}
                  />
                </label>
              </div>

              <div className="quick-add-grid">
                <label>
                  Category
                  <select
                    value={billForm.category}
                    onChange={(event) => setBillForm((current) => ({ ...current, category: event.target.value }))}
                  >
                    <option value="Housing">Housing</option>
                    <option value="Utilities">Utilities</option>
                    <option value="Insurance">Insurance</option>
                    <option value="Food">Food</option>
                    <option value="Subscriptions">Subscriptions</option>
                  </select>
                </label>

                <label>
                  Accent color
                  <div className="color-row compact-row">
                    {['#CBA135', '#2E7D32', '#7C3AED', '#E76F51', '#38BDF8'].map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`color-swatch ${billForm.color === color ? 'selected' : ''}`}
                        style={{ background: color }}
                        onClick={() => setBillForm((current) => ({ ...current, color }))}
                        aria-label={`Select ${color}`}
                      />
                    ))}
                  </div>
                </label>
              </div>

              <button type="submit" className="primary-button auth-submit">
                Save bill
              </button>
            </form>
          </div>
        </div>
      )}

      {goalModalOpen && (
        <div className="auth-overlay" onClick={() => setGoalModalOpen(false)}>
          <div className="auth-modal" onClick={(event) => event.stopPropagation()}>
            <div className="auth-header">
              <div>
                <div className="eyebrow">Savings goals</div>
                <h2>Add a goal</h2>
              </div>
              <button type="button" className="icon-button" onClick={() => setGoalModalOpen(false)} aria-label="Close goal dialog">
                ✕
              </button>
            </div>

            <form className="auth-form" onSubmit={handleGoalAdd}>
              <label>
                Goal title
                <input
                  type="text"
                  value={goalForm.title}
                  onChange={(event) => setGoalForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Emergency fund"
                />
              </label>

              <div className="quick-add-grid">
                <label>
                  Goal amount
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={goalForm.amount}
                    onChange={(event) => setGoalForm((current) => ({ ...current, amount: event.target.value }))}
                    placeholder="250000"
                  />
                </label>

                <label>
                  Saved so far
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={goalForm.saved}
                    onChange={(event) => setGoalForm((current) => ({ ...current, saved: event.target.value }))}
                    placeholder="120000"
                  />
                </label>
              </div>

              <div className="quick-add-grid">
                <label>
                  Monthly contribution
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={goalForm.monthly}
                    onChange={(event) => setGoalForm((current) => ({ ...current, monthly: event.target.value }))}
                    placeholder="18000"
                  />
                </label>

                <label>
                  Target month
                  <input
                    type="text"
                    value={goalForm.date}
                    onChange={(event) => setGoalForm((current) => ({ ...current, date: event.target.value }))}
                    placeholder="Dec 2027"
                  />
                </label>
              </div>

              <label>
                Accent color
                <div className="color-row">
                  {['#2E7D32', '#CBA135', '#7C3AED', '#E76F51', '#38BDF8'].map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`color-swatch ${goalForm.color === color ? 'selected' : ''}`}
                      style={{ background: color }}
                      onClick={() => setGoalForm((current) => ({ ...current, color }))}
                      aria-label={`Select ${color}`}
                    />
                  ))}
                </div>
              </label>

              <button type="submit" className="primary-button auth-submit">
                Save goal
              </button>
            </form>
          </div>
        </div>
      )}

      {budgetModalOpen && (
        <div className="auth-overlay" onClick={() => setBudgetModalOpen(false)}>
          <div className="auth-modal" onClick={(event) => event.stopPropagation()}>
            <div className="auth-header">
              <div>
                <div className="eyebrow">Budget planner</div>
                <h2>Add a budget</h2>
              </div>
              <button type="button" className="icon-button" onClick={() => setBudgetModalOpen(false)} aria-label="Close budget dialog">
                ✕
              </button>
            </div>

            <form className="auth-form" onSubmit={handleBudgetAdd}>
              <label>
                Budget name
                <input
                  type="text"
                  value={budgetForm.name}
                  onChange={(event) => setBudgetForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Groceries"
                />
              </label>

              <div className="quick-add-grid">
                <label>
                  Monthly limit
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={budgetForm.limit}
                    onChange={(event) => setBudgetForm((current) => ({ ...current, limit: event.target.value }))}
                    placeholder="12000"
                  />
                </label>

                <label>
                  Current spent
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={budgetForm.spent}
                    onChange={(event) => setBudgetForm((current) => ({ ...current, spent: event.target.value }))}
                    placeholder="5000"
                  />
                </label>
              </div>

              <label>
                Accent color
                <div className="color-row">
                  {['#2E7D32', '#CBA135', '#7C3AED', '#E76F51', '#38BDF8'].map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`color-swatch ${budgetForm.color === color ? 'selected' : ''}`}
                      style={{ background: color }}
                      onClick={() => setBudgetForm((current) => ({ ...current, color }))}
                      aria-label={`Select ${color}`}
                    />
                  ))}
                </div>
              </label>

              <button type="submit" className="primary-button auth-submit">
                Save budget
              </button>
            </form>
          </div>
        </div>
      )}

      {quickAddOpen && (
        <div className="auth-overlay" onClick={() => setQuickAddOpen(false)}>
          <div className="auth-modal" onClick={(event) => event.stopPropagation()}>
            <div className="auth-header">
              <div>
                <div className="eyebrow">Quick add</div>
                <h2>Add a transaction</h2>
              </div>
              <button type="button" className="icon-button" onClick={() => setQuickAddOpen(false)} aria-label="Close quick add dialog">
                ✕
              </button>
            </div>

            <form className="auth-form" onSubmit={handleQuickAdd}>
              <label>
                Merchant
                <input
                  type="text"
                  value={quickAddForm.merchant}
                  onChange={(event) => setQuickAddForm((current) => ({ ...current, merchant: event.target.value }))}
                  placeholder="Zomato"
                />
              </label>

              <div className="quick-add-grid">
                <label>
                  Category
                  <select
                    value={quickAddForm.category}
                    onChange={(event) => setQuickAddForm((current) => ({ ...current, category: event.target.value }))}
                  >
                    <option value="Food">Food</option>
                    <option value="Travel">Travel</option>
                    <option value="Shopping">Shopping</option>
                    <option value="Housing">Housing</option>
                    <option value="Learning">Learning</option>
                    <option value="Savings">Savings</option>
                    <option value="Income">Income</option>
                  </select>
                </label>

                <label>
                  Type
                  <select
                    value={quickAddForm.type}
                    onChange={(event) => setQuickAddForm((current) => ({ ...current, type: event.target.value as Transaction['type'] }))}
                  >
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                    <option value="saving">Saving</option>
                  </select>
                </label>
              </div>

              <div className="quick-add-grid">
                <label>
                  Amount
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={quickAddForm.amount}
                    onChange={(event) => setQuickAddForm((current) => ({ ...current, amount: event.target.value }))}
                    placeholder="1200"
                  />
                </label>

                <label>
                  Date
                  <input
                    type="date"
                    value={quickAddForm.date}
                    onChange={(event) => setQuickAddForm((current) => ({ ...current, date: event.target.value }))}
                  />
                </label>
              </div>

              <button type="submit" className="primary-button auth-submit">
                Save transaction
              </button>
            </form>
          </div>
        </div>
      )}

      {authModalOpen && (
        <div className="auth-overlay" onClick={() => setAuthModalOpen(false)}>
          <div className="auth-modal" onClick={(event) => event.stopPropagation()}>
            <div className="auth-header">
              <div>
                <div className="eyebrow">Welcome back</div>
                <h2>Sign in to Artha</h2>
              </div>
              <button type="button" className="icon-button" onClick={() => setAuthModalOpen(false)} aria-label="Close sign-in dialog">
                ✕
              </button>
            </div>

            <div className="auth-alt-actions">
              <button type="button" className="primary-button auth-submit" onClick={() => void handleSignIn()} disabled={!authInitialized}>
                Continue with Google
              </button>
              {authError && <p className="auth-error" role="alert">{authError}</p>}
            </div>
          </div>
        </div>
      )}

      {resetModalOpen && (
        <div className="auth-overlay" onClick={() => setResetModalOpen(false)}>
          <div className="auth-modal" onClick={(event) => event.stopPropagation()}>
            <div className="auth-header">
              <div>
                <div className="eyebrow">Reset workspace</div>
                <h2>Delete all saved data?</h2>
              </div>
              <button type="button" className="icon-button" onClick={() => setResetModalOpen(false)} aria-label="Close reset dialog">
                ✕
              </button>
            </div>

            <div className="auth-form">
              <p>This will permanently remove all saved financial records, budgets, goals, bills, and account data.</p>
              <div className="auth-alt-actions">
                <button type="button" className="ghost-button" onClick={() => setResetModalOpen(false)}>
                  Cancel
                </button>
                <button type="button" className="primary-button auth-submit" onClick={handleResetData}>
                  Reset all data
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
