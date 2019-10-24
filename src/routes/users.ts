import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import db from '../utils/db';
import { getTable } from './api';


passport.serializeUser(function (user, done) {
  console.log('serialize user', user._id);
  done(null, user._id);
});

passport.deserializeUser(async function (_id, done) {
  const dbo = await db.connect();
  const user = await getTable(dbo, 'photographers', { _id });
  if (user) {
    delete user[0].passwd;
    delete user[0].rePasswd;
  }
  console.log('deserializeUser', user.length);
  done(null, user ? user[0] : {});
});

passport.use(new LocalStrategy({ usernameField: 'name', passwordField: 'passwd' },
  async (name, passwd, done) => {
    if (!name) {
      done(null, false, { message: 'Incorrect username.' });
      return;
    }
    const dbo = await db.connect();
    const user = await getTable(dbo, 'photographers', { name, passwd })

    if (!user || !user.length) {
      done(null, false, { message: 'Incorrect username or password.' });
      return;
    }

    // User.findOne({ username: username }, function (err, user) {
    // if (err) { return done(err); }

    console.log('find user');
    done(null, user[0]);
    // });
  }
));
