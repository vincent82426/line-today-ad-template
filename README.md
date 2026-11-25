# LINE TODAY 上刊圖模板

用於 LINE TODAY「看看」沉浸式廣告的靜態圖片製作與卡片預覽。上傳主圖與廠商 Logo，調整裁切、廠商名稱、標題和內文，再下載素材。

## 本機使用

在專案根目錄執行 `python3 -m http.server 3000`，再從現代瀏覽器開啟 `http://localhost:3000`。

## 圖片與版型

- 「下載進稿圖」輸出 1080 × 1920 px 的主圖。JPG 會依需要壓縮至 950 KB 內，PNG 超過 950 KB 時可改選 JPG。
- 「下載卡片示意圖」輸出 798 × 1192 px。卡片比例、圓角、底部文案與按鈕位置依提供的 PSD 與截圖模擬。標題最多顯示兩行，內文以單行省略顯示。實際 LINE 版型會依裝置與版本調整。
- 安全範圍依 LINE 設計指南的 888 × 1152 px 中央範圍繪製，工具也會依官方上架資料表提醒文案字數。安全範圍線只在編輯器內顯示。
- 頁面中的所有圖片處理都在瀏覽器完成。示範用的是獨立的照片、圖示和文案，原始 PSD 和截圖僅用來量測版面。

[LINE 官方進稿規格與設計指南](https://tw.linebiz.com/download/line-guaranteed-ads/)

## GitHub Pages

將這個目錄的內容提交到 `main`。在 GitHub 儲存庫設定的 **Pages** 頁面，選擇 **Deploy from a branch → main → /(root)**，儲存後即可發布。網頁可以直接由瀏覽器執行，無須建置步驟。

[GitHub Pages 發布設定](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

## 示範素材

- 示範照片來自 [Unsplash](https://images.unsplash.com/photo-1472396961693-142e6e269027)，適用 [Unsplash License](https://unsplash.com/license)。
- Noto Sans TC 採 SIL Open Font License，授權文件在 [assets/OFL-NotoSansTC.txt](assets/OFL-NotoSansTC.txt)。
