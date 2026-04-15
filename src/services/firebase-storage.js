const FIREBASE_WEB_CONFIG = {
  apiKey: "AIzaSyBysbIViSKzW-AixN65245M4Qz1Op8CPkk",
  authDomain: "bahus-492521.firebaseapp.com",
  projectId: "bahus-492521",
  storageBucket: "bahus-492521.firebasestorage.app",
  messagingSenderId: "920782563470",
  appId: "1:920782563470:web:d646d17c293e8735a681df",
};

const FIREBASE_SDK_VERSION = "12.0.0";

function sanitizeFileName(value) {
  return String(value || "file")
    .replace(/[^\p{L}\p{N}._-]+/gu, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

async function loadFirebaseSdk() {
  const [appModule, storageModule] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-storage.js`),
  ]);
  return { appModule, storageModule };
}

export function createFirebaseStorageService() {
  let storage = null;
  let storageModule = null;

  return {
    isConfigured() {
      return Boolean(
        FIREBASE_WEB_CONFIG.apiKey &&
          FIREBASE_WEB_CONFIG.projectId &&
          FIREBASE_WEB_CONFIG.storageBucket,
      );
    },
    async initialize() {
      if (storage && storageModule) return { storage, storageModule };
      const sdk = await loadFirebaseSdk();
      storageModule = sdk.storageModule;
      const app =
        sdk.appModule.getApps().length > 0
          ? sdk.appModule.getApps()[0]
          : sdk.appModule.initializeApp(FIREBASE_WEB_CONFIG);
      storage = sdk.storageModule.getStorage(app);
      return { storage, storageModule };
    },
    async uploadRequestFiles(files, { quoteDraftId = "new-quote", uploadedBy = "unknown", onProgress = null, timeoutMs = 15000 } = {}) {
      if (!this.isConfigured()) {
        throw new Error("Firebase Storage ещё не настроен для Bahus.");
      }

      const { storage: resolvedStorage, storageModule: resolvedStorageModule } = await this.initialize();
      const timestamp = Date.now();

      return Promise.all(
        files.map(async (file, index) => {
          const safeName = sanitizeFileName(file.name);
          const storagePath = `quote-requests/${quoteDraftId}/${timestamp}_${index + 1}_${safeName}`;
          const objectRef = resolvedStorageModule.ref(resolvedStorage, storagePath);
          const uploadTask = resolvedStorageModule.uploadBytesResumable(objectRef, file, {
            contentType: file.type || "application/octet-stream",
            customMetadata: {
              uploadedBy,
              source: "bahus-quote-request",
            },
          });

          const snapshot = await new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
              try {
                uploadTask.cancel();
              } catch {}
              reject(new Error("Firebase Storage слишком долго отвечает. Переключаемся на локальный черновик."));
            }, timeoutMs);
            uploadTask.on(
              "state_changed",
              (snapshot) => {
                if (typeof onProgress === "function") {
                  onProgress({
                    fileName: file.name,
                    transferred: snapshot.bytesTransferred,
                    total: snapshot.totalBytes || file.size || 0,
                    progress: snapshot.totalBytes ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100) : 0,
                    state: snapshot.state,
                  });
                }
              },
              (error) => {
                clearTimeout(timeoutId);
                reject(error);
              },
              () => {
                clearTimeout(timeoutId);
                resolve(uploadTask.snapshot);
              },
            );
          });

          const downloadUrl = await resolvedStorageModule.getDownloadURL(snapshot.ref);
          return {
            id: `${quoteDraftId}_${timestamp}_${index + 1}`,
            name: file.name,
            size: file.size,
            type: file.type || "unknown",
            status: "uploaded",
            storagePath,
            downloadUrl,
          };
        }),
      );
    },
  };
}
