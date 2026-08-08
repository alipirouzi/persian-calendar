/** Anything that is not an ASCII, Persian-Indic, or Arabic-Indic digit. */
const NON_DIGIT = /[^0-9۰-۹٠-٩]/g;

export function filterDigits(raw: string): string {
  return raw.replace(NON_DIGIT, '');
}

/**
 * Keep a text field numeric. Character-level only: out-of-range *numbers* still
 * reach convertFrom and still raise the localized range errors, because blocking
 * those at the keystroke would break typing `3` on the way to `30`.
 *
 * Paste goes through the same path — it fires `input` too. Register this BEFORE
 * any listener that reads the field, so they see the cleaned value.
 */
export function restrictToDigits(input: HTMLInputElement): void {
  input.addEventListener('input', () => {
    const before = input.value;
    const after = filterDigits(before);
    if (after === before) return;
    const caret = input.selectionStart ?? before.length;
    // The caret belongs after however many digits survived ahead of it.
    const kept = filterDigits(before.slice(0, caret)).length;
    input.value = after;
    input.setSelectionRange(kept, kept);
  });
}
