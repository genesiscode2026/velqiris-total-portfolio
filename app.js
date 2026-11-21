document.querySelectorAll('a[href^="#"]').forEach((link) => link.addEventListener("click", (event) => {
  const target = document.querySelector(link.getAttribute("href"));
  if (!target) return;
  event.preventDefault();
  target.scrollIntoView({behavior:"smooth",block:"start"});
}));
const reveal = new IntersectionObserver((entries) => entries.forEach((entry) => {
  if (entry.isIntersecting) entry.target.classList.add("visible");
}), {threshold:.12});
document.querySelectorAll(".product,.extension-grid article,.test-row").forEach((element) => {
  element.classList.add("reveal"); reveal.observe(element);
});
function copySellerEmail(btn) {
  navigator.clipboard.writeText("chitara.trading@proton.me").then(function() {
    var orig = btn.innerText;
    btn.innerText = "Copied!";
    setTimeout(function() { btn.innerText = orig; }, 2000);
  });
}
window.copySellerEmail = copySellerEmail;

