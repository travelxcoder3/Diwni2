import React, { useState, useEffect, useMemo } from 'react';
import { User, Transaction, TransactionType } from '../types';
import { getTransactions, addTransaction, addPaymentToTransaction, logoutUser, deleteTransaction } from '../services/storage';
import { getFinancialAdvice } from '../services/geminiService';
import { 
  LogOut, Plus, ArrowDownLeft, ArrowUpRight, Wallet, 
  CheckCircle2, Clock, Trash2, TrendingUp, Sparkles, X,
  Users, User as UserIcon, ChevronLeft, Banknote
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

const CURRENCIES = ['SAR', 'USD', 'EUR', 'KWD', 'AED', 'EGP'];

const Dashboard: React.FC<DashboardProps> = ({ user, onLogout }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  
  // Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedTxForPayment, setSelectedTxForPayment] = useState<Transaction | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');

  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  
  const [aiAdvice, setAiAdvice] = useState('');
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  // Add Form State
  const [newTransType, setNewTransType] = useState<TransactionType>('debt');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('SAR');
  const [counterparty, setCounterparty] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = () => {
    const data = getTransactions(user.id);
    setTransactions(data);
  };

  const handleLogout = () => {
    logoutUser();
    onLogout();
  };

  const handleAddTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !counterparty) return;

    addTransaction({
      userId: user.id,
      type: newTransType,
      amount: parseFloat(amount),
      currency: currency,
      counterparty: counterparty.trim(),
      description,
      date: new Date().toISOString(),
      status: 'pending'
    });

    setAmount('');
    setCounterparty('');
    setDescription('');
    setCurrency('SAR');
    setShowAddModal(false);
    loadData();
  };

  const openPaymentModal = (tx: Transaction) => {
    if (tx.status === 'settled') return; // Already settled
    setSelectedTxForPayment(tx);
    // Default to remaining amount
    setPaymentAmount((tx.amount - (tx.paidAmount || 0)).toString());
    setShowPaymentModal(true);
  };

  const handleSubmitPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTxForPayment || !paymentAmount) return;

    const amountToPay = parseFloat(paymentAmount);
    if (amountToPay <= 0) return;

    addPaymentToTransaction(selectedTxForPayment.id, amountToPay);
    
    setShowPaymentModal(false);
    setSelectedTxForPayment(null);
    setPaymentAmount('');
    loadData();
  };

  const handleDelete = (id: string) => {
    if(window.confirm('هل أنت متأكد من حذف هذه العملية؟')) {
        deleteTransaction(id);
        loadData();
    }
  }

  const handleAskAI = async () => {
    setShowAIModal(true);
    setAiAdvice('');
    setIsLoadingAi(true);
    const advice = await getFinancialAdvice(transactions, user.name);
    setAiAdvice(advice);
    setIsLoadingAi(false);
  };

  // General Summary (Note: This blindly sums different currencies for the visual overview, 
  // in a real app you'd convert to a base currency)
  const summary = useMemo(() => {
    const active = transactions.filter(t => t.status === 'pending');
    
    const totalCredit = active.filter(t => t.type === 'credit')
        .reduce((sum, t) => sum + (t.amount - (t.paidAmount || 0)), 0);
    
    const totalDebt = active.filter(t => t.type === 'debt')
        .reduce((sum, t) => sum + (t.amount - (t.paidAmount || 0)), 0);
    
    return {
      totalCredit,
      totalDebt,
      net: totalCredit - totalDebt
    };
  }, [transactions]);

  // People Stats
  const peopleStats = useMemo(() => {
    const stats: Record<string, { credit: number; debt: number; net: number }> = {};
    
    transactions.forEach(t => {
      if (!stats[t.counterparty]) {
        stats[t.counterparty] = { credit: 0, debt: 0, net: 0 };
      }
      
      const remaining = t.amount - (t.paidAmount || 0);

      if (t.status === 'pending') {
        if (t.type === 'credit') {
          stats[t.counterparty].credit += remaining;
        } else {
          stats[t.counterparty].debt += remaining;
        }
      }
    });

    return Object.entries(stats).map(([name, stat]) => ({
      name,
      ...stat,
      net: stat.credit - stat.debt
    })).sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
  }, [transactions]);

  // Selected Person Stats
  const selectedPersonData = useMemo(() => {
    if (!selectedPerson) return null;
    
    const personTrans = transactions.filter(t => t.counterparty === selectedPerson);
    const active = personTrans.filter(t => t.status === 'pending');
    
    const totalCredit = active.filter(t => t.type === 'credit').reduce((sum, t) => sum + (t.amount - (t.paidAmount || 0)), 0);
    const totalDebt = active.filter(t => t.type === 'debt').reduce((sum, t) => sum + (t.amount - (t.paidAmount || 0)), 0);
    
    return {
      transactions: personTrans,
      totalCredit,
      totalDebt,
      net: totalCredit - totalDebt
    };
  }, [transactions, selectedPerson]);

  const chartData = [
    { name: 'لي (مستحقات)', value: summary.totalCredit, color: '#10B981' }, 
    { name: 'علي (ديون)', value: summary.totalDebt, color: '#F43F5E' },   
  ].filter(d => d.value > 0);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      
      {/* Sidebar */}
      <aside className="bg-white md:w-64 border-l border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between md:justify-start gap-3">
          <div className="bg-emerald-100 p-2 rounded-lg">
            <Wallet className="text-emerald-600" size={24} />
          </div>
          <h1 className="text-xl font-bold text-gray-800">مالي</h1>
          <button onClick={handleLogout} className="md:hidden text-gray-500">
            <LogOut size={20} />
          </button>
        </div>

        <div className="p-6">
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 mb-6">
            <p className="text-xs text-gray-500 mb-1">مرحباً بك 👋</p>
            <p className="font-bold text-gray-800 truncate">{user.name}</p>
          </div>
          
          <button 
            onClick={() => setShowAddModal(true)}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all mb-3"
          >
            <Plus size={20} />
            عملية جديدة
          </button>

          <button 
            onClick={handleAskAI}
            className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all"
          >
            <Sparkles size={20} />
            تحليل ذكي
          </button>
        </div>

        <div className="mt-auto p-6 hidden md:block">
          <button onClick={handleLogout} className="flex items-center gap-2 text-gray-500 hover:text-red-500 transition-colors">
            <LogOut size={18} />
            تسجيل خروج
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Net Balance */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
            <div className={`absolute top-0 right-0 w-2 h-full ${summary.net >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-gray-500 text-sm font-medium mb-1">صافي المحفظة (تقديري)</p>
                <h3 className={`text-3xl font-bold ${summary.net >= 0 ? 'text-gray-900' : 'text-rose-600'}`} dir="ltr">
                  {summary.net.toLocaleString()} <span className="text-sm text-gray-400"></span>
                </h3>
              </div>
              <div className={`p-3 rounded-full ${summary.net >= 0 ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                <TrendingUp className={summary.net >= 0 ? 'text-emerald-500' : 'text-rose-500'} size={24} />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-gray-500 text-sm font-medium mb-1">لي (المتبقي)</p>
                <h3 className="text-2xl font-bold text-emerald-600" dir="ltr">
                  {summary.totalCredit.toLocaleString()}
                </h3>
              </div>
              <div className="p-3 rounded-full bg-emerald-50">
                <ArrowUpRight className="text-emerald-500" size={24} />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-gray-500 text-sm font-medium mb-1">علي (المتبقي)</p>
                <h3 className="text-2xl font-bold text-rose-600" dir="ltr">
                  {summary.totalDebt.toLocaleString()}
                </h3>
              </div>
              <div className="p-3 rounded-full bg-rose-50">
                <ArrowDownLeft className="text-rose-500" size={24} />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Transactions List */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-bold text-gray-800 text-lg">سجل المعاملات</h3>
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">{transactions.length} عملية</span>
            </div>
            
            <div className="divide-y divide-gray-50 max-h-[500px] overflow-y-auto">
              {transactions.length === 0 ? (
                <div className="p-12 text-center text-gray-400">
                  <Wallet size={48} className="mx-auto mb-4 opacity-20" />
                  <p>لا توجد معاملات مسجلة بعد</p>
                </div>
              ) : (
                transactions.map((t) => {
                    const remaining = t.amount - (t.paidAmount || 0);
                    const isFullyPaid = t.status === 'settled' || remaining <= 0;
                    
                    return (
                        <div key={t.id} className={`p-4 hover:bg-gray-50 transition-colors flex items-center justify-between group ${isFullyPaid ? 'opacity-60 bg-gray-50/50' : ''}`}>
                            <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                                t.type === 'credit' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
                            }`}>
                                {t.type === 'credit' ? <ArrowUpRight size={20} /> : <ArrowDownLeft size={20} />}
                            </div>
                            <div>
                                <button 
                                onClick={() => setSelectedPerson(t.counterparty)}
                                className="font-bold text-gray-800 hover:text-emerald-600 hover:underline text-right"
                                >
                                {t.counterparty}
                                </button>
                                <p className="text-xs text-gray-500">{t.description || 'بدون وصف'} • {new Date(t.date).toLocaleDateString('ar-SA')}</p>
                            </div>
                            </div>

                            <div className="flex items-center gap-4">
                            <div className="text-left flex flex-col items-end">
                                <p className={`font-bold flex items-center gap-1 ${t.type === 'credit' ? 'text-emerald-600' : 'text-rose-600'}`} dir="ltr">
                                    <span>{t.type === 'credit' ? '+' : '-'}</span>
                                    <span>{t.amount.toLocaleString()}</span>
                                    <span className="text-xs text-gray-400 font-normal">{t.currency}</span>
                                </p>
                                
                                {t.paidAmount > 0 && !isFullyPaid && (
                                    <div className="text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md mt-1">
                                        تم سداد: {t.paidAmount.toLocaleString()}
                                    </div>
                                )}

                                <span className={`text-[10px] px-2 py-0.5 rounded-full mt-1 ${isFullyPaid ? 'bg-gray-200 text-gray-600' : 'bg-amber-100 text-amber-600'}`}>
                                {isFullyPaid ? 'مكتمل' : `متبقي: ${remaining.toLocaleString()}`}
                                </span>
                            </div>
                            
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                    onClick={() => openPaymentModal(t)}
                                    title={isFullyPaid ? "مكتمل" : "إضافة دفعة / سداد"}
                                    disabled={isFullyPaid}
                                    className={`p-2 rounded-full hover:bg-gray-200 ${isFullyPaid ? 'text-emerald-600 cursor-default' : 'text-gray-400 hover:text-emerald-600'}`}
                                >
                                    {isFullyPaid ? <CheckCircle2 size={18} /> : <Banknote size={18} />}
                                </button>
                                <button
                                    onClick={() => handleDelete(t.id)}
                                    className="p-2 rounded-full hover:bg-rose-100 text-gray-400 hover:text-rose-500"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                            </div>
                        </div>
                    );
                })
              )}
            </div>
          </div>

          {/* Right Column: Chart & People Summary */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col items-center justify-center min-h-[300px]">
              <h3 className="font-bold text-gray-800 text-lg mb-4 w-full text-right">توزيع الأموال</h3>
              {chartData.length > 0 ? (
                  <div className="w-full h-64">
                      <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                              <Pie
                                  data={chartData}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={60}
                                  outerRadius={80}
                                  paddingAngle={5}
                                  dataKey="value"
                              >
                                  {chartData.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={entry.color} />
                                  ))}
                              </Pie>
                              <RechartsTooltip formatter={(value) => `${Number(value).toLocaleString()}`} />
                              <Legend verticalAlign="bottom" height={36}/>
                          </PieChart>
                      </ResponsiveContainer>
                  </div>
              ) : (
                  <div className="text-gray-400 text-sm text-center">لا توجد بيانات كافية للرسم البياني</div>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <Users size={18} className="text-gray-500" />
                  ملخص الأشخاص
                </h3>
              </div>
              <div className="max-h-[300px] overflow-y-auto divide-y divide-gray-50">
                 {peopleStats.length === 0 ? (
                    <p className="p-4 text-center text-gray-400 text-sm">لا توجد جهات اتصال نشطة</p>
                 ) : (
                    peopleStats.map(person => (
                      <button 
                        key={person.name}
                        onClick={() => setSelectedPerson(person.name)}
                        className="w-full p-4 hover:bg-gray-50 flex items-center justify-between group transition-colors text-right"
                      >
                         <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 group-hover:bg-emerald-100 group-hover:text-emerald-600 transition-colors">
                             <UserIcon size={16} />
                           </div>
                           <span className="font-medium text-gray-800 group-hover:text-emerald-700">{person.name}</span>
                         </div>
                         <div dir="ltr" className={`text-sm font-bold ${person.net > 0 ? 'text-emerald-600' : person.net < 0 ? 'text-rose-600' : 'text-gray-400'}`}>
                            {person.net > 0 ? '+' : ''}{person.net.toLocaleString()}
                         </div>
                      </button>
                    ))
                 )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Add Transaction Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-xl text-gray-800">إضافة معاملة جديدة</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleAddTransaction} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setNewTransType('debt')}
                  className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
                    newTransType === 'debt' 
                    ? 'border-rose-500 bg-rose-50 text-rose-700' 
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  <ArrowDownLeft size={24} />
                  <span className="font-bold">علي (ديون)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNewTransType('credit')}
                  className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
                    newTransType === 'credit' 
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700' 
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  <ArrowUpRight size={24} />
                  <span className="font-bold">لي (مستحقات)</span>
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    {newTransType === 'debt' ? 'لمن هذا المبلغ؟ (الدائن)' : 'على من هذا المبلغ؟ (المدين)'}
                </label>
                <input
                  type="text"
                  required
                  placeholder="الاسم"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={counterparty}
                  onChange={e => setCounterparty(e.target.value)}
                />
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">المبلغ</label>
                    <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    />
                </div>
                <div className="w-1/3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">العملة</label>
                    <select 
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                    >
                        {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">وصف (اختياري)</label>
                <input
                  type="text"
                  placeholder="مثال: عشاء، إيجار، سلفة..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl mt-4 transition-colors"
              >
                حفظ العملية
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedTxForPayment && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
             <div className="p-6 bg-emerald-50 border-b border-emerald-100 text-center">
                <div className="bg-emerald-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 text-emerald-600">
                    <Banknote size={24} />
                </div>
                <h3 className="font-bold text-lg text-emerald-900">سداد دفعة</h3>
                <p className="text-xs text-emerald-600 mt-1">{selectedTxForPayment.description || selectedTxForPayment.counterparty}</p>
             </div>
             
             <form onSubmit={handleSubmitPayment} className="p-6">
                <div className="mb-4">
                    <div className="flex justify-between text-xs text-gray-500 mb-2">
                        <span>إجمالي المبلغ: {selectedTxForPayment.amount}</span>
                        <span>متبقي: {selectedTxForPayment.amount - (selectedTxForPayment.paidAmount || 0)}</span>
                    </div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">كم تريد أن تدفع الآن؟ ({selectedTxForPayment.currency})</label>
                    <input
                        type="number"
                        required
                        min="0"
                        max={selectedTxForPayment.amount - (selectedTxForPayment.paidAmount || 0)}
                        step="0.01"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-center text-lg font-bold text-emerald-600"
                        value={paymentAmount}
                        onChange={e => setPaymentAmount(e.target.value)}
                    />
                </div>
                
                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={() => setShowPaymentModal(false)}
                        className="flex-1 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
                    >
                        إلغاء
                    </button>
                    <button
                        type="submit"
                        className="flex-1 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-bold"
                    >
                        تأكيد السداد
                    </button>
                </div>
             </form>
          </div>
        </div>
      )}

      {/* Person Detail Modal (Wallet View) */}
      {selectedPerson && selectedPersonData && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="p-6 bg-gray-900 text-white flex justify-between items-center">
               <div className="flex items-center gap-3">
                  <button onClick={() => setSelectedPerson(null)} className="p-1 hover:bg-white/20 rounded-full transition">
                    <ChevronLeft size={24} />
                  </button>
                  <div>
                    <h3 className="font-bold text-xl flex items-center gap-2">
                       <Wallet size={20} className="text-emerald-400" />
                       محفظة: {selectedPerson}
                    </h3>
                  </div>
               </div>
               <button onClick={() => setSelectedPerson(null)} className="text-white/70 hover:text-white">
                 <X size={24} />
               </button>
            </div>

            {/* Wallet Summary Cards */}
            <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 border-b border-gray-200">
               <div className="bg-white p-3 rounded-xl border border-gray-100 text-center shadow-sm">
                  <p className="text-xs text-gray-500 mb-1">عليه (لي)</p>
                  <p className="font-bold text-emerald-600" dir="ltr">{selectedPersonData.totalCredit.toLocaleString()}</p>
               </div>
               <div className="bg-white p-3 rounded-xl border border-gray-100 text-center shadow-sm">
                  <p className="text-xs text-gray-500 mb-1">له (علي)</p>
                  <p className="font-bold text-rose-600" dir="ltr">{selectedPersonData.totalDebt.toLocaleString()}</p>
               </div>
               <div className="bg-white p-3 rounded-xl border border-gray-100 text-center shadow-sm relative overflow-hidden">
                  <div className={`absolute bottom-0 left-0 h-1 w-full ${selectedPersonData.net >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                  <p className="text-xs text-gray-500 mb-1">الصافي</p>
                  <p className={`font-bold ${selectedPersonData.net >= 0 ? 'text-gray-900' : 'text-rose-600'}`} dir="ltr">
                    {selectedPersonData.net.toLocaleString()}
                  </p>
               </div>
            </div>

            {/* History List */}
            <div className="flex-1 overflow-y-auto p-4 bg-gray-100/50">
               <h4 className="text-sm font-bold text-gray-500 mb-3 px-1">سجل المعاملات</h4>
               <div className="space-y-3">
                  {selectedPersonData.transactions.length === 0 ? (
                    <p className="text-center text-gray-400 py-8">لا توجد معاملات</p>
                  ) : (
                    selectedPersonData.transactions.map(t => {
                        const remaining = t.amount - (t.paidAmount || 0);
                        const isFullyPaid = t.status === 'settled' || remaining <= 0;
                        
                        return (
                            <div key={t.id} className={`bg-white p-4 rounded-xl border border-gray-100 flex flex-col gap-3 ${isFullyPaid ? 'opacity-60' : ''}`}>
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                         <div className={`w-10 h-10 rounded-full flex items-center justify-center ${t.type === 'credit' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                            {t.type === 'credit' ? <ArrowUpRight size={20} /> : <ArrowDownLeft size={20} />}
                                         </div>
                                         <div>
                                            <p className="font-bold text-gray-800">{t.description || 'بدون وصف'}</p>
                                            <p className="text-xs text-gray-500">
                                                {new Date(t.date).toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                                {' '} • {' '}
                                                {new Date(t.date).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                         </div>
                                    </div>
                                    <div className={`px-2 py-1 rounded text-xs font-bold ${t.type === 'credit' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                                        {t.type === 'credit' ? 'لي (مستحق)' : 'علي (دين)'}
                                    </div>
                                </div>

                                <div className="bg-gray-50 rounded-lg p-3 grid grid-cols-3 gap-2 text-center">
                                    <div>
                                        <p className="text-[10px] text-gray-500">المبلغ الكلي</p>
                                        <p className="font-bold text-gray-800" dir="ltr">{t.amount.toLocaleString()} <span className="text-[9px]">{t.currency}</span></p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-gray-500">المدفوع</p>
                                        <p className="font-bold text-emerald-600" dir="ltr">{(t.paidAmount || 0).toLocaleString()} <span className="text-[9px]">{t.currency}</span></p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-gray-500">المتبقي</p>
                                        <p className={`font-bold ${isFullyPaid ? 'text-gray-400' : 'text-rose-600'}`} dir="ltr">{remaining.toLocaleString()} <span className="text-[9px]">{t.currency}</span></p>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-2 mt-1">
                                    {!isFullyPaid && (
                                        <button 
                                            onClick={() => openPaymentModal(t)}
                                            className="text-xs flex items-center gap-1 bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 transition"
                                        >
                                            <Banknote size={14} />
                                            سداد دفعة
                                        </button>
                                    )}
                                    {isFullyPaid && (
                                         <span className="text-xs flex items-center gap-1 text-emerald-600 px-3 py-1.5 bg-emerald-50 rounded-lg">
                                            <CheckCircle2 size={14} />
                                            تم السداد بالكامل
                                         </span>
                                    )}
                                    <button 
                                        onClick={() => handleDelete(t.id)}
                                        className="text-xs flex items-center gap-1 text-rose-500 hover:bg-rose-50 px-3 py-1.5 rounded-lg transition"
                                    >
                                        <Trash2 size={14} />
                                        حذف
                                    </button>
                                </div>
                            </div>
                        );
                    })
                  )}
               </div>
            </div>

            <div className="p-4 border-t border-gray-100 bg-white">
                <button 
                   onClick={() => {
                       setCounterparty(selectedPerson);
                       setSelectedPerson(null);
                       setShowAddModal(true);
                   }}
                   className="w-full bg-gray-900 text-white py-3 rounded-xl font-bold hover:bg-gray-800 transition flex items-center justify-center gap-2"
                >
                    <Plus size={18} />
                    إضافة عملية جديدة لهذا الشخص
                </button>
            </div>

          </div>
        </div>
      )}

      {/* AI Assistant Modal */}
      {showAIModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
            <div className="p-6 bg-gradient-to-r from-violet-600 to-indigo-600 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Sparkles size={24} className="text-yellow-300" />
                <h3 className="font-bold text-xl">المساعد المالي الذكي</h3>
              </div>
              <button onClick={() => setShowAIModal(false)} className="text-white/80 hover:text-white">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-8 overflow-y-auto flex-1">
              {isLoadingAi ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <div className="w-12 h-12 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin"></div>
                  <p className="text-gray-500 animate-pulse">جاري تحليل بياناتك المالية...</p>
                </div>
              ) : (
                <div className="prose prose-lg max-w-none">
                    <div className="bg-violet-50 p-6 rounded-xl border border-violet-100 text-gray-800 leading-relaxed whitespace-pre-line">
                        {aiAdvice}
                    </div>
                </div>
              )}
            </div>
            
            <div className="p-4 bg-gray-50 border-t border-gray-100 text-center text-xs text-gray-500">
              مدعوم بواسطة Google Gemini AI
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Dashboard;