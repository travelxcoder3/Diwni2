import { GoogleGenAI } from "@google/genai";
import { Transaction } from "../types";

const apiKey = process.env.API_KEY;

export const getFinancialAdvice = async (transactions: Transaction[], userName: string): Promise<string> => {
  if (!apiKey) {
    return "عذراً، مفتاح API غير متوفر.";
  }

  const ai = new GoogleGenAI({ apiKey });

  // Filter for active debts/credits
  const activeTransactions = transactions.filter(t => t.status === 'pending');
  // Simple sum for AI context (ignoring currency exchange rates for simplicity in prompt)
  const totalDebt = activeTransactions.filter(t => t.type === 'debt').reduce((acc, t) => acc + (t.amount - t.paidAmount), 0);
  const totalCredit = activeTransactions.filter(t => t.type === 'credit').reduce((acc, t) => acc + (t.amount - t.paidAmount), 0);

  const prompt = `
    أنت مستشار مالي ذكي لتطبيق "مالي". المستخدم اسمه ${userName}.
    
    البيانات المالية الحالية (المبالغ المتبقية):
    - إجمالي الديون المتبقية عليه: ${totalDebt} (تقريباً).
    - إجمالي المستحقات المتبقية له: ${totalCredit} (تقريباً).
    - عدد المعاملات المعلقة: ${activeTransactions.length}.

    قائمة ببعض المعاملات المعلقة (مع العملات والمبالغ المدفوعة جزئياً):
    ${JSON.stringify(activeTransactions.slice(0, 5).map(t => ({
      type: t.type === 'debt' ? 'دين عليه' : 'مبلغ له',
      total_amount: t.amount,
      paid_so_far: t.paidAmount,
      remaining: t.amount - t.paidAmount,
      currency: t.currency,
      person: t.counterparty
    })))}

    المطلوب:
    1. قدم ملخصاً سريعاً لوضعه المالي.
    2. إذا كان هناك ديون مدفوعة جزئياً، شجعه على إكمالها.
    3. اقترح نصيحة عملية لإدارة العملات المختلفة إذا وجدت.
    
    اجعل الإجابة مختصرة ومفيدة في حدود 200 كلمة.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "لم أتمكن من توليد النصيحة في الوقت الحالي.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "حدث خطأ أثناء الاتصال بالمساعد الذكي.";
  }
};