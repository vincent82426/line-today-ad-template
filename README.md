# LINE TODAY 上刊圖模板

用於 LINE TODAY「看看」沉浸式廣告的靜態圖片製作與卡片預覽。上傳主圖與廠商 Logo，調整裁切、廠商名稱、標題和內文，再下載素材。

## 本機使用

在專案根目錄執行 `python3 -m http.server 3000`，再從現代瀏覽器開啟 `http://localhost:3000`。

## 圖片與版型

- 「螢幕截圖」顯示卡片在指定 LINE TODAY 畫面中的樣子，可下載 869 × 1884 px 的 PNG。在「螢幕截圖設定」可更換上方時間與「分類」右邊的兩個名稱，留空會保留原圖文字。
- 「下載卡片示意圖」可輸出 798 × 1192 px 的 JPG 或 PNG。卡片文字使用 Adobe 思源黑體臺灣版。廠商名稱為 28 px Regular（400），標題為 43 px Semibold（600）、行距 61 px，內文為 32 px Regular（400），按鈕文字為 28 px Semibold（600）。文字大小與位置以指定截圖和 PSD 為準。
- 安全範圍依 LINE 設計指南的 888 × 1152 px 中央範圍繪製，工具也會依官方上架資料表提醒文案字數。安全範圍線只在編輯器內顯示。
- 頁面中的所有圖片處理都在瀏覽器完成。示範用的是獨立的照片、圖示和文案，螢幕截圖底圖保留原參考圖的卡片外區域。

[LINE 官方進稿規格與設計指南](https://tw.linebiz.com/download/line-guaranteed-ads/)

## GitHub Pages

將這個目錄的內容提交到 `main`。在 GitHub 儲存庫設定的 **Pages** 頁面，選擇 **Deploy from a branch → main → /(root)**，儲存後即可發布。網頁可以直接由瀏覽器執行，無須建置步驟。

[GitHub Pages 發布設定](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

## 示範素材

- 示範照片來自 [Unsplash](https://images.unsplash.com/photo-1472396961693-142e6e269027)，適用 [Unsplash License](https://unsplash.com/license)。
- Adobe [Source Han Sans](https://github.com/adobe-fonts/source-han-sans) 採 SIL Open Font License，授權文件在 [assets/OFL-SourceHanSans.txt](assets/OFL-SourceHanSans.txt)。
- 時鐘的跨平台替代字型取自 [Inter](https://github.com/rsms/inter) 的數字子集，授權文件在 [assets/OFL-Inter.txt](assets/OFL-Inter.txt)。
