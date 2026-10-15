import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode, FormEvent } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileUp,
  Loader2,
  PackageOpen,
  RefreshCw,
  X,
} from 'lucide-react';
import { ApiError, uploadFile } from '../lib/api';
export function ErrorBox({ error, retry }: { error: unknown; retry?: () => void }) {
  if (!error) return null;
  const e = error instanceof Error ? error : new Error('Something went wrong.');
  return (
    <div className="alert error" role="alert">
      <AlertCircle size={18} />
      <div>
        <strong>{e.message}</strong>
        {e instanceof ApiError && (
          <>
            <div className="tiny">
              {e.code && e.code !== '[object Object]' ? e.code : ''}
              {e.correlationId ? ` · Reference: ${e.correlationId}` : ''}
            </div>
            {e.fields && (
              <ul>
                {Object.entries(e.fields).map(([k, v]) => (
                  <li key={k}>
                    {k}: {Array.isArray(v) ? v.join(' ') : String(v)}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        {retry && (
          <button className="text-button" onClick={retry}>
            <RefreshCw size={13} />
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
export function Loading({ label = 'Loading your workspace…' }: { label?: string }) {
  return (
    <div className="loading" role="status">
      <Loader2 className="spin" size={23} />
      <span>{label}</span>
    </div>
  );
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <PackageOpen size={28} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Badge({ value }: { value?: string }) {
  const v = value || 'Unknown';
  const s = v.toUpperCase();
  return (
    <span
      className={`badge ${/REJECT|FAIL|SUSPEND|DISABL/.test(s) ? 'red' : /APPROV|VERIFIED|PUBLISHED|ACTIVE|PASS|COMPLETE/.test(s) && !/UNVERIFIED|INACTIVE/.test(s) ? 'green' : /PENDING|REVIEW|PROGRESS/.test(s) ? 'amber' : 'neutral'}`}
    >
      <i />
      {v.replaceAll('_', ' ')}
    </span>
  );
}
export function PageHeading({
  eyebrow = 'SELLER WORKSPACE',
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      <div className="heading-actions">{action}</div>
    </div>
  );
}
export function Card({
  title,
  description,
  action,
  children,
  className = '',
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {title && (
        <div className="card-heading">
          <div>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div className="card-body">{children}</div>
    </section>
  );
}
export function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="alert info">
      <AlertCircle size={18} />
      <div>{children}</div>
    </div>
  );
}
export function Success({ children }: { children: ReactNode }) {
  return (
    <div className="alert success" role="status">
      <CheckCircle2 size={18} />
      <div>{children}</div>
    </div>
  );
}
export interface Field {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: string;
  maxLength?: number;
  disabled?: boolean;
  wide?: boolean;
}
export type FormValues = Record<string, string>;
export function Form({
  fields,
  initial = {},
  onSubmit,
  submitLabel = 'Save changes',
  children,
  disabled = false,
  resetOnSuccess = false,
}: {
  fields: Field[];
  initial?: Record<string, unknown>;
  onSubmit: (values: FormValues) => Promise<unknown>;
  submitLabel?: string;
  children?: ReactNode;
  disabled?: boolean;
  resetOnSuccess?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>();
  const [success, setSuccess] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const id = useId();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const values = Object.fromEntries(new FormData(e.currentTarget).entries()) as FormValues;
    setPending(true);
    setError(undefined);
    setSuccess(false);
    try {
      await onSubmit(values);
      setSuccess(true);
      if (resetOnSuccess) formRef.current?.reset();
    } catch (e) {
      setError(e);
    } finally {
      setPending(false);
    }
  }
  return (
    <form onSubmit={submit} ref={formRef}>
      <ErrorBox error={error} />
      {success && <Success>Changes saved successfully.</Success>}
      <fieldset disabled={pending || disabled} className="form-grid">
        {fields.map((f) => (
          <label
            className={`field ${f.wide ? 'wide' : ''}`}
            key={f.name}
            htmlFor={`${id}-${f.name}`}
          >
            <span>
              {f.label}
              {f.required && <b aria-hidden="true"> *</b>}
            </span>
            {f.options ? (
              <select
                aria-label={f.label}
                id={`${id}-${f.name}`}
                name={f.name}
                defaultValue={String(initial[f.name] ?? '')}
                required={f.required}
                disabled={f.disabled}
              >
                <option value="">Select {f.label.toLowerCase()}</option>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : f.type === 'textarea' ? (
              <textarea
                aria-label={f.label}
                id={`${id}-${f.name}`}
                name={f.name}
                rows={4}
                defaultValue={String(initial[f.name] ?? '')}
                required={f.required}
                maxLength={f.maxLength}
                placeholder={f.placeholder}
              />
            ) : (
              <input
                aria-label={f.label}
                id={`${id}-${f.name}`}
                name={f.name}
                type={f.type || 'text'}
                defaultValue={String(initial[f.name] ?? '')}
                required={f.required}
                min={f.min}
                max={f.max}
                step={f.step}
                maxLength={f.maxLength}
                disabled={f.disabled}
                placeholder={f.placeholder}
                autoComplete={
                  f.type === 'password'
                    ? f.name === 'currentPassword' || f.name === 'password'
                      ? 'current-password'
                      : 'new-password'
                    : f.type === 'email'
                      ? 'email'
                      : undefined
                }
              />
            )}
            {f.hint && <small>{f.hint}</small>}
          </label>
        ))}
      </fieldset>
      {children}
      <div className="form-footer">
        <button className="button primary" disabled={pending || disabled} type="submit">
          {pending ? <Loader2 size={16} className="spin" /> : null}
          {pending ? 'Please wait…' : submitLabel}
          {!pending && <ArrowRight size={15} />}
        </button>
      </div>
    </form>
  );
}
export function Action({
  children,
  onClick,
  danger = false,
  confirm,
}: {
  children: ReactNode;
  onClick: () => Promise<unknown>;
  danger?: boolean;
  confirm?: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>();
  return (
    <div className="action-wrap">
      <button
        className={`button ${danger ? 'danger' : 'secondary'}`}
        disabled={pending}
        onClick={async () => {
          if (confirm && !window.confirm(confirm)) return;
          setPending(true);
          setError(undefined);
          try {
            await onClick();
          } catch (e) {
            setError(e);
          } finally {
            setPending(false);
          }
        }}
      >
        {pending && <Loader2 size={14} className="spin" />}
        {children}
      </button>
      <ErrorBox error={error} />
    </div>
  );
}
export function Upload({
  purpose,
  onComplete,
  label = 'Upload a file',
}: {
  purpose: string;
  onComplete: (id: string, file: File) => Promise<unknown>;
  label?: string;
}) {
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<unknown>();
  const [done, setDone] = useState(false);
  return (
    <div className="upload">
      <label className={`upload-zone ${progress !== null ? 'busy' : ''}`}>
        <FileUp size={26} />
        <strong>{progress !== null ? `Uploading · ${progress}%` : label}</strong>
        <span>
          {purpose === 'LISTING_IMAGE'
            ? 'JPG, PNG or WebP · up to 10 MB'
            : purpose === 'USER_PROFILE_PHOTO' || purpose === 'SELLER_PROFILE_LOGO'
              ? 'JPG, PNG or WebP · up to 5 MB'
              : 'PDF, JPG or PNG · up to 20 MB'}
        </span>
        <input
          type="file"
          aria-label={label}
          disabled={progress !== null}
          accept={
            purpose.includes('IMAGE') ||
            purpose === 'USER_PROFILE_PHOTO' ||
            purpose === 'SELLER_PROFILE_LOGO'
              ? 'image/jpeg,image/png,image/webp'
              : 'application/pdf,image/jpeg,image/png'
          }
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setError(undefined);
            setDone(false);
            setProgress(0);
            try {
              const id = await uploadFile(file, purpose, setProgress);
              await onComplete(id, file);
              setDone(true);
            } catch (e) {
              setError(e);
            } finally {
              setProgress(null);
              e.target.value = '';
            }
          }}
        />
      </label>
      {progress !== null && <progress max={100} value={progress} />}
      <ErrorBox error={error} />
      {done && <Success>File uploaded and attached.</Success>}
    </div>
  );
}
export function Pagination({
  page,
  total,
  pageSize = 20,
  onChange,
}: {
  page: number;
  total: number;
  pageSize?: number;
  onChange: (p: number) => void;
}) {
  return (
    <div className="pagination">
      <span>
        {total
          ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`
          : '0 results'}
      </span>
      <div>
        <button
          className="icon-button"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft size={17} />
        </button>
        <span>Page {page}</span>
        <button
          className="icon-button"
          aria-label="Next page"
          disabled={page * pageSize >= total}
          onClick={() => onChange(page + 1)}
        >
          <ChevronRight size={17} />
        </button>
      </div>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    const dialog = ref.current;
    return () => dialog?.close();
  }, []);
  return (
    <dialog ref={ref} className="modal" onCancel={onClose}>
      <div className="card-heading">
        <h2>{title}</h2>
        <button className="icon-button" aria-label="Close dialog" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      <div className="card-body">{children}</div>
    </dialog>
  );
}
export function Facts({ items }: { items: Record<string, ReactNode> }) {
  return (
    <dl className="facts">
      {Object.entries(items).map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v || '—'}</dd>
        </div>
      ))}
    </dl>
  );
}
