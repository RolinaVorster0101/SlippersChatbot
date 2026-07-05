const form = document.getElementById("loginForm");
const errorMsg = document.getElementById("errorMsg");
const submitBtn = document.getElementById("submitBtn");

function showError(msg){
  errorMsg.textContent = msg;
  errorMsg.classList.add("show");
}
function hideError(){
  errorMsg.classList.remove("show");
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideError();

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;
  const turnstileInput = document.querySelector('[name="cf-turnstile-response"]');
  const turnstileToken = turnstileInput ? turnstileInput.value : "";

  submitBtn.disabled = true;
  submitBtn.textContent = "Logging in...";

  try{
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, turnstileToken }),
    });
    const data = await res.json();

    if(!res.ok){
      showError(data.error || "Login failed.");
      if(window.turnstile) window.turnstile.reset();
      submitBtn.disabled = false;
      submitBtn.textContent = "Log in";
      return;
    }

    window.location.href = "/";
  } catch(err){
    console.error(err);
    showError("Something went wrong. Please try again.");
    submitBtn.disabled = false;
    submitBtn.textContent = "Log in";
  }
});
