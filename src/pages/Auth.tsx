import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, Check, ShieldCheck, Leaf, Package } from 'lucide-react';
import { request } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { Tokens } from '../lib/types';
import { Action, Form, Notice, Success } from '../components/ui';
import type { Field } from '../components/ui';
type Mode = 'login' | 'register' | 'forgot' | 'reset' | 'verify' | 'mfa';
export default function AuthPage() {
  const { session, signIn } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initial = params.get('mode') as Mode;
  const [mode, setMode] = useState<Mode>(
    ['register', 'forgot', 'reset', 'verify'].includes(initial) ? initial : 'login',
  );
  const [message, setMessage] = useState('');
  const [identity, setIdentity] = useState({
    userId: '',
    email: '',
    mobile: '',
    challengeToken: '',
  });
  const [channel, setChannel] = useState('email');
  if (session) return <Navigate to="/" replace />;
  const change = (m: Mode) => {
    setMode(m);
    setMessage('');
  };
  const titles: Record<Mode, [string, string]> = {
    login: ['Welcome back.', 'Sign in to manage your materials, listings, and business.'],
    register: [
      'Start selling with Stockout.',
      'Create your account. Give surplus materials a new purpose.',
    ],
    forgot: ['Forgot your password?', 'We’ll help you get back into your seller workspace.'],
    reset: ['Set a new password.', 'Use the recovery token sent to you to secure your account.'],
    verify: ['Verify your account.', 'Enter the verification code sent to your email or mobile.'],
    mfa: [
      'One more security check.',
      'Enter the verification code sent to your email to continue.',
    ],
  };
  const field = (name: string, label: string, type = 'text', required = true): Field => ({
    name,
    label,
    type,
    required,
  });
  const fields: Field[] =
    mode === 'login'
      ? [field('emailOrMobile', 'Email or mobile'), field('password', 'Password', 'password')]
      : mode === 'register'
        ? [
            field('firstName', 'First name'),
            field('lastName', 'Last name'),
            field('displayName', 'Display name'),
            field('email', 'Email address', 'email'),
            field('mobile', 'Mobile number', 'tel'),
            {
              ...field('password', 'Password', 'password'),
              hint: 'Use a strong, unique password.',
            },
            field('confirmPassword', 'Confirm password', 'password'),
          ]
        : mode === 'forgot'
          ? [field('emailOrMobile', 'Email or mobile')]
          : mode === 'reset'
            ? [
                {
                  ...field('token', 'Recovery token'),
                  hint: 'Paste the token from your recovery message.',
                },
                field('emailOrMobile', 'Email or mobile'),
                field('newPassword', 'New password', 'password'),
                field('confirmPassword', 'Confirm password', 'password'),
              ]
            : mode === 'verify'
              ? [
                  {
                    ...field(
                      'identifier',
                      channel === 'email' ? 'Email address' : 'Mobile number',
                      channel === 'email' ? 'email' : 'tel',
                    ),
                  },
                  field('token', 'Verification code'),
                ]
              : [field('code', 'Verification code')];
  return (
    <div className="auth-layout">
      <aside className="auth-story">
        <Link to="/login">
          <img
            src={`${import.meta.env.BASE_URL}stockout-logo.png`}
            alt="Stockout"
            className="auth-logo"
          />
        </Link>
        <div className="story-content">
          <div className="pill">
            <span />
            THE CIRCULAR MARKETPLACE
          </div>
          <h1>
            Good materials.
            <br /> New possibilities<span>.</span>
          </h1>
          <p>
            Turn your surplus into someone else’s next project. Your business, with less waste and
            more opportunity.
          </p>
          <div className="story-points">
            <div>
              <Package size={20} />
              <span>One workspace for every listing</span>
            </div>
            <div>
              <ShieldCheck size={20} />
              <span>A trusted, verified marketplace</span>
            </div>
            <div>
              <Leaf size={20} />
              <span>Better value. Smaller footprint.</span>
            </div>
          </div>
        </div>
        <div className="auth-story-footer">
          Built for a world that wastes less.
          <ArrowUpRight size={18} />
        </div>
      </aside>
      <main className="auth-main">
        <div className="auth-top">
          STOCKOUT <span>/ SELLER PORTAL</span>
        </div>
        <div className="auth-form">
          <div className="eyebrow">YOUR SELLER WORKSPACE</div>
          <h2>{titles[mode][0]}</h2>
          <p>{titles[mode][1]}</p>
          {message && <Success>{message}</Success>}
          {mode === 'verify' && (
            <div className="tabs">
              <button
                className={channel === 'email' ? 'active' : ''}
                onClick={() => setChannel('email')}
              >
                Email
              </button>
              <button
                className={channel === 'mobile' ? 'active' : ''}
                onClick={() => setChannel('mobile')}
              >
                Mobile
              </button>
            </div>
          )}
          <Form
            key={mode + channel}
            fields={fields}
            initial={{
              identifier: channel === 'email' ? identity.email : identity.mobile,
              token: params.get('token') || '',
            }}
            submitLabel={
              {
                login: 'Sign in',
                register: 'Create account',
                forgot: 'Send recovery instructions',
                reset: 'Reset password',
                verify: 'Verify account',
                mfa: 'Complete sign in',
              }[mode]
            }
            onSubmit={async (v) => {
              const call = <T,>(path: string, body: unknown) =>
                request<T>(path, { method: 'POST', body, auth: false });
              if (mode === 'login') {
                const t = await call<Tokens>('/api/v1/auth/login', v);
                if (t.mfaRequired) {
                  setIdentity({
                    ...identity,
                    userId: t.userId || '',
                    challengeToken: t.mfaChallengeToken || '',
                  });
                  setMode('mfa');
                } else {
                  signIn(t);
                  navigate('/', { replace: true });
                }
              }
              if (mode === 'register') {
                if (v.password !== v.confirmPassword) throw new Error('Passwords do not match.');
                const { confirmPassword: _, ...payload } = v;
                const r = await call<{ userId: string; message?: string }>(
                  '/api/v1/auth/register',
                  payload,
                );
                setIdentity({
                  userId: r.userId,
                  email: v.email,
                  mobile: v.mobile,
                  challengeToken: '',
                });
                setMode('verify');
                setMessage(
                  r.message || 'Account created. Verify your email or mobile to continue.',
                );
              }
              if (mode === 'forgot') {
                const r = await call<{ message: string }>('/api/v1/auth/password/forgot', v);
                setMessage(r.message || 'Recovery instructions requested. Check your messages.');
              }
              if (mode === 'reset') {
                if (v.newPassword !== v.confirmPassword) throw new Error('Passwords do not match.');
                await call('/api/v1/auth/password/reset', {
                  token: v.token,
                  newPassword: v.newPassword,
                  emailOrMobile: v.emailOrMobile,
                });
                setMode('login');
                setMessage('Password reset. Sign in with your new password.');
              }
              if (mode === 'verify') {
                await call(`/api/v1/auth/verification/${channel}/confirm`, {
                  [channel]: v.identifier,
                  token: v.token,
                });
                setMode('login');
                setMessage('Account verified. You can now sign in.');
              }
              if (mode === 'mfa') {
                if (!v.code) throw new Error('Enter a verification code.');
                const t = await call<Tokens>('/api/v1/auth/mfa/verify', {
                  userId: identity.userId,
                  challengeToken: identity.challengeToken,
                  code: v.code,
                  recoveryCode: null,
                });
                signIn({ ...t, userId: t.userId || identity.userId });
                navigate('/', { replace: true });
              }
            }}
          />
          {mode === 'login' ? (
            <>
              <button className="text-button auth-link" onClick={() => change('forgot')}>
                Forgot password?
              </button>
              <div className="auth-divider" />
              <div className="auth-switch">
                New to Stockout?{' '}
                <button className="text-button" onClick={() => change('register')}>
                  Create a seller account <ArrowUpRight size={14} />
                </button>
              </div>
              <button className="text-button" onClick={() => change('verify')}>
                Already registered? Verify your account
              </button>
            </>
          ) : (
            <div className="auth-links">
              <button className="text-button" onClick={() => change('login')}>
                Back to sign in
              </button>
              {mode === 'forgot' && (
                <button className="text-button" onClick={() => change('reset')}>
                  I have a recovery token
                </button>
              )}
            </div>
          )}
          {mode === 'verify' && (
            <Form
              key={`resend-${channel}`}
              fields={[
                field(
                  channel,
                  channel === 'email' ? 'Email for resend' : 'Mobile for resend',
                  channel === 'email' ? 'email' : 'tel',
                ),
              ]}
              initial={{ [channel]: channel === 'email' ? identity.email : identity.mobile }}
              submitLabel="Resend verification code"
              onSubmit={async (v) => {
                await request(`/api/v1/auth/verification/${channel}/send`, {
                  method: 'POST',
                  body: v,
                  auth: false,
                });
                setMessage('Verification code requested. Check your messages.');
              }}
            />
          )}
          {mode === 'mfa' && identity.userId && (
            <Action
              onClick={async () => {
                const r = await request<{ message: string; challengeId?: string }>(
                  '/api/v1/auth/mfa/resend',
                  {
                    method: 'POST',
                    auth: false,
                    body: { userId: identity.userId, challengeId: identity.challengeToken },
                  },
                );
                if (r.challengeId) setIdentity({ ...identity, challengeToken: r.challengeId });
                setMessage(r.message || 'Verification code requested.');
              }}
            >
              Resend sign-in code
            </Action>
          )}
          {mode === 'mfa' && !identity.userId && (
            <Notice>Return to sign in to request a new MFA challenge.</Notice>
          )}
          <div className="secure-note">
            <Check size={13} /> Secure access to your Stockout workspace
          </div>
        </div>
        <footer>© {new Date().getFullYear()} Stockout. All rights reserved.</footer>
      </main>
    </div>
  );
}
