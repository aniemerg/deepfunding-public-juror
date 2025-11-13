// Session version - increment this when making breaking changes to session structure
// This will automatically invalidate old sessions and force re-authentication
export const SESSION_VERSION = 3

export const sessionOptions = {
  cookieName: 'jury-session',
  password: process.env.SESSION_SECRET,
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60, // 7 days
    sameSite: 'lax',
  },
}

export const getDefaultSessionData = () => ({
  version: SESSION_VERSION,
  siweNonce: null,
  user: null,
})