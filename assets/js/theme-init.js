(function () {
  var stored = localStorage.getItem("graardor-theme");
  var theme = stored === "light" || stored === "dark" ? stored : "dark";
  document.documentElement.setAttribute("data-theme", theme);
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "light" ? "#f8f4eb" : "#1e1e1e");
})();
