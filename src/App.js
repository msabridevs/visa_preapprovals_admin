import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';

function App() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [barcode, setBarcode] = useState('');
  const [notes, setNotes] = useState('');
  const [statusChoice, setStatusChoice] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [searchBarcode, setSearchBarcode] = useState('');
  const [editData, setEditData] = useState(null);
  const [submissionResult, setSubmissionResult] = useState('');

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

    let resultMsgs = [];
    for (const code of codes) {
      const { data } = await supabase.from('visa_requests').select().eq('barcode', code).maybeSingle();

      if (!data) {
        await supabase.from('visa_requests').insert({
          barcode: code,
          status: 'جارى مراجعة الطلب. رجاء التحقق لاحقاً',
          notes,
        });
        resultMsgs.push(`تم إضافة باركود ${code} بالحالة: جارى مراجعة الطلب.`);
      } else if (data.status === 'جارى مراجعة الطلب. رجاء التحقق لاحقاً') {
        if (!statusChoice) {
          alert('يرجى اختيار حالة من القائمة.');
          return;
        }
        await supabase.from('visa_requests').update({ status: statusChoice, notes }).eq('barcode', code);
        resultMsgs.push(`تم تحديث باركود ${code} إلى الحالة: ${statusChoice}`);
      } else {
        resultMsgs.push(`تمت معالجة الباركود رقم ${code} مسبقاً (الحالة الحالية: ${data.status}).`);
      }
    }

    setSubmissionResult(resultMsgs.join('\n'));
    setBarcode('');
    setNotes('');
    setStatusChoice('');
  };

  // --- Edit Status Logic ---
  const handleSearchForEdit = async () => {
    setEditData(null);
    if (!searchBarcode.trim()) {
      alert("يرجى إدخال رقم الباركود للبحث.");
      return;
    }
    const { data } = await supabase.from('visa_requests').select().eq('barcode', searchBarcode.trim()).maybeSingle();
    if (!data) {
      alert("لم يتم العثور على هذا الباركود.");
    } else {
      setEditData(data);
    }
  };

  const handleEditSubmit = async () => {
    if (!editData) return;
    if (!editData.status || !editData.barcode) return;
    if (!statusChoice) {
      alert('يرجى اختيار حالة من القائمة.');
      return;
    }
    await supabase
      .from('visa_requests')
      .update({ status: statusChoice, notes })
      .eq('barcode', editData.barcode);

    setSubmissionResult(`تم تحديث باركود ${editData.barcode} إلى الحالة: ${statusChoice}`);
    setEditMode(false);
    setEditData(null);
    setSearchBarcode('');
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

  if (editMode) {
    return (
      <div style={{ maxWidth: 600, margin: '50px auto', fontSize: '22px', lineHeight: '2' }}>
        <h2>تعديل حالة الطلب</h2>
        <input
          type="text"
          placeholder="أدخل رقم الباركود"
          value={searchBarcode}
          onChange={e => setSearchBarcode(e.target.value)}
          style={{ width: '100%', fontSize: '20px' }}
        /><button style={{ fontSize: '20px', marginInlineStart: 10 }} onClick={handleSearchForEdit}>بحث</button>
        {editData && (
          <div style={{ marginTop: 20 }}>
            <div>الحالة الحالية: <b>{editData.status}</b></div>
            <div>الملاحظات الحالية: <b>{editData.notes || '-'}</b></div>
            <select
              value={statusChoice}
              onChange={e => setStatusChoice(e.target.value)}
              style={{ width: '100%', fontSize: '20px', marginTop: 8 }}
            >
              <option value="">-- اختر الحالة الجديدة --</option>
              <option value="وردت الموافقة. رجاء إحضار جواز السفر والأوراق المطلوبة خلال المواعيد المحددة أو الإرسال بالبريد المسجل مع مظروف إعادة مستوفى الطوابع والعنوان">
                1. موافقة
              </option>
              <option value="لم ترد الموافقة">2. لم ترد الموافقة</option>
              <option value="مطلوب إستيفاء">3. مطلوب إستيفاء</option>
              <option value="جارى مراجعة الطلب. رجاء التحقق لاحقاً">4. جارى مراجعة الطلب</option>
            </select>
            <input
              type="text"
              placeholder="تعديل الملاحظات (اختياري)"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              style={{ width: '100%', fontSize: '20px', marginTop: 8 }}
            />
            <button style={{ fontSize: '20px', marginTop: 10 }} onClick={handleEditSubmit}>تحديث الحالة</button>
          </div>
        )}
        <button style={{ fontSize: '20px', marginTop: 30 }} onClick={() => { setEditMode(false); setEditData(null); setSearchBarcode(''); setStatusChoice(''); setNotes(''); }}>
          العودة للرئيسية
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: '50px auto', fontSize: '22px', lineHeight: '2' }}>
      <h2>Visa Tracker</h2>
      {submissionResult && (
        <div style={{ background: '#f0f0f0', border: '1px solid #aaa', marginBottom: 20, padding: 10, whiteSpace: 'pre-line', borderRadius: 6 }}>
          {submissionResult}
          <button style={{ float: 'left', fontSize: 18 }} onClick={() => setSubmissionResult('')}>X</button>
        </div>
      )}
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
      <button style={{ marginInlineStart: 10 }} onClick={() => setEditMode(true)}>تعديل حالة طلب موجود</button>
    </div>
  );
}

export default App;