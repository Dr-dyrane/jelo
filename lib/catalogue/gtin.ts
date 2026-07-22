export function isValidGtin(value: string) {
  if (!/^\d{8}$|^\d{12,14}$/.test(value)) return false;
  const digits = value.split('').map(Number);
  const check = digits.pop();
  let sum = 0;
  for (let index = digits.length - 1, position = 0; index >= 0; index -= 1, position += 1) {
    sum += digits[index] * (position % 2 === 0 ? 3 : 1);
  }
  return check === (10 - (sum % 10)) % 10;
}

export function canonicalGtin(value: string) {
  return value.padStart(14, '0');
}
