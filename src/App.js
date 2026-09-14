import React, { useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';

const STATUS = {
  REVIEW: 'جارى مراجعة الطلب. رجاء التحقق لاحقاً',
  APPROVED:
    'وردت الموافقة. رجاء إحضار جواز السفر والأوراق المطلوبة خلال المواعيد المحددة أو الإرسال بالبريد المسجل مع مظروف إعادة مستوفى الطوابع والعنوان',
  NOT_APPROVED: 'لم ترد الموافقة',
  REQUIRED: 'مطلوب إستيفاء',
};

const emptyDate = () => ({
  day: '',
  month: '',
  year: '',
});

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

function validDate(value) {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value || '')) {
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

function joinDate({ day, month, year }) {
  return day && month && year.length === 4
    ? `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    : '';
}

function splitDate(value) {
  if (!validDate(value)) return emptyDate();

  const [year, month, day] = value.split('-');
  return { day, month, year };
}

function approvalExpiry(value) {
  if (!validDate(value)) return '';

  const date = new Date(`${value}T00:00:00Z`);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 3;

  const lastDay = new Date(
    Date.UTC(year, month + 1, 0)
  ).getUTCDate();

  return new Date(
    Date.UTC(
      year,
      month,
      Math.min(date.getUTCDate(), lastDay)
    )
  )
    .toISOString()
    .slice(0, 10);
}

function NumericInput({
  value,
  onChange,
  digits,
  onInvalid,
  inputRef,
  ...props
}) {
  const accept = (next) => {
    if (!/^[0-9]*$/.test(next) || next.length > digits) {
      onInvalid(
        `أرقام إنجليزية فقط (0–9)، بحد أقصى ${digits} خانات، دون مسافات أو رموز.`
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

        accept(
          value.slice(
            0,
            input.selectionStart ?? value.length
          ) +
            event.clipboardData.getData('text') +
            value.slice(
              input.selectionEnd ?? value.length
            )
        );
      }}
      onDrop={(event) => event.preventDefault()}
    />
  );
}

function Notice({ message, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!message) return undefined;

    const dialog = ref.current;
    const focus = document.activeElement;
    const overflow = document.body.style.overflow;

    dialog.showModal();
    document.body.style.overflow = 'hidden';

    return () => {
      dialog.close();
      document.body.style.overflow = overflow;

      if (
        focus instanceof HTMLElement &&
        focus.isConnected
      ) {
        focus.focus({ preventScroll: true });
      }
    };
  }, [message]);

  return (
    <dialog
      ref={ref}
      className="notice"
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
        حسنًا
      </button>
    </dialog>
  );
}

function DateFields({
  value,
  onChange,
  disabled,
  onInvalid,
}) {
  const monthRef = useRef(null);
  const yearRef = useRef(null);

  const issued = joinDate(value);
  const expiry = approvalExpiry(issued);
  const future =
    validDate(issued) && issued > todayInBerlin();

  const fields = [
    {
      key: 'day',
      label: 'اليوم',
      digits: 2,
      placeholder: 'DD',
      next: monthRef,
    },
    {
      key: 'month',
      label: 'الشهر',
      digits: 2,
      placeholder: 'MM',
      ref: monthRef,
      next: yearRef,
    },
    {
      key: 'year',
      label: 'السنة',
      digits: 4,
      placeholder: 'YYYY',
      ref: yearRef,
    },
  ];

  return (
    <div className="date-box">
      <strong>تاريخ صدور الموافقة</strong>

      <div className="date-fields" dir="ltr">
        {fields.map((field) => (
          <div key={field.key}>
            <label htmlFor={`date-${field.key}`}>
              {field.label}
            </label>

            <NumericInput
              id={`date-${field.key}`}
              value={value[field.key]}
              digits={field.digits}
              placeholder={field.placeholder}
              inputRef={field.ref}
              disabled={disabled}
              onInvalid={onInvalid}
              onChange={(next) => {
                onChange((previous) => ({
                  ...previous,
                  [field.key]: next,
                }));

                if (
                  next.length === field.digits &&
                  field.next?.current
                ) {
                  field.next.current.focus();
                  field.next.current.select();
                }
              }}
              onBlur={() => {
                if (field.digits === 2) {
                  onChange((previous) => ({
                    ...previous,
                    [field.key]:
                      previous[field.key].length === 1
                        ? previous[field.key].padStart(
                            2,
                            '0'
                          )
                        : previous[field.key],
                  }));
                }
              }}
            />
          </div>
        ))}
      </div>

      <p>
        <strong>
          صلاحية الموافقة 3 أشهر من تاريخ صدور الموافقة.
        </strong>
      </p>

      {issued && !validDate(issued) && (
        <p className="error">التاريخ غير صحيح.</p>
      )}

      {future && (
        <p className="error">
          تاريخ صدور الموافقة لا يجوز أن يكون في المستقبل.
        </p>
      )}

      {expiry && !future && (
        <>
          <p>
            انتهاء الصلاحية:{' '}
            <b dir="ltr">
              {expiry.split('-').reverse().join(' / ')}
            </b>
          </p>

          {expiry < todayInBerlin() && (
            <p className="error">
              انتهت صلاحية هذه الموافقة.
            </p>
          )}
        </>
      )}
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [permitted, setPermitted] = useState(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [mode, setMode] = useState('register');
  const [codes, setCodes] = useState(['']);
  const [records, setRecords] = useState([]);

  const [status, setStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [notesChanged, setNotesChanged] = useState(false);
  const [date, setDate] = useState(emptyDate);

  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const userId = session?.user?.id;

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
        if (active) {
          setMessage(
            'تعذر الاتصال. أعد تحميل الصفحة.'
          );
          setAuthLoading(false);
        }
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
    setCodes(['']);
    setRecords([]);
    setStatus('');
    setNotes('');
    setNotesChanged(false);
    setDate(emptyDate());

    if (userId) {
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
            setMessage(
              'تعذر التحقق من الصلاحيات.'
            );
          }
        });
    }

    return () => {
      active = false;
    };
  }, [userId]);

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
    setDate(emptyDate());
  };

  const validateCodes = () => {
    if (!codes.length || codes.length > 100) {
      throw new Error('الحد الأقصى 100 طلب.');
    }

    if (
      codes.some((code) => !/^[0-9]{4}$/.test(code))
    ) {
      throw new Error(
        'أكمل كل رقم بأربعة أرقام إنجليزية، أو احذف الخانة الزائدة.'
      );
    }

    if (new Set(codes).size !== codes.length) {
      throw new Error('يوجد رقم طلب مكرر.');
    }

    if (mode === 'edit' && codes.length !== 1) {
      throw new Error('أدخل رقم طلب واحد.');
    }

    return codes;
  };

  const login = async (event) => {
    event.preventDefault();
    if (!start()) return;

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
      setCodes(['']);
    } catch (error) {
      setMessage(`تعذر الخروج: ${error.message}`);
    } finally {
      finish();
    }
  };

  const loadRequests = async () => {
    if (!permitted || !start()) return;

    clearFields();

    try {
      const requested = validateCodes();

      const { data, error } = await supabase.rpc(
        'visa_admin_read',
        { p_codes: requested }
      );

      if (error) throw error;

      if (
        !Array.isArray(data) ||
        data.length !== requested.length ||
        requested.some(
          (code) =>
            !data.some((row) => row.barcode === code)
        )
      ) {
        throw new Error(
          'تعذر تحميل جميع الطلبات.'
        );
      }

      if (
        mode === 'update' &&
        data.some(
          (row) => row.status !== STATUS.REVIEW
        )
      ) {
        throw new Error(
          'يوجد طلب سبق تحديثه. استخدم «تحديث طلب».'
        );
      }

      setRecords(data);

      if (data.length === 1) {
        setNotes(data[0].notes || '');
        setDate(
          splitDate(data[0].approval_issued_on)
        );
      }

      setMessage(
        'تم تحميل الطلبات. اختر الحالة ثم احفظ.'
      );
    } catch (error) {
      setMessage(
        error.message || 'تعذر تحميل الطلبات.'
      );
    } finally {
      finish();
    }
  };

  const save = async (event) => {
    event.preventDefault();

    if (!permitted || busyRef.current) return;

    const registering = mode === 'register';

    // التسجيل الجديد يتم مباشرةً قيد المراجعة.
    const nextStatus = registering
      ? STATUS.REVIEW
      : status;

    let requested;

    try {
      requested = validateCodes();

      if (!Object.values(STATUS).includes(nextStatus)) {
        throw new Error('اختر الحالة أولًا.');
      }

      if (
        !registering &&
        (
          records.length !== requested.length ||
          requested.some(
            (code) =>
              !records.some(
                (row) => row.barcode === code
              )
          )
        )
      ) {
        throw new Error(
          'حمّل الطلبات للتحقق من تسجيلها السابق أولًا.'
        );
      }

      const issued = joinDate(date);

      if (
        nextStatus === STATUS.APPROVED &&
        (
          !validDate(issued) ||
          issued > todayInBerlin()
        )
      ) {
        throw new Error(
          'أدخل تاريخ صدور الموافقة الصحيح؛ لا يجوز أن يكون في المستقبل.'
        );
      }

      if (!registering && notes.length > 5000) {
        throw new Error(
          'الملاحظات لا تزيد على 5000 حرف.'
        );
      }
    } catch (error) {
      setMessage(error.message);
      return;
    }

    if (!start()) return;

    try {
      const { data, error } = await supabase.rpc(
        'visa_admin_save',
        {
          p_mode: mode,
          p_codes: requested,
          p_status: nextStatus,
          p_notes: registering
            ? ''
            : notesChanged
              ? notes.trim()
              : null,
          p_approval_issued_on:
            nextStatus === STATUS.APPROVED
              ? joinDate(date)
              : null,
          p_expected: registering
            ? {}
            : Object.fromEntries(
                records.map((row) => [
                  row.barcode,
                  row.write_token,
                ])
              ),
        }
      );

      if (error) {
        setMessage(
          /^[0-9A-Z]{5}$/.test(error.code || '')
            ? `لم يتم الحفظ.\n${error.message}`
            : `تعذر تأكيد الحفظ. تحقق من الطلبات قبل المحاولة مجددًا.\n${error.message}`
        );
        return;
      }

      if (
        !data?.ok ||
        data.count !== requested.length
      ) {
        setMessage(
          'تعذر تأكيد الحفظ. تحقق من الطلبات قبل المحاولة مجددًا.'
        );
        return;
      }

      setCodes(['']);
      clearFields();

      setMessage(
        registering
          ? requested.length === 1
            ? `تم تسجيل الطلب ${requested[0]} قيد المراجعة.`
            : `تم تسجيل ${requested.length} طلبات قيد المراجعة.`
          : 'تم الحفظ بنجاح.'
      );
    } catch (error) {
      setMessage(
        `تعذر تأكيد الحفظ. تحقق من الطلبات قبل المحاولة مجددًا.\n${error.message || ''}`
      );
    } finally {
      finish();
    }
  };

  return (
    <main className="visa-admin" dir="rtl">
      <style>{`
        .visa-admin {
          min-height: 100vh;
          padding: 24px 12px;
          background: #f2f7fb;
          color: #1d2939;
          font-family: Tahoma, Arial, sans-serif;
          line-height: 1.8;
        }

        .visa-admin * {
          box-sizing: border-box;
        }

        .visa-admin .card {
          max-width: 640px;
          margin: 12px auto;
          padding: 26px;
          border: 1px solid #dbe5ef;
          border-radius: 16px;
          background: white;
          box-shadow: 0 8px 28px #0a5dab12;
        }

        .visa-admin h1 {
          font-size: 24px;
          color: #0a5dab;
          text-align: center;
          margin: 0 0 24px;
        }

        .visa-admin label {
          display: block;
          font-weight: bold;
          margin-bottom: 6px;
        }

        .visa-admin input,
        .visa-admin select,
        .visa-admin textarea {
          width: 100%;
          padding: 12px;
          margin-bottom: 16px;
          border: 1px solid #bdcbd9;
          border-radius: 9px;
          background: white;
          color: #1d2939;
          font: inherit;
        }

        .visa-admin textarea {
          resize: vertical;
        }

        .visa-admin button {
          border: 0;
          border-radius: 9px;
          padding: 11px 20px;
          background: #0a5dab;
          color: white;
          font: inherit;
          font-weight: bold;
          cursor: pointer;
        }

        .visa-admin button:disabled {
          opacity: .55;
          cursor: wait;
        }

        .visa-admin :is(
          input,
          select,
          textarea,
          button
        ):focus-visible {
          outline: 3px solid #e89900;
          outline-offset: 2px;
        }

        .visa-admin .secondary {
          background: #e9f1f9;
          color: #0a5dab;
        }

        .visa-admin .logout {
          margin-top: 24px;
          background: #b42335;
        }

        .visa-admin .code-row {
          display: flex;
          gap: 8px;
          align-items: center;
          margin-bottom: 10px;
        }

        .visa-admin .code-row input {
          margin: 0;
          min-width: 0;
        }

        .visa-admin .code-row button {
          flex-shrink: 0;
        }

        .visa-admin .actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin: 14px 0;
        }

        .visa-admin .current,
        .visa-admin .date-box {
          padding: 15px;
          margin: 16px 0;
          background: #f5f9fd;
          border-radius: 10px;
        }

        .visa-admin .date-fields {
          display: flex;
          gap: 10px;
          margin-top: 12px;
        }

        .visa-admin .date-fields > div {
          flex: 1;
          min-width: 0;
          text-align: center;
        }

        .visa-admin .date-fields input {
          text-align: center;
          font-size: 22px;
          padding: 10px 4px;
        }

        .visa-admin .help {
          color: #5d6d7d;
          font-size: 14px;
        }

        .visa-admin .error {
          color: #b42335;
        }

        .visa-admin .notice {
          position: fixed;
          inset: 0;
          margin: auto;
          width: min(480px, calc(100vw - 32px));
          max-height: calc(100dvh - 32px);
          overflow: auto;
          border: 2px solid #0a5dab;
          border-radius: 16px;
          padding: 28px;
          background: white;
          color: #1d2939;
          font: inherit;
          text-align: center;
          box-shadow: 0 24px 80px #0005;
        }

        .visa-admin .notice::backdrop {
          background: #12233899;
        }

        .visa-admin .notice h2 {
          color: #0a5dab;
          margin: 0 0 14px;
        }

        .visa-admin .notice p {
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }

        .visa-admin .notice button {
          min-width: 140px;
        }

        @media (max-width: 480px) {
          .visa-admin .card {
            padding: 18px;
          }

          .visa-admin h1 {
            font-size: 21px;
          }
        }
      `}</style>

      <Notice
        message={message}
        onClose={() => setMessage('')}
      />

      <div className="card">
        <h1>متابعة معاملات التأشيرات</h1>

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
              value={email}
              disabled={busy}
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
              value={password}
              disabled={busy}
              onChange={(event) =>
                setPassword(event.target.value)
              }
            />

            <button disabled={busy} type="submit">
              {busy ? 'جارٍ الدخول…' : 'دخول'}
            </button>
          </form>
        ) : permitted === null ? (
          <p>جارٍ التحقق من الصلاحيات…</p>
        ) : !permitted ? (
          <>
            <p>
              الحساب غير مصرح له، أو تعذر التحقق
              من الصلاحيات.
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
                setCodes(['']);
                clearFields();
              }}
            >
              <option value="register">
                إضافة طلبات
              </option>

              <option value="update">
                تحديث طلبات
              </option>

              <option value="edit">
                تحديث طلب
              </option>
            </select>

            <form onSubmit={save}>
              <label htmlFor="code-0">
                {mode === 'edit'
                  ? 'رقم الطلب'
                  : 'أرقام الطلبات'}
              </label>

              {codes.map((code, index) => (
                <div className="code-row" key={index}>
                  <NumericInput
                    id={`code-${index}`}
                    aria-label={`رقم الطلب ${index + 1}`}
                    value={code}
                    digits={4}
                    placeholder="1234"
                    disabled={busy}
                    onInvalid={setMessage}
                    onChange={(next) => {
                      setCodes((previous) =>
                        previous.map((item, i) =>
                          i === index ? next : item
                        )
                      );

                      clearFields();
                    }}
                    onKeyDown={(event) => {
                      if (
                        event.key === 'Enter' &&
                        mode !== 'register'
                      ) {
                        event.preventDefault();
                        loadRequests();
                      }
                    }}
                  />

                  {codes.length > 1 && (
                    <button
                      type="button"
                      className="secondary"
                      disabled={busy}
                      aria-label={`حذف خانة الطلب ${index + 1}`}
                      onClick={() => {
                        setCodes((previous) =>
                          previous.filter(
                            (_, i) => i !== index
                          )
                        );

                        clearFields();
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}

              <div className="actions">
                {mode !== 'edit' && (
                  <button
                    type="button"
                    className="secondary"
                    disabled={
                      busy || codes.length >= 100
                    }
                    onClick={() => {
                      setCodes((previous) => [
                        ...previous,
                        '',
                      ]);

                      clearFields();
                    }}
                  >
                    رقم آخر
                  </button>
                )}

                {mode === 'register' ? (
                  <button
                    type="submit"
                    disabled={busy}
                  >
                    {busy ? 'جارٍ الإضافة…' : 'إضافة'}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={loadRequests}
                  >
                    {busy ? 'جارٍ التحميل…' : 'تحميل'}
                  </button>
                )}
              </div>

              {mode !== 'register' &&
                records.length > 0 && (
                  <>
                    <div className="current">
                      {records.map((row) => (
                        <div key={row.barcode}>
                          <b dir="ltr">
                            {row.barcode}
                          </b>
                          : {row.status}
                        </div>
                      ))}
                    </div>

                    <label htmlFor="status">
                      الحالة
                    </label>

                    <select
                      id="status"
                      value={status}
                      disabled={busy}
                      onChange={(event) =>
                        setStatus(event.target.value)
                      }
                    >
                      <option value="">
                        اختر الحالة
                      </option>

                      <option value={STATUS.REVIEW}>
                        جارى مراجعة الطلب
                      </option>

                      <option value={STATUS.APPROVED}>
                        موافقة
                      </option>

                      <option value={STATUS.NOT_APPROVED}>
                        لم ترد الموافقة
                      </option>

                      <option value={STATUS.REQUIRED}>
                        مطلوب إستيفاء
                      </option>
                    </select>

                    {status === STATUS.APPROVED && (
                      <>
                        <DateFields
                          value={date}
                          onChange={setDate}
                          disabled={busy}
                          onInvalid={setMessage}
                        />

                        {records.length > 1 && (
                          <p className="help">
                            تاريخ صدور الموافقة يُطبق
                            على كل الطلبات المحمّلة.
                          </p>
                        )}
                      </>
                    )}

                    <label htmlFor="notes">
                      الملاحظات — اختياري
                    </label>

                    <textarea
                      id="notes"
                      rows={3}
                      maxLength={5000}
                      value={notes}
                      disabled={busy}
                      onChange={(event) => {
                        setNotes(event.target.value);
                        setNotesChanged(true);
                      }}
                    />

                    {records.length > 1 && (
                      <p className="help">
                        تعديل الملاحظات يُطبق على كل
                        الطلبات المحمّلة؛ تركها دون تعديل
                        يُبقي الملاحظات الحالية.
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={busy}
                    >
                      {busy ? 'جارٍ الحفظ…' : 'حفظ'}
                    </button>
                  </>
                )}
            </form>

            <button
              type="button"
              className="logout"
              disabled={busy}
              onClick={logout}
            >
              تسجيل الخروج
            </button>
          </>
        )}
      </div>
    </main>
  );
}