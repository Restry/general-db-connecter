import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import db from '../utils/db';
import { getTable } from './api';
import { ObjectId } from 'mongodb';
import crypto from 'crypto';

passport.serializeUser(function (user: any, done) {
  console.log('serialize user', user._id);
  done(null, user._id);
});

passport.deserializeUser(async function (_id, done) {
  const { dbo, client, pool }: any = await db.connect();
  const user = await getTable(dbo, 'users', { _id });
  if (user) {
    delete user[0].password;
    delete user[0].repassword;
  }
  console.log('deserializeUser', user.length);
  done(null, user ? user[0] : {});

  pool.release(client);
});

passport.use(
  new LocalStrategy(
    {
      /*usernameField: 'name', passwordField: 'passwd'*/
    },
    async (username, password, done) => {
      if (!username) {
        done(null, false, { message: 'Incorrect username.' });
        return;
      }
      const { dbo } = await db.connect();
      const user = await getTable(dbo, 'users', { username, password });

      if (!user || !user.length) {
        done(null, false, { message: 'Incorrect username or password.' });
        return;
      }

      const accesstoken = crypto.randomBytes(32).toString('hex');

      const updatedUser = await dbo.collection('users').updateOne(
        { _id: new ObjectId(user[0]._id) },
        {
          $set: {
            accesstoken
          }
        }
      );

      updatedUser.upsertedId && console.log('find user',updatedUser.upsertedId);
      done(null, { ...user[0], accesstoken });
      // });
    }
  )
);

export const getSecret = async () => {
  const { dbo }: any = await db.connect();
  const user = await getTable(dbo, 'users', { username: 'admin' });

  if (user) {
    return user[0].secret;
  }
  return '';
};
