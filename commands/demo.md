# /demo - 啟動 Demo 環境

> 啟動本地服務並透過 ngrok 暴露給老闆查看。

## 輸入

$ARGUMENTS（可選：`frontend`、`backend`、`all`，預設 `frontend`）

---

## 執行流程

### Step 0：檢查 Vite 配置

讀取目標專案的 `vite.config.ts`，確認 `server.allowedHosts` 設為 `true`。

- 若已設定 → 跳過
- 若未設定或值不正確 → 自動修正，加入 `server: { allowedHosts: true }`
- **注意**：Vite 8+ 必須用 `true`（布林值），不可用 `'all'`（字串），否則會報錯

修正後不需 commit，這是本地 dev 設定。

### Step 1：清理舊 ngrok 進程

後踢前原則——啟動新的 ngrok 前，先殺掉所有殘留進程：

```bash
pkill -f ngrok 2>/dev/null || true
sleep 1
# 確認已清理乾淨
pgrep -f ngrok && echo "警告：ngrok 未完全清除" || echo "ngrok 已清理"
```

### Step 2：啟動服務

根據 $ARGUMENTS 決定啟動哪些服務：

| 參數 | 動作 |
|------|------|
| `frontend`（預設） | `cd frontend && npm run dev` |
| `backend` | `cd backend && npm run dev`（或對應啟動指令） |
| `all` | 同時啟動 frontend + backend |

使用背景執行，等待服務 ready（監聽到 port 輸出）。

```bash
# 範例：啟動前端
cd frontend && npm run dev &
# 等待 port ready
sleep 3
```

確認服務的 port（從 vite.config.ts 或終端輸出取得，通常是 5173）。

### Step 3：啟動 ngrok

```bash
ngrok http {port} --log stdout &
sleep 3
# 從 ngrok API 取得公開 URL
curl -s http://127.0.0.1:4040/api/tunnels | grep -o '"public_url":"[^"]*"'
```

取得 ngrok 公開 URL。

### Step 4：通知老闆

直接在對話中貼出 URL，格式：

```
🔗 Demo 已上線

前端：{ngrok URL}

⚠️ ngrok 免費版連結每次重啟會變，請用最新的。
```

若有設定 Telegram，同時用 `telegram_send_message` 發送：

```
[BRAIN] 🔗 Demo 已上線
前端：{ngrok URL}
可以直接點開看～
```

---

## 注意事項

- ngrok 免費版同時只能開一條 tunnel，`all` 模式需要付費帳號或分次展示
- 若 ngrok 回報 ERR_NGROK，檢查是否有其他 ngrok 進程未清除
- Demo 結束後記得關閉 ngrok 和 dev server，避免佔用資源
