export function emailLoginEnabled() {
  return process.env.NODE_ENV !== 'production';
}
