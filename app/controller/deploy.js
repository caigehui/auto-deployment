'use strict';
const fs = require('fs');
const path = require('path');
const sendToWormhole = require('stream-wormhole');
const Controller = require('egg').Controller;
const unzipper = require('unzipper');

const pathToPublic = path.join(__dirname, '..', 'public');
const pathToZip = path.join(__dirname, '..', 'public', 'dist.zip');
const pathToIndex = path.join(__dirname, '..', 'public', 'index.html');
const pathToView = path.join(__dirname, '..', 'view', 'index.html');

class DeployController extends Controller {
  async upload() {
    const { ctx } = this;
    const stream = await ctx.getFileStream();
    try {
      if (stream.fields.token === this.app.config.token) {
        // 删除文件夹下面的文件
        delDir(pathToPublic);
        // 保存文件
        await saveFile(pathToZip, stream);
        // 解压
        await unzipFile(pathToZip, pathToPublic);
        await delay(1000);
        // 复制index.html
        await moveFile(pathToIndex, pathToView);
      } else {
        throw 'token is wrong';
      }
      // result = await ctx.oss.put(name, stream);
    } catch (err) {
      // 必须将上传的文件流消费掉，要不然浏览器响应会卡死
      console.log(err);
      await sendToWormhole(stream);
      ctx.status = 400;
      ctx.body = {
        err,
      };
      return;
    }
    ctx.status = 200;
    ctx.body = { msg: 'success' };
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function saveFile(filePath, readStrem) {
  return new Promise((resolve, reject) => {
    // 块方式写入文件
    const ws = fs.createWriteStream(filePath);
    readStrem.pipe(ws);
    ws.on('error', err => {
      reject(err);
    });
    ws.on('finish', () => {
      resolve(true);
    });
  });
}

function unzipFile(pathToZip, pathToPublic) {
  return new Promise((resolve, reject) => {
    const ws = unzipper.Extract({ path: pathToPublic });
    fs.createReadStream(pathToZip).pipe(ws);
    ws.on('error', err => {
      reject(err);
    });
    ws.on('finish', () => {
      resolve(true);
    });
  });
}

function moveFile(sourcePath, destPath) {
  return new Promise((resolve, reject) => {
    const source = fs.createReadStream(sourcePath);
    const dest = fs.createWriteStream(destPath);

    source.pipe(dest);
    source.on('end', function() {
      resolve(true);
    });
    source.on('error', function(err) {
      reject(err);
    });
  });
}

function delDir(path) {
  let files = [];
  if (fs.existsSync(path)) {
    files = fs.readdirSync(path);
    files.forEach(file => {
      const curPath = path + '/' + file;
      if (fs.statSync(curPath).isDirectory()) {
        delDir(curPath); // 递归删除文件夹
      } else {
        fs.unlinkSync(curPath); // 删除文件
      }
    });
  }
}

module.exports = DeployController;
