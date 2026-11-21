# Clinamen 弹幕练习场

[打开试玩](https://renko6626.github.io/clinamen-practice/)

按作品和关卡选段，方向键移动、Z 射击、按住 Shift 低速、Esc 暂停。游戏中可复制反馈，结束后可用同种子重试。

网站用 Vue、Canvas 和 WASM 在浏览器执行单段弹幕。卡包收录 Clinamen 已转录的启用卡与合成练习，开放各卡声明的所有难度。东方 Project 原作归上海アリス幻樂団／ZUN。 [卡库和出处](https://github.com/Renko6626/Clinamen/tree/main/cards)

## 本地开发

```bash
npm ci
npm run dev
```

push 到 `main` 后由 GitHub Actions 构建并发布到 Pages。Actions 使用仓库自带的 WASM 和卡包，构建只需 Node.js。

## 更新引擎和卡包

在 Clinamen 仓库根目录构建卡包，用生成目录更新本仓的 `public/practice/`。以下命令适用于两个仓库位于同级目录的情况。

```bash
web/practice/build.sh --all-transcribed
rsync -a --delete web/practice/.generated/ ../clinamen-practice/public/practice/
```

同一次导出打包 WASM、卡库与 Clinamen GIF 预览使用的同版图集和自机贴图。
