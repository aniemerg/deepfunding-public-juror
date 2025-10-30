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
  siweNonce: null,
  user: null,
})