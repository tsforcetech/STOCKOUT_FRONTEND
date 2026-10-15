import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Download, FileText, Trash2 } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { get, post, del, sellerPath, downloadFile } from '../lib/api';
import type { Seller, SellerDocument } from '../lib/types';
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
  Upload,
} from '../components/ui';
export function NeedSeller() {
  return (
    <Empty
      title="Let’s set up your business"
      description="Create your seller profile to start adding materials to the marketplace."
      action={
        <Link to="/business" className="button primary">
          Set up seller profile <ArrowRight size={15} />
        </Link>
      }
    />
  );
}
export function useSeller() {
  const { seller } = useAuth();
  return useQuery({
    queryKey: ['seller', seller?.sellerId],
    queryFn: () => get<Seller>(sellerPath(seller!.sellerId)),
    enabled: !!seller,
  });
}
export default function Business() {
  const { seller, actor, selectSeller } = useAuth();
  const profile = useSeller();
  const client = useQueryClient();
  return (
    <>
      <PageHeading
        title="Your business, on Stockout."
        description="Manage your seller identity and verification progress."
      />
      {!seller ? (
        <div className="two-columns">
          <Card
            title="Create your seller profile"
            description="Tell buyers who they’re doing business with."
          >
            <Form
              fields={[
                {
                  name: 'sellerType',
                  label: 'Seller type',
                  required: true,
                  options: [
                    { value: 'BUSINESS', label: 'Business' },
                    { value: 'INDIVIDUAL', label: 'Individual' },
                  ],
                },
                { name: 'displayName', label: 'Display name', required: true },
                {
                  name: 'legalName',
                  label: 'Legal business name',
                  hint: 'Required for business sellers.',
                },
                { name: 'registrationNo', label: 'Registration number' },
                {
                  name: 'countryCode',
                  label: 'Country code',
                  required: true,
                  maxLength: 2,
                  hint: 'Two-letter country code, e.g. AE.',
                },
                {
                  name: 'defaultCurrency',
                  label: 'Default currency',
                  required: true,
                  maxLength: 3,
                },
              ]}
              initial={{ sellerType: 'BUSINESS', countryCode: 'AE', defaultCurrency: 'AED' }}
              submitLabel="Create seller profile"
              onSubmit={async (v) => {
                if (v.sellerType === 'BUSINESS' && !v.legalName)
                  throw new Error('Legal business name is required.');
                const created = await post<Seller>('/api/v1/marketplace/sellers', {
                  ...v,
                  countryCode: v.countryCode.toUpperCase(),
                  defaultCurrency: v.defaultCurrency.toUpperCase(),
                });
                selectSeller(created.sellerId);
                await actor.refetch();
              }}
            />
          </Card>
          <Card title="A few steps. A new opportunity.">
            <div className="onboarding-steps">
              {[
                'Create your seller profile',
                'Upload business documents',
                'Submit for verification',
                'Start listing your materials',
              ].map((s, i) => (
                <div key={s}>
                  <span>{i + 1}</span>
                  <div>
                    <strong>{s}</strong>
                    <p>
                      {
                        [
                          'Your business details and preferred currency.',
                          'Securely attach the documents for your seller type.',
                          'Our team will review your seller application.',
                          'Create detailed listings and submit for review.',
                        ][i]
                      }
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      ) : profile.isPending ? (
        <Loading />
      ) : profile.isError ? (
        <ErrorBox error={profile.error} retry={() => void profile.refetch()} />
      ) : (
        <>
          <div className="status-strip">
            <div>
              <Check size={20} />
              <span>Seller profile created</span>
            </div>
            <Badge value={profile.data.verificationStatus} />
            <Badge value={profile.data.onboardingStatus} />
          </div>
          <div className="two-columns">
            <Card
              title={profile.data.displayName || 'Seller profile'}
              action={<Badge value={profile.data.status} />}
            >
              <Facts
                items={{
                  'Seller type': profile.data.organizationType,
                  'Legal name': profile.data.legalName,
                  'Registration number': profile.data.registrationNo,
                  Email: profile.data.email,
                  Country: profile.data.countryCode,
                  'Default currency': profile.data.defaultCurrency,
                }}
              />
            </Card>
            <Card
              title="Verification"
              description="Complete your documents before submitting for review."
            >
              <p className="body-copy">
                Keep your business documents current so our team can verify your seller profile.
              </p>
              <Link className="button secondary" to="/documents">
                <FileText size={16} />
                Manage documents
              </Link>
              <hr />
              <Action
                onClick={async () => {
                  await post(`${sellerPath(seller.sellerId)}/submit`, {
                    expectedRowVersion: profile.data.rowVersion,
                  });
                  await Promise.all([
                    profile.refetch(),
                    actor.refetch(),
                    client.invalidateQueries({ queryKey: ['seller-documents'] }),
                  ]);
                }}
                confirm="Submit your seller profile and documents for review?"
              >
                Submit for verification <ArrowRight size={15} />
              </Action>
              <p className="muted tiny">
                Current verification: {profile.data.verificationStatus.replaceAll('_', ' ')}
              </p>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
export function Documents() {
  const { seller } = useAuth();
  const [documentType, setDocumentType] = useState('TRADE_LICENSE');
  const [number, setNumber] = useState('');
  const [expires, setExpires] = useState('');
  const [issued, setIssued] = useState('');
  const query = useQuery({
    queryKey: ['seller-documents', seller?.sellerId],
    queryFn: () => get<SellerDocument[]>(`${sellerPath(seller!.sellerId)}/documents`),
    enabled: !!seller,
  });
  if (!seller) return <NeedSeller />;
  return (
    <>
      <PageHeading
        title="Business documents"
        description="Securely upload and manage your seller verification documents."
      />
      <div className="two-columns">
        <Card title="Upload a document" description="Attach one document at a time.">
          <div className="form-grid">
            <label className="field">
              <span>Document type</span>
              <input
                value={documentType}
                required
                onChange={(e) => setDocumentType(e.target.value)}
                placeholder="TRADE_LICENSE"
              />
              <small>Use the document type required for your business.</small>
            </label>
            <label className="field">
              <span>Document number</span>
              <input value={number} onChange={(e) => setNumber(e.target.value)} />
            </label>
            <label className="field">
              <span>Issue date</span>
              <input type="date" value={issued} onChange={(e) => setIssued(e.target.value)} />
            </label>
            <label className="field">
              <span>Expiry date</span>
              <input
                type="date"
                value={expires}
                min={issued || undefined}
                onChange={(e) => setExpires(e.target.value)}
              />
            </label>
          </div>
          <Upload
            purpose="SELLER_DOCUMENT"
            label="Choose a verification document"
            onComplete={async (id) => {
              if (!documentType.trim()) throw new Error('Enter a document type.');
              await post(`${sellerPath(seller.sellerId)}/documents`, {
                documentType: documentType.trim().toUpperCase(),
                fileAssetId: id,
                documentNumber: number || null,
                issuedAt: issued ? `${issued}T00:00:00Z` : null,
                expiresAt: expires ? `${expires}T00:00:00Z` : null,
              });
              await query.refetch();
            }}
          />
        </Card>
        <Card
          title="Uploaded documents"
          action={<span className="muted">{query.data?.length ?? '—'} files</span>}
        >
          {query.isPending ? (
            <Loading />
          ) : query.isError ? (
            <ErrorBox error={query.error} retry={() => void query.refetch()} />
          ) : !query.data.length ? (
            <Empty
              title="No documents yet"
              description="Upload your first document to get verification moving."
            />
          ) : (
            <div className="document-list">
              {query.data.map((d) => (
                <div className="document-row" key={d.sellerDocumentId}>
                  <div className="document-icon">
                    <FileText size={22} />
                  </div>
                  <div className="grow">
                    <strong>{d.documentType.replaceAll('_', ' ')}</strong>
                    <p>
                      {d.documentNumber || 'No document number'}
                      {d.expiresAt
                        ? ` · Expires ${new Date(d.expiresAt).toLocaleDateString()}`
                        : ''}
                    </p>
                    <Badge value={d.verificationStatus} />
                  </div>
                  <Action onClick={() => downloadFile(d.fileAssetId)}>
                    <Download size={15} />
                    <span className="sr-only">Download document</span>
                  </Action>
                  <Action
                    danger
                    confirm="Remove this document from your seller profile?"
                    onClick={async () => {
                      await del(`${sellerPath(seller.sellerId)}/documents/${d.sellerDocumentId}`);
                      await query.refetch();
                    }}
                  >
                    <Trash2 size={15} />
                    <span className="sr-only">Remove document</span>
                  </Action>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
      <Notice>
        Submit your profile for review from <Link to="/business">Business profile</Link> after
        adding your documents.
      </Notice>
    </>
  );
}
