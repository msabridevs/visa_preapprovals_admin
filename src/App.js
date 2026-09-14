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

// نرفض المدخل المخالف بالكامل حتى لا يتغير رقم الطلب دون قصد.
function NumericInput({
  value,
  onChange,
  digits,
  inputRef,
  onInvalid,
  ...props
}) {
  const accept = (next) => {
    if (!/^[0-9]*$/.test(next) || next.length > digits) {
      onInvalid(
        `المسموح أرقام إنجليزية فقط (0–9)، بحد أقصى ${digits} خانات، دون مسافات أو رموز.`
      );
      return;
    }

    onChange(next);
  };

  return (
    <input
      {...props}
      ref={inputRef}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      spellCheck={false}
      dir="ltr"
      value={value}
      onChange={(event) => accept(event.target.value)}
      onPaste={(event) => {
        event.preventDefault();

        const input = event.currentTarget;
        const pasted = event.clipboardData.getData('text');

        const next =
          value.slice(0, input.selectionStart ?? value.length) +
          pasted +
          value.slice(input.selectionEnd ?? value.length);

        accept(next);
      }}
      onDrop={(event) => event.preventDefault()}
    />
  );
}

function Notice({ message, onClose }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!message) return undefined;

    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;

    dialog.showModal();
    document.body.style.overflow = 'hidden';

    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;

      if (
        previousFocus instanceof HTMLElement &&
        previousFocus.isConnected
      ) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, [message]);

  return (
    <dialog
      ref={dialogRef}
      className="notice-dialog"
      role="alertdialog"
      aria-labelledby="notice-title"
      aria-describedby="notice-text"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <h2 id="notice-title">إشعار</h2>
      <p id="notice-text">{message}</p>

      <button type="button" onClick={onClose}>
        حسنًا، إغلاق
      </button>
    </dialog>
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
  onInvalid,
}) {
  const monthRef = useRef(null);
  const yearRef = useRef(null);

  const issuedOn = joinDate(value);
  const expiry = approvalExpiry(issuedOn);

  const future =
    isValidDate(issuedOn) && issuedOn > todayInBerlin();

  const expired = expiry && expiry < todayInBerlin();

  const changePart = (
    field,
    rawValue,
    maxLength,
    nextRef
  ) => {
    onChange((previous) => ({
      ...previous,
      [field]: rawValue,
    }));

    if (
      rawValue.length === maxLength &&
      nextRef?.current
    ) {
      nextRef.current.focus();
      nextRef.current.select();
    }
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

      <div className="date-fields" dir="ltr">
        <label htmlFor="approval-day">
          <span>اليوم</span>

          <NumericInput
            id="approval-day"
            placeholder="DD"
            digits={2}
            onInvalid={onInvalid}
            value={value.day}
            disabled={disabled}
            onChange={(next) =>
              changePart('day', next, 2, monthRef)
            }
            onBlur={() => {
              if (value.day.length === 1) {
                onChange((previous) => ({
                  ...previous,
                  day: previous.day.padStart(2, '0'),
                }));
              }
            }}
            aria-label="يوم صدور الموافقة"
          />
        </label>

        <span className="date-divider">/</span>

        <label htmlFor="approval-month">
          <span>الشهر</span>

          <NumericInput
            id="approval-month"
            inputRef={monthRef}
            placeholder="MM"
            digits={2}
            onInvalid={onInvalid}
            value={value.month}
            disabled={disabled}
            onChange={(next) =>
              changePart('month', next, 2, yearRef)
            }
            onBlur={() => {
              if (value.month.length === 1) {
                onChange((previous) => ({
                  ...previous,
                  month: previous.month.padStart(2, '0'),
                }));
              }
            }}
            aria-label="شهر صدور الموافقة"
          />
        </label>

        <span className="date-divider">/</span>

        <label
          className="year-field"
          htmlFor="approval-year"
        >
          <span>السنة</span>

          <NumericInput
            id="approval-year"
            inputRef={yearRef}
            placeholder="YYYY"
            digits={4}
            onInvalid={onInvalid}
            value={value.year}
            disabled={disabled}
            onChange={(next) =>
              changePart('year', next, 4)
            }
            aria-label="سنة صدور الموافقة"
          />
        </label>
      </div>

      <p className="help">
        أدخل اليوم ثم الشهر ثم السنة بالأرقام الإنجليزية؛
        ينتقل المؤشر تلقائيًا للخانة التالية.
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
            <strong>
              صلاحية الموافقة 3 أشهر من تاريخ صدور الموافقة.
            </strong>
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
  registrationOnly,
  onInvalid,
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

        {!registrationOnly && (
          <>
            <option value={STATUS.APPROVED}>
              موافقة
            </option>

            <option value={STATUS.NOT_APPROVED}>
              لم ترد الموافقة
            </option>

            <option value={STATUS.REQUIRED}>
              مطلوب إستيفاء
            </option>
          </>
        )}

        <option value={STATUS.REVIEW}>
          جارى مراجعة الطلب
        </option>
      </select>

      {isApproved(status) && (
        <>
          <ApprovalDateFields
            value={dateParts}
            onChange={setDateParts}
            onInvalid={onInvalid}
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
        maxLength={5000}
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
  const [permitted, setPermitted] = useState(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [mode, setMode] = useState('register');
  const [barcode, setBarcode] = useState('');
  const [selectedCodes, setSelectedCodes] = useState([]);
  const barcodeRef = useRef(null);

  const [records, setRecords] = useState([]);
  const [status, setStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [notesChanged, setNotesChanged] = useState(false);
  const [dateParts, setDateParts] = useState(emptyDate);

  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  useEffect(() => {
    let active = true;

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) return;

        if (error) {
          setMessage(
            'تعذر التحقق من الجلسة. أعد تحميل الصفحة.'
          );
        }

        setSession(data?.session || null);
        setAuthLoading(false);
      })
      .catch(() => {
        if (!active) return;

        setMessage('تعذر الاتصال. أعد تحميل الصفحة.');
        setAuthLoading(false);
      });

    const { data } = supabase.auth.onAuthStateChange(
      (_event, next) => {
        if (active) setSession(next);
      }
    );

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;

    setPermitted(null);
    setRecords([]);
    setStatus('');
    setNotes('');
    setNotesChanged(false);
    setDateParts(emptyDate());

    if (session) {
      supabase
        .rpc('visa_admin_access')
        .then(({ data, error }) => {
          if (!active) return;

          setPermitted(!error && data === true);

          if (error) {
            setMessage(
              `تعذر التحقق من الصلاحيات: ${error.message}`
            );
          }
        })
        .catch(() => {
          if (active) {
            setPermitted(false);
            setMessage('تعذر التحقق من الصلاحيات.');
          }
        });
    }

    return () => {
      active = false;
    };
  }, [session]);

  const start = () => {
    if (busyRef.current) return false;

    busyRef.current = true;
    setBusy(true);
    return true;
  };

  const finish = () => {
    busyRef.current = false;
    setBusy(false);
  };

  const clearFields = () => {
    setRecords([]);
    setStatus('');
    setNotes('');
    setNotesChanged(false);
    setDateParts(emptyDate());
  };

  const parseCodes = () => {
    if (mode !== 'edit' && barcode) {
      throw new Error(
        'اضغط «إضافة الرقم» لإضافة الرقم المكتوب أولًا، أو امسحه من الخانة.'
      );
    }

    const values =
      mode === 'edit' ? [barcode] : selectedCodes;

    if (!values.length || values.length > 100) {
      throw new Error('أدخل من رقم واحد إلى 100 رقم.');
    }

    if (values.some((code) => !/^[0-9]{4}$/.test(code))) {
      throw new Error(
        'كل رقم طلب يجب أن يتكون من أربعة أرقام.'
      );
    }

    if (new Set(values).size !== values.length) {
      throw new Error(
        'يوجد رقم مكرر. احذف التكرار قبل المتابعة.'
      );
    }

    if (mode === 'edit' && values.length !== 1) {
      throw new Error(
        'أدخل رقمًا واحدًا في وضع تعديل طلب.'
      );
    }

    return values;
  };

  const addCode = () => {
    if (busyRef.current) return;

    if (!/^[0-9]{4}$/.test(barcode)) {
      setMessage(
        'أدخل رقم طلب من أربعة أرقام إنجليزية، ثم اضغط «إضافة الرقم».'
      );
      return;
    }

    if (selectedCodes.includes(barcode)) {
      setMessage('هذا الرقم موجود بالفعل في القائمة.');
      return;
    }

    if (selectedCodes.length >= 100) {
      setMessage('الحد الأقصى 100 طلب في العملية الواحدة.');
      return;
    }

    setSelectedCodes((previous) => [...previous, barcode]);
    setBarcode('');
    clearFields();
    barcodeRef.current?.focus();
  };

  const login = async (event) => {
    event.preventDefault();

    if (!start()) return;

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
      setMessage(`تعذر الدخول: ${error.message}`);
    } finally {
      finish();
    }
  };

  const logout = async () => {
    if (!start()) return;

    try {
      const { error } = await supabase.auth.signOut();

      if (error) throw error;

      clearFields();
      setBarcode('');
      setSelectedCodes([]);
      setMessage('');
    } catch (error) {
      setMessage(`تعذر الخروج: ${error.message}`);
    } finally {
      finish();
    }
  };

  const loadRequests = async () => {
    if (!permitted || !start()) return;

    setMessage('');
    clearFields();

    try {
      const codes = parseCodes();

      const { data, error } = await supabase.rpc(
        'visa_admin_read',
        { p_codes: codes }
      );

      if (error) throw error;

      if (
        !Array.isArray(data) ||
        data.length !== codes.length
      ) {
        throw new Error(
          'لم يتم تحميل جميع الطلبات؛ أعد المحاولة.'
        );
      }

      if (
        mode === 'update' &&
        data.some((row) => row.status !== STATUS.REVIEW)
      ) {
        throw new Error(
          'يوجد طلب سبق معالجته. استخدم «تعديل طلب» له.'
        );
      }

      setRecords(data);

      if (data.length === 1) {
        setNotes(data[0].notes || '');
        setDateParts(
          splitDate(data[0].approval_issued_on)
        );
      }

      setMessage(
        'تم التحقق من التسجيل السابق. اختر الحالة المطلوبة صراحةً ثم احفظ.'
      );
    } catch (error) {
      setMessage(error.message || 'تعذر تحميل الطلبات.');
    } finally {
      finish();
    }
  };

  const save = async (event) => {
    event.preventDefault();

    if (!permitted || busyRef.current) return;

    let codes;

    try {
      codes = parseCodes();

      if (!Object.values(STATUS).includes(status)) {
        throw new Error(
          'يجب اختيار الحالة صراحةً قبل الحفظ.'
        );
      }

      if (
        mode === 'register' &&
        status !== STATUS.REVIEW
      ) {
        throw new Error(
          'التسجيل الأول مسموح بحالة «جارى مراجعة الطلب» فقط.'
        );
      }

      if (
        mode !== 'register' &&
        (
          records.length !== codes.length ||
          codes.some(
            (code) =>
              !records.some(
                (row) => row.barcode === code
              )
          )
        )
      ) {
        throw new Error(
          'حمّل الطلبات للتحقق من تسجيلها السابق قبل الحفظ.'
        );
      }

      const issuedOn = joinDate(dateParts);

      if (
        isApproved(status) &&
        (
          !isValidDate(issuedOn) ||
          issuedOn > todayInBerlin()
        )
      ) {
        throw new Error(
          'أدخل تاريخ صدور الموافقة الصحيح؛ لا يجوز أن يكون في المستقبل.'
        );
      }

      if (notes.length > 5000) {
        throw new Error(
          'الملاحظات لا تزيد على 5000 حرف.'
        );
      }
    } catch (error) {
      setMessage(error.message);
      return;
    }

    if (!start()) return;

    setMessage('');

    try {
      const expected = Object.fromEntries(
        records.map((row) => [
          row.barcode,
          row.write_token,
        ])
      );

      const { data, error } = await supabase.rpc(
        'visa_admin_save',
        {
          p_mode: mode,
          p_codes: codes,
          p_status: status,
          p_notes:
            mode === 'register' || notesChanged
              ? notes.trim()
              : null,
          p_approval_issued_on: isApproved(status)
            ? joinDate(dateParts)
            : null,
          p_expected: expected,
        }
      );

      if (error) {
        const confirmedRejection =
          /^[0-9A-Z]{5}$/.test(error.code || '');

        setMessage(
          confirmedRejection
            ? `لم يتم حفظ أي تغيير في هذه العملية.\n${error.message}`
            : `تعذر تأكيد نتيجة الحفظ. تحقق من الطلبات قبل إعادة المحاولة.\n${error.message}`
        );
        return;
      }

      if (!data?.ok || data.count !== codes.length) {
        setMessage(
          'تعذر تأكيد نتيجة الحفظ. تحقق من الطلبات قبل إعادة المحاولة.'
        );
        return;
      }

      setMessage(
        mode === 'register'
          ? `✅ تم تسجيل جميع الطلبات (${data.count}) قيد المراجعة. يمكنك الآن تحميلها من «تحديث الطلبات».`
          : `✅ تم حفظ جميع التعديلات (${data.count}) بنجاح.`
      );

      setBarcode('');
      setSelectedCodes([]);
      clearFields();
    } catch (error) {
      setMessage(
        `تعذر تأكيد نتيجة الحفظ. تحقق من الطلبات قبل إعادة المحاولة.\n${error.message || ''}`
      );
    } finally {
      finish();
    }
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

        .admin-page button:focus-visible {
          outline: 3px solid #e89900;
          outline-offset: 3px;
        }

        .actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 16px;
        }

        .notice-dialog {
          position: fixed;
          inset: 0;
          margin: auto;
          width: min(480px, calc(100vw - 32px));
          max-height: calc(100dvh - 32px);
          overflow: auto;
          padding: 28px;
          border: 2px solid #0a5dab;
          border-radius: 18px;
          background: white;
          color: #1d2939;
          text-align: center;
          font: inherit;
          box-shadow: 0 24px 80px #0005;
        }

        .notice-dialog::backdrop {
          background: #12233899;
        }

        .notice-dialog h2 {
          margin: 0 0 16px;
          color: #0a5dab;
        }

        .notice-dialog p {
          white-space: pre-wrap;
          overflow-wrap: anywhere;
          line-height: 2;
        }

        .notice-dialog button {
          min-width: 160px;
        }

        .number-entry {
          display: flex;
          align-items: start;
          gap: 10px;
        }

        .number-entry input {
          min-width: 0;
          flex: 1;
        }

        .number-entry button {
          white-space: nowrap;
        }

        .code-list {
          list-style: none;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          padding: 0;
        }

        .code-list li {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #e9f1f9;
          border-radius: 8px;
          padding: 5px 10px;
        }

        .code-list button {
          padding: 2px 10px;
          font-size: 22px;
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
          .admin-card {
            padding: 18px;
          }

          .admin-page h1 {
            font-size: 22px;
          }

          .date-fields {
            gap: 5px;
          }
        }
      `}</style>

      <main className="admin-page">
        <div className="admin-card">
          <h1>متابعة معاملات التأشيرات</h1>

          <Notice
            message={message}
            onClose={() => setMessage('')}
          />

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
                dir="ltr"
                autoComplete="username"
                required
                disabled={busy}
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
              />

              <label htmlFor="password">
                كلمة المرور
              </label>

              <input
                id="password"
                type="password"
                dir="ltr"
                autoComplete="current-password"
                required
                disabled={busy}
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
              />

              <button type="submit" disabled={busy}>
                {busy ? 'جارٍ الدخول…' : 'دخول'}
              </button>
            </form>
          ) : permitted === null ? (
            <p>جارٍ التحقق من صلاحيات الحساب…</p>
          ) : !permitted ? (
            <>
              <p>
                الحساب غير مصرح له بإدارة الطلبات،
                أو تعذر التحقق من صلاحياته.
              </p>

              <button
                type="button"
                disabled={busy}
                onClick={logout}
              >
                تسجيل الخروج
              </button>
            </>
          ) : (
            <>
              <label htmlFor="operation">
                نوع العملية
              </label>

              <select
                id="operation"
                value={mode}
                disabled={busy}
                onChange={(event) => {
                  setMode(event.target.value);
                  setBarcode('');
                  setSelectedCodes([]);
                  clearFields();
                  setMessage('');
                }}
              >
                <option value="register">
                  تسجيل جديد — قيد المراجعة فقط
                </option>

                <option value="update">
                  تحديث طلبات مسجّلة قيد المراجعة
                </option>

                <option value="edit">
                  تعديل طلب سبق معالجته
                </option>
              </select>

              <form onSubmit={save}>
                <label htmlFor="barcodes">
                  {mode === 'edit'
                    ? 'رقم الطلب'
                    : 'أرقام الطلبات'}
                </label>

                <div className="number-entry">
                  <NumericInput
                    id="barcodes"
                    digits={4}
                    value={barcode}
                    inputRef={barcodeRef}
                    disabled={busy}
                    placeholder="1234"
                    onInvalid={setMessage}
                    onChange={(next) => {
                      setBarcode(next);
                      clearFields();
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();

                        if (mode !== 'edit') {
                          addCode();
                        }
                      }
                    }}
                  />

                  {mode !== 'edit' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={addCode}
                    >
                      إضافة الرقم
                    </button>
                  )}
                </div>

                {mode !== 'edit' && (
                  <>
                    <p className="help">
                      اكتب كل رقم ثم اضغط «إضافة الرقم»
                      أو Enter. الحد الأقصى 100 رقم؛
                      لا تستخدم فواصل أو مسافات.
                    </p>

                    <ul
                      className="code-list"
                      aria-label="الأرقام المختارة"
                    >
                      {selectedCodes.map((code) => (
                        <li key={code}>
                          <b dir="ltr">{code}</b>

                          <button
                            type="button"
                            disabled={busy}
                            aria-label={`حذف الرقم ${code} من القائمة`}
                            onClick={() => {
                              setSelectedCodes(
                                (previous) =>
                                  previous.filter(
                                    (item) => item !== code
                                  )
                              );

                              clearFields();
                            }}
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>

                    <p className="help">
                      عدد الأرقام المختارة:{' '}
                      {selectedCodes.length}
                    </p>
                  </>
                )}

                <p className="help">
                  يجب إتمام تسجيل الطلب أولًا باختيار
                  «جارى مراجعة الطلب» صراحةً.
                  لا يمكن تسجيل موافقة أو رفض أو مطلوب
                  استيفاء قبل ذلك.
                  كل عملية حفظ تُنفذ بالكامل أو تُلغى
                  بالكامل عند وجود خطأ.
                </p>

                {mode !== 'register' && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={loadRequests}
                  >
                    تحميل الطلبات والتحقق من التسجيل السابق
                  </button>
                )}

                {records.length > 0 && (
                  <div className="current-request">
                    {records.map((row) => (
                      <div key={row.barcode}>
                        <b>{row.barcode}</b>: {row.status}
                      </div>
                    ))}
                  </div>
                )}

                {(mode === 'register' ||
                  records.length > 0) && (
                  <>
                    <StatusFields
                      status={status}
                      setStatus={setStatus}
                      notes={notes}
                      setNotes={(value) => {
                        setNotes(value);
                        setNotesChanged(true);
                      }}
                      dateParts={dateParts}
                      setDateParts={setDateParts}
                      disabled={busy}
                      bulk={mode !== 'edit'}
                      registrationOnly={mode === 'register'}
                      onInvalid={setMessage}
                    />

                    {mode !== 'register' && (
                      <p className="help">
                        الملاحظات الحالية تُحفظ كما هي
                        إذا لم تعدّل خانة الملاحظات.
                        عند تعديلها، تُطبق القيمة الجديدة
                        على كل الطلبات المحمّلة.
                      </p>
                    )}

                    <button type="submit" disabled={busy}>
                      {busy
                        ? 'جارٍ الحفظ…'
                        : 'حفظ العملية كاملة'}
                    </button>
                  </>
                )}
              </form>

              <div className="actions">
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