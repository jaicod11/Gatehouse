import { fireEvent, render, screen } from '@testing-library/react-native';

import { Button } from '@/components/ui';

describe('Button', () => {
  it('presses when enabled', () => {
    const onPress = jest.fn();
    render(<Button label="Save" onPress={onPress} />);

    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toBeEnabled();
    fireEvent.press(button);

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('is disabled for assistive tech and ignores presses when disabled', () => {
    const onPress = jest.fn();
    render(<Button label="Save" disabled onPress={onPress} />);

    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toBeDisabled();
    expect(button.props.accessibilityState).toMatchObject({ disabled: true });
    fireEvent.press(button);

    expect(onPress).not.toHaveBeenCalled();
  });

  it('is busy and ignores presses while loading', () => {
    const onPress = jest.fn();
    render(<Button label="Save" loading onPress={onPress} />);

    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toBeBusy();
    expect(button.props.accessibilityState).toMatchObject({ busy: true });
    fireEvent.press(button);

    expect(onPress).not.toHaveBeenCalled();
  });
});
