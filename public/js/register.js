const form = document.getElementById("registerForm");
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
  const password2 = document.getElementById("password2").value;
  const website = document.getElementById("website").value; // honeypot
  const ageConfirmed = document.getElementById("ageConfirm").checked;

  if(password !== password2){
    showError("Passwords don't match.");
    return;
  }
  if(!ageConfirmed){
    showError("Please confirm you're 18 or older to continue.");
    return;
  }

  const turnstileInput = document.querySelector('[name="cf-turnstile-response"]');
  const turnstileToken = turnstileInput ? turnstileInput.value : "";

  submitBtn.disabled = true;
  submitBtn.textContent = "Creating account...";

  try{
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, website, turnstileToken, ageConfirmed }),
    });
    const data = await res.json();

    if(!res.ok){
      showError(data.error || "Registration failed.");
      if(window.turnstile) window.turnstile.reset();
      submitBtn.disabled = false;
      submitBtn.textContent = "Create account";
      return;
    }

    window.location.href = "/";
  } catch(err){
    console.error(err);
    showError("Something went wrong. Please try again.");
    submitBtn.disabled = false;
    submitBtn.textContent = "Create account";
  }
});
