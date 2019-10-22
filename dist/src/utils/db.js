'use strict';

var config = {
  dbUrl: 'mongodb://restry:wanICE193gxLoYpYT7ttHtWPlSnoZ6o68es0l05MNHPsMvyyfnynMGLRZUHYnLiwOedLro0WUhSWZdVnzjzMyg%3D%3D@restry.documents.azure.cn:10255/?ssl=true' // 阿里外网
  // dbUrl: 'mongodb://admin:teddi98fDFerr32@dds-2ze4140fda57f0341.mongodb.rds.aliyuncs.com:3717,dds-2ze4140fda57f0342.mongodb.rds.aliyuncs.com:3717/xtphoto?replicaSet=mgset-10875345', // 阿里内网连接

};

if (process.env.NODE_ENV === 'development') {
  // config.dbUrl = 'mongodb://admin:Mongohere1@ali.windart.vip:28888/'
  // config.dbUrl = 'mongodb://admin:teddi98fDFerr32@mgr.xtphoto.net:27017/'
  config.dbUrl = 'mongodb://restry:wanICE193gxLoYpYT7ttHtWPlSnoZ6o68es0l05MNHPsMvyyfnynMGLRZUHYnLiwOedLro0WUhSWZdVnzjzMyg%3D%3D@restry.documents.azure.cn:10255/?ssl=true';
}
'use strict';

var mongoClient = require('mongodb').MongoClient;
var Promise = require("bluebird");

var db = function () {
  //实例容器
  var instance;

  function Singleton(database) {
    var url = config.dbUrl;
    // console.log(`url:${url}`);
    return new Promise(function (resolve, reject) {
      // Use connect method to connect to the Server

      mongoClient.connect(url, { useNewUrlParser: true, useUnifiedTopology: true }, function (err, db) {
        if (err) {
          reject(err);
          // console.log('db.serverStatus:', db.serverStatus())
        } else {
          instance = db.db(database);
          resolve(instance, db);
        }
      });
    });
  }

  var _static = {
    name: 'SingletonDBConnection',

    //获取实例的方法
    //返回Singleton的实例
    connect: function connect(args) {
      if (instance === undefined) {
        console.log('instance not found: ' + args);
        return new Singleton(args);
      }
      return Promise.resolve(instance);
    }
  };
  return _static;
}();

module.exports = db;
//# sourceMappingURL=db.js.map