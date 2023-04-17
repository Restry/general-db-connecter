module.exports = {
  apps: [{
    name: 'general-db-connecter',
    script: 'server.js',
    instances: 4, // 运行两个实例
    exec_mode: 'cluster', // 使用集群模式
    watch: true, // 监听文件变化
    env: {
      NODE_ENV: 'production'
    },
    env_production: {
      NODE_ENV: 'production'
    }
  }]
}
