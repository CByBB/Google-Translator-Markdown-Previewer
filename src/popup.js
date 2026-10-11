const input = document.getElementById("enabled");

chrome.storage.local.get({ mdPreviewEnabled: true }, function (cfg) {
  input.checked = cfg.mdPreviewEnabled !== false;
});

input.addEventListener("change", function () {
  chrome.storage.local.set({ mdPreviewEnabled: input.checked });
});
