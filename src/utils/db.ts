import { MongoClient, Db } from 'mongodb';
import { createPool, Pool } from 'generic-pool';

export const config = {
  dbUrl:
    'mongodb://auction:auction123456@windart-api.chinanorth.cloudapp.chinacloudapi.cn:28888/?authSource=auction_db', // 阿里外网
  dataBase: 'auction_db'
};

// 创建一个连接池
const pool = createPool(
  {
    create: async function () {
      // 创建数据库连接
      const client = await MongoClient.connect(
        'mongodb://auction:auction123456@windart-api.chinanorth.cloudapp.chinacloudapi.cn:28888/?authSource=auction_db',
        {
          useNewUrlParser: true,
          useUnifiedTopology: true
        }
      );
      return client;
    },
    destroy: function (client) {
      // 关闭数据库连接
      return client.close();
    }
  },
  {
    max: 10, // 最大连接数
    min: 2, // 最小连接数
    idleTimeoutMillis: 30000, // 连接池空闲超时时间
    acquireTimeoutMillis: 5000 // 获取连接的超时时间
  }
);

const connect = async (dbName = 'auction_db') => {
  try {
    // 从连接池中获取一个连接
    const client = await pool.acquire();
    const dbo = client.db(dbName);
    return { client, dbo, pool };
  } catch (error) {
  } finally {
  }
  // 释放连接
};

if (process.env.NODE_ENV === 'development') {
}

interface DbType {
  name: string;
  connect: (dbUrl?: string, dbName?: string) => Promise<{ dbo: Db; client: MongoClient }>;
}

var db = (function () {
  //实例容器
  var dbo: Db;
  var client: MongoClient;

  function Singleton(dbUrl, database) {
    // console.log(`url:${url}`);
    return new Promise((resolve, reject) => {
      // Use connect method to connect to the Server
      MongoClient.connect(dbUrl, { useNewUrlParser: true, useUnifiedTopology: true }, (err, c) => {
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
    connect: function (dbUrl = config.dbUrl, dbName = config.dataBase) {
      if (dbo === undefined) {
        console.log(`instance not found: ${dbName}, ${dbUrl}`);
        return Singleton(dbUrl, dbName);
      }

      return Promise.resolve({ dbo, client });
    }
  } as DbType;
  return _static;
})();

export default { connect, pool };
