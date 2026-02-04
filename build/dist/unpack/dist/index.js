"use strict";
var edaEsbuildExportName = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/index.ts
  var src_exports = {};
  __export(src_exports, {
    activate: () => activate,
    deactivate: () => deactivate,
    help: () => help,
    openSettings: () => openSettings,
    showStats: () => showStats,
    toggle: () => toggle
  });
  var STORAGE_KEY_API_KEY = "hackatime_api_key";
  var STORAGE_KEY_PAUSED = "hackatime_paused";
  var STORAGE_KEY_CACHE = "hackatime_cache";
  var DEFAULT_API_URL = "https://hackatime.hackclub.com/api/hackatime/v1";
  var onNetworkOnline = () => flushCache();
  var onUserKey = () => lastActivityTime = Date.now();
  var onUserMouse = () => lastActivityTime = Date.now();
  var lastActivityTime = Date.now();
  var heartbeatInterval = null;
  function activate() {
    console.log("HackaTime extension activated");
    if (typeof window !== "undefined") {
      window.addEventListener("mousedown", onUserMouse);
      window.addEventListener("keydown", onUserKey);
      window.addEventListener("online", onNetworkOnline);
    }
    flushCache();
    startHeartbeatLoop();
  }
  function deactivate() {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }
    if (typeof window !== "undefined") {
      window.removeEventListener("mousedown", onUserMouse);
      window.removeEventListener("keydown", onUserKey);
      window.removeEventListener("online", onNetworkOnline);
    }
  }
  function showStats() {
    const apiUrl = localStorage.getItem("hackatime_api_url") || DEFAULT_API_URL;
    const dashboardUrl = apiUrl.split("/api/")[0];
    try {
      eda.sys_Dialog.showConfirmationMessage(
        "Open Hackatime Dashboard in your browser?",
        "Show Statistics",
        "Confirm",
        "Cancel",
        (confirmed) => {
          if (confirmed)
            window.open(dashboardUrl, "_blank");
        }
      );
    } catch (e) {
      if (confirm("Open Hackatime Dashboard in your browser?"))
        window.open(dashboardUrl, "_blank");
    }
  }
  function help() {
    try {
      eda.sys_Dialog.showInformationMessage(
        "For help with Hackatime, please visit https://hackatime.hackclub.com/docs",
        "About Hackatime"
      );
    } catch (e) {
      alert("For help with Hackatime, please visit https://hackatime.hackclub.com/docs");
    }
  }
  function openSettings() {
    const currentKey = localStorage.getItem(STORAGE_KEY_API_KEY) || "";
    try {
      eda.sys_Dialog.showInputDialog(
        "Hackatime API Key",
        void 0,
        "Set Hackatime API Key",
        "text",
        currentKey,
        { placeholder: "Enter your Hackatime API Key" },
        (value) => {
          if (value !== void 0 && value !== null) {
            localStorage.setItem(STORAGE_KEY_API_KEY, String(value).trim());
            try {
              eda.sys_Dialog.showInformationMessage("API Key saved", "Hackatime");
            } catch (e) {
              alert("API Key saved");
            }
          }
        }
      );
    } catch (e) {
      const val = prompt("Enter Hackatime API Key", currentKey || "");
      if (val !== null) {
        localStorage.setItem(STORAGE_KEY_API_KEY, String(val).trim());
        alert("API Key saved");
      }
    }
  }
  function toggle() {
    const isPaused = localStorage.getItem(STORAGE_KEY_PAUSED) === "true";
    const nextState = !isPaused;
    localStorage.setItem(STORAGE_KEY_PAUSED, String(nextState));
    try {
      eda.sys_Dialog.showInformationMessage(
        `Hackatime Detect${nextState ? "paused" : "resumed"}`,
        "Hackatime"
      );
    } catch (e) {
      alert(`Hackatime Detect${nextState ? "paused" : "resumed"}`);
    }
  }
  function startHeartbeatLoop() {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }
    heartbeatInterval = setInterval(() => {
      sendHeartbeat();
    }, 2 * 60 * 1e3);
  }
  async function sendHeartbeat() {
    const isPaused = localStorage.getItem(STORAGE_KEY_PAUSED) === "true";
    if (isPaused)
      return;
    const apiKey = localStorage.getItem(STORAGE_KEY_API_KEY);
    if (!apiKey)
      return;
    if (Date.now() - lastActivityTime > 2 * 60 * 1e3)
      return;
    const projectInfo = await eda.dmt_Project.getCurrentProjectInfo();
    const docInfo = await eda.dmt_SelectControl.getCurrentDocumentInfo();
    if (!projectInfo)
      return;
    const payload = {
      entity: docInfo?.uuid || "unknown",
      type: "file",
      category: "designing",
      time: Math.floor(Date.now() / 1e3),
      project: projectInfo.friendlyName || "Unknown Project",
      language: String(docInfo?.documentType) === "pcb" ? "EasyEDA PCB" : "EasyEDA Schematic",
      is_write: true
    };
    try {
      const res = await eda.sys_ClientUrl.request(
        `${DEFAULT_API_URL}/users/current/heartbeats`,
        "POST",
        JSON.stringify(payload),
        {
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          }
        }
      );
      if (!res || res.status !== 200 && res.status !== 201) {
        cacheHeartbeat(payload);
      } else {
        flushCache();
      }
    } catch (e) {
      cacheHeartbeat(payload);
    }
  }
  function cacheHeartbeat(item) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CACHE) || "[]";
      const arr = JSON.parse(raw);
      arr.push(item);
      if (arr.length > 500)
        arr.shift();
      localStorage.setItem(STORAGE_KEY_CACHE, JSON.stringify(arr));
    } catch (e) {
    }
  }
  async function flushCache() {
    try {
      const apiKey = localStorage.getItem(STORAGE_KEY_API_KEY);
      if (!apiKey)
        return;
      const raw = localStorage.getItem(STORAGE_KEY_CACHE);
      if (!raw)
        return;
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr) || arr.length === 0)
        return;
      localStorage.setItem(STORAGE_KEY_CACHE, JSON.stringify([]));
      for (const item of arr) {
        try {
          const res = await eda.sys_ClientUrl.request(
            `${DEFAULT_API_URL}/users/current/heartbeats`,
            "POST",
            JSON.stringify(item),
            {
              headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
              }
            }
          );
          if (!res || res.status !== 200 && res.status !== 201) {
            cacheHeartbeat(item);
          }
        } catch (e) {
          cacheHeartbeat(item);
          break;
        }
      }
    } catch (e) {
    }
  }
  return __toCommonJS(src_exports);
})();
