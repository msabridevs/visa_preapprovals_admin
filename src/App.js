import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';

const MAIN_COLOR = "#0A5DAB";
const SECONDARY_COLOR = "#F2F7FB";
const DANGER_COLOR = "#D7263D";
const SUCCESS_COLOR = "#26A65B";
const BORDER_RADIUS = "12px";
const FONT_FAMILY = "'Cairo', 'Tajawal', 'Segoe UI', 'Arial', sans-serif";
const FONT_SIZE = "22px";

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
        resultMsgs.push(`✅ تم إضافة باركود ${code} بالحالة: جارى مراجعة الطلب.`);
      } else if (data.status === 'جارى مراجعة الطلب. رجاء التحقق لاحقاً') {
        if (!statusChoice) {
          alert('يرجى اختيار حالة من القائمة.');
          return;
        }
        await supabase.from('visa_requests').update({ status: statusChoice, notes }).eq('barcode', code);
        resultMsgs.push(`🔄 تم تحديث باركود ${code} إلى الحالة: ${statusChoice}`);
      } else {
        resultMsgs.push(`⚠️ تمت معالجة الباركود رقم ${code} مسبقاً (الحالة الحالية: ${data.status}).`);
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

    setSubmissionResult(`🔄 تم تحديث باركود ${editData.barcode} إلى الحالة: ${statusChoice}`);
    setEditMode(false);
    setEditData(null);
    setSearchBarcode('');
    setNotes('');
    setStatusChoice('');
  };

  // --- UI Styles ---
  const styles = {
    container: {
      maxWidth: 560,
      margin: '40px auto',
      background: SECONDARY_COLOR,
      borderRadius: BORDER_RADIUS,
      boxShadow: "0 2px 16px #0001",
      padding: 32,
      fontFamily: FONT_FAMILY,
      fontSize: FONT_SIZE,
      color: "#1D1D1D",
      direction: "rtl",
    },
    h2: {
      color: MAIN_COLOR,
      fontWeight: 900,
      textAlign: "center",
      marginBottom: 28,
      letterSpacing: 1,
    },
    input: {
      width: "100%",
      fontSize: FONT_SIZE,
      fontFamily: FONT_FAMILY,
      padding: "14px",
      margin: "8px 0 18px",
      borderRadius: BORDER_RADIUS,
      border: "1px solid #b6bdd2",
      background: "#fff",
      outline: "none",
      boxSizing: "border-box",
      transition: "border-color 0.2s",
    },
    textarea: {
      width: "100%",
      fontSize: FONT_SIZE,
      fontFamily: FONT_FAMILY,
      padding: "14px",
      borderRadius: BORDER_RADIUS,
      border: "1px solid #b6bdd2",
      background: "#fff",
      margin: "8px 0 18px",
      outline: "none",
      boxSizing: "border-box",
      transition: "border-color 0.2s",
      resize: "vertical",
    },
    select: {
      width: "100%",
      fontSize: FONT_SIZE,
      fontFamily: FONT_FAMILY,
      padding: "14px",
      borderRadius: BORDER_RADIUS,
      border: "1px solid #b6bdd2",
      background: "#fff",
      margin: "8px 0 18px",
      outline: "none",
      boxSizing: "border-box",
      transition: "border-color 0.2s",
    },
    button: {
      background: MAIN_COLOR,
      color: "#fff",
      fontSize: "23px",
      fontWeight: 700,
      fontFamily: FONT_FAMILY,
      padding: "13px 26px",
      border: "none",
      borderRadius: BORDER_RADIUS,
      margin: "6px 8px 6px 0",
      cursor: "pointer",
      transition: "background 0.2s",
      boxShadow: "0 2px 8px #0A5DAB22",
      letterSpacing: 1,
    },
    buttonDanger: {
      background: DANGER_COLOR,
      color: "#fff",
      fontSize: "21px",
      fontWeight: 600,
      fontFamily: FONT_FAMILY,
      padding: "10px 18px",
      border: "none",
      borderRadius: BORDER_RADIUS,
      margin: "6px 8px 6px 0",
      cursor: "pointer",
      transition: "background 0.2s",
      boxShadow: "0 2px 8px #D7263D22",
      letterSpacing: 1,
    },
    buttonSecondary: {
      background: "#fff",
      color: MAIN_COLOR,
      fontSize: "21px",
      fontWeight: 600,
      fontFamily: FONT_FAMILY,
      padding: "10px 18px",
      border: `2px solid ${MAIN_COLOR}`,
      borderRadius: BORDER_RADIUS,
      margin: "6px 8px 6px 0",
      cursor: "pointer",
      transition: "background 0.2s, color 0.2s",
      boxShadow: "0 2px 8px #0A5DAB11",
      letterSpacing: 1,
    },
    result: {
      background: "#fff",
      border: `2px solid ${MAIN_COLOR}`,
      color: MAIN_COLOR,
      padding: "18px",
      fontSize: "20px",
      borderRadius: BORDER_RADIUS,
      marginBottom: 20,
      whiteSpace: 'pre-line',
      boxShadow: "0 2px 12px #0A5DAB11",
      position: "relative",
    },
    closeX: {
      position: "absolute",
      left: 10,
      top: 10,
      background: "transparent",
      border: "none",
      color: DANGER_COLOR,
      fontWeight: 900,
      fontSize: "22px",
      cursor: "pointer",
    },
    smallLabel: {
      color: "#888",
      fontSize: "15px",
      marginBottom: "2px",
      display: "block",
      fontWeight: 500,
    },
    faded: {
      color: "#aaa",
      fontSize: "17px",
    }
  };

  // ---- UI Render ----
  if (!session) {
    return (
      <div style={styles.container}>
        <h2 style={styles.h2}>تسجيل الدخول</h2>
        <label style={styles.smallLabel}>البريد الإلكتروني:</label>
        <input style={styles.input} type="email" placeholder="Email" onChange={e => setEmail(e.target.value)} autoComplete="username" />
        <label style={styles.smallLabel}>كلمة المرور:</label>
        <input style={styles.input} type="password" placeholder="Password" onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
        <button style={styles.button} onClick={login}>دخول</button>
      </div>
    );
  }

  if (editMode) {
    return (
      <div style={styles.container}>
        <h2 style={styles.h2}>تعديل حالة الطلب</h2>
        <label style={styles.smallLabel}>بحث برقم الباركود:</label>
        <div style={{display:'flex', gap: '8px'}}>
          <input
            style={{...styles.input, margin:'0 0 10px 0', flex:1}}
            type="text"
            placeholder="أدخل رقم الباركود"
            value={searchBarcode}
            onChange={e => setSearchBarcode(e.target.value)}
          />
          <button style={{...styles.button, padding:"11px 18px", fontSize:19}} onClick={handleSearchForEdit}>بحث</button>
        </div>
        {editData && (
          <div style={{ marginTop: 20, background:'#f7f9fa', borderRadius:BORDER_RADIUS, padding:16, boxShadow:"0 2px 8px #0A5DAB08" }}>
            <div><span style={styles.smallLabel}>الحالة الحالية:</span><b style={{color: MAIN_COLOR}}>{editData.status}</b></div>
            <div><span style={styles.smallLabel}>الملاحظات الحالية:</span><b style={{color:'#555'}}>{editData.notes || '-'}</b></div>
            <label style={styles.smallLabel}>تغيير الحالة:</label>
            <select
              value={statusChoice}
              onChange={e => setStatusChoice(e.target.value)}
              style={styles.select}
            >
              <option value="">-- اختر الحالة الجديدة --</option>
              <option value="وردت الموافقة. رجاء إحضار جواز السفر والأوراق المطلوبة خلال المواعيد المحددة أو الإرسال بالبريد المسجل مع مظروف إعادة مستوفى الطوابع والعنوان">
                1. موافقة
              </option>
              <option value="لم ترد الموافقة">2. لم ترد الموافقة</option>
              <option value="مطلوب إستيفاء">3. مطلوب إستيفاء</option>
              <option value="جارى مراجعة الطلب. رجاء التحقق لاحقاً">4. جارى مراجعة الطلب</option>
            </select>
            <label style={styles.smallLabel}>الملاحظات (اختياري):</label>
            <input
              type="text"
              placeholder="تعديل الملاحظات"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              style={styles.input}
            />
            <button style={styles.button} onClick={handleEditSubmit}>تحديث الحالة</button>
          </div>
        )}
        <button style={styles.buttonSecondary} onClick={() => { setEditMode(false); setEditData(null); setSearchBarcode(''); setStatusChoice(''); setNotes(''); }}>
          العودة للرئيسية
        </button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.h2}>متابعة معاملات التأشيرات</h2>
      {submissionResult && (
        <div style={styles.result}>
          {submissionResult}
          <button style={styles.closeX} onClick={() => setSubmissionResult('')}>✖</button>
        </div>
      )}
      <label style={styles.smallLabel}>أدخل الباركود (رقم أو أرقام مفصولة بفواصل - أو _):</label>
      <textarea
        rows="3"
        placeholder="مثل: 1234, 2441-3666"
        value={barcode}
        onChange={e => setBarcode(e.target.value)}
        style={styles.textarea}
      />
      <label style={styles.smallLabel}>ملاحظات:</label>
      <input
        type="text"
        placeholder="ملاحظات إضافية"
        value={notes}
        onChange={e => setNotes(e.target.value)}
        style={styles.input}
      />
      <label style={styles.smallLabel}>الحالة:</label>
      <select
        value={statusChoice}
        onChange={e => setStatusChoice(e.target.value)}
        style={styles.select}
      >
        <option value="">-- اختر الحالة --</option>
        <option value="وردت الموافقة. رجاء إحضار جواز السفر والأوراق المطلوبة خلال المواعيد المحددة أو الإرسال بالبريد المسجل مع مظروف إعادة مستوفى الطوابع والعنوان">
          1. موافقة
        </option>
        <option value="لم ترد الموافقة">2. لم ترد الموافقة</option>
        <option value="مطلوب إستيفاء">3. مطلوب إستيفاء</option>
        <option value="جارى مراجعة الطلب. رجاء التحقق لاحقاً">4. جارى مراجعة الطلب</option>
      </select>
      <div style={{display:'flex', flexWrap:'wrap', gap:'10px'}}>
        <button style={styles.button} onClick={handleBarcode}>إرسال</button>
        <button style={styles.buttonSecondary} onClick={logout}>تسجيل خروج</button>
        <button style={styles.buttonDanger} onClick={() => setEditMode(true)}>تعديل حالة طلب</button>
      </div>
      <div style={{marginTop:38, textAlign:'center'}}>
        <span style={styles.faded}>جميع الحقوق محفوظة &copy; {new Date().getFullYear()}</span>
      </div>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&family=Tajawal:wght@400;700;900&display=swap" rel="stylesheet" />
    </div>
  );
}

export default App;