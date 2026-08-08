import { beforeEach, describe, expect, it } from 'vitest';
import { restrictToDigits } from '../../src/ui/numeric-input';

let input: HTMLInputElement;

beforeEach(() => {
  document.body.innerHTML = '<input id="field" type="text" />';
  input = document.querySelector<HTMLInputElement>('#field')!;
  restrictToDigits(input);
});

/** Type `value` with the caret left where the browser would leave it. */
const type = (value: string, caret = value.length): void => {
  input.value = value;
  input.setSelectionRange(caret, caret);
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

describe('restrictToDigits', () => {
  it('strips everything that is not a digit', () => {
    type('1o4x0-5');
    expect(input.value).toBe('1405');
  });

  it('keeps Persian-Indic and Arabic-Indic digits', () => {
    type('۱۴!۰۵');
    expect(input.value).toBe('۱۴۰۵');
  });

  it('leaves a clean value and its caret alone', () => {
    type('1405', 2);
    expect(input.value).toBe('1405');
    expect(input.selectionStart).toBe(2);
  });

  it('puts the caret after the digits that survived ahead of it', () => {
    // "14ab05" with the caret between b and 0: two digits precede it.
    type('14ab05', 4);
    expect(input.value).toBe('1405');
    expect(input.selectionStart).toBe(2);
    expect(input.selectionEnd).toBe(2);
  });

  it('sends the caret to the end when the field cannot report one', () => {
    // A field the browser gives no selection for — the whole value counts as
    // "ahead of the caret", so the caret lands after the last surviving digit.
    Object.defineProperty(input, 'selectionStart', { value: null, configurable: true });
    let placed: number | null = null;
    input.setSelectionRange = (start): void => { placed = start; };

    type('14ab05');

    expect(input.value).toBe('1405');
    expect(placed).toBe(4);
  });
});
