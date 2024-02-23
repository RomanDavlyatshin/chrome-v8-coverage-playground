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
function addAction(action, prefix, callback) {
  const contentPane = document.getElementById("content-pane");
  const button = document.createElement('button');
  contentPane.appendChild(button);
  button.textContent = action;
  button.style = 'margin: 7px;';
  if (prefix) {
    button.textContent = `${prefix}.${button.textContent}`;
    button.style = 'margin: 7px; font-weight: 600;';
  }
  button.addEventListener('click', () => executeAction(action, '', callback), false)
}

async function executeAction(action, payload, callback) {
  const message = document.getElementById("message");
  message.textContent = action + ' in process';
  chrome.tabs.query({ active: true }, async (activeTabs) => {
    try {
      const result = await sendMessage({ action: action, payload, tab: activeTabs[0] });
      if (callback) {
        callback(result);
      }
      message.textContent = action + ' done!';
      message.style = 'color: green';
    } catch (e) {
      message.textContent = `${action} - error: ${e.message || 'something bad happened'}`;
      message.style = 'color: red';
    }
  });
}

function addDelimiter(text) {
  const elem = document.createElement('div');
  elem.textContent = text;
  elem.style = 'margin-top: 15px;';
  const contentPane = document.getElementById("content-pane");
  contentPane.appendChild(elem);
}

function addElement(parentId, type, attributes) {
  const elem = document.createElement(type);
  for (const attr in attributes) {
    if (Object.hasOwnProperty.call(attributes, attr)) {
      elem[attr] = attributes[attr];
    }
  }
  const parent = document.getElementById(parentId);
  parent.appendChild(elem);
  return elem;
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
  
  // Network
  addDelimiter('Network')
  addAction('enableNetwork', 2);
  addAction('setCacheDisabled', 3);

  // Debugger
  addDelimiter('Debugger')
  addAction('addScriptParsedListener', 4);
  addAction('enableDebugger', 5);

  // Script urls
  addDelimiter('Pick the script to print coverage for')
  addAction('getParsedScriptsUrls', '', function (data) {
    data.forEach(function(url) {
      addElement('targetScriptUrl', 'option', { value: url, text: url });
    })
  });
  const select = addElement('content-pane', 'select', { id: 'targetScriptUrl', style: 'max-width: 100%' });
  select.addEventListener('change', function (e) {
    executeAction('setTargetScriptUrl', e.target.value);
  });
  addElement('targetScriptUrl', 'option', { value: '', text: 'none (print all)' });
    
  
  addDelimiter('Profiler')
  addAction('enableProfiler', 6);
  addAction('startPreciseCoverage', 7);
  addAction('takePreciseCoverage', 8);
  addAction('stopPreciseCoverage');

  addDelimiter('Disable & remove everything')
  addAction('disableProfiler');
  addAction('disableDebugger');
  addAction('disableNetwork');
  addAction('detachDevTools');
  addAction('removeScriptParsedListener');
}, false)
