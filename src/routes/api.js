const express = require('express');
const router = express.Router();
var multer = require('multer');
import {dataBase} from '../config';
import db from '../utils/db';

var upload = multer();
var ObjectId = require('mongodb').ObjectId
const { ensureLoggedIn } = require('connect-ensure-login');

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

const executeFuction = (dbo, func, query) => {
  const params = Object.keys(query).map(k => query[k]);
  const script = `${func}('${params.join("','")}')`;
  return dbo.eval(script);
}

const getTable = (dbo, table, query) => {
  const data = query;
  if (data._id) {
    data._id = ObjectId(data._id);
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

router.get('/',(req,res)=>{
  res.send('api was ready');
})

router.get('/js/:name', (req, res) => {
  db.connect(dataBase).then((dbo) => executeFuction(dbo, req.params.name, req.query)).then((r) => {
    res.json(r);
  }).catch((err) => {
    res.send(JSON.stringify(err));
  }).finally(() => {
  })
})
router.post('/js/:name', (req, res) => {
  db.connect(dataBase).then((dbo) => {
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

router.get('/:table', (req, res) => {
  console.log(`${dataBase}, get table`, req.params.table, req.query);
  db.connect(dataBase).then((dbo) => getTable(dbo, req.params.table, req.query)).then((r) => {
    // setTimeout(() => {
    res.json(r);
    // res.send(JSON.stringify(r));
    // }, Math.random() * 1000);
  }).catch((err) => {
    res.send(JSON.stringify(err));
    // db.close();
  }).finally(() => {
    // db.close();
  })
})

//取表中，总条数
// router.get('/Count/:table', (req, res) => {
//   db.open(dataBase).then((dbo) => {
//     const data = req.query;

//     if (data._id) {
//       data._id = ObjectId(data._id);
//     }

//     let execute = dbo.collection(req.params.table).find(removeProcessor(data) || {});
//     return execute.toArray();
//   }).then((r) => {
//     // setTimeout(() => {
//     res.send(JSON.stringify({ 'total': r.length }));
//     // }, Math.random() * 1000);
//   }).catch((err) => {
//     res.send(JSON.stringify(err));
//   }).finally(() => {
//     db.close();
//   })
// })

router.post('/:table', (req, res) => {
  if (!req.user) { res.status(401).json({ status: 401 }); return; }
  var objToInsert = req.body;
  db.connect(dataBase).then((dbo, base) => dbo.createCollection(req.params.table)).then(r => {
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
  }).then((r, o, c) => {
    res.json({ r, objToInsert, c });
  }).catch((err) => {
    res.send(JSON.stringify(err));
    // db.close();
  }).finally(() => {
    // db.close();
  })
})

router.put('/:table', (req, res) => {
  if (!req.user) { res.status(401).json({ status: 401 }); return; }
  db.connect(dataBase).then((dbo) => {
    const data = req.query;
    const body = req.body;
    if (data._id) {
      data._id = ObjectId(data._id);
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

router.delete('/:table', (req, res) => {
  if (!req.user) { res.status(401).json({ status: 401 }); return; }
  db.connect(dataBase).then((dbo) => {
    const data = req.query;
    let options = [];

    if (data && data._id) {
      options.push(data._id);
    } else if (req.body && Array.isArray(req.body)) {
      options = options.concat(req.body);
    }
    if (options.length == 0) throw "cannot find delete prarms";

    return dbo.collection(req.params.table).deleteMany({
      "_id": {
        $in: options.map(a => ObjectId(a))
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

router.post('/:table/upload', upload.any(), (req, res) => {

  db.connect(dataBase).then((dbo) => dbo.createCollection(req.params.table)).then(r => {
    const obj = req.body;
    obj.file = Binary(req.files[0].buffer)

    return r.insert(obj);
  }).then((r, o, c) => {
    res.status(200).send(r.insertedIds);
  }).catch((err) => {
    res.send(JSON.stringify(err));
  }).finally(() => {
    // createConnection.close();
  })
})

router.get('/:table/download', (req, res) => {

  db.connect(dataBase).then((dbo) => dbo.createCollection(req.params.table)).then(r => {
    const data = req.query;
    if (data._id) {
      data._id = ObjectId(data._id);
    }

    return r.find(data || {}).toArray()
  }).then(function (documents, err, ) {
    if (err) console.error(err);

    const file = documents[0].file;

    res.writeHead(200, {
      'Content-Type': documents[0].type,
      'Content-disposition': 'attachment;filename=' + encodeURIComponent(documents[0].fileName),
      'Content-Length': documents[0].size
    });
    res.end(new Buffer(file.buffer, 'binary'));

  })
})

// 拼图api


module.exports = { router, executeFuction, getTable };
