# 网页红井测试版一键部署

网页红警一键部署包/chronodivide asssets。网页红井（网页版“红警”/Chronodivide）预览版测试站点，帮助各类爱好者一键搭建自己的网页版“红警”站点.

Web-based Red Alert one-click deployment package / Chronodivide assets.
Webpage Well is a preview test site of “Web-based Red Alert” / Chronodivide, designed to help enthusiasts of all kinds quickly set up their own web “Red Alert” site with one click.

## 重要说明（许可与使用边界）

本项目（RA2WEB / 网页红井 / 红色井界）仅用于个人研究和爱好用途，不得将本项目作为商业用途直接或间接使用。
在任何部署、分发、展示或二次发布时，必须**显著保留**以下任一名称：`RA2WEB`、`网页红井`、`红色井界`，不得删除、隐藏或替换为其他名称。

除非取得版权方 **北京瑞得哈希有限公司** 的书面授权，严禁将本项目用于任何商业用途，包括但不限于：付费使用、广告变现、商用托管、授权出售、商业集成、商业代部署、商业推广活动。
如有商用意向，请先联系版权方取得书面许可。

## Usage Notice

This project (RA2WEB / 网页红井 / 红色井界) is provided for personal research and hobby use only.
Any deployment, distribution, demonstration, or republishing must clearly keep one of these names: `RA2WEB`, `网页红井`, or `红色井界`, and must not remove, hide, or replace them.

Commercial use is strictly prohibited unless written authorization is obtained from the copyright holder **REDHASH Co., Ltd.**.
Commercial use includes, but is not limited to, paid usage, ad monetization, commercial hosting, licensing, commercial integration, commercial deployment services, or promotional/commercial campaigns.
For commercial authorization, please contact the copyright holder first to obtain written permission.

## 赞助商

本项目的CDN加速和安全防护由腾讯EdgeOne赞助

[![最佳亚洲 CDN、Edge 和安全解决方案 - 腾讯 EdgeOne](https://edgeone.ai/media/34fe3a45-492d-4ea4-ae5d-ea1087ca7b4b.png)](https://edgeone.ai/?from=github)

## 一键部署

### Github托管页面

fork该项目，命名为 你的名字.github.io，例如 ra2web.github.io

正如你所见，这个项目的名字就符合这个域名规则。那么，此时的你可以访问 https://ra2web.github.io 来游玩网页红井拉

当前本项目同样可以通过github pages访问，地址就是 https://ra2web.github.io

### 腾讯云EdgeOne Pages

[![使用 EdgeOne Pages 部署](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://edgeone.ai/pages/new?repository-url=https%3A%2F%2Fgithub.com%2Fra2web%2Fra2web.github.io)

### Vercel

[![一键部署到Vercel](https://vercel.com/button)](https://vercel.com/import/project?template=https://github.com/ra2web/ra2web.github.io)

## LAN / self-hosted setup

This fork points the client at a self-hosted LAN server (see `config.ini` and
`servers.ini`, which target `http://127.0.0.1:8054`).

The game resource archive `Red-Alert-2-Multiplayer.exe` (~197 MB) is **not**
committed to this repo because it exceeds GitHub's 100 MB file limit. Download it
separately and have the LAN server serve it:

1. Download the archive:
   https://archive.org/download/red-alert-2-multiplayer/Red-Alert-2-Multiplayer.exe
2. Place `Red-Alert-2-Multiplayer.exe` where the LAN server serves static files so
   it is reachable at `http://127.0.0.1:8054/Red-Alert-2-Multiplayer.exe`
   (this matches `gameResArchiveUrl` in `config.ini`).
3. Start the LAN server, then load the client.

### Game resource assets (`v2/`)

The `v2/*.mix`, `v2/*.png`, and `v2/*.mp4` game-data files are likewise **not**
committed (they total ~150 MB). They are listed in `v2/manifest.json` and served by
the LAN server the same way as the `.exe`: keep them on disk in `v2/` so the server
hands them out at `http://127.0.0.1:8054/v2/...`. Run the LAN server with
`CLIENT_DIR` pointed at this directory and the client loads them automatically.

#### Where to download the assets

If your `v2/` directory is empty (fresh checkout), repopulate it from the upstream
RA2WEB sources — either path works:

- **Pre-extracted CDN (matches `v2/manifest.json`):** download `manifest.json` and
  each listed file from the upstream gameres CDN:
  - primary: `https://stdres.wangerhuoda.cn/` (e.g. `https://stdres.wangerhuoda.cn/anims.mix`)
  - backup: `https://wyhjres2.bun.sh.cn/`
- **Full resource pack:** `https://download.ra2web.com/full-pack.7z` — a single 7z
  archive of all resources; extract the `.mix`/`.png`/`.mp4` files into `v2/`.
- **Game archive:** the `Red-Alert-2-Multiplayer.exe` above also contains these
  assets; the client can extract them via its import dialog when
  `gameResArchiveUrl` is set and `autoLoadGameRes` is off.

Place the files in `v2/` (and `v2/ls/` for the `ls800*.png` loading screens) so the
LAN server serves them at `http://127.0.0.1:8054/v2/...`.


