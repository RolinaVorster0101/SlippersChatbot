(function(){
  const CONSENT_KEY = "slippers-cookie-consent";

  function injectBanner(){
    if(localStorage.getItem(CONSENT_KEY)) return; // already decided

    const banner = document.createElement("div");
    banner.id = "cookieBanner";
    banner.innerHTML = `
      <p>We use a strictly necessary cookie to keep you logged in — no ads, no tracking, no analytics.
      See our <a href="/privacy.html">Privacy Policy</a> for details.</p>
      <div class="cookieBtns">
        <button id="cookieReject">Reject non-essential</button>
        <button id="cookieAccept">Accept</button>
      </div>
    `;
    document.body.appendChild(banner);

    document.getElementById("cookieAccept").addEventListener("click", () => {
      localStorage.setItem(CONSENT_KEY, "accepted");
      banner.remove();
    });
    document.getElementById("cookieReject").addEventListener("click", () => {
      localStorage.setItem(CONSENT_KEY, "rejected");
      banner.remove();
      // Note: the session cookie itself is strictly necessary for login to work at
      // all, so "reject" here just records the preference (and skips any future
      // optional/analytics cookies, of which this site currently has none) —
      // it can't disable the login cookie without breaking the ability to log in.
    });
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", injectBanner);
  } else {
    injectBanner();
  }
})();
