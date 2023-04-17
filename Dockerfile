# 使用最小node容器作为基础镜像使用pm2运行main.js
FROM node:alpine

WORKDIR /app
COPY ./dist/** /app
COPY ./ecosystem.config.js /app
COPY ./package.json /app
COPY ./yarn.lock /app

ENV NODE_ENV=production
RUN npm install -g pm2
RUN yarn install --prod
EXPOSE 3000
CMD ["pm2-runtime", "start", "ecosystem.config.js"]