import { zodResolver } from '@hookform/resolvers/zod';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Form';
import { ConfirmDialog } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Misc';
import { loginSchema, type LoginValues } from '@/schemas';

function Harness({ onValid }: { onValid: (v: LoginValues) => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '', remember: false } });
  return (
    <form onSubmit={handleSubmit(onValid)} noValidate>
      <TextField label="Email" error={errors.email?.message} {...register('email')} />
      <TextField label="Password" type="password" error={errors.password?.message} {...register('password')} />
      <Button type="submit">Sign in</Button>
    </form>
  );
}

describe('StatusBadge', () => {
  it('shows a readable label for every status', () => {
    render(
      <MemoryRouter>
        <StatusBadge status="no_show" />
        <StatusBadge status="checked_in" />
      </MemoryRouter>,
    );
    expect(screen.getByText('No show')).toBeInTheDocument();
    expect(screen.getByText('Checked in')).toBeInTheDocument();
  });
});

describe('form validation', () => {
  it('shows friendly errors and does not submit invalid data', async () => {
    const onValid = vi.fn();
    render(<Harness onValid={onValid} />);
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter your email')).toBeInTheDocument();
    expect(screen.getByText('Enter your password')).toBeInTheDocument();
    expect(onValid).not.toHaveBeenCalled();
  });

  it('submits valid data', async () => {
    const onValid = vi.fn();
    render(<Harness onValid={onValid} />);
    await userEvent.type(screen.getByLabelText('Email'), 'demo@flowdesk.local');
    await userEvent.type(screen.getByLabelText('Password'), 'DemoPassword123!');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(onValid).toHaveBeenCalledTimes(1);
    expect(onValid.mock.calls[0][0]).toMatchObject({ email: 'demo@flowdesk.local' });
  });
});

describe('ConfirmDialog', () => {
  it('confirms and cancels', async () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(<ConfirmDialog open title="Delete it?" message="Sure?" confirmLabel="Delete" onConfirm={onConfirm} onClose={onClose} />);
    expect(screen.getByRole('dialog', { name: 'Delete it?' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Keep it' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders nothing when closed', () => {
    render(<ConfirmDialog open={false} title="Hidden" message="x" confirmLabel="Go" onConfirm={() => {}} onClose={() => {}} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('Pagination', () => {
  it('moves between pages and disables the edges', async () => {
    const onPage = vi.fn();
    render(<Pagination page={1} pageSize={10} total={35} onPage={onPage} />);
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onPage).toHaveBeenCalledWith(2);
  });
});
