# 阶段 3B 浏览器证据（进行中）

- `mobile-nav-before.png`：在当前本地首页的隔离无头浏览器中，把导航容器临时还原为修复前的 `flex justify-between` 样式后截取；没有改动服务端或仓库文件。真实设备视口为 375 × 812 CSS 像素，可见链接挤压和知识库入口裁切。
- `mobile-nav-after.png`：同一浏览器恢复当前代码的三列、两行导航样式后截取。`window.innerWidth` 与 `document.documentElement.scrollWidth` 均为 375；六个导航项边界均在 20–355 像素内。

Edge 命令行指定 375 像素窗口时，实际 CSS 视口最小为 500 像素；以上两张证据改用 DevTools 设备视口覆盖到真实 375 像素后采集。此处只证明公开首页移动导航，不代替后台登录后的 D2 弹窗、三类草稿转换和展示说明的交互验收。
