async function sendMessage(message) {
  return new Promise((resolve, reject) => {
    // reference https://developer.chrome.com/extensions/runtime#method-sendMessage
    chrome.runtime.sendMessage('', message, {}, (response) => {
      if (response?.error) {
        reject(new Error(response.error));
      } else {
        resolve(response);
      }
    });
  });
}

let counter = 1;
function addAction(name, prefix) {
  const message = document.getElementById("message");
  const contentPane = document.getElementById("content-pane");
  const button = document.createElement('button');
  contentPane.appendChild(button);
  button.textContent = name;
  button.style = 'margin: 7px;';
  if (prefix) {
    button.textContent = `${prefix}.${button.textContent}`;
    button.style = 'margin: 7px; font-weight: 600;';
  }
  button.addEventListener('click', () => {
    message.textContent = name + ' in process';
    chrome.tabs.getSelected(null, async (tab) => {
      try {
        await sendMessage({ "action": name, "tab": tab });
        message.textContent = name + ' done!';
        message.style = 'color: green';
      } catch (e) {
        message.textContent = `${name} - error: ${e.message || 'something bad happened'}`;
        message.style = 'color: red';
      }
    });
  }, false )
}

function addDelimiter(text) {
  const elem = document.createElement('div');
  elem.textContent = text;
  elem.style = 'margin-top: 15px;';
  const contentPane = document.getElementById("content-pane");
  contentPane.appendChild(elem);
}

function addSubtitle(text) {
  const elem = document.createElement('div');
  elem.textContent = text;
  elem.style = 'margin-top: 7px;';
  const contentPane = document.getElementById("content-pane");
  contentPane.appendChild(elem);
}

document.addEventListener("DOMContentLoaded", () => {
  addDelimiter('Dev Tools');
  addAction('attachDevTools', 1);
  addAction('detachDevTools');

  addDelimiter('Profiler');
  addAction('enableProfiler', 4);
  addAction('disableProfiler');

  addDelimiter('Coverage');
  addAction('startPreciseCoverage', 5);
  addSubtitle('Press takePreciseCoverage button to take coverage "snapshot"');
  addSubtitle('Try doing something on the page and press takePreciseCoverage between actions');
  addSubtitle('You can reload application page, that will not stop coverage recording');
  addAction('takePreciseCoverage');
  addAction('stopPreciseCoverage');
  
  addDelimiter('Debugger');
  addAction('enableDebugger', 3);
  addAction('addScriptParsedListener', 2);
  addAction('disableDebugger');
}, false)
