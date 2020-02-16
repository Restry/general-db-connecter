import express from 'express';
const router = express.Router();
import multer from 'multer';
import db from '../utils/db';
import Binary from 'binary';

const upload = multer();
import { ObjectId } from 'mongodb';
// const { ensureLoggedIn } = require('connect-ensure-login');

const removeProcessor = (data) => {
  const avliableKeys = {}
  try {
    Object.keys(data).forEach(a => {
      const value = data[a];
      if (!a.startsWith('$')) {
        if (a.endsWith('$')) { // 以$结尾表示 不等于
          avliableKeys[a.replace('$', '')] = {
            $ne: value
          };
        } else if (typeof value === 'string' &&
          (value.toLocaleLowerCase() === 'true' || value.toLocaleLowerCase() === 'false')) {
          avliableKeys[a] = JSON.parse(value);
        }
        else {
          avliableKeys[a] = Number(value) ? Number(value) : value;
        }
      } else if (a === '$where' && value) {
        const where = JSON.parse(value); // 通过JSON序列化回来的字符串可以保留基础类型
        Object.assign(avliableKeys, where);
      }
    })

    // console.log('avliableKeys', avliableKeys)
  } catch (error) {
    console.error(error);
  }
  return avliableKeys;
}

export const executeFuction = (dbo, func, query) => {
  const params = Object.keys(query).map(k => query[k]);
  const script = `${func}('${params.join("','")}')`;
  return dbo.eval(script);
}

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
    data.$fields.split(',').forEach(a => querys[a] = 1);
    execute = execute.project(querys)
  }
  if (data.$limit) {
    execute = execute.limit(parseInt(data.$limit))
  }
  if (data.$skip) {
    execute = execute.skip(parseInt(data.$skip))
  }
  if (data.$sort) {
    const sort = {}
    sort[data.$sort] = 1;
    execute = execute.sort(sort)
  }
  if (data.$sortdesc) {
    const sort = {}
    sort[data.$sortdesc] = -1;
    execute = execute.sort(sort)
  }

  return execute.toArray();
};

router.get('/', (req, res) => {
  res.send('api was ready');
})

router.get('/js/:name', ({ params, query }, res) => {
  db.connect().then(({ dbo }) => executeFuction(dbo, params.name, query)).then((r) => {
    res.json(r);
  }).catch((err) => {
    res.send(JSON.stringify(err));
  }).finally(() => {
  })
})

router.post('/js/:name', (req, res) => {
  db.connect().then(({ dbo }) => {
    const params = Object.keys(req.body).map(k => req.body[k]);
    const script = `${req.params.name}('${params.join("','")}')`;
    return dbo.eval(script);
  }).then((r) => {
    res.json(r);
  }).catch((err) => {
    res.send(JSON.stringify(err));
  }).finally(() => {
    // createConnection.close();
  })
});

router.get('/:table', ({ params, query }, res) => {
  console.log(` get table`, params.table, query);
  db.connect().then(({ dbo }) => getTable(dbo, params.table, query)).then((r) => {
    res.json(r);
  }).catch((err) => {
    res.send(JSON.stringify(err));
    // db.close();
  }).finally(() => {
    // db.close();
  })
})

router.post('/:table', ({ body, params }, res) => {
  // if (!req.user) { res.status(401).json({ status: 401 }); return; }
  const objToInsert = body;
  db.connect().then(({ dbo }) => dbo.createCollection(params.table)).then(r => {
    // const obj = req.body;
    let method = 'insertOne';
    if (Array.isArray(objToInsert)) {
      method = 'insertMany';
      objToInsert.forEach(a => { a.created = new Date(); a.modified = new Date(); });
    } else {
      objToInsert.created = new Date();
      objToInsert.modified = new Date();
    }
    return r[method](objToInsert);
  }).then((r) => {
    res.json(r);
  }).catch((err) => {
    res.send(err.message);
    // db.close();
  }).finally(() => {
    // db.close();
  })
})

router.put('/:table', (req, res) => {
  // if (!req.user) { res.status(401).json({ status: 401 }); return; }
  db.connect().then(({ dbo }) => {
    const data = req.query;
    const body = req.body;
    if (data._id) {
      data._id = new ObjectId(data._id);
    }
    body.modified = new Date();

    return dbo.collection(req.params.table).updateMany(data || {}, {
      "$set": body
    }, { upsert: true });
  }).then((r) => {
    res.json(r);
  }).catch((err) => {
    res.send(JSON.stringify(err));
  }).finally(() => {
    // createConnection.close();
  })
})

router.delete('/:table', ({ query, body, params }, res) => {
  // if (!req.user) { res.status(401).json({ status: 401 }); return; }
  db.connect().then(({ dbo }) => {
    const data = query;
    let options = [];

    if (data && data._id) {
      options.push(data._id);
    } else if (body && Array.isArray(body)) {
      options = options.concat(body);
    } else if (body && body._id) {
      options.push(body._id);
    }
    if (options.length == 0) throw "cannot find delete prarms";

    return dbo.collection(params.table).deleteMany({
      "_id": {
        $in: options.map(a => new ObjectId(a))
      }
    });
  }).then((r) => {
    res.json(r);
    // res.send(JSON.stringify(r));
  }).catch((err) => {
    res.send(JSON.stringify(err));
  }).finally(() => {
    // createConnection.close();
  })
})

router.post('/:table/upload', upload.any(), ({ params, body, files }: any, res) => {

  db.connect().then(({ dbo }) => dbo.createCollection(params.table)).then(r => {
    const obj = body;
    obj.file = Binary(files[0].buffer)

    return r.insert(obj);
  }).then(({ insertedIds }) => {
    res.status(200).send(insertedIds);
  }).catch((err) => {
    res.send(JSON.stringify(err));
  }).finally(() => {
    // createConnection.close();
  })
})

router.get('/:table/download', ({ params, query }, res) => {

  db.connect().then(({ dbo }) => dbo.createCollection(params.table)).then(r => {
    const data = query;
    if (data._id) {
      data._id = new ObjectId(data._id);
    }

    return r.find(data || {}).toArray()
  }).then((documents) => {
    const file = documents[0].file;

    res.writeHead(200, {
      'Content-Type': documents[0].type,
      'Content-disposition': `attachment;filename=${encodeURIComponent(documents[0].fileName)}`,
      'Content-Length': documents[0].size
    });
    res.end(new Buffer(file.buffer, 'binary'));

  })
})

// 拼图api


export default router;
