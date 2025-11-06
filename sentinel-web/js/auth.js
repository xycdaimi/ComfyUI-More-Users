let failedAttempts = 0;
let timeoutEndTime = null;

Object.defineProperty(String.prototype, 'capitalize', {
  value: function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
  },
  enumerable: false
});

if (window.location.pathname === "/register") {
  document.addEventListener("DOMContentLoaded", () => {
    const adminFields = document.getElementById("admin-fields");
    const registerLink = document.getElementById("register-link");
    const verticalDivider = document.getElementById("vertical-divider");
    const isAdminUser = document.body.dataset.adminUser === "true";

    adminFields.style.display = isAdminUser ? "none" : "block";
    registerLink.style.display = isAdminUser ? "none" : "block";
    verticalDivider.style.display = isAdminUser ? "none" : "block";
  });
}

function addToast(message, type) {
  const toasts = document.getElementById("toasts");
  const toast = document.createElement("div");

  toast.classList.add("toast", "hide", type);
  toast.textContent = message;

  toasts.appendChild(toast);

  setTimeout(() => {
    toast.classList.replace("hide", "show");
  }, 500);

  setTimeout(() => {
    toast.classList.replace("show", "hide");
  }, 4500);

  setTimeout(() => {
    toast.remove();
  }, 5500);
}

function validateRegisterForm() {
  const usernameField = document.getElementById("new_user_username");
  const passwordField = document.getElementById("new_user_password");
  const newUsername = usernameField.value;
  const newPassword = passwordField.value;

  usernameField.classList.remove("error");
  passwordField.classList.remove("error");

  if (/[^a-zA-Z0-9_]/.test(newUsername) || /\s/.test(newUsername)) {
    addToast(
      "Username can only contain letters, numbers, and underscores",
      "error"
    );
    usernameField.classList.add("error");
    return false;
  }

  if (!newUsername.trim() || newUsername.trim().length < 3) {
    addToast("Username must be at least 3 characters", "error");
    usernameField.classList.add("error");
    return false;
  }

  if (!newPassword.trim() || /\s/.test(newPassword)) {
    addToast("Password cannot contain spaces", "error");
    passwordField.classList.add("error");
    return false;
  }

  if (
    newPassword.trim().length < 8 ||
    !/\d/.test(newPassword) ||
    !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>?/`~]/.test(newPassword)
  ) {
    addToast(
      "Password must be at least 8 characters, include a number, and a special character",
      "error"
    );
    passwordField.classList.add("error");
    return false;
  }

  return true;
}

function validateGenerateForm() {
  const usernameField = document.getElementById("username");
  const passwordField = document.getElementById("password");
  const expireField = document.getElementById("expire_hours");
  const expire_hours = expireField.value;

  usernameField.classList.remove("error");
  passwordField.classList.remove("error");
  expireField.classList.remove("error");

  if (/[^0-9]/.test(expire_hours) || /\s/.test(expire_hours)) {
    addToast(
      "Expiration can only contain numbers",
      "error"
    );
    expireField.classList.add("error");
    return false;
  }

  return true;
}

function disableForm(duration, action) {
  const form = document.getElementById(`${action}-form`);
  const button = form.querySelector("button[type='submit']");
  button.disabled = true;

  // const fields = form.querySelectorAll("input, button");
  // fields.forEach((field) => (field.disabled = true));

  let remainingTime = duration;

  if (remainingTime > 0) {
    const countdownInterval = setInterval(() => {
      const minutes = Math.floor(remainingTime / 60);
      const seconds = remainingTime % 60;
      const remainingTimeMessage =
        remainingTime > 60 ? `${minutes}min ${seconds}s` : `${remainingTime}s`;

      button.textContent = `Wait ${remainingTimeMessage}`;
      remainingTime--;

      if (remainingTime <= 0) {
        clearInterval(countdownInterval);
        button.disabled = false;
        button.textContent = action.capitalize();
        // fields.forEach((field) => (field.disabled = false));
      }
    }, 1000);
  } else {
    button.disabled = false;
    button.textContent = action.capitalize();
  }
}

function loadTimeoutFromStorage(action) {
  const savedFailedAttempts =
    parseInt(localStorage.getItem("failedAttempts"), 10) || 0;
  const savedLockoutEndTime =
    parseInt(localStorage.getItem("timeoutEndTime"), 10) || null;

  failedAttempts = savedFailedAttempts;
  timeoutEndTime = savedLockoutEndTime;

  const currentTime = Date.now();
  const remainingTime = Math.round(
    timeoutEndTime ? Math.max(0, (timeoutEndTime - currentTime) / 1000) : 0
  );

  if (remainingTime !== 0) {
    disableForm(remainingTime, action);
  }
}

function setTimeoutFromServer(
  serverFailedAttempts,
  serverRemainingSeconds,
  action
) {
  const currentTime = Date.now();

  localStorage.setItem("failedAttempts", serverFailedAttempts);
  localStorage.setItem(
    "timeoutEndTime",
    currentTime + serverRemainingSeconds * 1000
  );

  loadTimeoutFromStorage(action);
}

function updateFailedAttempts(responseStatus, result, action) {
  if (![200, 400, 401, 403].includes(responseStatus)) {
    return;
  }

  if (result.failed_attempts && result.remaining_seconds) {
    setTimeoutFromServer(
      result.failed_attempts,
      result.remaining_seconds,
      action
    );
    return;
  }

  if (responseStatus === 200) {
    localStorage.removeItem("failedAttempts");
    localStorage.removeItem("timeoutEndTime");
    failedAttempts = 0;
    timeoutEndTime = null;
  }

  if (![200, 400].includes(responseStatus)) {
    failedAttempts++;
  }

  localStorage.setItem("failedAttempts", failedAttempts);

  let timeoutDuration = 0;
  if (failedAttempts >= 9) {
    timeoutDuration = 300;
  } else if (failedAttempts >= 6) {
    timeoutDuration = 90;
  } else if (failedAttempts >= 3) {
    timeoutDuration = 60;
  }

  const currentTime = Date.now();
  timeoutEndTime = currentTime + timeoutDuration * 1000;
  localStorage.setItem("timeoutEndTime", timeoutEndTime);

  disableForm(timeoutDuration, action);
}

function isTimedOut() {
  const currentTime = Date.now();
  if (timeoutEndTime && currentTime < timeoutEndTime) {
    const remainingTimeInSeconds = Math.round(
      (timeoutEndTime - currentTime) / 1000
    );
    const minutes = Math.floor(remainingTimeInSeconds / 60);
    const seconds = remainingTimeInSeconds % 60;
    const remainingTimeMessage =
      remainingTimeInSeconds > 60
        ? `${minutes} minute${minutes > 1 ? "s" : ""} and ${seconds} second${
            seconds > 1 ? "s" : ""
          }`
        : `${remainingTimeInSeconds} second${
            remainingTimeInSeconds > 1 ? "s" : ""
          }`;

    addToast(
      `Too many failed attempts. Please wait ${remainingTimeMessage}`,
      "error"
    );
    return true;
  }
  return false;
}

async function login(event) {
  event.preventDefault();

  if (!isTimedOut()) {
    const button = event.submitter;
    const form = document.getElementById("login-form");
    const formData = new FormData(form);
    const usernameField = document.getElementById("username");
    const passwordField = document.getElementById("password");

    try {
      usernameField.classList.remove("error");
      passwordField.classList.remove("error");
      button.disabled = true;
      button.textContent = "Sending...";

      const response = await fetch("/login", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        let cookieString = `jwt_token=${result.token}; path=/; HttpOnly; SameSite=Strict`;

        if (window.location.protocol === "https:") {
          cookieString += "; Secure";
        }

        document.cookie = cookieString;
        if (result.user_settings_id) {
          localStorage.setItem("Comfy.userId", result.user_settings_id); 
        }
        // localStorage.setItem("Comfy.userId", result.user_settings_id);
        addToast(result.message, "success");
        window.location.href = "/";
      } else {
        usernameField.classList.add("error");
        passwordField.classList.add("error");
        addToast(result.error || result.message || "Login failed", "error");
      }
      updateFailedAttempts(response.status, result, "login");
    } catch (error) {
      addToast("An error occurred: " + error.message, "error");
      button.disabled = false;
      button.textContent = "Login";
    }
  }
}

async function register(event) {
  event.preventDefault();

  if (validateRegisterForm() && !isTimedOut()) {
    const button = event.submitter;
    const form = document.getElementById("register-form");
    const formData = new FormData(form);

    try {
      button.disabled = true;
      button.textContent = "Sending...";

      const response = await fetch("/register", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        addToast(result.message, "success");
        updateFailedAttempts(response.status, result, "register");

        const isAdminUser = document.body.dataset.adminUser === "true";
        if (isAdminUser) {
          window.location.href = "/login";
        }

        form.reset();
      } else {
        addToast(
          result.error || result.message || "Registration failed",
          "error"
        );
      }
      updateFailedAttempts(response.status, result, "register");
    } catch (error) {
      addToast("An error occurred: " + error.message, "error");
      button.disabled = false;
      button.textContent = "Register";
    }
  }
}

async function generate(event) {
  event.preventDefault();

  if (validateGenerateForm() && !isTimedOut()) {
    const button = event.submitter;
    const form = document.getElementById("generate-form");
    const formData = new FormData(form);

    try {
      button.disabled = true;
      button.textContent = "Sending...";

      const response = await fetch("/generate_token", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        addToast(result.message, "success");
        updateFailedAttempts(response.status, result, "generate");

        form.reset();

        //alert("API Token:\n"+result.jwt_token+"\n\nPlease copy this token and store it in a safe place. You will not be able to retrieve it again.");
        showTokenModal(result.jwt_token);
      } else {
        addToast(
          result.error || result.message || "Generation failed",
          "error"
        );
      }
      updateFailedAttempts(response.status, result, "generate");
    } catch (error) {
      addToast("An error occurred: " + error.message, "error");
      button.disabled = false;
      button.textContent = "Generate";
    }
  }
}

loadTimeoutFromStorage(window.location.pathname.replace("/", "").split("_")[0])


/**
 * 弹出模态框显示 Token 并提供复制功能
 * @param {string} token API Token 密钥
 */
function showTokenModal(token) {
    const modalId = 'token-modal';
    
    // 如果模态框已经存在，先移除它
    const existingModal = document.getElementById(modalId);
    if (existingModal) {
        existingModal.remove();
    }
    
    // 模态框 HTML 结构
    const modalHTML = `
        <div id="${modalId}" class="modal">
            <div class="modal-content">
                <span class="close-button">&times;</span>
                <h3>API Token 已生成</h3>
                <p>请复制此密钥并安全保存，您将无法再次获取它。</p>
                <div class="token-container">
                    <input type="text" id="api-token-input" value="${token}" readonly>
                    <button id="copy-token-btn" class="copy-btn">复制</button>
                </div>
                <div id="copy-status" style="margin-top: 10px; color: green; display: none;">已复制到剪贴板！</div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const modal = document.getElementById(modalId);
    const closeButton = modal.querySelector(".close-button");
    const copyButton = document.getElementById("copy-token-btn");
    const tokenInput = document.getElementById("api-token-input");
    const copyStatus = document.getElementById("copy-status");

    // 显示模态框
    modal.style.display = "block";

    // 复制逻辑
    copyButton.onclick = async function() {
        try {
            await navigator.clipboard.writeText(token);
            copyStatus.style.display = "block";
            copyButton.textContent = "已复制";
            setTimeout(() => {
                copyStatus.style.display = "none";
                copyButton.textContent = "复制";
            }, 2000);
        } catch (err) {
            // 兼容旧浏览器或非 HTTPS 环境
            tokenInput.select();
            document.execCommand('copy');
            copyStatus.style.display = "block";
            copyButton.textContent = "已复制 (旧方法)";
            setTimeout(() => {
                copyStatus.style.display = "none";
                copyButton.textContent = "复制";
            }, 3000);
        }
    }

    // 关闭逻辑
    closeButton.onclick = function() {
        modal.style.display = "none";
        modal.remove();
    }
    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = "none";
            modal.remove();
        }
    }
}
