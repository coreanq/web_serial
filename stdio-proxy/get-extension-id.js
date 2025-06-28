// get-extension-id.js
// Chrome DevTools Console에서 실행할 스크립트

console.log("Chrome Extension ID 확인 방법:");
console.log("1. chrome://extensions 페이지에서 개발자 모드 활성화");
console.log("2. 확장 프로그램의 ID 확인");
console.log("3. 또는 아래 스크립트를 Extension의 background.js에서 실행:");
console.log("");
console.log("chrome.runtime.id");
console.log("");
console.log("현재 Extension ID:", chrome?.runtime?.id || "Extension context가 아님");