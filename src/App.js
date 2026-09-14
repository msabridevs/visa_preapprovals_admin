import React, { useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';

const STATUS = {
  REVIEW: 'جارى مراجعة الطلب. رجاء التحقق لاحقاً',
  APPROVED:
    'وردت الموافقة. رجاء إحضار جواز السفر والأوراق المطلوبة خلال المواعيد المحددة أو الإرسال بالبريد المسجل مع مظروف إعادة مستوفى الطوابع والعنوان',
  NOT_APPROVED: 'لم ترد الموافقة',
  REQUIRED: 'مطلوب إستيفاء',
};

function isApproved(status) {
  return (status || '').trim().startsWith('وردت الموافقة');
}

function normalizeDigits(value) {
  return String(value)
    .replace(/[٠-٩]/g, (digit) =>
      String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit))
    )
    .replace(/[۰-۹]/g, (digit) =>
      String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))
    );
}

function todayInBerlin() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const get = (type) =>
    parts.find((part) => part.type === type).value;

  return `${get('year')}-${get('month')}-${get('day')}`;
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) {
    return false;
  }

  const year = Number(value.slice(0, 4));

  if (year < 1900 || year > 9998) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

// ثلاثة أشهر تقويمية من تاريخ صدور الموافقة.
function approvalExpiry(value) {
  if (!isValidDate(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00Z`);
  const year = date.getUTCFullYear();
  const targetMonth = date.getUTCMonth() + 3;

  const lastDay = new Date(
    Date.UTC(year, targetMonth + 1, 0)
  ).getUTCDate();

  return new Date(
    Date.UTC(
      year,
      targetMonth,
      Math.min(date.getUTCDate(), lastDay)
    )
  )
    .toISOString()
    .slice(0, 10);
}

function displayDate(value) {
  return value
    ? value.split('-').reverse().join(' / ')
    : '—';
}

function emptyDate() {
  return { day: '', month: '', year: '' };
}

function splitDate(value) {
  if (!isValidDate(value)) {
    return emptyDate();
  }

  const [year, month, day] = value.split('-');
  return { day, month, year };
}

function joinDate(parts) {
  if (
    !parts.day ||
    !parts.month ||
    parts.year.length !== 4
  ) {
    return '';
  }

  return [
    parts.year,
    parts.month.padStart(2, '0'),
    parts.day.padStart(2, '0'),
  ].join('-');
}

function ApprovalDateFields({
  value,
  onChange,
  disabled,
}) {
  const monthRef = useRef(null);
  const yearRef = useRef(null);

  const issuedOn = joinDate(value);
  const expiry = approvalExpiry(issuedOn);

  const future =
    isValidDate(issuedOn) && issuedOn > todayInBerlin();

  const expired =
    expiry && expiry < todayInBerlin();

  const changePart = (
    field,
    rawValue,
    maxLength,
    nextRef
  ) => {
    const cleaned = normalizeDigits(rawValue)
      .replace(/\D/g, '')
      .slice(0, maxLength);

    onChange({
      ...value,
      [field]: cleaned,
    });

    if (
      cleaned.length === maxLength &&
      nextRef?.current
    ) {
      nextRef.current.focus();
      nextRef.current.select();
    }
  };

  const handlePaste = (event) => {
    const text = normalizeDigits(
      event.clipboardData.getData('text')
    ).trim();

    const match = text.match(
      /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/
    );

    if (!match) {
      return;
    }

    event.preventDefault();

    onChange({
      day: match[1].padStart(2, '0'),
      month: match[2].padStart(2, '0'),
      year: match[3],
    });
  };

  return (
    <div className="approval-date-box">
      <strong>
        تاريخ صدور الموافقة من الجهة المختصة
      </strong>

      <p className="help">
        أدخل تاريخ صدور الموافقة المدون على الموافقة نفسها،
        وليس تاريخ ورودها إلى البعثة أو تاريخ تسجيلها في النظام.
      </p>

      <div
        className="date-fields"
        dir="ltr"
        onPaste={handlePaste}
      >
        <label>
          <span>اليوم</span>

          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="DD"
            maxLength={2}
            value={value.day}
            disabled={disabled}
            onChange={(event) =>
              changePart(
                'day',
                event.target.value,
                2,
                monthRef
              )
            }
            onBlur={() => {
              if (value.day.length === 1) {
                onChange({
                  ...value,
                  day: value.day.padStart(2, '0'),
                });
              }
            }}
            aria-label="يوم صدور الموافقة"
          />
        </label>

        <span className="date-divider">/</span>

        <label>
          <span>الشهر</span>

          <input
            ref={monthRef}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="MM"
            maxLength={2}
            value={value.month}
            disabled={disabled}
            onChange={(event) =>
              changePart(
                'month',
                event.target.value,
                2,
                yearRef
              )
            }
            onBlur={() => {
              if (value.month.length === 1) {
                onChange({
                  ...value,
                  month: value.month.padStart(2, '0'),
                });
              }
            }}
            aria-label="شهر صدور الموافقة"
          />
        </label>

        <span className="date-divider">/</span>

        <label className="year-field">
          <span>السنة</span>

          <input
            ref={yearRef}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="YYYY"
            maxLength={4}
            value={value.year}
            disabled={disabled}
            onChange={(event) =>
              changePart('year', event.target.value, 4)
            }
            aria-label="سنة صدور الموافقة"
          />
        </label>
      </div>

      <p className="help">
        مثال: 10 / 01 / 2026. يمكنك أيضًا لصق التاريخ كاملًا.
      </p>

      {issuedOn && !isValidDate(issuedOn) && (
        <p className="error-text">
          التاريخ غير صحيح. راجع اليوم والشهر والسنة.
        </p>
      )}

      {future && (
        <p className="error-text">
          تاريخ صدور الموافقة لا يجوز أن يكون في المستقبل.
        </p>
      )}

      {expiry && !future && (
        <div
          className={
            expired
              ? 'date-result expired'
              : 'date-result'
          }
        >
          <div>
            تاريخ صدور الموافقة:{' '}
            <b dir="ltr">{displayDate(issuedOn)}</b>
          </div>

          <div>
            تاريخ انتهاء صلاحية الموافقة:{' '}
            <b dir="ltr">{displayDate(expiry)}</b>
          </div>

          <p>
            صلاحية الموافقة 3 أشهر من تاريخ صدور الموافقة.
          </p>

          {expired && (
            <p>
              <strong>
                انتهت صلاحية هذه الموافقة.
              </strong>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function StatusFields({
  status,
  setStatus,
  notes,
  setNotes,
  dateParts,
  setDateParts,
  disabled,
  bulk,
}) {
  return (
    <>
      <label htmlFor="request-status">الحالة</label>

      <select
        id="request-status"
        value={status}
        disabled={disabled}
        onChange={(event) => setStatus(event.target.value)}
      >
        <option value="">-- اختر الحالة --</option>
        <option value={STATUS.APPROVED}>موافقة</option>
        <option value={STATUS.NOT_APPROVED}>
          لم ترد الموافقة
        </option>
        <option value={STATUS.REQUIRED}>
          مطلوب إستيفاء
        </option>
        <option value={STATUS.REVIEW}>
          جارى مراجعة الطلب
        </option>
      </select>

      {isApproved(status) && (
        <>
          <ApprovalDateFields
            value={dateParts}
            onChange={setDateParts}
            disabled={disabled}
          />

          {bulk && (
            <p className="help">
              عند تحديث أكثر من طلب، أدخل معًا الطلبات
              التي تحمل موافقاتها نفس تاريخ صدور الموافقة فقط.
            </p>
          )}
        </>
      )}

      <label htmlFor="request-notes">
        الملاحظات — اختياري
      </label>

      <textarea
        id="request-notes"
        rows={3}
        value={notes}
        disabled={disabled}
        onChange={(event) => setNotes(event.target.value)}
        placeholder="ملاحظات إضافية"
      />
    </>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [barcode, setBarcode] = useState('');
  const [status, setStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [dateParts, setDateParts] = useState(emptyDate);

  const [editMode, setEditMode] = useState(false);
  const [searchBarcode, setSearchBarcode] = useState('');
  const [editData, setEditData] = useState(null);

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const busyRef = useRef(false);

  useEffect(() => {
    let active = true;

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) return;

        if (error) {
          setMessage('تعذر التحقق من تسجيل الدخول.');
        }

        setSession(data?.session || null);
        setAuthLoading(false);
      })
      .catch(() => {
        if (!active) return;

        setMessage(
          'تعذر الاتصال. يرجى إعادة تحميل الصفحة.'
        );
        setAuthLoading(false);
      });

    const { data } =
      supabase.auth.onAuthStateChange(
        (_event, nextSession) => {
          if (active) {
            setSession(nextSession);
          }
        }
      );

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const startBusy = () => {
    if (busyRef.current) return false;

    busyRef.current = true;
    setBusy(true);
    return true;
  };

  const finishBusy = () => {
    busyRef.current = false;
    setBusy(false);
  };

  const resetFields = () => {
    setStatus('');
    setNotes('');
    setDateParts(emptyDate());
  };

  const validateDate = () => {
    if (!isApproved(status)) return true;

    const issuedOn = joinDate(dateParts);

    if (!isValidDate(issuedOn)) {
      setMessage(
        'يرجى إدخال تاريخ صدور الموافقة كاملًا وبصورة صحيحة.'
      );
      return false;
    }

    if (issuedOn > todayInBerlin()) {
      setMessage(
        'تاريخ صدور الموافقة لا يجوز أن يكون في المستقبل.'
      );
      return false;
    }

    return true;
  };

  const buildPayload = () => ({
    status,
    notes: notes.trim(),
    approval_issued_on: isApproved(status)
      ? joinDate(dateParts)
      : null,
  });

  const login = async (event) => {
    event.preventDefault();
    if (!startBusy()) return;

    setMessage('');

    try {
      const { error } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (error) throw error;
      setPassword('');
    } catch (error) {
      setMessage(`تعذر تسجيل الدخول: ${error.message}`);
    } finally {
      finishBusy();
    }
  };

  const logout = async () => {
    if (!startBusy()) return;

    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      setSession(null);
      setEditMode(false);
      setEditData(null);
      setBarcode('');
      setSearchBarcode('');
      resetFields();
      setMessage('');
    } catch (error) {
      setMessage(`تعذر تسجيل الخروج: ${error.message}`);
    } finally {
      finishBusy();
    }
  };

  const handleBarcode = async (event) => {
    event.preventDefault();
    if (busyRef.current) return;

    const codes = [
      ...new Set(
        normalizeDigits(barcode)
          .split(/[\s,،_-]+/)
          .map((code) => code.trim())
          .filter(Boolean)
      ),
    ];

    if (!codes.length) {
      setMessage('يرجى إدخال رقم الطلب.');
      return;
    }

    const invalid = codes.find(
      (code) => !/^\d{4}$/.test(code)
    );

    if (invalid) {
      setMessage(
        `رقم الطلب ${invalid} يجب أن يتكون من 4 أرقام.`
      );
      return;
    }

    if (!validateDate() || !startBusy()) return;

    setMessage('');

    const results = [];
    let failed = false;

    try {
      for (const code of codes) {
        try {
          const { data, error } = await supabase
            .from('visa_requests')
            .select('barcode, status')
            .eq('barcode', code)
            .maybeSingle();

          if (error) throw error;

          if (!data) {
            const { error: insertError } =
              await supabase
                .from('visa_requests')
                .insert({
                  barcode: code,
                  status: STATUS.REVIEW,
                  notes: notes.trim(),
                  approval_issued_on: null,
                });

            if (insertError) throw insertError;

            results.push(
              `✅ ${code}: تم تسجيل الطلب قيد المراجعة.`
            );
          } else if (data.status === STATUS.REVIEW) {
            if (!status) {
              throw new Error(
                'اختر الحالة المطلوب تسجيلها.'
              );
            }

            const {
              data: updated,
              error: updateError,
            } = await supabase
              .from('visa_requests')
              .update(buildPayload())
              .eq('barcode', code)
              .eq('status', STATUS.REVIEW)
              .select('barcode');

            if (updateError) throw updateError;

            if (!updated?.length) {
              throw new Error(
                'لم يتم الحفظ. أعد البحث وتحقق من صلاحيات الحساب.'
              );
            }

            results.push(
              isApproved(status)
                ? `✅ ${code}: تم تسجيل الموافقة. تاريخ صدور الموافقة: ${displayDate(
                    joinDate(dateParts)
                  )}.`
                : `✅ ${code}: تم تحديث الحالة.`
            );
          } else {
            results.push(
              `ℹ️ ${code}: خطأ.الطلب سبق معالجته. استخدم «تعديل طلب» لتغييره.`
            );
          }
        } catch (error) {
          failed = true;

          results.push(
            `❌ ${code}: ${error.message || 'تعذر الحفظ.'}`
          );
        }
      }

      setMessage(results.join('\n'));

      if (!failed) {
        setBarcode('');
        resetFields();
      }
    } finally {
      finishBusy();
    }
  };

  const searchForEdit = async (event) => {
    event.preventDefault();
    if (busyRef.current) return;

    const code = normalizeDigits(searchBarcode).trim();

    if (!/^\d{4}$/.test(code)) {
      setMessage('أدخل رقم طلب مكوّنًا من 4 أرقام.');
      return;
    }

    if (!startBusy()) return;

    setEditData(null);
    resetFields();
    setMessage('');

    try {
      const { data, error } = await supabase
        .from('visa_requests')
        .select(
          'barcode, status, notes, approval_issued_on'
        )
        .eq('barcode', code)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setMessage('لم يتم العثور على هذا الطلب.');
        return;
      }

      setEditData(data);
      setStatus(
        isApproved(data.status)
          ? STATUS.APPROVED
          : data.status
      );
      setNotes(data.notes || '');
      setDateParts(splitDate(data.approval_issued_on));
    } catch (error) {
      setMessage(`تعذر البحث: ${error.message}`);
    } finally {
      finishBusy();
    }
  };

  const saveEdit = async (event) => {
    event.preventDefault();
    if (!editData || busyRef.current) return;

    if (!status) {
      setMessage('يرجى اختيار الحالة.');
      return;
    }

    if (!validateDate() || !startBusy()) return;

    setMessage('');

    try {
      const { data, error } = await supabase
        .from('visa_requests')
        .update(buildPayload())
        .eq('barcode', editData.barcode)
        .select('barcode');

      if (error) throw error;

      if (!data?.length) {
        throw new Error(
          'لم يتم الحفظ. تحقق من وجود الطلب وصلاحيات الحساب.'
        );
      }

      setMessage(
        `✅ تم حفظ تعديلات الطلب ${editData.barcode}.`
      );

      setEditData(null);
      setSearchBarcode('');
      setEditMode(false);
      resetFields();
    } catch (error) {
      setMessage(`تعذر الحفظ: ${error.message}`);
    } finally {
      finishBusy();
    }
  };

  const changeMode = (nextMode) => {
    if (busyRef.current) return;

    setEditMode(nextMode);
    setEditData(null);
    setSearchBarcode('');
    resetFields();
    setMessage('');
  };

  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap"
      />

      <style>{`
        .admin-page {
          min-height: 100vh;
          padding: 24px 12px;
          background: #f2f7fb;
          color: #1d2939;
          font-family: 'Cairo', 'Segoe UI', Arial, sans-serif;
          direction: rtl;
        }

        .admin-page * {
          box-sizing: border-box;
        }

        .admin-card {
          max-width: 640px;
          margin: 16px auto;
          padding: 28px;
          background: white;
          border: 1px solid #dbe5ef;
          border-radius: 18px;
          box-shadow: 0 8px 28px #0a5dab12;
        }

        .admin-page h1 {
          margin: 0 0 24px;
          color: #0a5dab;
          font-size: 26px;
          text-align: center;
        }

        .admin-page label {
          display: block;
          margin-bottom: 8px;
          font-weight: 700;
        }

        .admin-page input,
        .admin-page textarea,
        .admin-page select {
          width: 100%;
          margin-bottom: 18px;
          padding: 13px;
          border: 1px solid #bdcbd9;
          border-radius: 10px;
          background: #fff;
          color: #1d2939;
          font: inherit;
          font-size: 18px;
        }

        .admin-page textarea {
          resize: vertical;
        }

        .admin-page input:focus,
        .admin-page textarea:focus,
        .admin-page select:focus {
          outline: 3px solid #0a5dab20;
          border-color: #0a5dab;
        }

        .admin-page button {
          padding: 12px 20px;
          border: 0;
          border-radius: 10px;
          background: #0a5dab;
          color: white;
          font: inherit;
          font-weight: 700;
          cursor: pointer;
        }

        .admin-page button:disabled {
          opacity: .55;
          cursor: wait;
        }

        .admin-page button.secondary {
          background: #e9f1f9;
          color: #0a5dab;
        }

        .admin-page button.danger {
          background: #b42335;
        }

        .actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 16px;
        }

        .message {
          margin-bottom: 20px;
          padding: 15px;
          border: 1px solid #c8dced;
          border-radius: 10px;
          background: #f2f8fe;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
          line-height: 1.9;
        }

        .help {
          color: #5d6d7d;
          font-size: 14px;
          line-height: 1.9;
        }

        .approval-date-box {
          padding: 18px;
          margin: 0 0 20px;
          border: 1px solid #bdd8ef;
          border-radius: 12px;
          background: #f6fbff;
        }

        .date-fields {
          display: flex;
          align-items: flex-end;
          justify-content: center;
          gap: 9px;
        }

        .date-fields label {
          flex: 1;
          min-width: 0;
          max-width: 100px;
          margin: 0;
          text-align: center;
        }

        .date-fields label.year-field {
          max-width: 140px;
          flex: 1.4;
        }

        .date-fields label span {
          display: block;
          margin-bottom: 8px;
          font-size: 15px;
        }

        .date-fields input {
          margin: 0;
          padding: 12px 5px;
          text-align: center;
          font-size: 24px;
          font-family: 'Segoe UI', Arial, sans-serif;
        }

        .date-divider {
          padding-bottom: 14px;
          color: #8190a0;
          font-size: 24px;
        }

        .date-result {
          padding: 13px;
          border-radius: 9px;
          background: #e8f6ed;
          color: #17663a;
          line-height: 1.9;
        }

        .date-result p {
          margin: 5px 0 0;
          font-size: 14px;
        }

        .date-result.expired {
          background: #fff0e3;
          color: #934900;
        }

        .error-text {
          color: #b42335;
          font-size: 14px;
        }

        .current-request {
          margin: 20px 0;
          padding: 15px;
          background: #f5f7fa;
          border-radius: 10px;
          line-height: 1.9;
        }

        @media (max-width: 480px) {
          .admin-card { padding: 18px; }
          .admin-page h1 { font-size: 22px; }
          .date-fields { gap: 5px; }
        }
      `}</style>

      <main className="admin-page">
        <div className="admin-card">
          <h1>
            {!session
              ? 'تسجيل الدخول'
              : editMode
                ? 'تعديل طلب'
                : 'متابعة معاملات التأشيرات'}
          </h1>

          {message && (
            <div
              className="message"
              role="status"
              aria-live="polite"
            >
              {message}
            </div>
          )}

          {authLoading ? (
            <p>جارٍ التحميل…</p>
          ) : !session ? (
            <form onSubmit={login}>
              <label htmlFor="email">
                البريد الإلكتروني
              </label>

              <input
                id="email"
                type="email"
                autoComplete="username"
                dir="ltr"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                required
                disabled={busy}
              />

              <label htmlFor="password">
                كلمة المرور
              </label>

              <input
                id="password"
                type="password"
                autoComplete="current-password"
                dir="ltr"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                required
                disabled={busy}
              />

              <button type="submit" disabled={busy}>
                {busy ? 'جارٍ الدخول…' : 'دخول'}
              </button>
            </form>
          ) : editMode ? (
            <>
              <form onSubmit={searchForEdit}>
                <label htmlFor="search-barcode">
                  رقم الطلب
                </label>

                <input
                  id="search-barcode"
                  type="text"
                  inputMode="numeric"
                  value={searchBarcode}
                  onChange={(event) =>
                    setSearchBarcode(
                      normalizeDigits(event.target.value)
                        .replace(/\D/g, '')
                        .slice(0, 4)
                    )
                  }
                  placeholder="مثال: 1234"
                  disabled={busy}
                />

                <button type="submit" disabled={busy}>
                  بحث
                </button>
              </form>

              {editData && (
                <form onSubmit={saveEdit}>
                  <div className="current-request">
                    <b>الطلب: {editData.barcode}</b>
                    <div>
                      الحالة الحالية: {editData.status}
                    </div>
                  </div>

                  <StatusFields
                    status={status}
                    setStatus={setStatus}
                    notes={notes}
                    setNotes={setNotes}
                    dateParts={dateParts}
                    setDateParts={setDateParts}
                    disabled={busy}
                    bulk={false}
                  />

                  <button type="submit" disabled={busy}>
                    {busy ? 'جارٍ الحفظ…' : 'حفظ التعديلات'}
                  </button>
                </form>
              )}

              <div className="actions">
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={() => changeMode(false)}
                >
                  العودة للرئيسية
                </button>
              </div>
            </>
          ) : (
            <>
              <form onSubmit={handleBarcode}>
                <label htmlFor="barcodes">
                  رقم الطلب أو أرقام الطلبات
                </label>

                <textarea
                  id="barcodes"
                  rows={3}
                  value={barcode}
                  onChange={(event) =>
                    setBarcode(event.target.value)
                  }
                  placeholder="1234, 2441, 3666"
                  disabled={busy}
                />

                <p className="help">
                  الطلب الجديد يُسجّل أولًا قيد المراجعة.
                  لتسجيل موافقته بعد ذلك، أدخل رقمه مجددًا
                  أو استخدم تعديل طلب.
                </p>

                <StatusFields
                  status={status}
                  setStatus={setStatus}
                  notes={notes}
                  setNotes={setNotes}
                  dateParts={dateParts}
                  setDateParts={setDateParts}
                  disabled={busy}
                  bulk
                />

                <button type="submit" disabled={busy}>
                  {busy ? 'جارٍ الحفظ…' : 'حفظ'}
                </button>
              </form>

              <div className="actions">
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={() => changeMode(true)}
                >
                  تعديل طلب
                </button>

                <button
                  type="button"
                  className="danger"
                  disabled={busy}
                  onClick={logout}
                >
                  تسجيل الخروج
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}