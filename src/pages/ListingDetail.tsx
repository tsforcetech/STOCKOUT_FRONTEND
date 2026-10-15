import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Download,
  FileText,
  Image,
  RefreshCw,
  Star,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { get, post, put, del, listingPath, downloadFile } from '../lib/api';
import type {
  Listing,
  AttributeValues,
  MediaResponse,
  Inventory,
  Movement,
  Inspection,
  Moderation,
  Validation,
} from '../lib/types';
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
  Success,
  Upload,
} from '../components/ui';
import type { Field } from '../components/ui';
import { NeedSeller } from './Business';
import ListingEditor, { useRequirements } from './ListingEditor';
export default function ListingDetail() {
  const { seller } = useAuth();
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const client = useQueryClient();
  const tab = params.get('tab') || 'details';
  const query = useQuery({
    queryKey: ['listing', seller?.sellerId, id],
    queryFn: () => get<Listing>(listingPath(seller!.sellerId, id)),
    enabled: !!seller,
  });
  if (!seller) return <NeedSeller />;
  if (query.isPending) return <Loading />;
  if (query.isError) return <ErrorBox error={query.error} retry={() => void query.refetch()} />;
  const listing = query.data;
  const version = listing.currentDraftVersion || listing.publishedVersion;
  const base = listingPath(seller.sellerId, id);
  const reload = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['listing', seller.sellerId, id] }),
      client.invalidateQueries({ queryKey: ['listings'] }),
      client.invalidateQueries({ queryKey: ['listing-count'] }),
      client.invalidateQueries({ queryKey: ['attributes', base] }),
      client.invalidateQueries({ queryKey: ['media', base] }),
    ]);
  };
  return (
    <>
      <Link to="/listings" className="back-link">
        <ArrowLeft size={15} />
        Back to listings
      </Link>
      <PageHeading
        title={version?.title || 'Listing workspace'}
        description={`Listing ${id.slice(0, 8).toUpperCase()} · ${version?.currency || ''} ${version?.basePrice?.toLocaleString() ?? ''}`}
        action={
          <>
            <Badge value={listing.status} />
            <button className="button secondary" onClick={() => void reload()}>
              <RefreshCw size={15} />
              Refresh
            </button>
          </>
        }
      />
      <div className="tabs listing-tabs">
        {['details', 'attributes', 'media', 'inventory', 'moderation', 'inspections'].map((t) => (
          <button
            key={t}
            className={t === tab ? 'active' : ''}
            onClick={() => setParams({ tab: t })}
          >
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      {tab === 'details' && (
        <ListingEditor key={listing.rowVersion} listing={listing} onSaved={reload} />
      )}{' '}
      {tab === 'attributes' && <Attributes base={base} listing={listing} reload={reload} />}{' '}
      {tab === 'media' && <Media base={base} reload={reload} />}{' '}
      {tab === 'inventory' && <InventoryPanel base={base} />}{' '}
      {tab === 'moderation' && <ModerationPanel base={base} listing={listing} reload={reload} />}{' '}
      {tab === 'inspections' && <InspectionPanel base={base} />}
    </>
  );
}
function Attributes({
  base,
  listing,
  reload,
}: {
  base: string;
  listing: Listing;
  reload: () => Promise<unknown>;
}) {
  const version = listing.currentDraftVersion || listing.publishedVersion;
  const schema = useRequirements(version?.categoryId);
  const query = useQuery({
    queryKey: ['attributes', base],
    queryFn: () => get<AttributeValues>(`${base}/attributes`),
  });
  const [validation, setValidation] = useState<Validation>();
  if (schema.isPending || query.isPending) return <Loading />;
  if (schema.isError || query.isError)
    return (
      <ErrorBox
        error={schema.error || query.error}
        retry={() => {
          void schema.refetch();
          void query.refetch();
        }}
      />
    );
  const definitions = schema.data?.attributes || [];
  const fields: Field[] = definitions.map((a) => ({
    name: a.attributeDefinitionId,
    label: a.name || a.label || a.code,
    required: a.isRequired,
    type: /INTEGER|DECIMAL|NUMBER/.test(a.dataType)
      ? 'number'
      : a.dataType === 'DATE'
        ? 'date'
        : 'text',
    step: a.dataType === 'INTEGER' ? '1' : 'any',
    min: a.minValue,
    max: a.maxValue,
    maxLength: a.maxLength,
    options:
      a.options?.length && a.dataType !== 'MULTI_SELECT'
        ? a.options.map((o) => ({ value: o.value, label: o.label || o.displayName || o.value }))
        : a.dataType === 'BOOLEAN'
          ? [
              { value: 'true', label: 'Yes' },
              { value: 'false', label: 'No' },
            ]
          : undefined,
    hint: a.dataType === 'MULTI_SELECT' ? 'Separate multiple values with a comma.' : undefined,
  }));
  return (
    <>
      <Card
        title="Material attributes"
        description="Give buyers the information they need to make a confident decision."
      >
        {!definitions.length ? (
          <Empty
            title="No category attributes"
            description="There are no additional attributes for this material category."
          />
        ) : (
          <Form
            key={query.data.rowVersion}
            fields={fields}
            initial={Object.fromEntries(
              query.data.attributes.map((a) => [a.attributeDefinitionId, a.values.join(', ')]),
            )}
            submitLabel="Save attributes"
            onSubmit={async (v) => {
              await put(`${base}/attributes`, {
                expectedRowVersion: query.data.rowVersion,
                attributes: definitions
                  .filter((a) => v[a.attributeDefinitionId]?.trim())
                  .map((a) => ({
                    attributeDefinitionId: a.attributeDefinitionId,
                    values:
                      a.dataType === 'MULTI_SELECT'
                        ? v[a.attributeDefinitionId]
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean)
                        : [v[a.attributeDefinitionId]],
                  })),
              });
              setValidation(undefined);
              await query.refetch();
              await reload();
            }}
          />
        )}
      </Card>
      <Card
        title="Check listing completeness"
        description="Validate your draft before sending it for moderation."
      >
        <Action onClick={async () => setValidation(await post<Validation>(`${base}/validate`))}>
          Validate listing
        </Action>
        {validation &&
          (validation.isValid ? (
            <Success>Your listing passed validation.</Success>
          ) : (
            <div className="validation-errors" role="alert">
              <h3>A few things need attention</h3>
              <ul>
                {validation.errors.map((e, i) => (
                  <li key={i}>
                    <strong>{e.field}:</strong> {e.message}
                  </li>
                ))}
              </ul>
            </div>
          ))}
      </Card>
    </>
  );
}
function Media({ base, reload }: { base: string; reload: () => Promise<unknown> }) {
  const query = useQuery({
    queryKey: ['media', base],
    queryFn: () => get<MediaResponse>(`${base}/media`),
  });
  const [kind, setKind] = useState('IMAGE');
  const [documentType, setDocumentType] = useState('');
  const refresh = async () => {
    await query.refetch();
    await reload();
  };
  if (query.isPending) return <Loading />;
  if (query.isError) return <ErrorBox error={query.error} retry={() => void query.refetch()} />;
  const data = query.data;
  return (
    <div className="two-columns">
      <Card title="Photos & documents" description="Help buyers see the value in your materials.">
        <div className="form-grid">
          <label className="field">
            <span>Upload type</span>
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="IMAGE">Listing image</option>
              <option value="DOCUMENT">Listing document</option>
            </select>
          </label>
          {kind === 'DOCUMENT' && (
            <label className="field">
              <span>Document type</span>
              <input
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                placeholder="e.g. SPECIFICATION"
              />
            </label>
          )}
        </div>
        <Upload
          key={kind}
          purpose={kind === 'IMAGE' ? 'LISTING_IMAGE' : 'LISTING_DOCUMENT'}
          label={kind === 'IMAGE' ? 'Add a material photo' : 'Add a listing document'}
          onComplete={async (fileId) => {
            await post(`${base}/media`, {
              expectedRowVersion: data.rowVersion,
              fileAssetId: fileId,
              mediaType: kind,
              isPrimary: kind === 'IMAGE' && !data.media.some((m) => m.isPrimary),
              documentType: kind === 'DOCUMENT' ? documentType || null : null,
            });
            await refresh();
          }}
        />
      </Card>
      <Card title="Attached media" description="Choose your primary image and arrange the gallery.">
        {!data.media.length ? (
          <Empty
            title="Show your materials"
            description="Add photos and supporting documents to your listing."
          />
        ) : (
          <div className="document-list">
            {data.media.map((m, i) => (
              <div className="document-row" key={m.fileAssetId}>
                <div className="document-icon">
                  {m.mediaType === 'IMAGE' ? <Image size={23} /> : <FileText size={23} />}
                </div>
                <div className="grow">
                  <strong>
                    {m.mediaType === 'IMAGE' ? `Image ${i + 1}` : m.documentType || 'Document'}
                  </strong>
                  <small>
                    {m.fileAssetId.slice(0, 8)}
                    {m.isPrimary ? ' · Primary image' : ''}
                  </small>
                </div>
                <div className="media-actions">
                  <Action onClick={() => downloadFile(m.fileAssetId)}>
                    <Download size={14} />
                    <span className="sr-only">View file</span>
                  </Action>
                  {m.mediaType === 'IMAGE' && !m.isPrimary && (
                    <Action
                      onClick={async () => {
                        await put(`${base}/media/${m.fileAssetId}/primary`, {
                          expectedRowVersion: data.rowVersion,
                        });
                        await refresh();
                      }}
                    >
                      <Star size={14} />
                      <span className="sr-only">Make primary</span>
                    </Action>
                  )}
                  {i > 0 && (
                    <Action
                      onClick={async () => {
                        const order = data.media.map((m) => m.fileAssetId);
                        [order[i - 1], order[i]] = [order[i], order[i - 1]];
                        await put(`${base}/media/order`, {
                          expectedRowVersion: data.rowVersion,
                          orderedFileAssetIds: order,
                        });
                        await refresh();
                      }}
                    >
                      <ArrowUp size={14} />
                      <span className="sr-only">Move up</span>
                    </Action>
                  )}
                  {i < data.media.length - 1 && (
                    <Action
                      onClick={async () => {
                        const order = data.media.map((m) => m.fileAssetId);
                        [order[i + 1], order[i]] = [order[i], order[i + 1]];
                        await put(`${base}/media/order`, {
                          expectedRowVersion: data.rowVersion,
                          orderedFileAssetIds: order,
                        });
                        await refresh();
                      }}
                    >
                      <ArrowDown size={14} />
                      <span className="sr-only">Move down</span>
                    </Action>
                  )}
                  <Action
                    danger
                    confirm="Remove this file from the listing?"
                    onClick={async () => {
                      await del(`${base}/media/${m.fileAssetId}`, {
                        expectedRowVersion: data.rowVersion,
                      });
                      await refresh();
                    }}
                  >
                    <Trash2 size={14} />
                    <span className="sr-only">Remove file</span>
                  </Action>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
export function InventoryPanel({ base }: { base: string }) {
  const query = useQuery({
    queryKey: ['inventory', base],
    queryFn: () => get<Inventory>(`${base}/inventory`),
  });
  const [page, setPage] = useState(1);
  const history = useQuery({
    queryKey: ['movements', base, page],
    queryFn: () =>
      get<{ items: Movement[]; totalCount: number }>(
        `${base}/inventory/movements?page=${page}&pageSize=20`,
      ),
  });
  const [mode, setMode] = useState('set');
  if (query.isPending) return <Loading />;
  if (query.isError) return <ErrorBox error={query.error} retry={() => void query.refetch()} />;
  return (
    <>
      <div className="stats-grid three">
        {[
          ['On hand', query.data.onHandQuantity],
          ['Reserved', query.data.reservedQuantity],
          ['Available to sell', query.data.sellableQuantity],
        ].map(([label, value]) => (
          <div className="stat-card" key={label}>
            <span>{label}</span>
            <strong>{value?.toLocaleString()}</strong>
          </div>
        ))}
      </div>
      <Card title="Update stock" description="Keep your availability accurate for buyers.">
        <div className="tabs">
          <button className={mode === 'set' ? 'active' : ''} onClick={() => setMode('set')}>
            Set quantity
          </button>
          <button className={mode === 'adjust' ? 'active' : ''} onClick={() => setMode('adjust')}>
            Adjust quantity
          </button>
        </div>
        <Form
          key={mode + (query.data.rowVersion || '')}
          fields={[
            {
              name: 'quantity',
              label: mode === 'set' ? 'On-hand quantity' : 'Quantity change',
              type: 'number',
              required: true,
              step: 'any',
              min: mode === 'set' ? 0 : undefined,
              hint: mode === 'adjust' ? 'Use a negative number to remove stock.' : undefined,
            },
            { name: 'reasonCode', label: 'Reason code', placeholder: 'e.g. STOCK_COUNT' },
            { name: 'notes', label: 'Notes', type: 'textarea', wide: true },
          ]}
          initial={{ quantity: mode === 'set' ? query.data.onHandQuantity : '' }}
          submitLabel="Update inventory"
          onSubmit={async (v) => {
            const payload = {
              expectedRowVersion: query.data.rowVersion,
              reasonCode: v.reasonCode || null,
              notes: v.notes || null,
              ...(mode === 'set'
                ? { onHandQuantity: Number(v.quantity) }
                : { quantityDelta: Number(v.quantity) }),
            };
            if (mode === 'adjust') await post(`${base}/inventory/adjustments`, payload);
            else await put(`${base}/inventory`, payload);
            await query.refetch();
            await history.refetch();
          }}
        />
      </Card>
      <Card title="Stock movements" description="A history of changes to this listing’s inventory.">
        {history.isPending ? (
          <Loading />
        ) : history.isError ? (
          <ErrorBox error={history.error} retry={() => void history.refetch()} />
        ) : !history.data.items.length ? (
          <Empty title="No movements yet" description="Stock changes will appear here." />
        ) : (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Movement</th>
                    <th>Change</th>
                    <th>On hand after</th>
                    <th>Reason / notes</th>
                  </tr>
                </thead>
                <tbody>
                  {history.data.items.map((m) => (
                    <tr key={m.movementId}>
                      <td>{new Date(m.createdAtUtc).toLocaleString()}</td>
                      <td>{m.movementType}</td>
                      <td>{m.onHandQuantityDelta}</td>
                      <td>{m.onHandQuantityAfter}</td>
                      <td>
                        {m.reasonCode || '—'}
                        <small>{m.notes}</small>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} total={history.data.totalCount} onChange={setPage} />
          </>
        )}
      </Card>
    </>
  );
}
function ModerationPanel({
  base,
  listing,
  reload,
}: {
  base: string;
  listing: Listing;
  reload: () => Promise<unknown>;
}) {
  const query = useQuery({
    queryKey: ['moderation', base],
    queryFn: () => get<Moderation>(`${base}/moderation-status`),
  });
  const [validation, setValidation] = useState<Validation>();
  const refresh = async () => {
    await query.refetch();
    await reload();
  };
  return (
    <div className="two-columns">
      <Card title="Review & moderation" description="Track your listing’s marketplace review.">
        {query.isPending ? (
          <Loading />
        ) : query.isError ? (
          <ErrorBox error={query.error} retry={() => void query.refetch()} />
        ) : (
          <>
            <Facts
              items={{
                'Review status': <Badge value={query.data.status} />,
                Decision: query.data.decision,
                Reason: query.data.reasonCode,
                Reviewed: query.data.reviewedAtUtc
                  ? new Date(query.data.reviewedAtUtc).toLocaleString()
                  : null,
              }}
            />
            {query.data.sellerNotes && <Notice>{query.data.sellerNotes}</Notice>}
          </>
        )}
        <hr />
        <Action onClick={async () => setValidation(await post<Validation>(`${base}/validate`))}>
          Check completeness
        </Action>
        {validation &&
          (validation.isValid ? (
            <Success>Listing validation passed.</Success>
          ) : (
            <div className="validation-errors">
              <ul>
                {validation.errors.map((e, i) => (
                  <li key={i}>
                    {e.field}: {e.message}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        {listing.currentDraftVersionId && (
          <Action
            confirm="Submit this draft for marketplace review?"
            onClick={async () => {
              const result = await post<Validation>(`${base}/validate`);
              setValidation(result);
              if (!result.isValid)
                throw new Error('Resolve the listing validation issues before submitting.');
              await post(
                `${base}/submit`,
                {
                  listingVersionId: listing.currentDraftVersionId,
                  expectedRowVersion: listing.rowVersion,
                },
                crypto.randomUUID(),
              );
              await refresh();
            }}
          >
            Submit draft for review
          </Action>
        )}
      </Card>
      <Card title="Listing controls" description="Manage availability on the marketplace.">
        <Facts
          items={{
            'Current status': <Badge value={listing.status} />,
            'Published version': listing.publishedVersionId ? 'Published' : 'Not yet published',
          }}
        />
        <div className="control-actions">
          {listing.status === 'PUBLISHED' && (
            <Action
              confirm="Pause this listing on the marketplace?"
              onClick={async () => {
                await post(`${base}/pause`, { expectedRowVersion: listing.rowVersion });
                await refresh();
              }}
            >
              Pause listing
            </Action>
          )}
          {listing.status === 'SUSPENDED' && (
            <Action
              confirm="Resume this listing on the marketplace?"
              onClick={async () => {
                await post(`${base}/resume`, { expectedRowVersion: listing.rowVersion });
                await refresh();
              }}
            >
              Resume listing
            </Action>
          )}
          {listing.status !== 'ARCHIVED' && (
            <Action
              danger
              confirm="Archive this listing? It will no longer be available on the marketplace."
              onClick={async () => {
                await post(`${base}/archive`, { expectedRowVersion: listing.rowVersion });
                await refresh();
              }}
            >
              Archive listing
            </Action>
          )}
        </div>
        <Notice>Marketplace publication is controlled by review and eligibility checks.</Notice>
      </Card>
    </div>
  );
}
export function InspectionPanel({ base }: { base: string }) {
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['inspections', base, page],
    queryFn: () =>
      get<{ items: Inspection[]; totalCount: number }>(
        `${base}/inspections?page=${page}&pageSize=20`,
      ),
  });
  const latest = useQuery({
    queryKey: ['latest-inspection', base],
    queryFn: () => get<Inspection>(`${base}/inspections/latest`),
  });
  return (
    <>
      <Card
        title="Inspection history"
        description="View your material inspection status and results."
      >
        {query.isPending ? (
          <Loading />
        ) : query.isError ? (
          <ErrorBox error={query.error} retry={() => void query.refetch()} />
        ) : !query.data.items.length ? (
          <Empty
            title="No inspections yet"
            description="Inspection details will appear here when a review is arranged."
          />
        ) : (
          <div className="inspection-list">
            {query.data.items.map((i) => (
              <div key={i.inspectionId}>
                <div className="card-heading">
                  <h3>{i.inspectionNo}</h3>
                  <Badge value={i.status} />
                </div>
                <Facts
                  items={{
                    Result: i.result,
                    Created: new Date(i.createdAtUtc).toLocaleDateString(),
                    Completed: i.completedAtUtc
                      ? new Date(i.completedAtUtc).toLocaleDateString()
                      : null,
                    Summary: i.summary,
                    Notes: i.failureNotes,
                  }}
                />
              </div>
            ))}
            <Pagination page={page} total={query.data.totalCount} onChange={setPage} />
          </div>
        )}
      </Card>
      {latest.isPending ? (
        <Loading label="Loading latest inspection…" />
      ) : latest.isError ? (
        query.data?.items.length ? (
          <ErrorBox error={latest.error} retry={() => void latest.refetch()} />
        ) : null
      ) : (
        latest.data && (
          <Card title="Latest inspection report" description={latest.data.inspectionNo}>
            <p className="body-copy">{latest.data.summary || 'No summary has been provided.'}</p>
            {latest.data.responses?.map((r) => (
              <div className="report-row" key={r.inspectionResponseId}>
                <strong>{r.itemLabelSnapshot}</strong>
                <span>
                  {r.itemResult || r.passFailValue || r.textValue || r.numberValue || '—'}
                </span>
                <small>{r.inspectorNotes}</small>
              </div>
            ))}
            {latest.data.evidence?.map((e) => (
              <Action key={e.fileAssetId} onClick={() => downloadFile(e.fileAssetId)}>
                <Download size={14} />
                {e.description || 'Download evidence'}
              </Action>
            ))}
            {latest.data.result === 'FAIL' && (
              <>
                <hr />
                <Form
                  fields={[
                    {
                      name: 'remediationNotes',
                      label: 'What have you fixed?',
                      type: 'textarea',
                      required: true,
                      wide: true,
                    },
                  ]}
                  submitLabel="Request reinspection"
                  resetOnSuccess
                  onSubmit={async (v) => {
                    await post(
                      `${base}/inspections/${latest.data.inspectionId}/request-reinspection`,
                      v,
                    );
                    await Promise.all([query.refetch(), latest.refetch()]);
                  }}
                />
              </>
            )}
          </Card>
        )
      )}
    </>
  );
}
