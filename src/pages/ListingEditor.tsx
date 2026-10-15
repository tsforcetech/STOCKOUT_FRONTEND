import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check } from 'lucide-react';
import { get, post, put, listingPath } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { Category, Listing, Requirements, Option } from '../lib/types';
import { Card, ErrorBox, Form, Loading, Notice, PageHeading } from '../components/ui';
import type { Field } from '../components/ui';
import { NeedSeller } from './Business';
export function flattenCategories(categories: Category[], prefix = ''): Option[] {
  return categories.flatMap((c) => [
    { value: c.categoryId, label: `${prefix}${c.name}` },
    ...flattenCategories(c.children || [], `${prefix}${c.name} / `),
  ]);
}
export function useRequirements(categoryId?: string) {
  return useQuery({
    queryKey: ['requirements', categoryId],
    queryFn: () =>
      get<Requirements>(`/api/v1/catalog/categories/${categoryId}/listing-requirements`),
    enabled: !!categoryId,
    staleTime: 300000,
  });
}
export default function ListingEditor({
  listing,
  onSaved,
}: {
  listing?: Listing;
  onSaved?: () => Promise<unknown>;
}) {
  const { seller } = useAuth();
  const navigate = useNavigate();
  const client = useQueryClient();
  const version = listing?.currentDraftVersion || listing?.publishedVersion;
  const [category, setCategory] = useState(version?.categoryId || '');
  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: () => get<Category[]>('/api/v1/catalog/categories'),
    staleTime: 300000,
  });
  const requirements = useRequirements(category);
  const [condition, setCondition] = useState(version?.conditionId || '');
  const createKey = useRef(crypto.randomUUID());
  if (!seller) return <NeedSeller />;
  const schema = requirements.data;
  const nullable = (v: string) => v || null;
  const fields: Field[] = [
    {
      name: 'title',
      label: 'Listing title',
      required: true,
      wide: true,
      maxLength: 250,
      placeholder: 'e.g. Surplus structural steel I-beams',
    },
    {
      name: 'description',
      label: 'Description',
      type: 'textarea',
      wide: true,
      placeholder: 'Describe the material, dimensions, condition, and any useful details.',
    },
    {
      name: 'pricingMode',
      label: 'Pricing mode',
      required: true,
      options: [
        { value: 'FIXED_PRICE', label: 'Fixed price' },
        { value: 'BIDDING', label: 'Bidding' },
        { value: 'BOTH', label: 'Fixed price & bidding' },
      ],
    },
    { name: 'currency', label: 'Currency', required: true, maxLength: 3 },
    {
      name: 'basePrice',
      label: 'Base price',
      type: 'number',
      required: true,
      min: 0,
      step: '0.01',
    },
    {
      name: 'brandId',
      label: 'Brand',
      options: (schema?.brands || []).map((b) => ({
        value: b.brandId,
        label: b.name || b.brandName || b.brandId,
      })),
    },
    {
      name: 'gradeId',
      label: 'Grade',
      options: (
        schema?.conditionRules?.conditions?.find((c) => c.conditionId === condition)?.grades || []
      ).map((g) => ({ value: g.gradeId, label: g.name || g.gradeName || g.gradeId })),
    },
    {
      name: 'quantityUnitId',
      label: 'Quantity unit',
      options: (schema?.unitRules?.units || []).map((u) => ({
        value: u.unitId,
        label: `${u.name} (${u.symbol})`,
      })),
    },
    { name: 'countryCode', label: 'Country code', required: true, maxLength: 2 },
    { name: 'stateOrEmirate', label: 'State / emirate', required: true },
    { name: 'city', label: 'City', required: true },
    { name: 'expiresAtUtc', label: 'Expiry date (optional)', type: 'date' },
  ];
  const defaults = {
    ...version,
    currency: version?.currency || 'AED',
    pricingMode: version?.pricingMode || 'FIXED_PRICE',
    basePrice: version?.basePrice ?? 0,
    ...version?.location,
    countryCode: version?.location?.countryCode || 'AE',
    expiresAtUtc: listing?.expiresAtUtc?.slice(0, 10) || '',
    quantityUnitId: version?.quantityUnitId || schema?.unitRules?.defaultUnitId || '',
  };
  return (
    <>
      {!listing && (
        <>
          <Link className="back-link" to="/listings">
            <ArrowLeft size={15} />
            Back to listings
          </Link>
          <PageHeading
            title="Give your materials a new life."
            description="Start with the essentials. Add attributes, photos, and stock after saving your draft."
          />
          <div className="editor-steps">
            {['Listing details', 'Attributes & media', 'Inventory', 'Review & submit'].map(
              (s, i) => (
                <div className={i === 0 ? 'active' : ''} key={s}>
                  <span>{i + 1}</span>
                  {s}
                </div>
              ),
            )}
          </div>
        </>
      )}
      <Card
        title={listing ? 'Edit listing details' : 'Create a draft'}
        description="Your listing is saved as a draft until you submit it for review."
      >
        {categories.isPending ? (
          <Loading label="Loading material categories…" />
        ) : categories.isError ? (
          <ErrorBox error={categories.error} retry={() => void categories.refetch()} />
        ) : (
          <>
            <div className="form-grid">
              <label className="field wide">
                <span>Material category *</span>
                <select
                  value={category}
                  required
                  onChange={(e) => {
                    setCategory(e.target.value);
                    setCondition('');
                  }}
                >
                  <option value="">Choose a category</option>
                  {flattenCategories(categories.data).map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <small>The category determines which attributes and requirements apply.</small>
              </label>
              <label className="field wide">
                <span>Condition</span>
                <select value={condition} onChange={(e) => setCondition(e.target.value)}>
                  <option value="">Choose condition</option>
                  {schema?.conditionRules?.conditions?.map((c) => (
                    <option key={c.conditionId} value={c.conditionId}>
                      {c.name || c.conditionName}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {requirements.isFetching && <Loading label="Loading category requirements…" />}
            <ErrorBox error={requirements.error} retry={() => void requirements.refetch()} />
            <Form
              key={category + (version?.listingVersionId || 'new')}
              fields={fields}
              initial={defaults}
              disabled={!category || requirements.isPending || requirements.isError}
              submitLabel={listing ? 'Save listing details' : 'Save draft & continue'}
              onSubmit={async (v) => {
                if (!category) throw new Error('Choose a material category.');
                const payload = {
                  title: v.title,
                  description: v.description || null,
                  categoryId: category,
                  pricingMode: v.pricingMode,
                  currency: v.currency.toUpperCase(),
                  basePrice: Number(v.basePrice),
                  brandId: nullable(v.brandId),
                  conditionId: nullable(condition),
                  gradeId: nullable(v.gradeId),
                  quantityUnitId: nullable(v.quantityUnitId),
                  location: {
                    countryCode: v.countryCode.toUpperCase(),
                    stateOrEmirate: v.stateOrEmirate,
                    city: v.city,
                  },
                  expiresAtUtc: v.expiresAtUtc ? `${v.expiresAtUtc}T23:59:59Z` : null,
                };
                if (listing) {
                  await put(listingPath(seller.sellerId, listing.listingId), {
                    ...payload,
                    expectedRowVersion: listing.rowVersion,
                  });
                  await onSaved?.();
                } else {
                  const created = await post<{ listingId: string }>(
                    listingPath(seller.sellerId),
                    payload,
                    createKey.current,
                  );
                  await client.invalidateQueries({ queryKey: ['listings'] });
                  navigate(`/listings/${created.listingId}?tab=attributes`);
                }
              }}
            />
          </>
        )}
      </Card>
      {!listing && (
        <Notice>
          <Check size={15} />
          You can return to your draft at any time. Add photos, stock, and required attributes
          before submitting.
        </Notice>
      )}
    </>
  );
}
