import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

// ---- Server API helpers ----
const API_BASE = '';

async function apiCall(path, options = {}) {
  const res = await fetch(API_BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  return res.json();
}

async function saveToServer(data) {
  try {
    await apiCall('/api/data', {
      method: 'POST',
      body: JSON.stringify({ data }),
    });
  } catch (e) {
    console.warn('保存到服务器失败', e);
  }
}

async function loadFromServer() {
  try {
    const result = await apiCall('/api/data');
    if (result.ok && result.data) {
      return { ok: true, data: result.data };
    }
    return { ok: false, error: result.error || '加载失败' };
  } catch (e) {
    return { ok: false, error: '无法连接服务器' };
  }
}

async function serverLogin(username, password) {
  try {
    const result = await apiCall('/api/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    return result;
  } catch (e) {
    return { ok: false, error: '无法连接服务器' };
  }
}

async function serverRegister(username, password) {
  try {
    const result = await apiCall('/api/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    return result;
  } catch (e) {
    return { ok: false, error: '无法连接服务器' };
  }
}

async function serverLogout() {
  try {
    await apiCall('/api/logout', { method: 'POST' });
  } catch (e) { /* ignore */ }
}

async function checkLoginStatus() {
  try {
    const result = await apiCall('/api/check');
    return result.logged_in ? result.username : null;
  } catch (e) {
    return null;
  }
}

const CN_MONTH = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit' });

const expenseCategories = ['餐饮', '交通', '购物', '住房', '娱乐', '学习', '医疗', '人情', '旅行', '其他'];
const incomeCategories = ['工资', '兼职', '奖金', '报销', '理财', '红包', '其他'];
const accountTypes = ['现金', '储蓄卡', '信用卡', '支付宝', '微信', '投资账户', '负债账户'];
const categoryIcon = {
  餐饮: '🍱', 交通: '🚌', 购物: '🛍️', 住房: '🏠', 娱乐: '🎮', 学习: '📚', 医疗: '💊', 人情: '🎁', 旅行: '🧳', 工资: '💼', 兼职: '🧰', 奖金: '🏆', 报销: '🧾', 理财: '📈', 红包: '🧧', 其他: '⭐'
};

function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function monthKey(date = today()) {
  return date.slice(0, 7);
}

function money(value) {
  return Number(value || 0).toLocaleString('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 2 });
}

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// ---------- user account system (server-side) ----------

const CURRENT_USER_KEY = 'pixel-ledger-current-user';

function getStoredUsername() {
  return sessionStorage.getItem(CURRENT_USER_KEY) || null;
}

function storeUsername(username) {
  sessionStorage.setItem(CURRENT_USER_KEY, username);
}

function clearStoredUsername() {
  sessionStorage.removeItem(CURRENT_USER_KEY);
}

async function registerUser(username, password) {
  const result = await serverRegister(username, password);
  return result;
}

async function loginUser(username, password) {
  const result = await serverLogin(username, password);
  return result;
}

// ----------------------------------------

function makeEmptyData() {
  return {
    version: 1,
    activeBookId: 'book_default',
    books: [
      { id: 'book_default', name: '个人账本', emoji: '🪙' }
    ],
    accounts: [
      { id: 'acc_cash', name: '现金', type: '现金', openingBalance: 0, color: '#ffd166' },
      { id: 'acc_alipay', name: '支付宝', type: '支付宝', openingBalance: 0, color: '#8ecae6' },
      { id: 'acc_wechat', name: '微信', type: '微信', openingBalance: 0, color: '#95d5b2' }
    ],
    records: [],
    budgets: {},
    goals: [],
    reminders: [],
    recurring: [],
    settings: {
      passcodeEnabled: false,
      clearFont: true,
      pixelDensity: '舒适',
      currency: 'CNY'
    }
  };
}

function makeDemoData() {
  const now = new Date();
  const thisMonth = now.toISOString().slice(0, 7);
  const day = (d) => `${thisMonth}-${String(d).padStart(2, '0')}`;
  const accounts = [
    { id: 'acc_cash', name: '现金口袋', type: '现金', openingBalance: 680, color: '#ffd166' },
    { id: 'acc_alipay', name: '支付宝', type: '支付宝', openingBalance: 4200, color: '#8ecae6' },
    { id: 'acc_wechat', name: '微信钱包', type: '微信', openingBalance: 1260, color: '#95d5b2' },
    { id: 'acc_card', name: '信用卡', type: '信用卡', openingBalance: -1280, color: '#ffafcc' },
    { id: 'acc_save', name: '梦想储蓄罐', type: '储蓄卡', openingBalance: 12000, color: '#cdb4db' }
  ];
  const records = [
    { id: uid('rec'), bookId: 'book_default', type: 'expense', amount: 36, category: '餐饮', accountId: 'acc_alipay', date: day(1), note: '午餐套餐', tags: ['日常'] },
    { id: uid('rec'), bookId: 'book_default', type: 'expense', amount: 128, category: '交通', accountId: 'acc_wechat', date: day(2), note: '地铁月卡充值', tags: ['通勤'] },
    { id: uid('rec'), bookId: 'book_default', type: 'income', amount: 8600, category: '工资', accountId: 'acc_alipay', date: day(3), note: '月工资到账', tags: ['固定收入'] },
    { id: uid('rec'), bookId: 'book_default', type: 'expense', amount: 299, category: '购物', accountId: 'acc_card', date: day(4), note: '键盘配件', tags: ['数码'] },
    { id: uid('rec'), bookId: 'book_default', type: 'expense', amount: 1680, category: '住房', accountId: 'acc_alipay', date: day(5), note: '房租', tags: ['固定支出'] },
    { id: uid('rec'), bookId: 'book_default', type: 'income', amount: 450, category: '兼职', accountId: 'acc_wechat', date: day(6), note: '设计稿结算', tags: ['副业'] },
    { id: uid('rec'), bookId: 'book_default', type: 'expense', amount: 78, category: '娱乐', accountId: 'acc_wechat', date: day(8), note: '电影票', tags: ['周末'] },
    { id: uid('rec'), bookId: 'book_default', type: 'transfer', amount: 1000, fromAccountId: 'acc_alipay', toAccountId: 'acc_save', date: day(10), note: '转入储蓄罐', tags: ['存钱'] },
    { id: uid('rec'), bookId: 'book_default', type: 'expense', amount: 56, category: '学习', accountId: 'acc_cash', date: day(11), note: '资料打印', tags: ['学习'] },
    { id: uid('rec'), bookId: 'book_default', type: 'expense', amount: 212, category: '医疗', accountId: 'acc_alipay', date: day(12), note: '药品', tags: ['健康'] },
    { id: uid('rec'), bookId: 'book_default', type: 'expense', amount: 108, category: '餐饮', accountId: 'acc_wechat', date: day(13), note: '朋友聚餐', tags: ['社交'] }
  ];

  return {
    version: 1,
    activeBookId: 'book_default',
    books: [
      { id: 'book_default', name: '个人账本', emoji: '🪙' },
      { id: 'book_family', name: '家庭账本', emoji: '🏡' },
      { id: 'book_trip', name: '旅行账本', emoji: '🧳' }
    ],
    accounts,
    records,
    budgets: {
      [thisMonth]: {
        total: 4500,
        categories: { 餐饮: 1200, 交通: 400, 购物: 800, 娱乐: 500, 学习: 300, 医疗: 500, 住房: 2000 }
      }
    },
    goals: [
      { id: uid('goal'), name: '买一台新平板', target: 5000, saved: 1800, due: `${now.getFullYear()}-12-31`, emoji: '📱' },
      { id: uid('goal'), name: '旅行基金', target: 8000, saved: 2600, due: `${now.getFullYear()}-10-01`, emoji: '🧳' }
    ],
    reminders: [
      { id: uid('rem'), text: '每天 21:30 检查今日消费', time: '21:30', enabled: true },
      { id: uid('rem'), text: '每月 1 日设置预算', time: '09:00', enabled: true }
    ],
    recurring: [
      { id: uid('rule'), title: '房租', type: 'expense', amount: 1680, category: '住房', accountId: 'acc_alipay', day: 5, enabled: true },
      { id: uid('rule'), title: '工资', type: 'income', amount: 8600, category: '工资', accountId: 'acc_alipay', day: 3, enabled: true }
    ],
    settings: {
      passcodeEnabled: false,
      clearFont: true,
      pixelDensity: '舒适',
      currency: 'CNY'
    }
  };
}

async function loadData(username) {
  if (!username) {
    return username === 'admin' ? makeDemoData() : makeEmptyData();
  }
  const result = await loadFromServer();
  if (result.ok && result.data && result.data.records) {
    return { ...makeEmptyData(), ...result.data };
  }
  // If server has no data, return empty or demo data
  console.warn('从服务器加载数据失败，使用空白数据', result.error);
  return username === 'admin' ? makeDemoData() : makeEmptyData();
}

function downloadFile(name, content, type = 'application/json') {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

// ----------------------------------------

function recordsByBook(data) {
  return data.records.filter((r) => r.bookId === data.activeBookId);
}

function accountsWithBalance(accounts, records) {
  return accounts.map((account) => {
    const delta = records.reduce((sum, record) => {
      if (record.type === 'income' && record.accountId === account.id) return sum + safeNumber(record.amount);
      if (record.type === 'expense' && record.accountId === account.id) return sum - safeNumber(record.amount);
      if (record.type === 'transfer' && record.fromAccountId === account.id) return sum - safeNumber(record.amount);
      if (record.type === 'transfer' && record.toAccountId === account.id) return sum + safeNumber(record.amount);
      return sum;
    }, 0);
    return { ...account, balance: safeNumber(account.openingBalance) + delta };
  });
}

function calcSummary(records, month = monthKey()) {
  const monthRecords = records.filter((r) => r.date?.startsWith(month));
  const income = monthRecords.filter((r) => r.type === 'income').reduce((s, r) => s + safeNumber(r.amount), 0);
  const expense = monthRecords.filter((r) => r.type === 'expense').reduce((s, r) => s + safeNumber(r.amount), 0);
  return { income, expense, balance: income - expense, monthRecords };
}

function groupExpense(records, month = monthKey()) {
  const map = new Map();
  records.filter((r) => r.type === 'expense' && r.date?.startsWith(month)).forEach((r) => {
    map.set(r.category, (map.get(r.category) || 0) + safeNumber(r.amount));
  });
  return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

function monthlyTrend(records, months = 6) {
  const now = new Date();
  const result = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toISOString().slice(0, 7);
    const one = records.filter((r) => r.date?.startsWith(key));
    result.push({
      key,
      label: `${d.getMonth() + 1}月`,
      income: one.filter((r) => r.type === 'income').reduce((s, r) => s + safeNumber(r.amount), 0),
      expense: one.filter((r) => r.type === 'expense').reduce((s, r) => s + safeNumber(r.amount), 0)
    });
  }
  return result;
}

function Button({ children, onClick, type = 'button', variant = 'primary', disabled, className = '' }) {
  return <button type={type} onClick={onClick} disabled={disabled} className={`pixel-btn ${variant} ${className}`}>{children}</button>;
}

function Panel({ title, action, children, className = '' }) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-head">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value, hint, tone = '' }) {
  return (
    <div className={`stat-card ${tone}`}>
      <span className="stat-label">{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </div>
  );
}

function Progress({ value, max, label }) {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="progress-wrap">
      <div className="progress-meta"><span>{label}</span><b>{percent}%</b></div>
      <div className="progress"><i style={{ width: `${percent}%` }} /></div>
    </div>
  );
}

function TinyBarChart({ data, valueKey = 'value', labelKey = 'name' }) {
  const max = Math.max(1, ...data.map((d) => safeNumber(d[valueKey])));
  if (!data.length) return <p className="empty">暂无数据，先记一笔账吧。</p>;
  return (
    <div className="bar-list">
      {data.slice(0, 8).map((d) => (
        <div className="bar-row" key={d[labelKey]}>
          <span>{categoryIcon[d[labelKey]] || '▣'} {d[labelKey]}</span>
          <div><i style={{ width: `${Math.max(8, (safeNumber(d[valueKey]) / max) * 100)}%` }} /></div>
          <b>{money(d[valueKey])}</b>
        </div>
      ))}
    </div>
  );
}

function PixelLineChart({ data }) {
  const max = Math.max(1, ...data.flatMap((d) => [d.income, d.expense]));
  const w = 620;
  const h = 190;
  const pad = 28;
  const step = (w - pad * 2) / Math.max(1, data.length - 1);
  const pathFor = (key) => data.map((d, i) => {
    const x = pad + i * step;
    const y = h - pad - (safeNumber(d[key]) / max) * (h - pad * 2);
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');
  return (
    <div className="chart-card">
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="月度趋势图">
        {[0, 1, 2, 3].map((g) => <line key={g} x1={pad} x2={w - pad} y1={pad + g * 42} y2={pad + g * 42} className="grid" />)}
        <path className="line income" d={pathFor('income')} />
        <path className="line expense" d={pathFor('expense')} />
        {data.map((d, i) => {
          const x = pad + i * step;
          return <text key={d.key} x={x} y={h - 5} textAnchor="middle" className="axis">{d.label}</text>;
        })}
      </svg>
      <div className="legend"><span className="legend-income">收入</span><span className="legend-expense">支出</span></div>
    </div>
  );
}

function PixelMascot() {
  return (
    <div className="mascot" aria-hidden="true">
      <span className="ear left" /><span className="ear right" />
      <span className="eye left" /><span className="eye right" />
      <span className="coin" />
    </div>
  );
}

// ---------- login / register page ----------

function LoginPage({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    const u = username.trim();
    const p = password.trim();
    if (!u || !p) { setError('请输入用户名和密码'); return; }
    if (u.length < 2 || u.length > 20) { setError('用户名长度 2-20 个字符'); return; }
    if (p.length < 3) { setError('密码至少 3 个字符'); return; }

    if (mode === 'register') {
      const result = await registerUser(u, p);
      if (!result.ok) { setError(result.error); return; }
      setSuccess('注册成功！');
      setTimeout(() => onLogin(u), 800);
    } else {
      const result = await loginUser(u, p);
      if (!result.ok) { setError(result.error); return; }
      onLogin(u);
    }
  }

  return (
    <div className="login-overlay">
      <div className="login-card">
        <div className="login-brand">
          <div className="brand-icon">₿</div>
          <div>
            <b>Pixel Ledger</b>
            <small>像素记账系统</small>
          </div>
        </div>
        <div className="login-tabs">
          <button className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError(''); setSuccess(''); }}>登录</button>
          <button className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setError(''); setSuccess(''); }}>注册</button>
        </div>
        <form onSubmit={handleSubmit} className="login-form">
          <label>用户名
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="输入用户名" autoFocus />
          </label>
          <label>密码
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="输入密码" />
          </label>
          {error && <p className="login-msg error">{error}</p>}
          {success && <p className="login-msg success">{success}</p>}
          <Button type="submit" className="login-btn">
            {mode === 'register' ? '注册新账号' : '登入系统'}
          </Button>
        </form>
        <p className="login-hint">
          {mode === 'register'
            ? '已有账号？切换到「登录」标签。如浏览器中已有记账数据，注册时将自动迁移到新账号。'
            : '数据存储在浏览器本地，不同账号之间数据完全隔离。'}
        </p>
      </div>
    </div>
  );
}

// ---------- site gate ----------

function SiteGate({ onUnlock }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    const p = password.trim();
    if (!p) { setError('请输入访问密码'); return; }
    if (hashPassword(p) === SITE_PASSWORD_HASH) {
      sessionStorage.setItem(SITE_UNLOCK_KEY, '1');
      onUnlock();
    } else {
      setError('密码错误，请重试');
      setPassword('');
    }
  }

  return (
    <div className="login-overlay">
      <div className="login-card">
        <div className="login-brand">
          <div className="brand-icon">₿</div>
          <div>
            <b>Pixel Ledger</b>
            <small>像素记账系统</small>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="login-form">
          <label>网站访问密码
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="请输入访问密码" autoFocus />
          </label>
          {error && <p className="login-msg error">{error}</p>}
          <Button type="submit" className="login-btn">验证进入</Button>
        </form>
        <p className="login-hint">本站需要密码才能访问。请输入正确的访问密码。</p>
      </div>
    </div>
  );
}

// ---------- app pages ----------

function Dashboard({ data, setTab }) {
  const records = recordsByBook(data);
  const activeBook = data.books.find((b) => b.id === data.activeBookId) || data.books[0];
  const currentMonth = monthKey();
  const summary = calcSummary(records, currentMonth);
  const monthBudget = data.budgets[currentMonth]?.total || 0;
  const categoryData = groupExpense(records, currentMonth);
  const trend = monthlyTrend(records);
  const balances = accountsWithBalance(data.accounts, records);
  const netAssets = balances.reduce((s, a) => s + safeNumber(a.balance), 0);
  const budgetText = monthBudget ? `本月预算剩余 ${money(Math.max(0, monthBudget - summary.expense))}` : '未设置本月预算';

  return (
    <div className="page-grid">
      <Panel title={`${activeBook.emoji} ${activeBook.name} · 本月总览`} action={<Button onClick={() => setTab('add')}>+ 快速记账</Button>} className="hero-panel">
        <div className="hero">
          <div>
            <p className="eyebrow">Pixel Ledger OS</p>
            <h1>把每一枚金币都放回地图上</h1>
            <p>像素风界面，清晰中文字体；支持账本、分类、预算、资产、图表、导入导出和定时记账规则。</p>
            <div className="hero-actions">
              <Button onClick={() => setTab('records')}>查看流水</Button>
              <Button variant="ghost" onClick={() => setTab('reports')}>分析报表</Button>
            </div>
          </div>
          <PixelMascot />
        </div>
      </Panel>

      <div className="stats-grid">
        <Stat label="本月收入" value={money(summary.income)} hint="Income" tone="good" />
        <Stat label="本月支出" value={money(summary.expense)} hint="Expense" tone="warn" />
        <Stat label="本月结余" value={money(summary.balance)} hint={budgetText} tone={summary.balance >= 0 ? 'good' : 'danger'} />
        <Stat label="净资产" value={money(netAssets)} hint={`${balances.length} 个账户`} />
      </div>

      <Panel title="预算进度">
        <Progress value={summary.expense} max={monthBudget || Math.max(summary.expense, 1)} label={`${currentMonth} 总预算`} />
        <div className="budget-strip">
          {(Object.entries(data.budgets[currentMonth]?.categories || {}).slice(0, 5)).map(([cat, amount]) => {
            const spent = categoryData.find((d) => d.name === cat)?.value || 0;
            return <Progress key={cat} value={spent} max={amount} label={`${categoryIcon[cat] || ''} ${cat}`} />;
          })}
        </div>
      </Panel>

      <Panel title="支出分类排行">
        <TinyBarChart data={categoryData} />
      </Panel>

      <Panel title="6个月趋势" className="wide">
        <PixelLineChart data={trend} />
      </Panel>

      <Panel title="最近流水">
        <RecordListMini records={records.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6)} accounts={data.accounts} />
      </Panel>
    </div>
  );
}

function RecordListMini({ records, accounts }) {
  if (!records.length) return <p className="empty">暂无流水。</p>;
  const accountName = (id) => accounts.find((a) => a.id === id)?.name || '未知账户';
  return (
    <div className="record-list mini">
      {records.map((r) => (
        <div className="record-card" key={r.id}>
          <div className={`record-icon ${r.type}`}>{r.type === 'income' ? '↑' : r.type === 'expense' ? '↓' : '↔'}</div>
          <div>
            <b>{r.type === 'transfer' ? '账户转账' : `${categoryIcon[r.category] || ''} ${r.category}`}</b>
            <small>{r.date} · {r.type === 'transfer' ? `${accountName(r.fromAccountId)} → ${accountName(r.toAccountId)}` : accountName(r.accountId)} · {r.note || '无备注'}</small>
          </div>
          <strong className={r.type}>{r.type === 'expense' ? '-' : r.type === 'income' ? '+' : ''}{money(r.amount)}</strong>
        </div>
      ))}
    </div>
  );
}

function EntryForm({ data, onSave, editing, onCancel }) {
  const [form, setForm] = useState(() => editing || {
    id: uid('rec'), bookId: data.activeBookId, type: 'expense', amount: '', category: '餐饮', accountId: data.accounts[0]?.id || '', fromAccountId: data.accounts[0]?.id || '', toAccountId: data.accounts[1]?.id || data.accounts[0]?.id || '', date: today(), note: '', tags: []
  });
  const [tagText, setTagText] = useState((editing?.tags || []).join('，'));
  const categories = form.type === 'income' ? incomeCategories : expenseCategories;

  useEffect(() => {
    if (form.type === 'income' && !incomeCategories.includes(form.category)) setForm((f) => ({ ...f, category: incomeCategories[0] }));
    if (form.type === 'expense' && !expenseCategories.includes(form.category)) setForm((f) => ({ ...f, category: expenseCategories[0] }));
  }, [form.type]);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function submit(e) {
    e.preventDefault();
    const amount = safeNumber(form.amount);
    if (amount <= 0) return alert('金额必须大于 0');
    const clean = {
      ...form,
      amount,
      bookId: data.activeBookId,
      tags: tagText.split(/[，,\s]+/).map((t) => t.trim()).filter(Boolean)
    };
    if (clean.type === 'transfer' && clean.fromAccountId === clean.toAccountId) return alert('转出账户和转入账户不能相同');
    onSave(clean);
  }

  return (
    <Panel title={editing ? '编辑流水' : '新增一笔账'} className="form-panel">
      <form className="entry-form" onSubmit={submit}>
        <div className="segmented">
          {[
            ['expense', '支出'], ['income', '收入'], ['transfer', '转账']
          ].map(([key, label]) => <button type="button" key={key} onClick={() => update('type', key)} className={form.type === key ? 'active' : ''}>{label}</button>)}
        </div>

        <label>金额
          <input value={form.amount} onChange={(e) => update('amount', e.target.value)} inputMode="decimal" placeholder="例如 32.50" autoFocus />
        </label>

        {form.type !== 'transfer' ? (
          <>
            <label>分类
              <select value={form.category} onChange={(e) => update('category', e.target.value)}>
                {categories.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label>账户
              <select value={form.accountId} onChange={(e) => update('accountId', e.target.value)}>
                {data.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
          </>
        ) : (
          <div className="two-cols">
            <label>转出账户
              <select value={form.fromAccountId} onChange={(e) => update('fromAccountId', e.target.value)}>
                {data.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
            <label>转入账户
              <select value={form.toAccountId} onChange={(e) => update('toAccountId', e.target.value)}>
                {data.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
          </div>
        )}

        <div className="two-cols">
          <label>日期
            <input type="date" value={form.date} onChange={(e) => update('date', e.target.value)} />
          </label>
          <label>标签
            <input value={tagText} onChange={(e) => setTagText(e.target.value)} placeholder="逗号分隔，如 通勤,固定" />
          </label>
        </div>

        <label>备注
          <textarea value={form.note} onChange={(e) => update('note', e.target.value)} placeholder="记录原因、商家、小票编号等" />
        </label>

        <div className="form-actions">
          <Button type="submit">{editing ? '保存修改' : '保存流水'}</Button>
          {onCancel && <Button variant="ghost" onClick={onCancel}>取消</Button>}
        </div>
      </form>
    </Panel>
  );
}

function AddPage({ data, setData }) {
  function save(record) {
    setData((prev) => ({ ...prev, records: [record, ...prev.records] }));
    alert('已保存一笔账');
  }
  return (
    <div className="page-grid one">
      <EntryForm data={data} onSave={save} />
      <Panel title="快速分类键盘">
        <div className="quick-cats">
          {expenseCategories.map((c) => <span key={c}>{categoryIcon[c]} {c}</span>)}
        </div>
        <p className="hint">后续升级小程序/App 时，这里可替换为底部弹出式数字键盘和扫码/OCR/语音入口。</p>
      </Panel>
    </div>
  );
}

function RecordsPage({ data, setData }) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const [month, setMonth] = useState(monthKey());
  const [editing, setEditing] = useState(null);
  const bookRecords = recordsByBook(data);
  const accounts = data.accounts;
  const filtered = bookRecords.filter((r) => {
    const text = `${r.category || ''} ${r.note || ''} ${(r.tags || []).join(' ')}`;
    return (!query || text.toLowerCase().includes(query.toLowerCase())) && (type === 'all' || r.type === type) && (!month || r.date?.startsWith(month));
  }).sort((a, b) => b.date.localeCompare(a.date));

  function saveEdit(record) {
    setData((prev) => ({ ...prev, records: prev.records.map((r) => r.id === record.id ? record : r) }));
    setEditing(null);
  }
  function remove(id) {
    if (!confirm('确定删除这条流水吗？')) return;
    setData((prev) => ({ ...prev, records: prev.records.filter((r) => r.id !== id) }));
  }

  return (
    <div className="page-grid one">
      {editing && <EntryForm data={data} editing={editing} onSave={saveEdit} onCancel={() => setEditing(null)} />}
      <Panel title="流水检索与管理" action={<Button variant="ghost" onClick={() => setMonth('')}>全部月份</Button>}>
        <div className="filters">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索分类、备注、标签" />
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="all">全部类型</option><option value="expense">支出</option><option value="income">收入</option><option value="transfer">转账</option>
          </select>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
        <div className="record-list">
          {filtered.length ? filtered.map((r) => <RecordRow key={r.id} r={r} accounts={accounts} onEdit={() => setEditing(r)} onDelete={() => remove(r.id)} />) : <p className="empty">没有匹配流水。</p>}
        </div>
      </Panel>
    </div>
  );
}

function RecordRow({ r, accounts, onEdit, onDelete }) {
  const accountName = (id) => accounts.find((a) => a.id === id)?.name || '未知账户';
  return (
    <div className="record-card detailed">
      <div className={`record-icon ${r.type}`}>{r.type === 'income' ? '↑' : r.type === 'expense' ? '↓' : '↔'}</div>
      <div>
        <b>{r.type === 'transfer' ? '账户转账' : `${categoryIcon[r.category] || ''} ${r.category}`}</b>
        <small>{r.date} · {r.type === 'transfer' ? `${accountName(r.fromAccountId)} → ${accountName(r.toAccountId)}` : accountName(r.accountId)} · {r.note || '无备注'}</small>
        {!!r.tags?.length && <div className="tags">{r.tags.map((t) => <span key={t}>#{t}</span>)}</div>}
      </div>
      <strong className={r.type}>{r.type === 'expense' ? '-' : r.type === 'income' ? '+' : ''}{money(r.amount)}</strong>
      <div className="row-actions"><button onClick={onEdit}>编辑</button><button onClick={onDelete}>删除</button></div>
    </div>
  );
}

function BudgetPage({ data, setData }) {
  const [month, setMonth] = useState(monthKey());
  const current = data.budgets[month] || { total: 0, categories: {} };
  const records = recordsByBook(data);
  const spent = calcSummary(records, month).expense;
  const cats = groupExpense(records, month);
  const [goalForm, setGoalForm] = useState({ name: '', target: '', saved: '', due: '', emoji: '🎯' });

  function updateBudget(key, value) {
    setData((prev) => ({
      ...prev,
      budgets: {
        ...prev.budgets,
        [month]: { ...current, [key]: safeNumber(value) }
      }
    }));
  }
  function updateCat(cat, value) {
    setData((prev) => ({
      ...prev,
      budgets: {
        ...prev.budgets,
        [month]: { ...current, categories: { ...current.categories, [cat]: safeNumber(value) } }
      }
    }));
  }
  function addGoal(e) {
    e.preventDefault();
    if (!goalForm.name || safeNumber(goalForm.target) <= 0) return alert('请填写目标名称和目标金额');
    setData((prev) => ({ ...prev, goals: [{ ...goalForm, id: uid('goal'), target: safeNumber(goalForm.target), saved: safeNumber(goalForm.saved) }, ...prev.goals] }));
    setGoalForm({ name: '', target: '', saved: '', due: '', emoji: '🎯' });
  }

  return (
    <div className="page-grid">
      <Panel title="月度预算">
        <div className="filters">
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          <input value={current.total || ''} onChange={(e) => updateBudget('total', e.target.value)} placeholder="总预算" inputMode="decimal" />
        </div>
        <Progress value={spent} max={current.total || spent || 1} label={`${month} 已用 ${money(spent)} / ${money(current.total || 0)}`} />
        <TinyBarChart data={cats} />
      </Panel>
      <Panel title="分类预算">
        <div className="budget-editor">
          {expenseCategories.map((cat) => {
            const used = cats.find((d) => d.name === cat)?.value || 0;
            return (
              <div key={cat} className="cat-budget">
                <span>{categoryIcon[cat]} {cat}</span>
                <input value={current.categories?.[cat] || ''} onChange={(e) => updateCat(cat, e.target.value)} placeholder="预算" inputMode="decimal" />
                <small>已用 {money(used)}</small>
              </div>
            );
          })}
        </div>
      </Panel>
      <Panel title="存钱计划" className="wide">
        <form className="goal-form" onSubmit={addGoal}>
          <input value={goalForm.emoji} onChange={(e) => setGoalForm({ ...goalForm, emoji: e.target.value })} placeholder="图标" />
          <input value={goalForm.name} onChange={(e) => setGoalForm({ ...goalForm, name: e.target.value })} placeholder="目标名称" />
          <input value={goalForm.target} onChange={(e) => setGoalForm({ ...goalForm, target: e.target.value })} placeholder="目标金额" />
          <input value={goalForm.saved} onChange={(e) => setGoalForm({ ...goalForm, saved: e.target.value })} placeholder="已存" />
          <input type="date" value={goalForm.due} onChange={(e) => setGoalForm({ ...goalForm, due: e.target.value })} />
          <Button type="submit">添加目标</Button>
        </form>
        <div className="goal-grid">
          {data.goals.map((g) => <div className="goal-card" key={g.id}><b>{g.emoji} {g.name}</b><Progress value={g.saved} max={g.target} label={`${money(g.saved)} / ${money(g.target)}`} /><small>截止：{g.due || '未设置'}</small></div>)}
        </div>
      </Panel>
    </div>
  );
}

function AssetsPage({ data, setData }) {
  const records = recordsByBook(data);
  const balances = accountsWithBalance(data.accounts, records);
  const [form, setForm] = useState({ name: '', type: '储蓄卡', openingBalance: 0, color: '#ffd166' });
  const [adjust, setAdjust] = useState(null);
  const assets = balances.filter((a) => a.balance >= 0).reduce((s, a) => s + a.balance, 0);
  const liabilities = Math.abs(balances.filter((a) => a.balance < 0).reduce((s, a) => s + a.balance, 0));

  function addAccount(e) {
    e.preventDefault();
    if (!form.name) return alert('请输入账户名称');
    setData((prev) => ({ ...prev, accounts: [...prev.accounts, { ...form, id: uid('acc'), openingBalance: safeNumber(form.openingBalance) }] }));
    setForm({ name: '', type: '储蓄卡', openingBalance: 0, color: '#ffd166' });
  }
  function removeAccount(id) {
    if (data.records.some((r) => r.accountId === id || r.fromAccountId === id || r.toAccountId === id)) return alert('该账户已有流水，不能直接删除。请先删除相关流水或后续做归档。');
    setData((prev) => ({ ...prev, accounts: prev.accounts.filter((a) => a.id !== id) }));
  }

  function startAdjust(accountId, direction) {
    setAdjust({ accountId, direction, amount: '' });
  }
  function submitAdjust() {
    if (!adjust) return;
    const amt = safeNumber(adjust.amount);
    if (amt <= 0) return alert('金额必须大于 0');
    const record = {
      id: uid('rec'),
      bookId: data.activeBookId,
      type: adjust.direction === 'add' ? 'income' : 'expense',
      amount: amt,
      category: '其他',
      accountId: adjust.accountId,
      date: today(),
      note: adjust.direction === 'add' ? '余额调增' : '余额调减',
      tags: ['余额调整']
    };
    setData((prev) => ({ ...prev, records: [record, ...prev.records] }));
    setAdjust(null);
  }

  return (
    <div className="page-grid">
      <Panel title="资产负债总览" className="wide">
        <div className="stats-grid small">
          <Stat label="资产" value={money(assets)} hint="余额为正的账户" tone="good" />
          <Stat label="负债" value={money(liabilities)} hint="信用卡/贷款等" tone="danger" />
          <Stat label="净资产" value={money(assets - liabilities)} hint="资产 - 负债" />
        </div>
        <div className="account-grid">
          {balances.map((a) => {
            const isAdjusting = adjust?.accountId === a.id;
            return (
              <div className="account-card" key={a.id} style={{ '--card-color': a.color }}>
                <b>{a.name}</b><span>{a.type}</span><strong>{money(a.balance)}</strong>
                <div className="account-actions">
                  <button onClick={() => startAdjust(a.id, 'add')} title="余额调增">+ 调整</button>
                  <button onClick={() => startAdjust(a.id, 'subtract')} title="余额调减">- 调整</button>
                  <button onClick={() => removeAccount(a.id)}>删除</button>
                </div>
                {isAdjusting && (
                  <div className="adjust-inline">
                    <input value={adjust.amount} onChange={(e) => setAdjust({ ...adjust, amount: e.target.value })} placeholder="金额" inputMode="decimal" autoFocus onKeyDown={(e) => e.key === 'Enter' && submitAdjust()} />
                    <button onClick={submitAdjust}>确认{adjust.direction === 'add' ? '增加' : '减少'}</button>
                    <button onClick={() => setAdjust(null)}>取消</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Panel>
      <Panel title="新增账户">
        <form className="entry-form" onSubmit={addAccount}>
          <label>名称<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="例如 招商储蓄卡" /></label>
          <label>类型<select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{accountTypes.map((t) => <option key={t}>{t}</option>)}</select></label>
          <label>初始余额<input value={form.openingBalance} onChange={(e) => setForm({ ...form, openingBalance: e.target.value })} inputMode="decimal" /></label>
          <label>卡片颜色<input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /></label>
          <Button type="submit">添加账户</Button>
        </form>
      </Panel>
    </div>
  );
}

function ReportsPage({ data }) {
  const records = recordsByBook(data);
  const trend = monthlyTrend(records, 8);
  const currentMonth = monthKey();
  const cats = groupExpense(records, currentMonth);
  const summary = calcSummary(records, currentMonth);
  const largest = records.filter((r) => r.type === 'expense').sort((a, b) => b.amount - a.amount).slice(0, 5);
  const budget = data.budgets[currentMonth]?.total || 0;
  const budgetRate = budget ? Math.round(summary.expense / budget * 100) : 0;

  return (
    <div className="page-grid">
      <Panel title="分析洞察" className="wide">
        <div className="insight-grid">
          <div className="insight"><b>预算风险</b><p>{budget ? `本月预算已使用 ${budgetRate}%。${budgetRate > 90 ? '建议减少非必要支出。' : '目前仍在可控范围。'}` : '尚未设置本月预算。'}</p></div>
          <div className="insight"><b>最高支出分类</b><p>{cats[0] ? `${cats[0].name} 占本月支出 ${Math.round(cats[0].value / Math.max(summary.expense, 1) * 100)}%。` : '暂无支出数据。'}</p></div>
          <div className="insight"><b>记账完整度</b><p>本月已有 {summary.monthRecords.length} 条流水，可结合提醒和定时记账减少漏记。</p></div>
        </div>
      </Panel>
      <Panel title="趋势图" className="wide"><PixelLineChart data={trend} /></Panel>
      <Panel title="分类支出"><TinyBarChart data={cats} /></Panel>
      <Panel title="大额支出 Top 5"><RecordListMini records={largest} accounts={data.accounts} /></Panel>
    </div>
  );
}

function SettingsPage({ data, setData, username, onLogout }) {
  const [bookName, setBookName] = useState('');
  const [reminder, setReminder] = useState({ text: '', time: '21:30' });
  const [rule, setRule] = useState({ title: '', type: 'expense', amount: '', category: '餐饮', accountId: data.accounts[0]?.id || '', day: 1, enabled: true });

  function exportJson() {
    downloadFile(`pixel-ledger-${today()}.json`, JSON.stringify(data, null, 2), 'application/json;charset=utf-8');
  }
  function exportCsv() {
    const header = ['id', 'bookId', 'type', 'amount', 'category', 'accountId', 'fromAccountId', 'toAccountId', 'date', 'note', 'tags'];
    const rows = data.records.map((r) => header.map((h) => Array.isArray(r[h]) ? r[h].join('|') : (r[h] ?? '')).map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
    downloadFile(`pixel-ledger-records-${today()}.csv`, [header.join(','), ...rows].join('\n'), 'text/csv;charset=utf-8');
  }
  function importJson(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const next = JSON.parse(reader.result);
        if (!next.records || !next.accounts) throw new Error('数据结构不完整');
        setData(next);
        alert('导入成功');
      } catch (err) {
        alert(`导入失败：${err.message}`);
      }
    };
    reader.readAsText(file);
  }
  function addBook() {
    if (!bookName.trim()) return;
    const book = { id: uid('book'), name: bookName.trim(), emoji: '📒' };
    setData((prev) => ({ ...prev, books: [...prev.books, book], activeBookId: book.id }));
    setBookName('');
  }
  function addReminder(e) {
    e.preventDefault();
    if (!reminder.text) return;
    setData((prev) => ({ ...prev, reminders: [{ id: uid('rem'), ...reminder, enabled: true }, ...prev.reminders] }));
    setReminder({ text: '', time: '21:30' });
  }
  function addRule(e) {
    e.preventDefault();
    if (!rule.title || safeNumber(rule.amount) <= 0) return;
    setData((prev) => ({ ...prev, recurring: [{ id: uid('rule'), ...rule, amount: safeNumber(rule.amount), day: Math.min(28, Math.max(1, Number(rule.day) || 1)) }, ...prev.recurring] }));
    setRule({ title: '', type: 'expense', amount: '', category: '餐饮', accountId: data.accounts[0]?.id || '', day: 1, enabled: true });
  }
  function runRecurring() {
    const m = monthKey();
    const generated = data.recurring.filter((r) => r.enabled).map((r) => ({
      id: uid('rec'), bookId: data.activeBookId, type: r.type, amount: r.amount, category: r.category,
      accountId: r.accountId, date: `${m}-${String(r.day).padStart(2, '0')}`, note: `定时记账：${r.title}`, tags: ['自动']
    })).filter((r) => !data.records.some((old) => old.note === r.note && old.date === r.date && old.amount === r.amount));
    if (!generated.length) return alert('本月没有新的定时流水需要生成');
    setData((prev) => ({ ...prev, records: [...generated, ...prev.records] }));
    alert(`已生成 ${generated.length} 条定时流水`);
  }

  return (
    <div className="page-grid">
      <Panel title="账本与数据">
        <label className="inline-label">当前账本
          <select value={data.activeBookId} onChange={(e) => setData((prev) => ({ ...prev, activeBookId: e.target.value }))}>{data.books.map((b) => <option key={b.id} value={b.id}>{b.emoji} {b.name}</option>)}</select>
        </label>
        <div className="filters"><input value={bookName} onChange={(e) => setBookName(e.target.value)} placeholder="新账本名称" /><Button onClick={addBook}>创建账本</Button></div>
        <div className="data-actions"><Button onClick={exportJson}>导出 JSON</Button><Button onClick={exportCsv} variant="ghost">导出 CSV</Button><label className="file-btn">导入 JSON<input type="file" accept="application/json" onChange={importJson} /></label></div>
      </Panel>

      <Panel title="提醒中心">
        <form className="filters" onSubmit={addReminder}>
          <input value={reminder.text} onChange={(e) => setReminder({ ...reminder, text: e.target.value })} placeholder="提醒内容" />
          <input type="time" value={reminder.time} onChange={(e) => setReminder({ ...reminder, time: e.target.value })} />
          <Button type="submit">添加提醒</Button>
        </form>
        <div className="chip-list">{data.reminders.map((r) => <span key={r.id}>⏰ {r.time} {r.text}</span>)}</div>
      </Panel>

      <Panel title="定时记账规则" className="wide" action={<Button variant="ghost" onClick={runRecurring}>生成本月定时流水</Button>}>
        <form className="rule-form" onSubmit={addRule}>
          <input value={rule.title} onChange={(e) => setRule({ ...rule, title: e.target.value })} placeholder="规则名称，如 房租" />
          <select value={rule.type} onChange={(e) => setRule({ ...rule, type: e.target.value, category: e.target.type === 'income' ? '工资' : '餐饮' })}><option value="expense">支出</option><option value="income">收入</option></select>
          <select value={rule.category} onChange={(e) => setRule({ ...rule, category: e.target.value })}>{(rule.type === 'income' ? incomeCategories : expenseCategories).map((c) => <option key={c}>{c}</option>)}</select>
          <select value={rule.accountId} onChange={(e) => setRule({ ...rule, accountId: e.target.value })}>{data.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
          <input value={rule.amount} onChange={(e) => setRule({ ...rule, amount: e.target.value })} placeholder="金额" />
          <input type="number" min="1" max="28" value={rule.day} onChange={(e) => setRule({ ...rule, day: e.target.value })} />
          <Button type="submit">添加规则</Button>
        </form>
        <div className="chip-list">{data.recurring.map((r) => <span key={r.id}>🔁 每月 {r.day} 日 · {r.title} · {money(r.amount)}</span>)}</div>
      </Panel>

      <Panel title="数据备份">
        <div className="filters" style={{flexDirection:'column',alignItems:'flex-start',gap:8}}>
          <span className="hint" style={{color:'var(--success, #52b788)'}}>数据已自动存储在服务器上，多端数据互通。你也可以手动导出 JSON 或 CSV 作为本地备份。</span>
          <div className="data-actions" style={{marginTop:8}}>
            <Button onClick={exportJson}>导出 JSON 备份</Button>
            <Button variant="ghost" onClick={exportCsv}>导出 CSV</Button>
          </div>
        </div>
      </Panel>

      <Panel title="账号管理">
        <div className="account-card" style={{ '--card-color': '#ffd166' }}>
          <b>当前账号</b>
          <span style={{fontSize:'18px',fontWeight:900}}>{username}</span>
          <Button variant="danger" onClick={onLogout}>退出登录</Button>
        </div>
        <p className="hint" style={{marginTop:12}}>数据实时同步到服务器，换设备登录同一账号即可访问所有数据。</p>
      </Panel>

      <Panel title="工程化升级路线" className="wide">
        <div className="roadmap">
          <div><b>1. 当前版本</b><p>React + Flask + SQLite，数据存服务器，多端互通，支持多账号。</p></div>
          <div><b>2. 小程序版</b><p>复用数据模型，替换页面层为微信小程序/uni-app，存储换成云数据库。</p></div>
          <div><b>3. App版</b><p>迁移到 React Native / Flutter，接入登录、同步、OCR、语音和推送。</p></div>
          <div><b>4. 商业化</b><p>增加会员、模板账本、家庭协作、数据恢复、隐私加密。</p></div>
        </div>
      </Panel>
    </div>
  );
}

const SITE_UNLOCK_KEY = 'pixel-site-unlocked';
const SITE_PASSWORD_HASH = 'um37r1s34'; // hash of the site viewing password

function createSession(username, data = null, version = 0) {
  return { username, data, version };
}

function App() {
  const [siteUnlocked, setSiteUnlocked] = useState(() => sessionStorage.getItem(SITE_UNLOCK_KEY) === '1');
  const [authLoading, setAuthLoading] = useState(true);
  const [session, setSession] = useState(() => createSession(null));
  const [tab, setTab] = useState('dashboard');
  const { username, data } = session;

  // On mount, check if user is already logged in
  useEffect(() => {
    (async () => {
      setAuthLoading(true);
      const storedUser = getStoredUsername();
      if (storedUser) {
        const serverUser = await checkLoginStatus();
        if (serverUser === storedUser) {
          const result = await loadData(storedUser);
          setSession(createSession(storedUser, result, 1));
          setAuthLoading(false);
          return;
        }
        clearStoredUsername();
      }
      setAuthLoading(false);
    })();
  }, []);

  const setData = useCallback((next) => {
    setSession((current) => {
      if (!current.username || !current.data) return current;
      const nextData = typeof next === 'function' ? next(current.data) : next;
      return { ...current, data: nextData };
    });
  }, []);

  const handleLogin = useCallback(async (user) => {
    storeUsername(user);
    setTab('dashboard');
    const result = await loadData(user);
    setSession(createSession(user, result, Math.random()));
  }, []);

  const handleLogout = useCallback(async () => {
    await serverLogout();
    clearStoredUsername();
    setTab('dashboard');
    setSession(createSession(null, null, Math.random()));
  }, []);

  const saveReady = useRef(false);

  // Persist data to server whenever it changes (skip initial mount)
  useEffect(() => {
    if (!saveReady.current) {
      saveReady.current = true;
      return;
    }
    if (username && data) {
      saveToServer(data);
    }
  }, [data, username]);

  if (authLoading) {
    return (
      <div className="login-overlay">
        <div className="login-card" style={{ textAlign: 'center' }}>
          <div className="login-brand">
            <div className="brand-icon">₿</div>
            <div><b>Pixel Ledger</b><small>正在连接服务器...</small></div>
          </div>
        </div>
      </div>
    );
  }

  if (!siteUnlocked) {
    return <SiteGate onUnlock={() => setSiteUnlocked(true)} />;
  }

  if (!username || !data) {
    return <LoginPage key={`login-${session.version}`} onLogin={handleLogin} />;
  }

  const nav = [
    ['dashboard', '总览', '🏰'], ['add', '记账', '🪙'], ['records', '流水', '📜'], ['budget', '预算', '🎯'], ['assets', '资产', '💼'], ['reports', '报表', '📊'], ['settings', '设置', '⚙️']
  ];
  const activeBook = data.books.find((b) => b.id === data.activeBookId) || data.books[0];

  const props = { data, setData, setTab };
  let page = <SettingsPage {...props} username={username} onLogout={handleLogout} />;
  if (tab === 'dashboard') page = <Dashboard {...props} />;
  if (tab === 'add') page = <AddPage {...props} />;
  if (tab === 'records') page = <RecordsPage {...props} />;
  if (tab === 'budget') page = <BudgetPage {...props} />;
  if (tab === 'assets') page = <AssetsPage {...props} />;
  if (tab === 'reports') page = <ReportsPage {...props} />;

  return (
    <div className="app" key={`app-${username}-${session.version}`}>
      <aside className="sidebar">
        <div className="brand"><div className="brand-icon">₿</div><div><b>Pixel Ledger</b><small>{activeBook?.emoji} {activeBook?.name}</small></div></div>
        <nav>
          {nav.map(([key, label, icon]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}><span>{icon}</span>{label}</button>)}
        </nav>
        <div className="side-user">
          <span>{username}</span>
          <button onClick={handleLogout} title="退出登录">退出</button>
        </div>
        <div className="side-note">云端存储 · 多账号 · 多端互通 · 数据安全</div>
      </aside>
      <main>
        <header className="topbar">
          <div>
            <p className="eyebrow">像素记账系统</p>
            <h1>{nav.find((n) => n[0] === tab)?.[1]}</h1>
          </div>
          <div className="top-actions">
            <Button variant="ghost" onClick={() => setData(makeDemoData())}>恢复演示</Button>
            <Button onClick={() => setTab('add')}>+ 记一笔</Button>
          </div>
        </header>
        {page}
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
