import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';

function App() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [barcode, setBarcode] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => listener?.subscription.unsubscribe();
  }, []);

  const login = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert('Login failed');
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  const handleBarcode = async () => {
    const codes = barcode.split(/[-_,]/).map(c => c.trim()).filter(Boolean);

    for (const code of codes) {
      const { data } = await supabase.from('visa_requests').select().eq('barcode', code).maybeSingle();

      if (!data) {
        await supabase.from('visa_requests').insert({
          barcode: code,
          status: 'الطلب قيد الفحص. رجاء التحقق لاحقاً',
          notes,
        });
      } else if (data.status === 'الطلب قيد الفحص. رجاء التحقق لاحقاً') {
        const choice = prompt(`Update status for ${code}:\n1. موافقة\n2. عدم موافقة\n3. إستيفاء بيانات`, '1');
        let newStatus = '';
        if (choice === '1') newStatus = 'وردت الموافقة. رجاء إحضار جواز السفر والأوراق المطلوبة خلال المواعيد المحددة أو الإرسال بالبريد المسجل مع مظروف إعادة مستوفى الطوابع والعنوان';
        else if (choice === '2') newStatus = 'عدم موافقة';
        else if (choice === '3') newStatus = 'مطلوب إستيفاء بيانات';
        if (newStatus) {
          await supabase.from('visa_requests').update({ status: newStatus, notes }).eq('barcode', code);
        }
      } else {
        const confirm = window.confirm(`هل تريد حذف ${code}؟`);
        if (confirm) {
          await supabase.from('visa_requests').delete().eq('barcode', code);
        }
      }
    }

    alert('تم اللازم');
    setBarcode('');
    setNotes('');
  };

  if (!session) {
    return (
      <div style={{ maxWidth: 400, margin: '100px auto' }}>
        <h2>Login</h2>
        <input type="email" placeholder="Email" onChange={e => setEmail(e.target.value)} /><br />
        <input type="password" placeholder="Password" onChange={e => setPassword(e.target.value)} /><br />
        <button onClick={login}>Login</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600, margin: '50px auto' }}>
      <h2>Visa Tracker</h2>
      <textarea rows="3" placeholder="أدخل الباركود" value={barcode} onChange={e => setBarcode(e.target.value)} /><br />
      <input type="text" placeholder="ملاحظات" value={notes} onChange={e => setNotes(e.target.value)} /><br />
      <button onClick={handleBarcode}>Submit</button>
      <button onClick={logout}>Logout</button>
    </div>
  );
}

export default App;
