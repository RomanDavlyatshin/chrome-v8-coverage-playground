if (!chrome.webNavigation.onBeforeNavigate.hasListeners()) {
  chrome.webNavigation.onBeforeNavigate.addListener((params) => cleanTabParsedSources(params.tabId));
}

setupRuntimeMessageListener(handleRuntimeRequests);

async function handleRuntimeRequests (request) {
  console.log('REQUEST TAB ID', request.tab.id);
  switch (request.action) {
    // MISC
    case 'getParsedScriptsUrls':
      return getParsedScriptsUrls(request.tab);
    case 'setTargetScriptUrl':
      setTargetScriptUrl(request.payload);
      break;

    // DevTools Connection
    case 'attachDevTools':
      await attachDevTools(request.tab);
      break;
    case 'detachDevTools':
      await detachDevTools(request.tab);
      break;

    // Profiler
    case 'enableProfiler':
      await enableProfiler(request.tab);
      break;
    case 'startPreciseCoverage':
      await startPreciseCoverage(request.tab);
      break;
    case 'takePreciseCoverage': {
      const data = await takePreciseCoverage(request.tab);
      printRangeCoverage(data, sources[request.tab.id]);
      break;
    }
    case 'stopPreciseCoverage':
      await stopPreciseCoverage(request.tab);
      break;
    case 'disableProfiler':
      await disableProfiler(request.tab);
      break;

    // Network
    case 'enableNetwork':
      await enableNetwork(request.tab);
      break;
    case 'setCacheDisabled':
      await setCacheDisabled(request.tab);
      break;
    case 'disableNetwork':
      await disableNetwork(request.tab);
      break;
    
    // Debugger
    case 'enableDebugger':
      await enableDebugger(request.tab);
      break;
    case 'addScriptParsedListener':
      await addScriptParsedListener(request.tab);
      break;
    case 'removeScriptParsedListener':
      await removeScriptParsedListener(request.tab);
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

const enableNetwork = async (tab) => {
  const target = {
    tabId: tab.id
  };
  await devTools.sendCommand(target, "Network.enable");
}
const disableNetwork = async (tab) => {
  const target = {
    tabId: tab.id
  };
  await devTools.sendCommand(target, "Network.disable");
}
const setCacheDisabled = async (tab) => {
  const target = {
    tabId: tab.id
  };
  await devTools.sendCommand(target, "Network.setCacheDisabled", { cacheDisabled: true });
}

const sources = {};

function cleanTabParsedSources(tabId) {
  // delete sources[tabId];
  console.log('CLEAN TAB PARSED SOURCES', tabId);
  sources[tabId] = {};
}

const listeners = {};
const removeScriptParsedListener = async (tab) => {
  if (!listeners[tab.id]) throw new Error(`tab ${tab.is} has no listeners`);
  listeners[tab.id].forEach(listener => chrome.debugger.onEvent.removeListener(listener));
  listeners[tab.id] = [];
}

const addScriptParsedListener = async (tab) => {
  const target = {
    tabId: tab.id
  };
  if (!sources[tab.id]) {
    console.log('addScriptParsedListener - CREATING OBJECT - sources[tab.id] for tab', tab.id);
    sources[tab.id] = {};
  }

  if (!listeners[tab.id]) {
    listeners[tab.id] = [];
  }

  if (listeners[tab.id].length > 0) throw new Error(`tab ${tab.id} already has a listener`)

  const listener = async (_, method, params) => {
    if (method !== 'Debugger.scriptParsed') {
      return;
    }

    const { url, scriptId } = params;
    if (!url) return;

    console.log('script parsed', url);

    const source = await devTools.sendCommand(target, 'Debugger.getScriptSource', { scriptId });
    // if (!sources[tab.id]) { // required because onBeforeNavigate wipes tab sources
    //   sources[tab.id] = {};
    // }
    if (!sources[tab.id][url]) {
      sources[tab.id][url] = {};
    }
    sources[tab.id][url][scriptId] = source;
  }
  listeners[tab.id].push(listener);
  chrome.debugger.onEvent.addListener(listener);
}

function getParsedScriptsUrls(tab) {
  const urls = sources[tab.id] && Object.keys(sources[tab.id]);
  if (!urls) throw new Error('No parsed sources. Execute addScriptParsedListener & enableDebugger first!')
  if (urls.length === 0) throw new Error(`No scripts were parsed for tab: tabId: ${tab.id} url ${tab.url}`);
  return urls;
}

let targetScriptUrl;
function setTargetScriptUrl(value) {
  targetScriptUrl = value;
}

function printRangeCoverage(data, tabSources) {
  if (!data || !data.result || data.result.length === 0) {
    console.error('No coverage to print. Try to perform some actions on the target tab!');
    return;
  }
  const filtered = targetScriptUrl ? data.result.filter(x => x.url === targetScriptUrl) : data.result;
  
  if (filtered.length === 0) {
    console.error('No coverage for scripts from target url', targetScriptUrl);
    return;
  }

  filtered.forEach((x) => {
    const { scriptId, functions, url } = x;
    if (!tabSources[url]) {
      console.log('sources for url', url, 'not found!');
      return;
    }
    const source = tabSources[url][scriptId];
    if (!source) {
      console.log('source for script', scriptId, 'not found!');
      return;
    }
    console.log(`%c${url} %cscriptId: ${scriptId}`, 'color: blue; font-weight: 600;', 'color: green;');
    print(source.scriptSource, functions);
    console.log('RAW COVERAGE', '\n', functions, '\n', 'RAW COVERAGE END')
    // _convertToDisjointSegments(functions.reduce((a, fn) => [...a, ...fn.ranges], []));
    // functions.forEach((fn, i) => console.log(`fn #${i} name: ${fn.name}`, fn.ranges))
  });
}

function _convertToDisjointSegments(ranges, stamp) {
  ranges.sort((a, b) => a.startOffset - b.startOffset);

  const result = [];
  const stack = [];
  for (const entry of ranges) {
    let top = stack[stack.length - 1];
    while (top && top.endOffset <= entry.startOffset) {
      append(top.endOffset, top.count);
      stack.pop();
      top = stack[stack.length - 1];
    }
    append(entry.startOffset, top ? top.count : 0);
    stack.push(entry);
  }

  for (let top = stack.pop(); top; top = stack.pop()) {
    append(top.endOffset, top.count);
  }

  function append(end, count) {
    const last = result[result.length - 1];
    if (last) {
      if (last.end === end) {
        return;
      }
      if (last.count === count) {
        last.end = end;
        return;
      }
    }
    result.push({end: end, count: count, stamp: stamp});
  }

  return result;
}

function print(rawSource, v8coverage) {
  let highlightedSource = rawSource;

  const cssUnset = 'background-color: unset;';
  const cssCovered = 'background-color: rgba(0, 255, 0, 0.1);';
  const cssNotCovered = 'background-color: rgba(255, 0, 0, 0.12);';

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
    // chrome.debugger.onEvent
    
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