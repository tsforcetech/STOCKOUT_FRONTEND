import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, ChevronRight, Package, Plus, Search, RefreshCw } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { get, listingPath } from '../lib/api';
import type { ListingPage } from '../lib/types';
import { Badge, Card, Empty, ErrorBox, Loading, PageHeading, Pagination } from '../components/ui';
import { NeedSeller } from './Business';
export function useListings(page = 1, search = '', status = '') {
  const { seller } = useAuth();
  return useQuery({
    queryKey: ['listings', seller?.sellerId, page, search, status],
    queryFn: () =>
      get<ListingPage>(
        `${listingPath(seller!.sellerId)}?${new URLSearchParams({ page: String(page), pageSize: '20', search, status, sort: 'CreatedAtUtcDesc' })}`,
      ),
    enabled: !!seller,
  });
}
export default function Listings({
  purpose = 'listings',
}: {
  purpose?: 'listings' | 'inventory' | 'inspections';
}) {
  const { seller } = useAuth();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('search') || '');
  const page = Number(params.get('page')) || 1;
  const status = params.get('status') || '';
  const query = useListings(page, params.get('search') || '', status);
  const update = (values: Record<string, string>) => {
    const next = new URLSearchParams(params);
    Object.entries(values).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next);
  };
  if (!seller) return <NeedSeller />;
  const titles = {
    listings: ['My listings', 'A new life for every material. Manage your marketplace listings.'],
    inventory: ['Inventory', 'Choose a listing to update stock or review movement history.'],
    inspections: [
      'Inspections',
      'Choose a listing to view its inspection history and request reinspection.',
    ],
  };
  return (
    <>
      <PageHeading
        title={titles[purpose][0]}
        description={titles[purpose][1]}
        action={
          purpose === 'listings' ? (
            <Link to="/listings/new" className="button primary">
              <Plus size={16} />
              Create listing
            </Link>
          ) : undefined
        }
      />
      <Card
        title={purpose === 'listings' ? 'Your materials' : 'Select a listing'}
        action={
          <button
            className="icon-button"
            aria-label="Refresh listings"
            onClick={() => void query.refetch()}
          >
            <RefreshCw size={16} />
          </button>
        }
      >
        <div className="list-toolbar">
          <form
            className="search-box"
            onSubmit={(e) => {
              e.preventDefault();
              update({ search, page: '1' });
            }}
          >
            <Search size={17} />
            <input
              aria-label="Search listings"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search your listings…"
            />
            <button type="submit" className="text-button">
              Search
            </button>
          </form>
          <select
            aria-label="Filter by status"
            value={status}
            onChange={(e) => update({ status: e.target.value, page: '1' })}
          >
            <option value="">All statuses</option>
            {['DRAFT', 'PUBLISHED', 'SUSPENDED', 'EXPIRED', 'ARCHIVED'].map((s) => (
              <option key={s} value={s}>
                {s.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
        </div>
        {query.isPending ? (
          <Loading />
        ) : query.isError ? (
          <ErrorBox error={query.error} retry={() => void query.refetch()} />
        ) : !query.data.items.length ? (
          <Empty
            title={search || status ? 'No matching listings' : 'Your next opportunity starts here'}
            description={
              search || status
                ? 'Try another search or clear your filters.'
                : 'Add your surplus materials and give them a new purpose.'
            }
            action={
              <Link to="/listings/new" className="button primary">
                <Plus size={15} />
                Create your first listing
              </Link>
            }
          />
        ) : (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Material / listing</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Updated</th>
                    <th>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {query.data.items.map((l) => (
                    <tr key={l.listingId}>
                      <td>
                        <Link
                          to={`/listings/${l.listingId}${purpose === 'listings' ? '' : `?tab=${purpose}`}`}
                          className="material-cell"
                        >
                          <span className="material-icon">
                            <Package size={20} />
                          </span>
                          <div>
                            <strong>{l.title || 'Untitled listing'}</strong>
                            <small>{l.listingId.slice(0, 8).toUpperCase()}</small>
                          </div>
                        </Link>
                      </td>
                      <td>
                        <Badge value={l.status} />
                      </td>
                      <td>
                        {l.createdAtUtc ? new Date(l.createdAtUtc).toLocaleDateString() : '—'}
                      </td>
                      <td>
                        {l.updatedAtUtc ? new Date(l.updatedAtUtc).toLocaleDateString() : '—'}
                      </td>
                      <td>
                        <Link
                          className="icon-button"
                          aria-label={`Open ${l.title || 'listing'}`}
                          to={`/listings/${l.listingId}${purpose === 'listings' ? '' : `?tab=${purpose}`}`}
                        >
                          <ChevronRight size={18} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              total={query.data.totalCount}
              onChange={(p) => update({ page: String(p) })}
            />
          </>
        )}
      </Card>
      <div className="subtle-note">
        <Package size={15} />
        Listings remain subject to seller verification and marketplace review.
        <Link to="/business">
          View seller status <ArrowUpRight size={13} />
        </Link>
      </div>
    </>
  );
}
