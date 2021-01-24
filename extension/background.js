setupRuntimeMessageListener(handleRuntimeRequests);

async function handleRuntimeRequests (request) {
  switch (request.action) {
    case 'attachDevTools':
      await attachDevTools(request.tab);
      break;
    case 'enableProfiler':
      await enableProfiler(request.tab);
      break;
    case 'startPreciseCoverage':
      await startPreciseCoverage(request.tab);
      break;
    case 'takePreciseCoverage': {
      const data = await takePreciseCoverage(request.tab);
      printRangeCoverage(data);
      break;
    }
    case 'stopPreciseCoverage':
      await stopPreciseCoverage(request.tab);
      break;
    case 'disableProfiler':
      await disableProfiler(request.tab);
      break;
    case 'detachDevTools':
      await detachDevTools(request.tab);
      break;

    case 'enableDebugger':
      await enableDebugger(request.tab);
      break;
    case 'addScriptParsedListener':
      await addScriptParsedListener(request.tab);
      break;
    case 'disableDebugger':
      await disableDebugger(request.tab);
      break;
  }
  console.log(request.action, 'done!');
}

const attachDevTools = async (tab) => {
  const target = {
    tabId: tab.id
  };
  await devTools.attach(target)
}

const enableProfiler = async (tab) => {
  const target = {
    tabId: tab.id
  };
  await devTools.sendCommand(target, "Profiler.enable");
}

const startPreciseCoverage = async (tab) => {
  const target = {
    tabId: tab.id
  };
  await devTools.sendCommand(target, "Profiler.startPreciseCoverage", {
    callCount: false,
    detailed: true
  });
}

const takePreciseCoverage = async (tab) => {
  const target = {
    tabId: tab.id
  };
  return await devTools.sendCommand(target, "Profiler.takePreciseCoverage");
}

const stopPreciseCoverage = async (tab) => {
  const target = {
    tabId: tab.id
  };
  await devTools.sendCommand(target, "Profiler.stopPreciseCoverage");
}

const disableProfiler = async (tab) => {
  const target = {
    tabId: tab.id
  };
  await devTools.sendCommand(target, "Profiler.disable");
}

const detachDevTools = async (tab) => {
  const target = {
    tabId: tab.id
  };
  await devTools.detach(target)
}

const enableDebugger = async (tab) => {
  const target = {
    tabId: tab.id
  };
  await devTools.sendCommand(target, "Debugger.enable"); 
}

const sources = {};
const addScriptParsedListener = async (tab) => {
  const target = {
    tabId: tab.id
  };
  chrome.debugger.onEvent.addListener(async (_, method, params) => {
    if (method !== 'Debugger.scriptParsed') {
      return;
    }

    const { url, scriptId } = params;
    if (!url) return;

    const source = await devTools.sendCommand(target, 'Debugger.getScriptSource', { scriptId });
    if (!sources[url]) {
      sources[url] = {};
    }
    sources[url][scriptId] = source;
  });
}

function printRangeCoverage(data) {
  if (!data || !data.result || data.result.length === 0) {
    const msg = 'No coverage to print. Try to perform some actions on the target tab!';
    console.error(msg);
  }
  data.result.forEach((x) => {
    const { scriptId, functions, url } = x;
    if (!sources[url]) {
      console.log('sources for url', url, 'not found!');
      return;
    }
    const source = sources[url][scriptId];
    if (!source) {
      console.log('source for script', scriptId, 'not found!');
      return;
    }
    console.log(`%c${url} %cscriptId: ${scriptId}`, 'color: blue; font-weight: 600;', 'color: green;');
    print(source.scriptSource, functions);
  });
}

function print(rawSource, v8coverage) {
  let highlightedSource = rawSource;

  const cssUnset = 'background-color: unset;';
  const cssCovered = 'background-color: green;';
  const cssNotCovered = 'background-color: red;';

  let styles = [cssUnset];
  let injectOffset = 2;
  highlightedSource = `%c${highlightedSource}`;
  
  const consecutiveRanges = convertToConsecutiveRanges(v8coverage);

  consecutiveRanges
    .forEach(range => {
      // paint range
      highlightedSource = splice(highlightedSource, injectOffset + range.startOffset, 0, '%c');
      styles.push(range.count > 0 ? cssCovered : cssNotCovered);
      injectOffset += 2;

      // reset style for next characters
      highlightedSource = splice(highlightedSource, injectOffset + range.endOffset, 0, '%c');
      styles.push(cssUnset)
      injectOffset += 2;
    });

  console.log(highlightedSource, ...styles);
}

const disableDebugger = async (tab) => {
  const target = {
    tabId: tab.id
  };
  await devTools.sendCommand(target, "Debugger.disable");
}

function setupRuntimeMessageListener(handler) {
  chrome.runtime.onMessage.addListener((message, sender, callback) => {
    (async () => {
      try {
        // console.log('chrome.runtime.onMessage', sender, message);
        const data = await handler(message);
        callback(data);
      } catch (e) {
        console.error(e.message, e.stack);
        callback({ error: `Background script error: ${e.message}` });
      }
    })();
    return true;
  });
}

function convertToConsecutiveRanges(functions) {
  return functions.reduce((acc, fn) => {
    return fn.ranges.reduce((acc2, range) => {
      return mergeRange(acc2, range);
    }, acc);
  }, []);
}

function mergeRange(successiveRanges, newRange) {
  const rangesToInsert = [newRange];
  if (successiveRanges.length === 0) {
    return rangesToInsert;
  }

  const intersectionIndex = successiveRanges.findIndex(
    range => range.startOffset <= newRange.startOffset && range.endOffset >= newRange.endOffset,
  );

  if (intersectionIndex === -1) {
    const rightNeighboringRange = successiveRanges.findIndex(range => range.startOffset >= newRange.endOffset) > -1;
    if (rightNeighboringRange) {
      return [newRange, ...successiveRanges];
    }
    return [...successiveRanges, newRange];
  }

  const intersectedRange = successiveRanges[intersectionIndex];

  const touchStart = intersectedRange.startOffset === newRange.startOffset;
  const touchEnd = intersectedRange.endOffset === newRange.endOffset;
  if (touchStart) {
    rangesToInsert.push({
      startOffset: newRange.endOffset,
      endOffset: intersectedRange.endOffset,
      count: intersectedRange.count,
    });
  } else if (touchEnd) {
    rangesToInsert.unshift({
      startOffset: intersectedRange.startOffset,
      endOffset: newRange.startOffset,
      count: intersectedRange.count,
    });
  } else {
    // newRange is completely nested inside intersectedRange
    rangesToInsert.push({
      startOffset: newRange.endOffset,
      endOffset: intersectedRange.endOffset,
      count: intersectedRange.count,
    });
    rangesToInsert.unshift({
      startOffset: intersectedRange.startOffset,
      endOffset: newRange.startOffset,
      count: intersectedRange.count,
    });
  }

  const resultingRanges = [...successiveRanges];
  resultingRanges.splice(intersectionIndex, 1, ...rangesToInsert);
  return resultingRanges;
}

const devTools = {
  attach(target) {
    const DEBUGGER_VERSION = "1.3";
    return promisifyBrowserApiCall(chrome.debugger.attach, target, DEBUGGER_VERSION);
  },

  sendCommand(target, method, params) {
    return promisifyBrowserApiCall(chrome.debugger.sendCommand, target, method, params);
  },

  detach(target) {
    return promisifyBrowserApiCall(chrome.debugger.detach, target);
  },
};

function splice(str, index, count, add) {
  // We cannot pass negative indexes directly to the 2nd slicing operation.
  if (index < 0) {
    index = str.length + index;
    if (index < 0) {
      index = 0;
    }
  }

  return str.slice(0, index) + (add || "") + str.slice(index + count);
}

function promisifyBrowserApiCall(apiFunction, ...params) {
  return new Promise((resolve, reject) => {
    apiFunction(...params, (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(result);
      }
    });
  });
}