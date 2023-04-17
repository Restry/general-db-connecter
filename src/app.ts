import createError from 'http-errors';
import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
// import indexRouter from './routes/index';
// import usersRouter from './routes/users';
import api, { getTable } from './routes/api';
import database from './routes/database';
import passport from 'passport';
import cookieSession from 'cookie-session';
import { ensureLoggedIn } from 'connect-ensure-login';
import './routes/users';
import { getSecret } from './routes/users';
import db from './utils/db';

const app = express();

const tokenStorage = new Map();

// view engine setup 暂停使用渲染引擎
// app.set('views', path.join(__dirname, 'views'));
// app.set('view engine', 'ejs');

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Origin', req.headers.origin);
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept');
  if ('OPTIONS' == req.method) {
    res.send(200);
  } else {
    next();
  }
});

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  cookieSession({
    name: 'session',
    keys: ['/* secret keys */'],
    // Cookie Options
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  })
);
app.use(passport.initialize());
app.use(passport.session());

// app.use('/', indexRouter);
// app.use('/users', usersRouter);

const isValidAccessToken = async accesstoken => {
  // get token from users table by accesstoken
  // if token is valid return true

  if (tokenStorage.has(accesstoken)) return true;

  const { dbo } = await db.connect();
  const user = await getTable(dbo, 'users', { accesstoken });

  if (!user || !user.length) {
    return false;
  }

  tokenStorage.set(accesstoken, user[0]);
  return true;
};

app.use(
  '/api',
  async (req, res, next) => {
    if (req.method.toLowerCase() === 'post' && req.url === '/record') {
      next();
      return;
    } else {
      const token = req.headers.authorization;
      if (token) {
        const isValidToken = await isValidAccessToken(token);
        if (isValidToken) return next();
      }

      const ensure = ensureLoggedIn();
      return ensure(req, res, next);
    }
  },
  api
);
app.use('/db', ensureLoggedIn(), database);

app.get('/', ensureLoggedIn(), (req, res) =>
  res.send('Welcome! ' + JSON.stringify(req.user) + ' : Mongodb online api!')
);

app.get('/login', (_req, res) => {
  res.json({
    status: 401,
    statusText: 'unauthorized'
  });
});

app.get('/secr', async (_req, res) => {
  const secStr = await getSecret();
  if (!secStr) {
    res.send('');
    res.end();
    return;
  }
  const secStrKey = `${new Date().getFullYear()}-${secStr}-${new Date().getMonth()}`;
  const base64Encoder = (str: string) => Buffer.from(str).toString('base64');

  const secret = base64Encoder(
    base64Encoder(secStrKey)
      .split('')
      .map((a: any) => a.charCodeAt(0))
      .reverse()
      .join('|')
  )
    .split('')
    .reverse()
    .join('');

  res.send(base64Encoder(secret));
  res.end();
});

app.post('/login', passport.authenticate('local'), (req, res) => {
  // 生成一个长度为32的随机token
  var user = req.user;
  if (user) {
    delete user.password;
    res.json({
      status: 200,
      statusText: 'ok',
      data: { user }
    });
  } else {
    res.json({
      status: 401,
      statusText: 'unauthorized'
    });
  }
});

app.get('/logout', (req, res) => {
  req.logout(err => {});
  res.redirect('/');
});

app.get('/profile', ensureLoggedIn(), (req, res) => {
  res.json(req.user ? req.user : { status: 401 });
});

// catch 404 and forward to error handler
// app.use((req, res, next) => {
//   next(createError(404));
// });

// error handler
// app.use((err, req, res, next) => {
//   // set locals, only providing error in development
//   res.locals.message = err.message;
//   res.locals.error = req.app.get('env') === 'development' ? err : {};

//   // render the error page
//   res.status(err.status || 500);
//   res.render('error');
// });

export default app;
