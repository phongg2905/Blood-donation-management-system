import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ROLE_NAMES } from '@blood/shared-types';
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
      <QueryState {...result} />
      {result.data && (
        <StaffContent
          key={campaignId}
          campaignId={campaignId}
          name={result.data.name}
        />
      )}
    </CampaignShell>
  );
}
function StaffContent({
  campaignId,
  name,
}: {
  campaignId: string;
  name: string;
}) {
  const repository = useCampaignRepository();
  const { hasPermission } = useAuth();
  const result = useCampaignQuery(`staff:${campaignId}`, () =>
    repository.staff(campaignId),
  );
  const [assigning, setAssigning] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState('');
  const [assignment, setAssignment] = useState<Assignment | ''>('');
  const [remove, setRemove] = useState<CampaignStaff | null>(null);
  const canAssign = hasPermission('campaign_staff.assign');
  const candidates = useCampaignQuery(
    `candidates:${campaignId}:${search}`,
    () => repository.searchStaff(campaignId, search),
    assigning && canAssign,
  );
  const mutation = useCampaignMutation();
  return (
    <>
      <section className="panel">
        <div className="campaign-toolbar">
          <div>
            <h2>{name}</h2>
            <p>Nhân sự đã được phân công</p>
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
        <QueryState {...result} />
        {result.data &&
          (result.data.length ? (
            <ul className="campaign-slot-list">
              {result.data.map((staff) => (
                <li key={staff.id}>
                  <div>
                    <h3>{staff.user.fullName}</h3>
                    <p>
                      {staff.assignment
                        ? ASSIGNMENTS[staff.assignment]
                        : 'Chưa xác định nhiệm vụ'}
                    </p>
                    <p className="campaign-muted">
                      {staff.user.roles
                        .map((role) => ROLE_NAMES[role])
                        .join(', ')}
                    </p>
                  </div>
                  {hasPermission('campaign_staff.remove') && (
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
              <p>Bổ sung nhân sự để chuẩn bị cho đợt hiến.</p>
            </div>
          ))}
      </section>
      {assigning && canAssign && (
        <section className="panel">
          <h2>Phân công nhân sự</h2>
          <form
            className="campaign-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (
                !selected ||
                !candidates.data?.some((user) => user.id === selected)
              )
                return;
              void mutation.run(
                () =>
                  repository.assign(campaignId, selected, assignment || null),
                () => {
                  setAssigning(false);
                  setSelected('');
                  setAssignment('');
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
                hint="Tìm theo họ tên hoặc email."
              >
                <Input
                  type="search"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setSelected('');
                  }}
                />
              </FormField>
              <QueryState {...candidates} />
              {candidates.data &&
                (candidates.data.length ? (
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
                      <option value="">Chọn nhân sự</option>
                      {candidates.data.map((user) => (
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
                    setAssignment(event.target.value as Assignment | '')
                  }
                >
                  <option value="">Chưa xác định</option>
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
                  candidates.loading ||
                  !candidates.data?.some((user) => user.id === selected)
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
                  setSelected('');
                }}
              >
                Hủy
              </Button>
            </div>
          </form>
        </section>
      )}
      {remove && (
        <ConfirmDialog
          title="Gỡ phân công nhân sự?"
          pending={mutation.pending}
          error={mutation.error}
          label="Gỡ phân công"
          onCancel={() => setRemove(null)}
          onConfirm={() => {
            void mutation.run(
              () => repository.unassign(campaignId, remove.id),
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
            <strong>{remove.user.fullName}</strong> sẽ được gỡ khỏi đợt hiến{' '}
            <strong>{name}</strong>. Tài khoản của nhân sự vẫn được giữ nguyên.
          </p>
        </ConfirmDialog>
      )}
    </>
  );
}
