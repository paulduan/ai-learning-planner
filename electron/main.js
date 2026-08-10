const { app, BrowserWindow, shell, dialog } = require("electron");
const { fork, execSync } = require("child_process");
const path = require("path");
const http = require("http");
const fs = require("fs");

const PORT = 3456;
const IS_DEV = process.env.ELECTRON_DEV === "1";

let mainWindow;
let serverProcess;

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try {
    const logDir = path.join(app.getPath("userData"), "logs");
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(path.join(logDir, "app.log"), line + "\n");
  } catch {
    // ignore logging failures
  }
}

function getDataDir() {
  const dir = path.join(app.getPath("userData"), "data");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getServerEntry() {
  if (IS_DEV) return null;
  if (!app.isPackaged) {
    return path.join(__dirname, "..", ".next", "standalone", "server.js");
  }
  return path.join(process.resourcesPath, "standalone", "server.js");
}

function getServerCwd() {
  if (!app.isPackaged) {
    return path.join(__dirname, "..", ".next", "standalone");
  }
  return path.join(process.resourcesPath, "standalone");
}

function killPortProcess() {
  try {
    const result = execSync(`lsof -ti:${PORT}`, { encoding: "utf8" }).trim();
    if (!result) return;
    for (const pid of result.split("\n").filter(Boolean)) {
      try {
        process.kill(Number(pid), "SIGKILL");
        log(`Killed process on port ${PORT}: PID ${pid}`);
      } catch {
        // ignore
      }
    }
  } catch {
    log(`Port ${PORT} is free`);
  }
}

function startStandaloneServer() {
  const serverEntry = getServerEntry();
  const serverCwd = getServerCwd();
  const dataDir = getDataDir();

  log(`Starting server: ${serverEntry}`);
  log(`Server cwd: ${serverCwd}`);
  log(`Data dir: ${dataDir}`);
  log(`Server exists: ${fs.existsSync(serverEntry)}`);

  serverProcess = fork(serverEntry, [], {
    cwd: serverCwd,
    env: {
      ...process.env,
      NODE_ENV: "production",
      ELECTRON_RUN_AS_NODE: "1",
      PORT: String(PORT),
      HOSTNAME: "127.0.0.1",
      APP_DATA_DIR: dataDir,
      NODE_PATH: path.join(serverCwd, "node_modules"),
    },
    stdio: ["pipe", "pipe", "pipe", "ipc"],
  });

  serverProcess.stdout?.on("data", (data) => {
    log(`[Server] ${data.toString().trim()}`);
  });

  serverProcess.stderr?.on("data", (data) => {
    log(`[Server Error] ${data.toString().trim()}`);
  });

  serverProcess.on("exit", (code) => {
    log(`Server exited with code ${code}`);
    serverProcess = null;
  });

  serverProcess.on("error", (err) => {
    log(`Server process error: ${err.message}`);
  });
}

function waitForServer(maxAttempts = 60) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      attempts += 1;
      log(`Waiting for server... attempt ${attempts}/${maxAttempts}`);
      const req = http.get(`http://127.0.0.1:${PORT}/`, (res) => {
        res.resume();
        log("Server is ready");
        resolve();
      });
      req.on("error", () => {
        if (attempts >= maxAttempts) {
          reject(new Error(`Server failed to start after ${maxAttempts} attempts`));
          return;
        }
        setTimeout(check, 500);
      });
      req.setTimeout(2000, () => {
        req.destroy();
        if (attempts < maxAttempts) setTimeout(check, 500);
      });
    };
    check();
  });
}

const LOADING_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #0a0a0a;
    color: #e5e7eb;
    font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100vh;
    flex-direction: column;
    gap: 24px;
  }
  .title { font-size: 28px; font-weight: 700; }
  .spinner {
    width: 40px; height: 40px;
    border: 3px solid #374151;
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .hint { font-size: 14px; color: #6b7280; }
</style>
</head>
<body>
  <div class="title">🎯 精细化 AI 规划</div>
  <div class="spinner"></div>
  <div class="hint">正在启动，请稍候...</div>
</body>
</html>`;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    title: "精细化 AI 规划",
    titleBarStyle: "hiddenInset",
    backgroundColor: "#0a0a0a",
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(LOADING_HTML)}`);
  mainWindow.once("ready-to-show", () => mainWindow.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function loadAppUrl() {
  if (mainWindow) {
    mainWindow.loadURL(`http://127.0.0.1:${PORT}`);
  }
}

app.whenReady().then(async () => {
  log(`App ready (dev=${IS_DEV}, packaged=${app.isPackaged})`);
  if (!IS_DEV) killPortProcess();
  createWindow();

  try {
    if (IS_DEV) {
      await waitForServer();
    } else {
      startStandaloneServer();
      await waitForServer();
    }
    loadAppUrl();
  } catch (err) {
    log(`Failed to start: ${err.message}`);
    dialog.showErrorBox(
      "启动失败",
      `应用服务启动失败，请重试。\n\n错误: ${err.message}\n\n日志: ${path.join(app.getPath("userData"), "logs", "app.log")}`,
    );
    app.quit();
  }
});

app.on("window-all-closed", () => {
  if (serverProcess) {
    try {
      serverProcess.kill("SIGKILL");
    } catch {
      // ignore
    }
    serverProcess = null;
  }
  if (!IS_DEV) killPortProcess();
  app.quit();
});

app.on("activate", () => {
  if (mainWindow === null) createWindow();
});

app.on("before-quit", () => {
  if (serverProcess) {
    try {
      serverProcess.kill("SIGKILL");
    } catch {
      // ignore
    }
    serverProcess = null;
  }
  if (!IS_DEV) killPortProcess();
});
