import { MongoClient, Db } from 'mongodb';

export const config = {
  dbUrl: 'mongodb://restry:wanICE193gxLoYpYT7ttHtWPlSnoZ6o68es0l05MNHPsMvyyfnynMGLRZUHYnLiwOedLro0WUhSWZdVnzjzMyg%3D%3D@restry.documents.azure.cn:10255/?ssl=true',// 阿里外网
  dataBase: 'auction',
}

if (process.env.NODE_ENV === 'development') {

}

var db = (function () {
  //实例容器
  var dbo: Db;
  var client: MongoClient;

  function Singleton(database) {
    var url = config.dbUrl;
    // console.log(`url:${url}`);
    return new Promise((resolve, reject) => {
      // Use connect method to connect to the Server
      MongoClient.connect(url, { useNewUrlParser: true, useUnifiedTopology: true },
        (err, c) => {
          if (err) {
            reject(err);
            console.log('db.serverStatus:', err.message);
          } else {
            client = c;
            dbo = client.db(database);
            resolve({ dbo, client });
          }
        });
    });
  }


  var _static = {
    name: 'SingletonDBConnection',

    //获取实例的方法
    //返回Singleton的实例
    connect: function (dbName = config.dataBase) {
      if (dbo === undefined) {
        console.log(`instance not found: ${dbName}`);
        return Singleton(dbName);
      }
      return Promise.resolve({ dbo, client });
    }
  };
  return _static;
})();

export default db;

