const SESSION_KEY = "bahus:auth:session";

const MASTER_USER = {
  uid: "usr_master",
  name: "Александр (Bahus)",
  email: "liapustin@gmail.com", // Keeping this to match demo-data.js existing admin
  photoURL: "https://lh3.googleusercontent.com/a/ACg8ocL0r6... (mock)",
};

const MASTER_CREDENTIALS = {
  username: "bahus",
  password: "5112187Bahus",
};

export function createFirebaseAuthService() {
  let authStateCallback = null;

  return {
    isConfigured() {
      return true;
    },
    async initialize(onStateChange) {
      authStateCallback = onStateChange;
      const savedSession = window.localStorage.getItem(SESSION_KEY);
      if (savedSession) {
        try {
          const user = JSON.parse(savedSession);
          onStateChange(user);
        } catch {
          onStateChange(null);
        }
      } else {
        onStateChange(null);
      }
      return () => {
        authStateCallback = null;
      };
    },
    async signIn(username, password) {
      // Small artificial delay for realism
      await new Promise((resolve) => setTimeout(resolve, 600));

      if (
        username === MASTER_CREDENTIALS.username &&
        password === MASTER_CREDENTIALS.password
      ) {
        window.localStorage.setItem(SESSION_KEY, JSON.stringify(MASTER_USER));
        if (authStateCallback) authStateCallback(MASTER_USER);
        return MASTER_USER;
      }
      
      throw new Error("Неверный логин или пароль");
    },
    async signOut() {
      window.localStorage.removeItem(SESSION_KEY);
      if (authStateCallback) authStateCallback(null);
    },
  };
}
