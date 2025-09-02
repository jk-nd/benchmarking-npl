const passport = require('passport');
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const { User } = require('../src/models');

// JWT Strategy for authentication
const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET || 'your_jwt_secret_key_here'
};

passport.use(new JwtStrategy(jwtOptions, async (payload, done) => {
  try {
    // Find user by ID from JWT payload
    const user = await User.findByPk(payload.userId, {
      attributes: { exclude: ['password'] }
    });

    if (user) {
      return done(null, user);
    } else {
      return done(null, false, { message: 'User not found' });
    }
  } catch (error) {
    return done(error, false);
  }
}));

module.exports = passport;