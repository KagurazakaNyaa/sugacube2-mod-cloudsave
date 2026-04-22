# sugacube2-mod-cloudsave

CoT和DoL云存档mod

此 mod 会在存档导入/导出界面的“读取/Load Save Data”按钮右侧添加一个“云存档”按钮。

点击“云存档”后，会打开一个独立面板，里面提供：

- 上传云存档
- 下载云存档
- S3 配置

当前实现不依赖额外设置框架，配置界面由 mod 自己提供。

## 依赖

- [TweeReplacer](https://github.com/Lyoko-Jeremie/Degrees-of-Lewdity_Mod_TweeReplacer)
- [ReplacePatcher](https://github.com/Lyoko-Jeremie/Degrees-of-Lewdity_Mod_ReplacePatch)
- [sugarcube-2-ModLoader](https://github.com/Lyoko-Jeremie/sugarcube-2-ModLoader)

## 使用方式

1. 打开存档导入/导出界面。
2. 点击“云存档”。
3. 在面板中填写 S3 配置。
4. 直接执行上传或下载。

支持 path-style S3 兼容存储；如果使用 Minio，建议开启“S3使用路径模式”。
