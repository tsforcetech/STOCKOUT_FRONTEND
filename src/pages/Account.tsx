import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LogOut, ShieldCheck, Smartphone } from 'lucide-react';
import { get, post, put, del, setSession } from '../lib/api';
import type { Profile, Session } from '../lib/types';
import {
  Action,
  Badge,
  Card,
  Empty,
  ErrorBox,
  Facts,
  Form,
  Loading,
  Notice,
  PageHeading,
  Pagination,
  Upload,
} from '../components/ui';
export function ProfilePage() {
  const query = useQuery({
    queryKey: ['profile'],
    queryFn: () => get<Profile>('/api/v1/users/me'),
  });
  return (
    <>
      <PageHeading
        title="My profile"
        description="Your personal details and workspace preferences."
      />
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorBox error={query.error} retry={() => void query.refetch()} />
      ) : (
        <div className="two-columns">
          <Card title="Personal details">
            <Form
              key={query.data.displayName}
              fields={[
                { name: 'displayName', label: 'Display name', required: true },
                { name: 'firstName', label: 'First name' },
                { name: 'lastName', label: 'Last name' },
                { name: 'preferredLocale', label: 'Preferred locale', placeholder: 'en-AE' },
                { name: 'timeZone', label: 'Time zone', placeholder: 'Asia/Dubai' },
              ]}
              initial={{
                ...query.data,
                preferredLocale: query.data.preferredLocale || 'en-AE',
                timeZone: query.data.timeZone || 'Asia/Dubai',
              }}
              onSubmit={async (v) => {
                await put('/api/v1/users/me', {
                  ...v,
                  profileImageAssetId: query.data.profileImageAssetId || null,
                });
                await query.refetch();
              }}
            />
          </Card>
          <Card title="Profile photo">
            <Upload
              purpose="USER_PROFILE_PHOTO"
              label="Choose a profile photo"
              onComplete={async (id) => {
                await put('/api/v1/users/me', {
                  displayName: query.data.displayName,
                  firstName: query.data.firstName,
                  lastName: query.data.lastName,
                  preferredLocale: query.data.preferredLocale,
                  timeZone: query.data.timeZone,
                  profileImageAssetId: id,
                });
                await query.refetch();
              }}
            />
          </Card>
        </div>
      )}
    </>
  );
}
interface AccountStatus {
  email: string;
  mobile: string;
  emailVerified: boolean;
  mobileVerified: boolean;
  status: string;
}
interface MfaRegistration {
  secret: string;
  qrCodeUri: string;
  recoveryCodes: string[];
  challengeId?: string;
  message?: string;
}
export function SecurityPage() {
  const sessions = useQuery({
    queryKey: ['sessions'],
    queryFn: () => get<Session[]>('/api/v1/auth/sessions'),
  });
  const status = useQuery({
    queryKey: ['account-status'],
    queryFn: () => get<AccountStatus>('/api/v1/auth/account/status'),
  });
  const mfaStatus = useQuery({
    queryKey: ['mfa-status'],
    queryFn: () => get<{ enabled: boolean; type?: string }>('/api/v1/auth/mfa/status'),
  });
  const [mfa, setMfa] = useState<MfaRegistration>();
  const [factor, setFactor] = useState('EMAIL_OTP');
  const [stepUpId, setStepUpId] = useState('');
  const [stepUpToken, setStepUpToken] = useState('');
  return (
    <>
      <PageHeading
        title="Security & sessions"
        description="Keep your account protected and manage where you’re signed in."
      />
      <div className="two-columns">
        <div className="stack">
          <Card
            title="Change password"
            description="Choose a strong password you don’t use elsewhere."
          >
            <Form
              fields={[
                {
                  name: 'currentPassword',
                  label: 'Current password',
                  type: 'password',
                  required: true,
                },
                { name: 'newPassword', label: 'New password', type: 'password', required: true },
                {
                  name: 'confirmPassword',
                  label: 'Confirm new password',
                  type: 'password',
                  required: true,
                },
              ]}
              submitLabel="Change password"
              resetOnSuccess
              onSubmit={async (v) => {
                if (v.newPassword !== v.confirmPassword) throw new Error('Passwords do not match.');
                await post('/api/v1/auth/password/change', {
                  currentPassword: v.currentPassword,
                  newPassword: v.newPassword,
                  stepUpToken: null,
                });
              }}
            />
          </Card>
          <Card title="Account verification">
            {status.isPending ? (
              <Loading />
            ) : status.isError ? (
              <ErrorBox error={status.error} retry={() => void status.refetch()} />
            ) : (
              <>
                <Facts
                  items={{
                    Email: status.data.email,
                    'Email verified': status.data.emailVerified ? 'Yes' : 'No',
                    Mobile: status.data.mobile,
                    'Mobile verified': status.data.mobileVerified ? 'Yes' : 'No',
                    Status: <Badge value={status.data.status} />,
                  }}
                />
                {(['email', 'mobile'] as const).map((channel) => (
                  <details key={channel}>
                    <summary>Verify {channel}</summary>
                    <Action
                      onClick={() =>
                        post(`/api/v1/auth/verification/${channel}/send`, {
                          [channel]: status.data[channel],
                        })
                      }
                    >
                      Send verification code
                    </Action>
                    <Form
                      fields={[{ name: 'token', label: 'Verification code', required: true }]}
                      submitLabel={`Verify ${channel}`}
                      onSubmit={async (v) => {
                        await post(`/api/v1/auth/verification/${channel}/confirm`, {
                          [channel]: status.data[channel],
                          token: v.token,
                        });
                        await status.refetch();
                      }}
                    />
                  </details>
                ))}
              </>
            )}
          </Card>
        </div>
        <div className="stack">
          <Card
            title="Two-step verification"
            description="Add another layer of protection to your seller account."
            action={<ShieldCheck size={20} />}
          >
            {mfaStatus.isPending ? (
              <Loading />
            ) : mfaStatus.isError ? (
              <ErrorBox error={mfaStatus.error} retry={() => void mfaStatus.refetch()} />
            ) : (
              <Notice>
                Two-step verification is {mfaStatus.data.enabled ? 'enabled' : 'not enabled'} for
                your account.
              </Notice>
            )}
            <Form
              disabled={mfaStatus.data?.enabled}
              fields={[
                {
                  name: 'type',
                  label: 'Verification method',
                  required: true,
                  options: [{ value: 'EMAIL_OTP', label: 'Email verification code' }],
                },
              ]}
              initial={{ type: factor }}
              submitLabel="Set up verification"
              onSubmit={async (v) => {
                setFactor(v.type);
                setMfa(await post<MfaRegistration>('/api/v1/auth/mfa/register', v));
              }}
            />
            {mfa && (
              <>
                <Notice>
                  {mfa.message || 'Confirm your factor to finish setting up verification.'}
                </Notice>
                {mfa.secret && (
                  <div className="secret-block">
                    <label>Authenticator setup key</label>
                    <code>{mfa.secret}</code>
                  </div>
                )}
                {mfa.qrCodeUri && (
                  <details>
                    <summary>Authenticator setup URI</summary>
                    <code className="break-all">{mfa.qrCodeUri}</code>
                  </details>
                )}
                {mfa.recoveryCodes?.length > 0 && (
                  <div className="secret-block">
                    <strong>Save these recovery codes securely</strong>
                    <p>They are shown only during setup.</p>
                    <div className="recovery-codes">
                      {mfa.recoveryCodes.map((c) => (
                        <code key={c}>{c}</code>
                      ))}
                    </div>
                  </div>
                )}
                <Form
                  fields={[{ name: 'code', label: 'Verification code', required: true }]}
                  submitLabel="Enable verification"
                  onSubmit={async (v) => {
                    await post('/api/v1/auth/mfa/confirm', {
                      type: factor,
                      code: v.code,
                      challengeId: mfa.challengeId || null,
                    });
                    setMfa(undefined);
                    await mfaStatus.refetch();
                  }}
                />
              </>
            )}
          </Card>
          {mfaStatus.data?.enabled && (
            <Card
              title="Turn off two-step verification"
              description="Confirm your identity before removing this protection."
            >
              <Action
                onClick={async () => {
                  const r = await post<{ stepUpId: string }>('/api/v1/auth/stepup/initiate', {
                    targetAction: 'MFA_DISABLE',
                  });
                  setStepUpId(r.stepUpId);
                  setStepUpToken('');
                }}
              >
                Send security challenge
              </Action>
              {stepUpId && (
                <Form
                  fields={[{ name: 'code', label: 'Security code', required: true }]}
                  submitLabel="Verify challenge"
                  onSubmit={async (v) => {
                    const r = await post<{ verificationToken: string }>(
                      '/api/v1/auth/stepup/verify',
                      { stepUpId, code: v.code },
                    );
                    setStepUpToken(r.verificationToken);
                  }}
                />
              )}
              {stepUpToken && (
                <Action
                  danger
                  confirm="Turn off two-step verification for your account?"
                  onClick={async () => {
                    await post('/api/v1/auth/mfa/disable', {
                      type: mfaStatus.data?.type || 'EMAIL_OTP',
                      stepUpToken,
                    });
                    setStepUpId('');
                    setStepUpToken('');
                    await mfaStatus.refetch();
                  }}
                >
                  Disable two-step verification
                </Action>
              )}
            </Card>
          )}
        </div>
      </div>
      <Card
        title="Signed-in devices"
        description="Revoke sessions you no longer recognize."
        action={
          <Action
            danger
            confirm="Sign out all sessions, including this one?"
            onClick={async () => {
              await post('/api/v1/auth/logout-all');
              setSession(null);
            }}
          >
            <LogOut size={15} />
            Sign out everywhere
          </Action>
        }
      >
        {sessions.isPending ? (
          <Loading />
        ) : sessions.isError ? (
          <ErrorBox error={sessions.error} retry={() => void sessions.refetch()} />
        ) : !sessions.data.length ? (
          <Empty
            title="No active sessions"
            description="Your signed-in devices will appear here."
          />
        ) : (
          <div className="session-list">
            {sessions.data.map((s) => (
              <div className="session-row" key={s.sessionId}>
                <Smartphone size={22} />
                <div className="grow">
                  <strong>
                    {s.deviceLabel || 'Signed-in device'}{' '}
                    {s.isCurrentSession && <span className="badge green">This device</span>}
                  </strong>
                  <p>
                    {s.ipAddress || 'IP unavailable'} · {new Date(s.createdAtUtc).toLocaleString()}
                  </p>
                  <Badge value={s.status} />
                </div>
                <Action
                  danger
                  confirm="Revoke this session?"
                  onClick={async () => {
                    await del(`/api/v1/auth/sessions/${encodeURIComponent(s.sessionId)}`);
                    if (s.isCurrentSession) setSession(null);
                    else await sessions.refetch();
                  }}
                >
                  Revoke
                </Action>
              </div>
            ))}
          </div>
        )}
      </Card>
      <AccountActivity />
    </>
  );
}

interface Activity {
  id: string;
  eventType: string;
  occurredAtUtc: string;
  success: boolean;
  ipAddress?: string;
}
function AccountActivity() {
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['account-activity', page],
    queryFn: () =>
      get<{ items: Activity[]; totalCount: number }>(
        `/api/v1/auth/account/activity?page=${page}&pageSize=20`,
      ),
  });
  return (
    <Card title="Account activity" description="Recent sign-ins and security changes.">
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorBox error={query.error} retry={() => void query.refetch()} />
      ) : !query.data.items.length ? (
        <Empty
          title="No account activity yet"
          description="Your security activity will appear here."
        />
      ) : (
        <>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Event</th>
                  <th>When</th>
                  <th>Result</th>
                  <th>IP address</th>
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((a) => (
                  <tr key={a.id}>
                    <td>{a.eventType}</td>
                    <td>{new Date(a.occurredAtUtc).toLocaleString()}</td>
                    <td>
                      <Badge value={a.success ? 'SUCCESS' : 'FAILED'} />
                    </td>
                    <td>{a.ipAddress || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} total={query.data.totalCount} onChange={setPage} />
        </>
      )}
    </Card>
  );
}
