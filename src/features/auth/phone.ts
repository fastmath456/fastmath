export function formatPhone(value: string) {
  return value.replace(/\D/g, '').slice(0, 11).replace(/^(\d{3})(\d)/, '$1-$2').replace(/^(\d{3}-\d{4})(\d)/, '$1-$2');
}

export function editPhone(input: HTMLInputElement, previous: string, inputType: string) {
  let value = input.value, cursor = input.selectionStart ?? value.length;
  if (value.length === previous.length - 1 && previous[cursor] === '-' && inputType === 'deleteContentBackward' && cursor > 0) {
    value = value.slice(0, cursor - 1) + value.slice(cursor); cursor--;
  } else if (value.length === previous.length - 1 && previous[cursor] === '-' && inputType === 'deleteContentForward') {
    value = value.slice(0, cursor) + value.slice(cursor + 1);
  }
  const digitsBeforeCursor = value.slice(0, cursor).replace(/\D/g, '').length;
  const formatted = formatPhone(value);
  let position = 0, seen = 0;
  while (position < formatted.length && seen < digitsBeforeCursor) { if (formatted[position] !== '-') seen++; position++; }
  input.value = formatted;
  input.setSelectionRange(position, position);
  return formatted;
}
