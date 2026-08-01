import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ConfirmBlockModal from '../components/users/ConfirmBlockModal.jsx';

describe('ConfirmBlockModal', () => {
  const user = {
    id: 'u1',
    emergencyId: 'EDTN-UBLK1',
    displayName: 'Block Target',
  };

  it('does not call onConfirm until ack + matching Emergency ID', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmBlockModal
        user={user}
        busy={false}
        onCancel={() => {}}
        onConfirm={onConfirm}
      />
    );

    const confirmBtn = screen.getByRole('button', { name: /confirm block/i });
    expect(confirmBtn).toBeDisabled();

    fireEvent.click(confirmBtn);
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.change(
      screen.getByPlaceholderText('EDTN-UBLK1'),
      { target: { value: 'EDTN-UBLK1' } }
    );
    fireEvent.click(
      screen.getByRole('checkbox', {
        name: /blocks a real person/i,
      })
    );

    expect(confirmBtn).not.toBeDisabled();
    fireEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledWith({
      userId: 'u1',
      reason: undefined,
    });
  });
});
