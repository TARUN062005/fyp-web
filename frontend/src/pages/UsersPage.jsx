import { useEffect, useState } from 'react';
import { useUsers } from '../hooks/useUsers.js';
import {
  useBlockUser,
  useUnblockUser,
} from '../hooks/useUserMutations.js';
import ConfirmBlockModal from '../components/users/ConfirmBlockModal.jsx';
import { ErrorAlert } from '../components/ui/AdminState.jsx';

const FILTERS = [
  { id: 'all', label: 'All users' },
  { id: 'verified', label: 'Verified' },
  { id: 'blocked', label: 'Blocked' },
];

const fmt = (value) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
};

const UsersPage = () => {
  const [filter, setFilter] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [blockTarget, setBlockTarget] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [actionMsg, setActionMsg] = useState(null);

  const { data, isLoading, isError, error, isFetching } = useUsers({
    filter,
    q,
    page,
    limit: 50,
  });
  const blockMutation = useBlockUser();
  const unblockMutation = useUnblockUser();

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const users = data?.users ?? [];
  const totalPages = data?.totalPages ?? 1;

  const handleFilter = (id) => {
    setFilter(id);
    setPage(1);
    setActionError(null);
    setActionMsg(null);
  };

  const handleConfirmBlock = async ({ userId, reason }) => {
    setActionError(null);
    setActionMsg(null);
    try {
      await blockMutation.mutateAsync({ userId, reason });
      setBlockTarget(null);
      setActionMsg('User blocked');
      setFilter('blocked');
      setPage(1);
    } catch (err) {
      setActionError(
        err?.response?.data?.error?.message || err?.message || 'Block failed'
      );
    }
  };

  const handleUnblock = async (user) => {
    setActionError(null);
    setActionMsg(null);
    try {
      await unblockMutation.mutateAsync({ userId: user.id });
      setActionMsg(`Unblocked ${user.emergencyId}`);
    } catch (err) {
      setActionError(
        err?.response?.data?.error?.message ||
          err?.message ||
          'Unblock failed'
      );
    }
  };

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="admin-page-title">Users</h2>
          <p className="admin-page-sub">
            Mobile identities — search, block, and inspect profiles.
          </p>
        </div>
        <p className="font-mono text-[11px] text-admin-muted">
          {isLoading && !data
            ? 'loading…'
            : `${data?.total ?? 0} match${data?.total === 1 ? '' : 'es'}`}
          {isFetching && data ? ' · updating' : ''}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-b border-admin-line pb-3">
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="User filters"
        >
          {FILTERS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-pressed={filter === tab.id}
              onClick={() => handleFilter(tab.id)}
              className={filter === tab.id ? 'admin-chip-active' : 'admin-chip'}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <label className="ml-auto block min-w-[14rem] flex-1 lg:max-w-xs">
          <span className="sr-only">Search by Emergency ID or name</span>
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search Emergency ID or name"
            className="admin-input px-3"
          />
        </label>
      </div>

      {actionError ? (
        <p className="mt-3 text-sm text-admin-danger" role="alert">
          {actionError}
        </p>
      ) : null}
      {actionMsg ? (
        <p className="mt-3 text-sm text-admin-accent" role="status">
          {actionMsg}
        </p>
      ) : null}

      {isError ? (
        <ErrorAlert error={error} fallback="Failed to load users" />
      ) : null}

      <div className="admin-table-wrap mt-4">
        <table className="w-full min-w-[48rem] text-left text-sm">
          <thead>
            <tr className="border-b border-admin-line text-xs uppercase tracking-wide text-admin-muted">
              <th className="px-3 py-2 font-medium">Emergency ID</th>
              <th className="px-3 py-2 font-medium">Display name</th>
              <th className="px-3 py-2 font-medium">Verified</th>
              <th className="px-3 py-2 font-medium">Blocked</th>
              <th className="px-3 py-2 font-medium">Last seen</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && !users.length ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-admin-muted">
                  Loading users…
                </td>
              </tr>
            ) : null}

            {!isLoading && !users.length ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-admin-muted">
                  No users match this filter.
                </td>
              </tr>
            ) : null}

            {users.map((user) => (
              <tr
                key={user.id}
                className="border-b border-admin-line/80 hover:bg-admin-surface/60"
              >
                <td className="px-3 py-2 font-mono text-xs">
                  {user.emergencyId}
                </td>
                <td className="px-3 py-2">{user.displayName}</td>
                <td className="px-3 py-2 font-mono text-xs">
                  {user.isVerified ? 'yes' : 'no'}
                </td>
                <td className="px-3 py-2 font-mono text-xs">
                  {user.isBlocked ? 'yes' : 'no'}
                </td>
                <td className="px-3 py-2 font-mono text-xs">
                  {fmt(user.lastSeenAt)}
                </td>
                <td className="px-3 py-2">
                  {user.isBlocked ? (
                    <button
                      type="button"
                      disabled={
                        unblockMutation.isPending &&
                        unblockMutation.variables?.userId === user.id
                      }
                      onClick={() => handleUnblock(user)}
                      className="admin-btn px-2 py-1"
                    >
                      Unblock
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setBlockTarget(user)}
                      className="rounded border border-admin-danger/50 bg-admin-surface px-2 py-1 text-xs font-medium text-admin-danger hover:border-admin-danger"
                    >
                      Block…
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <div className="mt-3 flex items-center gap-2 text-xs text-admin-muted">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="admin-btn px-2 py-1"
          >
            Prev
          </button>
          <span className="font-mono">
            page {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="admin-btn px-2 py-1"
          >
            Next
          </button>
        </div>
      ) : null}

      <ConfirmBlockModal
        user={blockTarget}
        busy={blockMutation.isPending}
        onCancel={() => setBlockTarget(null)}
        onConfirm={handleConfirmBlock}
      />
    </section>
  );
};

export default UsersPage;
