'use strict';

var _config = require('../config');

var _db = require('../utils/db');

var _db2 = _interopRequireDefault(_db);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var express = require('express');
var router = express.Router();
var multer = require('multer');


var upload = multer();
var ObjectId = require('mongodb').ObjectId;

var _require = require('connect-ensure-login'),
    ensureLoggedIn = _require.ensureLoggedIn;

var removeProcessor = function removeProcessor(data) {
  var avliableKeys = {};
  try {
    Object.keys(data).forEach(function (a) {
      var value = data[a];
      if (!a.startsWith('$')) {
        if (a.endsWith('$')) {
          // 以$结尾表示 不等于
          avliableKeys[a.replace('$', '')] = {
            $ne: value
          };
        } else if (typeof value === 'string' && (value.toLocaleLowerCase() === 'true' || value.toLocaleLowerCase() === 'false')) {
          avliableKeys[a] = JSON.parse(value);
        } else {
          avliableKeys[a] = Number(value) ? Number(value) : value;
        }
      } else if (a === '$where' && value) {
        var where = JSON.parse(value); // 通过JSON序列化回来的字符串可以保留基础类型
        Object.assign(avliableKeys, where);
      }
    });

    // console.log('avliableKeys', avliableKeys)
  } catch (error) {
    console.error(error);
  }
  return avliableKeys;
};

var executeFuction = function executeFuction(dbo, func, query) {
  var params = Object.keys(query).map(function (k) {
    return query[k];
  });
  var script = func + '(\'' + params.join("','") + '\')';
  return dbo.eval(script);
};

var getTable = function getTable(dbo, table, query) {
  var data = query;
  if (data._id) {
    data._id = ObjectId(data._id);
  }
  console.log('get table');
  var execute = dbo.collection(table).find(removeProcessor(data) || {});
  var querys = null;
  if (data.$fields) {
    querys = {};
    data.$fields.split(',').forEach(function (a) {
      return querys[a] = 1;
    });
    execute = execute.project(querys);
  }
  if (data.$limit) {
    execute = execute.limit(parseInt(data.$limit));
  }
  if (data.$skip) {
    execute = execute.skip(parseInt(data.$skip));
  }
  if (data.$sort) {
    var sort = {};
    sort[data.$sort] = 1;
    execute = execute.sort(sort);
  }
  if (data.$sortdesc) {
    var _sort = {};
    _sort[data.$sortdesc] = -1;
    execute = execute.sort(_sort);
  }

  return execute.toArray();
};

router.get('/', function (req, res) {
  res.send('api was ready');
});

router.get('/js/:name', function (req, res) {
  _db2.default.connect(_config.dataBase).then(function (dbo) {
    return executeFuction(dbo, req.params.name, req.query);
  }).then(function (r) {
    res.json(r);
  }).catch(function (err) {
    res.send(JSON.stringify(err));
  }).finally(function () {});
});
router.post('/js/:name', function (req, res) {
  _db2.default.connect(_config.dataBase).then(function (dbo) {
    var params = Object.keys(req.body).map(function (k) {
      return req.body[k];
    });
    var script = req.params.name + '(\'' + params.join("','") + '\')';
    return dbo.eval(script);
  }).then(function (r) {
    res.json(r);
  }).catch(function (err) {
    res.send(JSON.stringify(err));
  }).finally(function () {
    // createConnection.close();
  });
});

router.get('/:table', function (req, res) {
  console.log(_config.dataBase + ', get table', req.params.table, req.query);
  _db2.default.connect(_config.dataBase).then(function (dbo) {
    return getTable(dbo, req.params.table, req.query);
  }).then(function (r) {
    // setTimeout(() => {
    res.json(r);
    // res.send(JSON.stringify(r));
    // }, Math.random() * 1000);
  }).catch(function (err) {
    res.send(JSON.stringify(err));
    // db.close();
  }).finally(function () {
    // db.close();
  });
});

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

router.post('/:table', function (req, res) {
  if (!req.user) {
    res.status(401).json({ status: 401 });return;
  }
  var objToInsert = req.body;
  _db2.default.connect(_config.dataBase).then(function (dbo, base) {
    return dbo.createCollection(req.params.table);
  }).then(function (r) {
    // const obj = req.body;
    var method = 'insertOne';
    if (Array.isArray(objToInsert)) {
      method = 'insertMany';
      objToInsert.forEach(function (a) {
        a.created = new Date();a.modified = new Date();
      });
    } else {
      objToInsert.created = new Date();
      objToInsert.modified = new Date();
    }
    return r[method](objToInsert);
  }).then(function (r, o, c) {
    res.json({ r: r, objToInsert: objToInsert, c: c });
  }).catch(function (err) {
    res.send(JSON.stringify(err));
    // db.close();
  }).finally(function () {
    // db.close();
  });
});

router.put('/:table', function (req, res) {
  if (!req.user) {
    res.status(401).json({ status: 401 });return;
  }
  _db2.default.connect(_config.dataBase).then(function (dbo) {
    var data = req.query;
    var body = req.body;
    if (data._id) {
      data._id = ObjectId(data._id);
    }
    body.modified = new Date();

    return dbo.collection(req.params.table).updateMany(data || {}, {
      "$set": body
    }, { upsert: true });
  }).then(function (r) {
    res.json(r);
  }).catch(function (err) {
    res.send(JSON.stringify(err));
  }).finally(function () {
    // createConnection.close();
  });
});

router.delete('/:table', function (req, res) {
  if (!req.user) {
    res.status(401).json({ status: 401 });return;
  }
  _db2.default.connect(_config.dataBase).then(function (dbo) {
    var data = req.query;
    var options = [];

    if (data && data._id) {
      options.push(data._id);
    } else if (req.body && Array.isArray(req.body)) {
      options = options.concat(req.body);
    }
    if (options.length == 0) throw "cannot find delete prarms";

    return dbo.collection(req.params.table).deleteMany({
      "_id": {
        $in: options.map(function (a) {
          return ObjectId(a);
        })
      }
    });
  }).then(function (r) {
    res.json(r);
    // res.send(JSON.stringify(r));
  }).catch(function (err) {
    res.send(JSON.stringify(err));
  }).finally(function () {
    // createConnection.close();
  });
});

router.post('/:table/upload', upload.any(), function (req, res) {

  _db2.default.connect(_config.dataBase).then(function (dbo) {
    return dbo.createCollection(req.params.table);
  }).then(function (r) {
    var obj = req.body;
    obj.file = Binary(req.files[0].buffer);

    return r.insert(obj);
  }).then(function (r, o, c) {
    res.status(200).send(r.insertedIds);
  }).catch(function (err) {
    res.send(JSON.stringify(err));
  }).finally(function () {
    // createConnection.close();
  });
});

router.get('/:table/download', function (req, res) {

  _db2.default.connect(_config.dataBase).then(function (dbo) {
    return dbo.createCollection(req.params.table);
  }).then(function (r) {
    var data = req.query;
    if (data._id) {
      data._id = ObjectId(data._id);
    }

    return r.find(data || {}).toArray();
  }).then(function (documents, err) {
    if (err) console.error(err);

    var file = documents[0].file;

    res.writeHead(200, {
      'Content-Type': documents[0].type,
      'Content-disposition': 'attachment;filename=' + encodeURIComponent(documents[0].fileName),
      'Content-Length': documents[0].size
    });
    res.end(new Buffer(file.buffer, 'binary'));
  });
});

// 拼图api


module.exports = { router: router, executeFuction: executeFuction, getTable: getTable };
//# sourceMappingURL=api.js.map