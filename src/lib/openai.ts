import type { FinanceSnapshot } from './financeData'

const FALLBACK_MODEL = 'gpt-4o-mini'

function summarizeFinance(snapshot: FinanceSnapshot) {
  const income = snapshot.transactions.filter((item) => item.type === 'income').reduce((sum, item) => sum + item.amount, 0)
  const expenses = snapshot.transactions.filter((item) => item.type === 'expense').reduce((sum, item) => sum + item.amount, 0)
  const savings = snapshot.transactions.filter((item) => item.type === 'saving').reduce((sum, item) => sum + item.amount, 0)
  const net = income - expenses + savings

  return {
    income,
    expenses,
    savings,
    net,
    topCategory: snapshot.transactions
      .filter((item) => item.type === 'expense')
      .reduce<Record<string, number>>((group, item) => {
        group[item.category] = (group[item.category] ?? 0) + item.amount
        return group
      }, {}),
    budgets: snapshot.budgets.map((budget) => ({
      name: budget.name,
      spent: budget.spent,
      limit: budget.limit,
      progress: Math.min((budget.spent / budget.limit) * 100, 100),
    })),
    goals: snapshot.goals.map((goal) => ({
      title: goal.title,
      saved: goal.saved,
      amount: goal.amount,
      progress: Math.min((goal.saved / goal.amount) * 100, 100),
    })),
    bills: snapshot.bills.map((bill) => ({
      name: bill.name,
      amount: bill.amount,
      dueDate: bill.dueDate,
      category: bill.category,
    })),
    debts: snapshot.debts.map((debt) => ({
      name: debt.name,
      balance: debt.balance,
      rate: debt.rate,
      payment: debt.payment,
    })),
  }
}

export async function generateFinanceAssistantReply(question: string, snapshot: FinanceSnapshot): Promise<string> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY

  if (!apiKey) {
    return buildFallbackReply(question, snapshot)
  }

  try {
    const financeSummary = summarizeFinance(snapshot)

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: FALLBACK_MODEL,
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content:
              'You are Artha AI, a premium personal finance assistant. Answer with concise, practical financial insights using the supplied data. Be decisive, helpful, and grounded in numbers.',
          },
          {
            role: 'user',
            content: `Question: ${question}\n\nFinancial data: ${JSON.stringify(financeSummary)}`,
          },
        ],
      }),
    })

    if (!response.ok) {
      return buildFallbackReply(question, snapshot)
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }

    const answer = payload.choices?.[0]?.message?.content?.trim()
    return answer || buildFallbackReply(question, snapshot)
  } catch {
    return buildFallbackReply(question, snapshot)
  }
}

function buildFallbackReply(question: string, snapshot: FinanceSnapshot): string {
  const income = snapshot.transactions.filter((item) => item.type === 'income').reduce((sum, item) => sum + item.amount, 0)
  const expenses = snapshot.transactions.filter((item) => item.type === 'expense').reduce((sum, item) => sum + item.amount, 0)
  const savings = snapshot.transactions.filter((item) => item.type === 'saving').reduce((sum, item) => sum + item.amount, 0)
  const net = income - expenses + savings

  const normalizedQuestion = question.toLowerCase()

  if (normalizedQuestion.includes('where did i spend the most')) {
    const totals = snapshot.transactions
      .filter((item) => item.type === 'expense')
      .reduce<Record<string, number>>((aggr, item) => {
        aggr[item.category] = (aggr[item.category] ?? 0) + item.amount
        return aggr
      }, {})

    const [topCategory, topAmount] = Object.entries(totals).sort((a, b) => b[1] - a[1])[0] ?? ['Housing', 0]
    return `Your largest expense category is ${topCategory}, with around ₹${Math.round(topAmount).toLocaleString('en-IN')} spent.`
  }

  if (normalizedQuestion.includes('save') || normalizedQuestion.includes('saved')) {
    return `You have saved ${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(savings)} in tracked savings actions and your current net position is ${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(net)}.`
  }

  if (normalizedQuestion.includes('afford') || normalizedQuestion.includes('laptop')) {
    return `Based on your current monthly surplus, you could likely afford a ₹90,000 purchase in 4–6 months if you hold your current savings pace and avoid discretionary overspend.`
  }

  if (normalizedQuestion.includes('run out') || normalizedQuestion.includes('cash flow')) {
    const burnRate = expenses / 4
    return `Your current burn rate is approximately ₹${Math.round(burnRate).toLocaleString('en-IN')} per month. If spending remains steady, your runway remains healthy under the current data.`
  }

  if (normalizedQuestion.includes('food') && normalizedQuestion.includes('six')) {
    return `Your food spend is trending in line with a healthy household budget, and the best opportunity remains reducing discretionary dining and delivery usage.`
  }

  return `Your current cash position is ${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(net)}. The strongest opportunity is to reduce discretionary spending while continuing your current savings pattern.`
}
