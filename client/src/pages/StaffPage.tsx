import { MoreHorizontal, Pencil, Plus, UserCheck, UserRound, UserX } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useModals } from '@/components/modals/ModalsContext';
import { Button } from '@/components/ui/Button';
import { Dropdown } from '@/components/ui/Dropdown';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { Select } from '@/components/ui/Form';
import { ConfirmDialog } from '@/components/ui/Modal';
import { Avatar, Badge, PageHeader, Panel } from '@/components/ui/Misc';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useSaveStaff, useStaffList } from '@/hooks/queries';
import { useDocumentTitle } from '@/hooks/useDebounce';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import type { Staff } from '@/types';

const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function workingDays(staff: Staff): string {
  const days = staff.availability.filter((d) => d.isWorking).map((d) => d.dayOfWeek);
  if (!days.length) return 'No working days set';
  // Monday-first order reads more naturally
  const ordered = [1, 2, 3, 4, 5, 6, 0].filter((d) => days.includes(d));
  return ordered.map((d) => SHORT_DAYS[d]).join(', ');
}

export default function StaffPage() {
  useDocumentTitle('Staff');
  const { isAdmin } = useAuth();
  const modals = useModals();
  const toast = useToast();
  const save = useSaveStaff();
  const [status, setStatus] = useState('');
  const [toDeactivate, setToDeactivate] = useState<Staff | null>(null);

  const query = useStaffList({ status });

  const setStaffStatus = (staff: Staff, next: 'active' | 'inactive') =>
    save.mutate(
      {
        id: staff.id,
        values: {
          name: staff.name,
          email: staff.email,
          phone: staff.phone,
          roleTitle: staff.roleTitle,
          specialties: staff.specialties,
          status: next,
        },
      },
      {
        onSuccess: () => toast.success(`${staff.name} is now ${next}`),
        onError: (error) => toast.error(errorMessage(error)),
        onSettled: () => setToDeactivate(null),
      },
    );

  return (
    <>
      <PageHeader
        title="Staff"
        description={isAdmin ? 'Your team, their working hours and their specialties.' : 'The people you work with.'}
        actions={
          <>
            <Select aria-label="Filter staff by status" value={status} onChange={(e) => setStatus(e.target.value)} className="w-40">
              <option value="">All staff</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
            {isAdmin && (
              <Button icon={<Plus className="h-4 w-4" />} onClick={() => modals.openStaff()}>
                Add staff member
              </Button>
            )}
          </>
        }
      />

      {query.error && !query.data ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" role="status" aria-label="Loading staff">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-panel" />
          ))}
        </div>
      ) : query.data && query.data.data.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<UserRound className="h-6 w-6" />}
            title="No staff members"
            description={status ? 'Nobody matches this filter.' : 'Add your team so appointments can be booked with them.'}
            action={isAdmin && !status ? <Button onClick={() => modals.openStaff()}>Add staff member</Button> : undefined}
          />
        </Panel>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {query.data?.data.map((member) => (
            <li key={member.id}>
              <Panel as="article" className={cn('relative flex h-full flex-col p-5 transition-shadow hover:shadow-pop', member.status === 'inactive' && 'bg-cream/60')}>
                <div className="flex items-start gap-4">
                  <Avatar name={member.name} src={member.avatarUrl} color={member.avatarColor} size="lg" />
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-display text-2xl leading-tight text-plum-900">
                      <Link
                        to={`/staff/${member.id}`}
                        className="rounded-md after:absolute after:inset-0 after:rounded-panel focus-visible:after:shadow-focus"
                      >
                        {member.name}
                      </Link>
                    </h2>
                    <p className="text-sm text-ink-mute">{member.roleTitle}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge className={member.status === 'active' ? 'bg-sage-100 text-sage' : 'bg-sand/70 text-ink-soft'}>
                        {member.status === 'active' ? 'Active' : 'Inactive'}
                      </Badge>
                      {member.hasLogin && <Badge className="bg-lavender text-plum-700">Has login</Badge>}
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="relative z-10 -mr-2 -mt-1">
                      <Dropdown
                        label={`Actions for ${member.name}`}
                        triggerClassName="h-9 w-9 justify-center text-ink-soft hover:bg-lavender-50"
                        trigger={<MoreHorizontal className="h-5 w-5" aria-hidden />}
                        items={[
                          { label: 'Edit details', icon: <Pencil className="h-4 w-4" />, onSelect: () => modals.openStaff(member) },
                          { label: 'Edit availability', to: `/staff/${member.id}` },
                          member.status === 'active'
                            ? { label: 'Deactivate', icon: <UserX className="h-4 w-4" />, danger: true, separated: true, onSelect: () => setToDeactivate(member) }
                            : { label: 'Reactivate', icon: <UserCheck className="h-4 w-4" />, separated: true, onSelect: () => setStaffStatus(member, 'active') },
                        ]}
                      />
                    </div>
                  )}
                </div>

                {member.specialties.length > 0 && (
                  <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Specialties">
                    {member.specialties.map((s) => (
                      <li key={s} className="rounded-full border border-sand bg-white px-2.5 py-0.5 text-xs text-ink-soft">
                        {s}
                      </li>
                    ))}
                  </ul>
                )}

                <p className="mt-auto pt-4 text-[13px] text-ink-mute">
                  <span className="text-ink-soft">Works</span> {workingDays(member)}
                </p>
              </Panel>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!toDeactivate}
        title="Deactivate this staff member?"
        message={
          <>
            <strong className="font-medium text-plum-900">{toDeactivate?.name}</strong> will no longer appear when booking and won’t be able to sign in. Their past appointments stay on record. You can reactivate them at any time.
          </>
        }
        confirmLabel="Deactivate"
        cancelLabel="Cancel"
        loading={save.isPending}
        onConfirm={() => toDeactivate && setStaffStatus(toDeactivate, 'inactive')}
        onClose={() => setToDeactivate(null)}
      />
    </>
  );
}
