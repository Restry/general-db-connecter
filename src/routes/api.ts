import express from 'express';
const router = express.Router();
import multer from 'multer';
import db from '../utils/db';
import Binary from 'binary';

const upload = multer();
import { ObjectId } from 'mongodb';
// const { ensureLoggedIn } = require('connect-ensure-login');

const removeProcessor = data => {
  const avliableKeys = {};
  try {
    Object.keys(data).forEach(a => {
      const value = data[a];
      if (!a.startsWith('$')) {
        if (a.endsWith('$')) {
          // 以$结尾表示 不等于
          avliableKeys[a.replace('$', '')] = {
            $ne: value
          };
        } else if (
          typeof value === 'string' &&
          (value.toLocaleLowerCase() === 'true' || value.toLocaleLowerCase() === 'false')
        ) {
          avliableKeys[a] = JSON.parse(value);
        } else {
          avliableKeys[a] = Number(value) ? Number(value) : value;
        }
      } else if (a === '$where' && value) {
        const where = JSON.parse(value); // 通过JSON序列化回来的字符串可以保留基础类型
        Object.assign(avliableKeys, where);
      }
    });

    // console.log('avliableKeys', avliableKeys)
  } catch (error) {
    console.error(error);
  }
  return avliableKeys;
};

export const executeFuction = (dbo, func, query) => {
  const params = Object.keys(query).map(k => query[k]);
  const script = `${func}('${params.join("','")}')`;
  return dbo.eval(script);
};

export const getTable = (dbo, table, query) => {
  const data = query;
  if (data._id) {
    data._id = new ObjectId(data._id);
  }
  console.log(`get table`);
  let execute = dbo.collection(table).find(removeProcessor(data) || {});
  let querys = null;
  if (data.$fields) {
    querys = {};
    data.$fields.split(',').forEach(a => (querys[a] = 1));
    execute = execute.project(querys);
  }
  if (data.$limit) {
    execute = execute.limit(parseInt(data.$limit));
  }
  if (data.$skip) {
    execute = execute.skip(parseInt(data.$skip));
  }
  if (data.$sort) {
    const sort = {};
    sort[data.$sort] = 1;
    execute = execute.sort(sort);
  }
  if (data.$sortdesc) {
    const sort = {};
    sort[data.$sortdesc] = -1;
    execute = execute.sort(sort);
  }

  return execute.toArray();
};

export const postHandler = async ({ body, params }, res) => {
  try {
    // if (!req.user) { res.status(401).json({ status: 401 }); return; }
    const objToInsert = body;
    const { dbo, client, pool } = await db.connect();
    const collection = dbo.collection(params.table);

    let method = 'insertOne';
    if (Array.isArray(objToInsert)) {
      method = 'insertMany';
      objToInsert.forEach(a => {
        a.created = new Date();
        a.modified = new Date();
      });
    } else {
      objToInsert.created = new Date();
      objToInsert.modified = new Date();
    }

    const result = await collection[method](objToInsert);
    res.json(result.ops);

    pool.release(client);
  } catch (err) {
    res.send(err.message);
  } finally {
    // db.close();
  }
};
router.get('/', (req, res) => {
  res.send('api was ready');
});

router.post('/:table', postHandler);

router.get('/js/:name', async ({ params, query }, res) => {
  try {
    const { dbo, client, pool } = await db.connect();
    const r = await executeFuction(dbo, params.name, query);
    res.json(r);

    pool.release(client);
  } catch (err) {
    res.send(JSON.stringify(err));
  }
});

router.post('/js/:name', async (req, res) => {
  try {
    const { dbo, client, pool } = await db.connect();
    const params = Object.keys(req.body).map(k => req.body[k]);
    const script = `${req.params.name}('${params.join("','")}')`;
    const r = await dbo.eval(script);
    res.json(r);
    pool.release(client);
  } catch (err) {
    res.send(JSON.stringify(err));
  }
});

router.get('/:table', async ({ params, query }, res) => {
  console.log(` get table`, params.table, query);
  try {
    const { dbo, client, pool } = await db.connect();
    const r = await getTable(dbo, params.table, query);
    res.json(r);
    pool.release(client);
  } catch (err) {
    res.send(JSON.stringify(err));
  }
});

router.put('/:table', async (req, res) => {
  try {
    const { dbo, client, pool } = await db.connect();
    const data = req.query;
    const body = req.body;
    if (data._id) {
      data._id = new ObjectId(data._id);
    }
    body.modified = new Date();
    const r = await dbo.collection(req.params.table).updateMany(
      data || {},
      {
        $set: body
      },
      { upsert: true }
    );
    res.json(r);
    pool.release(client);
  } catch (err) {
    res.send(JSON.stringify(err));
  } finally {
    // createConnection.close();
  }
});

router.delete('/:table', async ({ query, body, params }, res) => {
  try {
    const { dbo, client, pool } = await db.connect();
    const data = query;
    let options = [];

    if (data && data._id) {
      options.push(data._id);
    } else if (body && Array.isArray(body)) {
      options = options.concat(body);
    } else if (body && body._id) {
      options.push(body._id);
    }
    if (options.length == 0) throw 'cannot find delete prarms';

    const r = await dbo.collection(params.table).deleteMany({
      _id: {
        $in: options.map(a => new ObjectId(a))
      }
    });
    res.json(r);
    pool.release(client);
  } catch (err) {
    res.send(JSON.stringify(err));
  } finally {
    // createConnection.close();
  }
});

router.post('/:table/upload', upload.any(), async ({ params, body, files }: any, res) => {
  try {
    const { dbo, client, pool } = await db.connect();
    await dbo.createCollection(params.table);
    const obj = body;
    obj.file = Binary(files[0].buffer);

    const { insertedIds } = await dbo.collection(params.table).insert(obj);
    res.status(200).send(insertedIds);
    pool.release(client);
  } catch (err) {
    res.send(JSON.stringify(err));
  } finally {
    // createConnection.close();
  }
});

router.get('/:table/download', async ({ params, query }, res) => {
  try {
    const { dbo, client, pool } = await db.connect();
    await dbo.createCollection(params.table);
    const data = query;
    if (data._id) {
      data._id = new ObjectId(data._id);
    }
    const documents = await dbo
      .collection(params.table)
      .find(data || {})
      .toArray();
    const file = documents[0].file;

    res.writeHead(200, {
      'Content-Type': documents[0].type,
      'Content-disposition': `attachment;filename=${encodeURIComponent(documents[0].fileName)}`,
      'Content-Length': documents[0].size
    });
    res.end(new Buffer(file.buffer, 'binary'));
    pool.release(client);
  } catch (err) {
    res.send(JSON.stringify(err));
  }
});

export default router;
