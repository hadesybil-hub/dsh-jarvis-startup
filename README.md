# DSH Jarvis Startup

给 DeepSeek Harness Desktop 加上贾维斯风格的原生开场：窗口首屏显示青蓝 HUD，后台继续初始化，主界面就绪后收尾进入。每个完整启动的主进程只自动播放一次；F5、切换会话和托盘恢复不会重新播放。

这是个人定制项目，非 DeepSeek 官方组件。项目从 [dsh-startup-screen](https://github.com/6shenhonghong9/dsh-startup-screen) 的 MIT 版插件演进而来，保留上游署名。音乐、语音和代码的来源见 [THIRD_PARTY.md](THIRD_PARTY.md)。

## 能做什么

- 原生首屏与页面初始化使用同一份动画，不会播两段。
- 美式神经男声、轻空间回声、CC0 科幻配乐；播报时自动压低音乐。
- 默认音乐音量 72%，播报时 36%；姓名与默认参数可配置。
- 后台启动信号与主界面导航控件就绪后才收尾，保留跳过和超时释放。
- 原版备份、文件完整性检查、原生启动恢复；遇到不同 DSH 构建时拒绝覆盖。

## 支持范围

目前仅适配 **Windows、DSH Desktop 0.2.1-rc.3**，原始 `app.asar` SHA-256 必须为：

```text
04b32e3a872826ba15cfb2081c6a929a8d4ecaa65e09a2543e5a6b30e2eff1f0
```

同一版本号也可能对应不同构建，不能只看版本号就强行安装。原始定制版已由用户在其 Windows 11 机器手动验收；本仓库的通用路径参数和发布脚本尚未在所有安装环境实测。其他版本需要重新适配，脚本没有强制跳过版本检查的选项。

## 安装原生开场

需要 Node.js **22.12.0 或更新版本**、Python **3.10 或更新版本**，以及已经安装的 DSH。以下命令在项目目录中用 PowerShell 执行。

1. 安装本项目的构建依赖：

   ```powershell
   npm ci
   python -m pip install -r requirements.txt
   ```

2. 生成自己的语音。此步骤联网访问在线语音服务；生成完成后，开场音频在本机离线播放。

   ```powershell
   python generate-audio.py --spoken-name "Commander"
   ```

   需要代理时，可给本次命令添加 `--proxy "http://127.0.0.1:端口"`。脚本不会修改系统代理或 git 配置。`--voice` 可更换服务当前提供的音色。

3. 从托盘菜单**完全退出 DSH**。把下方路径替换成自己的 DSH 安装目录，执行安装：

   ```powershell
   .\manage-native.ps1 -Action Install -AppDir "D:\Apps\DSH" -DisplayName "Commander"
   ```

   脚本会在 `.local-state` 保存原始备份、生成补丁并替换资源文件。DSH 仍在运行时会停止部署。安装目录需要写入权限；权限不足时，请在有相应权限的 PowerShell 中执行。

4. 从原来的 DSH 图标打开。主进程出现后会显示开场；F5 只刷新应用，不重播。操作系统启动可执行文件本身的耗时不受本项目控制。

显示名与口播名分别由 `-DisplayName` 和 `--spoken-name` 指定。修改口播名后重新生成语音，再安装补丁。

## 恢复原生启动

先完全退出 DSH，再执行：

```powershell
.\manage-native.ps1 -Action Restore -AppDir "D:\Apps\DSH"
```

恢复只处理本项目修改的 `app.asar`，不删除聊天、模型配置、壁纸或其他插件。保留整个 `.local-state` 目录；它包含原始备份。若安装时使用了自定义 `-StateDir`，恢复时必须传入同一目录。

如需彻底移除开场，恢复原生文件后，也请禁用或卸载可选的 `dsh-startup-screen` 插件。

检查本项目的备份与当前安装状态：

```powershell
.\manage-native.ps1 -Action Check -AppDir "D:\Apps\DSH"
```

DSH 更新可能覆盖开场。若当前文件与原版、补丁版均不匹配，恢复程序会拒绝覆盖，避免把新版 DSH 降级成旧文件。请先为新版重新适配。

## 可选：启动动画设置页

原生开场本身不需要另装插件。需要 DSH 内的设置页和“立即预览”时，可在生成语音后打包配套插件：

```powershell
npm run pack:plugin
```

在 DSH 的“插件 → 添加插件”里粘贴 `artifacts` 中生成的 `.tgz` 完整路径，再重启 DSH。包名沿用上游的 `dsh-startup-screen`，会更新同名插件，不会同时安装第二份。原生开场会让插件识别到已接管的首屏，避免重复播放。单独使用插件而未接入原生开场时，不包含本项目对原生启动和进程级 F5 行为的保证。

不装设置页也可编辑 `defaults.json` 后重新安装；已存在的 DSH 启动插件配置会覆盖其中相同字段。

## 实现与目录

`native-patch.cjs` 仅替换 ASAR 内的 `lib/main.js` 和 Web 前端 `index.html`。它保留原始数据区、更新对应条目的偏移及完整性信息，并比较其他打包文件的字节内容。不会关闭 ASAR 完整性保护、修改 EXE、修改代理或改变窗口的 sandbox/contextIsolation/webSecurity 设置。

源码平铺在根目录；本机生成内容放进被 Git 忽略的 `.local-state`、`artifacts` 和 `node_modules`。不要把原版/补丁版 ASAR、个人配置、凭据或生成的语音文件提交到仓库。

## 许可证与致谢

代码采用 [MIT](LICENSE)，保留上游作者沈宏宏的版权声明；音乐采用其作者声明的 CC0。感谢 DeepSeek Harness、dsh-startup-screen、CodeManu、Electron ASAR 与 edge-tts 项目。
