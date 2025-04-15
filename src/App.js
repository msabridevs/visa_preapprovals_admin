import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';

function App() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [barcode, setBarcode] = useState('');
  const [notes, setNotes] = useState('');
  const [statusChoice, setStatusChoice] = useState('');

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

    const invalid = codes.find(code => code.length > 4 || !/^\d+$/.test(code));
    if (invalid) {
      alert(`الرقم ${invalid} غير صحيح. يجب أن لا يزيد عن 4 أرقام.`);
      return;
    }

    for (const code of codes) {
      const { data } = await supabase.from('visa_requests').select().eq('barcode', code).maybeSingle();

      if (!data) {
        await supabase.from('visa_requests').insert({
          barcode: code,
          status: 'جارى مراجعة الطلب. رجاء التحقق لاحقاً',
          notes,
        });
      } else if (data.status === 'جارى مراجعة الطلب. رجاء التحقق لاحقاً') {
        if (!statusChoice) {
          alert('يرجى اختيار حالة من القائمة.');
          return;
        }
        await supabase.from('visa_requests').update({ status: statusChoice, notes }).eq('barcode', code);
      } else {
        alert(`تمت معالجة الباركود رقم ${code} مسبقاً.`);
      }
    }

    alert('تم اللازم');
    setBarcode('');
    setNotes('');
    setStatusChoice('');
  };

  if (!session) {
    return (
      <div style={{ maxWidth: 400, margin: '100px auto', fontSize: '20px' }}>
        <h2>Login</h2>
        <input type="email" placeholder="Email" onChange={e => setEmail(e.target.value)} /><br />
        <input type="password" placeholder="Password" onChange={e => setPassword(e.target.value)} /><br />
        <button onClick={login}>Login</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: '50px auto', fontSize: '22px', lineHeight: '2' }}>
      <h2>Visa Tracker</h2>
      <textarea
        rows="3"
        placeholder="أدخل الباركود (رقم أو أرقام مفصولة بفواصل - أو _)"
        value={barcode}
        onChange={e => setBarcode(e.target.value)}
        style={{ width: '100%', fontSize: '20px' }}
      /><br />
      <input
        type="text"
        placeholder="ملاحظات"
        value={notes}
        onChange={e => setNotes(e.target.value)}
        style={{ width: '100%', fontSize: '20px' }}
      /><br />
      <select
        value={statusChoice}
        onChange={e => setStatusChoice(e.target.value)}
        style={{ width: '100%', fontSize: '20px' }}
      >
        <option value="">-- اختر الحالة --</option>
        <option value="وردت الموافقة. رجاء إحضار جواز السفر والأوراق المطلوبة خلال المواعيد المحددة أو الإرسال بالبريد المسجل مع مظروف إعادة مستوفى الطوابع والعنوان">
          1. موافقة
        </option>
        <option value="لم ترد الموافقة">2. لم ترد الموافقة</option>
        <option value="مطلوب إستيفاء">3. مطلوب إستيفاء</option>
        <option value="جارى مراجعة الطلب. رجاء التحقق لاحقاً">4. جارى مراجعة الطلب</option>
      </select><br />
      <button onClick={handleBarcode}>Submit</button>
      <button onClick={logout}>Logout</button>
    </div>
  );
}

export default App;
