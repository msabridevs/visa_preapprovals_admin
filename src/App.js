import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';

function App() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [barcode, setBarcode] = useState('');
  const [notes, setNotes] = useState('');
  const [statusChoice, setStatusChoice] = useState('');
  const [deleteBarcode, setDeleteBarcode] = useState('');

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
          status: 'الطلب قيد الفحص. رجاء التحقق لاحقاً',
          notes,
        });
      } else if (data.status === 'الطلب قيد الفحص. رجاء التحقق لاحقاً') {
        if (!statusChoice) {
          alert('يرجى اختيار حالة من القائمة.');
          return;
        }
        await supabase.from('visa_requests').update({ status: statusChoice, notes }).eq('barcode', code);
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
    setStatusChoice('');
  };

  const handleDeleteSpecific = async () => {
    if (!deleteBarcode.trim()) {
      alert('يرجى إدخال رقم الطلب المراد حذفه');
      return;
    }
    const confirm = window.confirm(`هل أنت متأكد من حذف الطلب رقم ${deleteBarcode}؟`);
    if (confirm) {
      const { error } = await supabase.from('visa_requests').delete().eq('barcode', deleteBarcode.trim());
      if (error) alert('حدث خطأ أثناء الحذف.');
      else alert('تم حذف الطلب بنجاح');
      setDeleteBarcode('');
    }
  };

  const handleDeleteAll = async () => {
    const confirmPhrase = prompt("⚠️ Are you sure? Type: 'أوافق على حذف كل الطلبات'");
    if (confirmPhrase !== 'أوافق على حذف كل الطلبات') {
      alert('تم الإلغاء. لم يتم حذف أي شيء.');
      return;
    }

    const { data: rows, error: fetchError } = await supabase.from('visa_requests').select('uuid');
    if (fetchError || !rows) {
      alert('حدث خطأ أثناء محاولة الحذف.');
      return;
    }

    if (rows.length === 0) {
      alert('لا توجد طلبات لحذفها.');
      return;
    }

    const uuids = rows.map(row => row.uuid);
    const { error: deleteError } = await supabase.from('visa_requests').delete().in('uuid', uuids);
    if (deleteError) {
      alert('حدث خطأ أثناء حذف الطلبات.');
    } else {
      alert('✅ تم حذف جميع الطلبات بنجاح.');
    }
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
        <option value="عدم موافقة">2. عدم موافقة</option>
        <option value="مطلوب إستيفاء بيانات">3. إستيفاء بيانات</option>
        <option value="الطلب قيد الفحص. رجاء التحقق لاحقاً">4. قيد الفحص</option>
      </select><br />
      <button onClick={handleBarcode}>Submit</button>
      <button onClick={logout}>Logout</button>
      <br /><br />
      <input
        type="text"
        placeholder="أدخل رقم الطلب لحذفه"
        value={deleteBarcode}
        onChange={e => setDeleteBarcode(e.target.value)}
        style={{ width: '100%', fontSize: '20px' }}
      /><br />
      <button onClick={handleDeleteSpecific} style={{ color: 'red', fontWeight: 'bold' }}>
        🗑 حذف الطلب المحدد
      </button>
      <br /><br />
      <button onClick={handleDeleteAll} style={{ color: 'red', fontWeight: 'bold' }}>
        🗑 حذف جميع الطلبات
      </button>
    </div>
  );
}

export default App;