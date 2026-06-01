const ADMIN_EMAILS = new Set(['gabe2kahn@gmail.com']);

export function isAdminUser(email: string | undefined): boolean {
  return __DEV__ || (!!email && ADMIN_EMAILS.has(email));
}
