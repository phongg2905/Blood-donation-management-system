import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ROLE_NAMES, type CampaignStatus } from '@blood/shared-types';
import { Button, FormField, Input } from '@/components/ui';
import { useAuth } from '@/features/auth/hooks/useAuth';
import {
  CampaignShell,
  ConfirmDialog,
  Feedback,
  QueryState,
} from './components';
import { useCampaignMutation, useCampaignQuery } from './hooks';
import { useCampaignRepository } from './repository';
import { ASSIGNMENTS, type Assignment, type CampaignStaff } from './types';

export function CampaignStaffPage() {
  const { campaignId = '' } = useParams();
  const repository = useCampaignRepository();
  const result = useCampaignQuery(`staff-campaign:${campaignId}`, () =>
    repository.detail(campaignId),
  );
  return (
    <CampaignShell title="Nhân sự đợt hiến" back={`/campaigns/${campaignId}`}>
      <QueryState {...result} variant="campaign-detail" />
      {result.data && (
        <StaffContent
          key={campaignId}
          campaignId={campaignId}
          name={result.data.name}
          status={result.data.status}
        />
      )}
    </CampaignShell>
  );
}
function StaffContent({
  campaignId,
  name,
  status,
}: {
  campaignId: string;
  name: string;
  status: CampaignStatus;
}) {
  const repository = useCampaignRepository();
  const { hasPermission } = useAuth();
  const result = useCampaignQuery(`staff:${campaignId}`, () =>
    repository.staff(campaignId),
  );
  const [assigning, setAssigning] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState('');
  const [assignment, setAssignment] = useState<Assignment>('CHECK_IN');
  const [remove, setRemove] = useState<CampaignStaff | null>(null);
  const isEditable = status !== 'COMPLETED' && status !== 'CANCELLED';
  const canAssign = isEditable && hasPermission('campaign_staff.assign');
  const canRemove = isEditable && hasPermission('campaign_staff.remove');
  const candidates = useCampaignQuery(
    `candidates:${campaignId}`,
    () => repository.searchStaff(campaignId, ''),
    assigning && canAssign,
  );
  const mutation = useCampaignMutation();

  const normalizedSearch = search.trim().toLocaleLowerCase('vi');
  const filteredCandidates = (candidates.data ?? []).filter((user) =>
    !normalizedSearch ||
    `${user.fullName} ${user.email}`
      .toLocaleLowerCase('vi')
      .includes(normalizedSearch),
  );

  return (
    <>
      {assigning && canAssign && (
        <section className="panel">
          <h2>Phân công nhân sự</h2>
          <form
            className="campaign-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (
                !selected ||
                !assignment ||
                !filteredCandidates.some((user) => user.id === selected)
              )
                return;
              void mutation.run(
                () =>
                  repository.assign(campaignId, selected, assignment),
                () => {
                  setAssigning(false);
                  setSearch('');
                  setSelected('');
                  setAssignment('CHECK_IN');
                  result.retry();
                  candidates.retry();
                },
                'Đã phân công nhân sự.',
              );
            }}
          >
            <fieldset disabled={mutation.pending}>
              <FormField
                id="staff-search"
                label="Tìm nhân sự"
              >
                <Input
                  type="search"
                  placeholder="Nhập họ tên hoặc email nhân sự..."
                  value={search}
                  onChange={(event) => {
                    const nextSearch = event.target.value;
                    setSearch(nextSearch);
                    const nextQuery = nextSearch.trim().toLocaleLowerCase('vi');
                    const matches = (candidates.data ?? []).filter(
                      (user) =>
                        !nextQuery ||
                        `${user.fullName} ${user.email}`
                          .toLocaleLowerCase('vi')
                          .includes(nextQuery),
                    );
                    if (nextQuery && matches.length === 1) {
                      setSelected(matches[0]!.id);
                    } else if (!matches.some((u) => u.id === selected)) {
                      setSelected('');
                    }
                  }}
                />
              </FormField>
              {normalizedSearch && filteredCandidates.length > 0 && (
                <ul className="staff-search-results" role="listbox" aria-label="Gợi ý nhân sự">
                  {filteredCandidates.slice(0, 6).map((user) => {
                    const isSelected = user.id === selected;
                    return (
                      <li key={user.id}>
                        <button
                          type="button"
                          className={`staff-search-item${isSelected ? ' is-selected' : ''}`}
                          onClick={() => setSelected(user.id)}
                        >
                          <span className="staff-search-item__name">{user.fullName}</span>
                          <span className="staff-search-item__email">{user.email}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <QueryState {...candidates} variant="list" count={2} />
              {candidates.data &&
                (filteredCandidates.length ? (
                  <FormField
                    id="staff-selection"
                    label="Nhân sự"
                    required
                    error={mutation.error?.fields.userId}
                  >
                    <select
                      className="input"
                      value={selected}
                      onChange={(event) => setSelected(event.target.value)}
                    >
                      <option value="">Chọn nhân sự ({filteredCandidates.length} phù hợp)</option>
                      {filteredCandidates.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.fullName} — {user.email}
                        </option>
                      ))}
                    </select>
                  </FormField>
                ) : (
                  <p role="status">
                    Không tìm thấy nhân sự phù hợp hoặc tất cả đã được phân
                    công.
                  </p>
                ))}
              <FormField
                id="staff-assignment"
                label="Nhiệm vụ"
                error={mutation.error?.fields.assignment}
              >
                <select
                  className="input"
                  value={assignment}
                  onChange={(event) =>
                    setAssignment(event.target.value as Assignment)
                  }
                >
                  {Object.entries(ASSIGNMENTS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </FormField>
            </fieldset>
            <div className="campaign-actions">
              <Button
                type="submit"
                disabled={
                  !selected ||
                  !assignment ||
                  candidates.loading ||
                  !filteredCandidates.some((user) => user.id === selected)
                }
                isLoading={mutation.pending}
              >
                Xác nhận phân công
              </Button>
              <Button
                variant="secondary"
                disabled={mutation.pending}
                onClick={() => {
                  setAssigning(false);
                  setSearch('');
                  setSelected('');
                }}
              >
                Hủy
              </Button>
            </div>
          </form>
        </section>
      )}
      <section className="panel">
        <div className="campaign-toolbar">
          <div>
            <h2>{name}</h2>
          </div>
          {canAssign && !assigning && (
            <Button onClick={() => setAssigning(true)}>
              Phân công nhân sự
            </Button>
          )}
        </div>
        <Feedback
          error={!remove ? mutation.error : null}
          success={mutation.success}
        />
        <QueryState {...result} variant="workflow-list" count={3} />
        {result.data &&
          (result.data.length ? (
            <ul className="campaign-slot-list">
              {result.data.map((staff) => (
                <li key={staff.id}>
                  <div>
                    <h3>{staff.user?.fullName ?? 'Nhân sự'}</h3>
                    <p>
                      {staff.assignment
                        ? ASSIGNMENTS[staff.assignment]
                        : ASSIGNMENTS.CHECK_IN}
                    </p>
                    <p className="campaign-muted">
                      {(staff.user?.roles ?? [])
                        .map((role) => ROLE_NAMES[role] ?? role)
                        .join(', ') || ROLE_NAMES.DONATION_STAFF}
                    </p>
                  </div>
                  {canRemove && (
                    <Button
                      variant="secondary"
                      disabled={mutation.pending}
                      onClick={() => setRemove(staff)}
                    >
                      Gỡ phân công
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <div className="campaign-empty">
              <h3>Chưa có nhân sự được phân công.</h3>
            </div>
          ))}
      </section>
      {remove && (
        <ConfirmDialog
          title="Gỡ phân công nhân sự?"
          pending={mutation.pending}
          error={mutation.error}
          label="Gỡ phân công"
          onCancel={() => setRemove(null)}
          onConfirm={() => {
            void mutation.run(
              () => repository.unassign(campaignId, remove.userId || remove.id),
              () => {
                setRemove(null);
                result.retry();
                candidates.retry();
              },
              'Đã gỡ phân công nhân sự.',
            );
          }}
        >
          <p>
            <strong>{remove.user?.fullName ?? 'Nhân sự'}</strong> sẽ được gỡ khỏi đợt hiến{' '}
            <strong>{name}</strong>. Tài khoản của nhân sự vẫn được giữ nguyên.
          </p>
        </ConfirmDialog>
      )}
    </>
  );
}
