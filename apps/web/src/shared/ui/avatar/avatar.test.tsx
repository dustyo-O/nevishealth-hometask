import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { Avatar } from './avatar';
import { hueOf } from './hue';

describe('hueOf', () => {
  it('gives the same seed the same hue every time', () => {
    expect(hueOf('e1')).toBe(hueOf('e1'));
    expect(hueOf('Anna Blackwood')).toBe(hueOf('Anna Blackwood'));
  });

  it('gives different seeds different hues', () => {
    expect(hueOf('e1')).not.toBe(hueOf('e2'));
    expect(hueOf('e2')).not.toBe(hueOf('e3'));
  });

  it('always lands on a whole degree of the colour wheel', () => {
    for (const seed of ['', 'e1', 'Ana Ruiz', 'Zoë Ćirić', '🙂', 'a'.repeat(200)]) {
      const hue = hueOf(seed);
      expect(Number.isInteger(hue)).toBe(true);
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThan(360);
    }
  });
});

describe('Avatar', () => {
  it('draws the initials it is given on the tint its seed picks (D-12)', () => {
    render(<Avatar initials="AB" seed="e1" />);

    const avatar = screen.getByText('AB');
    expect(avatar.style.getPropertyValue('--avatar-hue')).toBe(String(hueOf('e1')));
  });

  it('is decoration a screen reader passes over (FR5-AC2)', async () => {
    const { container } = render(
      <p>
        <Avatar initials="AB" seed="e1" /> Anna Blackwood
      </p>,
    );

    expect(screen.getByText('AB')).toHaveAttribute('aria-hidden', 'true');
    expect(await axe(container)).toHaveNoViolations();
  });
});
