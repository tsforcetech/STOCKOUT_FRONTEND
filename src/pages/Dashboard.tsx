import { useQueries } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  ClipboardCheck,
  FileText,
  Leaf,
  Package,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { get, listingPath } from '../lib/api';
import type { ListingPage } from '../lib/types';
import { Badge, Card, Empty, ErrorBox, Loading, PageHeading } from '../components/ui';
import { NeedSeller } from './Business';
import { useListings } from './Listings';
export default function Dashboard() {
  const { seller, session } = useAuth();
  const recent = useListings();
  const statuses = ['', 'PUBLISHED', 'DRAFT', 'SUSPENDED'];
  const counts = useQueries({
    queries: statuses.map((status) => ({
      queryKey: ['listing-count', seller?.sellerId, status],
      queryFn: () =>
        get<ListingPage>(
          `${listingPath(seller!.sellerId)}?page=1&pageSize=1${status ? `&status=${status}` : ''}`,
        ),
      enabled: !!seller,
      retry: false,
    })),
  });
  if (!seller)
    return (
      <>
        <PageHeading
          title={`Welcome to Stockout${session?.displayName ? `, ${session.displayName.split(' ')[0]}` : ''}.`}
          description="Let’s get your seller business ready for the marketplace."
        />
        <NeedSeller />
      </>
    );
  return (
    <>
      <PageHeading
        eyebrow={new Intl.DateTimeFormat('en-AE', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          timeZone: 'Asia/Dubai',
        })
          .format(new Date())
          .toUpperCase()}
        title={`Good to see you${session?.displayName ? `, ${session.displayName.split(' ')[0]}` : ''}.`}
        description="Here’s what’s happening in your seller workspace today."
        action={
          <>
            <button
              className="button secondary"
              onClick={() => {
                void recent.refetch();
                counts.forEach((q) => void q.refetch());
              }}
            >
              <RefreshCw size={15} />
              Refresh
            </button>
            <Link to="/listings/new" className="button primary">
              <Plus size={16} />
              Create listing
            </Link>
          </>
        }
      />
      <div className="hero-banner">
        <div>
          <div className="eyebrow">A SECOND LIFE STARTS WITH YOU</div>
          <h2>Less surplus. More opportunity.</h2>
          <p>Put your materials back to work in the circular marketplace.</p>
          <Link to="/listings/new">
            List your materials <ArrowRight size={16} />
          </Link>
        </div>
        <div className="hero-symbol">
          <Leaf size={84} strokeWidth={1} />
        </div>
      </div>
      <div className="stats-grid">
        {['Total listings', 'Published listings', 'Draft listings', 'Suspended listings'].map(
          (title, i) => (
            <Link
              className="stat-card"
              key={title}
              to={`/listings${statuses[i] ? `?status=${statuses[i]}` : ''}`}
            >
              <div>
                <span>{title}</span>
                <ArrowUpRight size={16} />
              </div>
              <strong>
                {counts[i].isPending
                  ? '…'
                  : counts[i].isError
                    ? '—'
                    : (counts[i].data?.totalCount ?? '—')}
              </strong>
              <small>
                {counts[i].isError ? 'Unable to load · open listings' : 'View listings'}
                <ArrowRight size={12} />
              </small>
            </Link>
          ),
        )}
      </div>
      <div className="dashboard-grid">
        <Card
          title="Recent listings"
          description="Your latest materials on the marketplace."
          action={
            <Link className="text-button" to="/listings">
              View all <ArrowUpRight size={14} />
            </Link>
          }
        >
          {recent.isPending ? (
            <Loading />
          ) : recent.isError ? (
            <ErrorBox error={recent.error} retry={() => void recent.refetch()} />
          ) : !recent.data.items.length ? (
            <Empty
              title="Make your first listing"
              description="Your surplus could be exactly what someone needs."
              action={
                <Link className="button secondary" to="/listings/new">
                  Add materials <Plus size={15} />
                </Link>
              }
            />
          ) : (
            <div className="recent-list">
              {recent.data.items.slice(0, 5).map((l) => (
                <Link to={`/listings/${l.listingId}`} key={l.listingId}>
                  <span className="material-icon">
                    <Package size={21} />
                  </span>
                  <div className="grow">
                    <strong>{l.title}</strong>
                    <small>{l.listingId.slice(0, 8).toUpperCase()}</small>
                  </div>
                  <Badge value={l.status} />
                  <ArrowUpRight size={16} />
                </Link>
              ))}
            </div>
          )}
        </Card>
        <div className="stack">
          <Card title="Your seller standing" action={<ClipboardCheck size={19} />}>
            <div className="standing">
              <span className="business-initial">{seller.displayName?.[0] || 'S'}</span>
              <div>
                <strong>{seller.displayName}</strong>
                <p>{seller.sellerType?.replaceAll('_', ' ')}</p>
              </div>
            </div>
            <div className="badge-row">
              <Badge value={seller.verificationStatus} />
              <Badge value={seller.onboardingStatus} />
            </div>
            <Link to="/business" className="card-link">
              Manage business profile <ArrowRight size={15} />
            </Link>
          </Card>
          <Card title="Keep things moving">
            <Link className="quick-link" to="/documents">
              <FileText size={18} />
              <div>
                <strong>Verification documents</strong>
                <small>Keep your business information current</small>
              </div>
              <ArrowUpRight size={15} />
            </Link>
            <Link className="quick-link" to="/inventory">
              <Package size={18} />
              <div>
                <strong>Manage your stock</strong>
                <small>Accurate quantities, better opportunities</small>
              </div>
              <ArrowUpRight size={15} />
            </Link>
          </Card>
        </div>
      </div>
    </>
  );
}
